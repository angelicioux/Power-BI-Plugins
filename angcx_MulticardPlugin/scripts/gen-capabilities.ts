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

// Regenerates the "objects" and "dataRoles" sections of capabilities.json from src/settings.ts.
// Run: npx esbuild scripts/gen-capabilities.ts --bundle --platform=node --outfile=.tmp/gen.js --alias:powerbi-visuals-api=./scripts/api-stub.js && node .tmp/gen.js
import * as fs from "fs";
import { CARD_OBJECTS, LAYOUT, INTERACTIONS, MAX_COMPARISONS, ObjectDef, PropDef } from "../src/settings";

const fill = { fill: { solid: { color: true } } };
function types(p: PropDef): Record<string, unknown> {
    switch (p.kind) {
        case "bool": return { [p.name]: { type: { bool: true } } };
        case "num": return { [p.name]: { type: { numeric: true } } };
        case "text": return { [p.name]: { type: { text: true } } };
        case "color": return { [p.name]: { type: fill } };
        case "units": return { [p.name]: { type: { formatting: { labelDisplayUnits: true } } } };
        case "align": return { [p.name]: { type: { formatting: { alignment: true } } } };
        case "font": return {
            fontFamily: { type: { formatting: { fontFamily: true } } },
            fontSize: { type: { formatting: { fontSize: true } } },
            bold: { type: { bool: true } }, italic: { type: { bool: true } }, underline: { type: { bool: true } }
        };
        case "enum": {
            let items = p.items || [];
            if (p.name === "compareWith") {
                items = [{ value: "auto", displayName: "Auto" }, { value: "none", displayName: "None" }];
                for (let i = 1; i <= MAX_COMPARISONS; i++) items.push({ value: String(i), displayName: `Comparison ${i}` });
            }
            return { [p.name]: { type: { enumeration: items } } };
        }
    }
}
const objects: Record<string, unknown> = {};
const add = (o: ObjectDef) => { const props = {}; o.props.forEach(p => Object.assign(props, types(p))); objects[o.name] = { properties: props }; };
[LAYOUT, ...CARD_OBJECTS, INTERACTIONS].forEach(add);

const capPath = "capabilities.json";
const cap = JSON.parse(fs.readFileSync(capPath, "utf8"));
cap.objects = objects;
cap.dataRoles = [
    { displayName: "Values", name: "values", kind: "Measure", description: "One card per measure. Rename the field in this visual (or use Title text) to change the card title." },
    { displayName: "Comparison values", name: "comparison", kind: "Measure", description: "Prior year / month / day, target, budget… Each card compares with the measure in the same position by default; choose another per card in Format → Sub value → Compare with." },
    { displayName: "Category (one card per item)", name: "category", kind: "Grouping", description: "Optional, e.g. Region – one card per value using the first measure in Values." },
    { displayName: "Comparison label (text measure)", name: "comparisonLabel", kind: "Measure", description: "Optional text measure for the sub value label, e.g. driven by a 'Compare to' slicer. Tokens like {year} also work." },
    { displayName: "Sub heading (text measure)", name: "subHeading", kind: "Measure", description: "Optional text measure shown under the comparison." },
    { displayName: "As-at date", name: "asAtDate", kind: "Measure", description: "Optional, e.g. MAX('Date'[Date]). Fills {year}, {month}, {date} in labels." }
];
cap.dataViewMappings = [{
    conditions: [{ category: { max: 1 }, asAtDate: { max: 1 }, comparison: { max: MAX_COMPARISONS } }],
    categorical: {
        categories: { for: { in: "category" }, dataReductionAlgorithm: { top: { count: 100 } } },
        values: { select: ["values", "comparison", "comparisonLabel", "subHeading", "asAtDate"].map(r => ({ bind: { to: r } })) }
    }
}];
fs.writeFileSync(capPath, JSON.stringify(cap, null, 4) + "\n");
console.log("capabilities.json updated:", Object.keys(objects).join(", "));
