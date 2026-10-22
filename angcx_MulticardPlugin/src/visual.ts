/*
 * ============================================================================
 *  angcx_ Multicard Plugin
 *  Created by angcx_
 *
 *  Power BI custom visual: multi-card KPI with title, value, period-over-period
 *  sub value (favourable / unfavourable colours), sub heading, per-card
 *  formatting with conditional formatting (fx) and drill-through.
 * ============================================================================
 */

"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { valueFormatter } from "powerbi-visuals-utils-formattingutils";
import "./../style/visual.less";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import ISelectionId = powerbi.visuals.ISelectionId;
import DataView = powerbi.DataView;
import DataViewValueColumn = powerbi.DataViewValueColumn;
import DataViewMetadataColumn = powerbi.DataViewMetadataColumn;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

import {
    Bag, Resolved, FontValue, LAYOUT, INTERACTIONS, MAX_COMPARISONS,
    resolveCard, resolveObject, buildFormattingModel
} from "./settings";

interface CompareValue { value: number | null; name: string; format: string; }

interface CardData {
    key: string;
    defaultTitle: string;
    value: number | null;
    format: string;
    measureName: string;
    comparisons: CompareValue[];    // every measure in the Comparison well, for this card's row
    autoIndex: number;              // which comparison "Auto" uses
    subHeading: string | null;
    labelText: string | null;       // from the "Comparison label" text measure
    asAt: Date | null;
    selectionId: ISelectionId | null;
    selector: powerbi.data.Selector;
    ruleSelector: powerbi.data.Selector;
    settings: Resolved;
}

interface ComparisonResult {
    prior: CompareValue & { value: number };
    delta: number;
    pct: number | null;
    state: "up" | "down" | "flat";
    good: "good" | "bad" | "flat";
}

type Settings = Record<string, unknown>;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const AUTO_MIN_WIDTH = 170;
// Data-view wildcard (InstancesAndTotals) – lets Power BI evaluate an fx rule per card.
const WILDCARD = { dataViewWildcard: { matchingOption: 0 } };
const sel = (o: object): powerbi.data.Selector => o as powerbi.data.Selector;

export class Visual implements IVisual {
    private host: IVisualHost;
    private root: HTMLElement;
    private grid: HTMLElement;
    private nav: HTMLElement;
    private selectionManager: ISelectionManager;
    private formattingSettingsService: FormattingSettingsService;
    private cards: CardData[] = [];
    private visibleCards: CardData[] = [];
    private cardEls: HTMLElement[] = [];
    private isCategoryMode = false;
    private locale: string;
    private page = 0;
    private lastOptions: VisualUpdateOptions | null = null;

    private layout: Settings = {};
    private interactions: Settings = {};
    private globals: Resolved = {};
    private compareItems: powerbi.IEnumMember[] = [];

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.locale = this.host.locale;
        this.formattingSettingsService = new FormattingSettingsService();
        this.selectionManager = this.host.createSelectionManager();
        this.selectionManager.registerOnSelectCallback(() => this.applySelectionStyles());

        this.root = document.createElement("div");
        this.root.className = "kmc-root";
        this.grid = document.createElement("div");
        this.grid.className = "kmc-grid";
        this.nav = document.createElement("div");
        this.nav.className = "kmc-nav";
        this.root.appendChild(this.grid);
        this.root.appendChild(this.nav);
        options.element.appendChild(this.root);

        // Empty space: left-click clears selection, right-click still offers drill-through.
        const isEmpty = (t: EventTarget | null) => t === this.root || t === this.grid;
        this.root.addEventListener("click", (e) => {
            if (isEmpty(e.target)) this.selectionManager.clear().then(() => this.applySelectionStyles());
        });
        this.root.addEventListener("contextmenu", (e) => {
            if (isEmpty(e.target)) {
                e.preventDefault();
                this.selectionManager.showContextMenu({}, { x: e.clientX, y: e.clientY });
            }
        });
    }

    public update(options: VisualUpdateOptions): void {
        this.host.eventService?.renderingStarted(options);
        try {
            this.lastOptions = options;
            const dataView: DataView | undefined = options.dataViews && options.dataViews[0];
            const metaBag: Bag = dataView?.metadata?.objects;
            this.layout = resolveObject(LAYOUT, [metaBag]);
            this.interactions = resolveObject(INTERACTIONS, [metaBag]);
            this.globals = resolveCard([metaBag]);
            this.cards = dataView ? this.parse(dataView, metaBag) : [];
            this.render();
            this.host.eventService?.renderingFinished(options);
        } catch (err) {
            this.host.eventService?.renderingFailed(options, String(err));
            throw err;
        }
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        const model = buildFormattingModel(
            this.layout,
            this.interactions,
            this.globals,
            this.cards.map(c => ({
                key: c.key,
                displayName: this.titleOf(c),
                selector: c.selector,
                ruleSelector: c.ruleSelector,
                settings: c.settings
            })),
            this.compareItems
        );
        return this.formattingSettingsService.buildFormattingModel(model);
    }

    /* ======================= Data parsing ======================= */

    private parse(dataView: DataView, metaBag: Bag): CardData[] {
        const cat = dataView.categorical;
        if (!cat || !cat.values) return [];
        const columns = cat.values as DataViewValueColumn[];

        const byRole = (role: string): DataViewValueColumn[] =>
            columns
                .filter(c => c.source.roles && c.source.roles[role])
                .sort((a, b) => this.roleIndex(a.source, role) - this.roleIndex(b.source, role));

        const values = byRole("values");
        const comparisons = byRole("comparison").slice(0, MAX_COMPARISONS);
        const subCols = byRole("subHeading");
        const labelCols = byRole("comparisonLabel");
        const asAtCol = byRole("asAtDate")[0];

        this.compareItems = [
            { value: "auto", displayName: "Auto (same position)" },
            { value: "none", displayName: "None" },
            ...comparisons.map((c, i) => ({ value: String(i + 1), displayName: c.source.displayName }))
        ];
        if (!values.length) return [];

        const compsFor = (row: number): CompareValue[] =>
            comparisons.map(c => ({ value: this.toNumber(c.values[row]), name: c.source.displayName, format: c.source.format }));

        const category = cat.categories && cat.categories[0];
        this.isCategoryMode = !!category;
        const result: CardData[] = [];

        if (category) {
            // One card per category value, using the first measure.
            const m = values[0];
            for (let i = 0; i < category.values.length; i++) {
                const catVal = category.values[i];
                const selId = this.host.createSelectionIdBuilder().withCategory(category, i).createSelectionId();
                const bags: Bag[] = [category.objects?.[i], m.objects?.[i], metaBag];
                result.push({
                    key: `c${i}_${String(catVal)}`,
                    defaultTitle: catVal === null || catVal === undefined ? "(Blank)" : valueFormatter.format(catVal, category.source.format, false, this.locale),
                    value: this.toNumber(m.values[i]),
                    format: m.source.format,
                    measureName: m.source.displayName,
                    comparisons: compsFor(i),
                    autoIndex: 0,
                    subHeading: this.toText(subCols[0]?.values[i]),
                    labelText: this.toText(labelCols[0]?.values[i]),
                    asAt: this.toDate(asAtCol?.values[i]),
                    selectionId: selId,
                    selector: selId.getSelector(),
                    ruleSelector: sel({ data: [WILDCARD] }),
                    settings: resolveCard(bags)
                });
            }
        } else {
            // One card per measure.
            values.forEach((m, idx) => {
                const bags: Bag[] = [m.objects?.[0], m.source.objects, metaBag];
                result.push({
                    key: `m${idx}`,
                    defaultTitle: m.source.displayName,
                    value: this.toNumber(m.values[0]),
                    format: m.source.format,
                    measureName: m.source.displayName,
                    comparisons: compsFor(0),
                    autoIndex: idx,
                    subHeading: this.toText(subCols[idx]?.values[0]),
                    labelText: this.toText((labelCols[idx] || (labelCols.length === 1 ? labelCols[0] : undefined))?.values[0]),
                    asAt: this.toDate(asAtCol?.values[0]),
                    selectionId: this.host.createSelectionIdBuilder().withMeasure(m.source.queryName).createSelectionId(),
                    selector: sel({ metadata: m.source.queryName }),
                    ruleSelector: sel({ data: [WILDCARD], metadata: m.source.queryName }),
                    settings: resolveCard(bags)
                });
            });
        }
        return result;
    }

    private roleIndex(col: DataViewMetadataColumn, role: string): number {
        const rolesIndex = (col as unknown as { rolesIndex?: Record<string, number[]> }).rolesIndex;
        const ri = rolesIndex && rolesIndex[role];
        return ri && ri.length ? ri[0] : (col.index ?? 0);
    }

    private toNumber(v: powerbi.PrimitiveValue): number | null {
        if (v === null || v === undefined || v === "") return null;
        const n = typeof v === "number" ? v : Number(v);
        return isFinite(n) ? n : null;
    }

    private toText(v: powerbi.PrimitiveValue): string | null {
        if (v === null || v === undefined) return null;
        const s = String(v).trim();
        return s.length ? s : null;
    }

    private toDate(v: powerbi.PrimitiveValue): Date | null {
        if (v === null || v === undefined || v === "") return null;
        if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
        if (typeof v === "number") {
            const d = v < 100000 ? new Date(Math.round((v - 25569) * 86400000)) : new Date(v);
            return isNaN(d.getTime()) ? null : d;
        }
        const d = new Date(String(v));
        return isNaN(d.getTime()) ? null : d;
    }

    private titleOf(card: CardData): string {
        const t = String(card.settings.title.text || "").trim();
        return t || card.defaultTitle;
    }

    /* ======================= Comparison logic ======================= */

    private pickComparison(card: CardData): ComparisonResult | null {
        if (card.value === null) return null;
        const s = card.settings.comparison;
        const choice = String(s.compareWith);
        let idx: number;
        if (choice === "none") return null;
        else if (choice === "auto") idx = card.autoIndex;
        else idx = Number(choice) - 1;

        const prior = card.comparisons[idx];
        if (!prior || prior.value === null) return null;

        const delta = card.value - prior.value;
        const pct = prior.value !== 0 ? delta / Math.abs(prior.value) : null;
        const state: ComparisonResult["state"] = Math.abs(delta) < 1e-12 ? "flat" : delta > 0 ? "up" : "down";
        const good: ComparisonResult["good"] = state === "flat" ? "flat" : ((state === "up") !== !!s.invert ? "good" : "bad");
        return { prior: prior as CompareValue & { value: number }, delta, pct, state, good };
    }

    /** Automatic label from the comparison measure's name when the Label setting is empty. */
    private autoLabel(name: string): string {
        const n = ` ${name.replace(/[_\-.]/g, " ")} `;
        if (/\s(PY|LY|SPLY|YOY)\s/i.test(n) || /year/i.test(n)) return "vs same period {year}";
        if (/\s(PM|LM|MOM)\s/i.test(n) || /month/i.test(n)) return "vs {month}";
        if (/\s(PW|LW|WOW)\s/i.test(n) || /week/i.test(n)) return "vs last week";
        if (/\s(PD|LD|DOD)\s/i.test(n) || /\bday\b|yesterday/i.test(n)) return "vs {date}";
        return "vs {name}";
    }

    private comparisonLabel(card: CardData, cmp: ComparisonResult, priorText: string): string {
        // Priority: Comparison label measure (dynamic, e.g. driven by a slicer) -> typed Label -> automatic.
        const custom = String(card.settings.comparison.label || "").trim();
        const template = card.labelText || custom || this.autoLabel(cmp.prior.name);
        const d = card.asAt;
        let year = "last year", month = "last month", date = "previous day", week = "last week";
        if (d) {
            year = String(d.getFullYear() - 1);
            const pm = new Date(d.getFullYear(), d.getMonth() - 1, 1);
            month = `${MONTHS[pm.getMonth()]} ${pm.getFullYear()}`;
            const pd = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
            date = `${pd.getDate()} ${MONTHS[pd.getMonth()]} ${pd.getFullYear()}`;
            const pw = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7);
            week = `${pw.getDate()} ${MONTHS[pw.getMonth()]} ${pw.getFullYear()}`;
        }
        return template
            .replace(/\{year\}/gi, year)
            .replace(/\{month\}/gi, month)
            .replace(/\{date\}/gi, date)
            .replace(/\{week\}/gi, week)
            .replace(/\{prior\}/gi, priorText)
            .replace(/\{name\}/gi, cmp.prior.name);
    }

    /* ======================= Formatting ======================= */

    private fmt(value: number, format: string, displayUnits: number, decimals: number): string {
        const units = Number(displayUnits) || 0;
        const f = valueFormatter.create({
            format: format,
            value: units === 0 ? Math.abs(value) : units,
            precision: decimals >= 0 ? decimals : undefined,
            cultureSelector: this.locale
        });
        return f.format(value);
    }

    private formatMain(card: CardData): string {
        const s = card.settings.value;
        if (card.value === null) return "(Blank)";
        return `${s.prefix || ""}${this.fmt(card.value, card.format, Number(s.displayUnits), Number(s.decimals))}${s.suffix || ""}`;
    }

    private formatDelta(card: CardData, cmp: ComparisonResult): { abs: string; pct: string; prior: string } {
        const s = card.settings.comparison;
        const units = Number(s.displayUnits);
        const dec = Number(s.decimals);
        const sign = cmp.state === "up" ? "+" : cmp.state === "down" ? "-" : "";
        const abs = `${sign}${this.fmt(Math.abs(cmp.delta), card.format, units, dec)}`;
        const pct = cmp.pct === null ? "n/a" : `${sign}${(Math.abs(cmp.pct) * 100).toFixed(Math.max(0, Number(s.percentDecimals)))}%`;
        const prior = this.fmt(cmp.prior.value, cmp.prior.format || card.format, units, dec);
        return { abs, pct, prior };
    }

    /* ======================= Rendering ======================= */

    private render(): void {
        this.grid.textContent = "";
        this.nav.textContent = "";
        this.cardEls = [];

        const L = this.layout;
        const hc = this.host.colorPalette.isHighContrast;
        const fg = hc ? this.host.colorPalette.foreground.value : null;

        // Outer container (Multi-card layout → Padding / Border / Background)
        const pad = Number(L.padding);
        const outerBorder = L.showBorder ? Math.max(0, Number(L.borderWidth)) : 0;
        this.root.style.padding = `${pad}px`;
        this.root.style.border = outerBorder ? `${outerBorder}px solid ${fg || L.borderColor}` : "none";
        this.root.style.borderRadius = `${Number(L.borderRadius)}px`;
        this.root.style.background = L.showBackground ? this.rgba(String(L.background), Number(L.bgTransparency)) : "transparent";

        if (!this.cards.length) {
            this.renderLanding();
            return;
        }
        this.root.classList.remove("kmc-landing-on");

        const vp = this.lastOptions?.viewport || { width: this.root.clientWidth, height: this.root.clientHeight };
        const innerW = Math.max(0, vp.width - 2 * pad - 2 * outerBorder);
        let innerH = Math.max(0, vp.height - 2 * pad - 2 * outerBorder);

        const n = this.cards.length;
        const gapH = Number(L.gapH), gapV = Number(L.gapV);
        const fixed = !!L.fixedSize;
        const vertical = L.arrangement === "vertical";
        const cw = Number(L.cardWidth), ch = Number(L.cardHeight);
        const setCount = Math.max(0, Math.round(Number(L.columns)));

        // Work out columns / rows.
        let cols: number, rows: number;
        if (!vertical) {
            if (setCount > 0) cols = setCount;
            else cols = Math.floor((innerW + gapH) / ((fixed ? cw : AUTO_MIN_WIDTH) + gapH));
            cols = Math.max(1, Math.min(cols, n));
            rows = Math.ceil(n / cols);
        } else {
            if (setCount > 0) rows = setCount;
            else rows = fixed ? Math.floor((innerH + gapV) / (ch + gapV)) : n;
            rows = Math.max(1, Math.min(rows, n));
            cols = Math.ceil(n / rows);
        }

        // Overflow: paginate
        const paginate = L.overflow === "paginate";
        let pageSize = n;
        if (paginate) {
            const lines = Math.max(1, Math.round(Number(L.linesPerPage)));
            pageSize = vertical ? rows * lines : cols * lines;
        }
        const pages = Math.max(1, Math.ceil(n / pageSize));
        if (this.page >= pages) this.page = pages - 1;
        this.visibleCards = paginate ? this.cards.slice(this.page * pageSize, (this.page + 1) * pageSize) : this.cards;
        if (paginate && pages > 1) {
            this.renderNav(pages);
            innerH = Math.max(0, innerH - 26);
        }
        if (vertical) cols = Math.ceil(this.visibleCards.length / rows);
        else rows = Math.ceil(this.visibleCards.length / cols);

        const fit = !fixed && !!L.fitToSpace;
        const g = this.grid.style;
        g.columnGap = `${gapH}px`;
        g.rowGap = `${gapV}px`;
        g.height = fit ? `${innerH}px` : "auto";
        g.gridAutoFlow = vertical ? "column" : "row";
        g.justifyContent = fixed ? "start" : "stretch";
        g.alignContent = fit ? "stretch" : "start";
        const colTrack = fixed ? `${cw}px` : "minmax(0, 1fr)";
        const rowTrack = fixed ? `${ch}px` : fit ? "minmax(min-content, 1fr)" : "auto";
        g.gridTemplateColumns = `repeat(${cols}, ${colTrack})`;
        g.gridTemplateRows = `repeat(${rows}, ${rowTrack})`;
        g.gridAutoRows = rowTrack;
        g.gridAutoColumns = colTrack;

        this.visibleCards.forEach(card => this.renderCard(card, fg));

        if (this.visibleCards.some(c => c.settings.value.autoFit)) this.fitValues();
        this.applySelectionStyles();
    }

    private renderCard(card: CardData, fg: string | null): void {
        const S = card.settings;
        const C = S.cards, T = S.title, V = S.value, X = S.comparison, H = S.subHeading;
        const hc = !!fg;

        const el = document.createElement("div");
        el.className = "kmc-card";
        if (this.interactions.hoverEffect) el.classList.add("kmc-hover");
        el.style.background = hc ? this.host.colorPalette.background.value : this.rgba(String(C.background), Number(C.transparency));
        el.style.borderRadius = `${Number(C.radius)}px`;
        el.style.border = C.showBorder || hc ? `${Math.max(1, Number(C.borderWidth))}px solid ${fg || C.borderColor}` : "none";
        el.style.boxShadow = C.shadow ? "0 2px 8px rgba(0,0,0,0.12)" : "none";
        el.style.padding = `${Number(C.padding)}px`;
        const align = String(C.alignment || "center");
        el.style.textAlign = align;
        el.style.alignItems = align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";
        el.tabIndex = 0;
        el.setAttribute("role", "button");
        el.setAttribute("aria-label", this.titleOf(card));

        const cmp = X.show ? this.pickComparison(card) : null;
        const colorFor = (c: ComparisonResult | null): string =>
            fg || String(X.overrideColor || "") || String(!c || c.good === "flat" ? X.flatColor : c.good === "good" ? X.upColor : X.downColor);

        if (C.accentBar) el.style.borderLeft = `5px solid ${colorFor(cmp)}`;

        if (T.show) el.appendChild(this.text("kmc-title", this.titleOf(card), T.font as FontValue, fg || String(T.color)));
        el.appendChild(this.text("kmc-value", this.formatMain(card), V.font as FontValue, fg || String(V.color)));

        let label = "", deltaText = "";
        if (cmp) {
            const d = this.formatDelta(card, cmp);
            const mode = String(X.display);
            deltaText = mode === "absolute" ? d.abs : mode === "percent" ? d.pct : `${d.abs} (${d.pct})`;
            label = this.comparisonLabel(card, cmp, d.prior);
            const arrow = X.showArrow ? (cmp.state === "up" ? "▲ " : cmp.state === "down" ? "▼ " : "► ") : "";

            const sub = document.createElement("div");
            sub.className = "kmc-sub";
            this.applyFont(sub, X.font as FontValue);
            const deltaSpan = document.createElement("span");
            deltaSpan.className = "kmc-delta";
            deltaSpan.textContent = `${arrow}${deltaText}`;
            deltaSpan.style.color = colorFor(cmp);
            sub.appendChild(deltaSpan);
            if (label) {
                const labelSpan = document.createElement("span");
                labelSpan.className = "kmc-label";
                labelSpan.textContent = ` ${label}`;
                labelSpan.style.color = fg || (X.colorLabel ? colorFor(cmp) : String(X.labelColor));
                sub.appendChild(labelSpan);
            }
            sub.title = "Right-click to drill through";
            this.bindSubValue(sub, card);
            el.appendChild(sub);
        }

        if (H.show) {
            const txt = card.subHeading ?? String(H.text || "");
            if (txt) el.appendChild(this.text("kmc-subheading", txt, H.font as FontValue, fg || String(H.color)));
        }

        this.bindCard(el, card, cmp, deltaText, label);
        this.grid.appendChild(el);
        this.cardEls.push(el);
    }

    private renderNav(pages: number): void {
        const mk = (txt: string, disabled: boolean, onClick: () => void, aria: string) => {
            const b = document.createElement("button");
            b.className = "kmc-nav-btn";
            b.textContent = txt;
            b.disabled = disabled;
            b.setAttribute("aria-label", aria);
            b.addEventListener("click", (e) => { e.stopPropagation(); onClick(); });
            return b;
        };
        const info = document.createElement("span");
        info.className = "kmc-nav-info";
        info.textContent = `${this.page + 1} / ${pages}`;
        this.nav.appendChild(mk("‹", this.page === 0, () => { this.page--; this.render(); }, "Previous page"));
        this.nav.appendChild(info);
        this.nav.appendChild(mk("›", this.page >= pages - 1, () => { this.page++; this.render(); }, "Next page"));
    }

    /** Shrinks each value's font until it fits its card width. */
    private fitValues(): void {
        this.cardEls.forEach((cardEl, i) => {
            const card = this.visibleCards[i];
            if (!card.settings.value.autoFit) return;
            const el = cardEl.querySelector<HTMLElement>(".kmc-value");
            if (!el) return;
            let size = (card.settings.value.font as FontValue).size;
            el.style.fontSize = `${size}pt`;
            while (el.scrollWidth > el.clientWidth + 1 && size > 8) {
                size -= 1;
                el.style.fontSize = `${size}pt`;
            }
        });
    }

    private text(cls: string, value: string, font: FontValue, color: string): HTMLElement {
        const d = document.createElement("div");
        d.className = cls;
        d.textContent = value;
        d.style.color = color;
        this.applyFont(d, font);
        return d;
    }

    private applyFont(el: HTMLElement, f: FontValue): void {
        el.style.fontFamily = f.family;
        el.style.fontSize = `${f.size}pt`;
        el.style.fontWeight = f.bold ? "700" : "400";
        el.style.fontStyle = f.italic ? "italic" : "normal";
        el.style.textDecoration = f.underline ? "underline" : "none";
    }

    private rgba(hex: string, transparency: number): string {
        const t = Math.min(100, Math.max(0, transparency || 0));
        const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
        if (!m) return hex;
        const n = parseInt(m[1], 16);
        return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${1 - t / 100})`;
    }

    /* ======================= Interactions & drill-through ======================= */

    private openMenu(card: CardData, e: MouseEvent): void {
        e.preventDefault();
        e.stopPropagation();
        // Drill-through is provided by Power BI's context menu. In category mode the card's category
        // value is passed to the target page; in measure mode the visual's filter context is passed.
        const id = this.isCategoryMode && card.selectionId ? card.selectionId : {};
        this.selectionManager.showContextMenu(id, { x: e.clientX, y: e.clientY });
    }

    private select(card: CardData, e: MouseEvent): void {
        e.stopPropagation();
        if (this.host.hostCapabilities && this.host.hostCapabilities.allowInteractions === false) return;
        if (!this.isCategoryMode || !card.selectionId) return;
        this.selectionManager.select(card.selectionId, e.ctrlKey || e.metaKey).then(() => this.applySelectionStyles());
    }

    private bindCard(el: HTMLElement, card: CardData, cmp: ComparisonResult | null, deltaText: string, label: string): void {
        const mode = String(this.interactions.cardClick);
        el.addEventListener("click", (e) => {
            if (mode === "menu") this.openMenu(card, e);
            else if (mode === "select") this.select(card, e);
            else e.stopPropagation();
        });
        el.addEventListener("contextmenu", (e) => this.openMenu(card, e));
        el.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                const r = el.getBoundingClientRect();
                const fake = new MouseEvent("click", { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, ctrlKey: e.ctrlKey });
                if (mode === "menu") this.openMenu(card, fake); else this.select(card, fake);
                e.preventDefault();
            }
        });

        if (this.interactions.showTooltip) {
            const items = (): VisualTooltipDataItem[] => {
                const list: VisualTooltipDataItem[] = [{ displayName: card.measureName, value: this.formatMain(card) }];
                if (this.isCategoryMode) list.unshift({ displayName: "Category", value: card.defaultTitle });
                if (cmp) {
                    list.push({ displayName: cmp.prior.name, value: this.fmt(cmp.prior.value, cmp.prior.format || card.format, 1, -1) });
                    list.push({ displayName: `Change ${label}`.trim(), value: deltaText });
                }
                if (card.asAt) list.push({ displayName: "As at", value: card.asAt.toLocaleDateString(this.locale) });
                return list;
            };
            const ids = card.selectionId && this.isCategoryMode ? [card.selectionId] : [];
            el.addEventListener("mousemove", (e) => {
                this.host.tooltipService.show({ coordinates: [e.clientX, e.clientY], isTouchEvent: false, dataItems: items(), identities: ids });
            });
            el.addEventListener("mouseleave", () => this.host.tooltipService.hide({ immediately: true, isTouchEvent: false }));
        }
    }

    private bindSubValue(sub: HTMLElement, card: CardData): void {
        const mode = String(this.interactions.subValueClick);
        if (mode === "none") return; // falls through to the card handler
        sub.classList.add("kmc-clickable");
        sub.addEventListener("click", (e) => {
            if (mode === "menu") this.openMenu(card, e);
            else this.select(card, e);
        });
        sub.addEventListener("contextmenu", (e) => this.openMenu(card, e));
    }

    private applySelectionStyles(): void {
        if (!this.isCategoryMode) {
            this.cardEls.forEach(el => el.classList.remove("kmc-dim"));
            return;
        }
        const selected = this.selectionManager.getSelectionIds() as ISelectionId[];
        const has = selected.length > 0;
        this.cardEls.forEach((el, i) => {
            const id = this.visibleCards[i]?.selectionId;
            const isSel = !!id && selected.some(s => s.equals(id));
            el.classList.toggle("kmc-dim", has && !isSel);
            el.setAttribute("aria-selected", String(isSel));
        });
    }

    private renderLanding(): void {
        this.root.classList.add("kmc-landing-on");
        const g = this.grid.style;
        g.gridTemplateColumns = "1fr";
        g.gridTemplateRows = "1fr";
        g.height = "100%";
        const d = document.createElement("div");
        d.className = "kmc-landing";
        const h = document.createElement("div");
        h.className = "kmc-landing-title";
        h.textContent = "angcx_ Multicard Plugin";
        const p = document.createElement("div");
        p.textContent = "Add one or more measures to Values. Optionally add Comparison measures (prior year, month, day or target), a Category, a Sub heading text measure and an As-at date.";
        d.appendChild(h);
        d.appendChild(p);
        this.grid.appendChild(d);
    }
}
