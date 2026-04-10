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
    CreateVirtualDatasetRequest,
    CreateVirtualDatasetResponse,
)

logger = logging.getLogger(__name__)


@tool(
    tags=["mutate"],
    class_permission_name="Dataset",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Create virtual dataset from SQL",
        readOnlyHint=False,
        destructiveHint=False,
    ),
)
async def create_virtual_dataset(
    request: CreateVirtualDatasetRequest, ctx: Context
) -> CreateVirtualDatasetResponse:
    """Save a SQL query as a virtual dataset so it can be charted.

    Use this tool when a user wants to visualize data from a SQL query
    (e.g., a JOIN or complex aggregation) that doesn't map to a single
    physical table.

    Workflow:
    1. Call this tool with the SQL query and a dataset name
    2. Use the returned ``id`` as the ``dataset_id`` in generate_chart or
       generate_explore_link
    3. Use the returned ``columns`` list to pick columns for the chart config
    """
    await ctx.info(
        "Creating virtual dataset: database_id=%s, dataset_name=%r"
        % (request.database_id, request.dataset_name)
    )

    try:
        from superset.commands.dataset.create import CreateDatasetCommand
        from superset.commands.dataset.exceptions import (
            DatasetCreateFailedError,
            DatasetInvalidError,
        )
        from superset.daos.database import DatabaseDAO
        from superset.mcp_service.utils.url_utils import get_superset_base_url

        # 1. Validate the database exists
        with event_logger.log_context(
            action="mcp.create_virtual_dataset.db_validation"
        ):
            database = DatabaseDAO.find_by_id(request.database_id)
            if not database:
                await ctx.error(
                    "Database not found: database_id=%s" % request.database_id
                )
                return CreateVirtualDatasetResponse(
                    id=0,
                    dataset_name=request.dataset_name,
                    sql=request.sql,
                    database_id=request.database_id,
                    columns=[],
                    url="",
                    error=(
                        f"Database with ID {request.database_id} not found. "
                        "Use list_databases to find valid database IDs."
                    ),
                )

        # 2. Create the virtual dataset — CreateDatasetCommand enforces access control
        with event_logger.log_context(action="mcp.create_virtual_dataset.create"):
            properties: dict[str, Any] = {
                "database": request.database_id,
                "table_name": request.dataset_name,
                "sql": request.sql,
            }
            if request.schema_name:
                properties["schema"] = request.schema_name
            if request.catalog:
                properties["catalog"] = request.catalog
            if request.description:
                properties["description"] = request.description

            dataset = CreateDatasetCommand(properties).run()

        # 3. Build response
        columns = [col.column_name for col in dataset.columns]
        dataset_url = f"{get_superset_base_url()}/tablemodelview/edit/{dataset.id}"

        await ctx.info(
            "Virtual dataset created: id=%s, dataset_name=%r, columns=%s"
            % (dataset.id, dataset.table_name, columns)
        )

        return CreateVirtualDatasetResponse(
            id=dataset.id,
            dataset_name=dataset.table_name,
            sql=request.sql,
            database_id=request.database_id,
            columns=columns,
            url=dataset_url,
        )

    except DatasetInvalidError as exc:
        messages = exc.normalized_messages()
        await ctx.error("Virtual dataset validation failed: %s" % (messages,))
        return CreateVirtualDatasetResponse(
            id=0,
            dataset_name=request.dataset_name,
            sql=request.sql,
            database_id=request.database_id,
            columns=[],
            url="",
            error=str(messages),
        )
    except DatasetCreateFailedError as exc:
        await ctx.error("Virtual dataset creation failed: %s" % (str(exc),))
        return CreateVirtualDatasetResponse(
            id=0,
            dataset_name=request.dataset_name,
            sql=request.sql,
            database_id=request.database_id,
            columns=[],
            url="",
            error=f"Failed to create dataset: {exc}",
        )
    except Exception as exc:
        await ctx.error(
            "Unexpected error creating virtual dataset: %s: %s"
            % (type(exc).__name__, str(exc))
        )
        raise
