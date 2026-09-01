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

