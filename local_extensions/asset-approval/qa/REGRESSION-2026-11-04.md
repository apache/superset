# QA run, 2026-11-04 — five parallel sweeps, localhost:9002

## The run's own caveat, first

**The instance did not execute the working tree.** The extension loads from
`<ext>/dist/`, not `backend/src/` (`superset/extensions/utils.py:351`;
`LOCAL_EXTENSIONS` in `superset_config_docker_light.py:84`). The loaded artifact
was HEAD (`1653dea651`): it has the no-op status guard, and `dist` contains **0**
occurrences of `fold_fields` and `reverted_fields` against 12 and 5 in source.
Three of the five agents found this independently.

So: the gate behaviour below is HEAD's. The uncommitted lost-edits work was
exercised separately, in its own process inside the same container, against the
same database and the real WSGI stack. `dist` was restored byte-for-byte
afterwards and verified.

Making 9002 run the branch needs `SKIP_FRONTEND=1 ./build.sh` plus a container
restart. The restart was declined to the agent that asked; it has not been done.

## Totals

| Sweep | Rows | Pass | Fail |
|---|---|---|---|
| Dashboards | 38 | 33 | 5 |
| Charts | 17 | 13 | 4 |
| Datasets | 28 | 23 | 5 |
| Lost-edits work (8 claims) | 8 | 7 verified | 1 contradicted (the premise) |
| Audit criticals | 7 | 5 reproduced | 2 not reachable (MCP not served) |

## Confirmed sound, and worth saying plainly

Maker-checker holds everywhere tested: the author is refused (403), an Admin who
is not an eligible editor is refused (403), a viewer cannot write (403). The
stale-revision guard fails closed (409). One-open-request-per-asset names the
holder. QA-18's unpublish/edit/republish loop launders nothing. QA-24's baseline
refuses a stale apply and names the moved field. The 2026-11-03 high — a no-op
save destroying a *submitted* request — is fixed in HEAD and verified on both the
chart and dataset surfaces.

## New defects this run found, not in UNGATED-INVENTORY-2026-11-04

| # | Severity | Defect |
|---|---|---|
| N1 | **High** | An id-only `modified` entry in a native-filter or chart-customization diff passes the gate as a no-op, and the DAO then **replaces** the entry: a reviewed filter config on a live published dashboard is reduced to `{"id": "..."}`, HTTP 200, no change request. `_modifications_already_hold` iterates only the keys the diff carries, so `{"id": x}` trivially "already holds". Present in current source. The docstring states the design choice that causes it, and that a gate "is only allowed to be wrong in the direction of capturing too much" — here it is wrong the other way, and destroys data |
| N2 | **High** | An exempt field sent **with** a governed field is held (correct: `_only_exempt` is per-write), shown to the reviewer with before/after, approved — and then dropped, because `replay.py:216` strips `EXEMPT_FIELDS` before replay. The author's edit is lost and the approver approved something that did not happen. Found independently on the chart and dataset surfaces. The strip itself is right (129071); the disagreement is that capture is per-write and replay is per-field |
| N3 | **High** | Approving an `?override_columns=true` save does not reproduce the author's change: a column the source does not list survives approval, where the direct save drops it. `DatasetSaveWithRefresh` nests update and refresh in one transaction while the direct route commits twice; the refresh's attribute writes survive the nesting, its orphan removal of a not-yet-committed column does not |
| N4 | Medium | `POST /api/v1/dashboard/<uuid>/purge` is ungated, as the dataset equivalent is. One editor can make an approved delete irreversible and remove the reviewed restore path as a remedy |
| N5 | Medium | `DELETE /api/v1/theme/<pk>` is itself ungated (200) — themes are not a gated asset type — **and** it nulls `theme_id` on bound published dashboards |
| N6 | Medium | A sole editor cannot delete a never-published draft: the delete is held, then submit returns 422 with no eligible approver. Asymmetric with `_gate_dashboard_update`'s draft exemption |
| N7 | Medium | A chart created through `?action=saveas` gets `editors=[author]`, so its first governed change can never be submitted. The ungated creation path produces assets the gated path cannot govern |
| N8 | Low | A save that replaces a pending delete keeps the delete's note, so the approver reads "delete it" as the note on a rename. `gate_delete` passes `clear_note` for the opposite direction; `gate_write` never does |

## R7-06's real blast radius

Worse than "REST and MCP". The shipped dashboard **Properties dialog** posts nine
fields and not `position_json`. So: edit the layout, save, open Properties, save
— the author's entire layout edit is gone, the response says "Changes updated in
your existing draft", and `reverted_fields` is empty because the tripwire only
looks at fields present in both draft and body. Three faults compound: the draft
is replaced, the message asserts the opposite, and the tripwire is structurally
blind to it.

Confirmed live on all three surfaces. The fix is deployed on none of them, and in
the working tree `fold_fields=True` is added only to the chart and legacy-slice
gates — **the dataset and dashboard gates still lack it**. The empty-body
draft destruction has exactly the same scope, so one change closes both.

## Corrections to UNGATED-INVENTORY-2026-11-04

- **A2**: the create path writes **no** `dashboard_slices` rows. `DashboardPostSchema`
  has no `slices` field. Charts arrive via A5 as a second call.
- **A9** (the refresh exemption), measured on a physical Postgres dataset:
  - *confirmed*: it drops author-created columns; it forces `groupby` and
    `filterable` true on every column.
  - *refuted on this engine*: it does not overwrite `description` (only written
    under `if col.get("comment")`, and these columns have none), and it writes no
    `datetime_format` (the detector found nothing to write on real `TIMESTAMP`s).
  - *new, not in the audit*: it **reverts an author's approved column type**
    (BIGINT → INTEGER) and rewrites every physical column's `expression` from
    null to `""`.
  The exemption's stated reason ("it re-reads what the source says") is still
  wrong, but for different reasons than the audit gave.
- **A11** (`folders`): `DATASET_FOLDERS` is OFF here and core's own validator
  rejects the write before the gate, so this is not reproducible end to end. The
  gate's blindness is confirmed in-process: rename, re-parent and add all yield
  `changed_fields: []`; only emptying the list registers, and then only because
  `_is_nothing([])` short-circuits.
- **A1 / B1**: MCP is not served here and `docker-compose-light.yml` defines no
  such service. Both stay code-only. No non-MCP path produces B1's corrupt
  payload shape.

## Not covered

Every row asserting rendered UI — banners, "Show changes", version-history notes,
list-row tags, the chart-preview switch, the review dialog's tabs. The agents were
barred from the browser to keep five parallel sessions from sharing one cookie jar.
The extension's frontend bundle also cannot currently be rebuilt (54 ts-loader
errors, 35 of them in files this branch never touched; `tsc --noEmit` on the same
config reports 0), so the /approvals page serves the Nov 3 build regardless.

QA-01, QA-06 and QA-08 remain unidentified: their text is in no QA document, the
extension source, or the tests. Not run, not passed.

---

# Browser pass, 2026-11-04, after the restart

The container was rebuilt backend-only (`SKIP_FRONTEND=1 ./build.sh`) and
restarted, so **the branch code was finally executing**: `reverted_fields`
appears in the 202 body and a second partial chart save folds instead of
replacing. Driven through Chrome as **alex**, an Alpha editor and not an admin,
with **priya** as reviewer. Every change request raised here was discarded and
the three assets verified back at baseline.

The extension's frontend bundle is still the Nov 3 build and cannot be rebuilt,
so anything served by the /approvals page is old code. Where that matters it is
said below.

## Passing, observed on screen

| Row | What was seen |
|---|---|
| Author toast after a held save | "Changes saved. Viewers still see the live version. **Review changes →**" |
| Author banner | "Your changes are saved … · you and viewers are both seeing the live version · turn on Show changes to see yours" |
| List-row pending tag | `Changes pending` renders beside Published on the dashboard list |
| List-row returned tag | `Changes requested` renders on the dataset list |
| Chart review preview | Toggling **Show changes** swaps the canvas to the proposal, banners it `Proposed version · not live until approved`, and labels the control panel `Live chart settings · not the version on screen` / "Frozen while a preview is on screen", with the controls disabled |
| Approvals queue, reviewer | Both requests listed, `Needs your review`, From/Waiting/Review columns, notification badge |
| Request changes | Note required (the button stays disabled until one is typed); helper text "Alex Rivera can update them and request review again. Nothing is lost." |
| Returned change reaches the author | Row appears on the author's Approvals tagged **Returned to you** with a **Request review** action |
| Reviewer queue updates | The returned row leaves the reviewer's "For me" queue immediately |

## Failing, observed on screen

**B1. R7-06, reproduced end to end through the real UI, on the fixed build.**
As alex: drag a chart onto published dashboard 112, Save → held, correct toast.
Then the properties dialog → rename → Apply. The resulting draft holds
`['certification_details','certified_by','css','dashboard_title','description',
'editors','json_metadata','slug','tags','theme_id']` and **no `position_json`**.
Live `position_json` is still empty. The chart placement now exists nowhere —
not live, not in the draft — and nothing told the author. This is on the build
where the fold fix *is* deployed, confirming the fix does not cover dashboards.

**B2. The author's own "What changed" panel reports the loss as one opaque row.**
After the above, the panel reads `WHAT CHANGED · 1 CHANGE` / `Dashboard
settings` / `Changed`. The author cannot see what was captured, let alone what
was dropped. (Evidence captured.)

**B3. The reviewer is asked to approve "No column changed."**
A dataset change whose only content is a column `warning_markdown` of
"**DO NOT USE** this column, it is being retired" renders as: Source 0,
Metrics 0, Columns 0, body text **"No column changed."**, with Approve enabled.
The impact alert correctly says "Used by 1 chart on 0 dashboards." This is **not**
a stale-bundle artifact: `COLUMN_FIELDS` is unchanged in the working tree (the
api.py diff is additive only, for `_dataset_settings`). (Evidence captured.)

**B4. Explore reopens on the live chart after a held save.** The Row limit
control snapped back from the saved 500 to the live 100. The preview feature
makes this honest rather than silent — the panel is explicitly labelled "Live
chart settings" — but the author's draft values are not restored into the
controls.

**B5. Two "Request review" buttons disagree.** In dashboard edit mode the
toolbar's button is disabled with the tooltip "No changes to review yet" while
the banner's own Request review, inches away, is enabled and the asset has an
open draft.

**B6. No "Edit properties" in the dashboard's view-mode menu** for an editor who
can clearly edit the dashboard; it appears only in edit mode. Minor, but it is
why the properties dialog was reached through edit mode above.

## Fixed in source, undeployable

`review_note` is **not** shown to the author on the Approvals page in the running
build — but `Approvals.tsx:220` in the working tree reads it
(`const note = row.review_note?.trim()`), keyed on status rather than on the note
being present. So the client's sc-131033 note complaint is **fixed in source and
blocked by the frontend build**, not unfixed. Nothing on the /approvals page can
be demonstrated until the 54 ts-loader errors are resolved.

---

# Closing the list: MCP stood up, and the three unknown ids recovered

## The MCP surface is no longer "code only" — all four findings reproduced

The service was started inside the running container via `superset mcp run`
(the supported entry point) with no compose change and no restart, then stopped.

**M1 (was A1) — CRITICAL. A read-only principal permanently rewrites a live chart.**
`get_chart_preview` is tagged `["data"]`, and `superset_core/mcp/decorators.py`
documents that `method_permission_name` "Defaults to 'write' if tags includes
'mutate', else 'read'" — so the tool requires only **`can_read Chart`** [V].
A purpose-made user holding `can_read`/`can_export Chart` and no write permission
anywhere called it with a `form_data_key`. Chart 278 went from
`viz_type=table` to `viz_type=pie` with `groupby: ["POISONED_BY_PREVIEW"]`,
`changed_by_fk` set to the read-only caller, **on a call that returned an error**.
No version-history entry, no change request, and the error message says nothing
about the chart having been rewritten.
The commit vector was isolated by counterfactual: an identical call against a
second listener differing only in `EVENT_LOGGER = StdOutEventLogger()` left the
chart untouched. So `DBEventLogger.log`'s own `db.session.commit()` is what
flushes the dirty `Slice`. The write never goes through `UpdateChartCommand`, so
no bound path fires — this bypasses the gate entirely, not merely RBAC.

**M2 (was B1) — worse than "unapprovable": it takes the asset's review slot hostage.**
Both `add_chart_to_existing_dashboard` and `remove_chart_from_dashboard` store
chart **names** where ids belong (`"slices": ["CGV-chart-on-dash", "CGV-chart-to-add"]`,
while the baseline in the same row stores `["276", "277"]` — the two halves of one
row disagree about what a slice reference is). Approving returns **HTTP 500**
with `AttributeError: 'str' object has no attribute '_sa_instance_state'` at
`daos/base.py:549`. The request is then stuck `pending` with `active_slot=1`:
the dashboard is locked against every other editor's change request until someone
withdraws or discards it. Note the bug only bites when a remainder survives — a
removal that empties the list stores `[]` and replays fine.

**M3 — `delete_dataset_metric`: both halves confirmed on a live instance.**
The metric was deleted with no hold and reached viewers immediately, *and* the
author's unrelated open draft went `draft` -> `discarded` with its content
neither applied nor kept.

**M4 — `create_dataset_metric`: approval succeeds and silently destroys data.**
Approve returned **200 "Changes approved and published."** and the dataset's
other two metrics were gone, the survivor rebuilt with a new id. The tool's own
docstring promises "Existing metrics are preserved"; that holds for the author's
call and is reversed by the approval. Nastier than M2 because nothing errors.

**Incidental upstream bug:** `python -m superset.mcp_service` cannot start
standalone. `__main__.py:60` imports `app.py` at module scope, which pulls
`superset.models.core` and evaluates `encrypted_field_factory.create(...)` before
the Flask app exists -> "App not initialized yet". `superset mcp run` works.

**Stated limitation:** submit/approve were driven through Flask's test client
with a real session cookie set the way Superset's own suite does it. That
exercises the full view stack (`@protect()`, `_act`, `lifecycle.approve`,
`apply_change`), so the 500 and its traceback are the production path, but the
HTTP auth layer itself was not exercised.

## QA-01, QA-06 and QA-08 — recovered, after two runs of "unknown"

Not in the repo at all. They were recovered from this project's own Claude Code
session transcripts, which hold a 2026-10-29 clipboard export of the tracker.

- **QA-06** (Low): "README says the seeded chart is Deck.gl Grid; it is chart 1
  'Funnel'". A documentation row. Fixed in `d02f40dc08` [V], whose commit message
  names it; the diff is one line in the README seeded-assets table.
- **QA-08** (High): two simultaneous approvals both succeed and the change is
  applied more than once. QA's own case id is **TC-E5**. Fixed by taking a row
  lock before reading status — `lifecycle.py` [V] records that 129071 was the
  same bug re-found, and the lock is now taken by every transition, not just
  `approve`.
- **QA-01** (Medium): `make asset-demo` fails on a fresh checkout because the
  extension build cannot find the workspace packages' `lib/` output. Fixed in
  `c82bd739a4` and `dbc70b8f5e` [V]. Three causes: the Makefile pinned node 20
  where the packages need 24, nothing built the frontend packages before the
  extension, and a newline had crept into lerna's `--scope`.

Still missing: the tail of two titles (10-20 characters) and the Steps/Actual
columns for QA-01 and QA-08. Those are one copy-paste away from the tracker
sheet, rows 11 and 18.

**Follow-on:** `tests/unit_tests/change_management/test_every_qa_row_has_a_home.py`
exempts all three as "text exists only in the external tracker" [V]. That is now
false for QA-06 and QA-01, and QA-08 is already covered behaviourally by
`test_every_transition_takes_the_lock.py`. Also unresolved: the sheet marks QA-08
"Fixed (run 2)" while the closure notes say it rests on unit tests with no
two-session race ever reproduced, and E5 is listed among the scenarios R2-01
broke — so that run-2 pass predates the regression.
