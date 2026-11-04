# Saving from edit mode silently replaces the existing draft (earlier draft changes vanish) + double-click Save sends two saves

User: alex, dashboard 6 "Sales Dashboard Q4 Final", existing draft request #725 (saved 27 minutes earlier).

## Steps
1. Log in as alex, open /superset/dashboard/6/, press "Edit dashboard".
2. Banner says: "Your changes are saved 27 minutes ago - you and viewers are both seeing the live version".
3. Click "What changed": panel shows draft #725 contents = "Dashboard settings 3 removed, 1 edited: Removed chart: Quarterly Revenue (By Product Line); Removed column; Removed row; Changed tab: Sales Overview. Cross-filter and native filter scopes updated for 1 removed chart".
   Note: the edit canvas still SHOWS "Quarterly Revenue (By Product Line)" (it is the live layout, not the draft).
4. Click the dashboard title, append " QA1", press Enter. (Banner: "Editing - these edits are not saved yet - your draft from 27 minutes ago is still what is held for review". Review changes panel still shows the old diff.)
5. Double-click "Save".

## Expected
Title change is added to the draft; the earlier draft changes (chart removal etc.) are kept - or the user is told that the draft is being replaced / that the canvas does not include the draft.

## Happened
- Two saves were issued (two toasts "Changes updated in your existing draft.").
- The Review changes panel afterwards lists only "2 changes: Title ... QA1; Dashboard settings 1 edited". The earlier "3 removed" (chart, column, row, tab change, filter scope updates) are GONE from the draft. revertedFields was [] - no warning at all. Draft work disappeared silently.
- The edit canvas for an author with an open draft shows the live version (with the removed chart still present), so any save overwrites the draft with live+new edit.

## [review] lines (verbatim)
[review] #4 5856ms edit: Edit dashboard pressed {"dashboardId":6,"openRequest":725,"status":"draft","isOpen":true,"isAuthor":true,"hasUnsavedChanges":false}
[review] #5 29592ms save: Save pressed in the edit toolbar {"dashboardId":6,"hasUnsavedChanges":true,"toolbarStatus":"draft","openRequest":725}
[review] #6 29604ms save: Save pressed in the edit toolbar {"dashboardId":6,"hasUnsavedChanges":true,"toolbarStatus":"draft","openRequest":725}
[review] #7 29685ms save: the server held it for review (202) {"dashboardId":6,"requestId":725,"message":"Changes updated in your existing draft.","revertedFields":[],"leftReview":null}
[review] #8 29686ms event: a write was captured for review
[review] #9 29868ms save: the server held it for review (202) {"dashboardId":6,"requestId":725,"message":"Changes updated in your existing draft.","revertedFields":[],"leftReview":null}
[review] #10 29869ms event: a write was captured for review
[review] #11 29873ms banner: read the review status {"reader":"useAssetReview","requestId":725,"status":"draft","isOpen":true,"isAuthor":true,"asset":"dashboard 6"}

(no error text)

## Screenshot
Screenshot id ss_3783nevoc (saved in /Users/amaannawab/.claude/projects/-Users-amaannawab-superset-local/f292c560-4bc4-4e9c-9067-6ab596ceb91a/tool-results/mcp-claude-in-chrome-blob-1793810584107-lmp38y.jpg)
