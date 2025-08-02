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
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field

from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.mcp_app import mcp
from superset.mcp_service.schemas.dashboard_schemas import DashboardInfo
from superset.mcp_service.url_utils import get_superset_base_url
from superset.utils import json

logger = logging.getLogger(__name__)


class AddChartToDashboardRequest(BaseModel):
    """Request schema for adding a chart to an existing dashboard."""

    dashboard_id: int = Field(
        ..., description="ID of the dashboard to add the chart to"
    )
    chart_id: int = Field(..., description="ID of the chart to add to the dashboard")
    target_tab: Optional[str] = Field(
        None, description="Target tab name (if dashboard has tabs)"
    )


class AddChartToDashboardResponse(BaseModel):
    """Response schema for adding chart to dashboard."""

    dashboard: Optional[DashboardInfo] = Field(
        None, description="The updated dashboard info, if successful"
    )
    dashboard_url: Optional[str] = Field(
        None, description="URL to view the updated dashboard"
    )
    position: Optional[Dict[str, Any]] = Field(
        None, description="Position information for the added chart"
    )
    error: Optional[str] = Field(None, description="Error message, if operation failed")


def _find_next_row_position(layout: Dict[str, Any]) -> int:
    """
    Find the next available row position in the dashboard layout.

    Returns:
        Row index for the new chart
    """
    # Find existing rows
    row_indices = []
    for key in layout.keys():
        if key.startswith("ROW-") and key[4:].isdigit():
            row_indices.append(int(key[4:]))

    # Return next available row index
    return max(row_indices) + 1 if row_indices else 0


def _add_chart_to_layout(
    layout: Dict[str, Any], chart: Any, chart_id: int, row_index: int
) -> tuple[str, str]:
    """
    Add chart and row components to the dashboard layout.

    Returns:
        Tuple of (chart_key, row_key)
    """
    chart_key = f"CHART-{chart_id}"
    row_key = f"ROW-{row_index}"
    chart_width = 5  # Balanced width for good proportions
    chart_height = 50  # Good height for most chart types

    # Add chart to layout using proper Superset structure
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
        "parents": ["ROOT_ID", "GRID_ID", row_key],
        "type": "CHART",
    }

    # Create row for the chart
    layout[row_key] = {
        "children": [chart_key],
        "id": row_key,
        "meta": {"background": "BACKGROUND_TRANSPARENT"},
        "parents": ["ROOT_ID", "GRID_ID"],
        "type": "ROW",
    }

    return chart_key, row_key


def _ensure_layout_structure(layout: Dict[str, Any], row_key: str) -> None:
    """
    Ensure the dashboard layout has proper GRID and ROOT structure.
    """
    # Ensure GRID structure exists
    if "GRID_ID" not in layout:
        layout["GRID_ID"] = {
            "children": [],
            "id": "GRID_ID",
            "parents": ["ROOT_ID"],
            "type": "GRID",
        }

    # Add row to GRID
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


@mcp.tool
@mcp_auth_hook
def add_chart_to_existing_dashboard(
    request: AddChartToDashboardRequest,
) -> AddChartToDashboardResponse:
    """
    Add a chart to an existing dashboard.

    This tool adds the specified chart to an existing dashboard, automatically
    positioning it in the layout. The chart will be placed in the next
    available position using a 2-column grid layout.

    Args:
        request: AddChartToDashboardRequest with dashboard_id, chart_id, and
                optional target_tab

    Returns:
        AddChartToDashboardResponse with updated dashboard info and position
    """
    try:
        from superset.commands.dashboard.update import UpdateDashboardCommand
        from superset.daos.dashboard import DashboardDAO

        # Validate dashboard exists
        dashboard = DashboardDAO.find_by_id(request.dashboard_id)
        if not dashboard:
            return AddChartToDashboardResponse(
                dashboard=None,
                dashboard_url=None,
                position=None,
                error=f"Dashboard with ID {request.dashboard_id} not found",
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

        # Parse current layout
        try:
            current_layout = json.loads(dashboard.position_json or "{}")
        except (json.JSONDecodeError, TypeError):
            current_layout = {}

        # Find position for new chart
        row_index = _find_next_row_position(current_layout)

        # Add chart and row to layout
        chart_key, row_key = _add_chart_to_layout(
            current_layout, new_chart, request.chart_id, row_index
        )

        # Ensure proper layout structure
        _ensure_layout_structure(current_layout, row_key)

        # Get chart objects for SQLAlchemy relationships
        # Get existing chart objects
        existing_chart_objects = dashboard.slices

        # Combine existing and new chart objects (new_chart was retrieved above)
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
        from superset.mcp_service.schemas.dashboard_schemas import (
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
            f"Added chart {request.chart_id} to dashboard {request.dashboard_id} "
            f"in row {row_index}"
        )

        # Return position info for compatibility
        position_info = {"row": row_index, "chart_key": chart_key, "row_key": row_key}

        return AddChartToDashboardResponse(
            dashboard=dashboard_info,
            dashboard_url=dashboard_url,
            position=position_info,
            error=None,
        )

    except Exception as e:
        logger.error(f"Error adding chart to dashboard: {e}", exc_info=True)
        return AddChartToDashboardResponse(
            dashboard=None,
            dashboard_url=None,
            position=None,
            error=f"Failed to add chart to dashboard: {str(e)}",
        )
