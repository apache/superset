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
MCP tool: delete_chart
"""

import logging

from fastmcp import Context
from sqlalchemy.exc import SQLAlchemyError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset import is_feature_enabled
from superset.commands.chart.exceptions import (
    ChartDeleteFailedReportsExistError,
    ChartForbiddenError,
    ChartNotFoundError,
)
from superset.commands.exceptions import CommandException
from superset.extensions import event_logger
from superset.mcp_service.chart.chart_helpers import find_chart_by_identifier
from superset.mcp_service.chart.schemas import (
    DeleteChartRequest,
    DeleteChartResponse,
)
from superset.mcp_service.utils import escape_llm_context_delimiters

logger = logging.getLogger(__name__)


def _rollback() -> None:
    from superset import db

    try:
        db.session.rollback()  # pylint: disable=consider-using-transaction
    except SQLAlchemyError:
        logger.warning("Database rollback failed during delete_chart error handling")


def _routes_to_soft_delete() -> bool:
    """Mirror the ``BaseDAO.delete`` routing predicate so the response can
    report whether the row was trashed (restorable) or permanently removed."""
    from superset.models.helpers import SoftDeleteMixin
    from superset.models.slice import Slice

    return issubclass(Slice, SoftDeleteMixin) and is_feature_enabled("SOFT_DELETE")


@tool(
    tags=["mutate"],
    class_permission_name="Chart",
    annotations=ToolAnnotations(
        title="Delete chart",
        readOnlyHint=False,
        destructiveHint=True,
    ),
)
async def delete_chart(
    request: DeleteChartRequest, ctx: Context
) -> DeleteChartResponse:
    """Delete a saved chart.

    Identify the chart by numeric ID or UUID string (NOT chart name). When the
    ``SOFT_DELETE`` feature flag is enabled the chart is moved to trash and can
    be restored by an owner or Admin; otherwise the delete is permanent and
    cannot be undone. The ``soft_deleted`` response field reports which
    happened. The caller must own the chart (or be an Admin); charts with
    attached alerts/reports cannot be deleted until those are removed.

    Example:
    ```json
    {"identifier": 123}
    ```

    Returns success with the deleted chart's id/name, or an error. When the
    caller lacks permission, ``permission_denied`` is true — do not retry; ask
    the user.
    """
    await ctx.info("Deleting chart: identifier=%s" % (request.identifier,))

    chart = find_chart_by_identifier(request.identifier)
    if not chart:
        safe_id = escape_llm_context_delimiters(str(request.identifier)[:200])
        msg = (
            f"No chart found with identifier: {safe_id}. "
            "Use list_charts to get valid chart IDs."
        )
        return DeleteChartResponse(success=False, error=msg, error_type="NotFound")

    chart_id = chart.id
    chart_name = chart.slice_name

    try:
        from superset.commands.chart.delete import DeleteChartCommand

        with event_logger.log_context(action="mcp.delete_chart"):
            DeleteChartCommand([chart_id]).run()

        soft_deleted = _routes_to_soft_delete()
        if soft_deleted:
            message = (
                f"Moved chart '{chart_name}' (id={chart_id}) to trash. "
                "It can be restored by an owner or Admin."
            )
        else:
            message = f"Permanently deleted chart '{chart_name}' (id={chart_id})."
        return DeleteChartResponse(
            success=True,
            deleted_id=chart_id,
            deleted_name=chart_name,
            soft_deleted=soft_deleted,
            message=message,
        )
    except ChartForbiddenError:
        await ctx.warning("Permission denied deleting chart id=%s" % (chart_id,))
        return DeleteChartResponse(
            success=False,
            permission_denied=True,
            error=(
                f"You do not have permission to delete chart '{chart_name}' "
                f"(id={chart_id}). Ask the user to delete it or grant access; "
                "do not retry."
            ),
            error_type="Forbidden",
        )
    except ChartDeleteFailedReportsExistError as ex:
        _rollback()
        return DeleteChartResponse(
            success=False,
            error=(
                f"Chart '{chart_name}' (id={chart_id}) cannot be deleted: {ex}. "
                "Remove the associated alerts/reports first."
            ),
            error_type="ReportsExist",
        )
    except ChartNotFoundError:
        msg = f"Chart id={chart_id} no longer exists."
        return DeleteChartResponse(success=False, error=msg, error_type="NotFound")
    except (CommandException, SQLAlchemyError, ValueError) as ex:
        _rollback()
        await ctx.error("Chart delete failed: %s: %s" % (type(ex).__name__, ex))
        return DeleteChartResponse(
            success=False,
            error=f"Chart delete failed: {ex}",
            error_type=type(ex).__name__,
        )
