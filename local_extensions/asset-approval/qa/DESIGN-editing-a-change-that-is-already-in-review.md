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

# Design: pressing Edit on an asset that already has an open change

Branch `fix/qa-regression-93`, written 2026-11-05 against `dada26e039`.
Design only. Nothing in `superset/`, `superset-frontend/src/` or
`local_extensions/asset-approval/backend/` is touched by this document.

Companion to `DESIGN-lost-edits.md`, which covers the same underlying rule
from the chart/Explore side and already recommends, in its section 4.2, that
dashboard edit mode start from the working copy. This document is the
narrower question you actually have to decide: **what should the Edit button
do**, with the options laid out and costed, including the ones that need no
hydration at all.

**Mockups.** The two options I recommend are drawn as screen sequences in
`local_extensions/asset-approval/qa/mockups/`:

- `mockup-option-c-seed-edit-canvas-from-draft.html` / `.png` — the cause fix
  (section 4), including the revised Edit-press dialog from section 7.
- `mockup-option-b-confirm-before-the-save.html` / `.png` — the confirmation
  in front of the save (section 3), including the dialog copy from section 8.

They are **hand-drawn HTML approximating Superset, not captures of it**. Each
page and each PNG filename says so, and every frame carries a watermark. They
must not be attached to a QA row or used as evidence: this project's evidence
rules allow only real Superset UI, and a rendered panel passed off as one
would be a forgery. The strings in them are the exact ones proposed; where a
sentence is a placeholder I was unsure of, the mockup's own caption says so
rather than presenting it as settled. Options A, D and E are not drawn — A and
D are rejected as products and E outright, and drawing a rejected option only
makes it look considered.

---

## 0. Where your brief and the code disagree

I read the code before writing. Nine corrections, four of which change the
shape of the decision.

**The three that matter most:**

1. **There are three open statuses, not two.** `draft`, `pending` and
   `changes_requested` all hold the asset's open slot
   (`backend/src/asset_approval/types.py`, `OPEN_STATUSES`). Your brief calls
   the third one `returned`; the code calls it `changes_requested`, both in
   `types.py` and in `superset-frontend/src/features/changeManagement/types.ts`.
   This is not pedantry: `changes_requested` is the **worst** case of the
   journey you describe, and your framing ("draft or pending") leaves it out.
   An author whose change was sent back has been *explicitly asked to revise
   it*. They press Edit, get the live canvas, fix the one thing the reviewer
   named, save, and the reviewer's original objection is now un-addressed
   because the rest of the draft went back to live. `handleEnterEditMode`
   (`superset-frontend/src/dashboard/components/Header/index.tsx:730`) only
   branches on `isAwaitingReview`, which is `pending` alone, so
   `changes_requested` goes straight into edit mode with no dialog of any
   kind. The revise-after-review loop is the one journey this feature exists
   to support, and it is the least protected.

2. **"Show changes" does read the draft now, layout included.** Your brief
   says there is "a working in-place preview", and that is right — but the
   `DEFECT-the-preview-never-reads-the-draft-2026-11-04.md` file you pointed
   me at is stale in its headline claim. Commit `4ae3d83548` ("Lay the
   proposed grid over the dashboard, not just its scalar fields") added the
   `json_metadata.positions` → `position_data` mapping in `overlay()`
   (`useProposedPreview.ts`), so the grid, the tab structure and the chart
   set now all come from the draft. The defect file still says "The grid is
   identical to live". Someone will read that file next week and conclude
   the preview is broken. It should be marked fixed, or the headline amended.

3. **Withdrawing on the Edit press is not required for correctness.** You
   say I may question it; it is weaker than it looks. The gate already pulls
   a submitted request out of review *at save time*, on its own:
   `gate.py:630` sets `left_review` when the folded-into request was
   `PENDING`, `_update_own_request` is called with `clear_note=True`, and
   `http.py` answers `UPDATED_LEFT_REVIEW_MESSAGE` — "Changes updated in your
   draft, which has been taken back out of review." So the server does the
   withdrawal whether or not the UI asked first. The Edit-press withdrawal
   (`announceWithdrawToEdit` → `WithdrawModal` → `withdrawRequest` →
   `announceEditAfterWithdraw` → `enterEditMode`) is a *disclosure* choice,
   not a mechanical prerequisite. It also has a cost nobody has priced: an
   author who confirms "Withdraw and edit", looks around, and presses "Exit
   edit mode" has already emptied the reviewer's queue for nothing. The
   request is now a `draft` and the reviewer has no idea why it vanished.
   That is a real regression introduced by `dada26e039`, which was otherwise
   the right fix.

**The six smaller ones:**

4. The crash site is `superset-frontend/src/dashboard/components/SliceHeader/index.tsx`,
   lines **218 and 222** — not `components/SliceHeader.tsx`. There are *two*
   unguarded reads, not one:
   ```
   state => state.charts[slice.slice_id].queriesResponse?.[0],
   state => state.charts[slice.slice_id].queriesResponse?.[1],
   ```
   The `?.` protects `queriesResponse`; nothing protects
   `state.charts[slice.slice_id]`. Whoever fixes this must fix both.

5. **The blast radius of the overwrite is narrower than the brief implies.**
   Only the edit-mode Save destroys the draft's layout. The Properties
   dialog, the Embed modal, REST and MCP are already protected:
   `_keep_the_layout_the_draft_holds` in `bindings.py:565` carries the
   draft's `positions` forward whenever the incoming `json_metadata` does not
   state a layout. The problem is one body from one button.

6. The exact body that button posts is ten fields
   (`dashboardState.ts:770-788`): `certified_by`, `certification_details`,
   `css`, `dashboard_title`, `slug`, `description`, `editors`, `tags`,
   `theme_id`, and `json_metadata` as a **string**. The layout rides inside
   that string as `positions`; `position_json` is never sent. `json_metadata`
   also carries freshly recomputed `chart_configuration` and
   `global_chart_configuration`, derived from the on-screen layout — which is
   why the break log shows "Cross-filter and native filter scopes updated for
   1 removed chart" being reverted too. It is not just the grid.

7. **The tripwire's sentence is delivered in a success toast.** `onUpdateSuccess`
   calls `dispatch(addSuccessToast(text, options))` with
   `reviewRequiredToast` (`display.ts:238`), ten seconds, HTML allowed, and a
   "Review changes →" link appended. So "This save undid 3 layout changes
   your draft had made: removed chart: Quarterly Revenue, …" arrives in green,
   as a success, next to a link to a page that cannot undo it. If nothing else
   in this document is done, fix that.

8. **`actualLastModifiedTime` is not a hazard for the seeding options.**
   `last_modified_time` is not in `DashboardPutSchema`
   (`superset/dashboards/schemas.py:509-555`), so marshmallow drops it and it
   never reaches `_captured_payload`. A draft payload therefore cannot carry a
   stale one into `dashboardInfo` via `overlay()`. I checked the schema; I did
   not run a capture to confirm the payload dict's keys, so treat this as
   read-verified rather than measured.

9. **The author's draft payload is already in the header's hands.**
   `useOpenChange` (`useAssetReview.ts:115`) returns the whole
   `ChangeRequest`, and the serializer at `api.py:2099` includes
   `"proposed": change_request.payload_dict` on the asset-scoped read. So
   `handleEnterEditMode` already has the draft's `json_metadata` — layout and
   all — at the moment the button is pressed. No new endpoint, no new fetch
   for the layout half. This materially lowers the cost of the options below.

One more thing, and it is the most useful discovery in this read:

> **`resolveSnapshotCharts` already solves the exact disagreement that
> crashed the page.** `superset-frontend/src/features/versionHistory/useDashboardVersionPreview.ts:90`
> takes a layout and the live chart list, works out which chart ids the layout
> needs, fetches the missing ones one at a time through
> `fetchExploreRehydrationData`, and — for any it still cannot reach — calls
> `swapUnreachableChartSlots` to replace that slot in the layout so nothing
> references a chart that is not in the store. `useProposedPreview.apply`
> already routes through it. The reason "Show changes" can draw a draft that
> removed seven charts and added a tab without crashing is that function.

Your brief tells me to weigh `restoreLive` as evidence and not treat it as a
promise. Fair. But `resolveSnapshotCharts` is stronger evidence than
`restoreLive`, because it is the piece that addresses the specific failure:
`hydrateDashboard` replaces `state.charts` wholesale from the `charts` array
it is handed (`hydrate.ts:366`, `charts: chartQueries`), so a layout item
whose `chartId` is absent from that array is precisely the undefined read at
`SliceHeader/index.tsx:218`. I could not find the two reverted attempts in
this branch's history (`git log --all` has no revert of a canvas-seeding
commit), so I am inferring from the crash signature rather than from the
diffs — but the signature says those attempts hydrated the draft's positions
against the **live** chart list and skipped the reconciliation step that was
sitting right there. If that inference is wrong and the attempts did call
`resolveSnapshotCharts`, option C below is much riskier than I rate it, and
whoever has those diffs should say so before any of this is built.

---

## 1. The mechanism, stated once

Entering edit mode changes nothing about the data on screen.
`enterEditMode` (`Header/index.tsx:696`) does three things: `setEditMode(true)`,
`clearDashboardHistory()`, `setUnsavedChanges(false)`. The Redux
`dashboardLayout.present` and `dashboardInfo.metadata` it then edits are
whatever the page hydrated on load — the live asset.

The save reads straight back out of those: `overwriteDashboard`
(`Header/index.tsx:462`) builds `metadata: { ...dashboardInfo.metadata,
positions: layout }`. So the posted layout is *live plus this session's
moves*, and the posted metadata is *live's metadata plus this session's
settings*. `_fold_into` with `fold_fields` replaces per field; `json_metadata`
is present and states a layout, so `_keep_the_layout_the_draft_holds` steps
aside and the draft's layout is replaced by live's. The draft is gone, and
because `ChangeRequest` has a single `payload` column
(`models.py:117`) with no revision history, there is nothing to restore it
from. `clearDashboardHistory()` has also thrown away the client-side undo
stack by then.

That is the whole defect. Everything below is a choice about where to
intervene in it.

---

## 2. Option A — refuse the edit, and offer the three honest routes

**Needs no hydration work at all.** This is the option that admits the canvas
cannot be trusted and declines to open it.

### What the author sees and does

Pressing **Edit dashboard** on an asset where they have an open change does
not enter edit mode. A dialog opens, titled **"You have changes waiting on
this dashboard"**, with the count and age the banner already computes
(`changeCount`, `ago` in `display.ts`):

> You saved 4 changes 27 minutes ago and they are with Priya Shah for review.
> Editing here starts from the live dashboard, not from your saved changes,
> so anything you save would replace them.

Three buttons: **See what you changed** (opens `WhatChangedPanel`, which
already names every moved component), **Discard and start again** (the
existing `DiscardChangesModal`, destructive, confirmed), and **Cancel**. For
a `draft` the author can also **Request review**, which is already in the
banner.

### What the reviewer experiences

Nothing changes for them, and that is the point: the queue is not emptied by
somebody browsing. The `pending` change stays `pending`. Compare today, where
`announceWithdrawToEdit` fires before any work happens.

### What it costs to build

- `Header/index.tsx::handleEnterEditMode`: replace the
  `announceWithdrawToEdit()` call, and add the same branch for `draft` and
  `changes_requested`, with one new event (`announceEditBlocked`, alongside
  the existing `WITHDRAW_TO_EDIT_EVENT` in `events.ts`).
- `features/changeManagement/`: one new modal, sibling to
  `AssetLockedModal.tsx`, which is already almost exactly this dialog for the
  *other* editor's case. Mount it in `AssetReview.tsx` beside the other six.
- Nothing in the backend. Nothing in hydration.

Half a day, and it is the only option here I would be comfortable landing
without a browser pass.

### How it fails, and what the user sees

It does not fail; it refuses. The failure is a product failure: the author who
wants to add one chart to a four-change draft has to discard four changes and
redo them. On the dashboard measured in the defect file — four resizes, three
reorderings, seven removals, a tab deleted and a tab added — that is twenty
minutes of work thrown away to add a title. People will do it once, and then
they will stop requesting review until they are completely finished, which
defeats the point of a draft state.

### Which fixed rules it stresses

None. It is the most conservative option on every rule: one open change
(5.3) is untouched, the author still sees live until they turn on Show
changes (5.5), self-approval is irrelevant, no history is kept (Q7).

It does stress **D-05** (the signed decision that the author sees the live
version) in the author's favour, by never contradicting it.

---

## 3. Option B — open on live, but make the save ask first

**Also needs no hydration work.** The canvas stays as it is; the intervention
moves to the save.

> **Mockup:** `local_extensions/asset-approval/qa/mockups/mockup-option-b-confirm-before-the-save.png`
> (source: `…/mockups/mockup-option-b-confirm-before-the-save.html`). Five
> frames: the live canvas in edit mode, the full dialog, the two outcomes
> side by side, the cheap dialog, and a diagram of where the gate has to sit.
> Hand-drawn HTML, not a capture — it carries a "MOCKUP" banner and must not
> be filed as QA evidence.

### What the author sees and does

Edit behaves exactly as today. When they press **Save** (or **Request
review**, or **Save and close** from the navigation prompt), and all of
*(a)* they have an open change of their own, *(b)* the page was not seeded
from it, and *(c)* the body they are about to post states a layout or a field
the draft has moved — a dialog opens before anything is sent. Titled
**"This replaces the changes you already saved"**:

> What is on screen started from the live dashboard, not from your saved
> changes. Saving now would put these back the way they were:
>
> · Removed chart: Quarterly Revenue (By Product Line)
> · Removed row
> · Changed tab: Sales Overview
> · Cross-filter scopes for 1 removed chart
>
> Your edit from this session — the title — would be kept.

Two buttons, and the destructive one is not the default:
**Keep my saved changes** (cancel the save, stay in edit mode) and
**Replace them** (danger styling, proceeds).

That list is the hard part. See "what it costs" below; there is a cheap
version of the dialog that does not have the list, and it is much weaker.

### What the reviewer experiences

Unchanged from today, including the queue being emptied at Edit-press time. If
B ships, the Edit-press withdrawal should move to save time (section 7) —
otherwise an author who chooses "Keep my saved changes" has still had their
change pulled out of review by a button press they then declined to act on.

### What it costs to build

The dialog must live **inside `overwriteDashboard`**, not on the Save
button's `onClick`. There are three callers: the Save button
(`Header/index.tsx:938`), the Request review button (`:1000`, which calls
`overwriteDashboard()` then `announceRequestReview`), and
`useUnsavedChangesPrompt`'s `onSave` (`:562`). A guard on the button leaves
two routes open — which is the same mistake `_fold_into`'s own docstring warns
about for the two fold sites in `gate.py`.

For the *list* of what would be put back, the page needs three layouts: the
draft's (it has it — `openChange.proposed`, see correction 9), the body's (it
has it — `dashboardLayout.present`), and **live's** (it does not; hydration
has been mutated by the edit session). Three ways to get live, in order of
how much I like them:

- Re-fetch it: `fetchDashboardHydrationData(id)` is already imported into this
  feature and is one round trip at save time. Then run the same comparison
  `changes.py::layout_put_back` runs, in TypeScript. **Duplicating that logic
  on the client is how the two copies drift**, and `http.py`'s own comment
  about `captured_message` being decided twice is the precedent for why that
  goes wrong. I would not do this.
- Add a dry-run route: `POST /api/v1/change_request/<pk>/preview_fold` taking
  the body, returning `reverted_fields` without writing. The server already
  computes exactly this list (`changes.py::reverted_fields`); this exposes it
  one request early. There is no dry-run endpoint today (`api.py` has
  fourteen routes, none of them this), so it is new, but it is thirty lines
  reusing a tested function, and it keeps one copy of the comparison. **This
  is the version I would build.**
- Skip the list: the dialog says "Saving now replaces the 4 changes you
  saved 27 minutes ago" and offers **See what you changed** to open the
  existing panel. No new endpoint, no new comparison. Much cheaper, and much
  easier to click through, because it does not show the author the thing they
  are about to lose.

### How it fails, and what the user sees

Three ways, all of which the author sees as a dialog they did not expect:

- **The predicate is wrong in the safe direction.** An author who entered
  edit mode, changed nothing the draft touched, and pressed Save gets a
  dialog about replacing changes that would not have been replaced. Annoying;
  survivable; argues for the dry-run version, where the list comes back empty
  and the dialog is skipped.
- **The predicate is wrong in the unsafe direction** — they press "Replace
  them" believing only the named things go. `reverted_fields` is explicitly a
  heuristic that prefers saying too little (`changes.py`: "Saying less than
  the truth is survivable here; naming a setting the save did not touch is
  not"). A dialog built on it inherits that bias, and here the bias is
  backwards: in a *warning* you want to over-report. The dialog must therefore
  not promise completeness. Append: "There may be more; open What changed to
  see everything in your saved version."
- **The dry-run request fails.** Then the dialog cannot be built. It must
  still open, with the cheap wording, rather than letting the save through
  silently. A save that proceeds because a diagnostic timed out is the
  original bug with extra steps.

And the honest failure, which is not technical: **a guard people click
through is the same loss with a dialog**. `DESIGN-lost-edits.md` already
rejected this as a standalone fix (its alternative 11: "Moves the loss onto
the person; the QA High is data loss, not wording"). I agree with that as a
verdict on B *alone*. I do not agree that it makes B worthless, because B is
the only thing that covers the surfaces hydration will never reach: REST,
MCP, and a second browser tab.

### Which fixed rules it stresses

None directly. It stresses the *spirit* of "one open change per asset" by
making the one open change feel like a liability the author has to defend
rather than a working copy they own.

---

## 4. Option C — seed the edit canvas from the draft

The cause fix. Edit mode opens on the author's own work.

> **Mockup:** `local_extensions/asset-approval/qa/mockups/mockup-option-c-seed-edit-canvas-from-draft.png`
> (source: `…/mockups/mockup-option-c-seed-edit-canvas-from-draft.html`). Six
> frames, in order: the asset at rest with the change in review; the Edit
> press and the tells-but-does-not-act dialog from section 7; the canvas
> opened on the draft; the save and the toast it produces; the state when
> seeding fails; and priya's queue before and after. Hand-drawn HTML, not a
> capture — it carries a "MOCKUP" banner and must not be filed as QA
> evidence.
>
> The one string in it I am least sure of is the fourth banner sentence
> ("Editing your saved changes · saved 27 minutes ago · viewers still see the
> live version"). It is marked as a placeholder in the mockup's own caption.

### What the author sees and does

They press **Edit dashboard**. For a `pending` change they still get the
withdrawal dialog first (or not — section 7). Then the grid they see is the
one their draft holds: the row they deleted is gone, the tab they added is
there, the charts they resized are the sizes they set. The banner reads:

> **Editing your saved changes · saved 27 minutes ago · viewers still see the
> live version**

which is a fourth string in `ReviewBanner`'s author/draft branch, alongside
the three it already has. They move one chart, press Save, and the body posts
draft-plus-that-move, because `overwriteDashboard` reads
`dashboardInfo.metadata` and `dashboardLayout.present` and hydration has just
replaced both from the proposal.

"Show changes" stays withheld in edit mode, as it is today
(`AssetReview.tsx`, the `!editing` guard) — but its label and meaning need
revisiting, because in this mode the thing worth comparing against is live,
not the proposal. `DESIGN-lost-edits.md` 3.5 proposes relabelling it **Show
live version** for an author in working-copy mode; that reasoning applies here
unchanged and I would adopt it rather than re-derive it.

### What the reviewer experiences

Better than today in one specific way: the thing the author saves is a
revision *of* what the reviewer saw, not a replacement of it. On a
`changes_requested` change — the journey from correction 1 — the reviewer's
objection is addressed on top of the version they objected to, which is the
only way "request changes" means anything.

### What it costs to build

Less than its history suggests, because every piece exists:

- **Extract the compose-and-hydrate half of `useProposedPreview.apply`**
  (`useProposedPreview.ts`, the `if (next)` dashboard branch) into one
  exported function — `hydrateFromProposal(changeRequest, { editMode })` —
  and call it from both places. `apply` passes `editMode: false`; the Edit
  press passes `true`. It must keep the `resolveSnapshotCharts` call. That
  function is the whole fix for the crash.
- **`Header/index.tsx::handleEnterEditMode`**: `await` the hydration, *then*
  `enterEditMode()`. Order matters — `enterEditMode` calls
  `clearDashboardHistory()`, so hydrating after it would leave an undo stack
  pointing at a layout that is no longer on screen.
- **Guard `SliceHeader/index.tsx:218` and `:222`.** Both reads. This is a
  one-line change each and it should land whether or not C does: a dashboard
  should not white-screen because a chart is missing from the store.
- **A fourth string in `ReviewBanner`** and the `onScreen` prop that
  `DESIGN-lost-edits.md` 3.5 specifies. Without it the banner will say
  "you and viewers are both seeing the live version" over the author's draft,
  which is QA-19 again with the sign flipped.
- **`restoreLive` keeps working unchanged.** It already refuses to act while
  `hostEditMode(state) || hostHasUnsavedChanges(state)`, and after a captured
  save `onUpdateSuccess` has cleared both before announcing — deliberately,
  per the comment at `dashboardState.ts:655`. So the post-save return to live
  still happens, and it is still live, which keeps D-05 and NEW-2 true at
  rest.

Call it two to three days with a browser pass, most of it in the banner
wording and the regression surface rather than in the hydration.

### How it fails, and what the user sees

- **The hydration fails** — the draft's `json_metadata` will not parse, the
  dashboard GET 500s, `resolveSnapshotCharts` cannot reach a chart the draft
  added. Then **do not enter edit mode**. A toast: "Could not open your saved
  changes. Nothing has been changed." and the page stays in view mode with
  the banner intact. Entering edit mode on live with an open draft is the
  lossy state, and falling back to it silently is how this bug was born.
  `overlay()`'s current behaviour on an unparseable payload is to keep the
  live value and let approval surface the error — correct for a read-only
  preview, **wrong here**, and the extracted function needs a flag that makes
  a parse failure fatal in the edit path.
- **A chart in the draft's layout is unreachable** (deleted, or the author
  lost access to its dataset). `swapUnreachableChartSlots` replaces the slot,
  so the page renders — but the author is now editing a layout that quietly
  differs from their draft, and their save will post the substitution. This is
  the case I am least sure about and it needs a browser test of its own: a
  draft that adds chart X, then X is deleted by someone else, then the author
  presses Edit. My guess is that it currently renders a placeholder slot and
  saves it; I have not run it.
- **The page is slower to enter edit mode** by one dashboard fetch plus one
  `/charts` fetch, plus up to one Explore fetch per chart the live payload
  lacks (bounded at six concurrent). On the measured dashboard the draft holds
  three of live's ten charts, so zero extra fetches. A draft that *adds* five
  charts costs five. The Edit button needs a spinner, and
  `handleEnterEditMode` currently has no busy state.

### Which fixed rules it stresses

**SOW 5.5, directly and deliberately.** "An author with an unsubmitted draft
sees the LIVE asset until they turn on Show changes." In edit mode they would
now see the draft without turning anything on. My reading is that 5.5 is a
rule about the *viewing* surface — its concern is that "has this gone live
yet" stays answerable by looking — and that an edit canvas is not a viewing
surface. But it is your rule and your brief says it is not mine to redesign,
so this needs an explicit addendum signed the way D-05 was, not an implicit
reinterpretation in a commit message. The honest framing for the addendum:
*the author sees live everywhere except inside an edit session on their own
open change, where the banner says which version is on screen.*

Nothing else is stressed. One open change per asset holds (there is still one
request; it is being revised). Self-approval is untouched. No history is
added — the draft is still a single mutable payload.

---

## 5. Option D — open on live, merge the layout on save

Leave the canvas alone; make the *body* right. The author's session edits are
applied on top of the draft rather than on top of live.

The layout is a flat object keyed by component id
(`position_data` / `metadata.positions`), which makes it the one part of this
payload that is genuinely mergeable. At Edit-press time, snapshot the
hydrated layout as `L_live`. At save time you have `L_now` (live plus session
edits) and `L_draft` (from `openChange.proposed`). Post
`L_draft` with the per-key difference between `L_live` and `L_now` applied:
keys the session added or changed overwrite the draft's, keys the session
removed are removed, keys the session did not touch keep the draft's value.

### What the author sees and does

Nothing. There is no new screen. They edit live, press Save, and both their
draft's changes and their session's changes are in the result. The toast
reports what was saved, as now.

### What the reviewer experiences

Nothing new. The request accumulates, as it does today for every other
partial-body save.

### What it costs to build

A merge function and a snapshot, both in the dashboard header or beside it.
No backend change — the server already accepts a `json_metadata` that states
a layout, and this just states a better one. No hydration, no new modal, no
banner wording.

### How it fails, and what the user sees

Silently, which is why I would not ship it as the answer.

The merge is right only while the two sets of edits are disjoint *as keys*.
They are frequently not:

- The author's draft deleted a row; this session moves a chart that was in
  that row. The move names a parent that the merged layout does not contain.
- The draft reordered a row's children; this session adds a chart to that
  row. The row's `children` array is one key, and both sides rewrote it. Last
  writer wins and one of the two intents is lost — with no tripwire, because
  the body now agrees with neither live nor the draft, and
  `layout_put_back` only reports components the body returns *to live*.
- The draft renamed a tab; this session deletes that tab. Coherent, but the
  merged result depends on key order in a way no one can reason about.

There is also a correctness argument against it that is worth stating
plainly: the result is a layout **that was never on anybody's screen**. That
is the exact objection `_fold_into`'s docstring raises against merging inside
`params` — "would hand the approver a chart that was never on anybody's
screen" — and it applies with equal force to a layout. A reviewer would be
approving a composition no author ever looked at.

Keep D in mind for one narrow thing only: if C ships and an author's *second*
tab is still on a live-seeded canvas, D's snapshot is a cheap way for that
tab to not destroy the first tab's work. That is a hardening, not a fix.

### Which fixed rules it stresses

None textually. It stresses the thing the SOW is for: the reviewer sees a
version somebody intended.

---

## 6. Option E — a server-side working copy

Named so it is on the record, and rejected.

Give each open change a shadow asset: on first save, copy the live dashboard
to a hidden row, apply the payload to it, and point the author's edit session
at *that* id. Edit mode needs no special seeding because it is editing a real
dashboard. Approval copies the shadow over the live row.

It fixes everything and it costs the most of anything here. It needs a new
table or a `is_shadow` flag on `dashboards`, careful exclusion from every list
page, every search index, every permission check, the thumbnail worker and
the MCP surface; it changes what approval does from "replay a payload through
the shipped command" to "copy a row", which is the single architectural
decision this feature was built to avoid (`models.py:76`: "Approval replays
that payload through the shipped update command, which keeps this feature
correct across Superset upgrades"); and it means the asset's chart set exists
twice, so a chart edited in the shadow is either shared with live (and leaks)
or copied too (and now the whole asset graph is doubled).

No. Not for this delivery, not for the next one.

---

## 7. The withdrawal, since you asked whether to question it

Question it, and move it.

Today's order is: press Edit → confirm "Withdraw and edit" naming Priya →
request becomes `draft` → edit mode opens. The disclosure is right and the
timing is wrong. The author has not done any work yet, so the thing they are
being asked to trade away is being spent on a maybe. An author who presses
Edit to *look* at something, or who presses it and then exits, has emptied
Priya's queue and Priya is never told why.

Proposed order: press Edit → a dialog that **tells** without **doing**:

> **Editing takes this out of review**
>
> Priya Shah has this in Needs my review. As soon as you save an edit it comes
> back to you as a draft and leaves her queue, and you request review again
> when you are ready.
>
> [ Edit ]  [ Cancel ]

No withdrawal on the press. The save does it, which the server already does
(`left_review`), and `UPDATED_LEFT_REVIEW_MESSAGE` already says so. An author
who edits and exits without saving leaves the request `pending` and Priya's
queue untouched, which is what should happen.

Cost: delete the `withdrawRequest` call from `WithdrawModal`'s `onConfirm` in
`AssetReview.tsx:655`, keep `announceEditAfterWithdraw`, rename both it and
the modal (they would now be lying about what they do), and check that
`hasDraftToSubmit` / `isAwaitingReview` in the toolbar still read correctly
while the request is `pending` and the author is in edit mode — today that
combination cannot happen, and after this it is the normal case. The
"Request review" button's tooltip currently says "Already with a reviewer.
Save an edit to take it back out of review", which is already the right
sentence for the new world.

Keep the banner's own **Edit** button pointing at the same dialog, so the two
Edits stay one decision — that was the whole point of `dada26e039` and it
should not be undone.

Drawn as frame **C2** in
`local_extensions/asset-approval/qa/mockups/mockup-option-c-seed-edit-canvas-from-draft.png`.

---

## 8. Sub-question: should the tripwire become a pre-save confirmation?

**Yes, and it should stop being a success toast either way.**

Today it is `put_back_sentence` (`http.py:243`) appended to the 202's
`message`, surfaced through `reviewRequiredToast` as a ten-second green
`addSuccessToast` with "Review changes →" beside it. Three things wrong with
that, in descending order:

1. It is styled as a success. "This save undid 3 layout changes your draft had
   made" is not a success.
2. It is dismissible and timed. Ten seconds for a sentence that may name five
   components and then say "and 4 more".
3. The link goes to the Approvals page, which cannot recover anything.

**What the dialog should say**, if it becomes a confirmation (this is
Option B's dialog, stated once properly):

> **This replaces the changes you already saved**
>
> What is on screen started from the live dashboard, not from your saved
> changes, so saving now puts these back the way they were:
>
> · Removed chart: Quarterly Revenue (By Product Line)
> · Removed row
> · Changed tab: Sales Overview
>
> There may be more — open **What changed** to see everything your saved
> version holds.
>
> [ Keep my saved changes ]   [ Replace them ]

Drawn as frame **B2** in
`local_extensions/asset-approval/qa/mockups/mockup-option-b-confirm-before-the-save.png`,
with the no-list variant as **B4** and the warning toast as the right-hand
half of **B3**.

`Keep my saved changes` is the default (focused, primary). `Replace them` is
danger-styled. There is no "don't ask again": the condition is rare once C
lands, and a suppressed warning about silent data loss is not a warning.

Two things it must **not** have. No third button offering to merge — that is
Option D and it should not be a choice made under time pressure in a dialog.
And no claim of completeness, because `reverted_fields` is deliberately
conservative (`changes.py`: "Anything unreadable answers nothing"), so the
list can be short when the loss is not.

The list needs the dry-run route from section 4. If that route is not built,
the dialog still ships with the count-and-age wording and the **What
changed** button; weaker, still better than green.

**And keep the after-the-fact sentence.** It is the only thing that reaches a
REST or MCP caller, who never saw a dialog, and `http.py`'s own comment says
so. Move it out of `addSuccessToast` into a warning toast with no duration,
and leave the text as it is — "written as what happened, not as an
accusation" is the right register and I would not touch a word of it.

---

## 9. Sub-question: should Save and Request review be separate actions?

**Yes. Leave them separate.** This is the part of the current design I think
is fine, and the pressure you are feeling is coming from somewhere else.

The case for merging looks strong from the journey you described: the author
saves, and the save takes the change out of review, so now they have to
remember to put it back. Two buttons, and one of them silently undoes the
other's effect. Why not one **Save and send for review**?

Because the two buttons answer two different questions, and the second one
has a reviewer's time on the other end of it:

- `draft` → save means "park this, I am not finished". The SOW gives this
  state a name and a behaviour (5.5: viewers never see it) specifically so an
  author can stop halfway. Merging the buttons removes the ability to stop
  halfway, and an author who cannot park work will not request review until
  the end — which is the same outcome Option A's critics worry about.
- `pending` → save means "I am changing what you are looking at". Automatically
  re-submitting would send Priya a second notification for every keystroke-level
  save, and `gate.py:649` deliberately *clears the note* on a save that leaves
  review, because "the note was written to tell a reviewer what they were being
  asked to look at, and the content has just changed underneath it". An
  auto-resubmit would send her a change with no note, repeatedly. The comment
  there records a tester rating that "the worst thing they hit".

Three things I would do instead, none of which is a merge:

- **The toolbar already tells the truth; let the banner finish the sentence.**
  After a save that left review, the response says "Changes updated in your
  draft, which has been taken back out of review. Request review again when
  you are ready." The banner then re-reads and shows the `draft` wording with
  a **Request review** button. That chain works. What is missing is that the
  author is dropped out of edit mode by `setEditMode(false)`
  (`dashboardState.ts:644`) on every captured save, so an author making three
  edits in a row re-enters edit mode three times. **That** is the friction, not
  the button count, and under Option C it is also three hydrations. Worth
  fixing on its own: stay in edit mode after a captured save, and let
  `restoreLive` keep its current guard (it already declines while editing).
- **Make the second save's status visible in the toolbar**, which it is: the
  Request review tooltip changes between "Ask another editor to approve your
  saved draft" and "Already with a reviewer". Good as it stands.
- **Do not add a "save and resubmit" shortcut** until someone has watched an
  author do this more than twice in a session. I have no evidence that they
  do; the brief asserts "an author who saves repeatedly while a change is in
  review" and I could not find a log or QA row showing it. If it turns out to
  be real, the right shape is a checkbox in the existing Request review dialog
  ("Send to Priya Shah again when I save"), not a merged button — that keeps
  the note, which is the thing worth protecting.

---

## 10. What I would ship, and in what order

**Ship C.** Edit mode must open on the author's own work. Everything else in
this document is a way of making the wrong canvas less dangerous, and the
wrong canvas is the defect. The two reverted attempts failed on a specific,
now-understood mechanism — a layout hydrated against the wrong chart set —
and the function that reconciles those two halves already exists and is
already in production use behind the Show-changes switch. C is not a new
capability; it is calling the existing one from a second place.

C also needs B. Not as a fallback — as the backstop for the surfaces
hydration cannot reach: a REST client, an MCP tool call, the Properties
dialog on a second tab, a bookmarked `?edit=true` URL opened before the draft
existed. Those will keep posting live-seeded bodies forever, and the only
protection available to them is the server's comparison and the sentence it
produces.

**If one thing lands this week, land the two-line guard in
`SliceHeader/index.tsx` (lines 218 and 222) and nothing else from this
document.**

I want to be clear about why, because it is not the exciting answer. That
guard does not fix the lost edit. What it does is remove the reason C was
reverted twice. Right now anyone who tries to seed the canvas from the draft
is one missing chart away from a white page, and that is enough to get the
attempt reverted a third time. With the guard in, the worst outcome of a
chart/layout disagreement is a chart that renders as an error card on a
dashboard that still works — which is survivable, debuggable, and reviewable.
It is the cheapest thing on this list and it is the thing that makes the
right fix landable.

If you want something the author can *see* this week instead, take Option B's
cheap variant: the pre-save dialog with the count-and-age wording and a
**What changed** button, wired inside `overwriteDashboard` so all three save
routes get it, plus moving the put-back sentence out of `addSuccessToast`.
That is a day, it is frontend-only, and it converts a silent High into a
dialog the author chose. It does not fix the journey, and the next person to
read the QA list should not be told that it did.

What I would **not** ship: Option A, except as the behaviour C falls back to
when hydration fails — which is exactly what section 4 says it should do. A
refuse-and-discard product is worse than the bug for the one journey that
matters most, and shipping it would teach Visa's editors to never save a
draft.

---

## 11. What needs deciding before anyone writes code

1. **The SOW 5.5 addendum** (section 4). Does "the author sees the live
   asset" govern an edit session on their own open change? C needs a written
   answer, signed the way D-05 was.
2. **Where the put-back list comes from** (section 4): the dry-run route, or
   the cheap dialog without a list. This is the difference between a day and
   three days, and it is a product call about whether the author is shown what
   they are about to lose.
3. **Whether the Edit-press withdrawal moves to save time** (section 7).
4. **Whoever has the two reverted seeding diffs should check correction 0's
   inference.** If those attempts did call `resolveSnapshotCharts` and still
   crashed, my cost estimate for C is wrong and this document needs a
   revision before anything is built.

## 12. Things I am guessing about, stated as guesses

- That the reverted attempts skipped `resolveSnapshotCharts`. Inferred from
  the crash signature; the diffs are not in this branch.
- What happens today when a draft's layout references a chart someone else
  has since deleted, and the author presses Edit under option C. I expect
  `swapUnreachableChartSlots` to substitute the slot and the save to post the
  substitution. Not run.
- That an author saves repeatedly while a change is in review often enough to
  motivate merging Save and Request review (section 9). I found no log or QA
  row for it.
- That `last_modified_time` cannot reach the stored payload (correction 8).
  Read from `DashboardPutSchema`, not measured against a captured payload.
- The cost figures. Half a day for A, a day for B-cheap, two to three for C.
  Those are my read of the diffs involved, not an estimate anyone has
  committed to.
