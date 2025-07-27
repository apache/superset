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
MCP tool: generate_dashboard

This tool creates a new dashboard with specified charts and layout configuration.
"""

import logging
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.mcp_app import mcp
from superset.mcp_service.pydantic_schemas.dashboard_schemas import DashboardInfo
from superset.utils import json

logger = logging.getLogger(__name__)


class GenerateDashboardRequest(BaseModel):
    """Request schema for generating a dashboard."""

    chart_ids: List[int] = Field(
        ..., description="List of chart IDs to include in the dashboard", min_length=1
    )
    dashboard_title: str = Field(..., description="Title for the new dashboard")
    description: Optional[str] = Field(
        None, description="Description for the dashboard"
    )
    published: bool = Field(
        default=True, description="Whether to publish the dashboard"
    )


class GenerateDashboardResponse(BaseModel):
    """Response schema for dashboard generation."""

    dashboard: Optional[DashboardInfo] = Field(
        None, description="The created dashboard info, if successful"
    )
    dashboard_url: Optional[str] = Field(None, description="URL to view the dashboard")
    error: Optional[str] = Field(None, description="Error message, if creation failed")


def _create_dashboard_layout(chart_ids: List[int]) -> Dict[str, Any]:
    """
    Create a simple dashboard layout with charts arranged in a grid.

    This creates a basic 2-column layout where charts are arranged
    vertically in alternating columns.
    """
    layout = {}

    # Grid configuration
    chart_width = 24  # Half width for 2-column layout
    chart_height = 16  # Standard chart height

    for i, chart_id in enumerate(chart_ids):
        # Alternate between left (x=0) and right (x=24) columns
        x_position = 0 if i % 2 == 0 else 24
        # Stack charts vertically in each column
        y_position = (i // 2) * chart_height

        # Create chart component in layout
        chart_key = f"CHART-{chart_id}"
        layout[chart_key] = {
            "children": [],
            "id": chart_key,
            "meta": {
                "chartId": chart_id,
                "height": chart_height,
                "sliceName": f"Chart {chart_id}",
                "uuid": f"chart-{chart_id}",
                "width": chart_width,
            },
            "parents": ["ROOT_ID"],
            "type": "CHART",
        }

        # Add position information to the chart meta
        chart_meta = layout[chart_key]["meta"]
        if isinstance(chart_meta, dict):
            chart_meta.update(
                {
                    "h": chart_height,
                    "w": chart_width,
                    "x": x_position,
                    "y": y_position,
                }
            )

    # Add root layout container
    layout["ROOT_ID"] = {
        "children": [f"CHART-{chart_id}" for chart_id in chart_ids],
        "id": "ROOT_ID",
        "type": "ROOT",
    }

    return layout


@mcp.tool
@mcp_auth_hook
def generate_dashboard(request: GenerateDashboardRequest) -> GenerateDashboardResponse:
    """
    Generate a new dashboard with the specified charts.

    This tool creates a dashboard with the provided charts arranged in a
    simple 2-column grid layout. All charts must exist and be accessible
    to the current user.

    Args:
        request: GenerateDashboardRequest with chart_ids, title, and options

    Returns:
        GenerateDashboardResponse with the created dashboard info and URL
    """
    try:
        from superset.commands.dashboard.create import CreateDashboardCommand
        from superset.daos.chart import ChartDAO

        # Validate all chart IDs exist
        missing_charts = []
        for chart_id in request.chart_ids:
            chart = ChartDAO.find_by_id(chart_id)
            if not chart:
                missing_charts.append(chart_id)

        if missing_charts:
            return GenerateDashboardResponse(
                dashboard=None,
                dashboard_url=None,
                error=f"Charts not found: {missing_charts}",
            )

        # Create dashboard layout
        layout = _create_dashboard_layout(request.chart_ids)

        # Prepare dashboard data
        dashboard_data = {
            "dashboard_title": request.dashboard_title,
            "slug": None,  # Let Superset auto-generate slug
            "css": "",
            "json_metadata": json.dumps(
                {
                    "filter_scopes": {},
                    "expanded_slices": {},
                    "refresh_frequency": 0,
                    "timed_refresh_immune_slices": [],
                    "color_scheme": None,
                    "label_colors": {},
                    "shared_label_colors": {},
                    "color_scheme_domain": [],
                    "cross_filters_enabled": False,
                }
            ),
            "position_json": json.dumps(layout),
            "published": request.published,
            "slices": request.chart_ids,
        }

        if request.description:
            dashboard_data["description"] = request.description

        # Create the dashboard using Superset's command pattern
        command = CreateDashboardCommand(dashboard_data)
        dashboard = command.run()

        # Convert to our response format
        from superset.mcp_service.pydantic_schemas.dashboard_schemas import (
            serialize_tag_object,
            serialize_user_object,
        )

        dashboard_info = DashboardInfo(
            id=dashboard.id,
            dashboard_title=dashboard.dashboard_title,
            slug=dashboard.slug,
            description=dashboard.description,
            published=dashboard.published,
            created_on=dashboard.created_on,
            changed_on=dashboard.changed_on,
            created_by=dashboard.created_by.username if dashboard.created_by else None,
            changed_by=dashboard.changed_by.username if dashboard.changed_by else None,
            uuid=str(dashboard.uuid) if dashboard.uuid else None,
            url=f"/superset/dashboard/{dashboard.id}/",
            chart_count=len(request.chart_ids),
            owners=[
                serialize_user_object(owner)
                for owner in getattr(dashboard, "owners", [])
                if serialize_user_object(owner) is not None
            ],
            tags=[
                serialize_tag_object(tag)
                for tag in getattr(dashboard, "tags", [])
                if serialize_tag_object(tag) is not None
            ],
            roles=[],  # Dashboard roles not typically set at creation
            charts=[],  # Chart details not needed in response
        )

        dashboard_url = f"/superset/dashboard/{dashboard.id}/"

        logger.info(
            f"Created dashboard {dashboard.id} with {len(request.chart_ids)} charts"
        )

        return GenerateDashboardResponse(
            dashboard=dashboard_info, dashboard_url=dashboard_url, error=None
        )

    except Exception as e:
        logger.error(f"Error creating dashboard: {e}", exc_info=True)
        return GenerateDashboardResponse(
            dashboard=None,
            dashboard_url=None,
            error=f"Failed to create dashboard: {str(e)}",
        )
