# angcx_ Multicard Plugin – Power BI custom visual

[← All card plugins](../README.md) · [← Power BI Plugins home](https://github.com/angelicioux/Power-BI-Plugins)

*Created by angcx\_*

A card visual that shows **Title → Value → Sub value (comparison) → Sub heading**. It shows many cards at once, has a format pane laid out like the native Power BI card (**Apply settings to: All / each card**), and supports drill-through from both the card and the sub value.

## Install
Power BI Desktop → Visualizations pane → **…** → **Import a visual from a file** → pick `angcx_MulticardPlugin.pbiviz`.

## Field wells

| Well | What to put in it |
|---|---|
| **Values** | One or more measures. Each one becomes a card. |
| **Comparison values** | Prior year, month or day, target, budget… any measures to compare against. |
| **Category (one card per item)** | Optional, e.g. Region. Gives one card per value, using the first measure in Values. |
| **Comparison label (text measure)** | Optional. A dynamic label for the sub value, e.g. driven by a "Compare to" slicer. Takes priority over the Label setting. |
| **Sub heading (text measure)** | Optional text measure. |
| **As-at date** | Optional, e.g. `MAX('Date'[Date])`. Fills `{year}`, `{month}` and `{date}` in the labels. |

**Which comparison does each card use?** By default, each card uses the comparison measure in the same position: the 1st Value uses the 1st Comparison, the 2nd uses the 2nd, and so on. To change it, go to **Format → Sub value → Apply settings to → (the card) → Compare with**, which lists every measure in the Comparison values well by name.

## Format pane

**Multi-card layout** (applies to the whole visual)
- *Layout:* Arrangement (Horizontal / Vertical), Fixed size (card width and height), Columns or Rows (0 = auto), Fit to space.
- *Padding*, *Gap* (horizontal and vertical), *Border*, *Background*.
- *Overflow:* Continuous scroll, or Paginate with ‹ › buttons and a set number of rows per page.

**Cards, Title, Value, Sub value, Sub heading.** Each section starts with **Apply settings to**:
- **All** sets the default for every card.
- **A card's name** overrides the setting for that card only. Anything you leave alone follows All.

| Section | Settings |
|---|---|
| Cards | Background, transparency, border (color, width), rounded corners, shadow, accent bar, inner padding, alignment |
| Title | Show, Title text (override), font, color |
| Value | Font, color, display units, decimals, prefix, suffix, shrink to fit |
| Sub value | Show, **Compare with**, Label, Show as (Change and % / Change / %), arrow, **Lower is better**, favourable / unfavourable / no change colors, **Color override (fx)**, label color, font, units, decimals |
| Sub heading | Show, text, font, color |

**Automatic labels:** if Label is left empty, the visual picks the label from the comparison measure's name:
- names ending in PY / LY, or containing "year": `vs same period {year}`
- names ending in PM, or containing "month": `vs {month}`
- names ending in PD, or containing "day": `vs {date}`
- anything else: `vs {name}`

Tokens you can use in your own labels: `{year}` `{month}` `{date}` `{prior}` (the comparison value) `{name}` (the comparison measure name).

**Conditional formatting (fx):** when a card is selected in Apply settings to, the Background, Border, Title, Value and Sub heading colours, and the sub value **Color override**, have the **fx** button. Choose Rules, Gradient or Field value (a DAX measure returning a hex colour):
```DAX
Sub Value Colour =
VAR pct = DIVIDE([LC Active Customers] - [LC Active Customers PY], [LC Active Customers PY])
RETURN SWITCH(TRUE(), pct >= 0, "#2E9B4F", pct > -0.05, "#E8A317", "#D13438")
```

**Interactions & drill-through:** what a left-click on the card does (cross-filter, open the drill-through menu, or nothing), what a left-click on the sub value does, hover highlight, and tooltips.

## Drill-through
1. On the target page, add the field to the **Drill through** well (e.g. Region or Date).
2. Right-click a card **or its sub value** → **Drill through** → choose the page. By default, a left-click on the sub value opens the same menu.
   - *Category mode:* the card's category value (e.g. Region = South) is passed, along with the slicer and filter context.
   - *Measure mode:* the visual's filter context (slicers and page filters) is passed.

## Example DAX (snapshot measures)
```DAX
LC As At Date = MIN ( MAX ( 'Lifecycle Dates'[Date] ), [LC Last Data Date] )
-- PY: same as LC Active Customers but with
-- VAR AsAt = IF ( CurAsAt = EOMONTH ( CurAsAt, 0 ), EOMONTH ( CurAsAt, -12 ), EDATE ( CurAsAt, -12 ) )
```

## Dynamic "Compare to" dropdown (last week / last month / last year)

1. **Modeling → New table** (don't relate it to any other table):
```DAX
Comparison Period =
DATATABLE ( "Period", STRING, "Order", INTEGER,
    { { "Last week", 1 }, { "Last month", 2 }, { "Last year", 3 } } )
```
   Sort `Period` by `Order` (Column tools → Sort by column).
2. One comparison measure that follows the dropdown:
```DAX
LC Active Customers Compare =
VAR CurAsAt = [LC As At Date]
VAR Period  = SELECTEDVALUE ( 'Comparison Period'[Period], "Last year" )
VAR AsAt =
    SWITCH ( Period,
        "Last week",  CurAsAt - 7,
        "Last month", IF ( CurAsAt = EOMONTH ( CurAsAt, 0 ), EOMONTH ( CurAsAt, -1 ), EDATE ( CurAsAt, -1 ) ),
        IF ( CurAsAt = EOMONTH ( CurAsAt, 0 ), EOMONTH ( CurAsAt, -12 ), EDATE ( CurAsAt, -12 ) ) )
RETURN
IF ( MIN ( 'Lifecycle Dates'[Date] ) <= [LC Last Data Date],
    CALCULATE ( COUNTROWS ( dim_Customer_Lifecycle ),
        dim_Customer_Lifecycle[IsEpisodeStart] = 1,
        dim_Customer_Lifecycle[EpisodeStartDate] <= AsAt,
        FILTER ( ALL ( dim_Customer_Lifecycle[EpisodeEndDate] ),
            ISBLANK ( dim_Customer_Lifecycle[EpisodeEndDate] ) || dim_Customer_Lifecycle[EpisodeEndDate] > AsAt ),
        REMOVEFILTERS ( 'Lifecycle Dates' ) ) )
```
3. The label measure:
```DAX
LC Compare Label =
VAR CurAsAt = [LC As At Date]
RETURN
SWITCH ( SELECTEDVALUE ( 'Comparison Period'[Period], "Last year" ),
    "Last week",  "vs last week (" & FORMAT ( CurAsAt - 7, "d mmm yyyy" ) & ")",
    "Last month", "vs " & FORMAT ( EDATE ( CurAsAt, -1 ), "mmm yyyy" ),
    "vs same period " & ( YEAR ( CurAsAt ) - 1 ) )
```
4. In the visual: put `LC Active Customers Compare` in **Comparison values** and `LC Compare Label` in **Comparison label**.
5. Add a **Slicer** with `'Comparison Period'[Period]`. In Format → Slicer settings, set Style = **Dropdown** and turn on **Single select**.

## Date dropdown
- **Single as-at date:** add a slicer with `'Lifecycle Dates'[Date]`. In Format → Slicer settings → Options, change Style from *Between* to **Dropdown**, and turn on Single select. Because your measures use `MAX` of the selected dates, the chosen date becomes the as-at date.
- **Year / Month dropdown:** add Year and Month (or a "Mon YYYY" column sorted by a YearMonth number) to a slicer and set Style = **Dropdown**. The as-at date becomes the last day of the selection, capped at `[LC Last Data Date]`.
- **Default to the latest date:** add a column `IsLatest = IF('Lifecycle Dates'[Date] = CALCULATE([LC Last Data Date], REMOVEFILTERS('Lifecycle Dates')), "Latest", FORMAT('Lifecycle Dates'[Date], "d mmm yyyy"))` and use it in the slicer with "Latest" selected. When the data refreshes, "Latest" moves to the new date.

## Rebuild from source
```bash
npm install -g powerbi-visuals-tools
git clone -b Card https://github.com/angelicioux/Power-BI-Plugins.git
cd Power-BI-Plugins/angcx_MulticardPlugin
npm install
pbiviz package        # creates dist/*.pbiviz
```
Format options are defined once in `src/settings.ts`. After changing them, regenerate `capabilities.json`:
```bash
npx esbuild scripts/gen-capabilities.ts --bundle --platform=node --outfile=.tmp/gen.js --alias:powerbi-visuals-api=./scripts/api-stub.js && node .tmp/gen.js
```
