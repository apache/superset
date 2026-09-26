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
MCP tool: delete_dataset
"""

import logging

from fastmcp import Context
from sqlalchemy.exc import SQLAlchemyError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset import is_feature_enabled
from superset.commands.dataset.exceptions import (
    DatasetForbiddenError,
    DatasetNotFoundError,
)
from superset.commands.exceptions import CommandException
from superset.extensions import event_logger
from superset.mcp_service.dataset.dataset_utils import resolve_dataset
from superset.mcp_service.dataset.schemas import (
    DeleteDatasetRequest,
    DeleteDatasetResponse,
)

logger = logging.getLogger(__name__)


def _rollback() -> None:
    """Best-effort session rollback so a failed delete cannot poison the
    request's transaction; rollback failures are logged, not raised."""
    from superset import db

    try:
        db.session.rollback()  # pylint: disable=consider-using-transaction
    except SQLAlchemyError:
        logger.warning("Database rollback failed during delete_dataset error handling")


def _routes_to_soft_delete() -> bool:
    """Mirror the ``BaseDAO.delete`` routing predicate so the response can
    report whether the row was trashed (restorable) or permanently removed."""
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.helpers import SoftDeleteMixin

    return issubclass(SqlaTable, SoftDeleteMixin) and is_feature_enabled("SOFT_DELETE")


def _count_affected_objects(dataset_id: int) -> tuple[int, int]:
    """Count the charts and dashboards that depend on the dataset.

    Mirrors ``GET /api/v1/dataset/<pk>/related_objects``: only objects the
    caller can access are counted, so the numbers never disclose assets the
    caller cannot see.
    """
    from superset import security_manager
    from superset.daos.dataset import DatasetDAO

    related = DatasetDAO.get_related_objects(dataset_id)
    charts = [
        chart for chart in related["charts"] if security_manager.can_access_chart(chart)
    ]
    dashboards = [
        dashboard
        for dashboard in related["dashboards"]
        if security_manager.can_access_dashboard(dashboard)
    ]
    return len(charts), len(dashboards)


@tool(
    tags=["mutate"],
    class_permission_name="Dataset",
    annotations=ToolAnnotations(
        title="Delete dataset",
        readOnlyHint=False,
        destructiveHint=True,
        idempotentHint=False,
        openWorldHint=False,
    ),
)
async def delete_dataset(
    request: DeleteDatasetRequest, ctx: Context
) -> DeleteDatasetResponse:
    """Delete a dataset.

    Identify the dataset by numeric ID or UUID string (NOT table name). When
    the ``SOFT_DELETE`` feature flag is enabled the dataset is moved to trash
    and can be restored by an owner or Admin; otherwise the delete is
    permanent and cannot be undone. The ``soft_deleted`` response field
    reports which happened. The caller must be an editor of the dataset
    (owners and Admins qualify).

    Charts built on the dataset stop working while it is deleted. The
    ``affected_chart_count`` and ``affected_dashboard_count`` response fields
    report how many charts and dashboards depend on it — tell the user when
    they are non-zero.

    Example:
    ```json
    {"identifier": 123}
    ```

    Returns success with the deleted dataset's id/name, or an error. When the
    caller lacks permission, ``permission_denied`` is true — do not retry; ask
    the user.
    """
    await ctx.info("Deleting dataset: identifier=%s" % (request.identifier,))

    try:
        dataset = resolve_dataset(request.identifier)
    except SQLAlchemyError:
        _rollback()
        logger.exception("Dataset lookup failed during delete_dataset")
        return DeleteDatasetResponse(
            success=False,
            error="Dataset lookup failed due to a database error.",
            error_type="LookupFailed",
        )
    if not dataset:
        display_id = str(request.identifier)[:200]
        msg = (
            f"No dataset found with identifier: {display_id}. "
            "Use list_datasets to get valid dataset IDs."
        )
        return DeleteDatasetResponse(success=False, error=msg, error_type="NotFound")

    dataset_id = dataset.id
    # Table names are user-controlled and must remain exact in response text.
    dataset_name = dataset.table_name

    # The try/except sits inside log_context so failed attempts (forbidden,
    # db errors) are recorded in the audit log too — the context manager does
    # not log when an exception propagates through it.
    with event_logger.log_context(action="mcp.delete_dataset"):
        try:
            from superset.commands.dataset.delete import DeleteDatasetCommand

            command = DeleteDatasetCommand([dataset_id])
            # Check editorship before counting dependents, so a caller who may
            # not delete the dataset triggers no relationship queries.
            command.validate()
            chart_count, dashboard_count = _count_affected_objects(dataset_id)
            command.run()

            soft_deleted = _routes_to_soft_delete()
            if soft_deleted:
                message = (
                    f"Moved dataset '{dataset_name}' (id={dataset_id}) to trash. "
                    "It can be restored by an owner or Admin."
                )
            else:
                message = (
                    f"Permanently deleted dataset '{dataset_name}' (id={dataset_id})."
                )
            if chart_count:
                message += (
                    f" {chart_count} chart(s) on {dashboard_count} dashboard(s) "
                    "depend on it and stop working while it is deleted."
                )
            return DeleteDatasetResponse(
                success=True,
                deleted_id=dataset_id,
                deleted_name=dataset_name,
                soft_deleted=soft_deleted,
                affected_chart_count=chart_count,
                affected_dashboard_count=dashboard_count,
                message=message,
            )
        except DatasetForbiddenError:
            await ctx.warning(
                "Permission denied deleting dataset id=%s" % (dataset_id,)
            )
            return DeleteDatasetResponse(
                success=False,
                permission_denied=True,
                error=(
                    "You do not have permission to delete dataset "
                    f"'{dataset_name}' (id={dataset_id}). Ask the user to delete "
                    "it or grant access; do not retry."
                ),
                error_type="Forbidden",
            )
        except DatasetNotFoundError:
            msg = f"Dataset id={dataset_id} no longer exists."
            return DeleteDatasetResponse(
                success=False, error=msg, error_type="NotFound"
            )
        except (CommandException, SQLAlchemyError, ValueError) as ex:
            _rollback()
            await ctx.error("Dataset delete failed: %s: %s" % (type(ex).__name__, ex))
            # Raw SQLAlchemy text can leak SQL or connection details; command
            # and validation messages are user-facing by design.
            if isinstance(ex, SQLAlchemyError):
                client_error = "Dataset delete failed due to a database error."
            else:
                client_error = f"Dataset delete failed: {ex}"
            return DeleteDatasetResponse(
                success=False,
                error=client_error,
                error_type=type(ex).__name__,
            )
