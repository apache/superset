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
MCP tool: add_chart_to_existing_dashboard

This tool adds a chart to an existing dashboard with automatic layout positioning.
"""

import logging
from typing import Any, Dict

from fastmcp import Context
from sqlalchemy.exc import SQLAlchemyError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.commands.exceptions import CommandException
from superset.extensions import event_logger
from superset.mcp_service.dashboard.constants import (
    generate_id,
    GRID_COLUMN_COUNT,
    GRID_DEFAULT_CHART_WIDTH,
)
from superset.mcp_service.dashboard.layout_placement import (
    _collect_available_tab_names,
    _ensure_layout_structure,
    _find_next_row_position,
    _find_tab_insert_target,
)
from superset.mcp_service.dashboard.layout_validation import rebuild_parent_chains
from superset.mcp_service.dashboard.schemas import (
    AddChartToDashboardRequest,
    AddChartToDashboardResponse,
    DashboardInfo,
    serialize_chart_summary,
)
from superset.mcp_service.privacy import user_can_view_data_model_metadata
from superset.mcp_service.utils.url_utils import get_superset_base_url
from superset.utils import json

logger = logging.getLogger(__name__)


def _add_chart_to_layout(
    layout: Dict[str, Any],
    chart: Any,
    chart_id: int,
    row_key: str,
    parent_id: str,
) -> tuple[str, str, str]:
    """
    Add chart, column, and row components to the dashboard layout.

    Creates the proper ``ROW > COLUMN > CHART`` hierarchy that the
    frontend expects for rendering. ``parents`` is left empty on each new
    node — the caller rebuilds it for the whole layout via
    ``rebuild_parent_chains`` after this function links the new row into
    its parent container's ``children``.

    Args:
        layout: The mutable layout dict to update.
        chart: The chart ORM object.
        chart_id: The chart's integer ID.
        row_key: The pre-generated ROW component ID.
        parent_id: The parent container ID (GRID_ID or a TAB ID).

    Returns:
        Tuple of ``(chart_key, column_key, row_key)``.
    """
    chart_key = f"CHART-{chart_id}"
    column_key = generate_id("COLUMN")
    chart_width = GRID_DEFAULT_CHART_WIDTH
    chart_height = 50  # Good height for most chart types

    # Add chart component
    layout[chart_key] = {
        "children": [],
        "id": chart_key,
        "meta": {
            "chartId": chart_id,
            "height": chart_height,
            "sliceName": chart.slice_name or f"Chart {chart_id}",
            "uuid": str(chart.uuid) if chart.uuid else f"chart-{chart_id}",
            "width": chart_width,
        },
        "parents": [],
        "type": "CHART",
    }

    # Add column wrapper (ROW > COLUMN > CHART)
    layout[column_key] = {
        "children": [chart_key],
        "id": column_key,
        "meta": {
            "background": "BACKGROUND_TRANSPARENT",
            "width": GRID_COLUMN_COUNT,
        },
        "parents": [],
        "type": "COLUMN",
    }

    # Create row containing the column
    layout[row_key] = {
        "children": [column_key],
        "id": row_key,
        "meta": {"background": "BACKGROUND_TRANSPARENT"},
        "parents": [],
        "type": "ROW",
    }

    return chart_key, column_key, row_key


def _resolve_parent_container(
    layout: Dict[str, Any],
    dashboard_id: int,
    target_tab: str | None,
) -> tuple[str, None] | tuple[None, AddChartToDashboardResponse]:
    """Return (parent_id, None) on success or (None, error_response) on mismatch.

    When *target_tab* is specified and not found the caller receives a
    descriptive error listing available tabs rather than a silent fallback.
    """
    tab_target = _find_tab_insert_target(layout, target_tab=target_tab)

    if target_tab is not None and tab_target is None:
        available = _collect_available_tab_names(layout)
        if available:
            tab_list = ", ".join(available)
            return None, AddChartToDashboardResponse(
                dashboard=None,
                dashboard_url=None,
                position=None,
                error=(
                    f"Tab '{target_tab}' not found in dashboard {dashboard_id}. "
                    f"Available tabs: {tab_list}."
                ),
            )
        return None, AddChartToDashboardResponse(
            dashboard=None,
            dashboard_url=None,
            position=None,
            error=(
                f"Dashboard {dashboard_id} has no tabs. "
                "Remove the target_tab parameter to add the chart to "
                "the default grid layout."
            ),
        )

    return (tab_target if tab_target else "GRID_ID", None)


def _find_and_authorize_dashboard(
    dashboard_id: int,
) -> tuple[Any, AddChartToDashboardResponse | None]:
    """Return (dashboard, None) on success or (None, error_response) on failure.

    Handles both the not-found case and the editorship check so the main tool
    function doesn't need two separate branches for these pre-conditions.
    """
    from superset import security_manager
    from superset.daos.dashboard import DashboardDAO
    from superset.exceptions import SupersetSecurityException

    dashboard = DashboardDAO.find_by_id(dashboard_id)
    if not dashboard:
        return None, AddChartToDashboardResponse(
            dashboard=None,
            dashboard_url=None,
            position=None,
            error=(
                f"Dashboard with ID {dashboard_id} not found."
                " Use list_dashboards to get valid dashboard IDs."
            ),
        )

    try:
        security_manager.raise_for_editorship(dashboard)
    except SupersetSecurityException:
        return None, AddChartToDashboardResponse(
            dashboard=None,
            dashboard_url=None,
            position=None,
            permission_denied=True,
            error=(
                f"You don't have permission to edit dashboard "
                f"'{dashboard.dashboard_title}' (ID: {dashboard_id}). "
                "Ask the user if they would like a new dashboard "
                "created with this chart instead, and only proceed "
                "if they confirm."
            ),
        )

    return dashboard, None


@tool(
    tags=["mutate"],
    class_permission_name="Dashboard",
    annotations=ToolAnnotations(
        title="Add chart to dashboard",
        readOnlyHint=False,
        destructiveHint=False,
        idempotentHint=False,
        openWorldHint=False,
    ),
)
def add_chart_to_existing_dashboard(  # noqa: C901 — complexity is structural (layout traversal + multi-step authorization), not accidental
    request: AddChartToDashboardRequest, ctx: Context
) -> AddChartToDashboardResponse:
    """
    Add chart to existing dashboard. Auto-positions in 2-column grid.
    Returns updated dashboard info.
    """
    try:
        from superset.commands.dashboard.update import UpdateDashboardCommand

        # Validate dashboard exists and user has edit permission
        with event_logger.log_context(action="mcp.add_chart_to_dashboard.validation"):
            dashboard, auth_error = _find_and_authorize_dashboard(request.dashboard_id)
            if auth_error is not None:
                return auth_error

            # Get chart object for SQLAlchemy relationships and validation
            from superset import db
            from superset.models.slice import Slice

            new_chart = db.session.get(Slice, request.chart_id)
            if not new_chart:
                return AddChartToDashboardResponse(
                    dashboard=None,
                    dashboard_url=None,
                    position=None,
                    error=(
                        f"Chart with ID {request.chart_id} not found."
                        " Use list_charts to get valid chart IDs."
                    ),
                )

            # Validate dataset access for the chart.
            # check_chart_data_access is the centralized data-level
            # permission check that complements the class-level RBAC
            # enforced by mcp_auth_hook.
            from superset.mcp_service.auth import check_chart_data_access

            validation = check_chart_data_access(new_chart)
            if not validation.is_valid:
                return AddChartToDashboardResponse(
                    dashboard=None,
                    dashboard_url=None,
                    position=None,
                    error=(
                        f"Chart {request.chart_id} is not accessible: "
                        f"{validation.error}"
                    ),
                )

            # Check if chart is already in dashboard
            current_chart_ids = [slice.id for slice in dashboard.slices]
            if request.chart_id in current_chart_ids:
                return AddChartToDashboardResponse(
                    dashboard=None,
                    dashboard_url=None,
                    position=None,
                    error=(
                        f"Chart {request.chart_id} is already in dashboard "
                        f"{request.dashboard_id}"
                    ),
                )

        # Calculate layout position
        with event_logger.log_context(action="mcp.add_chart_to_dashboard.layout"):
            # Parse current layout
            try:
                current_layout = json.loads(dashboard.position_json or "{}")
            except (json.JSONDecodeError, TypeError):
                current_layout = {}

            # Generate a unique ROW ID for the new row
            row_key = _find_next_row_position(current_layout)

            # Detect tabbed dashboards and resolve target_tab by name or ID.
            parent_id, tab_error = _resolve_parent_container(
                current_layout, request.dashboard_id, request.target_tab
            )
            if tab_error is not None:
                return tab_error
            if parent_id is None:
                raise RuntimeError(
                    "unreachable: tab_error is None implies parent_id is str"
                )

            # Add chart, column, and row to layout
            chart_key, column_key, row_key = _add_chart_to_layout(
                current_layout, new_chart, request.chart_id, row_key, parent_id
            )

            # Ensure proper layout structure
            _ensure_layout_structure(current_layout, row_key, parent_id)

            # The new row/column/chart nodes were added with empty
            # ``parents`` (see ``_add_chart_to_layout``); rebuild every
            # reachable component's parents from the actual children edges
            # so filter-scope derivation sees a correct tree, regardless of
            # what the stored layout carried beforehand. See
            # superset.dashboards.filter_scope.get_chart_ids_in_scope.
            current_layout = rebuild_parent_chains(current_layout)

        # Update the dashboard
        with event_logger.log_context(action="mcp.add_chart_to_dashboard.db_write"):
            # Get existing chart objects
            existing_chart_objects = dashboard.slices

            # Combine existing and new chart objects
            all_chart_objects = list(existing_chart_objects) + [new_chart]

            # Prepare update data
            update_data = {
                "position_json": json.dumps(current_layout),
                "slices": all_chart_objects,  # Pass ORM objects, not IDs
            }

            # Update the dashboard
            command = UpdateDashboardCommand(request.dashboard_id, update_data)
            updated_dashboard = command.run()

        # Re-fetch the dashboard with eager-loaded relationships to avoid
        # "Instance is not bound to a Session" errors when serializing
        # chart .tags and .editors.  The preceding command.run() commit may
        # invalidate the session in multi-tenant environments; on failure,
        # return a minimal response using only scalar attributes that are
        # already loaded — relationship fields (editors, tags, slices) would
        # trigger lazy-loading on the same dead session.
        from sqlalchemy.orm import subqueryload

        from superset.daos.dashboard import DashboardDAO
        from superset.models.dashboard import Dashboard
        from superset.models.slice import Slice

        try:
            updated_dashboard = (
                DashboardDAO.find_by_id(
                    updated_dashboard.id,
                    query_options=[
                        subqueryload(Dashboard.slices).subqueryload(Slice.editors),
                        subqueryload(Dashboard.slices).subqueryload(Slice.tags),
                        subqueryload(Dashboard.editors),
                        subqueryload(Dashboard.tags),
                    ],
                )
                or updated_dashboard
            )
        except SQLAlchemyError:
            logger.warning(
                "Re-fetch of dashboard %s failed; returning minimal response",
                updated_dashboard.id,
                exc_info=True,
            )
            try:
                db.session.rollback()  # pylint: disable=consider-using-transaction
            except SQLAlchemyError:
                logger.warning(
                    "Database rollback failed during dashboard re-fetch error handling",
                    exc_info=True,
                )
            dashboard_url = (
                f"{get_superset_base_url()}/dashboard/{updated_dashboard.id}/"
            )
            position_info = {
                "row": row_key,
                "chart_key": chart_key,
                "row_key": row_key,
            }
            return AddChartToDashboardResponse(
                dashboard=DashboardInfo(
                    id=updated_dashboard.id,
                    dashboard_title=updated_dashboard.dashboard_title,
                    published=updated_dashboard.published,
                    chart_count=len(all_chart_objects),
                    url=dashboard_url,
                ),
                dashboard_url=dashboard_url,
                position=position_info,
                error=None,
            )

        # Convert to response format
        from superset.mcp_service.dashboard.schemas import (
            serialize_tag_object,
        )
        from superset.mcp_service.system.schemas import serialize_subject_object

        include_data_model_metadata = user_can_view_data_model_metadata()
        dashboard_info = DashboardInfo(
            id=updated_dashboard.id,
            dashboard_title=updated_dashboard.dashboard_title,
            slug=updated_dashboard.slug,
            description=updated_dashboard.description,
            published=updated_dashboard.published,
            created_on=updated_dashboard.created_on,
            changed_on=updated_dashboard.changed_on,
            uuid=str(updated_dashboard.uuid) if updated_dashboard.uuid else None,
            url=f"{get_superset_base_url()}/dashboard/{updated_dashboard.id}/",
            chart_count=len(updated_dashboard.slices),
            editors=[
                serialize_subject_object(editor)
                for editor in getattr(updated_dashboard, "editors", [])
                if serialize_subject_object(editor) is not None
            ],
            tags=[
                serialize_tag_object(tag)
                for tag in getattr(updated_dashboard, "tags", [])
                if serialize_tag_object(tag) is not None
            ],
            charts=[
                obj
                for chart in getattr(updated_dashboard, "slices", [])
                if (
                    obj := serialize_chart_summary(
                        chart,
                        include_data_model_metadata=include_data_model_metadata,
                    )
                )
                is not None
            ],
        )

        dashboard_url = f"{get_superset_base_url()}/dashboard/{updated_dashboard.id}/"

        logger.info(
            "Added chart %s to dashboard %s ", request.chart_id, request.dashboard_id
        )

        # Return position info for compatibility
        position_info = {"row": row_key, "chart_key": chart_key, "row_key": row_key}

        return AddChartToDashboardResponse(
            dashboard=dashboard_info,
            dashboard_url=dashboard_url,
            position=position_info,
            error=None,
        )

    except (CommandException, SQLAlchemyError, KeyError, ValueError) as e:
        from superset import db

        try:
            db.session.rollback()  # pylint: disable=consider-using-transaction
        except SQLAlchemyError:
            logger.warning(
                "Database rollback failed during error handling", exc_info=True
            )
        logger.error("Error adding chart to dashboard: %s", e)
        return AddChartToDashboardResponse(
            dashboard=None,
            dashboard_url=None,
            position=None,
            error=f"Failed to add chart to dashboard: {str(e)}",
        )
