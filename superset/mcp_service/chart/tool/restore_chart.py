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
MCP tool: restore_chart
"""

import logging
from typing import Any

from fastmcp import Context
from sqlalchemy.exc import SQLAlchemyError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.commands.chart.exceptions import (
    ChartForbiddenError,
    ChartNotFoundError,
)
from superset.commands.exceptions import CommandException
from superset.extensions import event_logger
from superset.mcp_service.chart.schemas import (
    RestoreChartRequest,
    RestoreChartResponse,
)
from superset.mcp_service.utils import (
    escape_llm_context_delimiters,
    sanitize_for_llm_context,
)

logger = logging.getLogger(__name__)


def _find_chart_for_restore(identifier: int | str) -> Any | None:
    """Resolve a chart by numeric ID or UUID, including soft-deleted rows.

    Both bypasses mirror ``BaseRestoreCommand.validate``'s own lookup:
    ``skip_visibility_filter`` unhides the soft-deleted row, and
    ``skip_base_filter`` keeps an editor's own trash reachable even when the
    entity's RBAC base_filter has no editorship leg (a lost grant must not
    hide a row from the one audience that can restore it). The restore
    audience is enforced by ``RestoreChartCommand`` via
    ``raise_for_editorship``.
    """
    from superset.daos.chart import ChartDAO

    return ChartDAO.find_by_id_or_uuid(
        str(identifier),
        skip_base_filter=True,
        skip_visibility_filter=True,
    )


def _rollback() -> None:
    from superset import db

    try:
        db.session.rollback()  # pylint: disable=consider-using-transaction
    except SQLAlchemyError:
        logger.warning("Database rollback failed during restore_chart error handling")


@tool(
    tags=["mutate"],
    class_permission_name="Chart",
    annotations=ToolAnnotations(
        title="Restore chart",
        readOnlyHint=False,
        destructiveHint=False,
    ),
)
async def restore_chart(
    request: RestoreChartRequest, ctx: Context
) -> RestoreChartResponse:
    """Restore a soft-deleted chart from trash.

    Identify the chart by numeric ID or UUID string (NOT chart name). Only
    charts that were soft-deleted (moved to trash while the ``SOFT_DELETE``
    feature flag was enabled) can be restored; permanently deleted charts are
    unrecoverable. The caller must be an editor of the chart (owners and
    Admins qualify).

    Example:
    ```json
    {"identifier": 123}
    ```

    Returns success with the restored chart's id/name, or an error. When the
    caller lacks permission, ``permission_denied`` is true — do not retry; ask
    the user.
    """
    await ctx.info("Restoring chart: identifier=%s" % (request.identifier,))

    try:
        chart = _find_chart_for_restore(request.identifier)
    except SQLAlchemyError:
        _rollback()
        logger.exception("Chart lookup failed during restore_chart")
        return RestoreChartResponse(
            success=False,
            error="Chart lookup failed due to a database error.",
            error_type="LookupFailed",
        )
    if not chart:
        safe_id = escape_llm_context_delimiters(str(request.identifier)[:200])
        msg = f"No chart found with identifier: {safe_id}."
        return RestoreChartResponse(success=False, error=msg, error_type="NotFound")

    chart_id = chart.id
    # Chart names are user-controlled; wrap before composing response text so
    # a hostile name cannot inject prompt content into the tool output.
    chart_name = sanitize_for_llm_context(chart.slice_name, field_path=("slice_name",))

    if chart.deleted_at is None:
        return RestoreChartResponse(
            success=False,
            error=(
                f"Chart '{chart_name}' (id={chart_id}) is not in trash; "
                "nothing to restore."
            ),
            error_type="NotDeleted",
        )

    # The try/except sits inside log_context so failed restore attempts are
    # recorded in the audit log too — the context manager does not log when
    # an exception propagates through it.
    with event_logger.log_context(action="mcp.restore_chart"):
        try:
            from superset.commands.chart.restore import RestoreChartCommand

            RestoreChartCommand(str(chart.uuid)).run()

            return RestoreChartResponse(
                success=True,
                restored_id=chart_id,
                restored_name=chart_name,
                message=f"Restored chart '{chart_name}' (id={chart_id}) from trash.",
            )
        except ChartForbiddenError:
            await ctx.warning("Permission denied restoring chart id=%s" % (chart_id,))
            return RestoreChartResponse(
                success=False,
                permission_denied=True,
                error=(
                    f"You do not have permission to restore chart '{chart_name}' "
                    f"(id={chart_id}). Ask the user to restore it or grant access; "
                    "do not retry."
                ),
                error_type="Forbidden",
            )
        except ChartNotFoundError:
            msg = f"Chart id={chart_id} is no longer restorable."
            return RestoreChartResponse(success=False, error=msg, error_type="NotFound")
        except (CommandException, SQLAlchemyError, ValueError) as ex:
            _rollback()
            await ctx.error("Chart restore failed: %s: %s" % (type(ex).__name__, ex))
            return RestoreChartResponse(
                success=False,
                # Raw SQLAlchemy text can leak SQL or connection details; command
                # and validation messages are user-facing by design.
                error=(
                    "Chart restore failed due to a database error."
                    if isinstance(ex, SQLAlchemyError)
                    else f"Chart restore failed: {ex}"
                ),
                error_type=type(ex).__name__,
            )
