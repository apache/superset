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
import re
from typing import Any, Dict

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.chart.schemas import serialize_chart_object
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

# Compiled regex for stripping common emoji Unicode ranges from tab text.
# Uses specific Unicode blocks to avoid overly permissive ranges.
_EMOJI_RE = re.compile(
    "["
    "\U0001f300-\U0001f5ff"  # Misc Symbols and Pictographs
    "\U0001f600-\U0001f64f"  # Emoticons
    "\U0001f680-\U0001f6ff"  # Transport and Map Symbols
    "\U0001f900-\U0001f9ff"  # Supplemental Symbols and Pictographs
    "\U0001fa70-\U0001faff"  # Symbols and Pictographs Extended-A
    "\u2600-\u26ff"  # Misc Symbols
    "\u2700-\u27bf"  # Dingbats
    "\ufe00-\ufe0f"  # Variation Selectors
    "\u200d"  # Zero-width joiner
    "]+"
)


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


def _normalize_tab_text(text: str | None) -> str:
    """Strip emoji and extra whitespace from tab text for flexible matching."""
    if not text:
        return ""
    cleaned = _EMOJI_RE.sub("", text)
    return cleaned.strip().lower()


def _match_tab_in_children(
    layout: Dict[str, Any],
    tabs_children: list[str],
    target_tab: str,
) -> str | None:
    """Search tabs_children for a tab matching target_tab by ID or name.

    Matching is flexible: exact ID match, exact text match, or
    case-insensitive text match after stripping emoji characters.
    """
    target_normalized = _normalize_tab_text(target_tab)
    for tab_id in tabs_children:
        tab = layout.get(tab_id)
        if not tab or tab.get("type") != "TAB":
            continue
        tab_text = (tab.get("meta") or {}).get("text", "")
        # Exact match on ID or text
        if target_tab in (tab_id, tab_text):
            return tab_id
        # Flexible match: case-insensitive, emoji-stripped
        if target_normalized and _normalize_tab_text(tab_text) == target_normalized:
            return tab_id
    return None


def _collect_tabs_groups(layout: Dict[str, Any]) -> list[list[str]]:
    """Collect all TABS groups from ROOT_ID and GRID_ID children.

    Superset dashboards can place TABS under either ROOT_ID or GRID_ID
    depending on how the layout was constructed.
    """
    groups: list[list[str]] = []
    for parent_key in ("ROOT_ID", "GRID_ID"):
        parent = layout.get(parent_key)
        if not parent:
            continue
        for child_id in parent.get("children", []):
            child = layout.get(child_id)
            if not child or child.get("type") != "TABS":
                continue
            tabs_children = child.get("children", [])
            if tabs_children:
                groups.append(tabs_children)
    return groups


def _first_tab_from_groups(
    layout: Dict[str, Any], groups: list[list[str]]
) -> str | None:
    """Return the first valid TAB ID from the collected groups."""
    for tabs_children in groups:
        first_tab_id = tabs_children[0]
        first_tab = layout.get(first_tab_id)
        if first_tab and first_tab.get("type") == "TAB":
            return first_tab_id
    return None


def _find_tab_insert_target(
    layout: Dict[str, Any], target_tab: str | None = None
) -> str | None:
    """
    Detect if the dashboard uses tabs and return the appropriate tab's ID.

    If *target_tab* is provided the function first tries to match it against
    tab ``meta.text`` (display name) or the raw component ID.  When no match
    is found (or *target_tab* is ``None``) the first ``TAB`` child is used as
    a fallback so that new rows are still placed inside the tab structure
    rather than directly under ``GRID_ID``.

    Returns:
        The ID of the matched (or first) TAB component, or ``None`` if the
        dashboard does not use top-level tabs.
    """
    groups = _collect_tabs_groups(layout)

    if target_tab:
        for tabs_children in groups:
            matched = _match_tab_in_children(layout, tabs_children, target_tab)
            if matched:
                return matched

    return _first_tab_from_groups(layout, groups)


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


@tool(
    tags=["mutate"],
    class_permission_name="Dashboard",
    annotations=ToolAnnotations(
        title="Add chart to dashboard",
        readOnlyHint=False,
        destructiveHint=False,
    ),
)
@parse_request(AddChartToDashboardRequest)
def add_chart_to_existing_dashboard(
    request: AddChartToDashboardRequest, ctx: Context
) -> AddChartToDashboardResponse:
    """
    Add chart to existing dashboard. Auto-positions in 2-column grid.
    Returns updated dashboard info.
    """
    from sqlalchemy.exc import SQLAlchemyError

    from superset.commands.exceptions import CommandException

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

            # Detect tabbed dashboards and resolve target_tab by name or ID
            tab_target = _find_tab_insert_target(
                current_layout, target_tab=request.target_tab
            )
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

        # Re-fetch the dashboard with eager-loaded relationships to avoid
        # "Instance is not bound to a Session" errors when serializing
        # chart .tags and .owners.  The preceding command.run() commit may
        # invalidate the session in multi-tenant environments; on failure,
        # return a minimal response using only scalar attributes that are
        # already loaded — relationship fields (owners, tags, slices) would
        # trigger lazy-loading on the same dead session.
        from sqlalchemy.orm import subqueryload

        from superset.models.dashboard import Dashboard
        from superset.models.slice import Slice

        try:
            updated_dashboard = (
                DashboardDAO.find_by_id(
                    updated_dashboard.id,
                    query_options=[
                        subqueryload(Dashboard.slices).subqueryload(Slice.owners),
                        subqueryload(Dashboard.slices).subqueryload(Slice.tags),
                        subqueryload(Dashboard.owners),
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
            db.session.rollback()
            dashboard_url = (
                f"{get_superset_base_url()}/superset/dashboard/"
                f"{updated_dashboard.id}/"
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
                    url=dashboard_url,
                ),
                dashboard_url=dashboard_url,
                position=position_info,
                error=None,
            )

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
            created_by=updated_dashboard.created_by_name or None,
            changed_by=updated_dashboard.changed_by_name or None,
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
            charts=[
                obj
                for chart in getattr(updated_dashboard, "slices", [])
                if (obj := serialize_chart_object(chart)) is not None
            ],
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

    except (CommandException, SQLAlchemyError, KeyError, ValueError) as e:
        logger.error("Error adding chart to dashboard: %s", e)
        return AddChartToDashboardResponse(
            dashboard=None,
            dashboard_url=None,
            position=None,
            error=f"Failed to add chart to dashboard: {str(e)}",
        )
