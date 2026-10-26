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
"""Authorized, bounded native dropdown discovery, independent of chart scope."""

from __future__ import annotations

import logging
import math
import re
import time
from collections.abc import Iterator
from contextlib import contextmanager
from copy import deepcopy
from dataclasses import dataclass, field
from decimal import Decimal
from numbers import Integral, Real
from typing import Any, cast, Literal, TYPE_CHECKING

from fastmcp.exceptions import ToolError
from flask import current_app, g
from jinja2 import meta, TemplateSyntaxError
from jinja2.exceptions import SecurityError
from marshmallow import ValidationError
from pandas import DataFrame, NA
from sqlalchemy.exc import CompileError, UnsupportedCompilationError

from superset import is_feature_enabled, security_manager
from superset.charts.data.form_data import set_query_context_form_data
from superset.charts.schemas import ChartDataQueryContextSchema
from superset.commands.chart.data.get_data_command import ChartDataCommand
from superset.constants import EMPTY_FILTER_SQL_EXPRESSION, NO_TIME_RANGE
from superset.daos.dataset import DatasetDAO
from superset.dashboards.filter_scope import _is_divider
from superset.dashboards.permalink.schemas import DashboardPermalinkStateSchema
from superset.exceptions import (
    OAuth2Error,
    OAuth2RedirectError,
    SupersetSecurityException,
)
from superset.mcp_service.chart.chart_helpers import (
    build_query_dicts_from_form_data,
    merge_extra_form_data,
)
from superset.mcp_service.dashboard.schemas import (
    _extract_native_filters,
    FilterValueDiscovery,
    FilterValueReason,
    FilterValueRequest,
    FilterValueScalar,
    GetDashboardInfoRequest,
    NativeFilterAvailableValues,
    NativeFilterValueSummary,
    ProposedFilterValues,
)
from superset.mcp_service.dashboard.tool.manage_native_filters import (
    _empty_select_data_mask,
    _FilterValidationError,
    _select_data_mask,
    current_native_filter_config,
)
from superset.mcp_service.privacy import user_can_view_data_model_metadata
from superset.utils import json
from superset.utils.core import apply_max_row_limit, FilterOperator, GenericDataType

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.models.dashboard import Dashboard

_MAX_QUERIES = 20
_SCHEDULING_SECONDS = 10
_PAGE_SIZE = 20
_MAX_SAFE_INTEGER = 2**53 - 1
# Mirrors the dashboard's extractUrlParams('regular') exclusions.
_RESERVED_URL_PARAMS = frozenset({"standalone", "edit"})
logger = logging.getLogger(__name__)


class _DiscoveryUnavailableError(Exception):
    """A bounded, non-sensitive failure for a single dropdown."""

    def __init__(self, reason: FilterValueReason) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass
class _Target:
    """A configured table target; this is metadata, not an access grant."""

    dataset: SqlaTable
    column: TableColumn


@dataclass
class _Discovery:
    """Call-local configuration, hydrated state, and execution accounting."""

    dashboard: Dashboard
    configs: dict[str, dict[str, Any]]
    masks: dict[str, dict[str, Any]]
    started: float = field(default_factory=time.monotonic)
    query_count: int = 0
    proposal_errors: dict[str, FilterValueReason] = field(default_factory=dict)
    targets: dict[
        tuple[int, str],
        _Target | _DiscoveryUnavailableError | SupersetSecurityException,
    ] = field(default_factory=dict)
    mask_error_reasons: dict[str, FilterValueReason] = field(default_factory=dict)
    normalized_masks: set[str] = field(default_factory=set)
    url_params: dict[str, str] = field(default_factory=dict)


def _check_budget(context: _Discovery) -> None:
    """Stop preparation and authorization after a call reaches either budget."""
    if context.query_count >= _MAX_QUERIES:
        raise _DiscoveryUnavailableError("query_budget")
    if time.monotonic() - context.started >= _SCHEDULING_SECONDS:
        raise _DiscoveryUnavailableError("scheduling_budget")


def _configured_filters(dashboard: Dashboard) -> list[dict[str, Any]]:
    """Read saved definitions in order, excluding visual dividers."""
    return [c for c in current_native_filter_config(dashboard) if not _is_divider(c)]


def _select_target(conf: dict[str, Any], context: _Discovery) -> _Target:
    """Memoize a native target's metadata preflight, never its final query gate."""
    _check_budget(context)
    controls = conf.get("controlValues") or {}
    if (
        conf.get("filterType") != "filter_select"
        or not isinstance(controls, dict)
        or controls.get("inverseSelection")
        or controls.get("operatorType", "exact") != "exact"
    ):
        raise _DiscoveryUnavailableError("unsupported_filter")
    targets = conf.get("targets")
    if not isinstance(targets, list) or len(targets) != 1:
        raise _DiscoveryUnavailableError("unsupported_target")
    target = targets[0]
    if (
        not isinstance(target, dict)
        or target.get("datasourceType") not in (None, "table")
        or target.get("semantic_selection_version")
        or type(target.get("datasetId")) is not int
        or target["datasetId"] <= 0
        or not isinstance(target.get("column"), dict)
        or not isinstance(target["column"].get("name"), str)
        or not target["column"]["name"]
    ):
        raise _DiscoveryUnavailableError("unsupported_target")
    key = (target["datasetId"], conf["id"])
    cached = context.targets.get(key)
    if isinstance(cached, Exception):
        raise cached
    if cached is not None:
        return cached
    dataset = DatasetDAO.find_by_id(target["datasetId"], skip_base_filter=True)
    if dataset is None:
        raise _DiscoveryUnavailableError("unsupported_target")
    column = next(
        (col for col in dataset.columns if col.column_name == target["column"]["name"]),
        None,
    )
    if column is None:
        raise _DiscoveryUnavailableError("unsupported_target")
    # Native authorization preserves dashboard-only grants and guest limits.
    # This memoized context is never executed. Every final query is authorized
    # separately with its complete predicates before dataframe cache access.
    access_context = ChartDataQueryContextSchema().load(
        {
            "datasource": {"id": dataset.id, "type": "table"},
            "queries": [
                {"columns": [column.column_name], "metrics": [], "row_limit": 1}
            ],
            "form_data": {
                "type": "NATIVE_FILTER",
                "dashboardId": context.dashboard.id,
                "native_filter_id": conf["id"],
            },
            "result_type": "full",
            "result_format": "json",
        }
    )
    _check_budget(context)
    try:
        ChartDataCommand(access_context).validate()
    except SupersetSecurityException as ex:
        context.targets[key] = ex
        raise
    if column.type_generic not in (
        GenericDataType.STRING,
        GenericDataType.NUMERIC,
        GenericDataType.BOOLEAN,
    ):
        error = _DiscoveryUnavailableError("unsupported_target")
        context.targets[key] = error
        raise error
    resolved = _Target(dataset, column)
    context.targets[key] = resolved
    return resolved


def _compatible(value: FilterValueScalar, target: _Target) -> bool:
    """Compare JSON scalar families, keeping booleans distinct from numbers."""
    if value is None:
        return True
    if type(value) not in (str, bool, int, float) or (
        isinstance(value, float) and not math.isfinite(value)
    ):
        return False
    if isinstance(value, str):
        return target.column.type_generic == GenericDataType.STRING
    if type(value) is bool:
        return target.column.type_generic == GenericDataType.BOOLEAN
    return target.column.type_generic == GenericDataType.NUMERIC


def _ancestors(filter_id: str, configs: dict[str, dict[str, Any]]) -> list[str]:
    """Resolve ancestors furthest first and reject missing or cyclic graphs."""
    ordered: list[str] = []
    active: set[str] = set()
    visited: set[str] = set()

    def visit(current: str) -> None:
        """Walk one configuration, retaining stable parent ordering."""
        if current in active or current not in configs:
            raise _DiscoveryUnavailableError("parent_unresolved")
        if current in visited:
            return
        active.add(current)
        parents = configs[current].get("cascadeParentIds") or []
        if not isinstance(parents, list) or any(
            not isinstance(p, str) for p in parents
        ):
            raise _DiscoveryUnavailableError("parent_unresolved")
        for parent in parents:
            visit(parent)
        active.remove(current)
        visited.add(current)
        if current != filter_id:
            ordered.append(current)

    visit(filter_id)
    return ordered


def _requests(
    configs: list[dict[str, Any]],
    request: GetDashboardInfoRequest,
) -> list[FilterValueRequest]:
    """Choose explicit IDs or a bounded page before querying any datasource."""
    if request.filter_value_requests is not None:
        return request.filter_value_requests
    return [
        FilterValueRequest(filter_id=c["id"])
        for c in configs[
            request.filter_values_offset : request.filter_values_offset + _PAGE_SIZE
        ]
    ]


def validate_discovery_configuration(  # noqa: C901
    dashboard: Dashboard,
    request: GetDashboardInfoRequest,
    *,
    started_at: float | None = None,
) -> _Discovery:
    """Reject invalid IDs, proposed ancestors, and scalar types before querying."""
    configured = _configured_filters(dashboard)
    configs: dict[str, dict[str, Any]] = {
        c["id"]: c for c in configured if isinstance(c.get("id"), str)
    }
    if any(not isinstance(c.get("id"), str) or not c["id"] for c in configured) or len(
        configs
    ) != len(configured):
        raise ValueError("Native filter configuration has invalid or duplicate IDs")
    context = _Discovery(
        dashboard,
        configs,
        {},
        started=time.monotonic() if started_at is None else started_at,
    )
    requests = _requests(configured, request)
    for item in requests:
        if item.filter_id not in configs:
            raise ValueError(f"Unknown native filter ID: {item.filter_id}")
        if "exact_value" in item.model_fields_set:
            try:
                target = _select_target(configs[item.filter_id], context)
            except (_DiscoveryUnavailableError, SupersetSecurityException):
                continue
            if not _compatible(item.exact_value, target):
                raise ValueError(
                    f"Incompatible exact value for native filter {item.filter_id}"
                )
    allowed: set[str] = set()
    for item in requests:
        try:
            allowed.update(_ancestors(item.filter_id, configs))
        except _DiscoveryUnavailableError:
            pending = [item.filter_id]
            visited: set[str] = set()
            while pending:
                current = pending.pop()
                if current in visited or current not in configs:
                    continue
                visited.add(current)
                parents = configs[current].get("cascadeParentIds")
                if isinstance(parents, list):
                    pending.extend(p for p in parents if isinstance(p, str))
            allowed.update(visited - {item.filter_id})
    for proposal in request.proposed_filter_values or []:
        if proposal.filter_id not in configs or proposal.filter_id not in allowed:
            raise ValueError(
                "Proposed filters must be configured ancestors of requested filters"
            )
        conf = configs[proposal.filter_id]
        controls = conf.get("controlValues") or {}
        if (
            isinstance(controls, dict)
            and controls.get("multiSelect") is False
            and len(proposal.values) > 1
        ):
            raise ValueError("A single-select proposal accepts at most one value")
        try:
            target = _select_target(conf, context)
        except (_DiscoveryUnavailableError, SupersetSecurityException):
            continue
        if any(not _compatible(value, target) for value in proposal.values):
            raise ValueError(
                f"Incompatible proposed value for native filter {proposal.filter_id}"
            )
    return context


def _real_value(value: Any) -> bool:
    """Mirror fillNativeFilters' empty/all-null-array restoration test."""
    return value is not None and not (
        isinstance(value, list) and all(v is None for v in value)
    )


def _explicit_clear(mask: dict[str, Any]) -> bool:
    """Recognize only the frontend's canonical match-nothing clear evidence."""
    extra = mask.get("extraFormData") or {}
    if not isinstance(extra, dict):
        return False
    predicates = extra.get("adhoc_filters")
    return isinstance(predicates, list) and any(
        isinstance(p, dict)
        and p.get("expressionType") == "SQL"
        and p.get("clause") == "WHERE"
        and p.get("sqlExpression") == EMPTY_FILTER_SQL_EXPRESSION
        for p in predicates
    )


def _validate_snapshot_value(conf: dict[str, Any], value: Any) -> None:  # noqa: C901
    """Reject malformed known native selection shapes before any option query."""
    if value is None:
        return
    kind = conf.get("filterType")
    if kind in ("filter_select", "filter_range", "filter_timegrain") and not isinstance(
        value, list
    ):
        raise _DiscoveryUnavailableError("state_invalid")
    if kind == "filter_range":
        if len(value) != 2 or any(
            item is not None and type(item) not in (int, float) for item in value
        ):
            raise _DiscoveryUnavailableError("state_invalid")
        if all(item is not None for item in value) and value[0] > value[1]:
            raise _DiscoveryUnavailableError("state_invalid")
    elif kind == "filter_timegrain":
        if len(value) > 1 or any(not isinstance(item, str) for item in value):
            raise _DiscoveryUnavailableError("state_invalid")
    elif kind == "filter_time" and not isinstance(value, str):
        raise _DiscoveryUnavailableError("state_invalid")


def _normalize_select_mask(  # noqa: C901
    context: _Discovery,
    conf: dict[str, Any],
    mask: dict[str, Any],
) -> dict[str, Any]:
    """Validate effective selections and recover lossless browser numeric strings."""
    invalid_reason = context.mask_error_reasons[conf["id"]]
    state = mask.get("filterState")
    controls = conf.get("controlValues") or {}
    if not isinstance(state, dict) or not isinstance(controls, dict):
        return {"invalid_reason": invalid_reason}
    values = state.get("value")
    if conf.get("filterType") != "filter_select":
        try:
            _validate_snapshot_value(conf, values)
        except _DiscoveryUnavailableError:
            return {"invalid_reason": invalid_reason}
        return mask
    # Empty selections need no parent column metadata. Predicate reconstruction
    # still applies required-clear and unresolved-state semantics downstream.
    if values is None or values == []:
        return mask
    try:
        target = _select_target(conf, context)
    except SupersetSecurityException:
        return {"invalid_reason": "permission_denied"}
    except _DiscoveryUnavailableError as ex:
        return (
            mask
            if ex.reason.startswith("unsupported_")
            else {"invalid_reason": ex.reason}
        )
    if not isinstance(values, list):
        return {"invalid_reason": invalid_reason}
    if controls.get("multiSelect") is False and len(values) > 1:
        return {"invalid_reason": invalid_reason}
    normalized = []
    try:
        for value in values:
            if (
                target.column.type_generic == GenericDataType.NUMERIC
                and isinstance(value, str)
                and re.fullmatch(
                    r"-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?", value
                )
            ):
                value = _scalar(Decimal(value))
            if (
                target.column.type_generic == GenericDataType.BOOLEAN
                and type(value) in (int, float)
                and value in (0, 1)
            ):
                value = bool(value)
            if not _compatible(value, target):
                return {"invalid_reason": invalid_reason}
            if not _safe_number(value):
                return {"invalid_reason": "invalid_scalar"}
            normalized.append(value)
    except _DiscoveryUnavailableError as ex:
        return {"invalid_reason": ex.reason}
    except ArithmeticError:
        return {"invalid_reason": "invalid_scalar"}
    state["value"] = normalized
    return mask


def _url_params(pairs: Any) -> dict[str, str]:
    """Rebuild the dashboard's query url_params from snapshot key-value pairs.

    The dashboard sends every non-reserved URL parameter with each dropdown
    query, so ``url_param`` macros in virtual dataset SQL render against them.
    """
    if pairs is None:
        return {}
    if not isinstance(pairs, list):
        raise _DiscoveryUnavailableError("state_invalid")
    params: dict[str, str] = {}
    for pair in pairs:
        if pair is None:
            # The permalink schema permits null entries; they carry no parameter.
            continue
        if (
            not isinstance(pair, (list, tuple))
            or len(pair) != 2
            or any(part is not None and not isinstance(part, str) for part in pair)
        ):
            raise _DiscoveryUnavailableError("state_invalid")
        key, value = pair
        if key is None or value is None or key in _RESERVED_URL_PARAMS:
            continue
        # URLSearchParams keeps the last value for a repeated key.
        params[key] = value
    return params


def _hydrate_masks(  # noqa: C901
    context: _Discovery,
    snapshot_state: dict[str, Any] | None,
) -> dict[str, dict[str, Any]]:
    """Shallow-merge initial/default/loaded masks and restore required defaults."""
    configs = context.configs
    loaded_masks: dict[str, Any] = {}
    if snapshot_state is not None:
        if not isinstance(snapshot_state, dict):
            raise _DiscoveryUnavailableError("state_invalid")
        supplied_masks = snapshot_state.get("dataMask")
        if isinstance(supplied_masks, dict):
            # Explicit masks are authoritative even with extra permalink metadata.
            loaded_masks = supplied_masks
        elif supplied_masks is not None:
            raise _DiscoveryUnavailableError("state_invalid")
        else:
            try:
                state = DashboardPermalinkStateSchema().load(snapshot_state)
            except ValidationError as ex:
                raise _DiscoveryUnavailableError("state_invalid") from ex
            if any(
                pair and pair[0] in ("native_filters", "native_filters_key")
                for pair in state.get("urlParams") or []
            ):
                # URL-encoded selections are not native dataMask state.
                raise _DiscoveryUnavailableError("state_invalid")
        context.url_params = _url_params(snapshot_state.get("urlParams"))
        for filter_id, mask in loaded_masks.items():
            if not isinstance(filter_id, str) or not isinstance(mask, dict):
                raise _DiscoveryUnavailableError("state_invalid")
            if filter_id not in configs:
                continue
            if any(
                key in mask and not isinstance(mask[key], dict)
                for key in ("filterState", "extraFormData", "ownState")
            ):
                raise _DiscoveryUnavailableError("state_invalid")
            value = mask.get("filterState", {}).get("value")
            values = value if isinstance(value, list) else [value]
            for scalar in values:
                if scalar is not None and (
                    type(scalar) not in (str, int, float, bool)
                    or (isinstance(scalar, float) and not math.isfinite(scalar))
                ):
                    raise _DiscoveryUnavailableError("state_invalid")
    hydrated: dict[str, dict[str, Any]] = {}
    for filter_id, conf in configs.items():
        default = conf.get("defaultDataMask") or {}
        loaded = loaded_masks.get(filter_id, {})
        context.mask_error_reasons[filter_id] = (
            "state_invalid" if "filterState" in loaded else "parent_unresolved"
        )
        if not isinstance(default, dict):
            hydrated[filter_id] = {"invalid": True}
            continue
        mask = {
            "filterState": {},
            "extraFormData": {},
            **deepcopy(default),
            **deepcopy(loaded),
        }
        controls = conf.get("controlValues") or {}
        loaded_state = loaded.get("filterState") or {}
        if not isinstance(loaded_state, dict) or not isinstance(controls, dict):
            hydrated[filter_id] = {"invalid": True}
            continue
        has_value = _real_value(loaded_state.get("value"))
        explicit_clear = (
            conf.get("filterType") == "filter_select"
            and not has_value
            and _explicit_clear(loaded)
        )
        if (
            controls.get("enableEmptyFilter")
            and default
            and not explicit_clear
            and (
                not has_value
                or (not loaded.get("extraFormData") and default.get("extraFormData"))
            )
        ):
            mask["filterState"] = deepcopy(default.get("filterState") or {})
            mask["extraFormData"] = deepcopy(default.get("extraFormData") or {})
            context.mask_error_reasons[filter_id] = "parent_unresolved"
        hydrated[filter_id] = mask
    return hydrated


def _selected_extra(  # noqa: C901
    context: _Discovery, conf: dict[str, Any], mask: dict[str, Any]
) -> dict[str, Any]:
    """Rebuild parent predicates from typed values, never executing snapshot SQL."""
    from superset.mcp_service.dashboard.tool.apply_dashboard_filters import (
        _range_data_mask,
        _time_data_mask,
    )

    state = mask.get("filterState")
    if mask.get("invalid_reason"):
        raise _DiscoveryUnavailableError(mask["invalid_reason"])
    if mask.get("invalid") or not isinstance(state, dict):
        raise _DiscoveryUnavailableError("parent_unresolved")
    controls = conf.get("controlValues") or {}
    value = state.get("value")
    if controls.get("defaultToFirstItem") and "value" not in state:
        raise _DiscoveryUnavailableError("parent_unresolved")
    kind = conf.get("filterType")
    if kind != "filter_select" and value is None and mask.get("extraFormData"):
        # As with Select, predicates without a typed value cannot be rebuilt,
        # and reading them as unfiltered would overstate the child's choices.
        raise _DiscoveryUnavailableError("parent_unresolved")
    try:
        if kind == "filter_select":
            values = [] if value is None else value
            if values == [] and not (
                value is None
                and mask.get("extraFormData")
                and not _explicit_clear(mask)
            ):
                return cast(
                    dict[str, Any], _empty_select_data_mask(conf)["extraFormData"]
                )
            target = _select_target(conf, context)
            if not isinstance(values, list) or any(
                not _compatible(v, target) for v in values
            ):
                raise _DiscoveryUnavailableError("parent_unresolved")
            if any(not _safe_number(v) for v in values):
                raise _DiscoveryUnavailableError("invalid_scalar")
            # SQL-only state is not a selected value. A canonical clear is the
            # sole SQL-shaped evidence we recognize and regenerate ourselves.
            if (
                value is None
                and mask.get("extraFormData")
                and not _explicit_clear(mask)
            ):
                raise _DiscoveryUnavailableError("parent_unresolved")
            return cast(
                dict[str, Any], _select_data_mask(conf, values)["extraFormData"]
            )
        if kind == "filter_time":
            if value is not None and not isinstance(value, str):
                raise _DiscoveryUnavailableError("parent_unresolved")
            return cast(
                dict[str, Any],
                _time_data_mask(conf, value or NO_TIME_RANGE)["extraFormData"],
            )
        if kind == "filter_range":
            values = [None, None] if value is None else value
            if (
                not isinstance(values, list)
                or len(values) != 2
                or any(
                    v is not None
                    and (type(v) not in (int, float) or not math.isfinite(v))
                    for v in values
                )
            ):
                raise _DiscoveryUnavailableError("parent_unresolved")
            if all(v is not None for v in values) and values[0] > values[1]:
                raise _DiscoveryUnavailableError("parent_unresolved")
            return cast(dict[str, Any], _range_data_mask(conf, values)["extraFormData"])
        if kind == "filter_timegrain":
            values = [] if value is None else value
            if (
                not isinstance(values, list)
                or len(values) > 1
                or any(not isinstance(v, str) for v in values)
            ):
                raise _DiscoveryUnavailableError("parent_unresolved")
            if not values:
                if controls.get("enableEmptyFilter"):
                    raise _DiscoveryUnavailableError("parent_unresolved")
                return {}
            targets = conf.get("targets")
            if (
                not isinstance(targets, list)
                or len(targets) != 1
                or not isinstance(targets[0], dict)
            ):
                raise _DiscoveryUnavailableError("parent_unresolved")
            grain_target = targets[0]
            if (
                grain_target.get("datasourceType") not in (None, "table")
                or type(grain_target.get("datasetId")) is not int
            ):
                raise _DiscoveryUnavailableError("parent_unresolved")
            dataset = DatasetDAO.find_by_id(
                grain_target["datasetId"], skip_base_filter=True
            )
            allowed = conf.get("time_grains")
            if (
                dataset is None
                or (allowed and values[0] not in allowed)
                or values[0]
                not in [duration for duration, _ in dataset.time_grain_sqla]
            ):
                raise _DiscoveryUnavailableError("parent_unresolved")
            return {"time_grain_sqla": values[0]}
    except _DiscoveryUnavailableError as ex:
        if ex.reason in ("invalid_scalar", "query_budget", "scheduling_budget"):
            raise
        raise _DiscoveryUnavailableError("parent_unresolved") from ex
    except ArithmeticError as ex:
        raise _DiscoveryUnavailableError("invalid_scalar") from ex
    except (TypeError, ValueError, _FilterValidationError) as ex:
        raise _DiscoveryUnavailableError("parent_unresolved") from ex
    raise _DiscoveryUnavailableError("parent_unresolved")


def _parent_extra(context: _Discovery, filter_id: str) -> dict[str, Any]:
    """Merge transitive parents in native order, excluding self and nonparents."""
    extra: dict[str, Any] = {}
    for parent in _ancestors(filter_id, context.configs):
        if parent in context.proposal_errors:
            raise _DiscoveryUnavailableError(context.proposal_errors[parent])
        if parent not in context.normalized_masks:
            context.masks[parent] = _normalize_select_mask(
                context, context.configs[parent], context.masks[parent]
            )
            context.normalized_masks.add(parent)
        extra = merge_extra_form_data(
            extra,
            _selected_extra(context, context.configs[parent], context.masks[parent]),
        )
    return extra


def _templates_observe_metrics(conf: dict[str, Any], dataset: SqlaTable) -> bool:
    """Whether Jinja rendered for a dropdown query could read its metrics list.

    The dashboard dropdown renders templates with only its sort metric, so an
    internal evidence metric must not be visible to any template that reads
    ``metrics`` or renders another metric through the ``metric`` macro.
    """
    if not is_feature_enabled("ENABLE_TEMPLATE_PROCESSING"):
        return False
    texts: list[Any] = [
        dataset.sql,
        *(column.expression for column in dataset.columns),
        *(metric.expression for metric in dataset.metrics),
        *(
            predicate.get("sqlExpression")
            for predicate in conf.get("adhoc_filters") or []
            if isinstance(predicate, dict)
        ),
        *(rule.clause for rule in security_manager.get_rls_filters(dataset)),
        *(
            rule.get("clause")
            for rule in security_manager.get_guest_rls_filters(dataset)
        ),
    ]
    env = None
    for text in texts:
        if not isinstance(text, str) or "metric" not in text:
            continue
        env = env or dataset.get_template_processor().env
        try:
            names = meta.find_undeclared_variables(env.parse(text))
        except (SecurityError, TemplateSyntaxError):
            # An unparseable template cannot be shown not to read metrics.
            return True
        if names & {"metrics", "metric"}:
            return True
    return False


def _native_query(  # noqa: C901
    context: _Discovery,
    conf: dict[str, Any],
    target: _Target,
    item: FilterValueRequest,
    proposal: ProposedFilterValues | None = None,
) -> tuple[ChartDataCommand, int]:
    """Build the Select dropdown QueryContext and authorize it before cache use."""
    column = target.column.column_name
    controls = conf.get("controlValues") or {}
    metric = conf.get("sortMetric") or controls.get("sortMetric")
    if metric is not None and not isinstance(metric, str):
        raise _DiscoveryUnavailableError("unsupported_target")
    configured_limit = current_app.config.get("NATIVE_FILTER_DEFAULT_ROW_LIMIT", 1000)
    if type(configured_limit) is not int or configured_limit <= 0:
        raise _DiscoveryUnavailableError("query_budget")
    # Query with the dashboard dropdown's own row limit, which virtual dataset
    # Jinja also renders as row_limit. item.limit only bounds returned options.
    limit = apply_max_row_limit(configured_limit)
    if limit <= 0:
        raise _DiscoveryUnavailableError("query_budget")
    parents = _parent_extra(context, conf["id"])
    parent_filters = parents.pop("filters", [])
    form_data = {
        **deepcopy(controls),
        "datasource": f"{target.dataset.id}__table",
        "groupby": [column],
        "metrics": [],
        "row_limit": limit,
        "adhoc_filters": deepcopy(conf.get("adhoc_filters") or []),
        "extra_filters": [],
        "extra_form_data": parents,
        "time_range": conf.get("time_range"),
        "granularity_sqla": conf.get("granularity_sqla"),
        "url_params": deepcopy(context.url_params),
        "viz_type": "filter_select",
        "type": "NATIVE_FILTER",
        "dashboardId": context.dashboard.id,
        "native_filter_id": conf["id"],
    }
    query = build_query_dicts_from_form_data(
        form_data, target.dataset.id, "table", row_limit=limit
    )[0]
    # Parent selections are dashboard state, so they take the native coercion an
    # ordinary dashboard query applies (e.g. the <NULL> and <empty string>
    # sentinels). Only discovery's own target predicates below stay literal.
    for predicate in parent_filters:
        query["filters"].append({**predicate, "is_literal": False})
    query["columns"] = [column]
    query.setdefault("extras", {})["preserve_literal_values"] = True
    query["metrics"] = [metric] if metric else []
    if target.column.type_generic == GenericDataType.NUMERIC and not (
        _templates_observe_metrics(conf, target.dataset)
    ):
        # Pandas represents both SQL NULL and database NaN as NaN in float
        # columns. COUNT(target) distinguishes those groups without another query.
        # Templates that read metrics skip it to render as the dropdown does;
        # their ambiguous NaN groups are then omitted as invalid scalars.
        count_label = "__mcp_native_nonnull_count"
        while count_label in (column, metric):
            count_label += "_"
        query["metrics"].append(
            {
                "expressionType": "SIMPLE",
                "aggregate": "COUNT",
                "column": {"column_name": column},
                "label": count_label,
            }
        )
    query["orderby"] = (
        [[metric or column, controls.get("sortAscending", True)]]
        if metric or not item.search
        else []
    )
    if proposal is not None:
        query["filters"].append(
            {
                "col": column,
                "op": FilterOperator.IN.value,
                "val": proposal.values,
                "is_literal": True,
            }
        )
    elif "exact_value" in item.model_fields_set:
        query["filters"].append(
            {
                "col": column,
                "op": FilterOperator.IS_NULL.value
                if item.exact_value is None
                else FilterOperator.EQUALS.value,
                "val": item.exact_value,
                "is_literal": True,
            }
        )
    elif item.search:
        if (
            target.column.type_generic != GenericDataType.STRING
            or not item.search.isascii()
        ):
            raise _DiscoveryUnavailableError("unsupported_search")
        query["filters"].append(
            {
                "col": column,
                "op": FilterOperator.ILIKE.value,
                "val": item.search,
                "is_literal": True,
            }
        )
    # Internal semantics are deliberately absent from the public chart-data schema.
    literal_filters = []
    for predicate in query["filters"]:
        if predicate.pop("is_literal", False):
            literal_filters.append(deepcopy(predicate))
    query["extras"].pop("preserve_literal_values")
    query_context = ChartDataQueryContextSchema().load(
        {
            "datasource": {"id": target.dataset.id, "type": "table"},
            "queries": [query],
            "form_data": form_data,
            "result_type": "full",
            "result_format": "json",
            "force": False,
        }
    )
    loaded_query = query_context.queries[0]
    # Factory temporal normalization may remove/rewrite saved predicates. Match
    # only our appended literals, from the end, rather than relying on positions.
    unmatched = list(range(len(loaded_query.filter)))
    for literal_predicate in reversed(literal_filters):
        index = next(
            (
                i
                for i in reversed(unmatched)
                if all(
                    loaded_query.filter[i].get(key) == literal_predicate.get(key)
                    for key in ("col", "op", "val")
                )
            ),
            None,
        )
        if index is None:
            raise _DiscoveryUnavailableError("query_not_executed")
        loaded_query.filter[index]["is_literal"] = True
        unmatched.remove(index)
    loaded_query.extras["preserve_literal_values"] = True
    if loaded_query.row_limit != limit:
        raise _DiscoveryUnavailableError("query_budget")
    # Jinja macros (url_param, get_time_filter, filter_values) read the request
    # form data, as on the chart data API, during validation and execution.
    set_query_context_form_data(query_context, target.dataset.id, "table")
    command = ChartDataCommand(query_context)
    _check_budget(context)
    command.validate()
    return command, limit


def _safe_number(value: Any) -> bool:
    """Keep integral JSON numbers lossless through the JavaScript host boundary."""
    if isinstance(value, Integral):
        return abs(int(value)) <= _MAX_SAFE_INTEGER
    if isinstance(value, Decimal):
        return value.is_finite() and (
            value != value.to_integral_value() or abs(value) <= _MAX_SAFE_INTEGER
        )
    if isinstance(value, Real):
        number = float(value)
        return math.isfinite(number) and (
            not number.is_integer() or abs(number) <= _MAX_SAFE_INTEGER
        )
    return True


def _scalar_equal(left: FilterValueScalar, right: FilterValueScalar) -> bool:
    """Compare JSON numeric values without treating booleans as numbers."""
    return left == right and (
        type(left) is type(right)
        or type(left) in (int, float)
        and type(right) in (int, float)
    )


def _scalar(value: Any) -> FilterValueScalar:  # noqa: C901
    """Normalize supported database scalars without text or numeric loss."""
    if value is NA:
        return None
    if not _safe_number(value):
        raise _DiscoveryUnavailableError("invalid_scalar")
    if value is None or type(value) in (bool, int, str):
        if isinstance(value, str):
            try:
                value.encode("utf-8")
            except UnicodeEncodeError as ex:
                raise _DiscoveryUnavailableError("invalid_scalar") from ex
        return cast(FilterValueScalar, value)
    if isinstance(value, Integral):
        return int(value)
    if isinstance(value, Real):
        result = float(value)
        if math.isfinite(result) and result == value:
            return result
    if isinstance(value, Decimal) and value.is_finite():
        if value == value.to_integral_value():
            return int(value)
        result = float(value)
        if math.isfinite(result) and Decimal(str(result)) == value:
            return result
    # numpy.bool_ is neither bool nor Integral.
    if type(value).__module__ == "numpy" and type(value).__name__ == "bool":
        return bool(value)
    if type(value).__module__ == "numpy" and type(value).__name__ == "bool_":
        return bool(value)
    raise _DiscoveryUnavailableError("invalid_scalar")


def _execute(command: ChartDataCommand) -> dict[str, Any]:
    """Read the authorized dataframe cache without chart JSON's lossy conversions.

    ChartDataCommand.run materializes NaN/infinity as null and large integers as
    strings. Dropdown membership requires inspecting the stored scalar first.
    """
    context = command.query_context
    query = context.queries[0]
    payload = context.get_df_payload(query)
    if payload.get("error") or payload.get("status") == "failed":
        raise _DiscoveryUnavailableError("query_failed")
    if payload.get("rejected_filter_columns"):
        raise _DiscoveryUnavailableError("parent_unresolved")
    dataframe = payload.get("df")
    if not isinstance(dataframe, DataFrame) or not dataframe.columns.is_unique:
        raise _DiscoveryUnavailableError("query_failed")
    target = query.columns[0]
    labels = payload.get("label_map") or {}
    columns = [
        name
        for name in dataframe.columns
        if name == target or labels.get(name) == [target]
    ]
    if len(columns) != 1:
        raise _DiscoveryUnavailableError("query_failed")
    count_metric = next(
        (
            metric
            for metric in query.metrics or []
            if isinstance(metric, dict) and metric.get("aggregate") == "COUNT"
        ),
        None,
    )
    count_column = count_metric["label"] if count_metric else None
    if count_column and count_column not in dataframe.columns:
        raise _DiscoveryUnavailableError("query_failed")
    rows = []
    for index, value in enumerate(dataframe[columns[0]].array):
        if count_column and dataframe[count_column].iloc[index] == 0:
            value = None
        rows.append({target: value})
    return {
        "queries": [
            {
                "data": rows,
                "is_truncated": bool(payload.get("warning")),
                "applied_template_filters": payload.get("applied_template_filters")
                or [],
            }
        ]
    }


def _run(  # noqa: C901
    context: _Discovery,
    conf: dict[str, Any],
    item: FilterValueRequest,
    proposal: ProposedFilterValues | None = None,
) -> tuple[list[FilterValueScalar], bool, FilterValueReason | None]:
    """Validate access, then schedule at most one bounded dataset query attempt."""
    _check_budget(context)
    target = _select_target(conf, context)
    command, limit = _native_query(context, conf, target, item, proposal)
    probes = proposal.values if proposal is not None else [item.exact_value]
    if any(not _safe_number(value) for value in probes):
        raise _DiscoveryUnavailableError("invalid_scalar")
    if proposal is not None and not proposal.values:
        return [], False, None
    _check_budget(context)
    context.query_count += 1
    try:
        result = _execute(command)
    except (CompileError, UnsupportedCompilationError, NotImplementedError) as ex:
        if item.search:
            raise _DiscoveryUnavailableError("unsupported_search") from ex
        raise
    queries = result.get("queries")
    if not isinstance(queries, list) or len(queries) != 1 or queries[0].get("error"):
        raise _DiscoveryUnavailableError("query_failed")
    probes_target = (
        bool(item.search)
        or proposal is not None
        or "exact_value" in item.model_fields_set
    )
    if probes_target and target.column.column_name in (
        queries[0].get("applied_template_filters") or []
    ):
        # Jinja filter macros receive discovery's own probe of the target column
        # (raw search text, an equality or a proposal list) and may consume it
        # without applying it, so the rows cannot prove which options match.
        raise _DiscoveryUnavailableError(
            "unsupported_search" if item.search else "unsupported_target"
        )
    rows = queries[0].get("data")
    if isinstance(rows, str):
        rows = json.loads(rows)
    if not isinstance(rows, list):
        raise _DiscoveryUnavailableError("query_failed")
    values: list[FilterValueScalar] = []
    strict_probe = proposal is not None or "exact_value" in item.model_fields_set
    skipped = False
    # The extra row is only evidence of a longer domain, never a returned option.
    selected_rows = rows if strict_probe else rows[: item.limit]
    for row in selected_rows:
        if not isinstance(row, dict) or target.column.column_name not in row:
            raise _DiscoveryUnavailableError("query_failed")
        try:
            value = row[target.column.column_name]
            if (
                target.column.type_generic == GenericDataType.NUMERIC
                and isinstance(value, str)
                and re.fullmatch(r"0|-?[1-9][0-9]*", value)
            ):
                # SupersetResultSet stringifies an entire integer column when
                # one row overflows int64. Recover canonical integers only.
                value = int(value)
            value = _scalar(value)
            if (
                target.column.type_generic == GenericDataType.BOOLEAN
                and type(value) in (int, float)
                and value in (0, 1)
            ):
                value = bool(value)
            if not _compatible(value, target):
                raise _DiscoveryUnavailableError("invalid_scalar")
        except (_DiscoveryUnavailableError, ArithmeticError, ValueError) as ex:
            if strict_probe:
                raise _DiscoveryUnavailableError("invalid_scalar") from ex
            skipped = True
            continue
        values.append(value)
    row_limited = (
        len(rows) > item.limit
        or len(rows) >= limit
        or bool(queries[0].get("is_truncated"))
    )
    return (
        values[: item.limit],
        row_limited or skipped,
        "row_limit" if row_limited else "invalid_scalar" if skipped else None,
    )


def _result(
    item: FilterValueRequest,
    *,
    values: list[FilterValueScalar] | None = None,
    reason: FilterValueReason | None = None,
    truncated: bool = False,
) -> NativeFilterAvailableValues:
    """Return one completeness claim and an unchanged query-mode echo."""
    status: Literal["complete", "truncated", "unavailable", "unsupported"] = "complete"
    if reason:
        status = "unsupported" if reason.startswith("unsupported_") else "unavailable"
    if truncated:
        status, reason = "truncated", reason or "row_limit"
    return NativeFilterAvailableValues(
        status=status,
        reason=reason,
        values=values or [],
        query_mode="exact"
        if "exact_value" in item.model_fields_set
        else "contains"
        if item.search
        else "list",
        search=item.search,
        exact_value=item.exact_value,
    )


def _validate_proposals(  # noqa: C901
    context: _Discovery, proposals: list[ProposedFilterValues]
) -> list[ProposedFilterValues]:
    """Validate ancestors topologically against the cloned effective snapshot."""
    by_id = {p.filter_id: p for p in proposals}
    ordered: list[str] = []
    for proposal in proposals:
        try:
            ancestors = _ancestors(proposal.filter_id, context.configs)
        except _DiscoveryUnavailableError:
            context.proposal_errors[proposal.filter_id] = "parent_unresolved"
            continue
        for filter_id in [*ancestors, proposal.filter_id]:
            if filter_id in by_id and filter_id not in ordered:
                ordered.append(filter_id)
    validated: list[ProposedFilterValues] = []
    for filter_id in ordered:
        proposal = by_id[filter_id]
        before_queries = context.query_count
        try:
            values, truncated, _ = _run(
                context,
                context.configs[filter_id],
                FilterValueRequest(filter_id=filter_id, limit=20),
                proposal,
            )
            if truncated or any(
                not any(_scalar_equal(v, candidate) for candidate in values)
                for v in proposal.values
            ):
                raise _DiscoveryUnavailableError("proposal_invalid")
            context.masks[filter_id] = _select_data_mask(
                context.configs[filter_id], proposal.values
            )
            context.normalized_masks.add(filter_id)
            validated.append(proposal)
        except (ToolError, OAuth2RedirectError, OAuth2Error):
            raise
        except SupersetSecurityException:
            context.proposal_errors[filter_id] = "permission_denied"
        except _DiscoveryUnavailableError as ex:
            context.proposal_errors[filter_id] = (
                ex.reason
                if ex.reason
                in (
                    "query_budget",
                    "scheduling_budget",
                    "state_invalid",
                    "state_missing",
                    "invalid_scalar",
                    "query_failed",
                    "query_not_executed",
                    "parent_unresolved",
                )
                else "proposal_invalid"
            )
        except Exception:  # pylint: disable=broad-except
            logger.exception("Native filter proposal query failed")
            context.proposal_errors[filter_id] = (
                "query_failed"
                if context.query_count > before_queries
                else "query_not_executed"
            )
    return validated


@contextmanager
def _isolated_form_data() -> Iterator[None]:
    """Keep per-dropdown Jinja form data from reaching later queries."""
    had_form_data = "form_data" in g
    previous = g.get("form_data")
    try:
        yield
    finally:
        if had_form_data:
            g.form_data = previous
        else:
            g.pop("form_data", None)


def discover_filter_values(
    dashboard: Dashboard,
    request: GetDashboardInfoRequest,
    *,
    snapshot_state: dict[str, Any] | None = None,
    state_error: Literal["state_missing", "state_invalid"] | None = None,
    started_at: float | None = None,
    discovery_context: _Discovery | None = None,
) -> tuple[list[NativeFilterValueSummary], FilterValueDiscovery]:
    """Discover dropdown options under native authorization and effective parents.

    The caller must authorize the dashboard and verify snapshot ownership first.
    Choices describe selection controls, never analytical chart membership.
    """
    context = discovery_context or validate_discovery_configuration(
        dashboard, request, started_at=started_at
    )
    configs = context.configs
    configured = list(configs.values())
    requests = _requests(configured, request)
    summaries = {
        s.id: NativeFilterValueSummary.model_validate(s.model_dump())
        for s in _extract_native_filters(
            dashboard.json_metadata,
            include_data_model_metadata=user_can_view_data_model_metadata(),
        )
    }
    offset = (
        request.filter_values_offset if request.filter_value_requests is None else None
    )
    next_offset = (
        offset + _PAGE_SIZE
        if offset is not None and offset + _PAGE_SIZE < len(configured)
        else None
    )
    discovery = FilterValueDiscovery(
        total_filter_count=len(configured), offset=offset, next_offset=next_offset
    )
    with _isolated_form_data():
        try:
            context.masks = (
                _hydrate_masks(context, snapshot_state) if state_error is None else {}
            )
        except _DiscoveryUnavailableError as ex:
            state_error = cast(Literal["state_missing", "state_invalid"], ex.reason)
            context.masks = {}
        if state_error is None:
            discovery.validated_proposed_filter_values = _validate_proposals(
                context, request.proposed_filter_values or []
            )
        selected: list[NativeFilterValueSummary] = []
        for item in requests:
            summary = summaries[item.filter_id]
            before_queries = context.query_count
            try:
                if state_error:
                    raise _DiscoveryUnavailableError(state_error)
                values, truncated, reason = _run(context, configs[item.filter_id], item)
                summary.available_values = _result(
                    item, values=values, truncated=truncated, reason=reason
                )
            except (ToolError, OAuth2RedirectError, OAuth2Error):
                raise
            except SupersetSecurityException:
                summary.available_values = _result(item, reason="permission_denied")
            except _DiscoveryUnavailableError as ex:
                summary.available_values = _result(item, reason=ex.reason)
            except Exception:  # pylint: disable=broad-except
                logger.exception("Native filter choice query failed")
                summary.available_values = _result(
                    item,
                    reason="query_failed"
                    if context.query_count > before_queries
                    else "query_not_executed",
                )
            selected.append(summary)
    discovery.query_count = context.query_count
    return selected, discovery
