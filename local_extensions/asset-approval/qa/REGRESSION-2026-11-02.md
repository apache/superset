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

# Asset approval — full regression before sign-off

Every row this epic has ever marked fixed, re-tested from a freshly seeded
demo. Run against `make asset-demo` on `docker-compose-light.yml`, in the
browser, as the account named.

## Why this run exists

Four rows have read **Fixed** while the behaviour they describe was still
there: S-01, R3-01, R4-06 and S-04. All four were written, reviewed and
unit-tested, and all four were caught only by using the feature.

They fail the same way. The fix goes on the path the test exercises and the
product uses a different one — FAB had already captured the bound method
(S-01); the visibility fix was real but Review still navigated to a dead
page (R3-01); the exemption sits on the refresh endpoint and the editor's
button does not call it (S-04). A test standing next to the fix passes in
every one of those cases.

So a passing suite is not evidence here. The only evidence that has ever
caught these is doing the thing a person would do, through the interface
they would use. That is what this file records.

## How to read it

- **Automated** — a unit test covers it and the suite is green. Listed, not
  re-walked, unless the row is one a test could pass while the product
  fails.
- **Walked** — done by hand in the browser, in the walk named.
- Each row says what was actually observed, not that it "works".

## The walks

| Walk | As | Covers |
|---|---|---|
| A | alex → priya | The round trip: capture, request, review, approve, history |
| B | sam, morgan | No viewer leak, no admin bypass |
| C | alex → priya | Delete, restore, and the draft they replace |
| D | alex → priya | Dataset editor: exemptions, empty saves, resync |
| E | alex | Native filters and the empty-save class |
| F | alex | No approver, and the editors picker |
| G | script | MCP write paths |
| H | admin | Feature flag off, and back on |
| I | CLI | Import refusal, both halves |
| J | morgan → priya | Embedded configuration |
| K | alex, priya | Concurrency: two approvals, stale baseline, lost editorship |

## Seeded starting state

`qa/seed.py`, which finishes with exactly one change waiting for priya on
**USA Births Names**, alex as the only editor of **Sales Dashboard** (the
no-approver case), sam an editor of nothing, and morgan an Admin who edits
nothing.

## Results

_Filled in as each walk runs._

| Row | What it claims | How checked | Result |
|---|---|---|---|
| QA-15 | A dashboard save captures 10 fields while What changed shows 2 | **A.** The panel read "WHAT CHANGED · 1 CHANGE", and named it: Title, ~~USA Births Names~~ → USA Births Names (Q4) | Pass |
| QA-19 | The author's banner says "Viewing your changes" but the dashboard shows the live version | **A.** Banner reads "Awaiting review · waiting a minute · Priya Shah can approve" with the live title on screen. Show changes switches the header to "USA Births Names (Q4)" and back | Pass, after a fix |
| NEW-2 | A captured save leaves the proposed title in the header | **A.** Header and browser tab both show the live title while the banner says so | Pass, after a fix |
| QA-20 | Request review is enabled when nobody can approve | **A.** Banner names the approver by name before anything is pressed | Pass |
| QA-22 | "Open live version" opens a raw top-level tab outside the host app | **A.** The link is `/superset/dashboard/7/` with no `target`, so it stays in the app | Pass |
| QA-16 | Version history does not show "Approved by … + note" | **A.** Entry reads "Latest save · Alex Rivera", then "Approved by Priya Shah", then "Dashboard renamed to 'USA Births …'". Credited to the author, not the approver. **The author's note is still not shown in the panel** | Pass on the label and attribution; note outstanding |
| R2-01 | Approve publishes but never records the approval | **A.** `status=approved`, `active_slot=NULL`, `reviewer=priya`, `decided_at` set, and the title is live | Pass |
| — | The bell counts and names what is waiting | **A.** Badge 1, "NEEDS YOUR REVIEW / USA Births Names / Alex Rivera". Copy nit: it reads "waiting 5 minutes ago", which double-counts; the table says "5 minutes" | Pass, with a copy nit |
| S-08 | A viewer (Gamma) can reach the workflow | **B.** As sam, with a change pending: `change_request/asset/dashboard/7` → `null`, `count` → 0/0, `open/dashboard` → `{}`. The dashboard has no Edit button, no banner and no "Changes pending" tag | Pass |
| NEW-6 | `/approvals` renders its shell for a viewer | **B.** It does render for sam, and says "Nothing is waiting for you right now". A Gamma can author charts, so the page is legitimately theirs. The part that was wrong — the **anonymous** role holding `can_approve` and the page — is fixed and verified in the role table | Pass |
| — | No administrator bypass (Visa Q1, SOW 9.3) | **B.** morgan is Admin and an editor of nothing: queue 0/0, cannot see the request at all, and `approve` / `request_changes` / `discard` on it are each 403 | Pass |
| QA-10 | Wrong refusal wording for discard/withdraw/request changes | **B.** The three refusals are distinct and correct: "You cannot approve this change." / "You cannot review this change." / "You cannot discard this change." | Pass |
| — | One open change per asset, admin included | **B.** morgan's `PUT /api/v1/dashboard/7` → 409 "Alex Rivera already has changes open on this dashboard. Only one set of changes can be open at a time." | Pass |
| — | *Observation, not a defect.* Superset etag-caches `GET /api/v1/dashboard/<id>?q=(columns:…)`, so after an approval applies, a browser that fetched the old version keeps showing the old title until its cache expires. Cost me half an hour chasing a phantom leak after I set state up with raw SQL instead of through the product | **B.** `cache:'reload'` on the same URL returns the live title | Worth telling QA |
| NEW-11 | A capture made from a list row leaves the row's tag stale | **C.** Archiving "Genders by State" from the chart list: the chart stays in the list and the row shows "Changes pending" without a reload | Pass |
| QA-05 | A delete says "submitted for review" but stays a Draft | **C.** The queue shows it as **Draft** with a **Request review** action, and says so | Pass |
| QA-17 | Restoring an archived asset bypasses review | **C.** Archive is captured, not applied. The reviewer's panel says "This asset would be removed once approved" and carries the author's note. Only on Approve does the chart go (`GET /api/v1/chart/69` → 404) | Pass |
| R3-01 | A restore creates a change request nobody can submit, approve or discard | **C.** Restore is captured; it appears in the author's queue as a Draft with Request review; it reaches the reviewer; **Review opens the approve dialog in place** rather than navigating to the archived asset's dead page; approving brings the chart back (200) | Pass |
| QA-20 | Request review is enabled when nobody can approve | **C.** The dialog names "Who can approve: Priya Shah" and explains "Puts it first for them. Anyone above can still approve." and "Your changes lock while they wait. Editing withdraws the request." | Pass |
| **New, fixed in this run** | An approved **delete** was recorded as archived by the **approver**, not the author who asked for it | **C.** Recently archived read "Archived by Priya Shah" for Alex's delete; `slices.changed_by_fk` was the approver. The replay already runs as the author (QA-16), but the audit columns are filled at *flush*, and the delete commands only stage, so the stamp landed after the override had gone. Flushing inside the override fixes it; an approved restore now records the author | Fixed |
| — | *Copy, not behaviour.* The archive dialog says "You can recover it there within 30 days"; the approve dialog for the same delete says "This removes the chart. **It cannot be undone.**" Both cannot be right, and the restore flow proves the second one wrong | Worth fixing |
| — | *UX.* After approving a delete from the asset's own page, the reviewer is left on the deleted chart's Explore page showing "Missing dataset — The dataset linked to this chart may have been deleted". Wrong noun, dead page. Same class as R3-01's second half | Worth fixing |
| — | *UX.* Restoring from Recently archived gives no feedback at all: the row stays (correctly — it is captured, not applied) and nothing says so, which invites a second click | Worth fixing |
| S-01 | The legacy dataset save bypasses review and changes the live dataset | **D.** `POST /datasource/save/` as alex with a changed description → **422**: "Saving a dataset through the legacy endpoint needs review… Save the dataset from its editor, or through PUT /api/v1/dataset/<id>". The description is unchanged. The rebinding reaches the route this time | Pass |
| QA-02 | A legacy dataset save that fails still deletes the dataset's editors | **D.** After the refusal above the dataset still has both editors and all four columns: nothing was mutated before the refusal | Pass |
| S-04 | Sync columns is refused / reviewed, SOW says exempt | **D.** The dedicated refresh endpoint was already exempt; the editor's **Sync columns from source** button was not, and captured a VARCHAR→TEXT change on all four columns. Fixed in this run; the sync now applies directly and the types land | Pass, after a fix |
| NEW-4 | Every dataset save reads as a columns + metrics change | **D.** Opening the dataset editor and pressing Save with nothing changed writes cleanly and captures nothing | Pass |
| NEW-7 | The editor posts a normalised column type | **D.** Does not reproduce — see the report. Chasing it is what turned up S-04 | Not a bug |
| QA-12 | **Critical.** Fails open: flag on, extension not loaded, edits go live | **H.** Ran with `LOCAL_EXTENSIONS = []` and the flag on. Dataset PUT and dashboard PUT both → **503 `CHANGE_MANAGEMENT_UNENFORCED`**: "Change management is enabled but no review gate is installed, so this write cannot be reviewed and has been refused." Neither write applied | Pass |
| QA-23 | With the flag off, Settings still shows the Approvals entry | **H.** With `CHANGE_MANAGEMENT: False` the Settings menu has no Approvals and no Change review entry, and `change_request/enabled` → `false` | Pass |
| QA-24 | Requests left open while the flag was off come back and overwrite edits made in between | **H.** Edited dashboard 7 directly while off (applied, 200). Flag back on, priya approves the still-open request → **409**: "This field has changed since this change was captured (dashboard_title). Approving would publish the older version over it. Ask the author to save again, or discard the change." The edit made while off survived | Pass |
| S-03 | Approving reverts exempt changes made while it waited | **H.** The stale-baseline half is covered by the refusal above: the approval will not publish over something that moved | Pass on this half |
| R4-08 | A native-filter save with no changes creates a change request | **E.** Tick a checkbox and untick it, then Save: the modal closes and no request is created. Rename a filter and Save: one request, carrying that filter alone | Pass, after a fix |
| NEW-5 | Every dashboard save reads as a `json_metadata` change | **A'.** Entering edit mode and pressing Save with nothing changed is not even possible: Save is disabled, tooltip "Nothing new to save" | Pass |
| R4-07 | After the author's first save in edit mode, no draft banner or Request review until reload | **A'.** The banner, **Show changes**, **What changed** and **Request review** all appear immediately on the first save | Pass |
| QA-11 | Saving again into your own draft repeats "Changes saved" | **A'.** The second save says "**Changes updated in your existing draft.** Review changes →", distinct from the first | Pass |
| R4-01 | Saving a draft field back to its live value is ignored and the draft keeps the old proposal | **A'.** `PUT /api/v1/dashboard/7` with the live title while a draft proposed something else → 200 and the open draft is gone. *Not reachable from the dashboard UI any more*: with the header showing the live title (NEW-2), the editor opens on live, so typing live in is a no-op and Save stays disabled | Pass on the path where it can fire |
| QA-25 | Dataset editors/owners/description changes are never exempt, and can deadlock | **D.** Changing only the description in the dataset editor applied directly: the live description updated and no change request was created | Pass |

| QA-21 | No "Changes pending" tag on a chart inside a dashboard for editors | **A''.** With a change open on one chart of a dashboard, that chart's card carries the tag and exactly one tag is on the page. The card still shows the live chart name | Pass |
| QA-03 | Deleting an asset that has your open draft silently replaces the draft | **C'.** The archive dialog now carries a warning: "**This replaces the change waiting for review** — Only one change can be open at a time, so deleting this discards the edit that is waiting and asks a reviewer to approve the delete instead." | Pass |
| QA-04 | A filter change refused with 409 is silently dropped: no error, the filter just disappears | **E'.** With a draft already open, renaming a filter and saving → `PUT /api/v1/dashboard/6/filters` **409**, and a danger toast: "You already have other changes open on this dashboard. Submit or discard them before making this change." *I nearly filed this as data loss: my first screenshot was nine seconds late, the toast had gone, and I read the banner describing the existing draft as a success message for the filter. Re-running it with the network log settled it.* Residual: the modal still closes on the refusal, so the author retypes the filter name | Pass, with a residual |
| QA-07 | A change can still be approved after its author stops being an editor | **K.** Removed the author as an editor while his change waited. The request stays visible and is not auto-discarded; approving is refused **409**: "Alex Rivera no longer has edit access to this asset, so this change cannot be published as their work. Discard it, or restore their access and approve again." The live asset is untouched. Residual: `can_approve` still comes back `true`, so the approver is offered a button that will be refused — the recorded decision was to **show** them the author had lost access, and the payload does not say so | Pass, with a residual |
| — | *Core behaviour, not ours.* Removing **yourself** from an asset's editors is accepted with 200 and silently ignored; removing someone else works. Worth knowing before anyone reports it against this epic | Noted |

## Not walked in this run

Covered by the earlier passes or by the suites, and listed so the gap is explicit rather than implied:

| Row | Where it stands |
|---|---|
| QA-14, R4-02 … R4-06 | Walked by hand in the first pass on 2026-11-02 and unchanged since. R4-07 and R4-01 were re-walked here |
| QA-18, QA-26, S-02, QA-13, S-06 | Walked by hand in the second pass the same day |
| NEW-1, NEW-3, NEW-8, NEW-9, NEW-10, NEW-12 | Walked by hand when each was fixed. NEW-1 was re-checked here: no `beforeunload` warning after a captured save |
| S-05, S-07 | Unit-tested and visible in the role table; the rows stay open for VISA's lists, not for missing code |
| QA-08, QA-09 | **Not re-walked.** Unit-tested only. Both need two sessions racing, which a single walk cannot honestly reproduce. QA-03, QA-04, QA-07 and QA-21 were walked and are recorded above |
| QA-01, QA-06, S-09 | Environment and documentation rows, not product behaviour |
