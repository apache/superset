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
Column metadata is extracted dynamically from SQLAlchemy models.
"""

import logging
from typing import Callable, Literal

from fastmcp import Context
from superset_core.mcp import tool

from superset.extensions import event_logger
from superset.mcp_service.common.schema_discovery import (
    CHART_DEFAULT_COLUMNS,
    CHART_SEARCH_COLUMNS,
    CHART_SORTABLE_COLUMNS,
    DASHBOARD_DEFAULT_COLUMNS,
    DASHBOARD_SEARCH_COLUMNS,
    DASHBOARD_SORTABLE_COLUMNS,
    DATASET_DEFAULT_COLUMNS,
    DATASET_SEARCH_COLUMNS,
    DATASET_SORTABLE_COLUMNS,
    get_chart_columns,
    get_dashboard_columns,
    get_dataset_columns,
    GetSchemaRequest,
    GetSchemaResponse,
    ModelSchemaInfo,
)
from superset.mcp_service.mcp_core import ModelGetSchemaCore
from superset.mcp_service.utils.schema_utils import parse_request

logger = logging.getLogger(__name__)


def _get_chart_schema_core() -> ModelGetSchemaCore[ModelSchemaInfo]:
    """Create chart schema core with dynamically extracted columns."""
    # Lazy import to avoid circular dependency at module load time
    from superset.daos.chart import ChartDAO

    return ModelGetSchemaCore(
        model_type="chart",
        dao_class=ChartDAO,
        output_schema=ModelSchemaInfo,
        select_columns=get_chart_columns(),
        sortable_columns=CHART_SORTABLE_COLUMNS,
        default_columns=CHART_DEFAULT_COLUMNS,
        search_columns=CHART_SEARCH_COLUMNS,
        default_sort="changed_on",
        default_sort_direction="desc",
        logger=logger,
    )


def _get_dataset_schema_core() -> ModelGetSchemaCore[ModelSchemaInfo]:
    """Create dataset schema core with dynamically extracted columns."""
    # Lazy import to avoid circular dependency at module load time
    from superset.daos.dataset import DatasetDAO

    return ModelGetSchemaCore(
        model_type="dataset",
        dao_class=DatasetDAO,
        output_schema=ModelSchemaInfo,
        select_columns=get_dataset_columns(),
        sortable_columns=DATASET_SORTABLE_COLUMNS,
        default_columns=DATASET_DEFAULT_COLUMNS,
        search_columns=DATASET_SEARCH_COLUMNS,
        default_sort="changed_on",
        default_sort_direction="desc",
        logger=logger,
    )


def _get_dashboard_schema_core() -> ModelGetSchemaCore[ModelSchemaInfo]:
    """Create dashboard schema core with dynamically extracted columns."""
    # Lazy import to avoid circular dependency at module load time
    from superset.daos.dashboard import DashboardDAO

    return ModelGetSchemaCore(
        model_type="dashboard",
        dao_class=DashboardDAO,
        output_schema=ModelSchemaInfo,
        select_columns=get_dashboard_columns(),
        sortable_columns=DASHBOARD_SORTABLE_COLUMNS,
        default_columns=DASHBOARD_DEFAULT_COLUMNS,
        search_columns=DASHBOARD_SEARCH_COLUMNS,
        default_sort="changed_on",
        default_sort_direction="desc",
        logger=logger,
    )


# Map model types to their core factory functions
_SCHEMA_CORE_FACTORIES: dict[
    Literal["chart", "dataset", "dashboard"],
    Callable[[], ModelGetSchemaCore[ModelSchemaInfo]],
] = {
    "chart": _get_chart_schema_core,
    "dataset": _get_dataset_schema_core,
    "dashboard": _get_dashboard_schema_core,
}


@tool(tags=["discovery"])
@parse_request(GetSchemaRequest)
async def get_schema(request: GetSchemaRequest, ctx: Context) -> GetSchemaResponse:
    """
    Get comprehensive schema metadata for a model type.

    Returns all information needed to construct valid queries:
    - select_columns: All columns available for selection (dynamically extracted)
    - filter_columns: Filterable columns with their operators
    - sortable_columns: Columns valid for order_column
    - default_select: Columns returned when select_columns not specified
    - search_columns: Columns searched by the search parameter

    This unified tool consolidates discovery, reducing API calls and token usage.
    Column metadata is extracted dynamically from SQLAlchemy models.

    Args:
        model_type: One of "chart", "dataset", or "dashboard"

    Returns:
        Comprehensive schema information for the requested model type
    """
    await ctx.info(f"Getting schema for model_type={request.model_type}")

    # Get the appropriate core factory with defensive lookup
    factory = _SCHEMA_CORE_FACTORIES.get(request.model_type)
    if factory is None:
        await ctx.error(f"Unsupported model_type: {request.model_type}")
        raise ValueError(
            f"Unsupported model_type: {request.model_type}. "
            f"Valid types are: {', '.join(_SCHEMA_CORE_FACTORIES.keys())}"
        )

    # Create core instance and run (columns extracted dynamically)
    with event_logger.log_context(action="mcp.get_schema.discovery"):
        core = factory()
        schema_info = core.run_tool()

    await ctx.debug(
        f"Schema for {request.model_type}: "
        f"{len(schema_info.select_columns)} select columns, "
        f"{len(schema_info.filter_columns)} filter columns, "
        f"{len(schema_info.sortable_columns)} sortable columns"
    )

    return GetSchemaResponse(schema_info=schema_info)
