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
MCP tool: duplicate_dashboard

Duplicates an existing dashboard, optionally deep-copying its charts.
Canonical workflow: clone a template dashboard, then edit the copy
(e.g. to create a regional or staging variant).
"""

import logging
from typing import Any

from fastmcp import Context
from sqlalchemy.exc import SQLAlchemyError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.dashboard.schemas import (
    _sanitize_dashboard_info_for_llm_context,
    DashboardInfo,
    DuplicateDashboardRequest,
    DuplicateDashboardResponse,
    serialize_chart_summary,
)
from superset.mcp_service.privacy import user_can_view_data_model_metadata
from superset.mcp_service.utils.url_utils import get_superset_base_url
from superset.utils import json

logger = logging.getLogger(__name__)


def _positions_reference_charts(positions: dict[str, Any]) -> bool:
    """Return whether a layout maps any chart into the dashboard.

    ``DashboardDAO.set_dash_metadata`` rebuilds the new dashboard's slice
    list solely from the chart IDs found in ``positions``, so a layout
    with no ``CHART`` entries yields an empty dashboard regardless of the
    source's ``slices`` relationship.
    """
    return any(
        isinstance(value, dict)
        and value.get("type") == "CHART"
        and value.get("meta", {}).get("chartId")
        for value in positions.values()
    )


def _build_copy_payload(
    source: Any, dashboard_title: str, duplicate_slices: bool
) -> tuple[dict[str, Any], bool]:
    """Build the data payload expected by ``CopyDashboardCommand``.

    Mirrors what the frontend "Save as" flow sends to the
    ``/api/v1/dashboard/<id>/copy/`` endpoint: the source dashboard's
    current ``json_metadata`` with a ``positions`` key holding the current
    layout (``position_json``). ``DashboardCopySchema`` requires
    ``json_metadata``, and ``DashboardDAO.copy_dashboard`` reads
    ``positions`` from it to remap chart IDs when ``duplicate_slices``
    is enabled.

    Returns the payload and a flag indicating whether the layout maps any
    chart, so the caller can refuse to produce a silently empty copy.
    """
    try:
        metadata = json.loads(source.json_metadata or "{}")
    except (json.JSONDecodeError, TypeError):
        metadata = {}
    if not isinstance(metadata, dict):
        metadata = {}

    try:
        positions = json.loads(source.position_json or "{}")
    except (json.JSONDecodeError, TypeError):
        positions = {}
    if not isinstance(positions, dict):
        positions = {}

    metadata["positions"] = positions

    payload = {
        "dashboard_title": dashboard_title,
        "css": source.css,
        "duplicate_slices": duplicate_slices,
        "json_metadata": json.dumps(metadata),
    }
    return payload, _positions_reference_charts(positions)


def _serialize_new_dashboard(dashboard: Any) -> tuple[DashboardInfo, str]:
    """Build the response ``DashboardInfo`` and URL for the new dashboard."""
    from superset.mcp_service.dashboard.schemas import serialize_tag_object

    dashboard_url = f"{get_superset_base_url()}/superset/dashboard/{dashboard.id}/"
    include_data_model_metadata = user_can_view_data_model_metadata()
    info = DashboardInfo(
        id=dashboard.id,
        dashboard_title=dashboard.dashboard_title,
        slug=dashboard.slug,
        description=dashboard.description,
        published=dashboard.published,
        created_on=dashboard.created_on,
        changed_on=dashboard.changed_on,
        uuid=str(dashboard.uuid) if dashboard.uuid else None,
        url=dashboard_url,
        chart_count=len(dashboard.slices),
        tags=[
            obj
            for tag in getattr(dashboard, "tags", [])
            if (obj := serialize_tag_object(tag)) is not None
        ],
        charts=[
            obj
            for chart in getattr(dashboard, "slices", [])
            if (
                obj := serialize_chart_summary(
                    chart,
                    include_data_model_metadata=include_data_model_metadata,
                )
            )
            is not None
        ],
    )
    return _sanitize_dashboard_info_for_llm_context(info), dashboard_url


@tool(
    tags=["mutate"],
    class_permission_name="Dashboard",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Duplicate dashboard",
        readOnlyHint=False,
        destructiveHint=False,
    ),
)
async def duplicate_dashboard(
    request: DuplicateDashboardRequest, ctx: Context
) -> DuplicateDashboardResponse:
    """
    Duplicate an existing dashboard under a new title.

    By default the copy references the same charts as the source.
    Set duplicate_slices=true to also deep-copy every chart into new
    chart objects owned by you, so edits to the copies never affect
    the originals.

    The source dashboard can be identified by numeric ID, UUID, or slug.
    Returns the new dashboard's ID, title, and URL.
    """
    await ctx.info(
        "Duplicating dashboard: dashboard_id=%s, duplicate_slices=%s"
        % (request.dashboard_id, request.duplicate_slices)
    )

    from superset.commands.dashboard.copy import CopyDashboardCommand
    from superset.commands.dashboard.exceptions import (
        DashboardAccessDeniedError,
        DashboardCopyError,
        DashboardForbiddenError,
        DashboardInvalidError,
        DashboardNotFoundError,
    )
    from superset.daos.dashboard import DashboardDAO

    try:
        with event_logger.log_context(action="mcp.duplicate_dashboard.lookup"):
            try:
                source = DashboardDAO.get_by_id_or_slug(str(request.dashboard_id))
            except DashboardNotFoundError:
                await ctx.warning(
                    "Dashboard not found for duplication: dashboard_id=%s"
                    % (request.dashboard_id,)
                )
                return DuplicateDashboardResponse(
                    error=(
                        f"Dashboard '{request.dashboard_id}' not found. "
                        "Use list_dashboards to get valid dashboard IDs."
                    ),
                )
            except DashboardAccessDeniedError:
                await ctx.warning(
                    "Dashboard access denied for duplication: dashboard_id=%s"
                    % (request.dashboard_id,)
                )
                return DuplicateDashboardResponse(
                    error=(
                        f"You don't have access to dashboard "
                        f"'{request.dashboard_id}', so it cannot be duplicated."
                    ),
                )

        data, layout_has_charts = _build_copy_payload(
            source, request.dashboard_title, request.duplicate_slices
        )

        if getattr(source, "slices", None) and not layout_has_charts:
            await ctx.warning(
                "Source layout maps no charts; refusing to duplicate to "
                "avoid an empty copy: dashboard_id=%s" % (request.dashboard_id,)
            )
            return DuplicateDashboardResponse(
                error=(
                    f"Dashboard '{request.dashboard_id}' has charts but its "
                    "saved layout is missing or invalid, so duplicating it "
                    "would produce a dashboard with no charts. Open and "
                    "re-save the source dashboard to repair its layout, then "
                    "try again."
                ),
            )

        with event_logger.log_context(action="mcp.duplicate_dashboard.copy"):
            new_dashboard = CopyDashboardCommand(source, data).run()

        # Re-fetch with eager-loaded relationships to avoid lazy-loading on
        # a session that the command's commit may have invalidated.
        from sqlalchemy.orm import subqueryload

        from superset.models.dashboard import Dashboard
        from superset.models.slice import Slice

        try:
            new_dashboard = (
                DashboardDAO.find_by_id(
                    new_dashboard.id,
                    query_options=[
                        subqueryload(Dashboard.slices).subqueryload(Slice.tags),
                        subqueryload(Dashboard.tags),
                    ],
                )
                or new_dashboard
            )
            info, dashboard_url = _serialize_new_dashboard(new_dashboard)
        except SQLAlchemyError:
            logger.warning(
                "Re-fetch of dashboard %s failed; returning minimal response",
                new_dashboard.id,
                exc_info=True,
            )
            dashboard_url = (
                f"{get_superset_base_url()}/superset/dashboard/{new_dashboard.id}/"
            )
            info = _sanitize_dashboard_info_for_llm_context(
                DashboardInfo(
                    id=new_dashboard.id,
                    dashboard_title=request.dashboard_title,
                    url=dashboard_url,
                )
            )

        logger.info(
            "Duplicated dashboard %s into dashboard %s (duplicate_slices=%s)",
            request.dashboard_id,
            new_dashboard.id,
            request.duplicate_slices,
        )

        return DuplicateDashboardResponse(
            dashboard=info,
            dashboard_url=dashboard_url,
            duplicated_slices=request.duplicate_slices,
            warnings=list(request.sanitization_warnings),
        )

    except DashboardForbiddenError:
        await ctx.error(
            "Dashboard duplication forbidden: dashboard_id=%s" % (request.dashboard_id,)
        )
        return DuplicateDashboardResponse(
            error=(
                f"You don't have permission to duplicate dashboard "
                f"'{request.dashboard_id}'."
            ),
        )
    except DashboardInvalidError:
        return DuplicateDashboardResponse(
            error=(
                "Dashboard duplication parameters were invalid. "
                "Provide a non-empty dashboard_title."
            ),
        )
    except DashboardCopyError as exc:
        from superset import db

        try:
            db.session.rollback()  # pylint: disable=consider-using-transaction
        except SQLAlchemyError:
            logger.warning(
                "Database rollback failed during error handling", exc_info=True
            )
        await ctx.error("Dashboard duplication failed: %s" % (str(exc),))
        return DuplicateDashboardResponse(
            error=f"Failed to duplicate dashboard: {exc}",
        )
    except Exception as exc:
        await ctx.error(
            "Unexpected error duplicating dashboard: %s: %s"
            % (type(exc).__name__, str(exc))
        )
        raise
