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
MCP tool: undelete_dashboard

This tool restores a soft-deleted dashboard by clearing its ``deleted_at``
timestamp. It is the recovery path for ``delete_dashboard`` when the
``SOFT_DELETE`` feature flag is enabled; hard-deleted dashboards cannot be
restored.
"""

import logging

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.dashboard.schemas import (
    DeletedDashboardSummary,
    UndeleteDashboardRequest,
    UndeleteDashboardResponse,
)

logger = logging.getLogger(__name__)


@tool(
    tags=["mutate"],
    class_permission_name="Dashboard",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Undelete dashboard",
        readOnlyHint=False,
        destructiveHint=False,
    ),
)
async def undelete_dashboard(
    request: UndeleteDashboardRequest, ctx: Context
) -> UndeleteDashboardResponse:
    """
    Restore a soft-deleted dashboard by ID, making it visible and usable
    again. Only dashboards deleted while soft delete was enabled can be
    restored; hard-deleted dashboards are gone permanently.
    """
    from superset.commands.dashboard.exceptions import (
        DashboardForbiddenError,
        DashboardNotFoundError,
        DashboardRestoreFailedError,
        DashboardSlugConflictError,
    )
    from superset.commands.dashboard.restore import RestoreDashboardCommand
    from superset.daos.dashboard import DashboardDAO

    summary: DeletedDashboardSummary | None = None
    try:
        with event_logger.log_context(action="mcp.undelete_dashboard.validation"):
            # Skip the visibility filter so the soft-deleted row is findable,
            # and the base filter so an owner's own trash stays reachable;
            # RestoreDashboardCommand re-checks ownership before restoring.
            dashboard = DashboardDAO.find_by_id(
                request.dashboard_id,
                skip_base_filter=True,
                skip_visibility_filter=True,
            )
            if not dashboard:
                return UndeleteDashboardResponse(
                    restored=False,
                    dashboard=None,
                    error=(
                        f"Dashboard with ID {request.dashboard_id} not found. "
                        "Hard-deleted dashboards cannot be restored."
                    ),
                )
            summary = DeletedDashboardSummary(
                id=dashboard.id,
                dashboard_title=dashboard.dashboard_title,
                slug=dashboard.slug,
                uuid=str(dashboard.uuid) if dashboard.uuid else None,
            )
            if dashboard.deleted_at is None:
                return UndeleteDashboardResponse(
                    restored=False,
                    dashboard=summary,
                    error=(
                        f"Dashboard with ID {request.dashboard_id} is not "
                        "deleted; nothing to restore."
                    ),
                )

        with event_logger.log_context(action="mcp.undelete_dashboard.restore"):
            RestoreDashboardCommand(str(dashboard.uuid)).run()

        logger.info("Restored dashboard %s", request.dashboard_id)
        await ctx.info("Restored dashboard %s" % (request.dashboard_id,))
        return UndeleteDashboardResponse(restored=True, dashboard=summary, error=None)

    except DashboardNotFoundError:
        return UndeleteDashboardResponse(
            restored=False,
            dashboard=summary,
            error=(
                f"Dashboard with ID {request.dashboard_id} not found. "
                "Hard-deleted dashboards cannot be restored."
            ),
        )

    except DashboardForbiddenError:
        await ctx.warning(
            "Permission denied restoring dashboard %s" % (request.dashboard_id,)
        )
        return UndeleteDashboardResponse(
            restored=False,
            dashboard=summary,
            error=(
                f"You don't have permission to restore dashboard "
                f"with ID {request.dashboard_id}. Only owners or admins "
                "can restore a deleted dashboard."
            ),
        )

    except DashboardSlugConflictError:
        return UndeleteDashboardResponse(
            restored=False,
            dashboard=summary,
            error=(
                f"Dashboard with ID {request.dashboard_id} cannot be restored "
                "because its slug is now used by another active dashboard. "
                "Rename or delete the dashboard currently using the slug, "
                "then retry."
            ),
        )

    except DashboardRestoreFailedError as exc:
        await ctx.error(
            "Failed to restore dashboard %s: %s" % (request.dashboard_id, str(exc))
        )
        return UndeleteDashboardResponse(
            restored=False,
            dashboard=summary,
            error=(
                f"Failed to restore dashboard {request.dashboard_id}: {exc.message}"
            ),
        )

    except Exception as exc:
        await ctx.error(
            "Unexpected error restoring dashboard: %s: %s"
            % (type(exc).__name__, str(exc))
        )
        raise
