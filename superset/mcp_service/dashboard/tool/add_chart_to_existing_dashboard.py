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
from superset_core.mcp import tool

from superset.extensions import event_logger
from superset.mcp_service.dashboard.constants import (
    generate_id,
    GRID_COLUMN_COUNT,
    GRID_DEFAULT_CHART_WIDTH,
)
from superset.mcp_service.dashboard.schemas import (
    AddChartToDashboardRequest,
    AddChartToDashboardResponse,
    DashboardInfo,
)
from superset.mcp_service.utils.schema_utils import parse_request
from superset.mcp_service.utils.url_utils import get_superset_base_url
from superset.utils import json

logger = logging.getLogger(__name__)


def _find_next_row_position(layout: Dict[str, Any]) -> str:
    """
    Generate a unique ROW ID for a new row in the dashboard layout.

    Uses UUID-based IDs (e.g. ``ROW-a1b2c3d4``) instead of numeric indices
    so that the IDs are compatible with real dashboard layouts that use
    nanoid-style identifiers.

    Returns:
        A new unique ROW ID string.
    """
    row_key = generate_id("ROW")
    # Ensure uniqueness (extremely unlikely collision, but safe)
    while row_key in layout:
        row_key = generate_id("ROW")
    return row_key


def _find_tab_insert_target(layout: Dict[str, Any]) -> str | None:
    """
    Detect if the dashboard uses tabs and return the first tab's ID.

    If ``GRID_ID`` has children that are ``TABS`` components, this walks
    into the first ``TAB`` child so that new rows are placed inside the
    active tab rather than directly under GRID_ID.

    Returns:
        The ID of the first TAB component, or ``None`` if the dashboard
        does not use top-level tabs.
    """
    grid = layout.get("GRID_ID")
    if not grid:
        return None

    for child_id in grid.get("children", []):
        child = layout.get(child_id)
        if child and child.get("type") == "TABS":
            # Found a TABS component; use its first TAB child
            tabs_children = child.get("children", [])
            if tabs_children:
                first_tab_id = tabs_children[0]
                first_tab = layout.get(first_tab_id)
                if first_tab and first_tab.get("type") == "TAB":
                    return first_tab_id
    return None


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
    frontend expects for rendering.

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

    # Build the parents chain up to the parent container
    if (parent_component := layout.get(parent_id)) is not None:
        parent_parents = parent_component.get("parents", [])
    elif parent_id == "GRID_ID":
        # Empty layout: GRID_ID will be created by _ensure_layout_structure
        # with parents=["ROOT_ID"], so mirror that here.
        parent_parents = ["ROOT_ID"]
    else:
        parent_parents = []
    row_parents = list(parent_parents) + [parent_id]
    column_parents = row_parents + [row_key]
    chart_parents = column_parents + [column_key]

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
        "parents": chart_parents,
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
        "parents": column_parents,
        "type": "COLUMN",
    }

    # Create row containing the column
    layout[row_key] = {
        "children": [column_key],
        "id": row_key,
        "meta": {"background": "BACKGROUND_TRANSPARENT"},
        "parents": row_parents,
        "type": "ROW",
    }

    return chart_key, column_key, row_key


def _ensure_layout_structure(
    layout: Dict[str, Any], row_key: str, parent_id: str
) -> None:
    """
    Ensure the dashboard layout has proper GRID and ROOT structure,
    and add the new row to the correct parent container.

    Args:
        layout: The mutable layout dict to update.
        row_key: The ROW component ID to insert.
        parent_id: The container to add the row to (GRID_ID or a TAB ID).
    """
    # Ensure GRID structure exists
    if "GRID_ID" not in layout:
        layout["GRID_ID"] = {
            "children": [],
            "id": "GRID_ID",
            "parents": ["ROOT_ID"],
            "type": "GRID",
        }

    # Add row to the target parent container
    if parent := layout.get(parent_id):
        if "children" not in parent:
            parent["children"] = []
        parent["children"].append(row_key)
    else:
        # Fallback: add to GRID_ID
        if "children" not in layout["GRID_ID"]:
            layout["GRID_ID"]["children"] = []
        layout["GRID_ID"]["children"].append(row_key)

    # Update ROOT_ID if it exists, or create it
    if "ROOT_ID" in layout:
        if "children" not in layout["ROOT_ID"]:
            layout["ROOT_ID"]["children"] = []
        if "GRID_ID" not in layout["ROOT_ID"]["children"]:
            layout["ROOT_ID"]["children"].append("GRID_ID")
    else:
        # Create ROOT_ID if it doesn't exist
        layout["ROOT_ID"] = {
            "children": ["GRID_ID"],
            "id": "ROOT_ID",
            "type": "ROOT",
        }

    # Ensure dashboard version
    if "DASHBOARD_VERSION_KEY" not in layout:
        layout["DASHBOARD_VERSION_KEY"] = "v2"


@tool(tags=["mutate"])
@parse_request(AddChartToDashboardRequest)
def add_chart_to_existing_dashboard(
    request: AddChartToDashboardRequest, ctx: Context
) -> AddChartToDashboardResponse:
    """
    Add chart to existing dashboard. Auto-positions in 2-column grid.
    Returns updated dashboard info.
    """
    try:
        from superset.commands.dashboard.update import UpdateDashboardCommand
        from superset.daos.dashboard import DashboardDAO

        # Validate dashboard and chart exist
        with event_logger.log_context(action="mcp.add_chart_to_dashboard.validation"):
            dashboard = DashboardDAO.find_by_id(request.dashboard_id)
            if not dashboard:
                return AddChartToDashboardResponse(
                    dashboard=None,
                    dashboard_url=None,
                    position=None,
                    error=(f"Dashboard with ID {request.dashboard_id} not found"),
                )

            # Get chart object for SQLAlchemy relationships and validation
            from superset import db
            from superset.models.slice import Slice

            new_chart = db.session.get(Slice, request.chart_id)
            if not new_chart:
                return AddChartToDashboardResponse(
                    dashboard=None,
                    dashboard_url=None,
                    position=None,
                    error=f"Chart with ID {request.chart_id} not found",
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

            # Detect tabbed dashboards: if GRID has TABS, target the first tab
            tab_target = _find_tab_insert_target(current_layout)
            parent_id = tab_target if tab_target else "GRID_ID"

            # Add chart, column, and row to layout
            chart_key, column_key, row_key = _add_chart_to_layout(
                current_layout, new_chart, request.chart_id, row_key, parent_id
            )

            # Ensure proper layout structure
            _ensure_layout_structure(current_layout, row_key, parent_id)

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

        # Convert to response format
        from superset.mcp_service.dashboard.schemas import (
            serialize_tag_object,
            serialize_user_object,
        )

        dashboard_info = DashboardInfo(
            id=updated_dashboard.id,
            dashboard_title=updated_dashboard.dashboard_title,
            slug=updated_dashboard.slug,
            description=updated_dashboard.description,
            published=updated_dashboard.published,
            created_on=updated_dashboard.created_on,
            changed_on=updated_dashboard.changed_on,
            created_by=updated_dashboard.created_by.username
            if updated_dashboard.created_by
            else None,
            changed_by=updated_dashboard.changed_by.username
            if updated_dashboard.changed_by
            else None,
            uuid=str(updated_dashboard.uuid) if updated_dashboard.uuid else None,
            url=f"{get_superset_base_url()}/superset/dashboard/{updated_dashboard.id}/",
            chart_count=len(updated_dashboard.slices),
            owners=[
                serialize_user_object(owner)
                for owner in getattr(updated_dashboard, "owners", [])
                if serialize_user_object(owner) is not None
            ],
            tags=[
                serialize_tag_object(tag)
                for tag in getattr(updated_dashboard, "tags", [])
                if serialize_tag_object(tag) is not None
            ],
            roles=[],
            charts=[],
        )

        dashboard_url = (
            f"{get_superset_base_url()}/superset/dashboard/{updated_dashboard.id}/"
        )

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

    except Exception as e:
        logger.error("Error adding chart to dashboard: %s", e)
        return AddChartToDashboardResponse(
            dashboard=None,
            dashboard_url=None,
            position=None,
            error=f"Failed to add chart to dashboard: {str(e)}",
        )
