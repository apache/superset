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
        f"Creating virtual dataset: database_id={request.database_id}, "
        f"dataset_name={request.dataset_name!r}"
    )

    try:
        from superset.commands.dataset.create import CreateDatasetCommand
        from superset.commands.dataset.exceptions import (
            DatasetCreateFailedError,
            DatasetInvalidError,
            DatasetUpdateFailedError,
        )
        from superset.mcp_service.utils.url_utils import get_superset_base_url

        # Create the virtual dataset — CreateDatasetCommand enforces access control
        # and validates that the database exists (raises DatasetInvalidError otherwise)
        with event_logger.log_context(action="mcp.create_virtual_dataset.create"):
            properties: dict[str, Any] = {
                "database": request.database_id,
                "table_name": request.dataset_name,
                "sql": request.sql,
            }
            if request.schema_name is not None:
                properties["schema"] = request.schema_name
            if request.catalog is not None:
                properties["catalog"] = request.catalog
            if request.description is not None:
                properties["description"] = request.description

            dataset = CreateDatasetCommand(properties).run()

            if request.metrics or request.calculated_columns:
                from superset.commands.dataset.update import UpdateDatasetCommand

                update_props: dict[str, Any] = {}
                if request.metrics:
                    # Merge existing metrics with new ones
                    existing_metrics = (
                        [{"id": m.id} for m in dataset.metrics]
                        if getattr(dataset, "metrics", None)
                        else []
                    )
                    update_props["metrics"] = existing_metrics + [
                        m.model_dump(exclude_none=True) for m in request.metrics
                    ]
                if request.calculated_columns:
                    # Merge existing columns with new ones
                    existing_cols = (
                        [{"id": c.id} for c in dataset.columns]
                        if getattr(dataset, "columns", None)
                        else []
                    )
                    update_props["columns"] = existing_cols + [
                        c.model_dump(exclude_none=True)
                        for c in request.calculated_columns
                    ]

                with event_logger.log_context(
                    action="mcp.create_virtual_dataset.update"
                ):
                    try:
                        dataset = UpdateDatasetCommand(dataset.id, update_props).run()
                    except Exception as exc:
                        from superset.commands.dataset.delete import DeleteDatasetCommand

                        try:
                            DeleteDatasetCommand([dataset.id]).run()
                        except Exception as cleanup_exc:
                            logger.error(
                                "Failed to clean up dataset %s after update error: %s",
                                dataset.id,
                                cleanup_exc,
                            )
                        if not isinstance(
                            exc, (DatasetUpdateFailedError, DatasetInvalidError)
                        ):
                            raise DatasetUpdateFailedError() from exc
                        raise

        # Build response
        columns = [col.column_name for col in dataset.columns]
        dataset_url = (
            f"{get_superset_base_url()}"
            f"/explore/?datasource_type=table&datasource_id={dataset.id}"
        )

        await ctx.info(
            f"Virtual dataset created: id={dataset.id}, "
            f"dataset_name={dataset.table_name!r}, columns={columns}"
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
        await ctx.warning(f"Virtual dataset validation failed: {messages}")
        return CreateVirtualDatasetResponse(
            id=None,
            dataset_name=request.dataset_name,
            sql=request.sql,
            database_id=request.database_id,
            columns=[],
            url=None,
            error=str(messages),
        )
    except DatasetCreateFailedError as exc:
        await ctx.error(f"Virtual dataset creation failed: {exc}")
        return CreateVirtualDatasetResponse(
            id=None,
            dataset_name=request.dataset_name,
            sql=request.sql,
            database_id=request.database_id,
            columns=[],
            url=None,
            error=f"Failed to create dataset: {exc}",
        )
    except DatasetUpdateFailedError as exc:
        await ctx.error(f"Virtual dataset update failed: {exc}")
        return CreateVirtualDatasetResponse(
            id=None,
            dataset_name=request.dataset_name,
            sql=request.sql,
            database_id=request.database_id,
            columns=[],
            url=None,
            error=f"Failed to update dataset metadata (creation rolled back): {exc}",
        )
    except Exception as exc:
        await ctx.error(
            f"Unexpected error creating virtual dataset: {type(exc).__name__}: {exc}"
        )
        raise
