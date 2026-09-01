# SIP-212 Browser-Print PDF — Demo Notes

This file documents the feature-flag setup, demo script, and known limitations for
the SIP-212 browser-print PDF proof-of-concept (Phases A–C).

---

## What Was Implemented

This branch implements Phases A–C of the SIP-212 hybrid approach:

**Phase A — Print-Ready Rendering Mode (Frontend)**
- New `?print=1` URL parameter registered in `URL_PARAMS` (`src/constants.ts`)
- `DashboardBuilder` adds `body.print-mode` class + injects print CSS when `?print=1`
- `Row.tsx` initializes `isInView=true` and skips `IntersectionObserver` in print mode,
  forcing all charts to render regardless of scroll position
- New `src/dashboard/styles/printMode.ts` with scoped CSS for single-column layout,
  hidden interactive chrome, and expanded table overflow

**Phase B — Readiness Signal (Backend)**
- New `PRINT_ALL_CHART_HOLDERS_READY_JS` predicate in `superset/utils/screenshot_utils.py`
  — identical to `REPORT_CHART_HOLDERS_READY_JS` but without the `getBoundingClientRect()`
  viewport filter, so ALL chart holders must reach terminal state (not just visible ones)

**Phase C — Worker-Side Integration (Backend)**
- New `DashboardPrintScreenshot` class in `superset/utils/screenshots.py` (subclass of
  `DashboardScreenshot`) — appends `?print=1` to the URL
- New `get_print_pdf()` method on `WebDriverPlaywright` in `superset/utils/webdriver.py`
  — waits for all chart holders, then calls `page.pdf()` with A4 format
- `_get_pdf()` in `superset/commands/report/execute.py` now checks the feature flag and
  routes to `_get_browser_print_pdf()` before falling back to the existing screenshot path
- New `DASHBOARD_REPORTS_BROWSER_PRINT_PDF` feature flag in `superset/config.py`
- New `DashboardReportsBrowserPrintPdf` enum member in `featureFlags.ts`

---

## Files Changed

| File | Change |
|---|---|
| `superset/config.py` | Add `DASHBOARD_REPORTS_BROWSER_PRINT_PDF: False` to `DEFAULT_FEATURE_FLAGS` |
| `superset/utils/screenshot_utils.py` | Add `PRINT_ALL_CHART_HOLDERS_READY_JS` constant |
| `superset/utils/screenshots.py` | Add `DashboardPrintScreenshot` class |
| `superset/utils/webdriver.py` | Import new constant; add `get_print_pdf()` to `WebDriverPlaywright` |
| `superset/commands/report/execute.py` | Import `DashboardPrintScreenshot`; wrap `_get_pdf()`; add `_get_browser_print_pdf()` |
| `superset-frontend/packages/superset-ui-core/src/utils/featureFlags.ts` | Add `DashboardReportsBrowserPrintPdf` to `FeatureFlag` enum |
| `superset-frontend/src/constants.ts` | Add `print` to `URL_PARAMS` |
| `superset-frontend/src/dashboard/components/DashboardBuilder/DashboardBuilder.tsx` | Add print mode body class + CSS injection |
| `superset-frontend/src/dashboard/components/gridComponents/Row/Row.tsx` | Bypass `IntersectionObserver` in print mode |
| `superset-frontend/src/dashboard/styles/printMode.ts` | **New file** — print-mode CSS |

**Files not modified:** `superset/utils/pdf.py`, `chartReducer.ts`, `childChartsDidLoad.ts`,
all existing screenshot tests, the Selenium path, `_get_screenshots()`.

---

## How to Enable for Demo

Add the following to your local `superset_config.py` (or equivalent):

```python
FEATURE_FLAGS = {
    "PLAYWRIGHT_REPORTS_AND_THUMBNAILS": True,    # prerequisite
    "DASHBOARD_REPORTS_BROWSER_PRINT_PDF": True,  # new flag
}
```

Both flags must be `True`. If `PLAYWRIGHT_REPORTS_AND_THUMBNAILS` is off or Playwright is
not installed, `get_print_pdf()` returns `None` and the existing screenshot path runs.

---

## How It Works (End-to-End)

1. A scheduled PDF dashboard report is triggered (Celery worker).
2. `_get_pdf()` checks the feature flag and calls `_get_browser_print_pdf()`.
3. A `DashboardPrintScreenshot` is created — the URL gets `?standalone=3&print=1`.
4. `WebDriverPlaywright.get_print_pdf()` opens the URL in a headless Chromium context.
5. The frontend sees `?print=1` → `body.print-mode` class is set → print CSS applied →
   all `Row` components initialize `isInView=true` (bypassing `IntersectionObserver`).
6. The worker polls `PRINT_ALL_CHART_HOLDERS_READY_JS` (all chart holders, not just
   viewport-visible) until every chart reaches a terminal state.
7. `page.pdf()` is called with A4 format and 10mm margins → real vector PDF bytes.
8. PDF is returned and stored via the existing `NotificationContent.pdf` pipeline.
9. On any failure (timeout, Playwright error, `None` return), the existing
   screenshot-based PDF path runs as the fallback.

---

## Known Limitations (Out of Scope for This Demo)

- **Multi-tab dashboards**: The browser-print path only runs for single-URL dashboards.
  Multi-tab dashboards (tabs split into separate URLs) fall back to the screenshot path.
  Full support requires per-tab `page.pdf()` + PDF merge (Phase 5, optional).
- **Large tables**: CSS-based overflow expansion is applied, but very large tables
  (thousands of rows) may still be slow. The server-side table data fetch path
  (Phase D / hybrid table rendering) is deferred.
- **Production safety limits**: `SCREENSHOT_LOAD_WAIT` provides a basic timeout guard;
  more granular per-phase limits are a Phase 4 hardening item.
- **Page format configurability**: A4 is hard-coded. Configurable format deferred.
- **Selenium**: `page.pdf()` requires Playwright; Selenium cannot produce native PDFs.
  If Playwright is unavailable, the path returns `None` and the screenshot fallback runs.

---

## Phase D — Wide-Table Handling + Landscape Orientation

### Decision Record

**Problem investigated:** Tables with many columns (e.g. flights: 44 cols, wb_health_population: 328 cols) overflow the right edge of A4 portrait PDFs. Four strategies were evaluated from the addendum brief.

**What was verified in the codebase before deciding:**

1. `page.pdf(landscape=True)` — confirmed working. Playwright's `page.pdf()` signature includes `landscape: Optional[bool]`. Tested in the running container: produces correct 843×596 pt pages.

2. CSS `@page` named pages with `prefer_css_page_size=True` — **confirmed working for mixed orientation**. Tested with `page.pdf(prefer_css_page_size=True)` and a document containing `@page L { size: A4 landscape }` with `page: L` on a target element. Result: page 1 = 595×842 pt (portrait), page 2 = 842×595 pt (landscape). Chromium does honour named @page rules for individual elements, producing a genuinely mixed-orientation document.

3. Column banding (IBM Cognos style) — feasible but expensive. Would require measuring column widths in JS, splitting into groups of N, cloning the `<table>` DOM multiple times with different column ranges, and inserting synthetic page breaks between bands. No existing row-chunking plumbing is reusable for column ranges (the current `SHOW_ALL_TABLE_ROWS_JS` operates on react-table pagination, which is row-axis only). Estimated 3–5× more implementation surface than the chosen approach with marginal readability gain over landscape for typical column counts.

4. Shrink-to-fit (CSS `transform: scale()`) — chosen as the **portrait fallback**. Root cause of the previous broken attempt was applying the transform to the inner `<table>` element while the direct parent `div[style="overflow:hidden; width:1496px"]` clipped it. Fix: apply the transform to the scroll-container `div` itself after widening it to `tableW`, then set `height = containerH * scaleFactor` to compensate the layout footprint, and walk ancestors clearing `overflow:hidden`.

**Decision: Option 1 (landscape) as user choice + Option 4 (shrink-to-fit) as portrait fallback + auto mixed-orientation.**

Rationale:
- Landscape is the first-line fix for dashboards built primarily for table data. It is trivially enabled with one config key and gives the best readability for tables that are 1–1.5× the portrait width.
- Shrink-to-fit (portrait) remains the correct behaviour when the user hasn't opted into landscape — it ensures columns are never clipped regardless of how wide the table is.
- Auto mixed-orientation (CSS @page named pages) gives the best of both: portrait pages for charts and text, landscape pages only for wide tables, in the same PDF. This is the most sophisticated option and works reliably in Chromium.
- Column banding was deferred — it adds significant complexity, the readability gain over landscape is minimal for ≤50 columns, and it would require new infrastructure with no existing plumbing to reuse.

### What was implemented

**`SCALE_WIDE_TABLES_JS` (fixed):** Now targets the scroll-container `div` (direct parent of `<table>`) rather than the inner `<table>`. Widens container to `tableW`, applies `transform: scale(scaleFactor)` + `transform-origin: top left`, corrects height footprint, walks ancestors clearing `overflow:hidden`. Accepts a `markLandscape` boolean argument: when `true` (auto mode), marks wide-table root elements with `data-print-landscape="true"` and skips the scale transform for tables that fit in landscape width.

**New `BROWSER_PRINT_PDF_ORIENTATION` config key (`superset/config.py`):**
```python
BROWSER_PRINT_PDF_ORIENTATION: str | None = None  # None/'portrait'/'landscape'/'auto'
```

**New `?print_orientation` URL param (`src/constants.ts`):** `printOrientation: { name: 'print_orientation', type: 'string' }`.

**New `PrintOrientation` type + `getPrintOrientationCSS()` (`src/dashboard/styles/printMode.ts`):**
- `PrintOrientation = 'portrait' | 'landscape' | 'auto'`
- `getPrintOrientationCSS('auto')` returns `@page { size: A4 portrait }` + `@page print-landscape { size: A4 landscape }` + `[data-print-landscape="true"] { page: print-landscape; page-break-before: always }`
- `getPrintOrientationCSS('portrait'|'landscape')` returns `''` (no extra CSS needed — handled in Python)

**`DashboardBuilder.tsx`:** reads `?print_orientation`, validates it, appends `getPrintOrientationCSS()` to the injected style tag.

**`DashboardPrintScreenshot.__init__`:** appends `?print_orientation=landscape|auto` when non-portrait.

**`get_print_pdf()` in `WebDriverPlaywright`:**
- `print_orientation='landscape'` → `pdf_kwargs["landscape"] = True`
- `print_orientation='auto'` → `pdf_kwargs["prefer_css_page_size"] = True`
- Passes `markLandscape = (print_orientation == "auto")` to `SCALE_WIDE_TABLES_JS`

**Large-font header clipping fixed (`printMode.ts` large tier):**
- Added `overflow: visible !important; max-height: none !important` to `.dashboard-chart` (ChartWrapper styled component has `overflow:hidden`) and `.slice_container` (has `max-height:100%`)
- These two rules prevent the chart content area from clipping when the title text is 1px taller than React measured at render time

### Verified results

| Variant | Page size confirmed | Behaviour |
|---|---|---|
| `portrait` | 596×843 pt (A4 portrait) | All 44 cols shrunk to fit — no right-edge clipping |
| `landscape` | 843×596 pt (A4 landscape) | All 44 cols full-size — wide table readable without shrinking |
| `auto` | 595×842 pt + 842×595 pt mixed | Chart pages portrait, wide-table page landscape automatically |
| `large` + landscape | 843×596 pt | Chart titles fully visible — no top/bottom clipping |

### Limitations

- **Column banding** (splitting very wide tables into column groups across multiple pages) is not implemented. For tables wider than ~1.41× the viewport width even in landscape, the shrink-to-fit scale transform is applied as a fallback. At 44 columns (flights) the landscape width is sufficient without scaling.
- **wb_health_population (328 cols)** would still require shrink-to-fit in both portrait and landscape — at that extreme column count no single-page technique produces readable output. Column banding remains the correct long-term solution for that use case.
- **ECharts/canvas** SVG labels are not affected by orientation changes — they draw at their authored pixel sizes.


---

## Phase E — Column Banding for Many-Column Tables

### What was investigated in the codebase before deciding

**1. Existing row-pagination plumbing — is it reusable for column axis?**

`SHOW_ALL_TABLE_ROWS_JS` triggers react-table's `onChange(0)` on the antd
page-size selector, which flips `pageSize=0` on react-table's `usePagination`
hook — forcing all rows into the current render. This is purely a row-axis
mechanism. There is no equivalent column-axis hook in Superset's table plugin:
react-table v7's `useTable` receives the full column array from props at
construction time; no pagination/windowing exists for columns. Column
subsetting would require cloning the `<table>` DOM and rewriting which
`<col>`/`<th>`/`<td>` nodes are visible — a fundamentally different operation
from flipping one React state value. There is no existing plumbing to reuse.

**2. How Superset's table plugin sets column widths.**

`TableChart.tsx` applies a single global `columnWidth` config value as an
inline `style={{ width: columnWidth }}` on every `<col>` element in the
`<colgroup>` block. The `useSticky` hook (`DataTable/hooks/useSticky.tsx`)
measures actual rendered column widths by reading
`th.getBoundingClientRect().width` (with fallback to `th.clientWidth`) on
the last header row after the component mounts. These measurements are stored
in `sticky.columnWidths: number[]`. They are correct at the time the print
pipeline runs (all chart holders have already reached terminal state before any
JS post-processing is called). This is the right measurement source for
column banding — real rendered widths, not authored config values.

**3. Whether CSS `transform: scale()` (Phase D) already covers the cases that need banding.**

At the 1600px viewport and A4 scale factor (≈0.496×):
- Portrait usable width: ~(1600 − 24) × 0.496 ≈ 779 pt ≈ 10.8 inches
- Landscape usable width: ~779 × 1.414 ≈ 1102 pt ≈ 15.3 inches
- Flights table (44 cols): confirmed fits in landscape without scaling.
- `wb_health_population` (328 cols): does not fit even landscape — shrink
  factor would be ~1/15 at the CSS pixel level (~0.033 pt per column), making
  every cell unreadable. This is the case banding is designed for.

Phase D's shrink-to-fit is the correct fallback for modest column overflow
(~1–2× page width). Column banding is the correct approach for severe overflow
(>3× page width) where no single page can present the data readably.

**4. Situation B edge cases (one column too wide for even a full page).**

Verified in live DOM: the Superset table plugin's scroll container has
`overflow: hidden` and `box-sizing: border-box`. After `EXPAND_TABLE_CONTAINERS_JS`
clears the container's inline `width`, each `<th>` and `<td>` expands to its
natural content width. Long free-text fields (e.g. "Notes") do set `white-space`
on `<td>` through the table plugin's cell renderer styles — the plugin sets
`white-space: nowrap` on the whole table by default. So the four-step fallback
from the brief applies directly.

**5. The `th.getBoundingClientRect().width` call from `useSticky` vs. DOM availability
at JS post-processing time.**

By the time `EXPAND_TABLE_CONTAINERS_JS` runs, all chart holders are in terminal
state, meaning the table component has fully mounted and `useSticky`'s
`useLayoutEffect` has already fired. The `<th>` elements and their computed widths
are available in the DOM. `getBoundingClientRect()` returns correct widths at
this point.

### Decision record

**Decision: implement column banding in JS, applied after `EXPAND_TABLE_CONTAINERS_JS`
and before `SCALE_WIDE_TABLES_JS`.**

Rationale:
- Banding must happen before `SCALE_WIDE_TABLES_JS` because `SCALE_WIDE_TABLES_JS`
  measures `tableEl.scrollWidth` to decide whether to scale. If banding has already
  split the table DOM into multiple per-band blocks, each block's scrollWidth will
  be ≤ page width and `SCALE_WIDE_TABLES_JS` will correctly skip all of them
  (fall-through: no tables too wide → no scaling applied).
- No server round-trip, no new API calls, no query-context fetch. The DOM already
  contains all columns and all rows after Phase D's render sequence. Banding
  re-slices the already-rendered DOM.
- No reuse of row-pagination plumbing is possible (confirmed above). The
  implementation is new but self-contained in two JS constants.

**Column-banding algorithm chosen: greedy pack + DOM clone.**

1. Measure every column's actual rendered width via `th.getBoundingClientRect().width`
   on the header row. This matches exactly what `useSticky` uses.
2. Choose a minimum acceptable font size for printed output. The task brief
   states "~8–10pt" as the readable floor. At our scale factor (×0.496), 8pt on
   paper ≈ 8/0.496 ≈ 16px CSS. We are not changing font size during banding
   (the font-size tier is already applied separately). The measurement step just
   reads current rendered widths, which already reflect whatever font tier is
   active.
3. Determine usable page width in CSS pixels: `(viewport − 24px)` in portrait,
   or `(viewport − 24px) × 1.414` in landscape.
4. Select a "key column" set — the leftmost N columns that serve as row identity
   (default: 1 column, or 2 if the first column is a numeric index and the second
   is a label). Key columns repeat in every band.
5. Greedy pack non-key columns into bands: start a new band when adding the next
   column would exceed `usableWidth − keyColsTotalWidth`.
6. If the table produces only one band (all columns fit), leave the DOM unmodified.
7. For each band: clone the `<table>` DOM subtree, keep only key columns + band
   columns (by `<col>`, `<th>`, and all `<td>` in each row at those indices),
   insert a synthetic `<div class="print-col-band">` immediately after the
   original `<table>`'s scroll container, add a `page-break-before: always`
   CSS rule on band 2+. Remove the original `<table>` after all band nodes
   are inserted.

**Situation B fallback chain (per-column, applied during the measure step).**

For any column where `colWidth > usableWidth − keyColsTotalWidth` (i.e. it
would not fit even as the sole non-key column on a page):

1. **Text wrap first**: set `white-space: normal; overflow-wrap: break-word` on
   all `<td>` cells in that column. Re-measure: most long-text fields shrink
   significantly because they were only wide due to `white-space: nowrap`.
   If the column now fits (`colWidth ≤ usableWidth − keyColsTotalWidth`), stop.
2. **Header rotation**: if it is specifically the `<th>` header cell that is
   wide and the data cells are short (column header text length > data cell
   average text length × 2), rotate the header 90° with CSS
   `writing-mode: vertical-lr; transform: rotate(180deg)` and cap the header
   height at 80px. Re-measure the data column width. If it now fits, stop.
3. **Truncate with visible marker**: set `max-width: <usableWidth>px;
   overflow: hidden; text-overflow: ellipsis; white-space: nowrap` on all cells
   in that column, and append a `<div class="print-truncation-note">` below
   the table noting that some fields were abbreviated. This loses information
   and is only reached if steps 1–2 did not resolve the width.
4. **Pull out as a below-row section**: if a column is still wider than
   `usableWidth / 2` after steps 1–3, extract it from the grid entirely and
   render it as a labeled block below each table row (e.g. "Notes: [full cell
   text]"). This is implemented as a separate `<dl>` block inserted after
   the table, one entry per row, with the column label as `<dt>` and the cell
   content as `<dd>`. The column is removed from the main `<table>`.

**Open questions that cannot be resolved from the codebase alone:**

Q1. **Key-column count**: The algorithm defaults to 1 key column (leftmost).
    Some tables have a numeric row index as column 0 and a human-readable
    label as column 1 — in those cases 2 key columns would be more useful.
    There is no metadata in the rendered DOM to distinguish "this is an ID
    column" from "this is a data column". The current implementation repeats
    exactly 1 column (index 0) in every band. Should this be configurable
    per-dashboard / per-table via a URL param or config key?

Q2. **Minimum acceptable font size**: The brief states 8–10pt as the readable
    floor. The current implementation does not change font sizes during banding.
    If operators use `BROWSER_PRINT_PDF_FONT_SIZE='large'` (30px table cells
    → ~15pt on paper), bands will be narrower (fewer columns per band = more
    pages). This is the correct behaviour — font size and column count trade
    off against each other — but it may surprise operators who set large font
    expecting "bigger" not "more pages". Worth documenting in UPDATING.md.

Q3. **Truncation indicator wording**: Step 3 appends a note reading
    "Some fields in column '<name>' were abbreviated due to page width
    constraints." Is this the right wording for the UI? Should it be
    localised / configurable?

Q4. **Interaction with 2col layout**: When `?print_layout=2col` is active and
    a table chart is in a two-column row, the table is forced full-width by
    `ANNOTATE_PRINT_COLUMNS_JS` (tables always skip 2col). Column banding is
    then applied to the full-width table. This is the correct order (banding
    after 2col annotation). Verified by reading the call order in
    `_render_page()` in `webdriver.py` — `EXPAND_TABLE_CONTAINERS_JS` runs
    before `ANNOTATE_PRINT_COLUMNS_JS`, and banding will be inserted after
    `EXPAND_TABLE_CONTAINERS_JS` and before `ANNOTATE_PRINT_COLUMNS_JS`.

### What was implemented

Two new JS constants in `superset/utils/screenshot_utils.py`:

**`MEASURE_TABLE_COLUMNS_JS`** — measures each table's actual rendered column
widths (via `th.getBoundingClientRect().width`) and returns a JSON-serialisable
array of per-table column width arrays. Called after chart holders are ready.

**`BAND_TABLE_COLUMNS_JS`** — accepts the measurement result and an options
object `{ usableWidth, keyColCount, orientation }`. Applies the greedy
column-banding algorithm and Situation B fallbacks to each table in the DOM
whose total column width exceeds `usableWidth`. Tables that fit are untouched.
Returns `{ banded, situation_b_wrap, situation_b_rotate, situation_b_truncate }`.

Wired into `_render_page()` in `superset/utils/webdriver.py`:
- Called after `EXPAND_TABLE_CONTAINERS_JS` (so containers are at their final
  sizes) and before `SCALE_WIDE_TABLES_JS` (so `SCALE_WIDE_TABLES_JS` only sees
  already-banded tables, each fitting within the page width, and correctly
  skips them).
- `usableWidth` is computed from `pdf_viewport_width` and `print_orientation`.

Controlled by the existing `DASHBOARD_REPORTS_BROWSER_PRINT_PDF` feature flag
(no new flag). The banding logic activates automatically whenever a table's
rendered columns exceed the usable page width — it is not a separate opt-in.

### Limitations

- **Key-column count is fixed at 1** (leftmost column). See Q1 above.
- **Column banding does not interact with server-side paginated tables**: those
  tables only have the current page's rows in the DOM. Banding still works (it
  splits whatever columns are present across multiple page-width bands) but the
  row content is limited to the fetched page.
- **The Situation B step 4 (pull-out section)** is implemented as a structural
  DOM mutation that produces a `<dl>` block after the table. This is readable
  but not styled to match the Superset table UI — further polish is a follow-on.
- **ECharts/canvas columns** (e.g. a sparkline column in a table) are measured
  by their container width, not by the SVG/canvas content. The banding algorithm
  treats them as regular columns and will include them in bands. If the canvas
  element is narrower than the container, it will re-render at the band width
  (which is correct).
