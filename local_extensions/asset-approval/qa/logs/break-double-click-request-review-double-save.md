# Double-clicking toolbar "Request review" with unsaved edits fires TWO saves, and the dialog opens before the save has finished

User: alex, dashboard 6, draft #727 (title "Z NAV" in the draft, live title "Z").

## Steps
1. Edit dashboard, click "+" (add tab) twice, so there are unsaved edits (toolbar Save enabled, Request review enabled).
2. Double-click the toolbar "Request review".

## Expected
One save, then one dialog, only after the draft is saved (so the reviewer sees what the author just did).

## Happened
Two saves were sent and two success toasts shown, and the dialog opened (#7) 70ms BEFORE the first save returned (#10). The "opening the dialog" line appears twice (#7, #15). Both toasts say: "Changes updated in your existing draft. This save put back 1 setting your draft had changed: dashboard_title." (raw field name shown to the user). The earlier draft title "Z NAV" was thus reverted to "Z" by a save from an edit canvas that never showed the draft title.
A fast user could submit the dialog before the draft is saved.

## [review] lines (verbatim)
[review] #4 1790ms edit: Edit dashboard pressed {"dashboardId":6,"openRequest":727,"status":"draft","isOpen":true,"isAuthor":true,"hasUnsavedChanges":false}
[review] #5 17274ms request review: toolbar button clicked {"dashboardId":6,"hasUnsavedChanges":true,"hasDraftToSubmit":true,"isAwaitingReview":false,"toolbarStatus":"draft","openRequest":727,"willSaveFirst":true}
[review] #6 17275ms event: request review asked for
[review] #7 17279ms request review: opening the dialog {"requestId":727,"status":"draft","isOpen":true,"isAuthor":true,"asset":"dashboard 6"}
[review] #8 17282ms request review: toolbar button clicked {"dashboardId":6,"hasUnsavedChanges":true,"hasDraftToSubmit":true,"isAwaitingReview":false,"toolbarStatus":"draft","openRequest":727,"willSaveFirst":true}
[review] #9 17283ms event: request review asked for
[review] #10 17350ms save: the server held it for review (202) {"dashboardId":6,"requestId":727,"message":"Changes updated in your existing draft. This save put back 1 setting your draft had changed: dashboard_title.","revertedFields":["dashboard_title"],"leftReview":null}
[review] #11 17350ms event: a write was captured for review
[review] #12 17465ms save: the server held it for review (202) {"dashboardId":6,"requestId":727,"message":"Changes updated in your existing draft. This save put back 1 setting your draft had changed: dashboard_title.","revertedFields":["dashboard_title"],"leftReview":null}
[review] #13 17466ms event: a write was captured for review
[review] #15 17487ms request review: opening the dialog {"requestId":727,"status":"draft","isOpen":true,"isAuthor":true,"asset":"dashboard 6"}

No error text.

## Screenshot
/Users/amaannawab/.waypoint-qa/browser-runs/page-2026-11-04T17-07-14-944Z.png
Console dump: /Users/amaannawab/.waypoint-qa/browser-runs/dash-console-a.txt
