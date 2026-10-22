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

/*
 * Formatting settings for angcx_ Multicard Plugin.
 *
 * Every "per-card" section (Cards, Title, Value, Sub value, Sub heading) is defined once as a
 * property schema. The format pane shows an "Apply settings to" dropdown (All + every card),
 * like the native Power BI card visual. Values resolve as: this card -> All -> default.
 */

import powerbi from "powerbi-visuals-api";
import { formattingSettings as fs } from "powerbi-visuals-utils-formattingmodel";

export type Kind = "bool" | "num" | "text" | "color" | "enum" | "units" | "font" | "align";

export interface FontValue { family: string; size: number; bold: boolean; italic: boolean; underline: boolean; }

export interface PropDef {
    name: string;
    displayName: string;
    kind: Kind;
    def: unknown;
    items?: powerbi.IEnumMember[];
    placeholder?: string;
    min?: number;
    max?: number;
    fx?: boolean;            // colour supports conditional formatting (fx)
    perCardOnly?: boolean;   // hidden in the "All" item
    description?: string;
}

export interface ObjectDef { name: string; displayName: string; description?: string; props: PropDef[]; }

const SEGOE = "'Segoe UI', wf_segoe-ui_normal, helvetica, arial, sans-serif";
const DIN = "DIN, 'Segoe UI', wf_segoe-ui_normal, helvetica, arial, sans-serif";
const font = (family: string, size: number, bold = false): FontValue => ({ family, size, bold, italic: false, underline: false });

export const MAX_COMPARISONS = 20;

/* ---------------------------------------------------------------------------------------------
 * Per-card sections
 * ------------------------------------------------------------------------------------------- */
export const CARD_OBJECTS: ObjectDef[] = [
    {
        name: "cards", displayName: "Cards",
        props: [
            { name: "background", displayName: "Background", kind: "color", def: "#FFFFFF", fx: true },
            { name: "transparency", displayName: "Transparency %", kind: "num", def: 0, min: 0, max: 100 },
            { name: "showBorder", displayName: "Border", kind: "bool", def: true },
            { name: "borderColor", displayName: "Border color", kind: "color", def: "#E1E1E1", fx: true },
            { name: "borderWidth", displayName: "Border width", kind: "num", def: 1, min: 0, max: 20 },
            { name: "radius", displayName: "Rounded corners", kind: "num", def: 14, min: 0, max: 60 },
            { name: "shadow", displayName: "Shadow", kind: "bool", def: false },
            { name: "accentBar", displayName: "Accent bar (follows sub value color)", kind: "bool", def: false },
            { name: "padding", displayName: "Inner padding", kind: "num", def: 12, min: 0, max: 60 },
            { name: "alignment", displayName: "Alignment", kind: "align", def: "center" }
        ]
    },
    {
        name: "title", displayName: "Title",
        props: [
            { name: "show", displayName: "Show", kind: "bool", def: true },
            { name: "text", displayName: "Title text", kind: "text", def: "", placeholder: "Field name", description: "Leave empty to use the field / category name." },
            { name: "font", displayName: "Font", kind: "font", def: font(SEGOE, 12) },
            { name: "color", displayName: "Color", kind: "color", def: "#4A4A4A", fx: true }
        ]
    },
    {
        name: "value", displayName: "Value",
        props: [
            { name: "font", displayName: "Font", kind: "font", def: font(DIN, 26, true) },
            { name: "color", displayName: "Color", kind: "color", def: "#2B3A4A", fx: true },
            { name: "displayUnits", displayName: "Display units", kind: "units", def: 1 },
            { name: "decimals", displayName: "Decimal places (-1 = model format)", kind: "num", def: -1, min: -1, max: 10 },
            { name: "prefix", displayName: "Prefix", kind: "text", def: "", placeholder: "e.g. $" },
            { name: "suffix", displayName: "Suffix", kind: "text", def: "", placeholder: "e.g. pts" },
            { name: "autoFit", displayName: "Shrink to fit", kind: "bool", def: true }
        ]
    },
    {
        name: "comparison", displayName: "Sub value (comparison)",
        description: "Label tokens: {year} {month} {date} {prior} {name}",
        props: [
            { name: "show", displayName: "Show", kind: "bool", def: true },
            { name: "compareWith", displayName: "Compare with", kind: "enum", def: "auto", items: [] }, // items filled at runtime
            { name: "label", displayName: "Label", kind: "text", def: "", placeholder: "Auto, e.g. vs same period {year}", description: "Leave empty for an automatic label based on the comparison measure name (PY / PM / PD). Tokens: {year} {month} {week} {date} {prior} {name}. A 'Comparison label' measure takes priority over this." },
            {
                name: "display", displayName: "Show as", kind: "enum", def: "both", items: [
                    { value: "both", displayName: "Change and %" },
                    { value: "absolute", displayName: "Change only" },
                    { value: "percent", displayName: "% only" }
                ]
            },
            { name: "showArrow", displayName: "Arrow ▲▼", kind: "bool", def: false },
            { name: "invert", displayName: "Lower is better", kind: "bool", def: false },
            { name: "upColor", displayName: "Favourable color", kind: "color", def: "#2E9B4F" },
            { name: "downColor", displayName: "Unfavourable color", kind: "color", def: "#D13438" },
            { name: "flatColor", displayName: "No change color", kind: "color", def: "#7A7A7A" },
            { name: "overrideColor", displayName: "Color override (use fx)", kind: "color", def: "", fx: true, perCardOnly: true, description: "Replaces the favourable / unfavourable logic for this card. Use fx for rules or a DAX colour measure." },
            { name: "colorLabel", displayName: "Color the label text too", kind: "bool", def: true },
            { name: "labelColor", displayName: "Label color", kind: "color", def: "#7A7A7A" },
            { name: "font", displayName: "Font", kind: "font", def: font(SEGOE, 10) },
            { name: "displayUnits", displayName: "Display units", kind: "units", def: 1 },
            { name: "decimals", displayName: "Decimals – change (-1 = model)", kind: "num", def: -1, min: -1, max: 10 },
            { name: "percentDecimals", displayName: "Decimals – %", kind: "num", def: 1, min: 0, max: 10 }
        ]
    },
    {
        name: "subHeading", displayName: "Sub heading",
        props: [
            { name: "show", displayName: "Show", kind: "bool", def: true },
            { name: "text", displayName: "Text", kind: "text", def: "", placeholder: "e.g. Open account on the as-at date", description: "Used when no Sub heading measure is supplied." },
            { name: "font", displayName: "Font", kind: "font", def: font(SEGOE, 10) },
            { name: "color", displayName: "Color", kind: "color", def: "#333333", fx: true }
        ]
    }
];

/* ---------------------------------------------------------------------------------------------
 * Global sections
 * ------------------------------------------------------------------------------------------- */
export const LAYOUT: ObjectDef = {
    name: "layout", displayName: "Multi-card layout",
    props: [
        { name: "arrangement", displayName: "Arrangement", kind: "enum", def: "horizontal", items: [{ value: "horizontal", displayName: "Horizontal" }, { value: "vertical", displayName: "Vertical" }] },
        { name: "fixedSize", displayName: "Fixed size", kind: "bool", def: false },
        { name: "cardWidth", displayName: "Card width", kind: "num", def: 220, min: 40, max: 2000 },
        { name: "cardHeight", displayName: "Card height", kind: "num", def: 130, min: 30, max: 2000 },
        { name: "columns", displayName: "Columns", kind: "num", def: 0, min: 0, max: 50, description: "0 = automatic" },
        { name: "fitToSpace", displayName: "Fit to space", kind: "bool", def: true },
        { name: "padding", displayName: "Padding", kind: "num", def: 4, min: 0, max: 100 },
        { name: "gapH", displayName: "Horizontal gap", kind: "num", def: 10, min: 0, max: 100 },
        { name: "gapV", displayName: "Vertical gap", kind: "num", def: 10, min: 0, max: 100 },
        { name: "showBorder", displayName: "Border", kind: "bool", def: false },
        { name: "borderColor", displayName: "Color", kind: "color", def: "#C8C6C4" },
        { name: "borderWidth", displayName: "Width", kind: "num", def: 1, min: 0, max: 20 },
        { name: "borderRadius", displayName: "Rounded corners", kind: "num", def: 0, min: 0, max: 60 },
        { name: "showBackground", displayName: "Background", kind: "bool", def: false },
        { name: "background", displayName: "Color", kind: "color", def: "#F3F2F1" },
        { name: "bgTransparency", displayName: "Transparency %", kind: "num", def: 0, min: 0, max: 100 },
        { name: "overflow", displayName: "Overflow style", kind: "enum", def: "scroll", items: [{ value: "scroll", displayName: "Continuous scroll" }, { value: "paginate", displayName: "Paginate" }] },
        { name: "linesPerPage", displayName: "Rows per page", kind: "num", def: 1, min: 1, max: 50 }
    ]
};

export const INTERACTIONS: ObjectDef = {
    name: "interactions", displayName: "Interactions & drill-through",
    description: "Right-click any card or sub value to drill through. Set the Drill-through fields on the target page.",
    props: [
        {
            name: "cardClick", displayName: "Left-click on card", kind: "enum", def: "select", items: [
                { value: "select", displayName: "Cross-filter (select)" },
                { value: "menu", displayName: "Open drill-through menu" },
                { value: "none", displayName: "Nothing" }
            ]
        },
        {
            name: "subValueClick", displayName: "Left-click on sub value", kind: "enum", def: "menu", items: [
                { value: "menu", displayName: "Open drill-through menu" },
                { value: "select", displayName: "Cross-filter (select)" },
                { value: "none", displayName: "Same as card" }
            ]
        },
        { name: "hoverEffect", displayName: "Hover highlight", kind: "bool", def: true },
        { name: "showTooltip", displayName: "Tooltips", kind: "bool", def: true }
    ]
};

/* ---------------------------------------------------------------------------------------------
 * Reading values
 * ------------------------------------------------------------------------------------------- */
export type Bag = powerbi.DataViewObjects | undefined;
export type Resolved = Record<string, Record<string, unknown>>;

const FONT_PARTS: (keyof FontValue)[] = ["family", "size", "bold", "italic", "underline"];
const FONT_PROP: Record<keyof FontValue, string> = { family: "fontFamily", size: "fontSize", bold: "bold", italic: "italic", underline: "underline" };

function raw(bag: Bag, obj: string, prop: string): unknown {
    const o = bag && bag[obj];
    return o ? o[prop] : undefined;
}

function decode(kind: Kind, v: unknown): unknown {
    if (v === undefined || v === null) return undefined;
    if (kind === "color") {
        const c = (v as powerbi.Fill)?.solid?.color;
        return c ? c : undefined;
    }
    return v;
}

/** Resolve one property against an ordered list of object bags (most specific first). */
export function readProp(obj: string, def: PropDef, bags: Bag[]): unknown {
    if (def.kind === "font") {
        const d = def.def as FontValue;
        const out = { ...d };
        for (const part of FONT_PARTS) {
            for (const bag of bags) {
                const v = raw(bag, obj, FONT_PROP[part]);
                if (v !== undefined && v !== null) { (out as Record<string, unknown>)[part] = v; break; }
            }
        }
        return out;
    }
    for (const bag of bags) {
        const v = decode(def.kind, raw(bag, obj, def.name));
        if (v !== undefined) return v;
    }
    return def.def;
}

export function resolveObject(objDef: ObjectDef, bags: Bag[]): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const p of objDef.props) out[p.name] = readProp(objDef.name, p, bags);
    return out;
}

export function resolveCard(bags: Bag[]): Resolved {
    const out: Resolved = {};
    for (const o of CARD_OBJECTS) out[o.name] = resolveObject(o, bags);
    return out;
}

/* ---------------------------------------------------------------------------------------------
 * Building the format pane
 * ------------------------------------------------------------------------------------------- */
export interface CardTarget {
    key: string;                    // unique, stable
    displayName: string;
    selector: powerbi.data.Selector;       // constant values for this card
    ruleSelector: powerbi.data.Selector;   // fx rules for this card
    settings: Resolved;                    // effective values for this card
}

interface SliceCtx { selector?: powerbi.data.Selector; ruleSelector?: powerbi.data.Selector; }

function numOptions(p: PropDef): powerbi.visuals.NumUpDownFormat | undefined {
    if (p.min === undefined && p.max === undefined) return undefined;
    const o: powerbi.visuals.NumUpDownFormat = {};
    if (p.min !== undefined) o.minValue = { type: 0 as powerbi.visuals.ValidatorType.Min, value: p.min };
    if (p.max !== undefined) o.maxValue = { type: 1 as powerbi.visuals.ValidatorType.Max, value: p.max };
    return o;
}

function makeSlice(p: PropDef, value: unknown, ctx: SliceCtx, items?: powerbi.IEnumMember[]): fs.Slice {
    const base = { name: p.name, displayName: p.displayName, description: p.description, selector: ctx.selector };
    switch (p.kind) {
        case "bool":
            return new fs.ToggleSwitch({ ...base, value: !!value });
        case "num":
            return new fs.NumUpDown({ ...base, value: Number(value), options: numOptions(p) });
        case "text":
            return new fs.TextInput({ ...base, value: String(value ?? ""), placeholder: p.placeholder || "" });
        case "units":
            return new fs.AutoDropdown({ ...base, value: value as number });
        case "align":
            return new fs.AlignmentGroup({ ...base, value: String(value), mode: "horizontalAlignment" as powerbi.visuals.AlignmentGroupMode.Horizonal });
        case "enum": {
            const list = items || p.items || [];
            const cur = list.find(i => i.value === value) || list[0];
            return new fs.ItemDropdown({ ...base, items: list, value: cur });
        }
        case "color": {
            const s = new fs.ColorPicker({ ...base, value: { value: String(value ?? "") } });
            if (p.fx && ctx.ruleSelector) {
                s.selector = ctx.ruleSelector;
                s.altConstantSelector = ctx.selector;
                s.instanceKind = 3 as powerbi.VisualEnumerationInstanceKinds.ConstantOrRule;
            }
            return s;
        }
        case "font": {
            const f = value as FontValue;
            return new fs.FontControl({
                name: "font", displayName: p.displayName,
                fontFamily: new fs.FontPicker({ name: "fontFamily", value: f.family, selector: ctx.selector }),
                fontSize: new fs.NumUpDown({ name: "fontSize", value: f.size, selector: ctx.selector }),
                bold: new fs.ToggleSwitch({ name: "bold", value: f.bold, selector: ctx.selector }),
                italic: new fs.ToggleSwitch({ name: "italic", value: f.italic, selector: ctx.selector }),
                underline: new fs.ToggleSwitch({ name: "underline", value: f.underline, selector: ctx.selector })
            });
        }
    }
}

class PerCardSection extends fs.SimpleCard {
    constructor(objDef: ObjectDef, globals: Record<string, unknown>, targets: CardTarget[], dynamicItems: Record<string, powerbi.IEnumMember[]>) {
        super();
        this.name = objDef.name;
        this.displayName = objDef.displayName;
        this.description = objDef.description;
        this.slices = [];
        const itemSlices = (values: Record<string, unknown>, ctx: SliceCtx, isAll: boolean): fs.Slice[] =>
            objDef.props
                .filter(p => !(isAll && p.perCardOnly))
                .map(p => makeSlice(p, values[p.name], ctx, dynamicItems[p.name]));

        this.container = new fs.Container({
            displayName: "Apply settings to",
            containerItems: [
                { displayName: "All", displayNameKey: "__all__", slices: itemSlices(globals, {}, true) },
                ...targets.map(t => ({
                    displayName: t.displayName,
                    displayNameKey: `__card_${t.key}`,
                    slices: itemSlices(t.settings[objDef.name], { selector: t.selector, ruleSelector: t.ruleSelector }, false)
                }))
            ]
        } as fs.Container);
    }
}

class LayoutSection extends fs.CompositeCard {
    name = LAYOUT.name;
    displayName = LAYOUT.displayName;
    groups: fs.Group[];

    constructor(v: Record<string, unknown>) {
        super();
        const s = (n: string, displayName?: string): fs.Slice => {
            const p = LAYOUT.props.find(x => x.name === n);
            const slice = makeSlice(displayName ? { ...p, displayName } : p, v[n], {});
            return slice;
        };
        const fixed = !!v.fixedSize;
        const vertical = v.arrangement === "vertical";
        const paginate = v.overflow === "paginate";

        const layoutSlices = [s("arrangement"), s("fixedSize")];
        if (fixed) layoutSlices.push(s("cardWidth"), s("cardHeight"));
        layoutSlices.push(s("columns", vertical ? "Rows (0 = auto)" : "Columns (0 = auto)"));
        if (!fixed) layoutSlices.push(s("fitToSpace"));

        const border = new fs.Group({ name: "border", displayName: "Border", slices: [s("borderColor"), s("borderWidth"), s("borderRadius")] } as fs.Group);
        border.topLevelSlice = s("showBorder") as fs.SimpleSlice;
        const bg = new fs.Group({ name: "background", displayName: "Background", slices: [s("background"), s("bgTransparency")] } as fs.Group);
        bg.topLevelSlice = s("showBackground") as fs.SimpleSlice;

        this.groups = [
            new fs.Group({ name: "layoutGroup", displayName: "Layout", slices: layoutSlices } as fs.Group),
            new fs.Group({ name: "padding", displayName: "Padding", slices: [s("padding")] } as fs.Group),
            new fs.Group({ name: "gap", displayName: "Gap", slices: [s("gapH"), s("gapV")] } as fs.Group),
            border,
            bg,
            new fs.Group({ name: "overflow", displayName: "Overflow", slices: paginate ? [s("overflow"), s("linesPerPage", vertical ? "Columns per page" : "Rows per page")] : [s("overflow")] } as fs.Group)
        ];
    }
}

class SimpleSection extends fs.SimpleCard {
    constructor(objDef: ObjectDef, v: Record<string, unknown>) {
        super();
        this.name = objDef.name;
        this.displayName = objDef.displayName;
        this.description = objDef.description;
        this.slices = objDef.props.map(p => makeSlice(p, v[p.name], {}));
    }
}

export function buildFormattingModel(
    layout: Record<string, unknown>,
    interactions: Record<string, unknown>,
    globals: Resolved,
    targets: CardTarget[],
    compareItems: powerbi.IEnumMember[]
): fs.Model {
    const model = new fs.Model();
    model.cards = [
        new LayoutSection(layout),
        ...CARD_OBJECTS.map(o => new PerCardSection(o, globals[o.name], targets, { compareWith: compareItems })),
        new SimpleSection(INTERACTIONS, interactions)
    ];
    return model;
}
