# Ungated write paths: the denominator QA has been sampling

Static audit, 2026-11-04, five parallel sweeps over `fix/qa-regression-93`.
No instance was available; everything here is read from source. Items marked
[V] were independently re-verified line by line. Nothing was reproduced live.

The point of this document: QA has found 8 new issues per round for three
rounds. They are not regressions. They are samples from the list below, which
has never been written down. 33 distinct defects; 15 let an unreviewed write
reach a viewer.

## A. Writes that escape review entirely (15)

| # | Path | Evidence | Viewer impact |
|---|---|---|---|
| A1 | MCP `get_chart_preview` rewrites `params`/`viz_type` on a live chart with only `can_read Chart` | [V] `get_chart_preview.py:1568`; `readOnlyHint=True`, no `mutate` tag, permission defaults to `read`; dirty `Slice` flushed by `DBEventLogger.log`'s commit (`utils/log.py:540`), the default `EVENT_LOGGER` | a reader replaces a chart's saved definition everywhere it appears |
| A2 | `POST /api/v1/dashboard/` with `published: true` | [V] `schemas.py:475`; `DashboardDAO.create` setattrs it through | [R] a published dashboard with a stored layout, never reviewed. **Correction:** the create path writes NO `dashboard_slices` rows (0 rows observed; `DashboardPostSchema` has no `slices` field), so charts arrive via A5 as a second call |
| A3 | MCP `generate_dashboard`, no command at all | [V] raw `Dashboard()`, `published`, `slices`, `db.session.add` + commit (`generate_dashboard.py:366-414`) | same as A2, in one tool call |
| A4 | Legacy Explore `?action=saveas&save_to_dashboard_id=` | [V] gate returns early unless `overwrite` (`bindings.py:361`); `dash.slices.append` + commit (`views/core.py:483`) | chart joins a published dashboard; widens drill/guest data access |
| A5 | `POST /api/v1/chart/` with `dashboards: [...]` | `CreateChartCommand` → `ChartDAO.create` writes the join row | as A4. This is R7-01 |
| A6 | First-time import carrying `published: true` | `_import_gate` returns when `overwrite` is falsy (`bindings.py:570`) | a whole published dashboard + charts + datasets at once |
| A7 | `POST /api/v1/database/<pk>/upload/` onto an existing dataset | `base.py:178-237`; permission is `can_upload Database`, no dataset editorship | every chart on the dataset reads different data |
| A8 | Theme delete nulls live dashboards | [V] `commands/theme/delete.py:100` bulk `UPDATE dashboards SET theme_id=NULL` | colours/typography change on every bound dashboard |
| A9 | `RefreshDatasetCommand` EXEMPT row | `connectors/sqla/models.py:2651` drops columns, overwrites `description`, forces `groupby`/`filterable`, writes `datetime_format` | the exemption's stated reason ("re-reads what the source says") no longer matches what it does |
| A10 | `POST /api/v1/dataset/<uuid>/purge` | `purge_policy.py:2050` raw `UPDATE slices SET datasource_id=NULL, perm=NULL` on live charts | breaks live charts irreversibly, strips `perm` |
| A11 | `folders` tree changes | [V] `_differs` keys lists on `"id"`; `FolderSchema` has `uuid`, no `id`, so both sides reduce to `{None}` | any rename/re-parent/add/delete applies unreviewed (needs `DATASET_FOLDERS`, default off) |
| A12 | MCP `delete_dataset_metric` | `UpdateDatasetCommand(id, {}, delete_metric_ids=...)`; empty body, gate sees no diff | R7-02 |
| A13 | Annotations onto an approved published chart | `CreateAnnotationCommand` → `AnnotationDAO.create`; read back by `query_context_processor.py:915` | arbitrary text drawn on a reviewed chart, through a side table no row-keyed gate can see |
| A14 | RLS rule create | `CreateRLSRuleCommand` → `RLSDAO.create` | the same approved chart returns different rows. Scope decision, not clearly a bug |
| A15 | `viewers`, `certified_by`/`certification_details`, chart `description` | `EXEMPT_FIELDS` (`changes.py:365`) | `viewers` is access control, not metadata; `certified_by` is a trust badge; chart `description` renders to dashboard viewers |

## B. Held, but approving applies something different (6)

| # | Defect | Evidence |
|---|---|---|
| B1 | MCP `add_chart_to_existing_dashboard` / `remove_chart_from_dashboard` captures cannot be approved | [V] tools pass live ORM objects as `slices`; `json.dumps(..., default=str)` + `Slice.__repr__` stores chart *names*; replay setattrs strings onto a relationship |
| B2 | `preserve_existing_metrics` dropped at replay | replay rebuilds without it, so approval replaces the whole metric list. R7-04 |
| B3 | `fold_fields` missing on the dataset and dashboard gates | [V] passed only at `bindings.py:383` and `:745`; `gate.py:287` returns the new body outright, so a partial second save replaces the draft. R7-06, open on two of three asset types |
| B4 | `save_to_dashboard_id` on the `overwrite` branch | intent dropped, not held: author is told "approved" and the attach never happens |
| B5 | `datasource_name` never captured | `models/slice.py:132` is a real column written only by the legacy save; approved chart keeps a stale name after a dataset swap |
| B6 | `remove_chart_from_dashboard`'s `json_metadata` cleanup not captured | approved removal leaves cross-filter scopes pointing at a chart that is gone |

## C. Reviewer approves blind (8 of 19; full list in the sweep)

| # | Defect | Evidence |
|---|---|---|
| C1 | Embedded `allowed_domains` shown as a bare "Changed" | [V] gate emits `"upsert_embedded"` (`gate.py:91`), `api.py:220` checks `"embedded"`. Dead branch, on the path the table calls "hands the dashboard to an audience outside Superset's access control" |
| C2 | Un-archive shown as `uuid · — → 7f3a...` | `_describe_command` omits `RESTORE_COMMAND`; nothing says the asset returns to viewers |
| C3 | 11 column + 9 metric fields render "No column changed." | `COLUMN_FIELDS` lists 7 of 18, `METRIC_FIELDS` 5 of 14. Held and replayed correctly, shown as nothing. Same family as the `fetch_values_predicate` bug, one level down |
| C4 | A dataset DELETE review opens on Columns reading "No column changed." | `dataset_detail` returns only `impact`; the correct "would be removed" copy is unreachable for datasets |
| C5 | Dashboard `css` → bare "Changed" | not JSON, so no per-key breakdown; CSS can hide anything |
| C6 | `position_json` → counts only | "2 added, 3 moved", never which charts |
| C7 | `native_filter_configuration`, `chart_customization_config` → "Changed", no preview | `useProposedPreview` excludes command-set changes |
| C8 | Every list field → "Changed" or `— → —` | `_shown` is a scalar whitelist; so a reviewer approving a title change can silently approve a `viewers` grant |

## D. Structural (4)

- **D1. The gate cannot represent a creation.** [V] `types.py` defines `Operation` as `UPDATE` and `DELETE` only. Class A2-A6 is not closable by adding table rows; it needs a new operation kind or a blanket refusal.
- **D2. The fail-closed backstop does not cover MCP**, though `change_management.py:31` says it does. [V] It is a Flask `before_request`; MCP serves over FastMCP, not Flask routing. In the configuration the backstop exists for, REST returns 503 and every MCP write goes through live and silent.
- **D3. `verify_bindings` over-reports.** `save_or_overwrite_slice` is marked plain GATED with no partial-coverage note, so a half-covered path verifies clean. Same for the latent S-01 variant on classes carrying an unscoped FAB `before_request`.
- **D4. Two drifted frontend copies.** The extension's `WhatChangedPanel.tsx` lacks `controlLabels` entirely. Currently dead code, but the next fix can land in the wrong file.

## What this changes

The gate is an allowlist of *paths*, and A1-A14 are all outside it. Note it is
**not** an allowlist of fields: `changed_fields` iterates every key in the body
and counts an unknown one as changed, so it fails closed there. Field escapes
come only from the exemption list, the derived-key subtraction, a comparison
that collapses, and a path declared unbound.

Three fixes close more than half of the above:
1. Invert the path default: refuse an unknown write rather than pass it.
2. Capture and replay the whole call, not the payload dict (closes B2, B4, B5, A12).
3. Let the display ask the gate which fields moved, instead of answering again
   with its own four enumerations (closes most of C).

---

# Live reproduction, 2026-11-04, localhost:9002

Gate confirmed enabled (`/api/v1/change_request/enabled` -> true), queue empty
at start, all assets created and cleaned up by the run. REST only, no browser.

| # | Verdict | What was observed |
|---|---|---|
| A2 | **REPRODUCED** | `POST /api/v1/dashboard/` `published:true` -> 201, no change request, a non-admin viewer gets 200 on it. The second save of the same dashboard IS held (202). Sub-claim about `dashboard_slices` falsified: 0 join rows on create |
| A5 | **REPRODUCED** | `POST /api/v1/chart/` with `dashboards:[<published id>]` -> 201, join row written, no review, viewer sees the chart in `/dashboard/<id>/charts`. Also succeeded **while an open change request existed on that dashboard** -- the one-open-request-per-asset rule does not cover this path |
| A8 | **REPRODUCED, worse than written** | `DELETE /api/v1/theme/<pk>` -> **200, itself ungated** (themes appear nowhere in `WRITE_PATHS`), and it nulls `theme_id` on bound published dashboards. Two unreviewed writes, not one |
| A10 | **REPRODUCED, worse than written** | The archive step is correctly held and approved; then `POST /api/v1/dataset/<uuid>/purge` -> **200, ungated**, nulling `datasource_id`, `perm`, `schema_perm`, `catalog_perm` on a live chart. Viewer still gets 200 on the chart; it cannot render and has lost its permission string. The reviewed step is reversible, the unreviewed one is not |
| C1 | **REPRODUCED** | Held correctly (202), but the reviewer's payload is `{"field":"allowed_domains","opaque":true}` with no before, after or keys, while `proposed` contains the domains. Rendered as the raw key `allowed_domains` + `Changed`; the preview switch is also suppressed because `command` is set. Reachability note: Alpha gets **403** on this path, only Admin holds `can_set_embedded` |
| B1 | **NOT REACHABLE HERE** | MCP is not served: nothing listening, and `docker-compose-light.yml` defines no mcp service. No non-MCP path produces the corrupt payload shape (no binding puts `slices` into a captured body). Source is consistent with the claim; runtime unverified |
| A1 | **NOT REACHABLE HERE** | Same reason. Source consistent with the claim; the commit vector through `DBEventLogger` is unverified |

## Confirmed sound under test

- **No admin bypass.** Approve as an Admin who is not an eligible editor -> 403.
- **The author cannot approve their own change.** [V] `eligibility.py:160`.
- Approve requires `{"seen_revision": "<revision>"}` or returns 409.

## A15, restated more precisely after test

`EXEMPT_FIELDS` is [V] `{editors, viewers, owners, tags, certified_by,
certification_details, description}`. `PUT /api/v1/chart/<id> {"editors":[...]}`
applies with a 200 and no review. The consequence is sharper than "metadata":
`editors` is the field the gate reads to decide **who may approve**, so an
author can rewrite their own approver set unreviewed. Before the call `submit`
returned 422 ("No one else can approve this"); after it, the newly added editor
could approve.

This is **not** self-approval -- the author is still barred -- and SOW 5.4
requires the editors exemption, so it is a designed escape hatch rather than a
defect. It belongs in front of the customer as a governance decision, not as a
bug: whoever an author adds must still choose to approve.
