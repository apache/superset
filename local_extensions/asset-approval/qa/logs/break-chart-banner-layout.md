# Explore page: the "Your changes are saved..." banner collapses into a one-word-per-line column and overlaps the chart area

User: alex, chart 261 "qa_r706_chart" (Alex is the owner), viewport 1280x720 (headless Playwright).

## Steps
1. As alex open /explore/?slice_id=261.
2. Remove the dimension "one" (X on the pill), click the empty Dimensions box, pick "one" again in the popover, Save popover, then "Update chart" (chart now identical; Altered badge goes away and Save becomes enabled).
3. Click the chart "Save" button (top right). Dialog "Save chart" - Save (Overwrite) selected. Double-click the dialog's "Save".
4. Look at the right-hand pane.

## Expected
A single-line banner above the chart: "Your changes are saved ... you and viewers are both seeing the live version", with Show changes / What changed / Request review / Discard changes buttons, like the dashboard page.

## Happened
The banner text is squeezed into a ~50px wide column so it renders one or two words per line ("Your / chang / es are / saved / a few / second / s ago ..."), about 500px tall, pushing the chart results down, and a stray strip "Live version - what viewers see now" is drawn underneath/overlapping the toast. The buttons sit to the right of the squashed text. Unreadable, looks broken.
Toast shown: "Changes saved. Viewers still see the live version."
Double-click on Save produced only ONE captured write (good, no duplicate).
Side note: the chart name stays "qa_r706_chart" - I did not manage to rename it (typing into the title box failed with my selector, unrelated).

## [review] lines (verbatim, from Playwright console; no error text from the app, only antd deprecation warnings and a React "Cannot update a component (`List`) while rendering a different component (`SelectTrigger`)" warning that predates the save)
[LOG] [review] #1 1311ms banner: read the review status {"reader":"useAssetReview","request":null}
[LOG] [review] #2 38500ms event: a write was captured for review
[LOG] [review] #3 38545ms banner: read the review status {"reader":"useAssetReview","requestId":728,"status":"draft","isOpen":true,"isAuthor":true,"asset":"chart 261"}

Note: there is no "save: Save pressed ..." / "save: the server held it for review" line for charts like there is for dashboards.

## Screenshots
/Users/amaannawab/.waypoint-qa/browser-runs/break-chart-banner-layout.png
/Users/amaannawab/.waypoint-qa/browser-runs/page-2026-11-04T16-55-53-755Z.png
Full console: /Users/amaannawab/.waypoint-qa/browser-runs/chart-banner-console.txt

## Correction / scope
The squashed banner only occurred in the "draft saved" state (long text + toggle + 3 buttons). Once review was requested, the "Awaiting review..." banner was fine on one line (screenshot page-2026-11-04T16-56-21-588Z.png), but when the "Review changes" side panel was opened (What changed) the banner squeezed again (page-2026-11-04T16-56-28-090Z.png) and the side panel itself is cut off at the right edge of a 1280px-wide window (its text is clipped: "Align +/- for all", "Allow columns..."). So on a 1280px window the chart page cannot show the review panel fully.
