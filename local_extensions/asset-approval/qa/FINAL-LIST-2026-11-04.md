# Asset approval: the final defect list

2026-11-04. Supersedes the counts in `UNGATED-INVENTORY-2026-11-04.md` and
`REGRESSION-2026-11-04.md`, which this consolidates and corrects.

Everything below was measured against `fix/qa-regression-93` **as deployed** —
the container was rebuilt and restarted, so the branch's uncommitted work was
executing. Items marked NOT REACHABLE say why. One sweep is still out; its
items are marked *pending*.

| Class | Count |
|---|---|
| A. The write escapes review entirely | 17 |
| B. Held, but approving applies something else | 8 |
| C. Held, but the reviewer is shown nothing usable | 21 |
| D. Structural | 4 |
| E. Workflow and wording | 5 |
| **Total** | **55** |

One candidate was **refuted** on test and dropped: `datasource_name` is not left
stale, because `UpdateChartCommand.validate()` re-derives it from the datasource
(`commands/chart/update.py:261`) whenever `datasource_type` is present, which the
gate always captures. Measured end to end through a dataset swap.

Of these, **2 are ours** (both 2 Nov, both a fix for over-capturing that
overshot). The rest predate the first build of the gate.

---

## A. The write escapes review entirely (17)

| # | Defect | Status |
|---|---|---|
| A1 | **MCP `get_chart_preview` permanently rewrites a live chart under `can_read Chart`.** No `mutate` tag, so the decorator defaults the permission to `read`. A read-only principal changed `viz_type` and `params`, credited to them, **on a call that returned an error**. No change request, no version history. Commit vector isolated by counterfactual: the same call with `StdOutEventLogger` leaves the chart untouched, so `DBEventLogger.log`'s own commit flushes the dirty `Slice` | **REPRODUCED — critical** |
| A2 | `POST /api/v1/dashboard/` with `published: true` creates a live published dashboard, no review | REPRODUCED |
| A3 | MCP `generate_dashboard` does the same with raw ORM and no command at all. Honestly declared a write (`tags=["mutate"]`), unlike A1 — it simply never routes through a command. Unlike A2 it **does** set `slices`, so one call lands a published dashboard *with* its charts | Code-only; MCP can now be stood up on demand |
| A4 | Legacy Explore `?action=saveas&save_to_dashboard_id=` attaches a chart to a published dashboard. The gate returns early unless the action is `overwrite` | REPRODUCED |
| A5 | `POST /api/v1/chart/` with `dashboards:[…]` writes the join row unreviewed. Succeeds even while an open change request exists on that dashboard | REPRODUCED |
| A6 | A first-time import carrying `published: true` lands a complete published dashboard and its charts, reachable by a viewer, with zero change requests. The product states the defect itself: re-importing the same bundle with `overwrite=true` is refused with *"An import that only creates new assets is unaffected."* | REPRODUCED |
| A7 | **`POST /api/v1/database/<pk>/upload/` onto an existing dataset — destructive, and the worst of the non-MCP escapes.** Needs only `can_upload Database`; `UploadCommand.validate()` checks no dataset editorship or ownership. A user who gets **403** trying to edit the dataset normally replaced its physical table: a viewer's rows went from two to one, with a figure rewritten and a column added, no review. A second upload pruned the columns and every chart on it began returning *"Columns missing in dataset"*. `already_exists=replace` makes it irreversible | **REPRODUCED, worse than written** |
| A8 | `DELETE /api/v1/theme/<pk>` nulls `theme_id` on bound published dashboards | REPRODUCED |
| A9 | **The theme delete is itself ungated** — themes are not a gated asset type at all | REPRODUCED |
| A10 | `POST /api/v1/dataset/<uuid>/purge` nulls `datasource_id` and all three `perm` columns on live charts. The reviewed step is reversible; the unreviewed one is not | REPRODUCED |
| A11 | `POST /api/v1/dashboard/<uuid>/purge` — same shape, makes an approved delete irreversible and removes the reviewed restore as a remedy | REPRODUCED |
| A12 | **MCP `delete_dataset_metric`** — `UpdateDatasetCommand(id, {}, delete_metric_ids=…)`. The empty body means no diff, so the delete reaches viewers unreviewed **and** the author's unrelated open draft is discarded, content neither applied nor kept | REPRODUCED, both halves |
| A13 | The `RefreshDatasetCommand` exemption is broader than its stated reason. Confirmed: drops author-created columns; forces `groupby`/`filterable` true on every column. **New:** reverts an author's approved column type, rewrites every physical column's `expression` to `""`. Refuted on Postgres: it does not overwrite `description` or write `datetime_format` | CONFIRMED with corrections |
| A14 | `folders` tree changes are invisible — `_differs` keys lists on `id`, which `FolderSchema` has not got, so both sides reduce to `{None}` | NOT REACHABLE (`DATASET_FOLDERS` off); gate blindness confirmed in-process |
| A15 | Annotation layers are not a gated asset type, so an Alpha who cannot rename an approved chart without review can inject attacker-chosen text that the chart serves. **Audience corrected:** a Gamma viewer does *not* see the text — `can_read Annotation` is Alpha-only, so their chart returns 400 "You don't have access to annotation layers" instead, which is a different defect. The audience that does see it is Alpha/Admin **and the Public role**, which is explicitly granted `can_read Annotation` [V] — so anonymous and embedded viewers get it. Constraint: the approved chart must already reference that layer, since adding the reference is a governed `params` change | **REPRODUCED, impact rewritten** |
| A16 | A new RLS rule silently changes the rows a viewer gets from an approved chart, with no change request and no edit to the chart the reviewer approved. **Admin-only — an editor gets 403**, so file it as a governance scope decision beside A17, not a gate failure | REPRODUCED as behaviour |
| A17 | `EXEMPT_FIELDS` covers `viewers` (access control), `certified_by` (a trust badge) and chart `description` (rendered to viewers). `editors` is the field the gate reads to decide **who may approve**, so an author can rewrite their own approver set with a 200. The author still cannot approve their own change, and SOW 5.4 requires the exemption — a governance decision to put to the client, not a bug | CONFIRMED |

## B. Held, but approving applies something else (9)

| # | Defect | Status |
|---|---|---|
| B1 | **MCP add/remove chart on a dashboard store chart *names* where ids belong.** Approving returns HTTP 500 (`AttributeError: 'str' object has no attribute '_sa_instance_state'`) and the request is left `pending` **holding the asset's only open slot**, so the dashboard is locked against every other editor until someone withdraws it. Only bites when a remainder survives | **REPRODUCED** |
| B2 | **MCP `create_dataset_metric`**: `preserve_existing_metrics=True` is not captured, so replay drops it. Approve returns **200** and the dataset's other metrics are gone, the survivor rebuilt with a new id. Silent data loss on approve | **REPRODUCED** |
| B3 | **`fold_fields` is passed only on the chart and legacy-slice gates.** On datasets and dashboards a second partial save replaces the draft while the response says "Changes updated in your existing draft". Reachable from the shipped dashboard Properties dialog, which posts nine fields and not `position_json`: layout save then Properties save destroys the whole layout edit. The revert tripwire is structurally blind to it. The same gap is the empty-body draft destruction — one fix closes both | CONFIRMED on screen |
| B4 | **An exempt field riding with a governed one is captured, shown to the reviewer with before/after, approved, then dropped** by `replay.py:216`. Capture is per-write, replay is per-field. Found independently on two surfaces | CONFIRMED |
| B5 | **An id-only `modified` entry in a filter or chart-customization diff passes as a no-op**, then the DAO replaces the entry, reducing a reviewed configuration to `{"id": …}` with a 200. `_modifications_already_hold` only iterates the keys the diff carries. **Ours, 2 Nov** (`c3e4ace695`, the R4-08 fix) | CONFIRMED |
| B6 | Approving an `override_columns` save does not reproduce the author's change — a column the direct save drops survives, because replay nests update and refresh in one transaction where the real route commits twice | CONFIRMED |
| B7 | **`save_to_dashboard_id` on the `overwrite` branch.** The author asked for a rename *and* an attach to a published dashboard, got "Changes saved", the reviewer was shown only the rename with no mention of a dashboard, approved, and was told "Changes approved and published." The join row was never written — not held, not captured, not reported, not replayed. The reviewer approved something materially different from what the author asked for | **REPRODUCED** |
| B8 | `remove_chart_from_dashboard`'s `json_metadata` cleanup is a **second, direct ORM write** placed after the gated command. Because the command raises, the cleanup never runs at all, so an approved removal leaves `filter_scopes`, `default_filters` and cross-filter scopes pointing at a chart that is gone. And were the gate ever not to fire, that second write is itself an ungated `json_metadata` write on a published dashboard | NOT REACHABLE (MCP); claim sharpened |

## C. Held, but the reviewer is shown nothing usable (21)

20 confirmed live, 1 not reachable. All reduce to four display enumerations in
`api.py`, each failing open to "Changed", a blank, or silence: `_shown`'s scalar
whitelist (`:157`), `OPAQUE_FIELDS` + `changed_keys_by_kind`/`layout_summary`
(`:108`), `_describe_command`'s command names (`:199`), and `COLUMN_FIELDS` (7)
/ `METRIC_FIELDS` (5) at `:1013`.

| # | What the reviewer is asked to approve blind |
|---|---|
| C1 | Embedded `allowed_domains` → raw key + "Changed". The gate emits `upsert_embedded`; `api.py:220` tests `"embedded"`, so the descriptive branch is dead. Admin-only path |
| C2 | Un-archive → `uuid` / — / `<uuid>`. Nothing says the asset returns to viewers |
| C3 | Un-archive **from the Approvals queue** → the uuid row is never rendered at all; the archived branch shows only a generic sentence |
| C4 | 9 column fields outside `COLUMN_FIELDS` (incl. `warning_markdown`) → **"No column changed."** with Approve enabled. Seen on screen approving a "DO NOT USE" banner bound for every viewer |
| C5 | 6 metric fields outside `METRIC_FIELDS` → "No metric changed." |
| C6 | A dataset **DELETE** → opens on Columns reading "No column changed." The correct "would be removed" copy lives in a component datasets never reach |
| C7 | Dashboard `css` → "Changed". CSS can hide anything |
| C8 | `position_json` → "1 added, 0 removed, 1 moved", never which chart |
| C9 | `native_filter_configuration` → "Changed". The `deleted` list is discarded, so removing a filter reads identically to adding one |
| C10 | `chart_customization_config` → "Changed" |
| C11 | An exempt **list** riding with a governed field (`viewers`, `editors`, `tags`) → raw key + "Changed". Approving a title change approves an access grant unseen |
| C12 | Chart `dashboards` → "Changed". No dashboard name, no count, no direction |
| C13 | `datasource_id` on a dataset swap → two bare integers, no dataset name |
| C14 | `theme_id` → `1 → 2`. The real change is a named theme |
| C15 | Version restore → `version / — / "Version 0"`. The per-version `changes` array already exists and is never read |
| C16 | `params` when the stored value is empty → the whole chart definition as one word |
| C17 | `json_metadata` when the stored value is empty → "Dashboard settings / Changed". This is the on-screen finding from the browser pass, now root-caused |
| C18 | `position_json` when the stored layout is empty → "Changed", not even the counts C8 gives |
| C19 | `query_context` → "Changed", or a single storage key name |
| C20 | `label_colors` / `map_label_colors` (dicts) → "Changed" |
| C21 | **A text field cleared to `""` renders a blank "after"** — `String(change.before ?? '—')`; `??` does not catch the empty string. `DatasetReviewModal`'s own `show()` handles it, so datasets are right and dashboards and charts are wrong |
| — | `folders` would be the only "— → —" path. NOT REACHABLE (flag off), and with the flag on it is a class-A escape, not this class |

**Corrections to earlier text.** A list field never renders "— → —"; it renders a
bare "Changed". And the invisible column/metric counts are **9 and 6**, not 11
and 9 — the earlier figures counted `id`/`uuid`.

## D. Structural (4)

- **D1.** The gate cannot represent a creation: `Operation` is `UPDATE` and `DELETE` only. Class A2-A6 is not closable by adding table rows.
- **D2.** The fail-closed backstop does not cover MCP, though `change_management.py:31` claims it does. Confirmed by introspection: `_refuse_unreviewed_writes` is one `before_request` hook with exactly one consumer in the tree, and MCP never enters Flask's request dispatch (app context only; stdio transport is not HTTP at all). In the configuration the backstop exists for, REST returns 503 while every MCP write goes through live and silent. **CONFIRMED**
- **D3.** `verify_bindings` over-reports. Run in-process it prints `declared=25 verified=25 ok=True`, zero defects, with `save_or_overwrite_slice` listed as plain `gated` — while that gate returns early unless the action is `overwrite`, so A4 and B7 both sit outside a path the report calls fully gated. `_verify_one` only asks whether *something* is wrapped, never what the wrapper covers, and `WritePath` has no field able to express partial coverage. The entry's own prose reason names only the `overwrite` case. **REPRODUCED**
- **D4.** Drifted second copies of the review frontend. Also `DatasetReview.tsx` never renders `detail.settings` while the header counts it — unreachable today, but the next fix can land in the wrong file.

## E. Workflow and wording (5)

- **E1.** A never-published draft cannot be deleted by the person who made it: the delete is held, then submit returns 422 with no eligible approver. Broader than first written — `POST /api/v1/dashboard/` creates the dashboard with **`editors: []`**, so this is the default state of every REST-created dashboard, not an edge case. The author may edit the draft freely (the update exemption works) and can never remove it. The only way out is for the author to add a co-editor themselves, unreviewed, under the A17 exemption — so the remedy for the deadlock is the author choosing their own approver.
- **E2.** A chart created through `saveas` gets `editors=[author]`, so its first governed change can never be submitted. The ungated path makes assets the gated path cannot govern.
- **E3.** A save replacing a pending delete keeps the delete's note, so the approver reads "delete it" as the note on a rename.
- **E4.** In dashboard edit mode the toolbar's "Request review" is disabled with "No changes to review yet" while the banner's identical button is enabled and a draft is open.
- **E5.** No "Edit properties" in the dashboard's view-mode menu for an editor.

## Confirmed sound

Maker-checker holds: the author is refused, an Admin who is not an eligible
editor is refused, a viewer cannot write. The stale-revision guard fails closed.
One-open-request-per-asset names the holder. QA-18's unpublish/edit/republish
loop launders nothing. QA-24's baseline refuses a stale apply and names the moved
field. MCP authentication and attribution fail closed, and guests reach no write
path. The 2026-11-03 high — a no-op save destroying a *submitted* request — is
fixed and verified on two surfaces. The chart review preview works and labels the
live-versus-proposed distinction honestly.

## No longer unknown

QA-01, QA-06 and QA-08 were recovered from this project's own session
transcripts after two runs of "unknown": a README mismatch (fixed, `d02f40dc08`),
a fresh-checkout build failure (fixed, `c82bd739a4` + `dbc70b8f5e`), and
concurrent approvals both succeeding (fixed by a row lock now taken on every
transition). Only the tail of two titles and two Steps columns are still missing,
and those are a copy-paste from the tracker sheet.

## Also found, outside the gate's scope

`python -m superset.mcp_service` cannot start standalone: `__main__.py:60`
imports `app.py` at module scope, which evaluates an encrypted field before the
Flask app exists. `superset mcp run` works. Worth reporting upstream.
