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

"""Create a calculated column on a dataset (FastMCP tool)."""

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset import security_manager
from superset.extensions import event_logger
from superset.mcp_service.dataset.schemas import (
    CreateDatasetColumnRequest,
    CreateDatasetColumnResponse,
)
from superset.mcp_service.dataset.tool.update_dataset_column import (
    _serialize_column,
)


@tool(
    tags=["mutate"],
    class_permission_name="Dataset",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Create dataset calculated column",
        readOnlyHint=False,
        destructiveHint=False,
        idempotentHint=False,
        openWorldHint=False,
    ),
)
async def create_dataset_column(
    request: CreateDatasetColumnRequest, ctx: Context
) -> CreateDatasetColumnResponse:
    """Add a calculated column to a dataset identified by ID or UUID.

    A calculated column is a named, row-level SQL expression stored on the
    dataset, e.g. CASE WHEN amount > 100 THEN 'large' ELSE 'small' END, that
    charts can group by and filter on like any other column. The expression
    is evaluated per row, so it must not aggregate.

    Requires column_name and expression; accepts the same optional properties
    as update_dataset_column (verbose_name, description, type, is_dttm,
    groupby, filterable, python_date_format). Existing columns are preserved.
    Requires dataset editorship (or Admin). Use get_dataset_info to inspect
    existing column names before creating one.

    Example usage:
    ```json
    {
        "dataset_id": 123,
        "column_name": "order_size",
        "expression": "CASE WHEN amount > 100 THEN 'large' ELSE 'small' END",
        "type": "VARCHAR"
    }
    ```
    """
    updates = request.updates()
    await ctx.info("Creating dataset column: dataset_id=%s" % (request.dataset_id,))

    try:
        from sqlalchemy.orm import joinedload, subqueryload

        from superset.commands.dataset.exceptions import (
            DatasetForbiddenError,
            DatasetInvalidError,
            DatasetNotFoundError,
            DatasetSoftDeletedTwinExistsError,
            DatasetUpdateFailedError,
        )
        from superset.commands.dataset.update import UpdateDatasetCommand
        from superset.connectors.sqla.models import SqlaTable
        from superset.exceptions import SupersetSecurityException
        from superset.mcp_service.dataset.dataset_utils import resolve_dataset
        from superset.mcp_service.utils.url_utils import get_superset_base_url

        eager_options = [
            subqueryload(SqlaTable.columns),
            joinedload(SqlaTable.database),
        ]

        with event_logger.log_context(action="mcp.create_dataset_column.lookup"):
            dataset = resolve_dataset(request.dataset_id, eager_options)

        if dataset is None:
            await ctx.warning("Dataset not found: %s" % (request.dataset_id,))
            return CreateDatasetColumnResponse(
                error=(
                    f"No dataset found with identifier: {request.dataset_id}."
                    " Use list_datasets to get valid dataset IDs."
                ),
            )

        # Check editorship before inspecting column names. The command repeats
        # this check and enforces all dataset update validation on persistence.
        try:
            security_manager.raise_for_editorship(dataset)
        except SupersetSecurityException:
            await ctx.warning(
                "Dataset column create forbidden: dataset_id=%s" % (dataset.id,)
            )
            return CreateDatasetColumnResponse(
                error="You must be an owner of this dataset (or an Admin) "
                "to create its columns.",
            )

        columns = list(dataset.columns)
        if any(column.column_name == request.column_name for column in columns):
            await ctx.warning("Column already exists: %s" % (request.column_name,))
            return CreateDatasetColumnResponse(
                dataset_id=dataset.id,
                dataset_name=dataset.table_name,
                error=f"Column '{request.column_name}' already exists on this "
                "dataset. Choose a unique column_name or use update_dataset_column.",
            )

        # Use an additive write: echoing lookup-time columns back could revert
        # a concurrent rename or delete a column added by another writer.
        with event_logger.log_context(action="mcp.create_dataset_column.create"):
            updated_dataset = UpdateDatasetCommand(
                dataset.id,
                {"columns": [updates]},
                preserve_existing_columns=True,
            ).run()

        created_column = next(
            c for c in updated_dataset.columns if c.column_name == request.column_name
        )
        await ctx.info(
            "Dataset column created: dataset_id=%s, column_id=%s"
            % (updated_dataset.id, created_column.id)
        )
        return CreateDatasetColumnResponse(
            dataset_id=updated_dataset.id,
            dataset_name=updated_dataset.table_name,
            column=_serialize_column(created_column),
            url=(
                f"{get_superset_base_url()}/explore/"
                f"?datasource_type=table&datasource_id={updated_dataset.id}"
            ),
        )

    except DatasetNotFoundError:
        await ctx.warning("Dataset not found: %s" % (request.dataset_id,))
        return CreateDatasetColumnResponse(
            error=f"No dataset found with identifier: {request.dataset_id}.",
        )
    except DatasetForbiddenError:
        await ctx.warning(
            "Dataset column create forbidden: dataset_id=%s" % (request.dataset_id,)
        )
        return CreateDatasetColumnResponse(
            error="You must be an owner of this dataset (or an Admin) "
            "to create its columns.",
        )
    except DatasetSoftDeletedTwinExistsError as exc:
        collision_message: str = str(exc)
        await ctx.warning("Dataset column validation failed: %s" % (collision_message,))
        return CreateDatasetColumnResponse(error=collision_message)
    except DatasetInvalidError as exc:
        messages = exc.normalized_messages()
        await ctx.warning("Dataset column validation failed: %s" % (messages,))
        return CreateDatasetColumnResponse(error=str(messages))
    except DatasetUpdateFailedError as exc:
        await ctx.error("Dataset column create failed: %s" % (str(exc),))
        return CreateDatasetColumnResponse(
            error=f"Failed to create column: {exc}",
        )
    except Exception as exc:
        await ctx.error(
            "Unexpected error creating dataset column: %s: %s"
            % (type(exc).__name__, str(exc))
        )
        raise
