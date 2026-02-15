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
List datasets FastMCP tool (Advanced with metadata cache control)

This module contains the FastMCP tool for listing datasets using
advanced filtering with clear, unambiguous request schema and metadata cache control.
"""

import logging
from typing import TYPE_CHECKING

from fastmcp import Context
from superset_core.mcp import tool

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlaTable

from superset.extensions import event_logger
from superset.mcp_service.dataset.schemas import (
    DatasetFilter,
    DatasetInfo,
    DatasetList,
    ListDatasetsRequest,
    serialize_dataset_object,
)
from superset.mcp_service.mcp_core import ModelListCore
from superset.mcp_service.utils.schema_utils import parse_request

logger = logging.getLogger(__name__)

# Minimal defaults for reduced token usage - users can request more via select_columns
DEFAULT_DATASET_COLUMNS = [
    "id",
    "table_name",
    "schema",
    "uuid",
]

SORTABLE_DATASET_COLUMNS = [
    "id",
    "table_name",
    "schema",
    "changed_on",
    "created_on",
]


@tool(tags=["core"])
@parse_request(ListDatasetsRequest)
async def list_datasets(request: ListDatasetsRequest, ctx: Context) -> DatasetList:
    """List datasets with filtering and search.

    Returns dataset metadata including columns and metrics.

    Sortable columns for order_column: id, table_name, schema, changed_on,
    created_on
    """
    await ctx.info(
        "Listing datasets: page=%s, page_size=%s, search=%s"
        % (
            request.page,
            request.page_size,
            request.search,
        )
    )
    await ctx.debug(
        "Dataset listing parameters: filters=%s, order_column=%s, "
        "order_direction=%s, select_columns=%s"
        % (
            request.filters,
            request.order_column,
            request.order_direction,
            request.select_columns,
        )
    )
    await ctx.debug(
        "Metadata cache settings: use_cache=%s, refresh_metadata=%s, force_refresh=%s"
        % (
            request.use_cache,
            request.refresh_metadata,
            request.force_refresh,
        )
    )

    try:
        from superset.daos.dataset import DatasetDAO
        from superset.mcp_service.common.schema_discovery import (
            DATASET_SORTABLE_COLUMNS,
            get_all_column_names,
            get_dataset_columns,
        )

        # Get all column names dynamically from the model
        all_columns = get_all_column_names(get_dataset_columns())

        def _serialize_dataset(
            obj: "SqlaTable | None", cols: list[str] | None
        ) -> DatasetInfo | None:
            """Serialize dataset (filtering via model_serializer)."""
            return serialize_dataset_object(obj)

        # Create tool with standard serialization
        tool = ModelListCore(
            dao_class=DatasetDAO,
            output_schema=DatasetInfo,
            item_serializer=_serialize_dataset,
            filter_type=DatasetFilter,
            default_columns=DEFAULT_DATASET_COLUMNS,
            search_columns=["schema", "sql", "table_name", "uuid"],
            list_field_name="datasets",
            output_list_schema=DatasetList,
            all_columns=all_columns,
            sortable_columns=DATASET_SORTABLE_COLUMNS,
            logger=logger,
        )

        with event_logger.log_context(action="mcp.list_datasets.query"):
            result = tool.run_tool(
                filters=request.filters,
                search=request.search,
                select_columns=request.select_columns,
                order_column=request.order_column,
                order_direction=request.order_direction,
                page=max(request.page - 1, 0),
                page_size=request.page_size,
            )

        await ctx.info(
            "Datasets listed successfully: count=%s, total_count=%s, total_pages=%s"
            % (
                len(result.datasets) if hasattr(result, "datasets") else 0,
                getattr(result, "total_count", None),
                getattr(result, "total_pages", None),
            )
        )

        # Apply field filtering via serialization context
        # Always use columns_requested (either explicit select_columns or defaults)
        # This triggers DatasetInfo._filter_fields_by_context for each dataset
        columns_to_filter = result.columns_requested
        await ctx.debug(
            "Applying field filtering via serialization context: columns=%s"
            % (columns_to_filter,)
        )
        with event_logger.log_context(action="mcp.list_datasets.serialization"):
            return result.model_dump(
                mode="json",
                context={"select_columns": columns_to_filter},
            )

    except Exception as e:
        await ctx.error(
            "Dataset listing failed: page=%s, page_size=%s, error=%s, error_type=%s"
            % (
                request.page,
                request.page_size,
                str(e),
                type(e).__name__,
            )
        )
        raise
