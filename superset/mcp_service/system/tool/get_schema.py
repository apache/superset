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
Unified schema discovery tool for MCP service.

This tool consolidates schema discovery for all model types (chart, dataset,
dashboard) into a single endpoint, reducing token usage and API calls.
"""

import logging
from typing import Literal

from fastmcp import Context
from superset_core.mcp import tool

from superset.daos.chart import ChartDAO
from superset.daos.dashboard import DashboardDAO
from superset.daos.dataset import DatasetDAO
from superset.mcp_service.common.schema_discovery import (
    CHART_DEFAULT_COLUMNS,
    CHART_SEARCH_COLUMNS,
    CHART_SELECT_COLUMNS,
    CHART_SORTABLE_COLUMNS,
    DASHBOARD_DEFAULT_COLUMNS,
    DASHBOARD_SEARCH_COLUMNS,
    DASHBOARD_SELECT_COLUMNS,
    DASHBOARD_SORTABLE_COLUMNS,
    DATASET_DEFAULT_COLUMNS,
    DATASET_SEARCH_COLUMNS,
    DATASET_SELECT_COLUMNS,
    DATASET_SORTABLE_COLUMNS,
    GetSchemaRequest,
    GetSchemaResponse,
    ModelSchemaInfo,
)
from superset.mcp_service.mcp_core import ModelGetSchemaCore
from superset.mcp_service.utils.schema_utils import parse_request

logger = logging.getLogger(__name__)

# Create core instances for each model type
_chart_schema_core = ModelGetSchemaCore(
    model_type="chart",
    dao_class=ChartDAO,
    output_schema=ModelSchemaInfo,
    select_columns=CHART_SELECT_COLUMNS,
    sortable_columns=CHART_SORTABLE_COLUMNS,
    default_columns=CHART_DEFAULT_COLUMNS,
    search_columns=CHART_SEARCH_COLUMNS,
    default_sort="changed_on",
    default_sort_direction="desc",
    logger=logger,
)

_dataset_schema_core = ModelGetSchemaCore(
    model_type="dataset",
    dao_class=DatasetDAO,
    output_schema=ModelSchemaInfo,
    select_columns=DATASET_SELECT_COLUMNS,
    sortable_columns=DATASET_SORTABLE_COLUMNS,
    default_columns=DATASET_DEFAULT_COLUMNS,
    search_columns=DATASET_SEARCH_COLUMNS,
    default_sort="changed_on",
    default_sort_direction="desc",
    logger=logger,
)

_dashboard_schema_core = ModelGetSchemaCore(
    model_type="dashboard",
    dao_class=DashboardDAO,
    output_schema=ModelSchemaInfo,
    select_columns=DASHBOARD_SELECT_COLUMNS,
    sortable_columns=DASHBOARD_SORTABLE_COLUMNS,
    default_columns=DASHBOARD_DEFAULT_COLUMNS,
    search_columns=DASHBOARD_SEARCH_COLUMNS,
    default_sort="changed_on",
    default_sort_direction="desc",
    logger=logger,
)

# Map model types to their core instances
_SCHEMA_CORES: dict[
    Literal["chart", "dataset", "dashboard"], ModelGetSchemaCore[ModelSchemaInfo]
] = {
    "chart": _chart_schema_core,
    "dataset": _dataset_schema_core,
    "dashboard": _dashboard_schema_core,
}


@tool(tags=["discovery"])
@parse_request(GetSchemaRequest)
async def get_schema(request: GetSchemaRequest, ctx: Context) -> GetSchemaResponse:
    """
    Get comprehensive schema metadata for a model type.

    Returns all information needed to construct valid queries:
    - select_columns: All columns available for selection
    - filter_columns: Filterable columns with their operators
    - sortable_columns: Columns valid for order_column
    - default_select: Columns returned when select_columns not specified
    - search_columns: Columns searched by the search parameter

    This unified tool consolidates discovery, reducing API calls and token usage.
    Use this instead of calling get_chart_available_filters,
    get_dataset_available_filters, and get_dashboard_available_filters separately.

    Args:
        model_type: One of "chart", "dataset", or "dashboard"

    Returns:
        Comprehensive schema information for the requested model type
    """
    await ctx.info(f"Getting schema for model_type={request.model_type}")

    # Get the appropriate core instance with defensive lookup
    core = _SCHEMA_CORES.get(request.model_type)
    if core is None:
        await ctx.error(f"Unsupported model_type: {request.model_type}")
        raise ValueError(
            f"Unsupported model_type: {request.model_type}. "
            f"Valid types are: {', '.join(_SCHEMA_CORES.keys())}"
        )

    schema_info = core.run_tool()

    await ctx.debug(
        f"Schema for {request.model_type}: "
        f"{len(schema_info.select_columns)} select columns, "
        f"{len(schema_info.filter_columns)} filter columns, "
        f"{len(schema_info.sortable_columns)} sortable columns"
    )

    return GetSchemaResponse(schema_info=schema_info)
