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
from typing import Callable

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.common.schema_discovery import (
    CHART_DEFAULT_COLUMNS,
    CHART_SEARCH_COLUMNS,
    CHART_SORTABLE_COLUMNS,
    DASHBOARD_DEFAULT_COLUMNS,
    DASHBOARD_SEARCH_COLUMNS,
    DASHBOARD_SORTABLE_COLUMNS,
    DATABASE_DEFAULT_COLUMNS,
    DATABASE_SEARCH_COLUMNS,
    DATABASE_SORTABLE_COLUMNS,
    DATASET_DEFAULT_COLUMNS,
    DATASET_SEARCH_COLUMNS,
    DATASET_SORTABLE_COLUMNS,
    get_chart_columns,
    get_dashboard_columns,
    get_database_columns,
    get_dataset_columns,
    GetSchemaRequest,
    GetSchemaResponse,
    ModelSchemaInfo,
)
from superset.mcp_service.constants import ModelType
from superset.mcp_service.mcp_core import ModelGetSchemaCore
from superset.mcp_service.privacy import (
    PrivacyError,
    remove_chart_data_model_columns,
    requires_data_model_metadata_access,
    user_can_view_data_model_metadata,
)

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


def _get_database_schema_core() -> ModelGetSchemaCore[ModelSchemaInfo]:
    """Create database schema core with dynamically extracted columns."""
    # Lazy import to avoid circular dependency at module load time
    from superset.daos.database import DatabaseDAO
    from superset.mcp_service.common.schema_discovery import DATABASE_EXCLUDE_COLUMNS

    return ModelGetSchemaCore(
        model_type="database",
        dao_class=DatabaseDAO,
        output_schema=ModelSchemaInfo,
        select_columns=get_database_columns(),
        sortable_columns=DATABASE_SORTABLE_COLUMNS,
        default_columns=DATABASE_DEFAULT_COLUMNS,
        search_columns=DATABASE_SEARCH_COLUMNS,
        default_sort="changed_on",
        default_sort_direction="desc",
        exclude_filter_columns=DATABASE_EXCLUDE_COLUMNS,
        logger=logger,
    )


# Map model types to their core factory functions
_SCHEMA_CORE_FACTORIES: dict[
    ModelType,
    Callable[[], ModelGetSchemaCore[ModelSchemaInfo]],
] = {
    "chart": _get_chart_schema_core,
    "dataset": _get_dataset_schema_core,
    "dashboard": _get_dashboard_schema_core,
    "database": _get_database_schema_core,
}


@tool(
    tags=["discovery"],
    class_permission_name="Dataset",
    annotations=ToolAnnotations(
        title="Get schema",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
@requires_data_model_metadata_access
async def get_schema(
    request: GetSchemaRequest, ctx: Context
) -> GetSchemaResponse | PrivacyError:
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
        model_type: One of "chart", "dataset", "dashboard", or "database"

    Returns:
        Comprehensive schema information for the requested model type
    """
    await ctx.info(f"Getting schema for model_type={request.model_type}")

    can_view_data_model_metadata = user_can_view_data_model_metadata()
    if not can_view_data_model_metadata and request.model_type in {
        "dataset",
        "database",
    }:
        await ctx.warning(
            "Schema discovery blocked by data-model privacy controls: model_type=%s",
            request.model_type,
        )
        return PrivacyError.create_data_model_metadata_denied()

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

    if not can_view_data_model_metadata and request.model_type == "chart":
        schema_info = schema_info.model_copy(deep=True)
        schema_info.select_columns = [
            column
            for column in schema_info.select_columns
            if column.name in remove_chart_data_model_columns([column.name])
        ]
        schema_info.filter_columns = {
            column: operators
            for column, operators in schema_info.filter_columns.items()
            if column in remove_chart_data_model_columns([column])
        }
        schema_info.sortable_columns = remove_chart_data_model_columns(
            schema_info.sortable_columns
        )
        schema_info.search_columns = remove_chart_data_model_columns(
            schema_info.search_columns
        )

    await ctx.debug(
        f"Schema for {request.model_type}: "
        f"{len(schema_info.select_columns)} select columns, "
        f"{len(schema_info.filter_columns)} filter columns, "
        f"{len(schema_info.sortable_columns)} sortable columns"
    )

    return GetSchemaResponse(schema_info=schema_info)
