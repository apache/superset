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
Get dashboard info FastMCP tool

This module contains the FastMCP tool for getting detailed information
about a specific dashboard.
"""

import logging
from time import monotonic
from typing import Annotated, Any, cast, Literal

from fastmcp import Context
from fastmcp.exceptions import ToolError
from flask import current_app
from pydantic import Field
from sqlalchemy.orm import subqueryload
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.exceptions import OAuth2Error, OAuth2RedirectError
from superset.extensions import event_logger
from superset.mcp_service.chart.response_preflight import bounded_exception_message
from superset.mcp_service.constants import DEFAULT_MAX_LIST_ITEMS
from superset.mcp_service.dashboard.permalink import (
    dashboard_permalink_matches,
    DashboardLookupResult,
    get_matching_dashboard_permalink_state,
    lookup_dashboard_reference,
)
from superset.mcp_service.dashboard.schemas import (
    dashboard_serializer,
    DashboardError,
    DashboardInfo,
    DashboardInfoWithFilterValues,
    GetDashboardInfoRequest,
    redact_filter_state_data_model_metadata,
)
from superset.mcp_service.dashboard_scope import get_request_dashboard_scope
from superset.mcp_service.mcp_core import ModelGetInfoCore
from superset.mcp_service.privacy import user_can_view_data_model_metadata
from superset.mcp_service.utils.oauth2_utils import build_oauth2_redirect_message
from superset.mcp_service.utils.response_size_utils import (
    finalize_dashboard_filter_values_response,
)

logger = logging.getLogger(__name__)


def _apply_permalink_state(
    result: DashboardInfo,
    permalink_key: str | None,
    permalink_state: dict[str, object],
    is_permalink: bool = True,
) -> DashboardInfo:
    """Attach the filter state without changing its stored values.
    is_permalink is False when the state was supplied directly, not resolved
    from a permalink."""
    return result.model_copy(
        update={
            "permalink_key": permalink_key,
            "filter_state": permalink_state,
            "is_permalink_state": is_permalink,
        }
    )


def _lookup_dashboard(
    tool: ModelGetInfoCore,
    request: GetDashboardInfoRequest,
) -> tuple[
    DashboardInfo | DashboardError,
    DashboardLookupResult[DashboardInfo | DashboardError],
]:
    """Resolve an ordinary identifier or dashboard permalink, then run lookup."""
    lookup_result = lookup_dashboard_reference(
        identifier=request.identifier,
        permalink_key=request.permalink_key,
        lookup=tool.run_tool,
        is_found=lambda result: isinstance(result, DashboardInfo),
    )
    result = lookup_result.result
    if result is None:
        # Only reachable when the dashboard had to come from a permalink, so the
        # identifier's own "not found" error (when there is one) is preserved.
        result = DashboardError.create(
            "Dashboard permalink could not be resolved. It may be invalid or "
            "expired; ask for a fresh shared dashboard link.",
            "permalink_not_found",
        )
    return result, lookup_result


def _discovery_snapshot(
    request: GetDashboardInfoRequest,
    result: DashboardInfo,
    lookup_result: DashboardLookupResult[DashboardInfo | DashboardError],
) -> tuple[dict[str, Any] | None, Literal["state_missing", "state_invalid"] | None]:
    """Read internal state only after matching it to the authorized dashboard."""
    value = lookup_result.permalink_value
    snapshot: dict[str, Any] | None = None
    if lookup_result.permalink_key or "permalink_key" in request.model_fields_set:
        if (
            value is not None
            and dashboard_permalink_matches(value, result.id, result.uuid, result.slug)
            and isinstance(value.get("state"), dict)
        ):
            snapshot = cast(dict[str, Any], value["state"])
        else:
            return None, "state_invalid"
    elif request.filter_state is not None:
        snapshot = request.filter_state
    elif "filter_state" in request.model_fields_set:
        return None, "state_invalid"
    if get_request_dashboard_scope() is not None:
        mask = snapshot.get("dataMask") if snapshot is not None else None
        if mask is None:
            return None, "state_missing"
        if not isinstance(mask, dict):
            return None, "state_invalid"
    return snapshot, None


def _enrich_filter_values(
    result: DashboardInfo,
    lookup_result: DashboardLookupResult[DashboardInfo | DashboardError],
    request: GetDashboardInfoRequest,
    select_columns: list[str],
    started_at: float,
) -> DashboardInfo | DashboardError:
    """Validate discovery inputs and query only projected dropdown summaries."""
    if not request.include_filter_values:
        return result
    from superset.daos.dashboard import DashboardDAO
    from superset.mcp_service.dashboard.filter_values import (
        discover_filter_values,
        validate_discovery_configuration,
    )

    # The dashboard gate preserves access for viewers without dataset grants.
    dashboard = DashboardDAO.get_by_id_or_slug(str(result.id))
    try:
        discovery_context = validate_discovery_configuration(
            dashboard, request, started_at=started_at
        )
    except ValueError:
        return DashboardError.create(
            "Invalid native filter discovery request. Check configured filter IDs, "
            "request modes, scalar types, and proposed parent selections.",
            "invalid_request",
        )
    if "native_filters" not in select_columns:
        return result
    snapshot_state, state_error = _discovery_snapshot(request, result, lookup_result)
    native_filters, discovery = discover_filter_values(
        dashboard,
        request,
        snapshot_state=snapshot_state,
        state_error=state_error,
        started_at=started_at,
        discovery_context=discovery_context,
    )
    select_columns.append("filter_value_discovery")
    return DashboardInfoWithFilterValues.model_validate(
        {
            **result.model_dump(),
            "native_filters": native_filters,
            "filter_value_discovery": discovery,
        }
    )


def _serialize_info(
    result: DashboardInfo | DashboardError, select_columns: list[str]
) -> dict[str, Any]:
    """Protect exact choices even when the general response guard is disabled."""
    payload = result.model_dump(mode="json", context={"select_columns": select_columns})
    if "filter_value_discovery" in payload:
        config = current_app.config.get("MCP_RESPONSE_SIZE_CONFIG", {})
        try:
            max_list_items = int(config.get("max_list_items", DEFAULT_MAX_LIST_ITEMS))
        except (ValueError, TypeError):
            max_list_items = DEFAULT_MAX_LIST_ITEMS
        return finalize_dashboard_filter_values_response(
            payload, max_list_items=max_list_items
        )
    return payload


def _dashboard_retrieval_error(error: Exception) -> DashboardError:
    """Preserve database authentication guidance before generic failure handling."""
    if isinstance(error, OAuth2RedirectError):
        return DashboardError.create(
            build_oauth2_redirect_message(error), "OAuth2Redirect"
        )
    if isinstance(error, OAuth2Error):
        return DashboardError.create(
            f"OAuth2 authentication error: {bounded_exception_message(error)}",
            "OAuth2Error",
        )
    return DashboardError.create(
        f"Failed to get dashboard info: {str(error)}", "InternalError"
    )


@tool(
    tags=["discovery"],
    class_permission_name="Dashboard",
    annotations=ToolAnnotations(
        title="Get dashboard info",
        readOnlyHint=True,
        destructiveHint=False,
        openWorldHint=False,
    ),
)
async def get_dashboard_info(
    request: Annotated[
        GetDashboardInfoRequest,
        Field(
            description=(
                'Wrap {"request": {...}}. Filtered? Use permalink_key/filter_state: '
                "snapshots, not query predicates; "
                "heed scope/native_filter_values_incomplete. "
                "Missing state != no filters. "
                "Don't guess columns/query workspace-wide; clarify. "
                "Charts: list_charts."
            )
        ),
    ],
    ctx: Context,
) -> DashboardInfoWithFilterValues | DashboardError:
    """Get dashboard info by ID, UUID, slug, or permalink.

    Returns title, charts, and layout details.

    Opt in with include_filter_values=true for authorized dropdown options,
    scoped to filter_selection, not filtered analytical results. Page definitions
    with filter_values_offset or request up to 20 IDs with filter_value_requests.
    Use literal search or exact_value for choices outside a truncated sample;
    preserve returned scalar types and punctuation. proposed_filter_values previews
    select ancestors without applying them. Incomplete choices never prove absence.

    Before answering about a filtered dashboard, supply its permalink_key or
    filter_state to this tool and use the returned filter_state as context.
    Restricted users receive native_filter_values (names, types, selected values,
    labels and exclusion flags), not raw dataMask or column targets. Check
    native_filter_values_incomplete: unsupported filters and chart state cannot
    be summarized safely. Missing state is not evidence of no filters.
    These are snapshot values, not automatically enforced query predicates.
    Respect filter scope; do not guess columns or query workspace-wide data when
    the available context is insufficient. Ask for clarification instead.

    For dashboards with many charts or native filters, the ``charts`` and
    ``native_filters`` lists may be capped below their true size (see
    ``chart_count`` for the real total, and ``_truncation_notes`` in the
    response when truncation occurred). To retrieve the complete list of
    charts on a large dashboard regardless of size, call ``list_charts``
    with ``filters=[{"col": "dashboards", "opr": "eq", "value": <dashboard
    id>}]`` and page through the results using ``page``/``page_size``.

    If the user gives you a shared URL containing ``/dashboard/p/<key>/``, pass
    the URL or bare key as ``identifier`` (or use ``permalink_key`` alone). The
    response includes the dashboard ID plus active tab and filter state.

    Example usage:
    ```json
    {
        "identifier": 123
    }
    ```

    With permalink (filter state from URL):
    ```json
    {
        "permalink_key": "abc123def456"
    }
    ```
    """
    started_at = monotonic()
    await ctx.info(
        "Retrieving dashboard information: identifier=%s, permalink_key=%s"
        % (request.identifier, request.permalink_key)
    )
    await ctx.debug(
        "Metadata cache settings: use_cache=%s, refresh_metadata=%s, force_refresh=%s"
        % (request.use_cache, request.refresh_metadata, request.force_refresh)
    )

    try:
        from superset.daos.dashboard import DashboardDAO
        from superset.models.dashboard import Dashboard
        from superset.models.slice import Slice

        # Eager load slices (charts), editors, tags, and embedded rows to avoid
        # N+1 queries. Also eager load editors/tags on each slice since the
        # dashboard serializer calls serialize_chart_object for every chart.
        eager_options = [
            subqueryload(Dashboard.slices).subqueryload(Slice.editors),
            subqueryload(Dashboard.slices).subqueryload(Slice.tags),
            subqueryload(Dashboard.editors),
            subqueryload(Dashboard.tags),
            subqueryload(Dashboard.embedded),
        ]

        with event_logger.log_context(action="mcp.get_dashboard_info.lookup"):
            tool = ModelGetInfoCore(
                dao_class=DashboardDAO,
                output_schema=DashboardInfo,
                error_schema=DashboardError,
                serializer=dashboard_serializer,
                supports_slug=True,  # Dashboards support slugs
                logger=logger,
                query_options=eager_options,
            )

            result, lookup_result = _lookup_dashboard(tool, request)
            permalink_key = lookup_result.permalink_key
            permalink_value = lookup_result.permalink_value

        if isinstance(result, DashboardInfo):
            # If permalink_key is provided, retrieve filter state
            if permalink_key:
                await ctx.info(
                    "Retrieving filter state from permalink: permalink_key=%s"
                    % (permalink_key,)
                )

                if permalink_value:
                    permalink_state = get_matching_dashboard_permalink_state(
                        lookup_result,
                        result.id,
                        result.uuid,
                        result.slug,
                        result.native_filters,
                    )
                    if permalink_state is None:
                        await ctx.warning(
                            "permalink_key belongs to a different dashboard; "
                            "ignoring permalink filter state."
                        )
                    else:
                        result = _apply_permalink_state(
                            result,
                            permalink_state.key,
                            permalink_state.state,
                        )

                        await ctx.info(
                            "Filter state retrieved from permalink: "
                            "has_dataMask=%s, has_chartStates=%s, has_activeTabs=%s"
                            % (
                                "dataMask" in permalink_state.state,
                                "chartStates" in permalink_state.state,
                                "activeTabs" in permalink_state.state,
                            )
                        )
                else:
                    await ctx.warning(
                        "permalink_key provided but no permalink found. "
                        "The permalink may have expired or is invalid."
                    )
            elif request.filter_state is not None:
                # Filter context supplied directly (no permalink), e.g. embedded.
                await ctx.info("Applying caller-supplied filter_state")
                filter_state = request.filter_state
                if not user_can_view_data_model_metadata():
                    filter_state = redact_filter_state_data_model_metadata(
                        filter_state, result.native_filters
                    )
                result = _apply_permalink_state(
                    result, None, filter_state, is_permalink=False
                )

            await ctx.info(
                "Dashboard information retrieved successfully: id=%s, title=%s, "
                "chart_count=%s, published=%s, is_permalink_state=%s"
                % (
                    result.id,
                    result.dashboard_title,
                    result.chart_count,
                    result.published,
                    result.is_permalink_state,
                )
            )
            # Include filter_state by default when present, but honor an explicit
            # select_columns projection (model_fields_set = caller chose it).
            effective_select_columns = list(request.select_columns)
            if (
                result.filter_state is not None
                and "select_columns" not in request.model_fields_set
                and "filter_state" not in effective_select_columns
            ):
                effective_select_columns.append("filter_state")

            result = _enrich_filter_values(
                result, lookup_result, request, effective_select_columns, started_at
            )

            return cast(
                DashboardInfoWithFilterValues,
                _serialize_info(result, effective_select_columns),
            )
        else:
            await ctx.warning(
                "Dashboard retrieval failed: error_type=%s, error=%s"
                % (result.error_type, result.error)
            )

        return result

    except ToolError:
        # Preserve the compact size-limit refusal without another serialization pass.
        raise
    except Exception as e:
        error = _dashboard_retrieval_error(e)
        await ctx.error(
            "Dashboard information retrieval failed: identifier=%s, error=%s, "
            "error_type=%s" % (request.identifier, error.error, type(e).__name__)
        )
        return error
