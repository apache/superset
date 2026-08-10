# Task: Implement a demo-scoped proof-of-concept for SIP-212 (Browser-Print PDF Dashboard Reports)

## Background

Apache Superset currently generates dashboard PDF reports by taking a **headless-browser screenshot** of the rendered dashboard and embedding that raster image into a PDF. This has known limitations: scrollable/tall content gets clipped (especially tables), output files are large images rather than real text, there are no selectable text or clickable links, and large dashboards can time out.

GitHub Issue apache/superset#39965 ("[SIP-212] Browser Print PDF Dashboard Reports") proposes replacing this with a **native browser print pass**: render the dashboard in a "print-ready" mode as real HTML, then use the headless browser's own print engine (e.g. Playwright's `page.pdf()`) to produce the PDF directly, instead of screenshotting it. That issue is a design proposal only — no code has been merged against it. Nothing you find in the repo will directly reference "SIP-212"; you are implementing an original proof-of-concept inspired by it.

## Your objective (demo scope — read carefully, this is intentionally narrower than the full proposal)

Implement a **feature-flagged, additive** alternate PDF report generation path for dashboards that:

1. Uses native browser printing (`page.pdf()` or equivalent) instead of screenshot capture, on a dashboard rendered in a print-friendly mode.
2. Determines "the dashboard is actually ready to print" using **real render-completion state** already tracked by the frontend (see Investigation Task 1 below) — not a fixed time delay.
3. Falls back automatically to the **existing, unmodified screenshot path** if anything in the new path fails or times out.
4. Is entirely gated behind a new config feature flag, default OFF, so existing behavior is completely unchanged unless the flag is explicitly enabled.
5. Produces a visibly better result than the screenshot path for at least one realistic sample dashboard, in a way that can be demoed side-by-side (e.g. a dashboard containing a table with more rows than fit in one screen — the current screenshot path truncates this; your new path should not).

### Explicitly OUT of scope for this demo (do not build these — note them as future work instead if relevant)
- General incremental/chunked printing with PDF merging for extremely large dashboards.
- Print support for every chart type — a small, explicit allow-list is fine for the demo.
- Production-grade safety limits tuning (max pages, max execution time, max output size) — a basic timeout is enough; just note where production limits would need to be added.
- Any change to the existing screenshot code path's behavior when the new flag is off.

## Required approach: verify before you build

Do not assume the file paths, class names, or hook names below are still accurate — Superset's codebase changes over time and my information may be out of date or approximate. Before writing any code:

1. **Locate the current report execution flow.** Find the command/class responsible for generating a dashboard PDF report today (search for terms like `DashboardScreenshot`, `ReportExecutor`, screenshot report command, PDF generation in the reporting module). Read it fully and confirm how it currently produces a PDF from a screenshot.
2. **Locate the dashboard "standalone" / report-rendering URL mode.** Find how the existing screenshot flow forces the dashboard into a clean, chrome-free rendering mode via a URL parameter, and what the enum/constant for that mode is called today.
3. **Locate frontend chart render-status tracking.** Find how the frontend currently knows whether a given chart has finished loading, succeeded, or failed (look for a Redux slice or store tracking chart status, and any existing hook/selector that answers "have all currently-relevant charts finished loading or failed?"). Confirm the terminal states it treats as "done" (loading is expected to end in success, a rendered state, or a failed/error state — confirm the actual state names in the current code).
4. **Locate where feature flags are declared and read** (the `FEATURE_FLAGS` config dict pattern, and how frontend/backend code checks a flag's value) so your new flag follows existing conventions exactly.
5. **Confirm what headless browser tooling is actually in use today** (Playwright vs Selenium — the repo has moved between these over time) and use whatever the current default supports for a `page.pdf()`-equivalent call.

Report back briefly on what you found for each of these five points before proceeding to implementation, so assumptions can be corrected early rather than discovered after code is written.

## Implementation plan (once verified)

### Phase A — Print-ready rendering mode (frontend)
- Add a new print-mode variant of the existing clean-render standalone mode (or extend the existing one — decide based on what you find in Investigation Task 2, and note which you chose and why).
- Add print-specific CSS: single vertical column layout, remove drag handles/filter bar/edit-only UI.
- For any chart/table widget that currently clips content via internal scroll/overflow, add a print-mode variant that expands to full content height instead of clipping. It is acceptable to scope this to just the standard Table visualization for the demo.

### Phase B — Readiness signal (frontend → backend bridge)
- Using the existing chart-status tracking found in Investigation Task 3, expose a simple boolean signal to the DOM once every in-scope chart has reached a terminal state (success, rendered, or failed — failed counts as "done," not as a reason to keep waiting). A `data-*` attribute on a stable container element (e.g. `document.body`) that the backend can poll for is a reasonable approach — but decide based on what best fits the existing patterns you find.
- Make sure charts that would normally lazy-load only when scrolled into view are force-triggered immediately in this print mode, since there is no scrolling in a print pass.

### Phase C — Worker-side integration (backend)
- Add the new feature flag (default `False`), following existing flag conventions exactly.
- When the flag is on: open the dashboard in the print-ready mode via the existing headless-browser session infrastructure, wait for the readiness signal from Phase B with a reasonable timeout, then call the browser's native print-to-PDF function.
- Wrap this entire new path in error handling: **any exception, timeout, or unexpected failure must fall back to calling the existing, unmodified screenshot-based report generation path.** The existing path must be completely untouched by your changes — only add a new path alongside it, with a decision point at the top that routes based on the feature flag and this fallback behavior.
- Store the resulting PDF through whatever existing report-artifact storage mechanism the current path already uses — do not build a new storage path.

### Phase D (stretch, only if time allows) — Table data special-case
For a table too large to comfortably render inline, fetch its rows through whatever existing chart-data/query API the app already uses (the same one used for CSV export, if one exists) preserving filters/sorting/row-level security, and render it as a real HTML `<table>` appended into the print document rather than relying on the in-DOM table render. Only attempt this if Phases A–C are solid and demo-ready first.

## Deliverables I need from you at the end

1. All code changes, on the current branch, with clear commit messages.
2. A short written summary (`DEMO-NOTES.md` at the repo root is fine) covering:
   - What you verified in the five Investigation Tasks, and where the actual current code differs from what this prompt assumed.
   - Exactly how to enable the feature flag and trigger a report using the new path.
   - A suggested demo script: how to generate a PDF via the *old* path and the *new* path for the same sample dashboard, so they can be shown side-by-side (ideally one containing a table with enough rows to demonstrate the clipping problem being solved).
   - Any known limitations, rough edges, or things explicitly deferred (per the out-of-scope list above).
3. Confirmation that with the feature flag OFF, existing report generation behavior is provably unchanged (e.g., existing tests for the screenshot path still pass).

## Ground rules
- Do not remove, rewrite, or "clean up" the existing screenshot-based reporting path. It must remain fully intact and be the default and the fallback.
- Prefer reusing existing infrastructure (browser session management, chart status tracking, report storage, chart-data APIs) over building new equivalents — the whole point of this design is to be additive and low-risk, not a rewrite.
- If you hit a point where the real codebase clearly doesn't support something this prompt assumes, stop and report it rather than improvising a large workaround silently — flag it in DEMO-NOTES.md and propose the smallest reasonable adjustment.