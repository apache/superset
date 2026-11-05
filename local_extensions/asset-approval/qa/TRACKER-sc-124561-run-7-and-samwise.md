# Round 7 and Samwise's retest — the authoritative text

Both messages below are reproduced verbatim from Slack, pasted by Amaan on
2026-11-05. They are the source of record for the R7-01..08 ids and for
Samwise's `sc-` rows. Everything else in this directory that names those ids
paraphrases them; where a paraphrase and this file disagree, this file wins.

This matters because until now **R7-07 appeared nowhere in this repository** —
not in a document, a test, or a commit — and a retest on 2026-11-05 had to
report it as unassessable. It is written down here so that cannot happen
again. R7-08 was in the same position.

Both runs are against **`5229b7a` / `5229b7ab`**, which is what `asset-demo`
pointed at until 2026-11-04. Anything claimed fixed after that commit is
untested by either message.

---

## 1. Samwise's retest, 11:32 PM

> Retest of asset-demo @ 5229b7ab (fresh build, no manual superset init):
> • sc-131031 PASS: editors' held saves show the banner, review API returns 200.
> • sc-131032 FAIL (partly): approved chart now shows in place and the banner copy is right, but after a held save Explore still draws the live chart, not the author's draft.
> • sc-131033 FAIL (half): a sent-back change now shows on the author's Approvals page, but the reviewer's note isn't shown there (Approvals.tsx never renders review_note).
> • sc-131034 PASS
> • sc-129075 done parts: long values and colour keys PASS; dataset description diff FAIL (review dialog still says "No column changed"); chart setting names FAIL on first save of a chart that hasn't been saved from Explore.
> • New, High (same cause as 131032): revising a sent-back chart change silently drops the author's earlier edits, because Explore reopens the live chart and the revision overwrites the draft.
>
> @Amaan Nawab repro steps are on each ticket; all left In Review.
>
> New demo videos (replace 11/2): Dogfooding BOM — Asset approval workflow https://app.notion.com/p/40c8718b646581cbba97dcaab60729e7. The draft-chart gap and the lost-edit bug show in the main demo (~1:45). Build is shut down.

## 2. Our own Run 7 report (risk-based) on `5229b7a`

> Samwise's findings ✅
> • sc-131031 install after init: fixed (permissions re-seeded on restart, no superset init needed)
> • sc-131032 Explore stale chart: fixed (checked the rows actually drawn, after held save and after approve)
> • sc-131033 returned change on author's Approvals: fixed
> • sc-131034 settings copy: fixed
> • sc-129075 What changed: partly (readable names, but no values/preview, "and 3 more" hides changes)
>
> Regression: same as run 6 (gate, MCP, fail-closed, flag off/on, imports, role/group editors)
>
> 🆕 New findings
> • 🔴 R7-01 (Critical): new chart saved with "Add to dashboard" (Explore Save as, or POST /chart with dashboards) shows on a published dashboard for viewers, no review
> • 🔴 R7-02 (Critical if MCP is on): MCP delete_dataset_metric deletes the live metric, no review, and drops the author's open draft
> • R7-03 (High): after "Request to publish", the dashboard can still be edited; approving publishes content the reviewer never saw
> • R7-04 (High): approving an MCP-created metric replaces all the dataset's metrics (breaks charts)
> • R7-05 (High): author save landing during an approval rewrites the approved request back to draft (19/19), so the audit trail is wrong
> • R7-06 (Med): 2nd save silently drops the 1st edit · R7-07 (Med): dataset review hides fetch_values_predicate change · R7-08 (Low): viewer Home shows a collapsed "Pending reviews"
>
> Tracker updated (Run 7 column + Samwise rows + R7-01..08). Report + videos available.

---

## The two messages disagree, and the disagreement is the useful part

Both are against the same build, and on `sc-131032` they reach opposite
verdicts. Ours says fixed, "checked the rows actually drawn, after held save
and after approve". His says partly failed: *"after a held save Explore still
draws the live chart, not the author's draft."*

Both can be true at once, and probably are. The chart body does re-render from
the proposal, which is what our check measured. What he is describing is a
different thing in the same place: Explore reopens on the **live** chart, so
the author is not looking at their own saved work. We measured the rows; he
measured whose version was on the screen.

That reading is supported by his New High finding, which he attributes to the
same cause and which is a lost edit, not a stale render: *"revising a sent-back
chart change silently drops the author's earlier edits, because Explore
reopens the live chart and the revision overwrites the draft."*

**That is the same defect, on charts, that `804c5263b4` fixed for dashboards on
2026-11-05.** The author's working surface was seeded from the published asset
rather than from their draft, so the next save posted the published content
over their own. We inverted the default for dashboards and deliberately did not
for charts — `AssetReview.tsx` returns early unless the asset is a dashboard.
Datasets have no review surface at all, and a 2026-11-05 browser pass
reproduced the same destruction there.

So one root cause reaches all three asset types, and as of `804c5263b4` exactly
one of them is fixed. Samwise found the chart half before we did, on the older
build, and filed it High.

## What each id means, for anyone mapping them later

| id | one line | where it lives |
| --- | --- | --- |
| R7-01 | Critical. A new chart saved with "Add to dashboard" reaches viewers on a published dashboard with no review | gate, chart create |
| R7-02 | Critical where MCP is on. `delete_dataset_metric` deletes the live metric unreviewed and drops the author's open draft | MCP |
| R7-03 | High. A dashboard stays editable after "Request to publish", so an approval can publish content the reviewer never saw | author flow |
| R7-04 | High. Approving an MCP-created metric replaces every metric on the dataset | MCP, replay |
| R7-05 | High. A save landing during an approval rewrites the approved request back to draft, so the audit trail is wrong | lifecycle race |
| R7-06 | Medium. A second save silently drops the first edit | gate, fold |
| R7-07 | Medium. Dataset review hides a `fetch_values_predicate` change | reviewer diff |
| R7-08 | Low. A viewer's Home shows a collapsed "Pending reviews" | viewer containment |

Samwise's rows: `sc-131031` install after init · `sc-131032` Explore stale
chart · `sc-131033` returned change on the author's Approvals page, and its
missing `review_note` · `sc-131034` settings copy · `sc-129075` the "What
changed" panel, of which the dataset description diff and the chart setting
names on a first save are still open.

Two of his are precise enough to act on without the ticket: `Approvals.tsx`
never renders `review_note`, and the dataset description diff still reports
"No column changed".
