# Retest map: what tonight's two inversions invalidate

2026-11-05, against `fix/qa-regression-93` @ `804c5263b4`. Documentary and code
analysis only — nothing was run, no instance was touched, no product code was
changed. Three other sweeps are exercising the running system; this is the part
they cannot do.

## The number 93 cannot be substantiated from this repository

**"93 test cases from QA" has no source here.** The string `93` appears in this
tree exactly three ways: as part of the branch name `fix/qa-regression-93`, as a
line number in two citations (`test_approval_is_editorship_not_a_role.py:93`,
`SOW-RECONSTRUCTED-2026-11-03.md:51`), and as a byte count in an architecture
table. No document enumerates 93 of anything. No test enumerates 93 of anything.
The tracker that would hold them, Shortcut SC-124561, is not in this repo and
`REGRESSION-2026-11-03.md` records that it was read end to end — description,
every comment, the whole activity log — and carries **no QA-nn row at all**; the
45-row sheet those ids belong to is held outside Shortcut.

So the number is almost certainly a scenario count carried over from the branch
name, and the only scenario count this repo does record is a different one:
`RETEST-REQUEST.md` says *"We have not recomputed the **89** scenario figure,
since several scenarios map to one item"*, of QA's run 5. If the pattern held,
round 7 would have been cut at some similar figure and the branch was named for
it. **That is a guess.** What I can say without guessing is that 93 is not a
list anyone in this repository can hand you, and that a count of *scenarios* is
not a count of *cases* — the same document says so in as many words, which is
why the team's own rollups never used it.

Four numbers in this tree *are* substantiated, and they count different things:

| Number | What it actually counts | Source |
|---|---|---|
| **45** | rows of the external tracker SC-124561 | `CLOSURE-2026-11-02.md:40` ("every one of the 45 tracker rows"), and it reconciles exactly: QA-01…26 (26) + S-01…09 (9) + R2-01 + R3-01 + R4-01…08 (8) |
| **79** | the executable corpus — every row this epic has ever been judged on | `tests/unit_tests/change_management/test_every_qa_row_has_a_home.py`, `CORPUS` |
| **89** | scenarios in QA's run 5 | `RETEST-REQUEST.md:29` |
| **55** | defects *we* found and hold open, not QA cases | `FINAL-LIST-2026-11-04.md` |

## The authoritative inventory: 87 case ids

`test_every_qa_row_has_a_home.py` is the real answer to "what is the inventory",
and it is better than any of the prose documents because it is executable: it
holds a `CORPUS` tuple, a `NO_TEST_NAMES_IT` dict of exemptions with reasons, and
a test that fails if an exempted row later picks up a test. Its `CORPUS` is **79
ids**:

| Block | Ids | Count |
|---|---|---|
| Tracker SC-124561, QA rows | QA-01 … QA-26, plus QA-18a, QA-18b | 28 |
| Tracker, S rows | S-01 … S-09 | 9 |
| Tracker, earlier QA runs | R2-01, R3-01, R4-01 … R4-08, R5-01 … R5-05 | 15 |
| Found by walking the product, never filed | NEW-1 … NEW-12 | 12 |
| Elizabeth's product-acceptance set | 129068 … 129078 | 11 |
| Found while recording the demo (Samwise) | sc-131031 … sc-131034 | 4 |
| | **CORPUS total** | **79** |

To that must be added **round 7, which the corpus does not contain at all**. Its
`ROW` regex is `R[2-5]-\d+`, so `R7-nn` cannot match, and the `CORPUS` tuple
stops at R5. Round 7's eight issues are nonetheless real and are cited throughout
the source: R7-01 (= A5), R7-02 (= A12), R7-03, R7-04 (= B2), R7-05, R7-06
(= B3), R7-08. **R7-07 appears nowhere in this repository** — not in a document,
not in a comment, not in a test. It is the fourth id in this project's history
with no recoverable text.

**87 distinct case ids. That is the inventory.** 79 indexed and 8 not.

### What I could not find text for

- **R7-07.** Nothing. Round 7 is described as eight issues
  (`UNGATED-INVENTORY-2026-11-04.md`: "QA has found 8 new issues per round for
  three rounds") and seven of the eight are cited; this one is not.
- **QA-01, QA-06, QA-08.** Recovered on 2026-11-04 from this project's own
  session transcripts, not from the repo. `FINAL-LIST-2026-11-04.md` records
  what they are (a README mismatch; a fresh-checkout build failure; concurrent
  approvals both succeeding, QA's own id TC-E5) and that the tail of two titles
  and the Steps/Actual columns for QA-01 and QA-08 are still missing. Note that
  `NO_TEST_NAMES_IT` still exempts all three as "text exists only in the
  external tracker", which `FINAL-LIST` itself says is now false for QA-06 and
  QA-01 — so the index is carrying a known-stale exemption.
- **QA-09, QA-13, QA-18a, QA-18b, QA-26.** Each has a one-line characterisation
  somewhere (QA-09 = warn on a dependency rather than block, D-08; QA-13 = an
  MCP capture reads as success not error; QA-18a = the `published_assets` mark;
  QA-18b = what the approver sees at a first publish, D-18; QA-26 = embedded
  configuration) but no Steps/Expected text. They are classified below on that
  characterisation, which is thinner evidence than the rest.
- **The binding design artifact itself.** The two inversions cite "author
  screens 1b and 2, both tagged SOW V1" and quote three sentences from them.
  **That mock set is not in this repository.** `grep -r 'SOW V1'` returns
  nothing; so does `author screen`, `screen 1b`, `29 mock`, and the quoted line
  "with a link to the current version". The only places those words exist here
  are the two commit messages and one code comment they seeded
  (`dashboardState.ts:647`). I have classified cases against the inversions as
  the commits describe them, because the commits are the only account of the
  artifact available — but **nobody in this repo can check the inversions
  against the thing they are justified by.** That matters more than it sounds;
  see "The one thing worth stopping for".

### A second, separate inventory that is often confused with the first

`FINAL-LIST-2026-11-04.md` holds **55 defects** in classes A (17), B (9 — the
header says 8 and the table lists 9), C (21), D (4), E (5). These are *our*
findings about the gate, not QA cases, and only two of them are ours by
authorship. They cross-reference the case ids (A5 = R7-01, A12 = R7-02, B2 =
R7-04, B3 = R7-06) but they are a different list with a different purpose, and
adding 55 to 87 would double-count. Tonight's changes touch four of them, noted
below.

---

## What tonight changed

Eight commits, `961e5fa224` … `804c5263b4`. I label them T1–T8 and refer to
them by label throughout.

| | Commit | What it does | Reach |
|---|---|---|---|
| T1 | `961e5fa224` | `reverted_fields` reads `json_metadata.positions` as well as raw `position_json`, and names what moved the way the review panel does | backend, all asset types |
| T2 | `343ed5ccf5` | `submit` refuses a draft equal to live with 422, on the gate's own comparison | backend, all asset types |
| T3 | `98545dc9ac` | put the live dashboard back after a captured save | **superseded by T7 the same night** |
| T4 | `8e9ff233d2` | Request review waits for *its own* save before opening the dialog; a ref drops the whole second click of a double click | dashboard toolbar + banner |
| T5 | `444da55c50` | the review banner's message and controls sit in one wrapping row | banner, all surfaces |
| T6 | `dada26e039` | Edit on a change that is with a reviewer raises the withdraw confirmation from **both** the banner and the toolbar, and on success actually enters edit mode; `toggleEditMode` removed | dashboard header + banner |
| T7 | `9599190c36` | **Inversion 1.** A captured save no longer dispatches `setEditMode(false)`. New banner branch for edit mode: "Viewing your changes · saved %s · viewers still see the live version" | dashboard author |
| T8 | `804c5263b4` | **Inversion 2.** The author's own open change opens with Show changes ON; `apply` keeps the host's edit mode instead of forcing view mode; two optional chains in `SliceHeader` | dashboard author |

Two scope facts that decide most of the classification below, both verified in
source rather than assumed:

1. **T8 is dashboards only and authors only.** `AssetReview.tsx:239-241`:
   `if (assetType !== 'dashboard') return;` then
   `if (!isMyOpenChange || !canPreview || !changeRequest) return;`, with
   `isMyOpenChange = changeRequest?.is_open && changeRequest?.is_author`. Explore
   passes no `editing` prop at all
   (`ExploreViewContainer/index.tsx:1392`). So no chart case, no dataset case and
   no reviewer or viewer case can reach either inversion.
2. **Neither inversion reaches a report or a thumbnail.**
   `DashboardBuilder.tsx:1046` mounts `AssetReview` under `!isReport`, so the
   default-ON effect is not mounted in a capture. R5-02 is safe, and I checked
   this specifically because a PNG rendered as the author would otherwise have
   started shipping the draft layout to viewers.

Note that `is_open` covers `draft`, `pending` **and** `changes_requested`
(`types.py`, `OPEN_STATUSES`). The default-ON effect is therefore not limited to
unsubmitted drafts: an author whose change is sitting in a reviewer's queue also
now opens on their own proposal.

---

## STALE — the cases that assert the old behaviour

**Eight cases.** These will now "fail", correctly. QA will file every one of them
as a new defect unless this section reaches them first. For each I give the exact
sentence that is now wrong and what it should say.

### QA-19 — the headline

The case: *"The author's banner says 'Viewing your changes' but the dashboard
shows the live version."* Fixed on 2026-11-02 by making the banner say live.
Tonight reverses which side rests on screen, so the banner's old sentence is the
one that is now false.

> **Now wrong** (`REGRESSION-2026-11-02.md`, QA-19 row): "Banner reads 'Awaiting
> review · waiting a minute · Priya Shah can approve' **with the live title on
> screen**. Show changes switches the header to 'USA Births Names (Q4)' and
> back."

> **Should say:** the author's own open change — in any of the three open
> statuses — opens with **Show changes already on**, the proposed title in the
> header, and the banner reading "Viewing your changes". Turning the switch
> *off* shows the live title and "you and viewers are both seeing the live
> version". The pair is the same; the resting side is reversed.

Pinned, and the pin is now a failing pin:
`superset-frontend/playwright/tests/asset-approval/dashboard-capture.spec.ts`,
"row 8 [NEW-2 / QA-19]". It asserts, in this order,
`expect(banner).toContainText('you and viewers are both seeing the live
version')` and `expect(author.locator(TITLE_INPUT)).toHaveValue(liveTitle)`.
Both fail. It then clicks `showChangesSwitch`, which **after a captured save no
longer exists**: `AssetReview.tsx:529` withholds the `showChanges` prop entirely
while `editing` is true, and T7 leaves the author in edit mode. So the test
fails at its first assertion and could not complete if it got past it.

`ReviewBanner.test.tsx` also names QA-19, but as a props-level unit test it still
passes — it passes `showing: false` explicitly. It is worth knowing that this
file's own `@fileoverview` opens *"SOW 5.5: an author with an unsubmitted draft
sees the live asset until they turn Show changes on"*, which is the doctrine
tonight inverted, and `SOW-RECONSTRUCTED-2026-11-03.md` cites this exact line as
the repo's record of clause 5.5.

### NEW-2 — the header

The case: *"After a captured dashboard save the header and browser tab keep
showing the proposed title while the banner on the same screen says 'you and
viewers are both seeing the live version'."*

> **Now wrong:** the fix's assertion, "the header shows the live title after a
> captured save". The header now legitimately shows the proposed title.

> **Should say:** the header and the banner must **agree**. They do: the header
> carries the proposal and the banner says "Viewing your changes". NEW-2's
> substance survives as a consistency claim; only its direction is stale.

The guard that made it true is still in place and still correct —
`showLiveTitle` (`DashboardBuilder.tsx:670`) returns early in edit mode, and
`AssetReview.tsx:204` only reports the live title `!previewing`, so nothing
fights the preview for the header. Same failing pin as QA-19, row 8.

### R4-07 and 129074 — "Request review appears on the first save"

R4-07: *"After the author's first save in edit mode, no draft banner or Request
review until reload."* 129074 is the same claim from Elizabeth's set.

> **Now wrong** (`REGRESSION-2026-11-02.md`, R4-07): "The banner, **Show
> changes**, **What changed** and **Request review** all appear immediately on
> the first save."

> **Now wrong** (`PA-RETEST-2026-11-03.md`, 129074): "the banner reads 'Your
> changes are saved … you and viewers are both seeing the live version' … and
> both **Request review** and What changed are offered."

> **Should say:** after a save *from the edit toolbar* the author stays in edit
> mode, and in that state the banner offers **What changed only**. Request
> review is in the toolbar, where T7's cited mock puts it ("Request review stays
> available. You don't have to leave edit mode to send it"). Show changes is
> withheld in edit mode by design. After a save *from the Properties dialog*,
> which does not enter edit mode, the banner still offers the full set — so this
> case now has two different right answers depending on which button saved.

This is the one I would most expect to be filed as a regression, because the
button genuinely disappears from the place the case says to look. The mechanism
is `ReviewBanner.tsx`: the new `editing` branch sits inside the *draft +
isAuthor* block and returns `actions: [whatChanged]`, where the branch below it
returns `[whatChanged, Request review, Discard]`. Nothing in the commit message
mentions losing Discard from the banner; see the coverage gaps.

Pinned by `superset-frontend/src/dashboard/actions/dashboardState.reviewCapture.test.ts`,
which names R4-07 and QA-14 — and whose assertion was **inverted tonight** from
`expect(types).toContain('SET_EDIT_MODE')` to
`expect(types).not.toContain('SET_EDIT_MODE')`. The pin still exists and still
passes; it now pins the opposite fact.

### QA-14 — the revise-after-review loop

The case: *priya requests changes, alex saves a fix: the banner switches and
Request review appears with no reload.*

> **Now wrong:** "Request review appears" in the banner. For
> `changes_requested` + author the banner has always returned
> `actions: [whatChanged]`, so the button the 2026-11-02 walk saw was the
> toolbar's; but with T7 the author now also stays in edit mode after the fixing
> save, which is a different end state from the one the walk recorded.

> **Should say:** the banner switches out of the "changes requested" wording and
> Request review is available **in the toolbar**, with no reload, while the
> author remains in edit mode on their own changes.

This is the journey `DESIGN-editing-a-change-that-is-already-in-review.md`
correction 1 calls "the one journey this feature exists to support, and the least
protected", so it deserves a hand re-walk rather than a desk reclassification.

### R4-01 — the reachability note is now false, and the case is live again

The case: *saving a draft field back to its live value is ignored and the draft
keeps the old proposal.* It passes. What is stale is the note beside it.

> **Now wrong** (`REGRESSION-2026-11-02.md`, R4-01): "*Not reachable from the
> dashboard UI any more*: with the header showing the live title (NEW-2), the
> editor opens on live, so typing live in is a no-op and Save stays disabled."

> **Should say:** reachable again. The editor now opens on the **draft**, so the
> author can type the live value in, Save is enabled, and `gate_write`'s
> `_drop_a_fully_reverted_draft` path fires from the dashboard UI for the first
> time since NEW-2 landed. T2 adds a second refusal on the same shape at submit
> time (422, `NothingToReviewError`).

Nobody has walked `_drop_a_fully_reverted_draft` from the dashboard editor. It
is worth doing deliberately rather than discovering it: the 2026-11-03 run found
that this function had no status guard and destroyed *submitted* requests, and
the fix was a status check — which is now reachable from a route it was never
reachable from.

### NEW-1 — one assertion stale, the substance at risk

The case: *a captured dashboard save left the page `beforeunload`-dirty.*
`setUnsavedChanges(false)` is untouched by T7, so the substance should hold.

> **Now wrong:** the live-title assertion it passes through on the way —
> `dashboard-capture.spec.ts` row 9, `expect(author.locator(TITLE_INPUT))
> .toHaveValue(liveTitle)`. Same stale fact as rows 8.

> **At risk, not stale:** the test proves cleanliness by navigating away and
> asserting no dialog. The author is now *in edit mode* when it navigates, which
> is a different exit path from the view-mode one the test was written against.
> Re-run it; do not assume it.

### E4 (and its browser twin, `REGRESSION-2026-11-04` B5) — the two Request review buttons

The case: *in dashboard edit mode the toolbar's Request review is disabled with
"No changes to review yet" while the banner's identical button is enabled and a
draft is open.*

> **Now wrong:** the state is unreachable. In edit mode the banner has no
> Request review button at all, so two buttons cannot disagree.

> **Should say:** closed by removal, not by repair. The toolbar's
> disabled-with-"No changes to review yet" logic is unchanged, so if that
> tooltip was ever wrong it is still wrong — there is simply no longer a second
> button on screen to contradict it. If E4 is closed on this basis, say so on
> the row, or the next person to add a banner action re-opens it without
> knowing.

---

## AT RISK — a human should re-run these

| Case | Which change, and why |
|---|---|
| **R7-06** | T1 + T7 + T8 are aimed squarely at it. This is the case tonight claims to cure, so it is the one that must be re-run rather than reasoned about. The cause (the edit canvas seeded from live) is addressed by T8; the author no longer re-enters edit mode (T7); and the loss is now named rather than silent (T1). The commit claims `reverted_fields` is empty on the journey that produced "This save undid 5 layout changes". Verify on a dashboard draft holding a removed chart, a removed column, a removed row and a renamed tab — the exact shape T1's test uses. |
| **QA-21** | T8. The tag is per-chart, but the canvas the author now sees is the **draft's** layout. If the draft removed or moved the tagged chart, the card the case looks for is somewhere else or absent. The case's second half ("exactly one tag is on the page") is the part most likely to move. |
| **QA-11** | T1. The case quotes an exact string — "**Changes updated in your existing draft.** Review changes →". T1 can now append a put-back sentence to it ("This save put back 1 setting your draft had changed: dashboard_title.", as the break log shows), so a literal string match fails while the behaviour is right. |
| **QA-20** | T4. The dialog's content ("Who can approve: Priya Shah") is untouched, but the dialog now opens **after** the save it belongs to rather than immediately, keyed on `announceRequestReview({ savingFirst })`. If the save is slow or fails, the timing of what the case asserts changes. |
| **QA-22** | T5 rewrote 122 lines of `ReviewBanner.tsx` rendering. The specific thing QA-22 cares about is intact — `ReviewBanner.tsx:449` still carries "No `target`" with the SOW 5.3 reasoning — but the actions are now rendered through a wrapping row, so the link's own markup should be eyeballed once. Low risk, cheap to check. |
| **R4-02** | T7. The discard dialog's copy is untouched; the route to it is not. In edit mode after a save the banner no longer offers Discard, so the only way to the dialog is the ⋯ menu. The banner's Discard was added *because* "two testers opened a stale draft they did not recognise, looked for a discard, found none, and carried on editing on top of it" (`ReviewBanner.tsx` comment) — which is the failure mode T7 has just reinstated for the edit-mode author. |
| **NEW-5** | T8. The case's observation was "entering edit mode and pressing Save with nothing changed is not even possible: Save is disabled, tooltip 'Nothing new to save'". That was measured against a live-seeded canvas. The canvas is now draft-seeded, and `enterEditMode` still calls `setUnsavedChanges(false)`, so it *should* hold — but the thing being compared has changed and the case is cheap to re-run. |
| **129078** | T6. The case is about an ordinary save folding into a *submitted* delete. Pressing Edit on a pending change now withdraws first, so the author's save lands on a `draft` rather than a `pending` — which changes which of `left_review` / `replaced_delete` the server reports and therefore which sentence the author reads. |
| **R7-03** | T6. R7-03 is "the dashboard can still be edited after Request to publish". T6 routes Edit on any pending change of one's own through a withdrawal confirmation, and the publish request is such a change. The backend guard (`bindings.py:1137`, `lifecycle.py:179`) is untouched, so the hold still holds; what changed is whether the author is asked first. |
| **QA-05** | T6. A captured delete sits as a Draft with a Request review action. Draft is an open status, so the author's Edit on that asset now routes through `handleEnterEditMode`'s new branch — which checks `isAwaitingReview` (pending only), so a draft delete should fall through to `enterEditMode` unchanged. Listed because it is one `if` away from being affected, not because I think it is. |

---

## UNAFFECTED

Tonight's changes cannot reach these. Where a test pins the case, the test file
is named — that is the evidence it cannot silently regress.

**Backend gate, capture, replay, eligibility (no file tonight touched these
paths):**

| Case | Why out of reach | Pinned by |
|---|---|---|
| QA-02 | legacy dataset route | `test_the_legacy_chart_save_is_gated.py` (class), `NO_TEST_NAMES_IT` browser-exempt |
| QA-03 | archive dialog copy | `test_delete_replaces_edit.py` |
| QA-04 | filter 409 surfacing | browser-exempt in the index |
| QA-07 | author loses editorship | `test_author_editorship.py` |
| QA-08 / QA-09 | concurrency and dependency warning | `test_every_transition_takes_the_lock.py`, `test_pending_dependency.py` |
| QA-10 | refusal wording | `test_a_refusal_names_what_was_refused.py` |
| QA-12 | fail-closed with no gate installed | `test_fail_closed.py` |
| QA-13 | MCP capture reads as success | `test_mcp_renders_a_capture_as_success.py` |
| QA-15 | what the panel names vs what the gate counted | `test_the_panel_names_what_the_gate_counted.py`, `test_a_chart_save_names_what_moved.py` |
| QA-16 | approval in version history | `test_approval_in_version_history.py`, `test_replay_attribution.py` |
| QA-17 | archive is captured not applied | `test_unarchive_and_baseline.py` |
| QA-18 / 18a | never-published exemption, publish mark | `test_publish_exemption.py`, `test_publish_mark_is_durable.py` |
| QA-18b | no signal exists to assert | index-exempt, with the reason |
| QA-23 | flag off | `test_the_off_switch_restores_the_old_behaviour.py` |
| QA-24 | stale baseline refusal | `test_unarchive_and_baseline.py` |
| QA-25 | dataset description exempt | `test_certification_is_exempt.py` (family) |
| QA-26 | embedded configuration | `test_embedded_allowed_domains_are_described.py`, `test_embedded_replay_atomicity.py` |
| S-01 | FAB route rebinding | `test_route_rebinding.py`, `test_the_legacy_chart_save_is_gated.py` |
| S-02 | MCP write paths | `test_mcp_write_paths.py` |
| S-03 | exempt change during review | browser-exempt in the index |
| S-04 | column resync exemption | `test_a_column_resync_is_exempt.py`, `test_dataset_refresh.py` |
| S-08 | viewer sees no workflow UI | `test_a_viewer_cannot_act_on_a_change.py`. Also structurally out of reach: T8 requires `is_author` |
| R2-01 | approval is recorded | `test_approval_is_recorded.py` |
| R3-01 | restore is reviewable | `test_restore_request_is_actionable.py`, `test_a_restore_is_visible_to_its_author.py` |
| R4-03 | chart-with-a-change warning on approve | `test_pending_dependency.py` |
| R4-04 | refusal surfaced on Approvals | `api.refusal.test.ts` |
| R4-05 | column and metric labels | `test_a_column_or_metric_field_outside_the_old_list_is_compared.py`, `test_a_metric_delete_names_the_metrics_not_their_ids.py` |
| R4-06 | certification exemption | `test_certification_is_exempt.py` |
| R4-08 | empty filter save | `test_an_empty_filter_save_is_not_a_change.py` |
| R5-01 | title-only save and cross-filter scopes | `test_a_title_save_does_not_report_the_cross_filter_scopes.py` |
| R5-02 | report/thumbnail capture | `DashboardBuilder.test.tsx:396`, `playwright/.../report-and-viewer.spec.ts`. Verified out of reach: `!isReport` guards the mount |
| R5-03 | import identity | `test_an_import_cannot_slip_past_on_a_new_uuid.py`, `test_import_refusal.py` |
| R5-04 | Approvals pagination | `test_the_approvals_list_is_paged.py` |
| R7-05 | a save during an approval | `test_a_save_landing_during_an_approval_cannot_reopen_the_approved_request.py` |
| R7-08 | viewer's empty Home section | `PendingReviews.test.tsx` |
| NEW-3 / NEW-11 | list-row tags | `playwright/.../list-row-capture.spec.ts`, `dashboard-chart-tags.spec.ts` |
| NEW-4 | dataset save reads as columns+metrics | `test_an_empty_field_is_not_an_edit.py`, `test_a_dataset_setting_is_not_a_column.py` |
| NEW-6 | anonymous role is not an approver | `test_the_anonymous_role_is_not_an_approver.py` |
| NEW-7 | not a bug | — |
| NEW-8 | `""` vs `None` baseline | `test_an_empty_field_is_not_an_edit.py` |
| NEW-9 / NEW-10 | editors picker, approver availability | `playwright/.../editors-and-approvers.spec.ts` |
| NEW-12 | restore reachable | `test_captured_copy_is_reachable.py` |
| 129068–129073, 129075–129077 | legacy routes, version check, replay, exemptions, display, empty change, publish toggle | `test_the_legacy_chart_save_is_gated.py`, `test_approving_names_the_version_reviewed.py`, `test_what_the_gate_captures_covers_what_the_apply_writes.py`, `test_a_dashboard_save_that_changes_nothing.py`, and the display family. 129076 is *strengthened* by T2, which adds the same refusal at submit time |
| sc-131031 | permissions created at install | `test_review_works_without_rerunning_init.py` |
| sc-131032 | the chart banner's wording | `ReviewBanner.test.tsx` ("where there is no preview at all"). Structurally out of reach: Explore passes no `editing` and T8 returns early for `assetType !== 'dashboard'` |
| sc-131033 | returned changes in the view the page opens on | `test_a_returned_change_needs_its_author.py`, `PendingReviews.test.tsx` |
| sc-131034 | settings page wording | `test_the_settings_page_is_not_the_inbox.py` |

**Decisions and open questions, not behaviour** — nothing could reach them
because there is nothing to run: S-05 (which roles may approve, D-01), S-06 (the
§5.1 import disposition, D-02), S-07 (machine-account role names, D-03 — pinned
behaviourally by `test_machine_users_are_not_approvers.py`), S-09 (branch target,
D-04), R5-05 (the approver-roles clause), 129072 (imports, SOW 5.1 / Visa Q12).

**Environment and documentation:** QA-01, QA-06.

---

## ALREADY OPEN

Failing before tonight and still failing. None is touched by any of T1–T8.

- **R7-01** (= A5): `POST /api/v1/chart/` with `dashboards:[…]` writes the join
  row unreviewed, even while an open change request exists on that dashboard.
  Reproduced live.
- **R7-02** (= A12): MCP `delete_dataset_metric` — the empty body means no diff,
  so the delete reaches viewers unreviewed *and* the author's unrelated open
  draft is discarded. Both halves confirmed.
- **R7-04** (= B2): MCP `create_dataset_metric` — `preserve_existing_metrics` is
  not captured, so approving returns 200 and destroys the dataset's other
  metrics.
- Classes A, B, C, D of `FINAL-LIST-2026-11-04.md` generally: 17 escapes, 9
  wrong-thing-applied, 21 blind-approval display failures, 4 structural. Tonight
  touches four of them and no others — see the next section.

---

## The eight round-7 issues

| Id | What it is | Tonight |
|---|---|---|
| R7-01 | `POST /api/v1/chart/` with `dashboards:[…]` escapes review (A5) | not touched. ALREADY OPEN |
| R7-02 | MCP `delete_dataset_metric` escapes and discards a draft (A12) | not touched. ALREADY OPEN |
| R7-03 | a dashboard can still be edited after "Request to publish" | **touched by T6.** The hold is unchanged; what changed is that Edit now asks to withdraw first, from the toolbar as well as the banner. AT RISK |
| R7-04 | `preserve_existing_metrics` dropped at replay (B2) | not touched. ALREADY OPEN |
| R7-05 | a save landing during an approval reopens the approved request | not touched. Pinned by `test_a_save_landing_during_an_approval_cannot_reopen_the_approved_request.py` |
| R7-06 | a partial save replaces the draft (B3 / `fold_fields`) | **the whole point of tonight.** T8 fixes the cause for the dashboard editor, T7 removes the re-entry that made it destructive, T1 makes any residual loss visible. AT RISK — re-run it |
| R7-07 | **no text anywhere in this repository** | cannot be classified |
| R7-08 | a viewer saw an empty review section on Home | not touched. Pinned by `PendingReviews.test.tsx` |

So tonight touches **three of the eight**: R7-03 and R7-06 directly, and R7-06
is the one the branch exists for. A fourth, R7-07, cannot be assessed at all.

One correction worth carrying forward, which predates tonight:
`FINAL-LIST-2026-11-04.md` B3 and `UNGATED-INVENTORY-2026-11-04.md` B3 both say
"`fold_fields` missing on the dataset and dashboard gates … open on two of three
asset types". **That is now stale.** All four gates carry it:
`_gate_dashboard_update` via the `_keep_the_layout_the_draft_holds` refine
(`bindings.py:561`), `_gate_legacy_slice_save` (`:759`), `_gate_chart_update`
(`:1198`) and `_gate_dataset_update` (`:1231`). It landed in `b43daffcb1` on
11-04, after `FINAL-LIST` was written. Dashboards remain the hard case because
the edit-toolbar body *does* state a layout, so the refine steps aside — which
is exactly what T8 attacks from the other end.

## Samwise's findings

Samwise is the external QA engineer who tested the demo recording;
`REPLY-SAMWISE-2026-11-03.txt` answers **five** findings, four fixed and one
partial: sc-131031, sc-131032, sc-131033, sc-131034, and sc-129075 (partly).
`sc-129075` is Elizabeth's ticket that Samwise re-opened, which is why it
appears in both sets.

**Tonight touches one of the five, and only in the sense of not breaking it.**

- **sc-131032** — "the banner was saying 'Viewing your changes' on a chart where
  the preview is dashboard-only, so there was nothing on screen to view". This is
  the *same sentence* tonight re-introduces, in the one state where it is true.
  I checked this deliberately because it is the obvious way to undo Samwise's
  fix, and it holds: the new branch requires `editing`, which Explore never
  passes, and T8's effect returns early for any non-dashboard asset. The chart
  banner still says the live version is on screen. `ReviewBanner.test.tsx`'s
  "where there is no preview at all" test pins it, and it names sc-131032.
- sc-131031, sc-131033, sc-131034 — not reached by any file tonight touched.
- sc-129075 (reviewers cannot see what changed) — not reached. Its open
  remainder is the C class: no chart preview, "and N more" with no expand, raw
  control names, no before/after inside `params`.

What tonight does *not* do for Samwise's territory: the chart half of the same
inversion is untouched. `REGRESSION-2026-11-04.md` B4 — "Explore reopens on the
live chart after a held save … the author's draft values are not restored into
the controls" — is the chart-shaped twin of the defect T8 just fixed for
dashboards, and it is still open. `DEFECT-the-preview-never-reads-the-draft`
names it as one of its three symptoms.

---

## Is anything tonight not covered by a test?

Yes. Four gaps, in descending order of how easily a future change could undo the
work without anyone noticing.

**1. The default-ON flip has no test at all.** T8's only test change is
`AssetReview.liveTitle.test.tsx`, and it is not an assertion — it widens a mock
so the component stops crashing now that `toggle` is reached:

```
-  mockPreview.mockReturnValue({ canPreview: true, showing: false });
+  mockPreview.mockReturnValue({ canPreview: true, showing: false, busy: false, toggle: jest.fn() });
```

Nothing asserts that `previewToggle(true)` is called for an author's own open
change, that it is called **once per request id** (the `defaultedForRef` logic),
that it is **not** called for a reviewer, another editor, a viewer, a chart, or a
dataset, and that an author who deliberately switches to live is left alone.
Every one of those is a stated intent in the code comment and none is pinned. A
future change that reverts the default — which the repo's own record arguably
asks for; see below — would turn no test red.

**2. The new edit-mode banner sentence has no test.** `ReviewBanner.test.tsx`
was updated by T5 (the wrap), two commits *before* T7 added the `editing` prop,
and never passes `editing`. So "Viewing your changes · saved %s · viewers still
see the live version" is unasserted, and — more importantly — so is the fact that
this branch returns **only** What changed. That omission is not mentioned in any
commit message. It is the mechanism behind three of the eight STALE cases above
and behind R4-02's regression risk, and the next person to add a banner action
has nothing telling them these two actions were deliberately dropped. **This is
the gap I would close first**, because it is the one where the current behaviour
may well be a bug rather than a decision.

**3. The `SliceHeader` guards have no test.** T8's two optional chains at
`SliceHeader/index.tsx:218` and `:222` are described in the design doc as "the
thing that makes the right fix landable" — the crash that got draft-seeding
reverted twice. Every one of `SliceHeader.test.tsx`'s seven `charts:` fixtures
supplies `[props.slice.slice_id]`, so none exercises a tile whose chart entry is
absent. A refactor that drops a `?.` restores a white-page crash, and the suite
stays green.

**4. Net test removal.** T3 added
`useProposedPreview.restoreLive.test.tsx` (164 lines) and T7 deleted it, along
with 28 lines of `AssetReview.requestDialog.test.tsx` ("a captured save puts the
live asset back on the dashboard page", "a captured save does not try to
rehydrate a chart page"). Deleting them is right — they pinned the behaviour
being inverted. But nothing was added in their place for the inverse, so the
night's net effect on this area is fewer pins than it started with.

What *is* well covered: T1 by
`tests/unit_tests/change_management/test_a_save_that_puts_a_layout_back_says_so.py`
(426 lines) and `test_a_layout_change_names_the_chart_that_moved.py`; T2 by
`test_a_draft_that_matches_the_live_chart_cannot_be_sent_for_review.py` (277
lines); T4 by `AssetReview.requestDialog.test.tsx` (161 lines, new); T5 by
`ReviewBanner.test.tsx` (+85); T6 by `AssetReview.editWhileInReview.test.tsx`
(161 lines, new). The two backend commits and the three smaller frontend ones are
pinned properly. **It is the two inversions — the whole reason tonight happened —
that are the unpinned ones.**

A fifth, smaller gap: `test_every_qa_row_has_a_home.py` cannot see round 7. Its
`ROW` regex is `R[2-5]-\d+` and its `CORPUS` stops at R5, so a test naming
`R7-06` claims nothing and an R7 row with no test is not reported as an orphan.
Two R7 rows already have dedicated test files that the index does not count. If
the index is meant to be the inventory — and it is the best one here — round 7
belongs in it.

---

## The one thing worth stopping for

Tonight's two inversions reverse a decision this repository records as signed,
and justify the reversal with an artifact this repository does not contain.

`DECISIONS-2026-11-02.md`, D-05, titled *"QA-19 and NEW-2: an author with a
pending change sees the live version"*:

> **Decided: you see the live version, and the banner says so.** […] The
> alternative and why not. Defaulting the author's view to their own pending
> version would mean hydrating the entire dashboard from the proposed payload on
> every open. It is the riskiest frontend change on the list […] Against that,
> the current behaviour has a property worth keeping: the author and the viewer
> see the same thing unless the author asks otherwise, which makes "has this gone
> live yet" answerable by looking.
>
> **A control reviewer's view.** Favourable. Showing the author the live version
> by default means nobody mistakes an unapproved change for a published one.
>
> **Signed by:** PM. […] **If undecided:** record only. Keep the alternative on
> the V2 list as a usability item, not a correctness one.

`CLOSURE-2026-11-02.md` §2.2 then lists *"Defaulting the author's view to their
own pending version instead of the live version"* under **"Explicitly V2, item by
item"**, sourced to D-05 — in the section whose stated purpose is that none of it
"can resurface as a surprise".

`SOW-RECONSTRUCTED-2026-11-03.md` records clause **5.5** as *"An author with an
unsubmitted draft sees the live asset until they turn Show changes on"*, cited to
`ReviewBanner.test.tsx:21`.

And `DESIGN-editing-a-change-that-is-already-in-review.md` §11, written
2026-11-05 against `dada26e039` — i.e. after T6 and before T7 and T8 — lists as
the **first** thing needing a decision before anyone writes code:

> **The SOW 5.5 addendum** (section 4). Does "the author sees the live asset"
> govern an edit session on their own open change? C needs a written answer,
> signed the way D-05 was.

T7 and T8 are option C. They were written the same night, by the same author, and
they do not cite that written answer. They cite "author screens 1b and 2, both
tagged SOW V1" and quote three sentences from them — and **that mock set is not
in this repository.** Nor is the signed SOW: `SOW-RECONSTRUCTED` opens by saying
so, and §0 of the design doc is itself a list of nine places the brief and the
code disagreed.

I am not saying the inversions are wrong. The lost-edit mechanism T7 and T8
address is real, measured, and reproduced five times in `qa/logs/` — and
`break-save-overwrites-draft.md` is as clean a case for option C as anyone could
want. The design doc's own recommendation is "Ship C". What I am saying is
narrower and checkable:

**The repository's written record says the opposite of what tonight shipped, the
document that proposed shipping it said a signed answer was needed first, and the
artifact cited in place of that answer is not here.** Three people on this project
have now reached for the SOW and found only a reconstruction. If the 29 mock
screens exist and say what the commits say they say, they should be in
`qa/mockups/` beside the two hand-drawn ones — which, note, carry watermarks and
a written prohibition on being used as evidence precisely because this project
has a rule about forged UI. If they do not exist, then D-05 still stands and two
commits have quietly overturned it.

Everything else in this document is a retest instruction. This one is a question
for whoever owns the decision, and it should be answered before QA is asked to
re-run anything, because the answer determines whether the eight STALE cases
above get rewritten or reverted.

---

## Where I am guessing

Stated as guesses, not findings.

- **That 93 is a round-7 scenario count** by analogy with run 5's 89. The
  analogy is all I have; the branch name is the only occurrence.
- **That R7-07 exists.** I infer it from "8 new issues per round" and the seven
  cited ids. It is equally possible round 7 numbered its issues non-contiguously.
- **That the two reverted draft-seeding attempts are what T8 now supersedes.** I
  take this from the commit messages and from §12 of the design doc, which says
  the same thing as a guess ("the diffs are not in this branch"). I did not find
  them in `git log --all` either.
- **QA-09, QA-13, QA-18a, QA-18b and QA-26** are classified on one-line
  characterisations, not on case text. If any of them has Steps that touch the
  dashboard author's view, my UNAFFECTED call on it is wrong.
- **R4-02's and NEW-5's classifications** rest on reading `enterEditMode` and
  the banner's action lists, not on running them.
- **That a re-hydration while the author is in edit mode leaves the undo stack
  consistent.** T8 lets `apply` keep `editMode: hostEditMode(...)`, and
  `enterEditMode` is the only place that calls `clearDashboardHistory()`. So a
  preview toggle that hydrates a new layout under an author who is already
  editing does not clear history. I have not traced whether the layout reducer's
  undo stack can then reference components the new layout does not have. If it
  can, that is a new defect and it is in tonight's code. **Worth 20 minutes from
  someone who knows that reducer** — I could not settle it from reading.
- **Which path 129074 was originally walked on.** `PA-RETEST` says "Edited the
  dashboard title through Edit properties and saved", which is why I split the
  case into a properties-dialog half that holds and a toolbar half that does not.
  If the walk actually used the edit toolbar, the whole case is stale rather than
  half of it.
