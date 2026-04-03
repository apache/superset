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
from flask import g
from superset_core.mcp.decorators import tool, ToolAnnotations

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


_DEFAULT_DASHBOARD_TITLE = "Dashboard"
_MAX_TITLE_LENGTH = 150


def _generate_title_from_charts(chart_objects: List[Any]) -> str:
    """
    Build a descriptive dashboard title from the included chart names.

    Joins up to three chart ``slice_name`` values with " & " (two charts)
    or ", " (three charts).  When there are more than three charts the
    remaining count is appended as "+ N more".  The result is capped at
    ``_MAX_TITLE_LENGTH`` characters.

    Returns ``"Dashboard"`` when *chart_objects* is empty or no chart has
    a usable name.
    """
    names = [
        c.slice_name
        for c in sorted(chart_objects, key=lambda c: getattr(c, "id", 0))
        if getattr(c, "slice_name", None)
    ]
    if not names:
        return _DEFAULT_DASHBOARD_TITLE

    if len(names) == 1:
        title = names[0]
    elif len(names) == 2:
        title = f"{names[0]} & {names[1]}"
    elif len(names) == 3:
        title = f"{names[0]}, {names[1]}, {names[2]}"
    else:
        title = f"{names[0]}, {names[1]}, {names[2]} + {len(names) - 3} more"

    if len(title) > _MAX_TITLE_LENGTH:
        title = title[: _MAX_TITLE_LENGTH - 1] + "\u2026"

    return title


@tool(
    tags=["mutate"],
    class_permission_name="Dashboard",
    annotations=ToolAnnotations(
        title="Create dashboard",
        readOnlyHint=False,
        destructiveHint=False,
    ),
)
def generate_dashboard(  # noqa: C901
    request: GenerateDashboardRequest, ctx: Context
) -> GenerateDashboardResponse:
    """Create dashboard from chart IDs.

    IMPORTANT:
    - All charts must exist and be accessible to current user
    - Charts arranged automatically in 2-column grid layout

    Returns:
    - Dashboard ID and URL
    """
    from pydantic import ValidationError
    from sqlalchemy.exc import SQLAlchemyError

    try:
        # Get chart objects from IDs (required for SQLAlchemy relationships)
        from superset import db
        from superset.models.slice import Slice

        with event_logger.log_context(action="mcp.generate_dashboard.chart_validation"):
            chart_objects = (
                db.session.query(Slice)
                .filter(Slice.id.in_(request.chart_ids))
                .order_by(Slice.id)
                .all()
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

            # Validate dataset access for each chart.
            # check_chart_data_access is the centralized data-level
            # permission check that complements the class-level RBAC
            # enforced by mcp_auth_hook.
            from superset.mcp_service.auth import check_chart_data_access

            for chart in chart_objects:
                validation = check_chart_data_access(chart)
                if not validation.is_valid:
                    return GenerateDashboardResponse(
                        dashboard=None,
                        dashboard_url=None,
                        error=(
                            f"Chart {chart.id} is not accessible: {validation.error}"
                        ),
                    )

        # Create dashboard layout with chart objects
        with event_logger.log_context(action="mcp.generate_dashboard.layout"):
            layout = _create_dashboard_layout(chart_objects)

        # Resolve dashboard title: use provided title or derive from chart names
        dashboard_title = (
            request.dashboard_title
            if request.dashboard_title is not None
            else _generate_title_from_charts(chart_objects)
        )

        # Create the dashboard directly with db.session instead of using
        # CreateDashboardCommand.  The command's @transaction decorator
        # may operate in a different SQLAlchemy scoped-session than the
        # one g.user and chart ORM objects are bound to in the MCP
        # context, causing "Object is already attached to session X
        # (this is Y)" errors.  By re-querying all ORM objects in the
        # tool's own db.session we keep everything in a single session.
        from sqlalchemy.orm import subqueryload

        from superset.models.dashboard import Dashboard

        with event_logger.log_context(action="mcp.generate_dashboard.db_write"):
            json_metadata = json.dumps(
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
            )

            try:
                dashboard = Dashboard()
                dashboard.dashboard_title = dashboard_title
                dashboard.json_metadata = json_metadata
                dashboard.position_json = json.dumps(layout)
                dashboard.published = request.published

                if request.description:
                    dashboard.description = request.description

                # Re-query the current user and charts directly in the
                # current db.session.  g.user was loaded in a Flask
                # app_context that has since been torn down (the
                # middleware's ``with flask_app.app_context()`` exits
                # before the tool function runs), so the User object
                # is bound to a dead/different scoped session.
                # Querying fresh avoids all cross-session errors.
                from superset.extensions import security_manager

                current_user = (
                    db.session.query(security_manager.user_model)
                    .filter_by(id=g.user.id)
                    .first()
                )
                if current_user:
                    dashboard.owners = [current_user]

                fresh_charts = (
                    db.session.query(Slice)
                    .filter(Slice.id.in_(request.chart_ids))
                    .order_by(Slice.id)
                    .all()
                )
                dashboard.slices = fresh_charts

                db.session.add(dashboard)
                db.session.commit()  # pylint: disable=consider-using-transaction
            except SQLAlchemyError as db_err:
                try:
                    db.session.rollback()  # pylint: disable=consider-using-transaction
                except SQLAlchemyError:
                    logger.warning(
                        "Database rollback failed during error handling",
                        exc_info=True,
                    )
                logger.error(
                    "Dashboard creation failed: %s",
                    db_err,
                    exc_info=True,
                )
                return GenerateDashboardResponse(
                    dashboard=None,
                    dashboard_url=None,
                    error="Failed to create dashboard due to a database error.",
                )

        # Re-fetch with eager-loaded relationships for serialization.
        # The preceding commit may invalidate the session in multi-tenant
        # environments, causing "Can't reconnect until invalid transaction
        # is rolled back".  Wrap the DAO re-fetch in try/except; on failure,
        # return a minimal response using only scalar attributes that are
        # already loaded — relationship fields (owners, tags, slices) would
        # trigger lazy-loading on the same dead session.
        from superset.daos.dashboard import DashboardDAO

        try:
            dashboard = (
                DashboardDAO.find_by_id(
                    dashboard.id,
                    query_options=[
                        subqueryload(Dashboard.slices).subqueryload(Slice.owners),
                        subqueryload(Dashboard.slices).subqueryload(Slice.tags),
                        subqueryload(Dashboard.owners),
                        subqueryload(Dashboard.tags),
                    ],
                )
                or dashboard
            )
        except SQLAlchemyError:
            logger.warning(
                "Re-fetch of dashboard %s failed; returning minimal response",
                dashboard.id,
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
                f"{get_superset_base_url()}/superset/dashboard/{dashboard.id}/"
            )
            return GenerateDashboardResponse(
                dashboard=DashboardInfo(
                    id=dashboard.id,
                    dashboard_title=dashboard.dashboard_title,
                    url=dashboard_url,
                    chart_count=len(request.chart_ids),
                    published=dashboard.published,
                ),
                dashboard_url=dashboard_url,
                error=None,
            )

        # Convert to our response format
        from superset.mcp_service.dashboard.schemas import (
            _serialize_chart_summary,
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
            created_by=dashboard.created_by_name or None,
            changed_by=dashboard.changed_by_name or None,
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
            charts=[
                obj
                for chart in getattr(dashboard, "slices", [])
                if (obj := _serialize_chart_summary(chart)) is not None
            ],
        )

        dashboard_url = f"{get_superset_base_url()}/superset/dashboard/{dashboard.id}/"

        logger.info(
            "Created dashboard %s with %s charts", dashboard.id, len(request.chart_ids)
        )

        return GenerateDashboardResponse(
            dashboard=dashboard_info, dashboard_url=dashboard_url, error=None
        )

    except (SQLAlchemyError, ValueError, AttributeError, ValidationError) as e:
        from superset import db

        try:
            db.session.rollback()  # pylint: disable=consider-using-transaction
        except SQLAlchemyError:
            logger.warning(
                "Database rollback failed during error handling", exc_info=True
            )
        logger.error("Error creating dashboard: %s", e, exc_info=True)
        return GenerateDashboardResponse(
            dashboard=None,
            dashboard_url=None,
            error=f"Failed to create dashboard: {str(e)}",
        )
