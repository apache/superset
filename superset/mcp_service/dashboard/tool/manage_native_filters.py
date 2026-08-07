# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

"""
MCP tool: manage_native_filters

Adds, updates, removes, and reorders native filters on a dashboard by
translating high-level operations into the ``deleted`` / ``modified`` /
``reordered`` payload consumed by ``UpdateDashboardNativeFiltersCommand``.
"""

import copy
import logging
from typing import Any

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.dashboard.constants import generate_id
from superset.mcp_service.dashboard.schemas import (
    FilterSelectSpec,
    FilterTimeSpec,
    ManageNativeFiltersRequest,
    ManageNativeFiltersResponse,
    NativeFilterSummary,
    NativeFilterUpdateSpec,
)
from superset.mcp_service.utils import (
    escape_llm_context_delimiters,
    sanitize_for_llm_context,
)
from superset.mcp_service.utils.url_utils import get_superset_base_url
from superset.utils import json

logger = logging.getLogger(__name__)

# Control values that map to filter_select controlValues keys.
_SELECT_CONTROL_FIELDS: dict[str, str] = {
    "multi_select": "multiSelect",
    "default_to_first_item": "defaultToFirstItem",
    "enable_empty_filter": "enableEmptyFilter",
    "sort_ascending": "sortAscending",
    "search_all_options": "searchAllOptions",
}


class _FilterValidationError(Exception):
    """Raised internally when a filter operation fails validation."""


def _empty_data_mask() -> dict[str, Any]:
    """Return the default data mask for a filter with no applied value."""
    return {"filterState": {"value": None}, "extraFormData": {}}


def _time_data_mask(default_time_range: str | None) -> dict[str, Any]:
    """Build the default data mask for a time filter.

    When ``default_time_range`` is empty the filter starts unset (the empty
    mask); otherwise the range is applied as both the filter state value and
    the ``time_range`` extra form data.
    """
    if not default_time_range:
        return _empty_data_mask()
    return {
        "filterState": {"value": default_time_range},
        "extraFormData": {"time_range": default_time_range},
    }


def _validate_dataset_column(dataset_id: int, column: str) -> None:
    """Validate that the dataset exists and contains the given column."""
    from superset.daos.dataset import DatasetDAO

    dataset = DatasetDAO.find_by_id(dataset_id)
    if not dataset:
        raise _FilterValidationError(
            f"Dataset with ID {dataset_id} not found."
            " Use list_datasets to get valid dataset IDs."
        )
    column_names = [c.column_name for c in dataset.columns]
    if column not in column_names:
        raise _FilterValidationError(
            f"Column '{column}' not found in dataset {dataset_id}. "
            f"Available columns: {', '.join(sorted(column_names))}."
        )


def _build_scope(
    scope_chart_ids: list[int] | None,
    dashboard_chart_ids: list[int],
) -> dict[str, Any]:
    """Translate scope_chart_ids into the frontend scope structure.

    The frontend expresses scope as an exclusion list, so charts NOT in
    ``scope_chart_ids`` are excluded. When ``scope_chart_ids`` is None
    the filter applies to all charts (empty exclusion list).
    """
    if scope_chart_ids is None:
        return {"rootPath": ["ROOT_ID"], "excluded": []}
    unknown = sorted(set(scope_chart_ids) - set(dashboard_chart_ids))
    if unknown:
        raise _FilterValidationError(
            f"scope_chart_ids contains chart IDs not on the dashboard: "
            f"{unknown}. Charts on this dashboard: {sorted(dashboard_chart_ids)}."
        )
    excluded = sorted(set(dashboard_chart_ids) - set(scope_chart_ids))
    return {"rootPath": ["ROOT_ID"], "excluded": excluded}


def _build_new_filter_config(
    spec: FilterSelectSpec | FilterTimeSpec,
    dashboard_chart_ids: list[int],
) -> dict[str, Any]:
    """Build a full native filter config dict for a new filter."""
    scope = _build_scope(spec.scope_chart_ids, dashboard_chart_ids)
    filter_id = generate_id("NATIVE_FILTER")

    if isinstance(spec, FilterSelectSpec):
        _validate_dataset_column(spec.dataset_id, spec.column)
        control_values: dict[str, Any] = {
            "multiSelect": spec.multi_select,
            "defaultToFirstItem": spec.default_to_first_item,
            "enableEmptyFilter": spec.enable_empty_filter,
            "searchAllOptions": spec.search_all_options,
        }
        if spec.sort_ascending is not None:
            control_values["sortAscending"] = spec.sort_ascending
        return {
            "id": filter_id,
            "type": "NATIVE_FILTER",
            "filterType": "filter_select",
            "name": spec.name,
            "description": spec.description,
            "scope": scope,
            "targets": [
                {"datasetId": spec.dataset_id, "column": {"name": spec.column}}
            ],
            "controlValues": control_values,
            "defaultDataMask": _empty_data_mask(),
            "cascadeParentIds": [],
        }

    # filter_time: no dataset target, empty controlValues
    return {
        "id": filter_id,
        "type": "NATIVE_FILTER",
        "filterType": "filter_time",
        "name": spec.name,
        "description": spec.description,
        "scope": scope,
        "targets": [{}],
        "controlValues": {},
        "defaultDataMask": _time_data_mask(spec.default_time_range),
        "cascadeParentIds": [],
    }


def _validate_update_type_compat(
    spec: NativeFilterUpdateSpec, filter_type: str | None
) -> None:
    """Reject update fields that do not apply to the filter's type."""
    select_fields_set = [
        field
        for field in (*_SELECT_CONTROL_FIELDS, "dataset_id", "column")
        if getattr(spec, field) is not None
    ]
    if filter_type != "filter_select" and select_fields_set:
        raise _FilterValidationError(
            f"Filter '{spec.id}' has type '{filter_type}'; fields "
            f"{select_fields_set} only apply to filter_select filters."
        )
    if filter_type != "filter_time" and spec.default_time_range is not None:
        raise _FilterValidationError(
            f"Filter '{spec.id}' has type '{filter_type}'; default_time_range "
            "only applies to filter_time filters."
        )


def _merge_target(spec: NativeFilterUpdateSpec, merged: dict[str, Any]) -> None:
    """Merge dataset_id / column changes into the filter's first target."""
    targets = merged.get("targets") or [{}]
    target = dict(targets[0]) if targets else {}
    dataset_id = (
        spec.dataset_id if spec.dataset_id is not None else target.get("datasetId")
    )
    column = (
        spec.column
        if spec.column is not None
        else (target.get("column") or {}).get("name")
    )
    if dataset_id is None or not column:
        raise _FilterValidationError(
            f"Filter '{spec.id}' is missing a dataset or column target; "
            "provide both dataset_id and column to set the target."
        )
    _validate_dataset_column(dataset_id, column)
    target["datasetId"] = dataset_id
    target["column"] = {"name": column}
    merged["targets"] = [target]


def _merge_filter_update(
    spec: NativeFilterUpdateSpec,
    existing: dict[str, Any],
    dashboard_chart_ids: list[int],
) -> dict[str, Any]:
    """Merge a partial update into an existing filter config.

    Returns a FULL filter config (the backend command substitutes whole
    entries, it does not merge deltas).
    """
    merged = copy.deepcopy(existing)
    _validate_update_type_compat(spec, merged.get("filterType"))

    if spec.name is not None:
        merged["name"] = spec.name
    if spec.description is not None:
        merged["description"] = spec.description
    if spec.scope_chart_ids is not None:
        merged["scope"] = _build_scope(spec.scope_chart_ids, dashboard_chart_ids)
    if spec.dataset_id is not None or spec.column is not None:
        _merge_target(spec, merged)

    control_values = dict(merged.get("controlValues") or {})
    for field, control_key in _SELECT_CONTROL_FIELDS.items():
        value = getattr(spec, field)
        if value is not None:
            control_values[control_key] = value
    merged["controlValues"] = control_values

    if spec.default_time_range is not None:
        merged["defaultDataMask"] = _time_data_mask(spec.default_time_range)

    return merged


def _filter_summary(conf: dict[str, Any]) -> NativeFilterSummary:
    """Summarize a filter config for the response.

    Returns the id, name, filterType, and non-empty targets; empty target
    entries (e.g. for time filters) are dropped so the summary only lists
    real dataset/column targets. The user-controlled ``name`` and ``targets``
    come from dashboard metadata and are wrapped as untrusted content before
    being exposed to LLM context (mirroring the get_dashboard_info read path).
    The operational ``id`` and ``filter_type`` fields are delimiter-escaped
    (not wrapped) so the LLM can pass them back verbatim in subsequent calls
    while any embedded delimiter tokens are neutralized.
    """
    name = conf.get("name")
    targets = [t for t in (conf.get("targets") or []) if t]
    return NativeFilterSummary(
        id=escape_llm_context_delimiters(conf.get("id")),
        name=sanitize_for_llm_context(name, field_path=("name",))
        if name is not None
        else None,
        filter_type=escape_llm_context_delimiters(conf.get("filterType")),
        targets=sanitize_for_llm_context(
            targets,
            field_path=("targets",),
            excluded_field_names=frozenset(),
        ),
    )


def _current_native_filter_config(dashboard: Any) -> list[dict[str, Any]]:
    """Return the dashboard's existing native filter configuration.

    ``json_metadata`` may be missing, invalid JSON, or parse to a non-dict
    (e.g. a legacy ``"[]"`` payload); all of those degrade to an empty list
    rather than raising.
    """
    try:
        metadata = json.loads(dashboard.json_metadata or "{}")
    except (json.JSONDecodeError, TypeError):
        metadata = {}
    if not isinstance(metadata, dict):
        return []
    config = metadata.get("native_filter_configuration")
    if not isinstance(config, list):
        return []
    # Drop malformed (non-dict) entries so downstream conf["id"] / conf.get(...)
    # cannot raise on corrupt metadata.
    return [item for item in config if isinstance(item, dict)]


def _build_native_filters_payload(  # noqa: C901
    request: ManageNativeFiltersRequest,
    current_config: list[dict[str, Any]],
    dashboard_chart_ids: list[int],
) -> tuple[dict[str, Any], list[str], list[str]]:
    """Translate tool operations into the command payload.

    Returns ``(payload, added_filter_ids, updated_filter_ids)`` where the
    payload has the ``deleted`` / ``modified`` / ``reordered`` shape expected
    by ``UpdateDashboardNativeFiltersCommand``.
    """
    current_by_id = {conf["id"]: conf for conf in current_config if conf.get("id")}

    unknown_removals = [fid for fid in request.remove if fid not in current_by_id]
    if unknown_removals:
        raise _FilterValidationError(
            f"Cannot remove filters that do not exist on the dashboard: "
            f"{unknown_removals}. Existing filter IDs: "
            f"{sorted(current_by_id)}."
        )

    removed_ids = set(request.remove)
    modified: list[dict[str, Any]] = []
    updated_filter_ids: list[str] = []

    update_ids = [update_spec.id for update_spec in request.update]
    duplicate_updates = sorted({fid for fid in update_ids if update_ids.count(fid) > 1})
    if duplicate_updates:
        raise _FilterValidationError(
            f"update contains duplicate filter IDs: {duplicate_updates}. "
            "Provide at most one update per filter."
        )

    for update_spec in request.update:
        if update_spec.id in removed_ids:
            raise _FilterValidationError(
                f"Filter '{update_spec.id}' cannot be both updated and removed."
            )
        existing = current_by_id.get(update_spec.id)
        if existing is None:
            raise _FilterValidationError(
                f"Cannot update filter '{update_spec.id}': not found on the "
                f"dashboard. Existing filter IDs: {sorted(current_by_id)}."
            )
        modified.append(
            _merge_filter_update(update_spec, existing, dashboard_chart_ids)
        )
        updated_filter_ids.append(update_spec.id)

    added_filter_ids: list[str] = []
    for new_spec in request.add:
        config = _build_new_filter_config(new_spec, dashboard_chart_ids)
        modified.append(config)
        added_filter_ids.append(config["id"])

    payload: dict[str, Any] = {}
    if request.remove:
        payload["deleted"] = list(request.remove)
    if modified:
        payload["modified"] = modified

    if request.reorder is not None:
        # The DAO drops any surviving filter that is absent from the
        # reordered list, so require a complete ordering of surviving
        # pre-existing filters. Newly added filters are appended
        # automatically by the DAO and may be omitted.
        surviving_ids = set(current_by_id) - removed_ids
        reorder_ids = [fid for fid in request.reorder if fid not in added_filter_ids]
        if len(set(request.reorder)) != len(request.reorder):
            raise _FilterValidationError("reorder contains duplicate filter IDs.")
        missing = sorted(surviving_ids - set(reorder_ids))
        unknown = sorted(set(reorder_ids) - surviving_ids)
        if missing or unknown:
            raise _FilterValidationError(
                "reorder must list every remaining filter exactly once. "
                f"Missing: {missing}. Unknown: {unknown}. "
                f"Remaining filter IDs: {sorted(surviving_ids)}."
            )
        payload["reordered"] = list(request.reorder)

    return payload, added_filter_ids, updated_filter_ids


@tool(
    tags=["mutate"],
    class_permission_name="Dashboard",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Manage dashboard native filters",
        readOnlyHint=False,
        destructiveHint=True,
    ),
)
def manage_native_filters(
    request: ManageNativeFiltersRequest, ctx: Context
) -> ManageNativeFiltersResponse:
    """
    Add, update, remove, and reorder native filters on a dashboard.

    Supported filter types for new filters: filter_select (dropdown backed
    by a dataset column) and filter_time (time range). Other filter types
    (numerical range, time column, time grain) are not yet supported.
    Filter IDs are generated by the server and returned in the response.

    Concurrency note: the filter-list snapshot used for validation is read
    outside the DAO write transaction.  A ``reorder`` that is valid against
    the snapshot can silently drop a filter added by a concurrent writer
    between the snapshot read and the write commit.  This mirrors existing
    REST write behaviour; callers that expect concurrent edits should
    re-read the filter list and retry if the returned filter set differs
    from what was requested.
    """
    from superset.commands.dashboard.exceptions import (
        DashboardForbiddenError,
        DashboardInvalidError,
        DashboardNativeFiltersUpdateFailedError,
        DashboardNotFoundError,
    )
    from superset.commands.dashboard.update import (
        UpdateDashboardNativeFiltersCommand,
    )
    from superset.commands.exceptions import TagForbiddenError
    from superset.daos.dashboard import DashboardDAO

    try:
        with event_logger.log_context(action="mcp.manage_native_filters.validation"):
            dashboard = DashboardDAO.find_by_id(request.dashboard_id)
            if not dashboard:
                return ManageNativeFiltersResponse(
                    error=(
                        f"Dashboard with ID {request.dashboard_id} not found."
                        " Use list_dashboards to get valid dashboard IDs."
                    ),
                )

            current_config = _current_native_filter_config(dashboard)
            dashboard_chart_ids = [slc.id for slc in dashboard.slices]

            try:
                payload, added_ids, updated_ids = _build_native_filters_payload(
                    request, current_config, dashboard_chart_ids
                )
            except _FilterValidationError as exc:
                return ManageNativeFiltersResponse(
                    dashboard_id=request.dashboard_id,
                    error=str(exc),
                )

        with event_logger.log_context(action="mcp.manage_native_filters.db_write"):
            configuration = UpdateDashboardNativeFiltersCommand(
                request.dashboard_id, payload
            ).run()

        dashboard_url = f"{get_superset_base_url()}/dashboard/{request.dashboard_id}/"
        logger.info(
            "Managed native filters on dashboard %s (added=%d updated=%d removed=%d)",
            request.dashboard_id,
            len(added_ids),
            len(updated_ids),
            len(request.remove),
        )
        return ManageNativeFiltersResponse(
            dashboard_id=request.dashboard_id,
            dashboard_url=dashboard_url,
            added_filter_ids=added_ids,
            updated_filter_ids=updated_ids,
            removed_filter_ids=list(request.remove),
            filters=[_filter_summary(conf) for conf in configuration],
        )

    except DashboardNotFoundError:
        return ManageNativeFiltersResponse(
            error=(
                f"Dashboard with ID {request.dashboard_id} not found."
                " Use list_dashboards to get valid dashboard IDs."
            ),
        )
    except DashboardForbiddenError:
        return ManageNativeFiltersResponse(
            dashboard_id=request.dashboard_id,
            permission_denied=True,
            error=(
                f"You don't have permission to edit dashboard "
                f"{request.dashboard_id}. Changing native filters requires "
                "editorship of the dashboard."
            ),
        )
    except TagForbiddenError as exc:
        return ManageNativeFiltersResponse(
            dashboard_id=request.dashboard_id,
            permission_denied=True,
            error=str(exc),
        )
    except DashboardInvalidError as exc:
        return ManageNativeFiltersResponse(
            dashboard_id=request.dashboard_id,
            error=f"Invalid dashboard update: {exc.normalized_messages()}",
        )
    except DashboardNativeFiltersUpdateFailedError as exc:
        return ManageNativeFiltersResponse(
            dashboard_id=request.dashboard_id,
            error=f"Failed to update native filters: {exc}",
        )
    except Exception as exc:
        logger.exception(
            "Unexpected error managing native filters on dashboard %s: %s",
            request.dashboard_id,
            exc,
        )
        raise
