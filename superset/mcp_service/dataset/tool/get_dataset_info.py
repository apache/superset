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
Get dataset info FastMCP tool

This module contains the FastMCP tool for getting detailed information
about a specific dataset.
"""

import logging
from datetime import datetime, timezone

from fastmcp import Context
from sqlalchemy.orm import joinedload, subqueryload
from superset_core.mcp import tool

from superset.extensions import event_logger
from superset.mcp_service.dataset.schemas import (
    DatasetError,
    DatasetInfo,
    GetDatasetInfoRequest,
    serialize_dataset_object,
)
from superset.mcp_service.mcp_core import ModelGetInfoCore
from superset.mcp_service.utils.schema_utils import parse_request

logger = logging.getLogger(__name__)


@tool(tags=["discovery"])
@parse_request(GetDatasetInfoRequest)
async def get_dataset_info(
    request: GetDatasetInfoRequest, ctx: Context
) -> DatasetInfo | DatasetError:
    """Get dataset metadata by ID or UUID.

    Returns columns, metrics, and schema details.

    IMPORTANT FOR LLM CLIENTS:
    - Use numeric ID (e.g., 123) or UUID string (e.g., "a1b2c3d4-...")
    - DO NOT use schema.table_name format (e.g., "public.customers")
    - To find a dataset ID, use the list_datasets tool first

    Example usage:
    ```json
    {
        "identifier": 123
    }
    ```

    Or with UUID:
    ```json
    {
        "identifier": "a1b2c3d4-5678-90ab-cdef-1234567890ab"
    }
    ```
    """
    await ctx.info(
        "Retrieving dataset information: identifier=%s" % (request.identifier,)
    )
    await ctx.debug(
        "Metadata cache settings: use_cache=%s refresh_metadata=%s force_refresh=%s"
        % (
            request.use_cache,
            request.refresh_metadata,
            request.force_refresh,
        )
    )

    try:
        from superset.connectors.sqla.models import SqlaTable
        from superset.daos.dataset import DatasetDAO

        # Eager load columns, metrics, and database to avoid N+1 queries.
        # Without this, serialize_dataset_object triggers lazy loads for each
        # relationship, which can time out on datasets with many columns.
        eager_options = [
            subqueryload(SqlaTable.columns),
            subqueryload(SqlaTable.metrics),
            joinedload(SqlaTable.database),
        ]

        with event_logger.log_context(action="mcp.get_dataset_info.lookup"):
            tool = ModelGetInfoCore(
                dao_class=DatasetDAO,
                output_schema=DatasetInfo,
                error_schema=DatasetError,
                serializer=serialize_dataset_object,
                supports_slug=False,  # Datasets don't have slugs
                logger=logger,
                query_options=eager_options,
            )

            result = tool.run_tool(request.identifier)

        if isinstance(result, DatasetInfo):
            await ctx.info(
                "Dataset information retrieved successfully: "
                "dataset_id=%s, table_name=%s, columns_count=%s, metrics_count=%s"
                % (
                    result.id,
                    result.table_name,
                    len(result.columns) if result.columns else 0,
                    len(result.metrics) if result.metrics else 0,
                )
            )
        else:
            await ctx.warning(
                "Dataset retrieval failed: error_type=%s, error=%s"
                % (result.error_type, result.error)
            )

        return result

    except Exception as e:
        await ctx.error(
            "Dataset information retrieval failed: identifier=%s, error=%s, "
            "error_type=%s"
            % (
                request.identifier,
                str(e),
                type(e).__name__,
            )
        )
        return DatasetError(
            error=f"Failed to get dataset info: {str(e)}",
            error_type="InternalError",
            timestamp=datetime.now(timezone.utc),
        )
