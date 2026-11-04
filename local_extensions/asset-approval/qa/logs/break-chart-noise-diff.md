# Chart review diff lists ~25 "Added" settings I never touched (raw internal keys), for a chart I put back exactly as it was

User: alex, chart 261 "qa_r706_chart", draft/request #728.

## Steps
1. Open /explore/?slice_id=261 as alex.
2. Remove dimension "one", re-add "one", Update chart (chart identical to before).
3. Save (Overwrite) -> draft created ("Changes saved. Viewers still see the live version.").
4. Banner "Request review" -> submit with empty note (double-clicked submit).
5. Banner "What changed".

## Expected
Either "no changes" (nothing differs from live) - the dashboard toolbar says "No changes to review yet." in that case - or only real changes.

## Happened
Review was accepted ("Review requested.", Awaiting review) and the panel says "What changed - 2 changes", Chart configuration with ~25 lines such as:
Added - Align +/- for all columns: false
Added - Allow columns to be rearranged: false
Added - Render columns in HTML format: true
Added - dashboards: [139]
Added - matrixify_all_sort_by_columns: a_to_z
Added - matrixify_dimension_columns: {"dimension": "", "values": []}
Added - matrixify_dimension_selection_mode_rows: members
... (matrixify_* names are internal keys, not labels). A reviewer cannot tell that nothing user-visible changed, and is asked to approve ~25 "added" settings. The same no-op request is also not blocked, unlike the dashboard.

## [review] lines (Playwright console, verbatim)
[LOG] [review] #2 38500ms event: a write was captured for review
[LOG] [review] #3 38545ms banner: read the review status {"reader":"useAssetReview","requestId":728,"status":"draft","isOpen":true,"isAuthor":true,"asset":"chart 261"}
(request-review step produced further [review] lines at console log lines L164-L171 of /Users/amaannawab/.waypoint-qa/browser-runs/console-2026-11-04T16-55-14-233Z.log)

## Screenshot
/Users/amaannawab/.waypoint-qa/browser-runs/page-2026-11-04T16-56-28-090Z.png
Panel text dump: /Users/amaannawab/.waypoint-qa/browser-runs/chart-panel.yml
