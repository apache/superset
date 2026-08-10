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
