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
MCP tool: delete_dashboard

This tool deletes a dashboard. It requires an explicit ``confirm=true``
safety gate so callers must state destructive intent. When the
``SOFT_DELETE`` feature flag is enabled the dashboard is soft-deleted and
recoverable via ``undelete_dashboard``; otherwise the delete is permanent.
"""

import logging

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.dashboard.schemas import (
    DeleteDashboardRequest,
    DeleteDashboardResponse,
    DeletedDashboardSummary,
)

logger = logging.getLogger(__name__)


@tool(
    tags=["mutate"],
    class_permission_name="Dashboard",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Delete dashboard",
        readOnlyHint=False,
        destructiveHint=True,
    ),
)
async def delete_dashboard(
    request: DeleteDashboardRequest, ctx: Context
) -> DeleteDashboardResponse:
    """
    Delete a dashboard by ID. The charts on the dashboard are NOT deleted —
    only the dashboard itself. The tool refuses to run unless
    ``confirm=true`` is explicitly passed. The response's ``permanent``
    field reports whether the delete was a recoverable soft delete
    (restore with ``undelete_dashboard``) or a permanent hard delete.
    """
    from superset import is_feature_enabled
    from superset.commands.dashboard.delete import DeleteDashboardCommand
    from superset.commands.dashboard.exceptions import (
        DashboardDeleteFailedError,
        DashboardForbiddenError,
        DashboardNotFoundError,
    )
    from superset.daos.dashboard import DashboardDAO

    soft_delete_enabled = is_feature_enabled("SOFT_DELETE")

    if not request.confirm:
        await ctx.warning(
            "Deletion of dashboard %s not confirmed" % (request.dashboard_id,)
        )
        recovery_note = (
            "The dashboard can be restored afterwards with undelete_dashboard."
            if soft_delete_enabled
            else "The deletion is permanent and cannot be undone."
        )
        return DeleteDashboardResponse(
            deleted=False,
            permanent=False,
            dashboard=None,
            error=(
                f"Deletion not confirmed. This will delete dashboard "
                f"{request.dashboard_id}. {recovery_note} "
                "Re-run with confirm=true to proceed."
            ),
        )

    summary: DeletedDashboardSummary | None = None
    try:
        with event_logger.log_context(action="mcp.delete_dashboard.validation"):
            dashboard = DashboardDAO.find_by_id(request.dashboard_id)
            if not dashboard:
                return DeleteDashboardResponse(
                    deleted=False,
                    permanent=False,
                    dashboard=None,
                    error=(
                        f"Dashboard with ID {request.dashboard_id} not found. "
                        "Use list_dashboards to get valid dashboard IDs."
                    ),
                )
            summary = DeletedDashboardSummary(
                id=dashboard.id,
                dashboard_title=dashboard.dashboard_title,
                slug=dashboard.slug,
                uuid=str(dashboard.uuid) if dashboard.uuid else None,
            )

        with event_logger.log_context(action="mcp.delete_dashboard.delete"):
            DeleteDashboardCommand([request.dashboard_id]).run()

        logger.info("Deleted dashboard %s", request.dashboard_id)
        await ctx.info("Deleted dashboard %s" % (request.dashboard_id,))
        return DeleteDashboardResponse(
            deleted=True,
            permanent=not soft_delete_enabled,
            dashboard=summary,
            error=None,
        )

    except DashboardNotFoundError:
        return DeleteDashboardResponse(
            deleted=False,
            permanent=False,
            dashboard=None,
            error=(
                f"Dashboard with ID {request.dashboard_id} not found. "
                "Use list_dashboards to get valid dashboard IDs."
            ),
        )

    except DashboardForbiddenError:
        await ctx.warning(
            "Permission denied deleting dashboard %s" % (request.dashboard_id,)
        )
        return DeleteDashboardResponse(
            deleted=False,
            permanent=False,
            dashboard=summary,
            error=(
                f"You don't have permission to delete dashboard "
                f"with ID {request.dashboard_id}."
            ),
        )

    except DashboardDeleteFailedError as exc:
        await ctx.error(
            "Failed to delete dashboard %s: %s" % (request.dashboard_id, str(exc))
        )
        return DeleteDashboardResponse(
            deleted=False,
            permanent=False,
            dashboard=summary,
            error=f"Failed to delete dashboard {request.dashboard_id}: {exc.message}",
        )

    except Exception as exc:
        await ctx.error(
            "Unexpected error deleting dashboard: %s: %s"
            % (type(exc).__name__, str(exc))
        )
        raise
