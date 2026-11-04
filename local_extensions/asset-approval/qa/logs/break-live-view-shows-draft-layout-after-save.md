# After Save, the dashboard view shows the DRAFT layout while the banner and "Show changes: off" say it is the live version

User: alex (author), dashboard 6 "Sales Dashboard Q4 Final", open draft request #726. Reproduced twice (22:16 and 22:17).

## Steps
1. As alex open /superset/dashboard/6/ - all tiles present (Total Revenue, Quarterly Revenue, Quarterly Revenue (By Product Line)).
2. Press "Edit dashboard". Canvas shows all tiles.
3. Hover the top row, click its trash icon on the left edge (top row with Total Revenue + Quarterly Revenue is deleted).
4. Press "Save".

## Expected
Edit mode ends. "Show changes" toggle is OFF and the banner says "you and viewers are both seeing the live version", so the page should still show the live dashboard (all three tiles), with the deletion visible only when "Show changes" is turned on.

## Happened
Page shows the draft: the top row (Total Revenue, Quarterly Revenue) is gone, only "Quarterly Revenue (By Product Line)" remains, with Show changes OFF and the banner still saying "you and viewers are both seeing the live version - turn on Show changes to see yours". Reloading the page (F5) shows all three tiles again. So the screen contradicts its own message until reload; an author would believe they had deleted live content, or that viewers lost it.

## [review] lines (verbatim, after navigation so numbering restarted)
[review] #4 9521ms edit: Edit dashboard pressed {"dashboardId":6,"openRequest":726,"status":"draft","isOpen":true,"isAuthor":true,"hasUnsavedChanges":false}
[review] #5 16672ms save: Save pressed in the edit toolbar {"dashboardId":6,"hasUnsavedChanges":true,"toolbarStatus":"draft","openRequest":726}
[review] #6 16731ms save: the server held it for review (202) {"dashboardId":6,"requestId":726,"message":"Changes updated in your existing draft.","revertedFields":[],"leftReview":null}
[review] #7 16731ms event: a write was captured for review
[review] #8 16855ms banner: read the review status {"reader":"useAssetReview","requestId":726,"status":"draft","isOpen":true,"isAuthor":true,"asset":"dashboard 6"}

No error text.

## Screenshot
Screenshot id ss_4690nmuo6, file /Users/amaannawab/.claude/projects/-Users-amaannawab-superset-local/f292c560-4bc4-4e9c-9067-6ab596ceb91a/tool-results/mcp-claude-in-chrome-blob-1793810874847-1o0zmf.jpg
(Earlier same symptom seen at 22:16 after a stale-tab Save, screenshot ss_1282th7vu.)

## Extra
Toggling "Show changes" on then off again (no reload) restores the correct live view (all three tiles), screenshot ss_6449avvq3. So the post-Save render is the stale state.

## Second reproduction (headless Playwright, alex, 1280x720) - adding tabs
Steps: Edit dashboard 6, click "+" twice (two "Tab title" tabs), click toolbar "Request review" (saves first, then opens dialog), Cancel the dialog.
Result: view mode with "Show changes" OFF and banner "you and viewers are both seeing the live version" shows FOUR tabs (Sales Overview, Exploratory, Tab title, Tab title) with the last new tab selected and "There are no components added to this tab". The live dashboard only has two tabs. Screenshot: /Users/amaannawab/.waypoint-qa/browser-runs/page-2026-11-04T17-07-27-181Z.png
Also "Filters out of scope (7)" appears in the filter bar because the selected tab is the draft-only empty tab.
