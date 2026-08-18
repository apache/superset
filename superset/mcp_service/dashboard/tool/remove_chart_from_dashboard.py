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
MCP tool: remove_chart_from_dashboard

This tool removes a chart from an existing dashboard. It is the inverse of
add_chart_to_existing_dashboard: it deletes the chart's CHART component(s)
from position_json (pruning ROW/COLUMN containers that become empty),
removes the chart from the dashboard's slices relationship, and cleans
stale references to the chart from json_metadata (expanded_slices,
timed_refresh_immune_slices, filter_scopes, default_filters).
"""

import logging
from typing import Any, Dict

from fastmcp import Context
from sqlalchemy.exc import SQLAlchemyError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.commands.exceptions import CommandException, ForbiddenError
from superset.extensions import event_logger
from superset.mcp_service.dashboard.schemas import (
    DashboardInfo,
    RemoveChartFromDashboardRequest,
    RemoveChartFromDashboardResponse,
    serialize_chart_summary,
)
from superset.mcp_service.privacy import user_can_view_data_model_metadata
from superset.mcp_service.utils.url_utils import get_superset_base_url
from superset.utils import json

logger = logging.getLogger(__name__)

# Container types that should be deleted once they have no children left.
# TAB/TABS/GRID/ROOT containers are intentionally kept even when empty —
# deleting a TAB would silently change the dashboard's visible structure.
_PRUNABLE_TYPES = ("ROW", "COLUMN")


def _find_chart_keys(layout: Dict[str, Any], chart_id: int) -> list[str]:
    """Return all layout keys of CHART components referencing *chart_id*.

    A chart can legitimately appear more than once in a layout (e.g. under
    multiple tabs), so all occurrences are returned.
    """
    # Accept both int and string chartId — position_json is user/frontend-authored
    # and imported or hand-edited layouts may store chartId as a string.
    return [
        key
        for key, node in layout.items()
        if isinstance(node, dict)
        and node.get("type") == "CHART"
        and (node.get("meta") or {}).get("chartId") in (chart_id, str(chart_id))
    ]


def _find_parent_key(layout: Dict[str, Any], component_key: str) -> str | None:
    """Find the component whose children list contains *component_key*.

    The reverse lookup scans children lists instead of trusting the
    ``parents`` metadata on the node, which can be stale in hand-edited or
    programmatically generated layouts.
    """
    for key, node in layout.items():
        if not isinstance(node, dict):
            continue
        children = node.get("children")
        if isinstance(children, list) and component_key in children:
            return key
    return None


def _remove_component_and_prune(
    layout: Dict[str, Any], component_key: str
) -> list[str]:
    """Remove *component_key* from the layout and prune empty containers.

    Walks up the parent chain deleting ROW/COLUMN containers that become
    empty as a result of the removal, so no orphaned wrapper nodes are left
    behind. Returns the list of removed layout keys.
    """
    removed: list[str] = []
    parent_key = _find_parent_key(layout, component_key)

    layout.pop(component_key, None)
    removed.append(component_key)

    child_key = component_key
    while parent_key is not None:
        parent = layout.get(parent_key)
        if not isinstance(parent, dict):
            break
        children = parent.get("children")
        if isinstance(children, list):
            parent["children"] = [c for c in children if c != child_key]
        if parent.get("type") in _PRUNABLE_TYPES and not parent.get("children"):
            grandparent_key = _find_parent_key(layout, parent_key)
            layout.pop(parent_key, None)
            removed.append(parent_key)
            child_key = parent_key
            parent_key = grandparent_key
        else:
            break

    return removed


def _remove_chart_from_layout(layout: Dict[str, Any], chart_id: int) -> list[str]:
    """Remove every CHART component for *chart_id* from the layout.

    Returns all removed layout keys (charts plus pruned containers).
    """
    removed: list[str] = []
    for chart_key in _find_chart_keys(layout, chart_id):
        # The chart key may already be gone if it shared a pruned container.
        if chart_key in layout:
            removed.extend(_remove_component_and_prune(layout, chart_key))
    return removed


def _remove_id_from_list(values: Any, chart_id: int) -> tuple[Any, bool]:
    """Return (new_list, changed) with *chart_id* removed from a list of IDs.

    Handles both int and str representations since json_metadata is
    user/frontend-authored and not strictly typed.
    """
    if not isinstance(values, list):
        return values, False
    filtered = [v for v in values if v != chart_id and v != str(chart_id)]
    return filtered, len(filtered) != len(values)


def _clean_filter_scopes(filter_scopes: Dict[str, Any], chart_id: int) -> bool:
    """Remove *chart_id* from filter_scopes and prune per-column immune lists.

    Mutates *filter_scopes* in place. Returns True if anything changed.
    """
    changed = False
    if (chart_key := str(chart_id)) in filter_scopes:
        del filter_scopes[chart_key]
        changed = True
    for column_scopes in filter_scopes.values():
        if not isinstance(column_scopes, dict):
            continue
        for column_config in column_scopes.values():
            if not isinstance(column_config, dict):
                continue
            immune, immune_changed = _remove_id_from_list(
                column_config.get("immune"), chart_id
            )
            if immune_changed:
                column_config["immune"] = immune
                changed = True
    return changed


def _clean_default_filters(metadata: Dict[str, Any], chart_key: str) -> bool:
    """Remove *chart_key* from ``default_filters`` and re-serialize to a JSON string.

    ``default_filters`` is normally a JSON-encoded string; this function also
    tolerates the case where it has already been decoded to a dict.  Returns
    True if anything changed.
    """
    default_filters_raw = metadata.get("default_filters")
    if isinstance(default_filters_raw, str):
        try:
            default_filters = json.loads(default_filters_raw)
            if isinstance(default_filters, dict) and chart_key in default_filters:
                del default_filters[chart_key]
                metadata["default_filters"] = json.dumps(default_filters)
                return True
        except (json.JSONDecodeError, TypeError):
            pass
    elif isinstance(default_filters_raw, dict) and chart_key in default_filters_raw:
        del default_filters_raw[chart_key]
        # Re-serialize so downstream readers that call json.loads on this field
        # continue to receive a string rather than a Python dict.
        metadata["default_filters"] = json.dumps(default_filters_raw)
        return True
    return False


def _clean_json_metadata(metadata: Dict[str, Any], chart_id: int) -> bool:
    """Remove stale references to *chart_id* from a json_metadata dict.

    Cleans ``expanded_slices`` (dict keyed by chart ID), ``filter_scopes``
    (dict keyed by filter chart ID, with per-column ``immune`` ID lists),
    ``timed_refresh_immune_slices`` (list of chart IDs), and
    ``default_filters`` (a JSON-encoded string whose keys are chart IDs).
    Mutates *metadata* in place and returns True when anything changed.
    """
    changed = False
    chart_key = str(chart_id)

    expanded_slices = metadata.get("expanded_slices")
    if isinstance(expanded_slices, dict) and chart_key in expanded_slices:
        del expanded_slices[chart_key]
        changed = True

    immune_slices, immune_changed = _remove_id_from_list(
        metadata.get("timed_refresh_immune_slices"), chart_id
    )
    if immune_changed:
        metadata["timed_refresh_immune_slices"] = immune_slices
        changed = True

    filter_scopes = metadata.get("filter_scopes")
    if isinstance(filter_scopes, dict):
        changed |= _clean_filter_scopes(filter_scopes, chart_id)

    if _clean_default_filters(metadata, chart_key):
        changed = True

    return changed


def _find_and_authorize_dashboard(
    dashboard_id: int,
) -> tuple[Any, RemoveChartFromDashboardResponse | None]:
    """Return (dashboard, None) on success or (None, error_response) on failure.

    Handles both the not-found case and the editorship check so the main tool
    function doesn't need two separate branches for these pre-conditions.
    """
    from superset import security_manager
    from superset.daos.dashboard import DashboardDAO
    from superset.exceptions import SupersetSecurityException

    dashboard = DashboardDAO.find_by_id(dashboard_id)
    if not dashboard:
        return None, RemoveChartFromDashboardResponse(
            dashboard=None,
            dashboard_url=None,
            error=(
                f"Dashboard with ID {dashboard_id} not found."
                " Use list_dashboards to get valid dashboard IDs."
            ),
        )

    try:
        security_manager.raise_for_editorship(dashboard)
    except SupersetSecurityException:
        return None, RemoveChartFromDashboardResponse(
            dashboard=None,
            dashboard_url=None,
            permission_denied=True,
            error=(
                f"You don't have permission to edit dashboard "
                f"'{dashboard.dashboard_title}' (ID: {dashboard_id}). "
                "Inform the user and do not attempt a workaround without "
                "their confirmation."
            ),
        )

    return dashboard, None


@tool(
    tags=["mutate"],
    class_permission_name="Dashboard",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Remove chart from dashboard",
        readOnlyHint=False,
        destructiveHint=True,
    ),
)
def remove_chart_from_dashboard(  # noqa: C901 — complexity is structural (layout traversal + multi-step authorization), not accidental
    request: RemoveChartFromDashboardRequest, ctx: Context
) -> RemoveChartFromDashboardResponse:
    """
    Remove a chart from an existing dashboard.

    Deletes the chart's layout component(s) from the dashboard (all
    occurrences, including under tabs), prunes rows/columns left empty by
    the removal, detaches the chart from the dashboard, and cleans stale
    chart references from dashboard metadata (expanded_slices,
    timed_refresh_immune_slices, filter_scopes, default_filters). The chart
    itself is NOT deleted and remains available to other dashboards.
    """
    try:
        from superset import db
        from superset.commands.dashboard.update import UpdateDashboardCommand

        # Validate dashboard exists and user has edit permission
        with event_logger.log_context(
            action="mcp.remove_chart_from_dashboard.validation"
        ):
            dashboard, auth_error = _find_and_authorize_dashboard(request.dashboard_id)
            if auth_error is not None:
                return auth_error

        # Remove the chart from the layout tree
        with event_logger.log_context(action="mcp.remove_chart_from_dashboard.layout"):
            try:
                current_layout = json.loads(dashboard.position_json or "{}")
            except (json.JSONDecodeError, TypeError):
                return RemoveChartFromDashboardResponse(
                    dashboard=None,
                    dashboard_url=None,
                    error=(
                        f"Dashboard {request.dashboard_id} has a malformed layout "
                        "(position_json could not be parsed); cannot safely remove "
                        "a chart from it."
                    ),
                )
            if not isinstance(current_layout, dict):
                current_layout = {}

            remaining_slices = [
                slc for slc in dashboard.slices if slc.id != request.chart_id
            ]
            chart_in_slices = len(remaining_slices) != len(dashboard.slices)

            removed_keys = _remove_chart_from_layout(current_layout, request.chart_id)

            if not removed_keys and not chart_in_slices:
                return RemoveChartFromDashboardResponse(
                    dashboard=None,
                    dashboard_url=None,
                    error=(
                        f"Chart {request.chart_id} is not in dashboard "
                        f"{request.dashboard_id}. Use get_dashboard_info to "
                        "see which charts the dashboard contains."
                    ),
                )

        # Update the dashboard
        with event_logger.log_context(
            action="mcp.remove_chart_from_dashboard.db_write"
        ):
            update_data: dict[str, Any] = {
                "position_json": json.dumps(current_layout),
                "slices": remaining_slices,  # Pass ORM objects, not IDs
            }

            command = UpdateDashboardCommand(request.dashboard_id, update_data)
            updated_dashboard = command.run()

        # Re-fetch the dashboard with eager-loaded relationships to avoid
        # "Instance is not bound to a Session" errors when serializing
        # chart tags.  The preceding command.run() commit may
        # invalidate the session in multi-tenant environments; on failure,
        # return a minimal response using only scalar attributes that are
        # already loaded — relationship fields (tags, slices) would
        # trigger lazy-loading on the same dead session.
        from sqlalchemy.orm import subqueryload

        from superset.daos.dashboard import DashboardDAO
        from superset.models.dashboard import Dashboard
        from superset.models.slice import Slice

        try:
            updated_dashboard = (
                DashboardDAO.find_by_id(
                    updated_dashboard.id,
                    query_options=[
                        subqueryload(Dashboard.slices).subqueryload(Slice.tags),
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
            try:
                db.session.rollback()  # pylint: disable=consider-using-transaction
            except SQLAlchemyError:
                logger.warning(
                    "Database rollback failed during dashboard re-fetch error handling",
                    exc_info=True,
                )
            dashboard_url = (
                f"{get_superset_base_url()}/dashboard/{updated_dashboard.id}/"
            )
            return RemoveChartFromDashboardResponse(
                dashboard=DashboardInfo(
                    id=updated_dashboard.id,
                    dashboard_title=updated_dashboard.dashboard_title,
                    published=updated_dashboard.published,
                    created_on=updated_dashboard.created_on,
                    changed_on=updated_dashboard.changed_on,
                    chart_count=len(remaining_slices),
                    url=dashboard_url,
                ),
                dashboard_url=dashboard_url,
                removed_layout_keys=removed_keys,
                error=None,
            )

        # Clean stale chart references from json_metadata without routing
        # through UpdateDashboardCommand: that path calls
        # DashboardDAO.set_dash_metadata which, when "positions" is
        # present in the metadata blob, overwrites dashboard.slices from
        # layout data and silently drops charts attached via the slices
        # relationship but absent from position_json.
        #
        # Read from the re-fetched dashboard so cleanup is applied to the
        # latest persisted state rather than the pre-command snapshot,
        # avoiding silent overwrites of concurrent metadata edits.
        try:
            metadata = json.loads(updated_dashboard.json_metadata or "{}")
        except (json.JSONDecodeError, TypeError):
            metadata = None
        metadata_changed = isinstance(metadata, dict) and _clean_json_metadata(
            metadata, request.chart_id
        )

        # Best-effort secondary write: the chart has already been removed from
        # layout and slices (committed above). If this commit fails, log a
        # warning but return success — stale metadata is preferable to
        # reporting failure after a successful removal.
        if metadata_changed and isinstance(metadata, dict):
            from superset import db

            try:
                updated_dashboard.json_metadata = json.dumps(metadata)
                db.session.commit()  # pylint: disable=consider-using-transaction
            except SQLAlchemyError:
                logger.warning(
                    "json_metadata cleanup commit failed for dashboard %s after "
                    "removing chart %s; chart removal succeeded",
                    request.dashboard_id,
                    request.chart_id,
                    exc_info=True,
                )
                try:
                    db.session.rollback()  # pylint: disable=consider-using-transaction
                except SQLAlchemyError:
                    logger.warning(
                        "Rollback failed during json_metadata cleanup", exc_info=True
                    )

        # Convert to response format
        from superset.mcp_service.dashboard.schemas import (
            serialize_tag_object,
        )

        include_data_model_metadata = user_can_view_data_model_metadata()
        dashboard_info = DashboardInfo(
            id=updated_dashboard.id,
            dashboard_title=updated_dashboard.dashboard_title,
            slug=updated_dashboard.slug,
            description=updated_dashboard.description,
            published=updated_dashboard.published,
            created_on=updated_dashboard.created_on,
            changed_on=updated_dashboard.changed_on,
            uuid=str(updated_dashboard.uuid) if updated_dashboard.uuid else None,
            url=f"{get_superset_base_url()}/dashboard/{updated_dashboard.id}/",
            chart_count=len(updated_dashboard.slices),
            tags=[
                serialize_tag_object(tag)
                for tag in getattr(updated_dashboard, "tags", [])
                if serialize_tag_object(tag) is not None
            ],
            charts=[
                obj
                for chart in getattr(updated_dashboard, "slices", [])
                if (
                    obj := serialize_chart_summary(
                        chart,
                        include_data_model_metadata=include_data_model_metadata,
                    )
                )
                is not None
            ],
        )

        dashboard_url = f"{get_superset_base_url()}/dashboard/{updated_dashboard.id}/"

        logger.info(
            "Removed chart %s from dashboard %s",
            request.chart_id,
            request.dashboard_id,
        )

        return RemoveChartFromDashboardResponse(
            dashboard=dashboard_info,
            dashboard_url=dashboard_url,
            removed_layout_keys=removed_keys,
            error=None,
        )

    except ForbiddenError as e:
        from superset import db

        try:
            db.session.rollback()  # pylint: disable=consider-using-transaction
        except SQLAlchemyError:
            logger.warning(
                "Database rollback failed during error handling", exc_info=True
            )
        logger.error("Permission denied removing chart from dashboard: %s", e)
        return RemoveChartFromDashboardResponse(
            dashboard=None,
            dashboard_url=None,
            removed_layout_keys=[],
            permission_denied=True,
            error=f"Permission denied: {str(e)}",
        )

    except (CommandException, SQLAlchemyError, KeyError, ValueError) as e:
        from superset import db

        try:
            db.session.rollback()  # pylint: disable=consider-using-transaction
        except SQLAlchemyError:
            logger.warning(
                "Database rollback failed during error handling", exc_info=True
            )
        logger.error("Error removing chart from dashboard: %s", e)
        return RemoveChartFromDashboardResponse(
            dashboard=None,
            dashboard_url=None,
            removed_layout_keys=[],
            permission_denied=False,
            error=f"Failed to remove chart from dashboard: {str(e)}",
        )
