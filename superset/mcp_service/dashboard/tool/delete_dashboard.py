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
"""

import logging
from typing import TYPE_CHECKING

from fastmcp import Context
from sqlalchemy.exc import SQLAlchemyError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset import is_feature_enabled
from superset.commands.dashboard.exceptions import (
    DashboardAccessDeniedError,
    DashboardDeleteFailedReportsExistError,
    DashboardForbiddenError,
    DashboardNotFoundError,
)
from superset.commands.exceptions import CommandException
from superset.extensions import event_logger
from superset.mcp_service.dashboard.schemas import (
    DeleteDashboardRequest,
    DeleteDashboardResponse,
)
from superset.mcp_service.utils import (
    escape_llm_context_delimiters,
    sanitize_for_llm_context,
)

if TYPE_CHECKING:
    from superset.models.dashboard import Dashboard

logger = logging.getLogger(__name__)


def _find_dashboard_by_identifier(identifier: int | str) -> "Dashboard | None":
    """Resolve a dashboard by numeric ID, UUID string, or slug. Returns None."""
    from superset.daos.dashboard import DashboardDAO

    if isinstance(identifier, int) or (
        isinstance(identifier, str) and identifier.isdigit()
    ):
        return DashboardDAO.find_by_id(int(identifier))
    # Try UUID, then fall back to slug.
    dashboard = DashboardDAO.find_by_id(identifier, id_column="uuid")
    if dashboard:
        return dashboard
    try:
        return DashboardDAO.get_by_id_or_slug(identifier)
    except DashboardNotFoundError:
        return None


def _rollback() -> None:
    """Best-effort session rollback so a failed delete cannot poison the
    request's transaction; rollback failures are logged, not raised."""
    from superset import db

    try:
        db.session.rollback()  # pylint: disable=consider-using-transaction
    except SQLAlchemyError:
        logger.warning(
            "Database rollback failed during delete_dashboard error handling"
        )


def _routes_to_soft_delete() -> bool:
    """Mirror the ``BaseDAO.delete`` routing predicate so the response can
    report whether the row was trashed (restorable) or permanently removed."""
    from superset.models.dashboard import Dashboard
    from superset.models.helpers import SoftDeleteMixin

    return issubclass(Dashboard, SoftDeleteMixin) and is_feature_enabled("SOFT_DELETE")


@tool(
    tags=["mutate"],
    class_permission_name="Dashboard",
    annotations=ToolAnnotations(
        title="Delete dashboard",
        readOnlyHint=False,
        destructiveHint=True,
    ),
)
async def delete_dashboard(
    request: DeleteDashboardRequest, ctx: Context
) -> DeleteDashboardResponse:
    """Delete a dashboard.

    Identify the dashboard by numeric ID, UUID string, or slug. When the
    ``SOFT_DELETE`` feature flag is enabled the dashboard is moved to trash and
    can be restored by an owner or Admin; otherwise the delete is permanent and
    cannot be undone. The ``soft_deleted`` response field reports which
    happened. It removes the dashboard container only — the charts on it are
    NOT deleted. The caller must be an editor of the dashboard (owners and
    Admins qualify); dashboards with attached alerts/reports cannot be
    deleted until those are removed.

    Example:
    ```json
    {"identifier": 42}
    ```

    Returns success with the deleted dashboard's id/title, or an error. When the
    caller lacks permission, ``permission_denied`` is true — do not retry; ask
    the user.
    """
    await ctx.info("Deleting dashboard: identifier=%s" % (request.identifier,))

    try:
        dashboard = _find_dashboard_by_identifier(request.identifier)
    except DashboardAccessDeniedError:
        # get_by_id_or_slug re-checks view access and raises access-denied for
        # dashboards the caller cannot see; surface it as the structured
        # permission_denied response instead of an unhandled error.
        await ctx.warning("Access denied resolving dashboard identifier for delete")
        return DeleteDashboardResponse(
            success=False,
            permission_denied=True,
            error=(
                "You do not have permission to access this dashboard. "
                "Ask the user to delete it or grant access; do not retry."
            ),
            error_type="Forbidden",
        )
    except SQLAlchemyError:
        _rollback()
        logger.exception("Dashboard lookup failed during delete_dashboard")
        return DeleteDashboardResponse(
            success=False,
            error="Dashboard lookup failed due to a database error.",
            error_type="LookupFailed",
        )
    if not dashboard:
        safe_id = escape_llm_context_delimiters(str(request.identifier)[:200])
        msg = (
            f"No dashboard found with identifier: {safe_id}. "
            "Use list_dashboards to get valid dashboard IDs."
        )
        return DeleteDashboardResponse(success=False, error=msg, error_type="NotFound")

    dashboard_id = dashboard.id
    # Dashboard titles are user-controlled; wrap before composing responses.
    dashboard_name = sanitize_for_llm_context(
        dashboard.dashboard_title, field_path=("dashboard_title",)
    )

    # The try/except sits inside log_context so failed attempts (forbidden,
    # reports-exist, db errors) are recorded in the audit log too — the
    # context manager does not log when an exception propagates through it.
    with event_logger.log_context(action="mcp.delete_dashboard"):
        try:
            from superset.commands.dashboard.delete import DeleteDashboardCommand

            DeleteDashboardCommand([dashboard_id]).run()

            soft_deleted = _routes_to_soft_delete()
            if soft_deleted:
                message = (
                    f"Moved dashboard '{dashboard_name}' (id={dashboard_id}) to "
                    "trash; it can be restored by an owner or Admin. Its charts "
                    "were not deleted."
                )
            else:
                message = (
                    f"Permanently deleted dashboard '{dashboard_name}' "
                    f"(id={dashboard_id}). Its charts were not deleted."
                )
            return DeleteDashboardResponse(
                success=True,
                deleted_id=dashboard_id,
                deleted_name=dashboard_name,
                soft_deleted=soft_deleted,
                message=message,
            )
        except DashboardForbiddenError:
            await ctx.warning(
                "Permission denied deleting dashboard id=%s" % (dashboard_id,)
            )
            return DeleteDashboardResponse(
                success=False,
                permission_denied=True,
                error=(
                    f"You do not have permission to delete dashboard "
                    f"'{dashboard_name}' (id={dashboard_id}). Ask the user to "
                    "delete it or grant access; do not retry."
                ),
                error_type="Forbidden",
            )
        except DashboardDeleteFailedReportsExistError as ex:
            _rollback()
            return DeleteDashboardResponse(
                success=False,
                error=(
                    f"Dashboard '{dashboard_name}' (id={dashboard_id}) cannot be "
                    f"deleted: {ex}. Remove the associated alerts/reports first."
                ),
                error_type="ReportsExist",
            )
        except DashboardNotFoundError:
            msg = f"Dashboard id={dashboard_id} no longer exists."
            return DeleteDashboardResponse(
                success=False, error=msg, error_type="NotFound"
            )
        except (CommandException, SQLAlchemyError, ValueError) as ex:
            _rollback()
            await ctx.error("Dashboard delete failed: %s: %s" % (type(ex).__name__, ex))
            # Raw SQLAlchemy text can leak SQL or connection details; command
            # and validation messages are user-facing by design.
            if isinstance(ex, SQLAlchemyError):
                client_error = "Dashboard delete failed due to a database error."
            else:
                client_error = f"Dashboard delete failed: {ex}"
            return DeleteDashboardResponse(
                success=False,
                error=client_error,
                error_type=type(ex).__name__,
            )
