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
MCP tool: apply_dashboard_filters

Applies native filter VALUES to a dashboard for the calling user by
storing a ``dataMask`` in a dashboard permalink. The dashboard's saved
native filter configuration is untouched, so nothing another viewer sees
changes -- which is what separates this tool from manage_native_filters,
which DEFINES the filters and writes to the shared dashboard.
"""

import logging
from collections.abc import Sequence
from typing import Any

from fastmcp import Context
from flask import current_app
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.constants import NO_TIME_RANGE
from superset.extensions import event_logger
from superset.mcp_service.dashboard.permalink import (
    build_dashboard_permalink_url,
    create_dashboard_permalink,
    get_dashboard_permalink_data_mask,
)
from superset.mcp_service.dashboard.schemas import (
    AppliedFilterSummary,
    ApplyDashboardFiltersRequest,
    ApplyDashboardFiltersResponse,
    ApplyFilterValueSpec,
)
from superset.mcp_service.dashboard.tool.manage_native_filters import (
    _FilterValidationError as _FilterApplyError,
    _select_data_mask,
    current_native_filter_config,
)
from superset.utils.number_format import format_smart_number

logger = logging.getLogger(__name__)

# Filter types this tool knows how to apply a value to. Kept in step with the
# types manage_native_filters can create.
SUPPORTED_FILTER_TYPES: frozenset[str] = frozenset(
    {"filter_select", "filter_time", "filter_range", "filter_timegrain"}
)

# Mirrors the frontend's SingleValueType enum
# (superset-frontend/src/filters/components/Range/SingleValueType.ts),
# which a filter_range filter's controlValues.enableSingleValue may hold to
# restrict the slider to one side of the range.
_SINGLE_VALUE_MINIMUM = 0
_SINGLE_VALUE_EXACT = 1
_SINGLE_VALUE_MAXIMUM = 2


def _publish_filters_applied(dashboard_id: int, permalink_key: str) -> bool:
    """Best-effort principal nudge; filter state stays in the authorized permalink."""
    from superset.coordination.base import CoordinationService
    from superset.realtime.publish import publish_realtime
    from superset.websocket.channel import get_realtime_principal
    from superset.websocket.permissions import can_access_realtime_notifications

    try:
        if not current_app.config.get("WEBSOCKET_ENABLE"):
            return False
        if not CoordinationService.is_backend_defined():
            return False
        # Same gate the websocket channel cookie is minted behind: without it the
        # caller has no authorized socket to receive the nudge.
        if not can_access_realtime_notifications():
            return False
        principal = get_realtime_principal()
        if principal is None:
            return False
        return publish_realtime(
            topic="dashboard.filters_applied",
            scope="principal",
            payload={"dashboard_id": dashboard_id, "permalink_key": permalink_key},
            routes=[principal["channel"]],
        )
    except Exception:  # noqa: BLE001 pylint: disable=broad-except
        logger.warning(
            "Failed to publish filters applied for dashboard %s", dashboard_id
        )
        return False


def _describe_filters(configs: list[dict[str, Any]]) -> str:
    """Render the dashboard's filters as a name/ID list for error messages."""
    configs = [conf for conf in configs if conf.get("type") != "DIVIDER"]
    if not configs:
        return "This dashboard has no native filters."
    described = ", ".join(
        f"{conf.get('name') or '(unnamed)'} (id={conf.get('id')}, "
        f"type={conf.get('filterType')})"
        for conf in configs
    )
    return f"Filters on this dashboard: {described}."


def _resolve_filter(reference: str, configs: list[dict[str, Any]]) -> dict[str, Any]:
    """Resolve a filter name or ID to its configuration.

    An exact ID match wins over a name match, so a filter whose display name
    happens to equal another filter's ID cannot shadow that filter.
    """
    for conf in configs:
        if conf.get("id") == reference:
            return conf

    wanted = reference.strip().casefold()
    matches = [
        conf
        for conf in configs
        if isinstance(conf.get("name"), str)
        and conf["name"].strip().casefold() == wanted
    ]
    if len(matches) == 1:
        return matches[0]
    if matches:
        raise _FilterApplyError(
            f"'{reference}' matches more than one filter on this dashboard "
            f"({', '.join(str(conf.get('id')) for conf in matches)}). "
            "Pass the filter ID instead of the name."
        )
    raise _FilterApplyError(
        f"No filter named '{reference}' was found on this dashboard. "
        f"{_describe_filters(configs)}"
    )


def _filter_target_column(conf: dict[str, Any]) -> str:
    """Return the first target's column name, or raise when there is none."""
    targets = [target for target in (conf.get("targets") or []) if target]
    column = (targets[0].get("column") or {}).get("name") if targets else None
    if not column:
        raise _FilterApplyError(
            f"Filter '{conf.get('name') or conf.get('id')}' has no target "
            "column, so a value cannot be applied to it."
        )
    return column


def _time_data_mask(conf: dict[str, Any], time_range: str) -> dict[str, Any]:
    """Build the data mask a filter_time filter produces for ``time_range``."""
    is_set = bool(time_range) and time_range != NO_TIME_RANGE
    if not is_set and (conf.get("controlValues") or {}).get("enableEmptyFilter"):
        raise _FilterApplyError(
            f"Filter '{conf.get('name') or conf.get('id')}' requires a time "
            "range and cannot be cleared."
        )
    return {
        "extraFormData": {"time_range": time_range} if is_set else {},
        "filterState": {"value": time_range if is_set else None},
    }


def _format_range_bound(value: int | float) -> str:
    """Format a range bound, preserving finite values that overflow rounding."""
    try:
        return format_smart_number(value)
    except OverflowError:
        return repr(value)


def _validate_single_value_mode(
    conf: dict[str, Any], lower: int | float | None, upper: int | float | None
) -> None:
    """Reject non-null bounds that don't match a configured single-value mode."""
    single_value_type = (conf.get("controlValues") or {}).get("enableSingleValue")
    if single_value_type == _SINGLE_VALUE_MINIMUM and upper is not None:
        raise _FilterApplyError(
            f"Filter '{conf.get('name') or conf.get('id')}' is configured "
            "for a single lower-bound value; provide 'range: [value, "
            "null]', not an upper bound."
        )
    if single_value_type == _SINGLE_VALUE_MAXIMUM and lower is not None:
        raise _FilterApplyError(
            f"Filter '{conf.get('name') or conf.get('id')}' is configured "
            "for a single upper-bound value; provide 'range: [null, "
            "value]', not a lower bound."
        )
    if single_value_type == _SINGLE_VALUE_EXACT and lower != upper:
        raise _FilterApplyError(
            f"Filter '{conf.get('name') or conf.get('id')}' is configured "
            "for a single exact value; provide 'range: [value, value]' "
            "with matching bounds."
        )


def _range_data_mask(
    conf: dict[str, Any], bounds: list[int | float | None]
) -> dict[str, Any]:
    """Build the data mask a filter_range filter produces for ``bounds``.

    Mirrors the frontend's ``getRangeExtraFormData``: distinct non-null
    bounds become a pair of ``>=``/``<=`` predicates, equal non-null bounds
    collapse to a single ``==`` predicate, and two null bounds produce no
    predicate at all (the "required filter, nothing chosen" state when the
    filter is marked ``enableEmptyFilter``, raised rather than guessed).
    """
    column = _filter_target_column(conf)

    lower, upper = bounds
    if lower is None and upper is None:
        if (conf.get("controlValues") or {}).get("enableEmptyFilter"):
            raise _FilterApplyError(
                f"Filter '{conf.get('name') or conf.get('id')}' requires a "
                "value and cannot be cleared."
            )
        return {
            "extraFormData": {},
            "filterState": {"value": [None, None], "label": ""},
        }

    _validate_single_value_mode(conf, lower, upper)

    filters: list[dict[str, Any]] = []
    if lower == upper:
        filters.append({"col": column, "op": "==", "val": upper})
    else:
        if lower is not None:
            filters.append({"col": column, "op": ">=", "val": lower})
        if upper is not None:
            filters.append({"col": column, "op": "<=", "val": upper})

    if lower == upper:
        assert upper is not None
        label = f"x = {_format_range_bound(upper)}"
    elif lower is not None and upper is not None:
        label = f"{_format_range_bound(lower)} ≤ x ≤ {_format_range_bound(upper)}"
    elif lower is not None:
        label = f"x ≥ {_format_range_bound(lower)}"
    else:
        assert upper is not None
        label = f"x ≤ {_format_range_bound(upper)}"
    return {
        "extraFormData": {"filters": filters},
        "filterState": {"value": [lower, upper], "label": label},
    }


def _timegrain_data_mask(
    conf: dict[str, Any], time_grain: Sequence[str]
) -> dict[str, Any]:
    """Build the data mask a filter_timegrain filter produces for ``time_grain``."""
    is_set = bool(time_grain)
    allowed_grains = conf.get("time_grains")
    if is_set and allowed_grains and time_grain[0] not in allowed_grains:
        raise _FilterApplyError(
            f"Time grain '{time_grain[0]}' is not allowed for filter "
            f"'{conf.get('name') or conf.get('id')}'. "
            f"Available time grains: {', '.join(allowed_grains)}."
        )
    filter_state: dict[str, Any] = {"value": list(time_grain) if is_set else None}
    if is_set:
        from superset.daos.dataset import DatasetDAO

        targets = [target for target in (conf.get("targets") or []) if target]
        dataset_id = targets[0].get("datasetId") if targets else None
        dataset = DatasetDAO.find_by_id(dataset_id) if dataset_id is not None else None
        if dataset is None:
            raise _FilterApplyError(
                f"Cannot resolve target dataset (ID {dataset_id}) for filter "
                f"'{conf.get('name') or conf.get('id')}'; "
                "supported time grains cannot be determined."
            )
        # Reuse the datasource options exposed to Explore and native filters.
        # Checked even when an allowlist is set: the two can drift apart (the
        # dataset is repointed at another database, or the dashboard is
        # imported), and the frontend plugin intersects both sets rather
        # than trusting the allowlist alone.
        available_grains = [
            duration for duration, _ in dataset.time_grain_sqla if duration is not None
        ]
        if time_grain[0] not in available_grains:
            raise _FilterApplyError(
                f"Time grain '{time_grain[0]}' is not supported by dataset "
                f"{dataset_id} for filter '{conf.get('name') or conf.get('id')}'. "
                f"Available time grains: {', '.join(available_grains) or '(none)'}."
            )
        for grain in dataset.get_time_grains():
            if grain["duration"] == time_grain[0]:
                filter_state["label"] = grain["name"]
                break
    if not is_set and (conf.get("controlValues") or {}).get("enableEmptyFilter"):
        raise _FilterApplyError(
            f"Filter '{conf.get('name') or conf.get('id')}' requires a time "
            "grain and cannot be cleared."
        )
    return {
        "extraFormData": {"time_grain_sqla": time_grain[0]} if is_set else {},
        "filterState": filter_state,
    }


def _apply_one(
    spec: ApplyFilterValueSpec, configs: list[dict[str, Any]]
) -> tuple[str, dict[str, Any], AppliedFilterSummary]:
    """Resolve one spec into a ``(filter_id, data_mask, summary)`` triple."""
    conf = _resolve_filter(spec.filter_name_or_id, configs)
    filter_id = conf.get("id")
    if not filter_id:
        raise _FilterApplyError(
            f"Filter '{spec.filter_name_or_id}' has no ID in the dashboard's "
            "configuration and cannot be targeted."
        )
    filter_type = "divider" if conf.get("type") == "DIVIDER" else conf.get("filterType")
    if filter_type not in SUPPORTED_FILTER_TYPES:
        raise _FilterApplyError(
            f"Filter '{spec.filter_name_or_id}' has type '{filter_type}', "
            f"which this tool cannot apply values to. Supported types: "
            f"{', '.join(sorted(SUPPORTED_FILTER_TYPES))}."
        )

    if filter_type == "filter_select":
        if spec.values is None:
            raise _FilterApplyError(
                f"Filter '{spec.filter_name_or_id}' is a filter_select "
                "filter; provide 'values', not 'time_range'."
            )
        data_mask = _select_data_mask(conf, spec.values)
        summary = AppliedFilterSummary(
            id=filter_id,
            name=conf.get("name"),
            filter_type=filter_type,
            values=list(spec.values),
        )
    elif filter_type == "filter_time":
        if spec.time_range is None:
            raise _FilterApplyError(
                f"Filter '{spec.filter_name_or_id}' is a filter_time filter; "
                "provide 'time_range', not 'values'."
            )
        data_mask = _time_data_mask(conf, spec.time_range)
        summary = AppliedFilterSummary(
            id=filter_id,
            name=conf.get("name"),
            filter_type=filter_type,
            time_range=spec.time_range,
        )
    elif filter_type == "filter_range":
        if spec.range is None:
            raise _FilterApplyError(
                f"Filter '{spec.filter_name_or_id}' is a filter_range "
                "filter; provide 'range', not 'values'."
            )
        data_mask = _range_data_mask(conf, spec.range)
        summary = AppliedFilterSummary(
            id=filter_id,
            name=conf.get("name"),
            filter_type=filter_type,
            range=list(spec.range),
        )
    else:
        # Every other member of SUPPORTED_FILTER_TYPES needs its own branch.
        assert filter_type == "filter_timegrain", filter_type
        if spec.time_grain is None:
            raise _FilterApplyError(
                f"Filter '{spec.filter_name_or_id}' is a filter_timegrain "
                "filter; provide 'time_grain', not 'values'."
            )
        data_mask = _timegrain_data_mask(conf, spec.time_grain)
        summary = AppliedFilterSummary(
            id=filter_id,
            name=conf.get("name"),
            filter_type=filter_type,
            time_grain=list(spec.time_grain),
        )

    # ``id`` and ``ownState`` complete the shape the dashboard's data mask
    # reducer seeds each filter with, so the stored entry is indistinguishable
    # from one the UI produced.
    data_mask["id"] = filter_id
    data_mask["ownState"] = {}
    return filter_id, data_mask, summary


def _build_data_mask(
    request: ApplyDashboardFiltersRequest, configs: list[dict[str, Any]]
) -> tuple[dict[str, Any], list[AppliedFilterSummary]]:
    """Translate the requested values into a dashboard ``dataMask``."""
    data_mask: dict[str, Any] = {}
    summaries: list[AppliedFilterSummary] = []
    for spec in request.filters:
        filter_id, entry, summary = _apply_one(spec, configs)
        if filter_id in data_mask:
            raise _FilterApplyError(
                f"Filter '{summary.name or filter_id}' was given a value more "
                "than once. Provide at most one value per filter."
            )
        data_mask[filter_id] = entry
        summaries.append(summary)
    return data_mask, summaries


@tool(
    tags=["core"],
    class_permission_name="Dashboard",
    # Applying values writes only the caller's own permalink state, so this
    # needs read access to the dashboard, not the write access the "mutate"
    # tag would imply.
    method_permission_name="read",
    annotations=ToolAnnotations(
        title="Apply dashboard filters",
        readOnlyHint=False,
        destructiveHint=False,
        # Repeat calls create no new dashboard state -- the underlying
        # permalink command is deterministic and returns the existing key --
        # but the repo declares every non-read-only tool non-idempotent.
        idempotentHint=False,
        openWorldHint=False,
    ),
)
async def apply_dashboard_filters(
    request: ApplyDashboardFiltersRequest, ctx: Context
) -> ApplyDashboardFiltersResponse:
    """
    Apply values to a dashboard's existing native filters for this user.

    Use this to answer "show me the dashboard filtered to X". It returns a
    shareable ``/dashboard/p/<key>/`` permalink that opens the dashboard
    with the requested values already applied. The dashboard's saved
    configuration is NOT modified and no other viewer is affected -- to
    add, change, or remove the filters themselves, use
    manage_native_filters instead.

    Target each filter by its display name (matched case-insensitively) or
    its filter ID; call get_dashboard_info first to see which filters a
    dashboard has. Only exact-match select filters without inverse selection
    are supported. Supply ``values`` for a filter_select filter (an empty
    list clears it, and a single-select filter accepts at most one value),
    ``time_range`` for a filter_time filter, ``range`` as a ``[lower, upper]``
    pair for a filter_range filter (either bound may be null, and
    ``[null, null]`` clears it), and ``time_grain`` as a list of at most one
    value for a filter_timegrain filter (an empty list clears it). Filters
    left out of the request keep the dashboard's default value unless
    base_permalink_key is supplied. For follow-up turns (e.g. "also filter
    to 2024"), pass the previous response's permalink_key as
    base_permalink_key to preserve prior selections. New values replace
    the entire entry for that filter; unmentioned filters persist, except
    for filters the dashboard no longer defines, which are dropped. Omit the
    base key to start over. An unresolved base key fails without creating a link.

    Example usage:
    ```json
    {
        "dashboard_id": 123,
        "filters": [
            {"filter_name_or_id": "Region", "values": ["EMEA", "APAC"]},
            {"filter_name_or_id": "Time Range", "time_range": "Last month"},
            {"filter_name_or_id": "Cost", "range": [10, 100]},
            {"filter_name_or_id": "Granularity", "time_grain": ["P1D"]}
        ]
    }
    ```
    """
    from superset.commands.dashboard.exceptions import (
        DashboardAccessDeniedError,
        DashboardNotFoundError,
    )
    from superset.daos.dashboard import DashboardDAO
    from superset.dashboards.permalink.exceptions import (
        DashboardPermalinkCreateFailedError,
        DashboardPermalinkGetFailedError,
    )

    await ctx.info(
        "Applying dashboard filters: dashboard_id=%s, filter_count=%s"
        % (request.dashboard_id, len(request.filters))
    )

    try:
        with event_logger.log_context(action="mcp.apply_dashboard_filters.lookup"):
            # get_by_id_or_slug applies the dashboard base filters and the
            # per-object access check, so an unreadable dashboard fails here
            # rather than after its filter names have been read.
            dashboard = DashboardDAO.get_by_id_or_slug(request.dashboard_id)
            configs = current_native_filter_config(dashboard)

        try:
            data_mask, summaries = _build_data_mask(request, configs)
        except _FilterApplyError as exc:
            await ctx.warning("Filter values could not be applied: %s" % (exc,))
            return ApplyDashboardFiltersResponse(
                dashboard_id=request.dashboard_id,
                error=str(exc),
            )

        if request.base_permalink_key is not None:
            try:
                base_mask = get_dashboard_permalink_data_mask(
                    request.base_permalink_key,
                    dashboard.id,
                    str(dashboard.uuid) if dashboard.uuid else None,
                    dashboard.slug,
                )
            except DashboardAccessDeniedError:
                return ApplyDashboardFiltersResponse(
                    dashboard_id=request.dashboard_id,
                    permission_denied=True,
                    error=(
                        "You don't have permission to access the base "
                        "permalink's dashboard."
                    ),
                )
            except DashboardPermalinkGetFailedError:
                return ApplyDashboardFiltersResponse(
                    dashboard_id=request.dashboard_id,
                    error=(
                        "Failed to resolve the base permalink: the key is "
                        "invalid or its stored state could not be read."
                    ),
                )
            except ValueError as exc:
                return ApplyDashboardFiltersResponse(
                    dashboard_id=request.dashboard_id, error=str(exc)
                )
            # An entry for a filter the dashboard no longer defines is stale:
            # opening the permalink drops it during hydration, but a live
            # receiver would dispatch it and fall back to every chart. Keep
            # only entries the current configuration still knows about so both
            # paths show the same state.
            known_ids = {conf.get("id") for conf in configs if conf.get("id")}
            inherited = {
                filter_id: entry
                for filter_id, entry in base_mask.items()
                if filter_id in known_ids
            }
            data_mask = {**inherited, **data_mask}

        with event_logger.log_context(action="mcp.apply_dashboard_filters.permalink"):
            key = create_dashboard_permalink(
                request.dashboard_id, {"dataMask": data_mask}
            )

        await ctx.info(
            "Dashboard filters applied: dashboard_id=%s, applied=%s, "
            "permalink_key=%s" % (request.dashboard_id, len(summaries), key)
        )
        logger.info(
            "Applied %d filter value(s) to dashboard %s via permalink",
            len(summaries),
            request.dashboard_id,
        )
        return ApplyDashboardFiltersResponse(
            dashboard_id=request.dashboard_id,
            dashboard_url=build_dashboard_permalink_url(key),
            permalink_key=key,
            applied_filters=summaries,
            live_update_pushed=_publish_filters_applied(request.dashboard_id, key),
        )

    except DashboardNotFoundError:
        return ApplyDashboardFiltersResponse(
            error=(
                f"Dashboard with ID {request.dashboard_id} not found."
                " Use list_dashboards to get valid dashboard IDs."
            ),
        )
    except DashboardAccessDeniedError:
        await ctx.warning(
            "Dashboard access denied: dashboard_id=%s" % (request.dashboard_id,)
        )
        return ApplyDashboardFiltersResponse(
            dashboard_id=request.dashboard_id,
            permission_denied=True,
            error=(
                f"You don't have permission to view dashboard {request.dashboard_id}."
            ),
        )
    except DashboardPermalinkCreateFailedError as exc:
        await ctx.error("Failed to create dashboard permalink: %s" % (exc,))
        return ApplyDashboardFiltersResponse(
            dashboard_id=request.dashboard_id,
            error=f"Failed to store the filtered dashboard state: {exc}",
        )
    except Exception as exc:
        await ctx.error(
            "Unexpected error applying dashboard filters: %s: %s"
            % (type(exc).__name__, exc)
        )
        logger.exception(
            "Unexpected error applying filters to dashboard %s: %s",
            request.dashboard_id,
            exc,
        )
        raise
