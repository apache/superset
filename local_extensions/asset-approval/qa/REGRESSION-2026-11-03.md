# Full regression before the chart preview commit

2026-11-03, against `feat/chart-review-preview` @ `7bc9d9b3f3`, on the QA
instance at `localhost:9002`. Run before pushing the chart preview, to
answer one question: does the rest of the epic still hold?

The change under test is **frontend only** — twelve files, all under
`superset-frontend/src/features/changeManagement/` plus
`explore/components/ExploreViewContainer/index.tsx`. No Python, no API, no
gate, bindings, changes or eligibility. So a backend behaviour that moved
would be a surprise rather than an expectation, and none did. Everything
backend reported below was already there.

## What was run

Five testers in parallel, partitioned by asset so they could not collide on
the one-open-change-per-asset rule, plus a browser walk. The API testers
were deliberately barred from the browser: Chrome has a single cookie jar
here, and five sessions logging in as different accounts would have
corrupted every result.

| Surface | Corpus | Assets |
|---|---|---|
| Dashboards | QA-03/11/15/16/19/20/21/22/24, R2-01, R4-01, R4-07, S-03, NEW-2, NEW-5, 129069/074/076/077 | dashboard 7 |
| Datasets | S-01, S-04, QA-02, QA-25, NEW-4, NEW-7, 129068/071/073, Visa Q11 | dataset 1 |
| Charts | walk L, QA-05/15/17, R3-01, NEW-11, 129068/070/071/078, sc-131032 | charts 1, 2 |
| Eligibility and flags | QA-04/07/10/12/18/18a/18b/20/23/26, S-05/07/08/09, R4-08, NEW-6, R5-05, sc-131031/034, Visa Q1 | dashboards 6, 10 |
| Adversarial, imports, MCP | the nine attacks, S-02/06, QA-13, R5-01/02/03/04, 129072, sc-131033, NEW-1/3/8/9/10/12 | own assets |
| Browser | the chart preview itself, and the dashboard review path | chart 69, a throwaway dashboard |

Automated gates first, because a frontend sweep has killed this node
container before and every tester needed the instance up: Python change
management **519 passed, 4 skipped**; frontend `changeManagement` **105
passed, 16 suites**; `src/explore` **1869 passed, 1 failed**; `tsc --noEmit`
clean.

The one frontend failure is `ColumnConfigControl.popover.test.tsx`, which
came from upstream #44843 and imports only `ColumnConfigControl`, the
testing-library helpers and `core/common` — none of the twelve changed
files, and nothing under them. It reproduces in isolation, so it is
deterministic rather than pollution. Running it against the base tree was
blocked (reverting tracked files is a destructive operation here), so this
is exclusion from the import graph, not a bisect.

## What holds

**Acceptance criterion 2 holds on every route tested.** Nothing reached a
viewer without a second editor's approval, through the UI or the API.

Both of the attacks that failed in the original adversarial pass still
hold, checked on the resulting database row and not only on the status
code. Submit-and-discard fired together over six runs never reproduced the
impossible row (`pending` with `decided_at` set and the slot freed).
Approving while naming no version fails closed with the field absent, empty,
null, and with no request body at all.

The rest of the nine attacks held. Imports are still refused over an
existing asset, including the new-uuid route that used to slip past; the
MCP write paths were exercised as real tool calls in-process rather than by
reading the source, and all six capture instead of writing; Approvals
pagination is server-side; a returned change now appears in the view the
page opens on, matching the bell.

**129078 direction two is fixed.** A submitted delete replaced by an
ordinary save used to be silent, and was the worse of the two directions
because the approver's queue item vanished with no notice. The author is now
told: "Changes saved in place of the delete you had waiting, which is no
longer requested."

## The chart preview

Walked in the browser as the real accounts, not through the API.

As the author: a viz-type change saved from Explore is captured, the live
chart stays on screen, and the banner, **Show changes**, **What changed** and
**Request review** all appear without a reload. As the reviewer: the banner
reads "Alex Rivera proposed 3 changes · you are seeing the live version",
the panel docks beside the chart carrying the author's note and the field
diff, and both decision buttons stay reachable. Turning the switch on
replaces the bar chart with the proposed line chart, flips the banner to
"you are seeing the proposal", and labels it "Proposed version · not live
until approved" at the same height as the live label, so nothing shifts.
Turning it off returns cleanly. Approving publishes it and removes the whole
review UI, with no stale `form_data_key` left in the URL.

The dashboard half of the same code still works: banner, docked panel, title
diff, and the switch moving the header between the live and the proposed
title.

**The boundary, found in this run and now written into the code.** The
switch is offered for a rename made through Explore's own Save dialog, and
turning it on shows a chart identical to the live one. Measured on chart 1:
a rename-only save posts a `params` blob carrying 32 keys the stored chart
never held, dropping 8 the current viz type has no control for, and
re-emitting the deck.gl `viewport` at full float precision. So `params`
really does differ, `changed_fields` reports it, and the gate that was
supposed to tell a rename from a drawing change lets it through.

The comment in `proposedChart.ts` claimed the captured body of a rename was
"byte-identical to what is stored". That is false, and it was the premise
the gate was built on. The comment now records what was measured instead.

What a reviewer sees is still truthful — approving does publish that blob,
and the panel names `slice_name` as what changed — but they turn the switch
on and watch nothing move. Comparing properly needs the live form data put
through the same normalisation Explore applies before posting, since Explore
also migrates `time_range` into `adhoc_filters` on save, so even a
non-map rename moves a key the chart already had. That is the same shape as
QA-15 on the chart surface and belongs with it.

A rename through the properties modal or the REST API sends `slice_name`
alone and correctly gets no switch.

## Defects found

None of these is in the twelve changed files. All five were verified
against the running instance rather than taken from a report.

**1. A save that changes nothing destroys the author's own submitted
change. High.** Reproduced end to end: alex renames chart 2 (202, draft),
submits it (pending, priya's queue reads 1), then saves posting the value
already live. The save answers **200** with no mention of review, the
request goes to `discarded` with `reviewer_fk` set to the author, and
priya's queue drops to 0 with no notice. Also reproduces from
`changes_requested`, and on dashboards.

`_drop_a_fully_reverted_draft` (`gate.py:385`) says "draft" in its name and
twice in its docstring, but its only guards are the author match
(`gate.py:414`) and the sub-command check (`gate.py:416`). There is no
status check, and `find_open_request` returns `draft`, `pending` and
`changes_requested` alike. Closing a reverted *draft* is R4-01 working as
intended; destroying a submitted one is a control failure of the same family
this feature exists to prevent. A status guard is the whole fix.

**2. Two simultaneous saves by one author lose one of them, and blame a
colleague who does not exist. Medium.** Four runs of two concurrent `PUT`s
from the same author: one 202, one 409 reading "another editor already has
changes open on this chart". The losing payload is never captured and never
applied, and which one wins is non-deterministic. The adversarial pass
recorded this attack as "Held: both folded into one request"; it does not
fold now. The unique-constraint loser is raised without an author argument
(`gate.py:486-489`) and the message falls back to "another editor"
(`exceptions.py:137`), although the caller's identity is known there.

**3. Every dataset change reports `columns` and `metrics` as changed.
Medium.** Read back from stored requests: a pure SQL rewrite reports
`changed_fields: ['columns','description','metrics','sql']` while the same
payload's `dataset_detail` shows `added:0 changed:0 removed:0` for both
lists — the payload contradicts itself. `_named_list_differs`
(`changes.py:186`) skips only `IGNORED_FIELDS` and `id`, so `uuid` is
compared; the stored payload is JSON and holds a `str` while the ORM row
holds a `uuid.UUID`, and the two never compare equal. The capture path is
unaffected because it compares the in-memory body, where `uuid` is still a
`UUID` — only the read-back is wrong. This is 129075 on the dataset
surface, the same shape as the `map_label_colors` defect fixed for
`json_metadata` and never applied to the named lists.

**4. A no-op chart-customizations save answers 422 with a database error.
Medium.** `PUT /api/v1/dashboard/6/chart_customizations` with an empty diff
returns 422, from `can't adapt type 'Subject'`. `_validate_once`
(`install.py:103-133`) validates ahead of the gate and shadows `validate`
on the instance, precisely because validating twice re-reads its own output
— its docstring says so. But `UpdateDashboardChartCustomizationsCommand.run`
calls `super().validate()` (`superset/commands/dashboard/update.py:356`),
which resolves on the class and ignores the instance shadow, so the second
pass hands already-resolved `Subject` objects back to the resolver.
`UpdateDashboardNativeFiltersCommand.run` (`:339`) has the same shape. No
change request is created either way, so nothing is lost; the author gets an
error instead of silence.

**5. Embedded configuration cannot complete on a default install. Medium.**
`can_set_embedded` on `Dashboard` is held by **Admin only** — Alpha and
Gamma hold `can_get_embedded` and `can_delete_embedded` and not the setter.
So the only accounts that may author an embedded change are exactly the
accounts SOW 9.3 forbids approving unless they are also editors of the
asset, and the approval is refused 409. Either an editor should be able to
author it, or an admin-authored one should be approvable. The refusal also
reads "no longer has edit access" to someone who never had it
(`lifecycle.py:313-316`).

Smaller, recorded rather than filed: a sole editor cannot delete their own
never-published dashboard, because `_gate_dashboard_delete`
(`bindings.py:701-702`) carries no published-history exemption while
`_gate_dashboard_update` (`bindings.py:307-321`) does; `lifecycle.py:270`
still documents the version check as skipped when absent, while the code
below it correctly fails closed.

## Second pass: the rows the first pass could not reach

Once the five testers were finished the instance was free, so the rows that
needed the browser or a different configuration were run rather than left.
All seven pass. The config was backed up by checksum, changed three times,
and restored byte-identical (`git status` clean).

**QA-12, fail closed. Pass, and emphatically.** Run for real: feature flag
on, `LOCAL_EXTENSIONS = []`, backend restarted. `PUT /api/v1/chart/2`,
`PUT /api/v1/dashboard/7`, `PUT /api/v1/dataset/1` and
`DELETE /api/v1/chart/2` each answer **503 `CHANGE_MANAGEMENT_UNENFORCED`**:
"Change management is enabled but no review gate is installed, so this write
cannot be reviewed and has been refused." Nothing applied on any of the
three assets. The guard is thorough enough to refuse
`POST /api/v1/security/login` as well, since that is a write — so an API
client in this state cannot even obtain a token. The original defect was
that this failed *open*.

**QA-23, flag off. Pass, both halves.** `change_request/enabled` returns
`false`, a governed chart write answers **200** and applies directly with no
request raised, and the Settings menu has no Approvals entry — checked
against the same menu with the flag on, where it sits under Manage.

**S-07, machine-account denylist. Pass, both halves.** With
`ASSET_APPROVAL_MACHINE_USER_ROLES = ["Alpha"]`, priya is an Alpha and drops
out: `eligible_approvers` comes back `[]`, submit is refused **422** "No one
else can approve this chart", her `can_approve` reads `false`, and her
approve is refused **403**. The list and the route agree, which is the half
that failed when S-07 was first filed.

**NEW-1, beforeunload after a captured save. Pass.** Edited dashboard 7's
title in edit mode and saved; the save was captured and the page left edit
mode. A cancelable `beforeunload` dispatched at the page came back
uncancelled, with a control event proving the probe cancels nothing itself,
and navigating away produced no dialog.

**NEW-3, a list row's tag after a capture from that row. Pass.** Renamed a
chart through its own row's properties dialog on the chart list: the row
gained its "Changes pending" tag with no reload, and kept showing the live
name. The dashboard list behaves the same.

**NEW-9, the Editors picker. Pass.** Typing "Morgan" into the picker finds
"Morgan Lee · morgan@example.invalid". The filter reads the label, not the
id.

**R5-02, the report banner. Pass, behaviourally rather than by source.** No
screenshot worker exists here, but report mode can be reached directly:
`/explore/?slice_id=2&standalone=3`, on a chart that *had* a change pending,
renders the chart alone — no banner, no notice strip, no review panel, no
chrome. That matters for this branch specifically, because
`ChartVersionNotice` and `ProposedChartPreview` are mounted outside the
report guard in the JSX and had only been argued safe by reading the code.
They are safe.

## Still not covered, and why

**QA-01, QA-06 and QA-08 cannot be executed by anyone right now, because
nobody can say what they claim.** Their text is in none of the QA documents,
none of the extension source, and no test. Three testers reached that
independently. The tracker was then opened and read end to end — story
SC-124561, its description, every comment and its whole activity log. It
links the eleven product-acceptance bugs and the Notion SOW and nothing
else: there is no attached sheet and no QA-nn row anywhere on it. The 45-row
tracker those ids belong to is held outside Shortcut. Until somebody pastes
those three rows, they should be recorded as unknown rather than as passing
or failing. **S-09** is a branch-target decision, read and reported rather
than tested.

**R5-05** and **129072** are open questions for Visa, not defects.

Everything the API testers said about rendered text was read off the payload
that feeds the component plus the component source. The browser covered the
chart preview, the dashboard review path, the two list surfaces, report mode
and the Settings menu.

## Environment

Every asset was returned to baseline through the product's own paths rather
than SQL: dashboard 7 "USA Births Names (Q4)" published with 10 charts,
dashboard 6 "Sales Dashboard", dashboard 10 "QA Unpublished Dashboard",
dataset 1 "bart_lines" with both editors and four columns, charts 1
"Deck.gl Grid", 2 "Deck.gl Hexagons" and 69 "Genders by State". Chart 69's
`params` were checked key by key against the blob recorded before the walk
and are identical.

Throwaway assets created during the run are soft-deleted, which is this
build's delete; the rows survive with `deleted_at` set and 404 from the API.
Dashboard 10 now carries a `published_assets` mark from QA-18a, and there is
no product path to remove it, so a later run expecting direct-apply on it
will see captures instead.

Two traps worth passing on. `editors` takes **subject** ids, not user ids:
sending `[2, 3]` returns 200 and silently binds the Public role and the
admin account, which leaves the asset without a second human editor and
turns every maker-checker case on it into a false failure. Four of the six
testers hit it. And an expired bearer token answers **404** on these routes
rather than 401, which reads as a missing asset.
