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
Create dataset FastMCP tool

Registers a physical table as a Superset dataset against an existing
database connection — the programmatic equivalent of Data → Datasets → +Dataset.
Returns the same DatasetInfo shape as get_dataset_info so the caller can feed
the resulting dataset_id directly into generate_chart.
"""

import logging

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
        title="Register physical table as dataset",
        readOnlyHint=False,
        destructiveHint=False,
    ),
)
async def create_dataset(
    request: CreateDatasetRequest, ctx: Context
) -> DatasetInfo | DatasetError:
    """Register a physical table as a Superset dataset.

    Wraps POST /api/v1/dataset/ — the same endpoint the UI uses when you click
    Data → Datasets → +Dataset.  Returns full dataset metadata (same shape as
    get_dataset_info) so you can pass the resulting dataset_id straight into
    generate_chart.

    Required fields:
    - database_id: ID of the existing database connection
    - table_name: Exact name of the physical table to register

    Optional fields:
    - schema: Schema/namespace where the table lives (e.g. "public"). Omit for
      databases without schema namespaces (e.g. SQLite).
    - owners: List of user IDs to set as owners (defaults to calling user)

    Example:
    ```json
    {
        "database_id": 1,
        "schema": "public",
        "table_name": "orders"
    }
    ```

    Returns DatasetInfo on success or DatasetError on failure.
    Use list_databases to find the correct database_id.
    """
    # Normalize schema: strip whitespace and treat blank strings as None
    schema = request.schema.strip() if request.schema else None

    await ctx.info(
        "Registering physical table as dataset: database_id=%s, table=%s.%s"
        % (request.database_id, schema, request.table_name)
    )

    try:
        from superset.commands.dataset.create import CreateDatasetCommand
        from superset.commands.dataset.exceptions import (
            DatasetCreateFailedError,
            DatasetExistsValidationError,
            DatasetInvalidError,
            TableNotFoundValidationError,
        )

        dataset_properties: dict[str, object] = {
            "database": request.database_id,
            "table_name": request.table_name,
        }
        if schema is not None:
            dataset_properties["schema"] = schema
        if request.owners is not None:
            dataset_properties["owners"] = request.owners

        with event_logger.log_context(action="mcp.create_dataset.create"):
            dataset = CreateDatasetCommand(dataset_properties).run()

        result = serialize_dataset_object(dataset)
        if result is None:
            return DatasetError.create(
                error="Dataset was created but could not be serialized",
                error_type="SerializationError",
            )

        await ctx.info(
            "Dataset registered: id=%s, table=%s.%s"
            % (dataset.id, schema, request.table_name)
        )
        return result

    except DatasetExistsValidationError as exc:
        await ctx.warning("Dataset already exists: %s" % (str(exc),))
        return DatasetError.create(error=str(exc), error_type="DatasetExistsError")
    except TableNotFoundValidationError as exc:
        await ctx.warning("Table not found: %s" % (str(exc),))
        return DatasetError.create(error=str(exc), error_type="TableNotFoundError")
    except DatasetInvalidError as exc:
        messages = exc.normalized_messages()
        await ctx.warning("Dataset validation failed: %s" % (messages,))
        return DatasetError.create(error=str(messages), error_type="ValidationError")
    except DatasetCreateFailedError as exc:
        await ctx.error("Dataset creation failed: %s" % (str(exc),))
        return DatasetError.create(error=str(exc), error_type="CreateFailedError")
    except Exception as exc:
        await ctx.error(
            "Unexpected error creating dataset: %s: %s" % (type(exc).__name__, str(exc))
        )
        raise
