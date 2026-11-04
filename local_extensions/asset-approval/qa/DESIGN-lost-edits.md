<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# Design: lost edits, the reviewer's note, and the two sc-129075 leftovers

Branch `fix/qa-regression-93`, written 2026-11-04 against `1653dea651`.
Design only. Nothing in `superset/`, `superset-frontend/src/` or
`backend/` was touched.

**Evidence standard.** The instance at `localhost:9002` was down (Docker
daemon), so everything below is from source, tests and the QA history. Where
a claim needs a live response it is in section 8 as an open question, not
stated as fact. Section 9 starts with a baseline run that settles the
largest of them before any code is written.

## 0. Verdict in ten lines

1. Your hypothesis is **right about Explore's full-state `params`** and
   **incomplete about the gate**. The gate also loses work with no browser
   involved: partial-body saves (the chart Properties dialog, REST, MCP)
   replace the draft's other fields, and R4-01's "fully reverted" test
   judges the *body* instead of the *draft*, so a partial save whose fields
   all equal live can discard a draft carrying other edits. Two causes, not
   one.
2. The fix is a **rule**, not a patch: *an editing surface starts from what
   the author has already proposed, and a fold of two writes must equal
   applying them in order.* Browser hydration satisfies the first for
   full-state bodies; a field-level fold satisfies the second for partial
   ones. Neither alone is enough.
3. Merging **inside** `params` is rejected, but not for the reason given
   (see 1.3). The sharp failures are different and worse.
4. `combine=combine_key_values` must **not** be the chart fix. Passing
   `combine` switches off the gate's empty-change test, baseline recording
   and R4-01 (`gate_write`: `comparable = ... and combine is None`).
5. Doing this reopens **D-05** (author sees live by default) for exactly two
   surfaces: Explore, where the canvas *is* the editor, and the dashboard's
   *edit mode*. The dashboard at rest stays live. This needs a PM yes/no
   (section 3.6). If it is a no, section 3.7 is the fallback.
6. **The dashboard has the same exposure, by three separate routes** (4).
   Do not tell QA this is chart-only.
7. sc-131033 is a ~15 line frontend change keyed on `status`, not on the
   presence of a note, because `review_note` is not cleared on submit or
   approve (5).
8. sc-129075: neither leftover is copy. The dataset one is a logic gap
   (the dialog has no place to show any field other than SQL, columns and
   metrics) plus a bug already fixed in `17b3b5d138` that QA's build
   predates. The chart-names one cannot be settled by reading and needs one
   dump from QA's request (6).
9. Safe to ship now: the Approvals note, the dataset Settings rows, and the
   diagnostics. Needs the full re-walk: everything that touches Explore
   hydration, `ReviewBanner` and `ChartVersionNotice` (10).
10. Two fold sites exist, not one (`gate_write` and `_lost_the_slot`). A fix
    on the one a unit test calls and not the one a double-click reaches is
    this epic's failure mode in miniature (3.2).

## 1. What I verified, and what the brief got wrong

### 1.1 Where Explore actually reads from

`superset/views/core.py:143` is the legacy `/slice/<id>/` redirect. It calls
`get_form_data(slice_id, use_slice_data=True)` only to check the chart
exists and then redirects. It does not seed the SPA.

The path the product uses is `GET api/v1/explore/`
(`superset/explore/api.py`) -> `GetExploreCommand.run`
(`superset/commands/explore/get.py:156`), which calls the same
`get_form_data(..., use_slice_data=True, initial_form_data=...)`.
`get_form_data` (`superset/views/utils.py:395-400`) does
`slice_form_data.update(form_data)`, so a cached `form_data_key` entry
**overrides** the slice. That is also why `reloadOnTheApprovedChart` exists.
Same conclusion as yours, different file, and it matters because the second
file is the one a test must exercise.

The SPA calls it from `loadExploreData` in
`superset-frontend/src/pages/Chart/index.tsx`, on mount and again after any
history entry carrying `saveAction`. `SaveModal.saveOrOverwrite` ends with
`history.replace('/explore/?...', {saveAction})` after
`createRedirectParams` has deleted `form_data_key`, so **a held save always
ends in a refetch of the live slice**. That is the whole of sc-131032's
second half and of the new High.

### 1.2 The chain that loses the edit, step by step

1. Held save returns 202; `updateSlice` (`saveModalActions.ts`) announces the
   capture and returns `review_required`.
2. `SaveModal` redirects to `?slice_id=N&save_action=overwrite`; `ExplorePage`
   refetches and `hydrateExplore` replaces the author's controls with live.
3. The author changes one more control. `updateSlice` posts **every**
   control (`getSlicePayload`: `params: JSON.stringify(formData)`,
   `query_context`, `slice_name`, `viz_type`, `datasource_*`).
4. `bindings._gate_chart_update` -> `gate_write` -> `_update_own_request`
   replaces the stored payload. The body *does* say "the chart should be
   exactly this", so the gate is doing what it was built to do. **For this
   body, I agree the gate is correct.**

### 1.3 Why merging inside `params` is wrong (a sharper reason than yours)

Your objection was that a merge "would resurrect deleted settings". That is
not the failure, and a reviewer could knock it down: a plain
`{**draft, **new}` over `params` does not resurrect anything. Explore posts a
value for every key, so `new` overwrites every key and the result **equals
`new`**. A naive merge is a replace. The edit is still lost.

The merge that would work is a three-way one: keys where the new body
differs from live are "touched", the rest keep the draft's value. That fails
for three reasons, each worth naming:

- **(a) The server cannot tell touched from normalised.** Measured and
  recorded in `proposedChart.ts`: a rename-only Explore save posts 32 keys
  the stored blob never held, drops 8, re-emits `viewport` at full float
  precision, and migrates `time_range` into `adhoc_filters`. Compared
  against the *stored* live blob, normalisation reads as editing. It would
  overwrite draft values for every key Explore touches on its own. Only the
  browser knows what it hydrated with.
- **(b) It cannot express a revert.** If the second session starts from live,
  there is nothing on screen to revert; the only way to undo part of a draft
  is to discard all of it. A design that makes an edit irreversible is not
  a fix.
- **(c) It hands the approver a chart that never existed on any screen**
  (your point, and it does stand): draft keys plus new keys, never
  rendered together.

### 1.4 What the gate gets wrong with no browser involved

These two are reproducible by API alone and are independent of hydration:

- **Partial bodies replace.** The chart Properties dialog
  (`explore/components/PropertiesModal/index.tsx`) posts only
  `slice_name, description, cache_timeout, certified_by,
  certification_details, tags, editors, viewers`. After an Explore save has
  captured `params`, a rename through that dialog calls `gate_write` with a
  payload that has no `params`; `_update_own_request` replaces, and the
  `params` edit is gone. REST and MCP clients send partial bodies by design.
- **R4-01 judges the body, not the draft.** `gate_write` calls
  `is_empty_change(live, payload)` and then
  `_drop_a_fully_reverted_draft` *before* it looks at the existing request.
  A partial body whose fields all equal live is "empty", so a draft carrying
  an unrelated `params` edit is discarded (status guard from `17b3b5d138`
  limits this to drafts, which are exactly the revise case). Both are the
  same mistake: treating a PUT body as the whole truth about the asset.

The stated principle in `_update_own_request`'s docstring, "an approval
must cover exactly what was last reviewed", is true and is not violated by
folding: the stored payload is what approval replays, and any fold bumps
`changed_on` (the revision token), which `approve` already requires.
Replace-on-fold was justified by that sentence but does not follow from it.

## 2. The rule everything below hangs on

> **R1. An author's editing surface starts from the author's open proposal.**
> A save then asserts what the author saw.
>
> **R2. A fold of body B into open draft D must equal applying D, then B.**
> For full-state bodies that is replace per field; for diff bodies it is
> `combine`; for partial PUT bodies it is a field-level merge.

R1 is the client's job and cannot be done on the server (1.3a). R2 is the
server's job and cannot be done in the browser (partial bodies from REST and
MCP never pass through it). Neither is a substitute for the other. R2 is
also the property a test can state in one line (section 9, T1), which is the
cure for "the fix landed on the path a test exercises".

## 3. Item 1: lost edits on a chart, and sc-131032

### 3.1 Recommended approach (four parts, in this order)

**A. Server: field-level fold for the chart main update (R2).**
**B. Server: say it out loud when a save puts back settings the draft had
changed (a tripwire, non-blocking).**
**C. Client: Explore opens on the author's working copy (R1), labelled
truthfully.**
**D. Client: the editing dialogs open on the working copy too.**

A and B are backend-only, testable by API, and independently valuable. C and
D are the browser half. A without C still loses Explore edits; C without A
still loses Properties-dialog edits. Ship in that order (section 10).

### 3.2 Part A: the fold (backend)

Files and functions, all in
`local_extensions/asset-approval/backend/src/asset_approval/`:

- `gate.py::gate_write`: add a keyword (suggested name `fold_fields: bool =
  False`) that is **separate from `combine`**. Where `existing` is found and
  the command kind matches, compute `merged = {**existing.payload_dict,
  **payload}` when `fold_fields` is set (top-level fields only; never reach
  inside `params`, `query_context`, `json_metadata`). Then run, **on
  `merged`**: the emptiness test, `baseline_of(live, merged)` and
  `_serialized`. This is the reorder that fixes the R4-01 over-reach: the
  existing-request lookup has to move above the `is_empty_change` branch,
  and `_drop_a_fully_reverted_draft` must be asked about the merged payload.
- `gate.py::_lost_the_slot` and its `_update_own_request` call. **This is a
  second fold site** that bypasses the branch in `gate_write`; a double
  click on Save reaches it. Extract one `_fold_into(existing, payload, ...)`
  used by both, or the race path keeps replacing. The docstring there
  already admits "the fold here replaces the payload instead of merging it".
- `gate.py::_update_own_request`: unchanged signature is fine if callers pass
  the merged payload, but note `command_args` is replaced wholesale. The
  chart gate passes `{"normalization_changes": ...}`; a partial second body
  (no `params`) would drop the first save's list. Keep the existing value
  when the new body carries no `params`. **Open question Q11:** what the
  version-history consumer expects when two saves fold.
- `bindings.py::_gate_chart_update` passes `fold_fields=True`.
  `_gate_legacy_slice_save` (the deprecated overwrite path) builds a payload
  of the same shape and should get it too, since it still reaches
  `gate_write` and would otherwise be the one chart path that replaces.
- **Not** `combine=combine_key_values`. That is the obvious one-line fix and
  it is the trap: `comparable = operation is UPDATE and combine is None and
  not COMMAND_KEY`, so passing `combine` silently turns off 129076's empty
  test, the QA-24 baseline and R4-01 for charts. It would pass a test that
  asserts the fold and fail every row that depends on `comparable`.
- Dashboards stay on replace for now (4.3).

Semantics to pin down in tests:

| Case | Expected |
|---|---|
| D=`{params:P1}`, B=`{slice_name:X}` | merged `{params:P1, slice_name:X}` |
| D=`{params:P1}`, B=`{params:P2}` | merged `{params:P2}` (full state replaces its field) |
| D=`{slice_name:X, params:P1}`, B=`{slice_name:live}` | draft survives with `{params:P1, slice_name:live}`; What changed lists `params` only |
| D=`{slice_name:X}`, B=`{slice_name:live}` | merged equals live: draft closed (R4-01 intact) |
| D=pending, B=anything | status returns to draft, `left_review` set (unchanged) |
| two simultaneous saves, same author | both fold; neither lost (`_lost_the_slot`) |

### 3.3 Part B: the tripwire (backend)

On a fold, compute the settings the draft had moved off live that the new
body put back: for each top-level field and, for `params`, each key where
`D[k] != L[k]` (or `k` not in `L`) and `B[k] == L[k]` and `B[k] != D[k]`.
Pass the list on `ChangeRequestCreated` (suggested `reverted_fields`, beside
`replaced_delete` and `left_review`, which are the existing precedent) and
extend `http.captured_message` with a sentence: *"This save put back N
settings your draft had changed: A, B."* Non-blocking: a deliberate revert
produces a true sentence rather than a false 409.

Why it is worth the code: it is **the oracle for every path I did not
find**. If any editing surface still starts from live, the second save says
so in its own response, on every client including REST and MCP, and the QA
agent can assert the response body rather than infer loss from a final
state. It is also the honest answer to "how will we know about the next
surface". It is a heuristic (it cannot tell a revert from an edit made on a
stale view), so the wording says what happened and does not accuse.

### 3.4 Part C: Explore opens on the working copy (frontend)

**Where.** `pages/Chart/index.tsx::loadExploreData`, between
`fetchExploreData` and `dispatch(hydrateExplore(...))`. This is the single
place both the first load and every post-save refetch pass through.

**When it applies** (all must hold, else load live exactly as today):
feature flag on; `slice_id` present; no `form_data_key` in the URL (a key is
the author's own cached working state and must win, which is also standard
Explore behaviour); not `standalone=Report` (R5-02: a headless report runs
as a real user, and an author with a draft must not have it drawn into a
PNG); `fetchForAsset('chart', id)` returns a request with `is_author`,
`operation === 'update'`, no `command`, status in draft / pending /
changes_requested, and a `proposed` that composes.

**What it does.** Overlay the composed form data onto `result.form_data`,
reusing `proposedChart.ts` composition (captured `params` as base, else live;
`viz_type` and datasource from the body), **but keeping `slice_id`**. Do not
reuse `proposedChartFormData` as is: it forces `slice_id: 0` so the
reviewer's preview never lands in the live chart's cache slot. Add a sibling
(suggested `workingCopyFormData`) and leave `proposedChartFormData`
untouched so the reviewer preview cannot move.

`result.slice` stays live. Only the controls and the canvas change. That is
what keeps the header and `document.title` on the live title.

**If the draft moved the chart to another dataset** (`datasource_id/type`
differ from the live chart's): the Explore GET resolves the dataset from
`form_data.datasource`, which the slice supplies, so a second fetch with
`slice_id` still returns the live dataset. Fetch
`api/v1/explore/?datasource_id=&datasource_type=` (no `slice_id`, the
documented "build from scratch" form, `get.py:141-150`) and take only
`result.dataset` from it. This is reading-verified, not run: Q4.

**Never fall back silently.** If composition fails (unparseable `params`,
dataset fetch fails), the author has an open change and Explore is on live.
That is the lossy state again. The page must say so in the banner ("Could
not open your saved changes. Saving from here replaces them.") and the Save
dialog must carry the same sentence. A silent fallback is exactly how this
bug was born.

**The signal.** `hydrateExplore` must record that it hydrated from a working
copy, with the request id and revision, so the banner reports the screen and
not the asset (3.5). `hydrateExplore` is in `explore/actions/hydrateExplore.ts`
and the reducer in `explore/reducers/exploreReducer.ts`; whether an extra
payload field survives to state is Q6.

### 3.5 Making the words follow the screen (QA-19 and NEW-2 stay true)

QA-19 was fixed by deriving the banner from a property the component could
see (`showChanges?.showing`), and sc-131032 showed that derivation was wrong
for a chart (absent switch was read as "viewing your changes"). The general
repair is to stop inferring the screen from the asset kind or from a switch
and have the host say **what is on screen**:

`onScreen: 'live' | 'proposal' | 'working-copy'`

- `ReviewBanner` takes `onScreen` instead of deriving it. The three draft-
  author strings become: live (existing "you and viewers are both seeing the
  live version"), proposal (existing "Viewing your changes"), working-copy
  (new: "Editing your saved changes · saved %s · viewers still see the live
  version").
- `ChartVersionNotice` (`proposed: boolean`) becomes three states: "Live
  version · what viewers see now", "Proposed version · not live until
  approved" (both unchanged for reviewers) and "Your saved changes · not
  live until approved" for the working copy.
- `useProposedPreview` / `AssetReview` / `events.ProposedChartState` carry
  `onScreen`. The host sets it: Explore from the hydration signal, the
  dashboard from the preview switch (as today).

Truth table for the states the author can be in after this change:

| Surface | State | On screen | Banner | Header title |
|---|---|---|---|---|
| Dashboard at rest | any open change, switch off | live | live copy (unchanged, QA-19) | live (unchanged, NEW-2) |
| Dashboard at rest | switch on | proposal | "Viewing your changes" (unchanged) | proposed (unchanged: that is what the switch is for) |
| Dashboard, Edit pressed | working copy loaded | working-copy | "Editing your saved changes" | proposed, while editing |
| Dashboard, after captured save | leaves edit mode, **rehydrates live** | live | live copy | **live (NEW-2 holds)** |
| Explore, author, hydrated | working copy | working-copy | "Editing your saved changes" | live (see below) |
| Explore, author, switch to live | read-only live draw | live | live copy | live |
| Explore, reviewer | switch off / on | live / proposal | unchanged | unchanged |
| Explore, other editor | locked | live | unchanged | unchanged |
| Explore, author, hydration skipped for a reason | live | live | warning: saving replaces your changes | live |

**NEW-2 on the chart.** The header title stays live even though the draft
may rename. Choosing the proposed name in the header would reproduce NEW-2's
literal symptom ("a captured save leaves the proposed title in the header").
The cost is that an author who renamed sees their old name on the header.
Mitigations that keep NEW-2 literal: the Save and Properties dialogs prefill
the proposed name (3.7), and the notice strip appends `renamed to "X"` when
the draft's `slice_name` differs. This is a judgment call; it is listed in
section 8 for a decision rather than made quietly.

**The author's switch.** `canPreview` is true for an author too, so today
the author is offered "Show changes" on a chart. In working-copy mode that
switch would draw the proposal beside a working copy that already is the
proposal. For an author in working-copy mode the switch is relabelled **Show
live version** and draws the live chart read-only through the existing
`ProposedChartPreview` (live form data, `slice_id: 0`), with the controls
greyed by the existing `isPreviewActive`. That gives the author the one
comparison they lost, reuses the preview machinery unchanged, and avoids a
new editable-live surface that would be a lossy Save waiting to happen.

### 3.6 Decision this needs (D-05)

D-05 (signed by the PM): *"you see the live version, and the banner says
so"*; reasoning: *"the author and the viewer see the same thing unless the
author asks otherwise, which makes 'has this gone live yet' answerable by
looking."* It also said the alternative was "a usability item, not a
correctness one". **That classification was wrong**: the alternative's absence
is how work is lost.

This design keeps D-05 for *viewing* (dashboard at rest, reviewers, other
editors, report mode) and changes it for *editing surfaces*: Explore (no
view/edit split exists) and the dashboard edit mode. "Has it gone live?" is
still answerable by looking, because the notice strip and banner say "not
live until approved" on every working-copy screen. Add an addendum to D-05;
do not leave it implicit.

### 3.7 Part D: editing dialogs open on the working copy

- `explore/components/SaveModal.tsx`: `newSliceName` defaults to the draft's
  `slice_name` when the author has one, else `slice.slice_name`. Otherwise
  every Explore re-save asserts the live name and silently reverts a rename.
- `explore/components/PropertiesModal/index.tsx` (also mounted by the chart
  list): prefill from the draft for the fields the draft carries. Part A
  already protects fields the dialog does not send; this protects the ones
  it does.
- A small shared hook, e.g. `useWorkingCopy(assetType, id)` in
  `features/changeManagement/`, returning the open change when the viewer
  is its author and it is a main-update. `useOpenChange` already does the
  fetch; do not add a second one per dialog.

### 3.8 Alternatives rejected for Item 1

| # | Alternative | Why not |
|---|---|---|
| 1 | Three-way merge inside `params` on the server | 1.3(a)-(c): cannot separate edit from normalisation; no way to revert; unrendered hybrid |
| 2 | `combine=combine_key_values` on the chart gate | Disables `comparable`: 129076, QA-24 baseline, R4-01 all regress for charts. Passes a fold test, fails the rows |
| 3 | Server overlays the draft on `GET /api/v1/chart/<id>` (and dashboard) for the author | Every consumer sees the draft (lists, MCP, thumbnails); breaks D-05 everywhere not just on editors; Superset etag-caches those GETs (REGRESSION-2026-11-02, observation under walk B); invisible to the banner so QA-19 returns |
| 4 | Server seeds `GetExploreCommand` from the draft | Core edit with no declared seam; the Explore API never sees `standalone`, so a report run as the author draws the draft into a PNG (R5-02); also cannot be tested without the API |
| 5 | Keep live as default; author clicks "Continue editing"; Save from live is guarded | Fallback only (3.9). It preserves D-05 but makes the guarded path the default for every reviser, and a guard people click through is the same loss with a dialog |
| 6 | Optimistic-concurrency token (`X-Change-Request-Revision`), 409 without it | Complete and structurally sound, but every surface (and every REST/MCP client) must send it, and unaware clients break outright. Tripwire (3.3) is the non-breaking version. Keep as phase-2 hardening if the tripwire fires in the wild |
| 7 | Refuse a second save while a draft exists | Contradicts SOW 5.5 ("Changes updated in your existing draft"); makes every revision a discard |
| 8 | Keep per-save history of the draft | Recoverable, not prevented; adds a table for a problem the invariant removes |
| 9 | Tell authors to turn Show changes on first (works on a dashboard by accident) | Relies on an unlabelled step, and Explore has no equivalent |
| 10 | Default dashboard view to the proposal (the second option in `8c090da302`'s message) | Hydrates the whole dashboard on every open; D-05's own objection stands. Edit-mode hydration (4.2) gets the safety without it |
| 11 | Copy-only: warn "this replaces your changes" | Moves the loss onto the person; the QA High is data loss, not wording |

### 3.9 Fallback if the PM refuses to reopen D-05

Keep Explore on live. Banner (author, draft): "Your saved changes are not
shown here". Add **Continue editing your changes** to the banner (loads the
working copy, same code as 3.4). Intercept Save/Overwrite while an open own
change exists and the page was not hydrated from it: confirm dialog "This
replaces your saved changes: <list from `changes`>. Continue from your
changes instead?". Parts A, B and D are unchanged. It is strictly worse for
the reviser but keeps D-05 byte-for-byte.

### 3.10 What this must not break (regression surface)

- **Reviewer's chart preview.** `proposedChartFormData` untouched.
  `canPreview` for non-authors untouched. The `previewKey` effect in
  `useProposedPreview` drops the preview to live when `revision` moves; that
  must not fire on the author's working copy mid-edit (the author's own save
  moves the revision). Scope that effect to non-authors, or `onScreen`
  'working-copy' will flip to live under the author after every save.
- **`proposedChart.ts` known boundary.** A rename through Explore's Save
  dialog still moves `params`, so `hasProposedChart` still offers a switch
  that shows an identical chart. Working-copy mode makes this *more*
  visible, not less: the author's working copy and the live chart will look
  identical for a rename-only draft. The "Show live version" switch then
  shows two identical charts. Don't treat that as a regression; do tell QA
  it is the same boundary, documented in the file's own comment.
- **`reloadOnTheApprovedChart` / `form_data_key`.** Approve and discard both
  call `onApplied` and so drop the key. Working copy puts draft content in
  the cached key after the author's first edit. Discard must still land on
  live (it does, it drops the key). Q5 covers keys that predate the change.
- **Report mode.** Guard in 3.4. Check `standalone=3` explicitly.
- **QA-11 / 129078 / R4-01 / 129076 / QA-24 / the race.** All sit on the
  fold; see section 7.

## 4. Item 4: the dashboard main update

### 4.1 Answer

**Yes, the same exposure exists, by reading, by three independent routes.**
Not verified on a running instance (Q1 gives the baseline run).

1. **Edit mode on a fresh page load.** `handleEnterEditMode`
   (`Header/index.tsx`) just toggles edit mode on state hydrated from live.
   `saveDashboardRequest` posts `certified_by, certification_details, css,
   dashboard_title, slug, description, editors, tags, theme_id,
   json_metadata` (layout travels inside `json_metadata`). That is full
   state; `_gate_dashboard_update` -> `gate_write` has no `combine`, so it
   replaces.
2. **The same session, via NEW-2.** `showLiveTitle`
   (`DashboardBuilder.tsx`) deliberately writes the live title into the
   header when not editing and not previewing. The next edit-mode save posts
   that title as `dashboard_title`. A rename in the draft is reverted by the
   very fix that made the header honest. (Likely; Q2 confirms what the
   header text feeds into the save body.)
3. **The Properties dialog.** `dashboard/components/PropertiesModal`
   re-fetches the live dashboard (`fetchDashboardDetails`) and posts title,
   slug, description, `json_metadata`, css, theme. The modal's
   `json_metadata` has no `positions` (changes.py `LAYOUT_KEY` comment), so
   it replaces a draft whose layout edit lived in `json_metadata.positions`.
4. (Smaller) `addChartToDashboard` in `SaveModal` GETs live `position_json`
   and PUTs it back; captured under 129069, it replaces too.

Also open: after a *captured* dashboard save, `onUpdateSuccess` sets edit
mode false and announces the capture but dispatches no rehydrate. The page
may keep the author's edited layout on screen under a banner that says live
(Q2). If so, D-05 is already violated in the layout while it is honoured in
the title.

### 4.2 Recommended approach

Same rule, different seam, and it **keeps the dashboard at rest on live**:

- **Edit starts from the working copy.** In `handleEnterEditMode`, for the
  author of an open main-update change: load the working copy first (reuse
  the `overlay()` + `hydrateDashboard` path in `useProposedPreview.apply`,
  extracted so both call it), *then* toggle edit mode. If loading fails, do
  not enter edit mode; toast and stay put. Entering edit mode on live with a
  draft open is the lossy state.
- **After a captured save: rehydrate live and reset the switch.** Fetch live
  fresh (not the cached `liveRef`: exempt writes such as a description or
  editors change can have landed since), dispatch `hydrateDashboard` for it,
  and reset `showing`. `previewKey` in `useProposedPreview` is `''` for
  dashboards today, so nothing resets it; give dashboards a key too.
- **Properties dialog prefill** via the shared hook (3.7).
- `AssetReview` and `ReviewBanner` take `onScreen` (3.5).

This keeps QA-19 (at rest the author sees live and the banner says so) and
NEW-2 (the header returns to live after a captured save) true, and it fixes
rows 1 to 3 above. Row 4 is covered by the tripwire (3.3), not by
hydration.

### 4.3 Why the dashboard fold stays on replace (for now)

R2 requires a fold to equal sequential application. For a dashboard that is
**not** `{**D, **B}`: `UpdateDashboardCommand` splits `json_metadata.positions`
out into the `position_json` column. Applying D then a B whose
`json_metadata` has no `positions` leaves the layout in place; the merged
payload `{**D, **B}` has B's `json_metadata` and so loses D's layout. A
field-level merge is wrong for dashboards until `positions` is lifted. Q3
asks which of `position_json` and `json_metadata.positions` wins on replay.

### 4.4 Alternatives rejected for Item 4

Same list as 3.8, plus: **apply Part A to dashboards now** (rejected: the
`positions` mismatch above makes it silently wrong, which is worse than the
bug it fixes); **merge `json_metadata` by key** (rejected: edit-mode posts
every key, so it is a replace again, and the Properties dialog posts live
state for the rest, 1.3).

## 5. Item 2: the reviewer's note on the Approvals page (sc-131033)

**Where.** `local_extensions/asset-approval/frontend/src/Approvals.tsx`, the
`status` column's `render`, directly under the `<Tag>`. The row already
carries `review_note` (`serialize`, api.py:405, via the list's per-row
`serialize` call) and `reviewer`. Type is in `frontend/src/types.ts:105`. No
backend change.

**When.** Key it on `row.status === 'changes_requested'`, **not** on the
note being present. `lifecycle.request_changes` sets `review_note`; only
`gate._update_own_request` clears it. `submit`, `withdraw` and `approve` do
not, so a sent-back-then-resubmitted request still holds the old note while
`pending`, and an approved one can too. Keying on presence would show a
stale instruction under "Awaiting review" or "Approved".

**What it says.**
- Note present: `<Reviewer first name>: "<note>"`, clamped to two lines, full
  text in the `title` attribute (and the row's Open link leads to the banner,
  which shows it in full). `data-test="returned-note"`.
- Note absent, whitespace, or reviewer unknown: muted, `Sent back without a
  note.`, with the reviewer's name when there is one. `request_changes`
  rejects a blank note today (`ReviewNoteRequiredError`), so this only
  appears for rows from before that rule; it is a fallback, not a flow.
- Everyone who sees the row, not only the author: another editor reading
  "Changes requested" is owed the reason too.

**Tests to add** in `Approvals.test.tsx`: note renders for author row;
fallback renders; no note line on `pending` or `approved` rows even when
`review_note` is a non-empty stale string (this is the case that would pass a
presence-keyed implementation).

**Build step.** This file is in the extension bundle. `dist` is gitignored
output of `local_extensions/asset-approval/build.sh`; the repo's main
frontend does not contain it. A source change that is not rebuilt is the
"Fixed but unchanged" failure in its purest form. The verification must
include a rebuild and a hard reload.

**Related, not in scope but real.** Once the author saves a revision the
note is cleared (`gate.py` sets `review_note: None` on every fold), so the
reviewer's guidance disappears the moment the author starts acting on it.
Consider keeping it as `last_review_note` for the author until resubmission.
Listed as a decision (section 8), not designed here.

## 6. Item 3: the two sc-129075 leftovers

### 6.1 Dataset description diff: "No column changed"

Diagnosis, in three layers:

1. **Why it fired on QA's build.** `DatasetReviewModal` opens on the first
   tab with a count and otherwise on `columns`
   (`firstWithChanges ... ?? 'columns'`), reading "No column changed." when
   nothing is in columns. At `5229b7ab` every dataset write reported
   `columns` and `metrics` as changed because the stored `uuid` is a `str`
   and the live row's is a `UUID` (fixed in `17b3b5d138`, `IDENTITY_FIELDS`).
   So a description-only edit was **not** treated as exempt, was captured,
   and opened a dialog with nothing in it. QA retested a build that predates
   that fix.
2. **After that fix, a description-only edit never reaches review.**
   `description` is in `EXEMPT_FIELDS` (SOW 5.2), so it applies directly. If
   QA's expectation is a review dialog showing a description diff for a
   description-only edit, the expectation contradicts SOW 5.2, and the
   answer to QA is "by design". I cannot tell from the report which they
   did (Q7).
3. **The logic gap that remains and is real.** `api.dataset_detail` emits
   only `sql`, `columns`, `metrics`. A payload that carries any other changed
   field is replayed on approve and shown nowhere in the dataset dialog:
   `description` riding with a governed change, `table_name`,
   `main_dttm_col`, `cache_timeout`, `fetch_values_predicate`,
   `template_params`, and `extra.warning_markdown` (which `_only_exempt`
   keeps governed because it shows viewers a banner). A reviewer approving a
   dataset sees "No column changed" and approves a changed
   `fetch_values_predicate` unseen. That is a review-integrity gap of the
   same family the epic exists to close.

**Recommendation.** Backend `dataset_detail`: add `settings`, a list of
`{field, before, after}` for every field in `changed_fields` other than
`sql`, `columns`, `metrics` and the ignored set, using the same
before/after + truncation helpers as `describe_changes` (long values
already handled). Frontend: a fourth tab "Settings" with a count, included
in `firstWithChanges`; leave "No column changed." as is, because with the
tab landing on the right place the sentence is true. The panel's
`changeCount` for datasets (`display.ts`) must include settings or the
header says "0 changes" over a non-empty dialog (the exact contradiction
`WhatChangedPanel` already fixed once). **There are two copies**:
`superset-frontend/src/features/changeManagement/DatasetReviewModal.tsx`
and `local_extensions/asset-approval/frontend/src/DatasetReviewModal.tsx`
(plus `DatasetReview.tsx`, `types.ts`, `display.ts` beside it). The
Approvals page uses the extension copy. Change both or the fix is on the
path the test uses and not the one the reviewer uses.

### 6.2 Chart setting names as raw keys on first save

I cannot settle this from source. What reading establishes:

- Names come from `controlLabels` in `WhatChangedPanel.tsx`, built from
  `getControlsForVizType(proposed viz_type)`. A key with no control keeps
  its raw name by design (the comment says so, quoting `AlteredSliceTag`).
- `_opaque_entry` names `moved + removed`, falling back to `added` only when
  nothing moved. For a chart **never saved from Explore**, the first Explore
  save moves and removes keys that are not current controls: legacy names
  Explore migrates on load (the file documents `time_range` ->
  `adhoc_filters`; the same class covers other pre-migration keys),
  bookkeeping Explore always writes (`datasource`, `slice_id`, `dashboards`
  from `getSlicePayload`, `url_params`), and controls whose `label` is a
  function (filtered out by `typeof config?.label === 'string'`).
  Every one of those renders raw. This is plausible; it is a hypothesis.
- `getControlsForVizType` resolves string-named controls only through
  `explore/controls.tsx`, not `sharedControls`; any control referenced by
  string and defined only there is unlabelled. Also unverified.

**Recommendation.** Do not change code yet. One diagnostic: dump
`changes[].keys` (and `added_keys`) from the failing request and classify
each raw key as (a) bookkeeping, (b) legacy name, (c) control with a
non-string label, (d) control missing from the string map. Then:

- (a)/(b): do not name them. Count them aloud with the existing "N further
  settings" pattern ("N settings converted by Explore"). That follows the
  rule already written into `changed_keys_by_kind`: a ranking, not a filter.
- (c)/(d): extend the label source.

It is logic, not copy. Because the answer depends on which class dominates,
the design commits to the diagnostic and the rule, not to the label table.

## 7. Files, functions and the regression surface each sits on

| File / function | Change | Regression surface |
|---|---|---|
| `gate.py::gate_write` | lookup of existing moves above empty test; `fold_fields` merge; emptiness/baseline on merged | 129076 (empty change), R4-01, QA-24 (baseline), QA-11, 129078 (`replaced_delete`, `left_review`), `test_gate.py`, `test_reverting_a_draft_clears_it.py` |
| `gate.py::_lost_the_slot` | uses the same fold | the two-saves race from the 2026-11-03 regression (defect 2); `test_a_fold_says_what_it_replaced.py` |
| `gate.py::_update_own_request` | `command_args` kept when body has no `params` | version history normalisation (`test_approval_in_version_history.py`) |
| `gate.py::_drop_a_fully_reverted_draft` | asked of merged payload | R4-01; the `17b3b5d138` status guard |
| `bindings.py::_gate_chart_update`, `_gate_legacy_slice_save` | pass `fold_fields=True` | `test_the_legacy_chart_save_is_gated.py`, `test_every_write_path_is_bound.py` |
| `exceptions.py::ChangeRequestCreated`, `http.py::captured_message` | `reverted_fields` + sentence | `test_a_fold_says_what_it_replaced.py` message table |
| `api.py::dataset_detail` | `settings` | `test_dataset_review_shows_the_change.py`, `test_the_panel_names_what_the_gate_counted.py` |
| `pages/Chart/index.tsx::loadExploreData` | overlay, guards, datasource swap | all of Explore; report mode (R5-02); `reloadOnTheApprovedChart` |
| `explore/actions/hydrateExplore.ts`, `reducers/exploreReducer.ts` | carry working-copy marker | `chartNormalization` tracking in version history; `isCachedFormData` name-source logic |
| `ExploreViewContainer/index.tsx` | `onScreen`, third notice state, author switch | the chart preview (`ProposedChartPreview`), version-history preview, `isPreviewActive` greying |
| `features/changeManagement/proposedChart.ts` | **add** `workingCopyFormData`; leave `proposedChartFormData` alone | `proposedChart.test.ts`, `useProposedPreview.test.tsx` |
| `useProposedPreview.ts` | `onScreen`; `previewKey` reset scoped to non-authors; dashboard key (tier 3) | reviewer preview; `ProposedChartPreview.test.tsx` |
| `ReviewBanner.tsx` | `onScreen` replaces `showChanges?.showing` inference | `ReviewBanner.test.tsx` (the QA-19 tests), `display.test.ts` |
| `ChartVersionNotice.tsx` | third state | `ChartVersionNotice.test.tsx` |
| `explore/components/SaveModal.tsx`, `explore/components/PropertiesModal` | prefill from working copy | NEW-3 (list tag), the 202 path (uncommitted edit to `dashboard/components/PropertiesModal/index.tsx` is in the tree; do not clobber) |
| `Header/index.tsx::handleEnterEditMode`, `DashboardBuilder.tsx::showLiveTitle`, `dashboardState.ts::onUpdateSuccess` | tier 3 | NEW-2, NEW-1 (beforeunload after capture), QA-14, R4-07 |
| `Approvals.tsx` | note line | 129074/131033 view; `Approvals.test.tsx` |
| both `DatasetReviewModal.tsx` (+ `DatasetReview.tsx`, `display.ts`, `types.ts`) | Settings tab | QA-22 (see side findings) |
| `tests/.../test_every_qa_row_has_a_home.py` | add the new rows to `CORPUS` | the file fails a row no test names |

## 8. Open questions (verify before implementing)

These are the things I would have confirmed against a live response.

- **Q1. Baseline.** Does each lossy route (3.1/4.1) actually lose the edit
  on the running build? Run T0 in section 9 *before* any change. It also
  gives the numbers the fix is judged against.
- **Q2. Dashboard after a captured save.** Does the redux layout keep the
  author's edited positions on screen after `setEditMode(false)` (no
  rehydrate is dispatched), and does the header text feed the next save's
  `dashboard_title`?
- **Q3. Dashboard replay precedence.** When a body carries both
  `json_metadata.positions` and `position_json`, which wins? Decides whether
  4.3 can ever be lifted.
- **Q4. Datasource-moved draft.** Does the datasource-only Explore fetch
  return a `dataset` that works with the live chart's `slice` in
  `hydrateExplore`? Read, not run.
- **Q5. Stale `form_data_key`.** An author whose URL carries a key cached
  *before* the draft existed (bookmark, history entry, second tab) skips the
  overlay and edits from live. The tripwire catches it after the fact. How
  common, and should a key whose form data equals live params, with an open
  own change, be treated as stale?
- **Q6. Carrier for the working-copy marker.** Does `hydrateExplore` /
  `exploreReducer` pass an unknown field through to state, or must the type
  and reducer change?
- **Q7. QA's dataset case.** Description-only or combined with another
  governed field? Which build? (6.1.)
- **Q8. QA's raw-key request.** Dump of `changes[].keys` for the failing
  chart request. (6.2.)
- **Q9. Does hydrating a working copy make Explore's own "altered" tag /
  dirty tracking fire?** `hydrateExplore` keeps `persistedFormData` from the
  live slice, so the working copy differs from "saved" on load. If any
  leave-page prompt keys on that it re-opens NEW-1.
- **Q10. Decisions for the PM, not engineering:** (a) reopen D-05 for
  Explore and dashboard edit (3.6) or take the fallback (3.9); (b) header
  title in chart working-copy mode: live (recommended, NEW-2 literal) or
  proposed; (c) keep the last review note visible to the author while they
  revise.
- **Q11. `normalization_changes` on fold.** What the version-history
  consumer expects when two saves fold: replace, union, or keep the first.
- **Q12. The brief's `AssetReview.tsx:353` reference.** I could not find a
  comment there about request-changes; that line is the approve handler. The
  *behaviour* is as you describe (`run(..., applied)` defaults `applied` to
  false for request-changes, so no `onApplied`), so the reload fix is not
  implicated. Noting the citation because the next reader will look for it.

## 9. Verification, as user journeys

Run every journey **through the interface a person uses**, on a throwaway
chart and dashboard created by alex with priya as a second editor (not any
asset the earlier walks used), as the named account. Where a journey says
"final state", read it back with `GET /api/v1/chart/<id>` or
`.../dashboard/<id>` after approval: that is the oracle, not a banner.

**T0. Baseline (before any code).**
1. alex, Explore on a throwaway chart opened from `?slice_id=` only. Change
   the metric and the colour scheme; Save, Overwrite. Expect 202, banner.
2. Without reloading, change one more control (axis title), Save again.
3. What changed. **Today I expect:** metric and colour scheme are gone.
   Record the exact lists. Repeat for (i) Properties dialog rename after an
   Explore save, (ii) the same on a dashboard: edit mode layout change, save;
   reload; edit mode title change, save. This turns "by reading" into "by
   measurement" for all of section 3 and 4.

**T1. Property test (backend, no browser).** For a set of (D, B) pairs,
`fold(D, B)` must produce the same asset as replaying D then B through the
real replay machinery (`replay.apply_change`) on a scratch chart. This is the
statement of R2 and it exercises `gate_write` *and* `_lost_the_slot`; run
the race variant with two real threads, as the 2026-11-03 run did.

**J1. The High, end to end (chart).** As T0 steps 1 and 2 after the fix.
Expect: after step 1, the controls show the saved metric and colour (not
live); the chart canvas draws them; the strip says "Your saved changes · not
live until approved"; the banner says "Editing your saved changes"; the
header and the browser tab show the **live** title (NEW-2). Step 2's toast
reads "Changes updated in your existing draft" with **no** "put back"
sentence. What changed lists all three. Hard-reload the tab from a URL with
only `slice_id`: same screen. Request review. As priya: default is live,
banner "you are seeing the live version"; switch on shows the proposal with
all three; Approve. Read back `params`: all three present. **Then repeat
from `changes_requested`:** priya sends back with a note; alex opens the chart
**from the Approvals row's link**, sees the note in the banner and the three
settings in the controls, changes a fourth, saves, resubmits; priya approves;
read back four.

**J2. Deliberate removal is honoured.** Inside the working copy remove one
metric and save; approve; read back. The metric must be absent (not
resurrected) and the others present.

**J3. Revert is possible.** In the working copy set a control back to its
live value; What changed no longer lists it. Revert everything; the draft
closes (R4-01) with the existing message and the banner disappears.

**J4. Partial body (no hydration involved).** Explore save of a `params`
change, then rename through the Properties dialog: What changed lists
`params` **and** Title; approve; read back both. Then set the name back to
the live name through the dialog with the `params` draft open: the draft
survives (this is the R4-01 over-reach).

**J5. The tripwire as oracle.** With a draft holding a `params` change, send
`PUT /api/v1/chart/<id>` with a body equal to live plus one unrelated key.
The 202 body's `message` names the settings put back. Same call through
the double-click race.

**J6. QA-19 and NEW-2, re-walked, not assumed.** Dashboard: the existing walk
A (title rename via Properties, banner copy, header live, switch moves the
header). Chart: the three `onScreen` states each against the truth table in
3.5, reading the banner text against the controls *and* the canvas. Edit
mode (tier 3): press Edit with a draft open and confirm the title shown is
proposed and the banner says editing; Save; confirm the page returns to live
and the header is live.

**J7. Reviewer's chart preview, unchanged.** As priya on a chart with a
view-type change: live by default, switch to proposal, notice text, controls
greyed, Run blocked, approve, no stale `form_data_key` in the URL. As alex
mid-revise, priya's preview must not flip when alex saves (the `previewKey`
effect, 3.10).

**J8. Report mode.** As alex with an open draft, open
`/explore/?slice_id=<id>&standalone=3`: the **live** chart and no banner.

**J9. Discard and approve with a working copy open.** Discard from the banner
while the working copy is on screen: the page lands on live. Approve in
another session while alex has it open: alex's next save is refused or
messaged, not silently applied.

**J10. Approvals note.** priya sends back a chart with a note; alex's
Approvals "Returned to you" row shows it; a legacy row with a null note
shows the fallback; resubmit without editing and confirm the row under
"Awaiting review" shows **no** note. **Rebuild the extension first**
(`local_extensions/asset-approval/build.sh`) and hard-reload; confirm in the
served bundle, not the source.

**J11. Dataset.** Dataset editor: change SQL and the description in one
save, request review as alex, open the review as priya from Approvals: a
Settings tab with a count, the description before/after, and the tab opened
by default. Change the description alone: it applies directly, no request,
per SOW 5.2; tell QA. Check both copies of the modal (dataset list entry
point and Approvals).

**J12. Raw keys.** After the diagnostic, the same first Explore save of a
chart never saved from Explore (seeded by API): the panel names controls
and counts the rest.

For each journey the QA agent should record the response body of the final
save as well as the screen: the tripwire sentence (3.3) is the cheapest way
to know a path still starts from live.

## 10. Sequencing

**Ship now, independently, low risk.**
- Approvals note (J10). Frontend-only, one file plus tests, but needs the
  extension rebuilt.
- Dataset Settings rows (J11). Additive in `dataset_detail` and four tabs'
  worth of UI in two copies. Needs no Explore.
- Diagnostics: T0 baseline, the Q7/Q8 dumps.
- `test_every_qa_row_has_a_home.py`: register the new rows.

**Ship next, backend only, API-verified.** Parts A and B (fold, tripwire).
It fixes the partial-body loss and the R4-01 over-reach on its own, and it
makes the next two tiers testable by response body. Re-walk R4-01, 129076,
129078, QA-11, QA-24 and the race (all in the 2026-11-03 corpus) before it
leaves the branch; these are the rows that pass a fold test and fail in the
product.

**Needs the full re-walk.** Explore hydration (C, D) with `onScreen`
(`ReviewBanner`, `ChartVersionNotice`, `useProposedPreview`): this is the
whole of QA-19, NEW-2, sc-131032 and the chart preview, and it is where this
epic has been wrong four times. Gate it on the PM decision (3.6) and on Q4,
Q5, Q6, Q9. Do not merge before the PM answers.

**After that.** Dashboard (section 4): edit-mode working copy, live
rehydrate after capture, Properties prefill. Gate on Q1, Q2, Q3. Until it
ships, the tripwire (A+B) at least makes the dashboard loss visible in the
save response.

**What to tell QA now.** The lost-edit is **not chart-only**: expect the
dashboard to reproduce it (T0 will show). sc-131032's remaining half is
real and tracked; sc-131033 is a frontend gap; sc-129075's dataset row was
retested on a build that predates its fix, and the chart-names row needs a
dump of the failing request.

## 11. Side findings, outside the brief

- **QA-22 drift.** The extension's copy of `DatasetReviewModal.tsx` still has
  `target="_blank"` on "Open live dataset"; the core copy lost it in the
  QA-22 fix. The Approvals dataset review therefore opens a raw top-level tab.
  QA-22 is recorded as Pass for the dashboard only.
- **The two copies are drifting by construction.** `Approvals.tsx` cannot
  import the core components (Module Federation shares by exact request, per
  its own header), so every review-UI fix needs landing twice. The corpus
  test cannot see this.
- **Stale `review_note`** on pending and approved requests (section 5).
- **`_lost_the_slot` replaces for diff bodies too** (its own docstring says
  so); that remains a documented narrow loss for native filters / chart
  customizations and is out of scope here.
