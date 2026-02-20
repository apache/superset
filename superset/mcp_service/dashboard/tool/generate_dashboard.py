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
from typing import Any, Dict, List

from fastmcp import Context
from superset_core.mcp import tool

from superset.extensions import event_logger
from superset.mcp_service.dashboard.constants import (
    generate_id,
    GRID_COLUMN_COUNT,
    GRID_DEFAULT_CHART_WIDTH,
)
from superset.mcp_service.dashboard.schemas import (
    DashboardInfo,
    GenerateDashboardRequest,
    GenerateDashboardResponse,
)
from superset.mcp_service.utils.schema_utils import parse_request
from superset.mcp_service.utils.url_utils import get_superset_base_url
from superset.utils import json

logger = logging.getLogger(__name__)


def _create_dashboard_layout(chart_objects: List[Any]) -> Dict[str, Any]:
    """
    Create a simple dashboard layout with charts arranged in a grid.

    This creates a ``ROW > COLUMN > CHART`` hierarchy for each row,
    matching the component structure that the Superset frontend expects.

    Args:
        chart_objects: List of Chart ORM objects (not IDs)
    """
    layout: Dict[str, Any] = {}

    # Grid configuration based on real Superset dashboard patterns
    # Use 2-chart rows with medium-sized charts (like existing dashboards)
    charts_per_row = 2
    chart_width = GRID_DEFAULT_CHART_WIDTH
    chart_height = 50  # Good height for most chart types

    # Create rows with charts wrapped in columns
    row_ids = []
    for i in range(0, len(chart_objects), charts_per_row):
        row_id = generate_id("ROW")
        row_ids.append(row_id)

        # Get charts for this row (up to 2 charts like real dashboards)
        row_charts = chart_objects[i : i + charts_per_row]
        column_keys = []

        # Calculate column width: divide grid evenly among charts in this row
        col_width = GRID_COLUMN_COUNT // len(row_charts)

        for chart in row_charts:
            chart_key = f"CHART-{chart.id}"
            column_key = generate_id("COLUMN")
            column_keys.append(column_key)

            # Create chart component with standard dimensions
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
                "parents": ["ROOT_ID", "GRID_ID", row_id, column_key],
                "type": "CHART",
            }

            # Create column wrapper for the chart (ROW > COLUMN > CHART)
            layout[column_key] = {
                "children": [chart_key],
                "id": column_key,
                "meta": {
                    "background": "BACKGROUND_TRANSPARENT",
                    "width": col_width,
                },
                "parents": ["ROOT_ID", "GRID_ID", row_id],
                "type": "COLUMN",
            }

        # Create row containing the columns
        layout[row_id] = {
            "children": column_keys,
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


@tool(tags=["mutate"])
@parse_request(GenerateDashboardRequest)
def generate_dashboard(
    request: GenerateDashboardRequest, ctx: Context
) -> GenerateDashboardResponse:
    """Create dashboard from chart IDs.

    IMPORTANT:
    - All charts must exist and be accessible to current user
    - Charts arranged automatically in 2-column grid layout

    Returns:
    - Dashboard ID and URL
    """
    try:
        # Get chart objects from IDs (required for SQLAlchemy relationships)
        from superset import db
        from superset.commands.dashboard.create import CreateDashboardCommand
        from superset.models.slice import Slice

        with event_logger.log_context(action="mcp.generate_dashboard.chart_validation"):
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
        with event_logger.log_context(action="mcp.generate_dashboard.layout"):
            layout = _create_dashboard_layout(chart_objects)

        # Prepare dashboard data and create dashboard
        with event_logger.log_context(action="mcp.generate_dashboard.db_write"):
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
                            "scope": {
                                "rootPath": ["ROOT_ID"],
                                "excluded": [],
                            }
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
        from superset.mcp_service.dashboard.schemas import (
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
            "Created dashboard %s with %s charts", dashboard.id, len(request.chart_ids)
        )

        return GenerateDashboardResponse(
            dashboard=dashboard_info, dashboard_url=dashboard_url, error=None
        )

    except Exception as e:
        logger.error("Error creating dashboard: %s", e)
        return GenerateDashboardResponse(
            dashboard=None,
            dashboard_url=None,
            error=f"Failed to create dashboard: {str(e)}",
        )
