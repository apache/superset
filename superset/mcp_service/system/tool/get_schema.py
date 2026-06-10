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
from superset.mcp_service.auth import MCPPermissionDeniedError
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
    get_report_info_columns,
    GetSchemaRequest,
    GetSchemaResponse,
    ModelSchemaInfo,
    REPORT_DEFAULT_COLUMNS,
    REPORT_FILTER_COLUMNS,
    REPORT_SEARCH_COLUMNS,
    REPORT_SORTABLE_COLUMNS,
)
from superset.mcp_service.constants import ModelType
from superset.mcp_service.mcp_core import ModelGetSchemaCore
from superset.mcp_service.privacy import (
    PrivacyError,
    remove_chart_data_model_columns,
    SELF_REFERENCING_FILTER_COLUMNS,
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
        exclude_filter_columns=set(SELF_REFERENCING_FILTER_COLUMNS),
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
        exclude_filter_columns=set(SELF_REFERENCING_FILTER_COLUMNS),
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
        exclude_filter_columns=set(SELF_REFERENCING_FILTER_COLUMNS),
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


def _get_report_schema_core() -> ModelGetSchemaCore[ModelSchemaInfo]:
    """Create report schema core with ReportInfo-derived columns."""
    # Lazy import to avoid circular dependency at module load time
    from superset.daos.report import ReportScheduleDAO

    return ModelGetSchemaCore(
        model_type="report",
        dao_class=ReportScheduleDAO,
        output_schema=ModelSchemaInfo,
        select_columns=get_report_info_columns(),
        sortable_columns=REPORT_SORTABLE_COLUMNS,
        default_columns=REPORT_DEFAULT_COLUMNS,
        search_columns=REPORT_SEARCH_COLUMNS,
        default_sort="changed_on",
        default_sort_direction="desc",
        exclude_filter_columns=set(SELF_REFERENCING_FILTER_COLUMNS),
        include_filter_columns=REPORT_FILTER_COLUMNS,
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
    "report": _get_report_schema_core,
}

# Maps each model type to the FAB class permission name used by its tools.
# Used for per-model-type inline RBAC checks instead of a single static
# class_permission_name on the @tool decorator.
_MODEL_TYPE_CLASS_PERMISSION: dict[ModelType, str] = {
    "chart": "Chart",
    "dataset": "Dataset",
    "dashboard": "Dashboard",
    "database": "Database",
    "report": "ReportSchedule",
}


@tool(
    tags=["discovery"],
    annotations=ToolAnnotations(
        title="Get schema",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
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
        model_type: One of "chart", "dataset", "dashboard", "database", or "report"

    Returns:
        Comprehensive schema information for the requested model type
    """
    await ctx.info(f"Getting schema for model_type={request.model_type}")

    # Per-model-type RBAC check (replaces the static class_permission_name on @tool,
    # which wrongly gated all schema types behind Dataset permission).
    class_permission = _MODEL_TYPE_CLASS_PERMISSION.get(request.model_type)
    if class_permission:
        from flask import current_app, g

        from superset import security_manager

        if current_app.config.get("MCP_RBAC_ENABLED", True) and not (
            security_manager.can_access("can_read", class_permission)
        ):
            user_str = getattr(getattr(g, "user", None), "username", None)
            logger.warning(
                "get_schema RBAC denied: user=%s type=%s view=%s",
                user_str,
                request.model_type,
                class_permission,
            )
            raise MCPPermissionDeniedError(
                permission_name="can_read",
                view_name=class_permission,
                user=user_str,
                tool_name="get_schema",
            )

    if request.model_type == "report":
        from superset import is_feature_enabled

        if not is_feature_enabled("ALERT_REPORTS"):
            raise ValueError(
                "The Alerts & Reports feature is disabled on this instance."
            )

    can_view_data_model_metadata = user_can_view_data_model_metadata()
    if not can_view_data_model_metadata and request.model_type in {
        "dataset",
        "database",
    }:
        await ctx.warning(
            "Schema discovery blocked by data-model privacy controls: "
            f"model_type={request.model_type}"
        )
        return PrivacyError.create_data_model_metadata_denied()

    # Get the appropriate core factory with defensive lookup
    factory = _SCHEMA_CORE_FACTORIES.get(request.model_type)
    if factory is None:
        await ctx.warning(f"Unsupported model_type: {request.model_type}")
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
        allowed_chart_columns = set(
            remove_chart_data_model_columns(
                [column.name for column in schema_info.select_columns]
            )
        )
        schema_info.select_columns = [
            column
            for column in schema_info.select_columns
            if column.name in allowed_chart_columns
        ]
        schema_info.filter_columns = {
            column: operators
            for column, operators in schema_info.filter_columns.items()
            if column in allowed_chart_columns
        }
        schema_info.sortable_columns = [
            column
            for column in schema_info.sortable_columns
            if column in allowed_chart_columns
        ]
        schema_info.default_select = [
            column
            for column in schema_info.default_select
            if column in allowed_chart_columns
        ]
        schema_info.search_columns = [
            column
            for column in schema_info.search_columns
            if column in allowed_chart_columns
        ]

    await ctx.debug(
        f"Schema for {request.model_type}: "
        f"{len(schema_info.select_columns)} select columns, "
        f"{len(schema_info.filter_columns)} filter columns, "
        f"{len(schema_info.sortable_columns)} sortable columns"
    )

    return GetSchemaResponse(schema_info=schema_info)
