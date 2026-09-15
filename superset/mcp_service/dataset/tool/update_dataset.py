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
MCP tool: update_dataset
"""

import logging
from typing import Any

from fastmcp import Context
from sqlalchemy.exc import SQLAlchemyError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset import security_manager
from superset.exceptions import SupersetException
from superset.extensions import event_logger
from superset.mcp_service.dataset.schemas import (
    UpdateDatasetRequest,
    UpdateDatasetResponse,
)

logger = logging.getLogger(__name__)


def _column_names(dataset: Any) -> set[str]:
    return {column.column_name for column in dataset.columns}


def _sync_error_message(ex: Exception) -> str:
    # Raw SQLAlchemy text can leak SQL or connection details; Superset
    # exception messages are user-facing by design.
    if isinstance(ex, SQLAlchemyError):
        return "a database error occurred"
    return str(ex)


@tool(
    tags=["mutate"],
    class_permission_name="Dataset",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Update dataset",
        readOnlyHint=False,
        # Rewriting a virtual dataset's SQL or re-syncing its columns changes
        # what every chart built on it queries — non-additive, like
        # update_chart.
        destructiveHint=True,
        idempotentHint=False,
        openWorldHint=False,
    ),
)
async def update_dataset(  # noqa: C901
    request: UpdateDatasetRequest, ctx: Context
) -> UpdateDatasetResponse:
    """Update a dataset's name, SQL, description, default datetime column or
    cache timeout, and optionally re-sync its columns from the data source.

    Only the properties you pass are changed. ``sql`` applies to virtual
    datasets only. When ``sql`` changes, columns are re-synced from the new
    query (like "Sync columns from source" in the dataset editor) unless
    ``sync_columns`` is false; pass ``sync_columns=true`` on its own to pick
    up schema changes in the underlying table or query. Calculated columns
    and saved metrics are kept. Use update_dataset_metric to edit metrics.
    Requires ownership of the dataset (or Admin).

    Check ``removed_columns`` in the response: charts that use those columns
    fail until they are updated. ``warnings`` reports problems that did not
    undo the update, e.g. a column re-sync that failed after the SQL was saved.

    Workflow:
    1. Call get_dataset_info to inspect the dataset
    2. Call this tool with the dataset ID and only the properties to change

    Example usage:
    ```json
    {
        "dataset_id": 123,
        "sql": "SELECT region, SUM(revenue) AS revenue FROM sales GROUP BY region",
        "description": "Revenue by region"
    }
    ```
    """
    updates = request.updates()
    await ctx.info(
        "Updating dataset: dataset_id=%s, properties=%s, sync_columns=%s"
        % (request.dataset_id, sorted(updates), request.sync_columns)
    )

    try:
        from sqlalchemy.orm import joinedload, subqueryload

        from superset.commands.dataset.exceptions import (
            DatasetForbiddenError,
            DatasetInvalidError,
            DatasetNotFoundError,
            DatasetUpdateFailedError,
        )
        from superset.commands.dataset.refresh import RefreshDatasetCommand
        from superset.commands.dataset.update import UpdateDatasetCommand
        from superset.connectors.sqla.models import SqlaTable
        from superset.exceptions import SupersetSecurityException
        from superset.mcp_service.dataset.dataset_utils import resolve_dataset
        from superset.mcp_service.utils.url_utils import get_superset_base_url

        eager_options = [
            subqueryload(SqlaTable.columns),
            joinedload(SqlaTable.database),
        ]

        with event_logger.log_context(action="mcp.update_dataset.lookup"):
            dataset = resolve_dataset(request.dataset_id, eager_options)

        if dataset is None:
            display_id = str(request.dataset_id)[:200]
            await ctx.warning("Dataset not found: %s" % (display_id,))
            return UpdateDatasetResponse(
                error=(
                    f"No dataset found with identifier: {display_id}."
                    " Use list_datasets to get valid dataset IDs."
                ),
            )

        dataset_id = dataset.id

        # Enforce editorship before validating against the dataset's columns,
        # so a caller without edit rights learns nothing beyond "forbidden".
        # UpdateDatasetCommand and RefreshDatasetCommand re-check this.
        try:
            security_manager.raise_for_editorship(dataset)
        except SupersetSecurityException:
            await ctx.warning("Dataset update forbidden: dataset_id=%s" % (dataset_id,))
            return UpdateDatasetResponse(
                dataset_id=dataset_id,
                permission_denied=True,
                error="You must be an owner of this dataset (or an Admin) to "
                "update it. Ask the user to update it or grant access; do not "
                "retry.",
            )

        if "sql" in updates and not dataset.sql:
            return UpdateDatasetResponse(
                dataset_id=dataset_id,
                error="sql can only be set on a virtual dataset; this dataset "
                "is a physical table.",
            )

        sync_columns = (
            request.sync_columns
            if request.sync_columns is not None
            else "sql" in updates and updates["sql"] != dataset.sql
        )

        # A new default datetime column is checked against the columns the
        # dataset will have once the update is done: the current ones, or the
        # re-synced ones, in which case it is applied after the sync.
        pending_dttm_col = None
        if updates.get("main_dttm_col") is not None:
            if sync_columns:
                pending_dttm_col = updates.pop("main_dttm_col")
            elif updates["main_dttm_col"] not in _column_names(dataset):
                dttm_col = updates["main_dttm_col"]
                return UpdateDatasetResponse(
                    dataset_id=dataset_id,
                    error=f"main_dttm_col '{dttm_col}' is not a column of this "
                    "dataset. Use get_dataset_info to list its columns.",
                )

        columns_before = _column_names(dataset)
        updated_properties = sorted(updates)

        if updates:
            # Same pair of commands as PUT /api/v1/dataset/<pk>?override_columns=
            # — the update commits before the column refresh runs.
            with event_logger.log_context(action="mcp.update_dataset.update"):
                dataset = UpdateDatasetCommand(
                    dataset_id, updates, override_columns=sync_columns
                ).run()

        warnings: list[str] = []
        added_columns: list[str] = []
        removed_columns: list[str] = []
        columns_synced = False
        if sync_columns:
            try:
                with event_logger.log_context(action="mcp.update_dataset.sync_columns"):
                    dataset = RefreshDatasetCommand(dataset_id).run()
                columns_after = _column_names(dataset)
                added_columns = sorted(columns_after - columns_before)
                removed_columns = sorted(columns_before - columns_after)
                columns_synced = True
            except (SupersetException, SQLAlchemyError) as ex:
                await ctx.warning(
                    "Dataset column sync failed: %s: %s" % (type(ex).__name__, ex)
                )
                warnings.append(
                    "The update was saved, but re-syncing columns failed "
                    f"({_sync_error_message(ex)}). The column list may not "
                    "match the dataset's SQL; retry with sync_columns=true."
                )

        if pending_dttm_col is not None:
            if not columns_synced:
                warnings.append(
                    f"main_dttm_col was not changed to '{pending_dttm_col}' "
                    "because the columns could not be re-synced."
                )
            elif pending_dttm_col not in _column_names(dataset):
                warnings.append(
                    f"main_dttm_col was not changed: '{pending_dttm_col}' is not "
                    "a column of the dataset after the update."
                )
            else:
                with event_logger.log_context(action="mcp.update_dataset.update"):
                    dataset = UpdateDatasetCommand(
                        dataset_id, {"main_dttm_col": pending_dttm_col}
                    ).run()
                updated_properties = sorted({*updated_properties, "main_dttm_col"})
        elif (
            columns_synced
            and dataset.main_dttm_col
            and dataset.main_dttm_col not in _column_names(dataset)
        ):
            # The refresh only fills main_dttm_col when it is empty, so a
            # default datetime column dropped by the new SQL is left dangling.
            warnings.append(
                f"main_dttm_col '{dataset.main_dttm_col}' is no longer a column "
                "of the dataset; set main_dttm_col to one of its current columns."
            )

        await ctx.info(
            "Dataset updated: dataset_id=%s, properties=%s, columns_synced=%s"
            % (dataset_id, updated_properties, columns_synced)
        )

        return UpdateDatasetResponse(
            dataset_id=dataset_id,
            dataset_name=dataset.table_name,
            updated_properties=updated_properties,
            columns_synced=columns_synced,
            added_columns=added_columns,
            removed_columns=removed_columns,
            warnings=warnings,
            url=(
                f"{get_superset_base_url()}/explore/"
                f"?datasource_type=table&datasource_id={dataset_id}"
            ),
        )

    except DatasetNotFoundError:
        await ctx.warning("Dataset not found: %s" % (request.dataset_id,))
        return UpdateDatasetResponse(
            error=f"No dataset found with identifier: {request.dataset_id}.",
        )
    except DatasetForbiddenError:
        await ctx.warning(
            "Dataset update forbidden: dataset_id=%s" % (request.dataset_id,)
        )
        return UpdateDatasetResponse(
            permission_denied=True,
            error="You must be an owner of this dataset (or an Admin) to update "
            "it. Ask the user to update it or grant access; do not retry.",
        )
    except DatasetInvalidError as exc:
        messages = exc.normalized_messages()
        await ctx.warning("Dataset validation failed: %s" % (messages,))
        return UpdateDatasetResponse(error=str(messages))
    except DatasetUpdateFailedError as exc:
        await ctx.error("Dataset update failed: %s" % (str(exc),))
        return UpdateDatasetResponse(error=f"Failed to update dataset: {exc}")
    except Exception as exc:
        await ctx.error(
            "Unexpected error updating dataset: %s: %s" % (type(exc).__name__, str(exc))
        )
        raise
