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
MCP tool: restore_dataset
"""

import logging
from typing import Any

from fastmcp import Context
from sqlalchemy.exc import SQLAlchemyError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.commands.dataset.exceptions import (
    DatasetForbiddenError,
    DatasetLogicalDuplicateError,
    DatasetNotFoundError,
)
from superset.commands.exceptions import CommandException
from superset.extensions import event_logger
from superset.mcp_service.dataset.schemas import (
    RestoreDatasetRequest,
    RestoreDatasetResponse,
)

logger = logging.getLogger(__name__)


def _find_dataset_for_restore(identifier: int | str) -> Any | None:
    """Resolve a dataset by numeric ID or UUID, including soft-deleted rows.

    Both bypasses mirror ``BaseRestoreCommand.validate``'s own lookup:
    ``skip_visibility_filter`` unhides the soft-deleted row, and
    ``skip_base_filter`` keeps an editor's own trash reachable even when the
    dataset's datasource-access base_filter would hide it (a lost grant must
    not hide a row from the one audience that can restore it). The restore
    audience is enforced by ``RestoreDatasetCommand`` via
    ``raise_for_editorship``.
    """
    from superset.daos.dataset import DatasetDAO

    return DatasetDAO.find_by_id_or_uuid(
        str(identifier),
        skip_base_filter=True,
        skip_visibility_filter=True,
    )


def _rollback() -> None:
    from superset import db

    try:
        db.session.rollback()  # pylint: disable=consider-using-transaction
    except SQLAlchemyError:
        logger.warning("Database rollback failed during restore_dataset error handling")


@tool(
    tags=["mutate"],
    class_permission_name="Dataset",
    annotations=ToolAnnotations(
        title="Restore dataset",
        readOnlyHint=False,
        destructiveHint=False,
        idempotentHint=False,
        openWorldHint=False,
    ),
)
async def restore_dataset(
    request: RestoreDatasetRequest, ctx: Context
) -> RestoreDatasetResponse:
    """Restore a soft-deleted dataset from trash.

    Identify the dataset by numeric ID or UUID string (NOT table name). Only
    datasets that were soft-deleted (moved to trash while the ``SOFT_DELETE``
    feature flag was enabled) can be restored; permanently deleted datasets
    are unrecoverable. The caller must be an editor of the dataset (owners
    and Admins qualify). Use list_datasets with deleted_state='only' to find
    trashed datasets.

    Restoring fails with ``error_type`` ``LogicalDuplicate`` when another
    active dataset already points at the same physical table; that dataset
    must be deleted or renamed first.

    Example:
    ```json
    {"identifier": 123}
    ```

    Returns success with the restored dataset's id/name, or an error. When the
    caller lacks permission, ``permission_denied`` is true — do not retry; ask
    the user.
    """
    await ctx.info("Restoring dataset: identifier=%s" % (request.identifier,))

    try:
        dataset = _find_dataset_for_restore(request.identifier)
    except SQLAlchemyError:
        _rollback()
        logger.exception("Dataset lookup failed during restore_dataset")
        return RestoreDatasetResponse(
            success=False,
            error="Dataset lookup failed due to a database error.",
            error_type="LookupFailed",
        )
    if not dataset:
        display_id = str(request.identifier)[:200]
        msg = f"No dataset found with identifier: {display_id}."
        return RestoreDatasetResponse(success=False, error=msg, error_type="NotFound")

    dataset_id = dataset.id
    # Table names are user-controlled and must remain exact in response text.
    dataset_name = dataset.table_name

    if dataset.deleted_at is None:
        return RestoreDatasetResponse(
            success=False,
            error=(
                f"Dataset '{dataset_name}' (id={dataset_id}) is not in trash; "
                "nothing to restore."
            ),
            error_type="NotDeleted",
        )

    # The try/except sits inside log_context so failed restore attempts are
    # recorded in the audit log too — the context manager does not log when
    # an exception propagates through it.
    with event_logger.log_context(action="mcp.restore_dataset"):
        try:
            from superset.commands.dataset.restore import RestoreDatasetCommand

            RestoreDatasetCommand(str(dataset.uuid)).run()

            return RestoreDatasetResponse(
                success=True,
                restored_id=dataset_id,
                restored_name=dataset_name,
                message=(
                    f"Restored dataset '{dataset_name}' (id={dataset_id}) from trash."
                ),
            )
        except DatasetForbiddenError:
            await ctx.warning(
                "Permission denied restoring dataset id=%s" % (dataset_id,)
            )
            return RestoreDatasetResponse(
                success=False,
                permission_denied=True,
                error=(
                    "You do not have permission to restore dataset "
                    f"'{dataset_name}' (id={dataset_id}). Ask the user to restore "
                    "it or grant access; do not retry."
                ),
                error_type="Forbidden",
            )
        except DatasetLogicalDuplicateError as ex:
            _rollback()
            return RestoreDatasetResponse(
                success=False,
                error=f"Dataset '{dataset_name}' (id={dataset_id}): {ex.message}",
                error_type="LogicalDuplicate",
            )
        except DatasetNotFoundError:
            msg = f"Dataset id={dataset_id} is no longer restorable."
            return RestoreDatasetResponse(
                success=False, error=msg, error_type="NotFound"
            )
        except (CommandException, SQLAlchemyError, ValueError) as ex:
            _rollback()
            await ctx.error("Dataset restore failed: %s: %s" % (type(ex).__name__, ex))
            return RestoreDatasetResponse(
                success=False,
                # Raw SQLAlchemy text can leak SQL or connection details; command
                # and validation messages are user-facing by design.
                error=(
                    "Dataset restore failed due to a database error."
                    if isinstance(ex, SQLAlchemyError)
                    else f"Dataset restore failed: {ex}"
                ),
                error_type=type(ex).__name__,
            )
