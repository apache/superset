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
Get dashboard layout FastMCP tool

Companion to get_dashboard_info: returns the parsed dashboard layout
(tabs and chart positions) extracted from position_json. Use this
when get_dashboard_info's omitted_fields hint indicates position_json
was stripped and structured layout data is needed for analysis.
"""

import logging
from datetime import datetime, timezone

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.dashboard.permalink import (
    get_matching_dashboard_permalink_state,
    lookup_dashboard_reference,
)
from superset.mcp_service.dashboard.schemas import (
    dashboard_layout_serializer,
    DashboardError,
    DashboardLayout,
    DashboardLayoutScope,
    DashboardTab,
    DashboardTabSummary,
    GetDashboardLayoutRequest,
)
from superset.mcp_service.mcp_core import ModelGetInfoCore

logger = logging.getLogger(__name__)


def _resolve_tab(
    tabs: list[DashboardTab], selector: str
) -> DashboardTab | DashboardError:
    """Match a tab by ID first, then by exact title."""
    if not selector.strip():
        return DashboardError.create(
            "tab must not be blank. Omit tab for the full layout or use "
            "tabs_only=true to discover tab IDs and titles.",
            "tab_not_found",
        )
    if not tabs:
        return DashboardError.create(
            "This dashboard has no tabs. Omit tab to get the full layout.",
            "tab_not_found",
        )
    matches = [tab for tab in tabs if tab.id == selector] or [
        tab for tab in tabs if tab.name == selector
    ]
    if not matches:
        return DashboardError.create(
            "Tab not found. Use tabs_only=true to discover tab IDs and titles.",
            "tab_not_found",
        )
    if len(matches) > 1:
        return DashboardError.create(
            "Multiple tabs have that title. Use tabs_only=true to discover "
            "their IDs, then pass a unique tab ID.",
            "ambiguous_tab",
        )
    return matches[0]


def _subtree_ids(tab_id: str, children: dict[str | None, list[str]]) -> set[str]:
    """Return a tab ID and the IDs of every tab nested under it."""
    selected_ids: set[str] = set()
    pending = [tab_id]
    while pending:
        current = pending.pop()
        if current not in selected_ids:
            selected_ids.add(current)
            pending.extend(children.get(current, []))
    return selected_ids


def _tab_summaries(
    tabs: list[DashboardTab], children: dict[str | None, list[str]]
) -> list[DashboardTabSummary]:
    """Summarize tabs with absolute depths from the full dashboard tree."""
    # The parser only emits reachable tabs and assigns each tab a single
    # enclosing parent, so walking from the top-level tabs reaches every tab.
    depths: dict[str, int] = {}
    stack = [(tab_id, 0) for tab_id in children.get(None, [])]
    while stack:
        tab_id, depth = stack.pop()
        depths[tab_id] = depth
        stack.extend((child, depth + 1) for child in children.get(tab_id, []))
    return [
        DashboardTabSummary(
            id=tab.id,
            name=tab.name,
            parent_tab_id=tab.parent_tab_id,
            depth=depths[tab.id],
            chart_count=len(tab.chart_ids),
        )
        for tab in tabs
    ]


def _scope_layout(
    layout: DashboardLayout, request: GetDashboardLayoutRequest
) -> DashboardLayout | DashboardError:
    """Project the parsed layout without changing permalink or ancestry context.

    Scoping only ever removes tabs and chart placements from the parsed layout,
    so a scoped response never contains a chart the full layout would not.
    """
    if request.untabbed_only and (request.tabs_only or request.tab is not None):
        return DashboardError.create(
            "untabbed_only cannot be combined with tab or tabs_only. "
            "Drop tab and tabs_only to retrieve charts outside every tab, "
            "or drop untabbed_only to use a tab scope.",
            "invalid_scope",
        )

    if not request.tabs_only and request.tab is None and not request.untabbed_only:
        return layout

    if request.untabbed_only:
        return layout.model_copy(
            update={
                "tabs": [],
                "charts": [chart for chart in layout.charts if chart.tab_id is None],
                "scope": DashboardLayoutScope(untabbed_only=True),
            }
        )

    tabs = layout.tabs
    if request.tabs_only and not tabs:
        return DashboardError.create(
            "This dashboard has no tabs. Use untabbed_only=true without tab "
            "or tabs_only to get charts outside every tab, or omit the scope "
            "options to get the full layout.",
            "tab_not_found",
        )
    children: dict[str | None, list[str]] = {}
    for tab in tabs:
        children.setdefault(tab.parent_tab_id, []).append(tab.id)

    selected_tab_id: str | None = None
    if request.tab is not None:
        selected = _resolve_tab(tabs, request.tab)
        if isinstance(selected, DashboardError):
            return selected
        selected_tab_id = selected.id
        subtree_ids = _subtree_ids(selected.id, children)
        tabs = [tab for tab in tabs if tab.id in subtree_ids]

    scope = DashboardLayoutScope(tabs_only=request.tabs_only, tab_id=selected_tab_id)
    if request.tabs_only:
        return layout.model_copy(
            update={
                "tabs": [],
                "tab_tree": _tab_summaries(tabs, children),
                "charts": [],
                "scope": scope,
            }
        )

    selected_ids: set[str] = {tab.id for tab in tabs}
    return layout.model_copy(
        update={
            "tabs": tabs,
            "charts": [
                chart for chart in layout.charts if chart.tab_id in selected_ids
            ],
            "scope": scope,
        }
    )


@tool(
    tags=["discovery"],
    class_permission_name="Dashboard",
    annotations=ToolAnnotations(
        title="Get dashboard layout",
        readOnlyHint=True,
        destructiveHint=False,
        openWorldHint=False,
    ),
)
async def get_dashboard_layout(
    request: GetDashboardLayoutRequest, ctx: Context
) -> DashboardLayout | DashboardError:
    """
    Get parsed dashboard layout by ID, UUID, slug, or dashboard permalink.

    Returns the tabs and chart positions extracted from the dashboard's
    position_json. get_dashboard_info omits position_json to keep responses
    small; call this tool when you need the structured layout (e.g. to
    explain which charts live under which tab, or to locate a chart by
    its parent tab).

    For large dashboards, pass ``tabs_only=true`` to discover the complete tab
    tree with nesting depths and descendant chart counts, without chart positions.
    Then pass ``tab="<ID or exact title>"`` to retrieve only that tab's subtree
    and chart positions. IDs take precedence; duplicate titles require an ID.
    Combine both options to summarize a subtree. Pass ``untabbed_only=true``
    for charts outside every tab.
    Parent IDs and tab paths remain relative to the full dashboard, and
    permalink state is preserved unchanged.

    If the user gives you a shared URL containing ``/dashboard/p/<key>/``, pass
    the URL or bare key as ``identifier`` (or use ``permalink_key`` alone). The
    response identifies the active tab and includes the shared filter state.

    Example usage:
    ```json
    {
        "identifier": 123
    }
    ```
    """
    await ctx.info("Retrieving dashboard layout: identifier=%s" % (request.identifier,))

    try:
        from superset.daos.dashboard import DashboardDAO

        # No eager loading: the layout serializer only reads position_json
        # (plus id/title/uuid), so Dashboard.slices is never accessed.
        with event_logger.log_context(action="mcp.get_dashboard_layout.lookup"):
            core = ModelGetInfoCore(
                dao_class=DashboardDAO,
                output_schema=DashboardLayout,
                error_schema=DashboardError,
                serializer=dashboard_layout_serializer,
                supports_slug=True,
                logger=logger,
            )
            lookup_result = lookup_dashboard_reference(
                identifier=request.identifier,
                permalink_key=request.permalink_key,
                lookup=core.run_tool,
                is_found=lambda value: isinstance(value, DashboardLayout),
            )
            result = lookup_result.result
            if result is None:
                # Only reachable when the dashboard had to come from a permalink,
                # so an identifier's own "not found" error is preserved below.
                return DashboardError.create(
                    "Dashboard permalink could not be resolved. It may be invalid "
                    "or expired; ask for a fresh shared dashboard link.",
                    "permalink_not_found",
                )

        if isinstance(result, DashboardLayout):
            if lookup_result.permalink_value:
                permalink_state = get_matching_dashboard_permalink_state(
                    lookup_result, result.id, result.uuid
                )
                if permalink_state:
                    payload = result.model_dump(mode="python")
                    payload.update(
                        permalink_key=permalink_state.key,
                        filter_state=permalink_state.state,
                        is_permalink_state=True,
                    )
                    result = DashboardLayout.model_validate(payload)
                else:
                    await ctx.warning(
                        "permalink_key belongs to a different dashboard; ignoring "
                        "its active-tab and filter state."
                    )
            result = _scope_layout(result, request)

        if isinstance(result, DashboardLayout):
            await ctx.info(
                "Dashboard layout retrieved: id=%s, tab_count=%s, chart_count=%s, "
                "untabbed_chart_count=%s, has_layout=%s, scope=%s"
                % (
                    result.id,
                    len(result.tab_tree) if request.tabs_only else len(result.tabs),
                    len(result.charts),
                    result.untabbed_chart_count,
                    result.has_layout,
                    result.scope.model_dump() if result.scope else None,
                )
            )
        else:
            await ctx.warning(
                "Dashboard layout retrieval failed: error_type=%s, error=%s"
                % (result.error_type, result.error)
            )

        return result

    except Exception as e:
        await ctx.error(
            "Dashboard layout retrieval failed: identifier=%s, error=%s, "
            "error_type=%s" % (request.identifier, str(e), type(e).__name__)
        )
        return DashboardError(
            error=f"Failed to get dashboard layout: {str(e)}",
            error_type="InternalError",
            timestamp=datetime.now(timezone.utc),
        )
