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
from superset.mcp_service.schemas.dashboard_schemas import DashboardInfo
from superset.mcp_service.url_utils import get_superset_base_url
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


def _create_dashboard_layout(chart_objects: List[Any]) -> Dict[str, Any]:
    """
    Create a simple dashboard layout with charts arranged in a grid.

    This creates a basic 2-column layout where charts are arranged
    vertically in alternating columns.

    Args:
        chart_objects: List of Chart ORM objects (not IDs)
    """
    layout: Dict[str, Any] = {}

    # Grid configuration
    chart_width = 24  # Half width for 2-column layout
    chart_height = 16  # Standard chart height

    # Create rows for charts (simple approach: one chart per row)
    row_ids = []
    for i, chart in enumerate(chart_objects):
        row_id = f"ROW-{i}"
        row_ids.append(row_id)

        # Create chart component in layout with position data in meta
        chart_key = f"CHART-{chart.id}"
        layout[chart_key] = {
            "children": [],
            "id": chart_key,
            "meta": {
                "chartId": chart.id,
                "height": chart_height,
                "sliceName": chart.slice_name or f"Chart {chart.id}",
                "uuid": str(chart.uuid) if chart.uuid else f"chart-{chart.id}",
                "width": chart_width,
            },
            "parents": ["ROOT_ID", "GRID_ID", row_id],
            "type": "CHART",
        }

        # Create row for the chart
        layout[row_id] = {
            "children": [chart_key],
            "id": row_id,
            "meta": {"background": "BACKGROUND_TRANSPARENT"},
            "parents": ["ROOT_ID", "GRID_ID"],
            "type": "ROW",
        }

    # Add GRID container
    layout["GRID_ID"] = {
        "children": row_ids,
        "id": "GRID_ID",
        "parents": ["ROOT_ID"],
        "type": "GRID",
    }

    # Add root layout container
    layout["ROOT_ID"] = {
        "children": ["GRID_ID"],
        "id": "ROOT_ID",
        "type": "ROOT",
    }

    # Add dashboard version
    layout["DASHBOARD_VERSION_KEY"] = "v2"

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
        # Get chart objects from IDs (required for SQLAlchemy relationships)
        from superset import db
        from superset.commands.dashboard.create import CreateDashboardCommand
        from superset.models.slice import Slice

        chart_objects = (
            db.session.query(Slice).filter(Slice.id.in_(request.chart_ids)).all()
        )
        found_chart_ids = [chart.id for chart in chart_objects]

        # Check if all requested charts were found
        missing_chart_ids = set(request.chart_ids) - set(found_chart_ids)
        if missing_chart_ids:
            return GenerateDashboardResponse(
                dashboard=None,
                dashboard_url=None,
                error=f"Charts not found: {list(missing_chart_ids)}",
            )

        # Create dashboard layout with chart objects
        layout = _create_dashboard_layout(chart_objects)

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
                    "native_filter_configuration": [],
                    "global_chart_configuration": {
                        "scope": {"rootPath": ["ROOT_ID"], "excluded": []}
                    },
                    "chart_configuration": {},
                }
            ),
            "position_json": json.dumps(layout),
            "published": request.published,
            "slices": chart_objects,  # Pass ORM objects, not IDs
        }

        if request.description:
            dashboard_data["description"] = request.description

        # Create the dashboard using Superset's command pattern
        command = CreateDashboardCommand(dashboard_data)
        dashboard = command.run()

        # Convert to our response format
        from superset.mcp_service.schemas.dashboard_schemas import (
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
            url=f"{get_superset_base_url()}/superset/dashboard/{dashboard.id}/",
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

        dashboard_url = f"{get_superset_base_url()}/superset/dashboard/{dashboard.id}/"

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
