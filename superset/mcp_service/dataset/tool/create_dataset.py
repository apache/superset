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

import logging
from typing import Any

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.dataset.schemas import (
    CreateDatasetRequest,
    DatasetError,
    DatasetInfo,
    serialize_dataset_object,
)

logger = logging.getLogger(__name__)


@tool(
    tags=["mutate"],
    class_permission_name="Dataset",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Register a physical table as a dataset",
        readOnlyHint=False,
        destructiveHint=False,
    ),
)
async def create_dataset(
    request: CreateDatasetRequest, ctx: Context
) -> DatasetInfo | DatasetError:
    """Register an existing physical table as a Superset dataset.

    Use this tool when the user wants to make a physical database table available
    for charting or exploration. The table must already exist in the target database.

    Workflow:
    1. Call list_databases to find the correct database_id
    2. Call this tool with database_id, schema, and table_name
    3. Use the returned id as dataset_id in generate_chart or generate_explore_link

    Returns DatasetInfo on success or DatasetError with error_type on failure.
    """
    await ctx.info(
        "Registering physical table as dataset: database_id=%s, schema=%r, table=%r"
        % (request.database_id, request.schema, request.table_name)
    )

    try:
        from superset.commands.dataset.create import CreateDatasetCommand
        from superset.commands.dataset.exceptions import (
            DatasetCreateFailedError,
            DatasetExistsValidationError,
            DatasetInvalidError,
            TableNotFoundValidationError,
        )

        dataset_properties: dict[str, Any] = {
            "database": request.database_id,
            "table_name": request.table_name,
        }
        if request.schema is not None:
            dataset_properties["schema"] = request.schema
        if request.catalog is not None:
            dataset_properties["catalog"] = request.catalog
        if request.owners is not None:
            dataset_properties["owners"] = request.owners

        with event_logger.log_context(action="mcp.create_dataset.create"):
            dataset = CreateDatasetCommand(dataset_properties).run()

        result = serialize_dataset_object(dataset)
        if result is None:
            return DatasetError.create(
                error="Dataset was created but could not be serialized",
                error_type="InternalError",
            )

        await ctx.info(
            "Dataset registered: id=%s, table=%r" % (dataset.id, dataset.table_name)
        )
        return result

    except DatasetInvalidError as exc:
        # CreateDatasetCommand.validate() aggregates individual validation errors
        # into DatasetInvalidError; inspect them for specific error types.
        if any(isinstance(e, DatasetExistsValidationError) for e in exc._exceptions):
            await ctx.warning("Dataset already exists: %s" % str(exc))
            return DatasetError.create(error=str(exc), error_type="DatasetExistsError")
        if any(isinstance(e, TableNotFoundValidationError) for e in exc._exceptions):
            await ctx.warning("Table not found: %s" % str(exc))
            return DatasetError.create(error=str(exc), error_type="TableNotFoundError")
        messages = exc.normalized_messages()
        await ctx.warning("Dataset validation failed: %s" % (messages,))
        return DatasetError.create(error=str(messages), error_type="ValidationError")
    except DatasetCreateFailedError as exc:
        await ctx.error("Dataset creation failed: %s" % str(exc))
        return DatasetError.create(error=str(exc), error_type="CreateFailedError")
    except Exception as exc:
        await ctx.error(
            "Unexpected error registering dataset: %s: %s"
            % (type(exc).__name__, str(exc))
        )
        return DatasetError.create(
            error=f"Failed to create dataset: {exc}", error_type="InternalError"
        )
