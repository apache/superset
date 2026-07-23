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
MCP tool: restore_dashboard
"""

import logging
from typing import Any

from fastmcp import Context
from sqlalchemy.exc import SQLAlchemyError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.commands.dashboard.exceptions import (
    DashboardForbiddenError,
    DashboardNotFoundError,
)
from superset.commands.exceptions import CommandException
from superset.extensions import event_logger
from superset.mcp_service.dashboard.schemas import (
    RestoreDashboardRequest,
    RestoreDashboardResponse,
)
from superset.mcp_service.utils import (
    escape_llm_context_delimiters,
    sanitize_for_llm_context,
)

logger = logging.getLogger(__name__)


def _find_dashboard_for_restore(identifier: int | str) -> Any | None:
    """Resolve a dashboard by numeric ID or UUID, including soft-deleted rows.

    Both bypasses mirror ``BaseRestoreCommand.validate``'s own lookup:
    ``skip_visibility_filter`` unhides the soft-deleted row, and
    ``skip_base_filter`` keeps an editor's own trash reachable even when the
    entity's RBAC base_filter has no editorship leg (a lost grant must not
    hide a row from the one audience that can restore it). The restore
    audience is enforced by ``RestoreDashboardCommand`` via
    ``raise_for_editorship``.
    """
    from superset.daos.dashboard import DashboardDAO

    return DashboardDAO.find_by_id_or_uuid(
        str(identifier),
        skip_base_filter=True,
        skip_visibility_filter=True,
    )


def _rollback() -> None:
    from superset import db

    try:
        db.session.rollback()  # pylint: disable=consider-using-transaction
    except SQLAlchemyError:
        logger.warning(
            "Database rollback failed during restore_dashboard error handling"
        )


@tool(
    tags=["mutate"],
    class_permission_name="Dashboard",
    annotations=ToolAnnotations(
        title="Restore dashboard",
        readOnlyHint=False,
        destructiveHint=False,
    ),
)
async def restore_dashboard(
    request: RestoreDashboardRequest, ctx: Context
) -> RestoreDashboardResponse:
    """Restore a soft-deleted dashboard from trash.

    Identify the dashboard by numeric ID or UUID string (slug lookup does not
    cover trashed dashboards). Only dashboards that were soft-deleted (moved
    to trash while the ``SOFT_DELETE`` feature flag was enabled) can be
    restored; permanently deleted dashboards are unrecoverable. The caller
    must be an editor of the dashboard (owners and Admins qualify).

    Example:
    ```json
    {"identifier": 42}
    ```

    Returns success with the restored dashboard's id/title, or an error. When
    the caller lacks permission, ``permission_denied`` is true — do not retry;
    ask the user.
    """
    await ctx.info("Restoring dashboard: identifier=%s" % (request.identifier,))

    try:
        dashboard = _find_dashboard_for_restore(request.identifier)
    except SQLAlchemyError:
        _rollback()
        logger.exception("Dashboard lookup failed during restore_dashboard")
        return RestoreDashboardResponse(
            success=False,
            error="Dashboard lookup failed due to a database error.",
            error_type="LookupFailed",
        )
    if not dashboard:
        safe_id = escape_llm_context_delimiters(str(request.identifier)[:200])
        msg = f"No dashboard found with identifier: {safe_id}."
        return RestoreDashboardResponse(success=False, error=msg, error_type="NotFound")

    dashboard_id = dashboard.id
    # Dashboard titles are user-controlled; wrap before composing response
    # text so a hostile title cannot inject prompt content into the output.
    dashboard_name = sanitize_for_llm_context(
        dashboard.dashboard_title, field_path=("dashboard_title",)
    )

    if dashboard.deleted_at is None:
        return RestoreDashboardResponse(
            success=False,
            error=(
                f"Dashboard '{dashboard_name}' (id={dashboard_id}) is not in "
                "trash; nothing to restore."
            ),
            error_type="NotDeleted",
        )

    # The try/except sits inside log_context so failed restore attempts are
    # recorded in the audit log too — the context manager does not log when
    # an exception propagates through it.
    with event_logger.log_context(action="mcp.restore_dashboard"):
        try:
            from superset.commands.dashboard.restore import RestoreDashboardCommand

            RestoreDashboardCommand(str(dashboard.uuid)).run()

            return RestoreDashboardResponse(
                success=True,
                restored_id=dashboard_id,
                restored_name=dashboard_name,
                message=(
                    f"Restored dashboard '{dashboard_name}' "
                    f"(id={dashboard_id}) from trash."
                ),
            )
        except DashboardForbiddenError:
            await ctx.warning(
                "Permission denied restoring dashboard id=%s" % (dashboard_id,)
            )
            return RestoreDashboardResponse(
                success=False,
                permission_denied=True,
                error=(
                    f"You do not have permission to restore dashboard "
                    f"'{dashboard_name}' (id={dashboard_id}). Ask the user to "
                    "restore it or grant access; do not retry."
                ),
                error_type="Forbidden",
            )
        except DashboardNotFoundError:
            msg = f"Dashboard id={dashboard_id} is no longer restorable."
            return RestoreDashboardResponse(
                success=False, error=msg, error_type="NotFound"
            )
        except (CommandException, SQLAlchemyError, ValueError) as ex:
            _rollback()
            await ctx.error(
                "Dashboard restore failed: %s: %s" % (type(ex).__name__, ex)
            )
            return RestoreDashboardResponse(
                success=False,
                # Raw SQLAlchemy text can leak SQL or connection details; command
                # and validation messages are user-facing by design.
                error=(
                    "Dashboard restore failed due to a database error."
                    if isinstance(ex, SQLAlchemyError)
                    else f"Dashboard restore failed: {ex}"
                ),
                error_type=type(ex).__name__,
            )
