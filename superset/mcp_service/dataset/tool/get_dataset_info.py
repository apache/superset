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

from fastmcp import Context

from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.dataset.schemas import (
    DatasetError,
    DatasetInfo,
    GetDatasetInfoRequest,
    serialize_dataset_object,
)
from superset.mcp_service.mcp_app import mcp
from superset.mcp_service.mcp_core import ModelGetInfoCore

logger = logging.getLogger(__name__)


@mcp.tool
@mcp_auth_hook
def get_dataset_info(
    request: GetDatasetInfoRequest, ctx: Context
) -> DatasetInfo | DatasetError:
    """
    Get detailed information about a specific dataset with metadata cache control.

    Supports lookup by:
    - Numeric ID (e.g., 123)
    - UUID string (e.g., "a1b2c3d4-e5f6-7890-abcd-ef1234567890")

    Metadata Cache Control:
    - use_cache: Whether to use metadata cache for faster responses
    - refresh_metadata: Force refresh of metadata cache for fresh data

    When refresh_metadata=True, the tool will fetch fresh column and metric
    metadata from the database, which is useful when table schema has changed.

    Returns a DatasetInfo model or DatasetError on error.
    """
    ctx.info("Retrieving dataset information", extra={"identifier": request.identifier})
    ctx.debug(
        "Metadata cache settings",
        extra={
            "use_cache": request.use_cache,
            "refresh_metadata": request.refresh_metadata,
            "force_refresh": request.force_refresh,
        },
    )

    try:
        from superset.daos.dataset import DatasetDAO

        tool = ModelGetInfoCore(
            dao_class=DatasetDAO,  # type: ignore[arg-type]
            output_schema=DatasetInfo,
            error_schema=DatasetError,
            serializer=serialize_dataset_object,
            supports_slug=False,  # Datasets don't have slugs
            logger=logger,
        )

        result = tool.run_tool(request.identifier)

        if isinstance(result, DatasetInfo):
            ctx.info(
                "Dataset information retrieved successfully",
                extra={
                    "dataset_id": result.id,
                    "table_name": result.table_name,
                    "columns_count": len(result.columns) if result.columns else 0,
                    "metrics_count": len(result.metrics) if result.metrics else 0,
                },
            )
        else:
            ctx.warning(
                "Dataset retrieval failed",
                extra={"error_type": result.error_type, "error": result.error},
            )

        return result

    except Exception as e:
        ctx.error(
            "Dataset information retrieval failed",
            extra={
                "identifier": request.identifier,
                "error": str(e),
                "error_type": type(e).__name__,
            },
        )
        return DatasetError(
            error=f"Failed to get dataset info: {str(e)}", error_type="InternalError"
        )
