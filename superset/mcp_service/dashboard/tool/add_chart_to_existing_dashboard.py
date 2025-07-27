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
from superset.mcp_service.pydantic_schemas.dashboard_schemas import DashboardInfo
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


def _find_next_position(layout: Dict[str, Any]) -> tuple[int, int]:
    """
    Find the next available position in the dashboard layout.

    Returns:
        Tuple of (x, y) coordinates for the new chart
    """
    # Standard chart dimensions
    chart_height = 16
    grid_columns = 48

    # Find the maximum Y position of existing charts
    max_y = 0
    for key, item in layout.items():
        if key.endswith("_POSITION") and isinstance(item, dict):
            y_pos = item.get("y", 0)
            height = item.get("h", chart_height)
            max_y = max(max_y, y_pos + height)

    # Try to place in a 2-column layout
    # Check if there's space in the left column at max_y
    left_occupied = False
    right_occupied = False

    for key, item in layout.items():
        if key.endswith("_POSITION") and isinstance(item, dict):
            y_pos = item.get("y", 0)
            x_pos = item.get("x", 0)
            height = item.get("h", chart_height)

            # Check if this chart occupies the position we're considering
            if y_pos <= max_y < y_pos + height:
                if x_pos < grid_columns // 2:  # Left column
                    left_occupied = True
                else:  # Right column
                    right_occupied = True

    # Choose position based on availability
    if not left_occupied:
        return (0, max_y)  # Left column
    elif not right_occupied:
        return (24, max_y)  # Right column
    else:
        return (0, max_y + chart_height)  # New row, left column


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
        from superset.daos.chart import ChartDAO
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

        # Validate chart exists
        chart = ChartDAO.find_by_id(request.chart_id)
        if not chart:
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
        x_pos, y_pos = _find_next_position(current_layout)

        # Create chart component key
        chart_key = f"CHART-{request.chart_id}"
        chart_width = 24
        chart_height = 16

        # Add chart to layout
        current_layout[chart_key] = {
            "children": [],
            "id": chart_key,
            "meta": {
                "chartId": request.chart_id,
                "height": chart_height,
                "sliceName": chart.slice_name or f"Chart {request.chart_id}",
                "uuid": str(chart.uuid) if chart.uuid else f"chart-{request.chart_id}",
                "width": chart_width,
            },
            "parents": ["ROOT_ID"],
            "type": "CHART",
        }

        # Add position information
        position_info = {"h": chart_height, "w": chart_width, "x": x_pos, "y": y_pos}
        current_layout[f"{chart_key}_POSITION"] = position_info

        # Update ROOT_ID children if it exists
        if "ROOT_ID" in current_layout:
            if "children" not in current_layout["ROOT_ID"]:
                current_layout["ROOT_ID"]["children"] = []
            current_layout["ROOT_ID"]["children"].append(chart_key)
        else:
            # Create ROOT_ID if it doesn't exist
            current_layout["ROOT_ID"] = {
                "children": [chart_key],
                "id": "ROOT_ID",
                "type": "ROOT",
            }

        # Prepare update data
        update_data = {
            "position_json": json.dumps(current_layout),
            "slices": current_chart_ids + [request.chart_id],  # Add new chart ID
        }

        # Update the dashboard
        command = UpdateDashboardCommand(request.dashboard_id, update_data)
        updated_dashboard = command.run()

        # Convert to response format
        from superset.mcp_service.pydantic_schemas.dashboard_schemas import (
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
            url=f"/superset/dashboard/{updated_dashboard.id}/",
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

        dashboard_url = f"/superset/dashboard/{updated_dashboard.id}/"

        logger.info(
            f"Added chart {request.chart_id} to dashboard {request.dashboard_id} "
            f"at position ({x_pos}, {y_pos})"
        )

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
