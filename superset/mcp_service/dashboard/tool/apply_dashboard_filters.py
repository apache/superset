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
from typing import Any

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.constants import NO_TIME_RANGE
from superset.extensions import event_logger
from superset.mcp_service.dashboard.permalink import (
    build_dashboard_permalink_url,
    create_dashboard_permalink,
)
from superset.mcp_service.dashboard.schemas import (
    AppliedFilterSummary,
    ApplyDashboardFiltersRequest,
    ApplyDashboardFiltersResponse,
    ApplyFilterValueSpec,
    FilterSelectValue,
)
from superset.mcp_service.dashboard.tool.manage_native_filters import (
    current_native_filter_config,
)

logger = logging.getLogger(__name__)

# Filter types this tool knows how to apply a value to. Kept in step with the
# types manage_native_filters can create.
SUPPORTED_FILTER_TYPES: frozenset[str] = frozenset({"filter_select", "filter_time"})

# Display strings the frontend uses when labelling a selected value; mirrored
# here so a permalink's label reads the same as a UI-applied one.
_NULL_LABEL = "<NULL>"
_TRUE_LABEL = "TRUE"
_FALSE_LABEL = "FALSE"


class _FilterApplyError(Exception):
    """Raised internally when a requested filter value cannot be applied."""


def _describe_filters(configs: list[dict[str, Any]]) -> str:
    """Render the dashboard's filters as a name/ID list for error messages."""
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


def _value_label(value: FilterSelectValue) -> str:
    """Format one selected value the way the dashboard UI labels it."""
    if value is None:
        return _NULL_LABEL
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
    filtering at all.
    """
    targets = [target for target in (conf.get("targets") or []) if target]
    column = (targets[0].get("column") or {}).get("name") if targets else None
    if not column:
        raise _FilterApplyError(
            f"Filter '{conf.get('name') or conf.get('id')}' has no target "
            "column, so a value cannot be applied to it."
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
        control_values = conf.get("controlValues") or {}
        extra_form_data = (
            {
                "adhoc_filters": [
                    {
                        "expressionType": "SQL",
                        "clause": "WHERE",
                        "sqlExpression": "1 = 0",
                    }
                ]
            }
            if control_values.get("enableEmptyFilter")
            else {}
        )
        filter_state = {"value": None}

    return {"extraFormData": extra_form_data, "filterState": filter_state}


def _time_data_mask(time_range: str) -> dict[str, Any]:
    """Build the data mask a filter_time filter produces for ``time_range``."""
    is_set = bool(time_range) and time_range != NO_TIME_RANGE
    return {
        "extraFormData": {"time_range": time_range} if is_set else {},
        "filterState": {"value": time_range if is_set else None},
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
    filter_type = conf.get("filterType")
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
    else:
        if spec.time_range is None:
            raise _FilterApplyError(
                f"Filter '{spec.filter_name_or_id}' is a filter_time filter; "
                "provide 'time_range', not 'values'."
            )
        data_mask = _time_data_mask(spec.time_range)
        summary = AppliedFilterSummary(
            id=filter_id,
            name=conf.get("name"),
            filter_type=filter_type,
            time_range=spec.time_range,
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
    dashboard has. Supply ``values`` for a filter_select filter (an empty
    list clears it) and ``time_range`` for a filter_time filter. Filters
    left out of the request keep the dashboard's default value.

    Example usage:
    ```json
    {
        "dashboard_id": 123,
        "filters": [
            {"filter_name_or_id": "Region", "values": ["EMEA", "APAC"]},
            {"filter_name_or_id": "Time Range", "time_range": "Last month"}
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
