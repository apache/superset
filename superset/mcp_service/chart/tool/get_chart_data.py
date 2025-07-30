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
MCP tool: get_chart_data
"""

import logging

from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.mcp_app import mcp
from superset.mcp_service.pydantic_schemas.cache_schemas import CacheStatus
from superset.mcp_service.pydantic_schemas.chart_schemas import (
    ChartData,
    ChartError,
    DataColumn,
    GetChartDataRequest,
    PerformanceMetadata,
)

logger = logging.getLogger(__name__)


@mcp.tool
@mcp_auth_hook
def get_chart_data(request: GetChartDataRequest) -> ChartData | ChartError:  # noqa: C901
    """
    Get the underlying data for a chart with advanced cache control.

    This tool returns the actual data behind a chart, making it easy for LLM clients
    to understand and describe the chart contents without needing image rendering.

    Supports lookup by:
    - Numeric ID (e.g., 123)
    - UUID string (e.g., "a1b2c3d4-e5f6-7890-abcd-ef1234567890")

    Cache Control Features:
    - use_cache: Whether to use Superset's query result cache
    - force_refresh: Force refresh cached data
    - cache_timeout: Override default cache timeout for this query

    Returns chart data in a structured format with summary and detailed cache status.
    """
    try:
        from superset.daos.chart import ChartDAO
        from superset.utils import json as utils_json

        # Find the chart
        chart = None
        if isinstance(request.identifier, int) or (
            isinstance(request.identifier, str) and request.identifier.isdigit()
        ):
            chart_id = (
                int(request.identifier)
                if isinstance(request.identifier, str)
                else request.identifier
            )
            chart = ChartDAO.find_by_id(chart_id)
        else:
            # Try UUID lookup using DAO flexible method
            chart = ChartDAO.find_by_id(request.identifier, id_column="uuid")

        if not chart:
            return ChartError(
                error=f"No chart found with identifier: {request.identifier}",
                error_type="NotFound",
            )

        logger.info(f"Getting data for chart {chart.id}: {chart.slice_name}")

        import time

        start_time = time.time()

        try:
            # Get chart data using the existing API
            from superset.commands.chart.data.get_data_command import ChartDataCommand
            from superset.common.query_context_factory import QueryContextFactory

            # Parse the form_data to get query context
            form_data = utils_json.loads(chart.params) if chart.params else {}

            # Create a proper QueryContext using the factory with cache control
            factory = QueryContextFactory()
            query_context = factory.create(
                datasource={"id": chart.datasource_id, "type": chart.datasource_type},
                queries=[
                    {
                        "filters": form_data.get("filters", []),
                        "columns": form_data.get("groupby", []),
                        "metrics": form_data.get("metrics", []),
                        "row_limit": request.limit or 100,
                        "order_desc": True,
                        # Apply cache control from request
                        "cache_timeout": request.cache_timeout,
                    }
                ],
                form_data=form_data,
                # Use cache unless force_refresh is True
                force=request.force_refresh,
            )

            # Execute the query
            command = ChartDataCommand(query_context)
            result = command.run()

            # Extract data from result
            if result and "queries" in result and len(result["queries"]) > 0:
                query_result = result["queries"][0]
                data = query_result.get("data", [])
                raw_columns = query_result.get("colnames", [])

                # Create rich column metadata
                columns = []
                for col_name in raw_columns:
                    # Sample some values for metadata
                    sample_values = [
                        row.get(col_name)
                        for row in data[:3]
                        if row.get(col_name) is not None
                    ]

                    # Infer data type
                    data_type = "string"
                    if sample_values:
                        if all(isinstance(v, (int, float)) for v in sample_values):
                            data_type = "numeric"
                        elif all(isinstance(v, bool) for v in sample_values):
                            data_type = "boolean"

                    columns.append(
                        DataColumn(
                            name=col_name,
                            display_name=col_name.replace("_", " ").title(),
                            data_type=data_type,
                            sample_values=sample_values[:3],
                            null_count=sum(
                                1 for row in data if row.get(col_name) is None
                            ),
                            unique_count=len({str(row.get(col_name)) for row in data}),
                        )
                    )

                # Cache status information (moved up from below)
                cache_hit = query_result.get("is_cached", False)
                cache_status = CacheStatus(
                    cache_hit=cache_hit,
                    cache_type="query" if cache_hit else "none",
                    cache_age_seconds=query_result.get("cache_dttm"),
                    refreshed=request.force_refresh,
                )

                # Generate insights and recommendations
                insights = []
                if len(data) > 100:
                    insights.append(
                        "Large dataset - consider filtering for better performance"
                    )
                if len(raw_columns) > 10:
                    insights.append("Many columns available - focus on key metrics")

                # Add cache-specific insights
                if cache_status.cache_hit:
                    if (
                        cache_status.cache_age_seconds
                        and cache_status.cache_age_seconds > 3600
                    ):
                        hours_old = cache_status.cache_age_seconds // 3600
                        insights.append(
                            f"Data is from cache ({hours_old}h old) - "
                            "consider refreshing for latest data"
                        )
                    else:
                        insights.append("Data served from cache for fast response")
                else:
                    insights.append("Fresh data retrieved from database")

                recommended_visualizations = []
                if any(
                    "time" in col.lower() or "date" in col.lower()
                    for col in raw_columns
                ):
                    recommended_visualizations.extend(["line chart", "time series"])
                if len(raw_columns) <= 3:
                    recommended_visualizations.extend(["bar chart", "scatter plot"])

                # Performance metadata with cache awareness
                execution_time = int((time.time() - start_time) * 1000)
                performance_status = (
                    "cache_hit" if cache_status.cache_hit else "fresh_query"
                )
                optimization_suggestions = []

                if not cache_status.cache_hit and execution_time > 5000:
                    optimization_suggestions.append(
                        "Consider using cache for this slow query"
                    )
                elif (
                    cache_status.cache_hit
                    and cache_status.cache_age_seconds
                    and cache_status.cache_age_seconds > 86400
                ):
                    optimization_suggestions.append(
                        "Cache is old - consider refreshing"
                    )

                performance = PerformanceMetadata(
                    query_duration_ms=execution_time,
                    cache_status=performance_status,
                    optimization_suggestions=optimization_suggestions,
                )

                # Generate comprehensive summary with cache info
                cache_info = ""
                if cache_status.cache_hit:
                    age_info = (
                        f" (cached {cache_status.cache_age_seconds // 60}m ago)"
                        if cache_status.cache_age_seconds
                        else " (cached)"
                    )
                    cache_info = age_info

                summary_parts = [
                    f"Chart '{chart.slice_name}' ({chart.viz_type})",
                    f"Contains {len(data)} rows across {len(raw_columns)} columns"
                    f"{cache_info}",
                ]

                if data and len(data) > 0:
                    summary_parts.append(
                        f"Sample data includes: {', '.join(raw_columns[:3])}"
                    )

                summary = ". ".join(summary_parts)

                return ChartData(
                    chart_id=chart.id,
                    chart_name=chart.slice_name or f"Chart {chart.id}",
                    chart_type=chart.viz_type or "unknown",
                    columns=columns,
                    data=data[: request.limit] if request.limit else data,
                    row_count=len(data),
                    total_rows=query_result.get("rowcount"),
                    summary=summary,
                    insights=insights,
                    data_quality={
                        "completeness": 1.0
                        - (
                            sum(col.null_count for col in columns)
                            / max(len(data) * len(columns), 1)
                        )
                    },
                    recommended_visualizations=recommended_visualizations,
                    performance=performance,
                    cache_status=cache_status,
                )
            else:
                return ChartError(
                    error=f"No data available for chart {chart.id}", error_type="NoData"
                )

        except Exception as data_error:
            logger.error(f"Data retrieval error for chart {chart.id}: {data_error}")
            return ChartError(
                error=f"Error retrieving chart data: {str(data_error)}",
                error_type="DataError",
            )

    except Exception as e:
        logger.error(f"Error in get_chart_data: {e}")
        return ChartError(
            error=f"Failed to get chart data: {str(e)}", error_type="InternalError"
        )
