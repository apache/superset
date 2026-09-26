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
MCP tool: manage_dashboard_markdown

Adds, updates, and removes markdown/header/divider layout components on a
dashboard by translating high-level operations into ``position_json`` tree
edits. Analogous to ``manage_native_filters``, which does the same for the
flat native-filter list in ``json_metadata`` — this tool exists so callers
don't have to hand-build the full raw layout tree just to add a text tile
or section header (see ``generate_dashboard``'s ``position_json`` docstring).
"""

import logging
from typing import Any, Dict

from fastmcp import Context
from sqlalchemy.exc import SQLAlchemyError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import db, event_logger
from superset.mcp_service.dashboard.constants import generate_id
from superset.mcp_service.dashboard.layout_placement import (
    _collect_available_tab_names,
    _ensure_layout_structure,
    _find_next_row_position,
    _find_tab_insert_target,
    _remove_component_and_prune,
)
from superset.mcp_service.dashboard.layout_validation import (
    rebuild_parent_chains,
    validate_dashboard_layout,
)
from superset.mcp_service.dashboard.schemas import (
    DashboardComponentSummary,
    DashboardComponentUpdateSpec,
    HeaderComponentSpec,
    ManageDashboardMarkdownRequest,
    ManageDashboardMarkdownResponse,
    MarkdownComponentSpec,
    NewDashboardComponentSpec,
)
from superset.mcp_service.dashboard.tool.governance_utils import (
    dashboard_url,
    find_and_authorize_dashboard,
)
from superset.utils import json

logger = logging.getLogger(__name__)

# Maps the tool-facing discriminator to the position_json component type.
_LAYOUT_TYPE_BY_COMPONENT_TYPE: dict[str, str] = {
    "markdown": "MARKDOWN",
    "header": "HEADER",
    "divider": "DIVIDER",
}
_COMPONENT_TYPE_BY_LAYOUT_TYPE = {
    v: k for k, v in _LAYOUT_TYPE_BY_COMPONENT_TYPE.items()
}

# HEADER and DIVIDER are full-width bands placed directly on GRID/TAB — ROW
# does not accept them as children (see layout_validation._PARENT_MAX_DEPTH).
# MARKDOWN composes with charts, so it is wrapped in its own new ROW instead.
_ROW_WRAPPED_LAYOUT_TYPES = frozenset({"MARKDOWN"})


class _ComponentOperationError(Exception):
    """Raised internally when a component operation fails validation."""


def _build_component_meta(spec: NewDashboardComponentSpec) -> Dict[str, Any]:
    """Build the position_json ``meta`` object for a new component spec."""
    if isinstance(spec, MarkdownComponentSpec):
        return {"code": spec.code, "width": spec.width, "height": spec.height}
    if isinstance(spec, HeaderComponentSpec):
        return {
            "text": spec.text,
            "headerSize": spec.header_size,
            "background": spec.background,
        }
    # DividerComponentSpec carries no content, only placement.
    return {}


def _resolve_target_container(layout: Dict[str, Any], target_tab: str | None) -> str:
    """Return the GRID_ID or TAB component ID a new component should attach to.

    Raises ``_ComponentOperationError`` when *target_tab* is specified but
    does not match any tab, listing the available tabs (or noting there are
    none) so the caller can retry unambiguously.
    """
    tab_target = _find_tab_insert_target(layout, target_tab=target_tab)

    if target_tab is not None and tab_target is None:
        available = _collect_available_tab_names(layout)
        if available:
            raise _ComponentOperationError(
                f"Tab '{target_tab}' not found. Available tabs: {', '.join(available)}."
            )
        raise _ComponentOperationError(
            "Dashboard has no tabs. Remove target_tab to add to the "
            "default grid layout."
        )

    return tab_target if tab_target else "GRID_ID"


def _add_component_to_layout(
    layout: Dict[str, Any], spec: NewDashboardComponentSpec
) -> str:
    """Insert a new markdown/header/divider component into *layout*.

    Returns the new component's ID. New nodes are linked with empty
    ``parents`` — the caller rebuilds the whole tree's parent chains via
    ``rebuild_parent_chains`` after all operations are applied.
    """
    parent_id = _resolve_target_container(layout, spec.target_tab)

    layout_type = _LAYOUT_TYPE_BY_COMPONENT_TYPE[spec.component_type]
    component_id = generate_id(layout_type)
    while component_id in layout:
        component_id = generate_id(layout_type)
    layout[component_id] = {
        "id": component_id,
        "type": layout_type,
        "children": [],
        "meta": _build_component_meta(spec),
        "parents": [],
    }

    if layout_type in _ROW_WRAPPED_LAYOUT_TYPES:
        row_key = _find_next_row_position(layout)
        layout[row_key] = {
            "id": row_key,
            "type": "ROW",
            "children": [component_id],
            "meta": {"background": "BACKGROUND_TRANSPARENT"},
            "parents": [],
        }
        _ensure_layout_structure(layout, row_key, parent_id)
    else:
        _ensure_layout_structure(layout, component_id, parent_id)

    return component_id


def _apply_component_update(  # noqa: C901
    spec: DashboardComponentUpdateSpec, node: Dict[str, Any], component_type: str
) -> None:
    """Merge *spec* into *node*'s meta in place.

    Raises ``_ComponentOperationError`` when a field that only applies to a
    different component type is set.
    """
    markdown_fields = ("code", "width", "height")
    header_fields = ("text", "header_size", "background")

    if component_type != "markdown":
        if set_fields := [f for f in markdown_fields if getattr(spec, f) is not None]:
            raise _ComponentOperationError(
                f"Component '{spec.id}' has type '{component_type}'; fields "
                f"{set_fields} only apply to markdown components."
            )
    if component_type != "header":
        if set_fields := [f for f in header_fields if getattr(spec, f) is not None]:
            raise _ComponentOperationError(
                f"Component '{spec.id}' has type '{component_type}'; fields "
                f"{set_fields} only apply to header components."
            )

    meta = dict(node.get("meta") or {})
    if component_type == "markdown":
        if spec.code is not None:
            meta["code"] = spec.code
        if spec.width is not None:
            meta["width"] = spec.width
        if spec.height is not None:
            meta["height"] = spec.height
    elif component_type == "header":
        if spec.text is not None:
            meta["text"] = spec.text
        if spec.header_size is not None:
            meta["headerSize"] = spec.header_size
        if spec.background is not None:
            meta["background"] = spec.background
    node["meta"] = meta


def _apply_updates(
    layout: Dict[str, Any],
    updates: list[DashboardComponentUpdateSpec],
    existing_components: Dict[str, Dict[str, Any]],
) -> list[str]:
    """Apply every update spec in order; returns the updated component IDs."""
    update_ids = [spec.id for spec in updates]
    if duplicates := sorted({cid for cid in update_ids if update_ids.count(cid) > 1}):
        raise _ComponentOperationError(
            f"update contains duplicate component IDs: {duplicates}."
        )

    for spec in updates:
        node = existing_components.get(spec.id)
        if node is None:
            raise _ComponentOperationError(
                f"Cannot update component '{spec.id}': not a markdown/header/"
                "divider component on this dashboard."
            )
        component_type = _COMPONENT_TYPE_BY_LAYOUT_TYPE[node["type"]]
        _apply_component_update(spec, layout[spec.id], component_type)

    return update_ids


def _component_summaries(layout: Dict[str, Any]) -> list[DashboardComponentSummary]:
    """Summarize every markdown/header/divider component currently in *layout*."""
    return [
        DashboardComponentSummary(
            id=key,
            component_type=_COMPONENT_TYPE_BY_LAYOUT_TYPE[node["type"]],
            meta=node.get("meta") or {},
        )
        for key, node in layout.items()
        if key != "HEADER_ID"
        and isinstance(node, dict)
        and node.get("type") in _COMPONENT_TYPE_BY_LAYOUT_TYPE
    ]


@tool(
    tags=["mutate"],
    class_permission_name="Dashboard",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Manage dashboard markdown/header/divider components",
        readOnlyHint=False,
        destructiveHint=True,
        idempotentHint=False,
        openWorldHint=False,
    ),
)
def manage_dashboard_markdown(  # noqa: C901
    request: ManageDashboardMarkdownRequest, ctx: Context
) -> ManageDashboardMarkdownResponse:
    """
    Add, update, and remove markdown/header/divider layout components.

    Companion to ``manage_native_filters``, but for the ``position_json``
    layout tree instead of ``json_metadata``: no need to hand-craft the full
    raw layout to add a text tile or section header. Markdown tiles are
    placed in their own new row so they compose with existing chart rows;
    headers and dividers are placed as full-width bands directly on the
    target grid or tab (matching how the dashboard builder places them).

    Component IDs are server-generated and returned in the response.
    ``target_tab`` (add only) selects which tab a component lands in by
    display name or ID; omit it for the first tab, or the grid without tabs.

    Example::

        manage_dashboard_markdown(request={
            "dashboard_id": 42,
            "add": [
                {"component_type": "header", "text": "Sales"},
                {"component_type": "markdown", "code": "**Updated daily**"},
            ],
        })
    """
    logger.info(
        "Managing dashboard markdown components: dashboard_id=%s", request.dashboard_id
    )

    dashboard, auth_error = find_and_authorize_dashboard(
        request.dashboard_id, ManageDashboardMarkdownResponse
    )
    if auth_error is not None:
        return auth_error
    assert dashboard is not None  # narrows for mypy

    try:
        with event_logger.log_context(
            action="mcp.manage_dashboard_markdown.validation"
        ):
            try:
                current_layout = json.loads(dashboard.position_json or "{}")
            except (json.JSONDecodeError, TypeError):
                return ManageDashboardMarkdownResponse(
                    dashboard_id=request.dashboard_id,
                    error=(
                        f"Dashboard {request.dashboard_id} has a malformed "
                        "layout (position_json could not be parsed); cannot "
                        "safely modify it."
                    ),
                )
            if not isinstance(current_layout, dict):
                return ManageDashboardMarkdownResponse(
                    dashboard_id=request.dashboard_id,
                    error="Dashboard has a malformed layout: expected a JSON object.",
                )
            # Validate before traversing or pruning; do not repair corrupt trees
            # by silently dropping nodes. Empty dashboards can be scaffolded.
            chart_ids = [slc.id for slc in dashboard.slices]
            if current_layout:
                if error := validate_dashboard_layout(current_layout, chart_ids):
                    return ManageDashboardMarkdownResponse(
                        dashboard_id=request.dashboard_id,
                        error=f"Dashboard has a malformed layout: {error}",
                    )

            existing_components = {
                key: node
                for key, node in current_layout.items()
                if key != "HEADER_ID"
                and isinstance(node, dict)
                and node.get("type") in _COMPONENT_TYPE_BY_LAYOUT_TYPE
            }

            if unknown_removals := [
                cid for cid in request.remove if cid not in existing_components
            ]:
                return ManageDashboardMarkdownResponse(
                    dashboard_id=request.dashboard_id,
                    error=(
                        "Cannot remove components that are not markdown/"
                        f"header/divider components on this dashboard: "
                        f"{unknown_removals}."
                    ),
                )

            removed_ids = set(request.remove)
            if conflicts := sorted(
                {spec.id for spec in request.update if spec.id in removed_ids}
            ):
                return ManageDashboardMarkdownResponse(
                    dashboard_id=request.dashboard_id,
                    error=(
                        f"Components {conflicts} cannot be both updated and removed."
                    ),
                )

            try:
                updated_ids = _apply_updates(
                    current_layout, request.update, existing_components
                )

                for component_id in request.remove:
                    _remove_component_and_prune(current_layout, component_id)

                added_ids = [
                    _add_component_to_layout(current_layout, spec)
                    for spec in request.add
                ]
            except _ComponentOperationError as exc:
                return ManageDashboardMarkdownResponse(
                    dashboard_id=request.dashboard_id, error=str(exc)
                )

            # New/updated nodes may carry empty or stale ``parents``; rebuild
            # every reachable component's chain from the actual children
            # edges so filter-scope derivation sees a correct tree. See
            # superset.dashboards.filter_scope.get_chart_ids_in_scope.
            current_layout = rebuild_parent_chains(current_layout)

            if error := validate_dashboard_layout(current_layout, chart_ids):
                return ManageDashboardMarkdownResponse(
                    dashboard_id=request.dashboard_id,
                    error=f"Resulting dashboard layout is invalid: {error}",
                )

        # Capture the receipt before committing. A failed refresh leaves ORM
        # attributes expired, so reading them afterwards could mask a saved write.
        result = ManageDashboardMarkdownResponse(
            dashboard_id=dashboard.id,
            dashboard_url=dashboard_url(dashboard),
            added_component_ids=added_ids,
            updated_component_ids=updated_ids,
            removed_component_ids=list(request.remove),
            components=_component_summaries(current_layout),
        )
        with event_logger.log_context(action="mcp.manage_dashboard_markdown.db_write"):
            dashboard.position_json = json.dumps(current_layout)
            db.session.commit()  # pylint: disable=consider-using-transaction
            try:
                db.session.refresh(dashboard)
            except SQLAlchemyError:
                logger.warning(
                    "Dashboard %s updated but refresh failed; continuing",
                    request.dashboard_id,
                    exc_info=True,
                )

    except SQLAlchemyError as db_err:
        try:
            db.session.rollback()  # pylint: disable=consider-using-transaction
        except SQLAlchemyError:
            logger.warning(
                "Database rollback failed during error handling", exc_info=True
            )
        logger.error("Dashboard markdown update failed: %s", db_err, exc_info=True)
        return ManageDashboardMarkdownResponse(
            dashboard_id=request.dashboard_id,
            error="Failed to update dashboard due to a database error.",
        )
    except Exception as exc:
        logger.exception(
            "Unexpected error managing markdown components on dashboard %s: %s",
            request.dashboard_id,
            exc,
        )
        raise

    logger.info(
        "Managed dashboard markdown components on dashboard %s "
        "(added=%d updated=%d removed=%d)",
        request.dashboard_id,
        len(added_ids),
        len(updated_ids),
        len(request.remove),
    )

    return result
