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
from typing import Any, TYPE_CHECKING

from fastmcp import Context
from sqlalchemy.exc import SQLAlchemyError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.constants import EMPTY_FILTER_SQL_EXPRESSION, NULL_STRING
from superset.dashboards.filter_scope import _is_divider
from superset.exceptions import SupersetSecurityException
from superset.extensions import event_logger
from superset.mcp_service.dashboard.constants import generate_id
from superset.mcp_service.dashboard.schemas import (
    DividerSpec,
    FilterRangeSpec,
    FilterSelectSpec,
    FilterSelectValue,
    FilterTimeGrainSpec,
    FilterTimeSpec,
    ManageNativeFiltersRequest,
    ManageNativeFiltersResponse,
    NativeFilterSummary,
    NativeFilterUpdateSpec,
)
from superset.mcp_service.dashboard.tool.governance_utils import (
    managed_dashboard_refusal,
)
from superset.mcp_service.utils.url_utils import get_superset_base_url
from superset.utils import json

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from superset.models.dashboard import Dashboard

# Update fields that map to a filter's controlValues, keyed by the
# NativeFilterUpdateSpec field name they come from.
_CONTROL_VALUE_FIELDS: dict[str, str] = {
    "multi_select": "multiSelect",
    "default_to_first_item": "defaultToFirstItem",
    "enable_empty_filter": "enableEmptyFilter",
    "sort_ascending": "sortAscending",
    "search_all_options": "searchAllOptions",
}

# Update fields valid only for specific filter types. Fields not listed in
# any of these sets (name, description, scope_chart_ids) apply to every type.
_TYPE_SPECIFIC_UPDATE_FIELDS: dict[str, frozenset[str]] = {
    "filter_select": frozenset(
        {
            "dataset_id",
            "column",
            "multi_select",
            "default_to_first_item",
            "default_value",
            "enable_empty_filter",
            "sort_ascending",
            "search_all_options",
        }
    ),
    "filter_range": frozenset({"dataset_id", "column", "enable_empty_filter"}),
    "filter_time": frozenset({"default_time_range"}),
    "filter_timegrain": frozenset({"dataset_id", "enable_empty_filter"}),
}
_ALL_TYPE_SPECIFIC_UPDATE_FIELDS: frozenset[str] = frozenset().union(
    *_TYPE_SPECIFIC_UPDATE_FIELDS.values()
)


# Display strings the frontend uses when labelling a selected value; mirrored
# here so a stored default's label reads the same as an applied one.
_TRUE_LABEL = "TRUE"
_FALSE_LABEL = "FALSE"


class _FilterValidationError(Exception):
    """Raised internally when a filter operation fails validation."""


def _empty_data_mask() -> dict[str, Any]:
    """Return the default data mask for a filter with no applied value."""
    return {"filterState": {"value": None}, "extraFormData": {}}


def _value_label(value: FilterSelectValue) -> str:
    """Format one selected value the way the dashboard UI labels it."""
    if value is None:
        return NULL_STRING
    if isinstance(value, bool):
        return _TRUE_LABEL if value else _FALSE_LABEL
    return str(value)


def _select_data_mask(
    conf: dict[str, Any], values: list[FilterSelectValue]
) -> dict[str, Any]:
    """Build the data mask a filter_select filter produces for ``values``.

    Mirrors the frontend's ``getSelectExtraFormData``: a non-empty selection
    becomes an ``IN`` predicate on the filter's target column, and an empty
    selection on a filter marked ``enableEmptyFilter`` becomes an impossible
    predicate (the "required filter, nothing chosen" state) rather than no
    filtering at all. Shared by ``apply_dashboard_filters`` (applied values)
    and this module (default values on create/update) so both paths agree.
    """
    targets = [target for target in (conf.get("targets") or []) if target]
    column = (
        _target_key(targets[0])[1] if targets and isinstance(targets[0], dict) else None
    )
    if not isinstance(column, str) or not column:
        raise _FilterValidationError(
            f"Filter '{conf.get('name') or conf.get('id')}' has no target "
            "column, so a value cannot be applied to it."
        )

    control_values = conf.get("controlValues") or {}
    if control_values.get("inverseSelection"):
        raise _FilterValidationError(
            f"Filter '{conf.get('name') or conf.get('id')}' enables inverse "
            "selection, which this tool does not support."
        )
    if (operator := control_values.get("operatorType", "exact")) != "exact":
        raise _FilterValidationError(
            f"Filter '{conf.get('name') or conf.get('id')}' uses matching "
            f"operator '{operator}', which this tool does not support. "
            "Only exact-match select filters are supported."
        )
    # A single-select filter renders one value; storing several would disagree
    # with the control the moment a viewer touches it. multiSelect defaults to
    # true, so only an explicit false restricts the selection.
    if control_values.get("multiSelect") is False and len(values) > 1:
        raise _FilterValidationError(
            f"Filter '{conf.get('name') or conf.get('id')}' is single-select "
            f"and accepts at most one value, but {len(values)} were given."
        )

    if values:
        extra_form_data: dict[str, Any] = {
            "filters": [{"col": column, "op": "IN", "val": list(values)}]
        }
        filter_state: dict[str, Any] = {
            "value": list(values),
            "label": ", ".join(_value_label(value) for value in values),
        }
    else:
        return _empty_select_data_mask(conf)

    return {"extraFormData": extra_form_data, "filterState": filter_state}


def _empty_select_data_mask(conf: dict[str, Any]) -> dict[str, Any]:
    """Mirror the frontend's empty selection, including required-filter semantics."""
    controls = conf.get("controlValues") or {}
    if not controls.get("enableEmptyFilter") or controls.get("inverseSelection"):
        return _empty_data_mask()
    return {
        "extraFormData": {
            "adhoc_filters": [
                {
                    "expressionType": "SQL",
                    "clause": "WHERE",
                    "sqlExpression": EMPTY_FILTER_SQL_EXPRESSION,
                }
            ]
        },
        # An explicit empty selection is a static default to server-side
        # dashboard context; None would cause its predicate to be skipped.
        "filterState": {"value": []},
    }


def _default_data_mask(
    conf: dict[str, Any], values: list[FilterSelectValue]
) -> dict[str, Any]:
    """Build a stored select default, allowing empty unsupported UI selections.

    First-item defaults leave the value unset so the UI can select it after
    loading options. Explicit empty selections do not depend on the matching
    operator. Required filters still contribute an impossible predicate unless
    inverse selection is on, matching SelectFilterPlugin.updateDataMask.
    """
    if (conf.get("controlValues") or {}).get("defaultToFirstItem"):
        # A defined value, including None or [], blocks the UI's first-item default.
        return {"filterState": {}, "extraFormData": {}}
    if not values:
        return _empty_select_data_mask(conf)
    return _select_data_mask(conf, values)


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


def _find_dataset_or_raise(dataset_id: int) -> Any:
    """Look up a dataset by ID, raising a validation error if missing."""
    from superset.daos.dataset import DatasetDAO

    dataset = DatasetDAO.find_by_id(dataset_id)
    if not dataset:
        raise _FilterValidationError(
            f"Dataset with ID {dataset_id} not found."
            " Use list_datasets to get valid dataset IDs."
        )
    return dataset


def _validate_dataset_column(
    dataset_id: int, column: str, *, require_numeric: bool = False
) -> None:
    """Validate column existence and, for range filters, its numeric type."""
    dataset = _find_dataset_or_raise(dataset_id)
    column_names = [c.column_name for c in dataset.columns]
    target_column = next((c for c in dataset.columns if c.column_name == column), None)
    if target_column is None:
        raise _FilterValidationError(
            f"Column '{column}' not found in dataset {dataset_id}. "
            f"Available columns: {', '.join(sorted(column_names))}."
        )

    if require_numeric and not target_column.is_numeric:
        raise _FilterValidationError(
            f"Column '{column}' in dataset {dataset_id} must be numeric "
            "for a filter_range filter."
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
    spec: (
        FilterSelectSpec
        | FilterTimeSpec
        | FilterRangeSpec
        | FilterTimeGrainSpec
        | DividerSpec
    ),
    dashboard_chart_ids: list[int],
) -> dict[str, Any]:
    """Build a full native filter (or divider) config dict for a new entry."""
    if isinstance(spec, DividerSpec):
        # Dividers have no filterType/targets/controlValues/cascadeParentIds;
        # matching the frontend's stored shape (see
        # transformDivider in filterTransformer.ts) keeps this entry
        # indistinguishable from one created through the UI.
        return {
            "id": generate_id("NATIVE_FILTER_DIVIDER"),
            "type": "DIVIDER",
            "title": spec.name,
            "description": spec.description,
            "scope": {"rootPath": ["ROOT_ID"], "excluded": []},
        }

    base: dict[str, Any] = {
        "id": generate_id("NATIVE_FILTER"),
        "type": "NATIVE_FILTER",
        "name": spec.name,
        "description": spec.description,
        "scope": _build_scope(spec.scope_chart_ids, dashboard_chart_ids),
        "cascadeParentIds": [],
    }

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
        config: dict[str, Any] = {
            **base,
            "filterType": "filter_select",
            "targets": [
                {"datasetId": spec.dataset_id, "column": {"name": spec.column}}
            ],
            "controlValues": control_values,
            "defaultDataMask": _empty_data_mask(),
        }

        if (
            spec.default_value is not None
            or spec.default_to_first_item
            or spec.enable_empty_filter
        ):
            config["defaultDataMask"] = _default_data_mask(
                config, spec.default_value or []
            )
        return config

    if isinstance(spec, FilterRangeSpec):
        _validate_dataset_column(spec.dataset_id, spec.column, require_numeric=True)
        return {
            **base,
            "filterType": "filter_range",
            "targets": [
                {"datasetId": spec.dataset_id, "column": {"name": spec.column}}
            ],
            "controlValues": {"enableEmptyFilter": spec.enable_empty_filter},
            "defaultDataMask": _empty_data_mask(),
        }

    if isinstance(spec, FilterTimeGrainSpec):
        _find_dataset_or_raise(spec.dataset_id)
        return {
            **base,
            "filterType": "filter_timegrain",
            "targets": [{"datasetId": spec.dataset_id}],
            "controlValues": {"enableEmptyFilter": spec.enable_empty_filter},
            "defaultDataMask": _empty_data_mask(),
        }

    # filter_time: no dataset target, empty controlValues
    return {
        **base,
        "filterType": "filter_time",
        "targets": [{}],
        "controlValues": {},
        "defaultDataMask": _time_data_mask(spec.default_time_range),
    }


def _validate_update_type_compat(
    spec: NativeFilterUpdateSpec, filter_type: str | None, *, is_divider: bool = False
) -> None:
    """Reject update fields that do not apply to the filter's type.

    Dividers have no ``filterType`` at all, so every type-specific field
    (dataset_id, column, multi_select, ...) is rejected for them, same as
    for any other filter type that does not declare it as allowed.
    """
    if is_divider and spec.scope_chart_ids is not None:
        raise _FilterValidationError(
            f"Divider '{spec.id}' does not support scope_chart_ids; "
            "dividers are always in scope."
        )
    allowed = (
        _TYPE_SPECIFIC_UPDATE_FIELDS.get(filter_type, frozenset())
        if filter_type is not None
        else frozenset()
    )
    invalid_fields = sorted(
        field
        for field in _ALL_TYPE_SPECIFIC_UPDATE_FIELDS
        if getattr(spec, field) is not None and field not in allowed
    )
    if invalid_fields:
        valid_types = sorted(
            {
                type_name
                for type_name, fields in _TYPE_SPECIFIC_UPDATE_FIELDS.items()
                if fields & set(invalid_fields)
            }
        )
        type_label = "divider" if is_divider else filter_type
        raise _FilterValidationError(
            f"Filter '{spec.id}' has type '{type_label}'; fields "
            f"{invalid_fields} only apply to {', '.join(valid_types)} filters."
        )


def _merge_target(spec: NativeFilterUpdateSpec, merged: dict[str, Any]) -> None:
    """Merge dataset_id / column changes into the filter's first target.

    A time grain filter has a dataset (to resolve supported grains) but no
    column, unlike select and range filters.
    """
    targets = merged.get("targets") or [{}]
    target = dict(targets[0]) if targets else {}
    dataset_id = (
        spec.dataset_id if spec.dataset_id is not None else target.get("datasetId")
    )
    if merged.get("filterType") == "filter_timegrain":
        if dataset_id is None:
            raise _FilterValidationError(
                f"Filter '{spec.id}' is missing a dataset target; provide "
                "dataset_id to set the target."
            )
        _find_dataset_or_raise(dataset_id)
        target["datasetId"] = dataset_id
        merged["targets"] = [target]
        return

    column = spec.column if spec.column is not None else _target_key(target)[1]
    if dataset_id is None or not column:
        raise _FilterValidationError(
            f"Filter '{spec.id}' is missing a dataset or column target; "
            "provide both dataset_id and column to set the target."
        )
    _validate_dataset_column(
        dataset_id, column, require_numeric=merged.get("filterType") == "filter_range"
    )
    target["datasetId"] = dataset_id
    target["column"] = {"name": column}
    merged["targets"] = [target]


def _target_key(target: dict[str, Any]) -> tuple[Any, Any]:
    """Identify a filter target by its dataset and column name."""
    column = target.get("column")
    return target.get("datasetId"), (
        column.get("name") if isinstance(column, dict) else column
    )


def _stored_default_is_stale(
    spec: NativeFilterUpdateSpec, existing: dict[str, Any], target_changed: bool
) -> bool:
    """Whether an update without ``default_value`` invalidates the stored one.

    A stored default goes stale when the filter is retargeted to another
    column or dataset, when it becomes single-select while the default holds
    several values, or when ``default_to_first_item`` is switched on (the
    explicit default would otherwise win and the first item never applies).
    """
    if existing.get("filterType") != "filter_select":
        return False
    if spec.default_to_first_item is True:
        return True
    stored = ((existing.get("defaultDataMask") or {}).get("filterState") or {}).get(
        "value"
    )
    if stored is None:
        return False
    stored_count = len(stored) if isinstance(stored, list) else 1
    return target_changed or (spec.multi_select is False and stored_count > 1)


def _merge_select_default(
    spec: NativeFilterUpdateSpec,
    existing: dict[str, Any],
    merged: dict[str, Any],
    target_changed: bool,
) -> None:
    """Apply an explicit default_value, or drop a stored default gone stale."""
    if spec.default_value is not None:
        if (merged.get("controlValues") or {}).get("defaultToFirstItem"):
            raise _FilterValidationError(
                f"Filter '{spec.id}' has default_to_first_item enabled; "
                "pass default_to_first_item=False in this same update "
                "before setting an explicit default_value."
            )
        merged["defaultDataMask"] = _default_data_mask(merged, spec.default_value)
    elif (
        existing.get("filterType") == "filter_select"
        and (merged.get("controlValues") or {}).get("defaultToFirstItem")
        and "value"
        in ((existing.get("defaultDataMask") or {}).get("filterState") or {})
    ):
        # Heal defined legacy selections that block the UI's first-item default.
        merged["defaultDataMask"] = _default_data_mask(merged, [])
    elif (
        existing.get("filterType") == "filter_select"
        and spec.enable_empty_filter is not None
        and not ((existing.get("defaultDataMask") or {}).get("filterState") or {}).get(
            "value"
        )
    ):
        # Rebuild empty masks when the required control changes, including
        # older masks that stored value=None alongside an impossible predicate.
        merged["defaultDataMask"] = _default_data_mask(merged, [])
    elif _stored_default_is_stale(spec, existing, target_changed):
        # Reset rather than re-apply the old value against a different column,
        # a single-select control, or a "first item" default.
        merged["defaultDataMask"] = _default_data_mask(merged, [])


def _merge_filter_update(
    spec: NativeFilterUpdateSpec,
    existing: dict[str, Any],
    dashboard_chart_ids: list[int],
) -> dict[str, Any]:
    """Merge a partial update into an existing filter (or divider) config.

    Returns a FULL filter config (the backend command substitutes whole
    entries, it does not merge deltas).
    """
    merged = copy.deepcopy(existing)
    is_divider = _is_divider(merged)
    _validate_update_type_compat(spec, merged.get("filterType"), is_divider=is_divider)

    if spec.name is not None:
        # Dividers store their display text under "title", not "name";
        # writing "name" here would silently fail to update what the
        # filter bar actually renders.
        if is_divider:
            merged["title"] = spec.name
        else:
            merged["name"] = spec.name
    if spec.description is not None:
        merged["description"] = spec.description
    if spec.scope_chart_ids is not None:
        merged["scope"] = _build_scope(spec.scope_chart_ids, dashboard_chart_ids)
    target_changed = False
    if spec.dataset_id is not None or spec.column is not None:
        previous_target = dict((existing.get("targets") or [{}])[0] or {})
        _merge_target(spec, merged)
        target_changed = _target_key(merged["targets"][0]) != _target_key(
            previous_target
        )

    if not is_divider:
        # Dividers have no controlValues/defaultDataMask; type-specific
        # fields that would populate them are already rejected above, so
        # skip these to avoid introducing fields the frontend never writes
        # for a divider.
        control_values = dict(merged.get("controlValues") or {})
        for field, control_key in _CONTROL_VALUE_FIELDS.items():
            value = getattr(spec, field)
            if value is not None:
                control_values[control_key] = value
        merged["controlValues"] = control_values

        _merge_select_default(spec, existing, merged, target_changed)

        if spec.default_time_range is not None:
            merged["defaultDataMask"] = _time_data_mask(spec.default_time_range)

    return merged


def _filter_summary(conf: dict[str, Any]) -> NativeFilterSummary:
    """Summarize a filter (or divider) config for the response.

    Returns the id, name, filterType, and non-empty targets; empty target
    entries (e.g. for time filters) are dropped so the summary only lists
    real dataset/column targets. All user-controlled and operational fields
    preserve their application values so clients can pass them back verbatim.

    Dividers store their display text under "title" and have no
    "filterType"; both are normalized here so a divider shows up with a
    usable name and a "divider" filter_type instead of None/None.
    """
    is_divider = _is_divider(conf)
    name = conf.get("title") if is_divider else conf.get("name")
    filter_type = "divider" if is_divider else conf.get("filterType")
    targets = [t for t in (conf.get("targets") or []) if t]
    return NativeFilterSummary(
        id=conf.get("id"),
        name=name,
        filter_type=filter_type,
        targets=targets,
    )


def current_native_filter_config(dashboard: Any) -> list[dict[str, Any]]:
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


def _pre_filter_update_refusal(
    dashboard: "Dashboard | None", dashboard_id: int
) -> ManageNativeFiltersResponse | None:
    """Reject a missing or externally managed dashboard before filter edits."""
    if dashboard is None:
        return ManageNativeFiltersResponse(
            error=(
                f"Dashboard with ID {dashboard_id} not found."
                " Use list_dashboards to get valid dashboard IDs."
            ),
        )

    refusal: str | None = managed_dashboard_refusal(dashboard)
    if refusal is None:
        return None

    from superset import security_manager

    try:
        security_manager.raise_for_editorship(dashboard)
    except SupersetSecurityException:
        return ManageNativeFiltersResponse(
            dashboard_id=dashboard_id,
            permission_denied=True,
            error=(
                f"You don't have permission to edit dashboard {dashboard_id}. "
                "Changing native filters requires editorship of the dashboard."
            ),
        )
    except SQLAlchemyError:
        logger.exception(
            "Database error checking editorship for dashboard %s", dashboard_id
        )
        from superset import db

        try:
            db.session.rollback()  # pylint: disable=consider-using-transaction
        except SQLAlchemyError:
            logger.warning(
                "Database rollback failed during native filter error handling"
            )
        return ManageNativeFiltersResponse(
            dashboard_id=dashboard_id,
            error=(
                "Failed to verify dashboard edit permission due to a database error."
            ),
        )
    return ManageNativeFiltersResponse(
        dashboard_id=dashboard_id,
        managed_externally=True,
        error=refusal,
    )


@tool(
    tags=["mutate"],
    class_permission_name="Dashboard",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Manage dashboard native filters",
        readOnlyHint=False,
        destructiveHint=True,
        idempotentHint=False,
        openWorldHint=False,
    ),
)
def manage_native_filters(
    request: ManageNativeFiltersRequest, ctx: Context
) -> ManageNativeFiltersResponse:
    """
    Add, update, remove, or reorder dashboard native filters.

    Externally managed dashboards refuse edits
    (``managed_externally=True``); do not retry.

    Supported filter types for new filters: filter_select (dropdown backed
    by a dataset column), filter_time (time range), filter_range (numerical
    range backed by a dataset column), filter_timegrain (time grain
    backed by a dataset, which determines the grains it offers and
    validates selections against), and divider (a title/description-only
    visual separator with no dataset or column, used to group related
    filters in the filter bar). filter_timecolumn (time column) is not
    yet supported. Filter and divider IDs are generated by the server and
    returned in the response. Dividers share the same ordering as filters,
    so include their IDs in ``reorder`` alongside filter IDs.

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
            pre_filter_refusal: ManageNativeFiltersResponse | None = (
                _pre_filter_update_refusal(dashboard, request.dashboard_id)
            )
            if pre_filter_refusal is not None:
                return pre_filter_refusal
            assert dashboard is not None

            current_config = current_native_filter_config(dashboard)
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
