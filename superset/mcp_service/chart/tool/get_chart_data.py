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
from typing import Any, Dict, List

from fastmcp import Context

from superset.mcp_service.app import mcp
from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.chart.schemas import (
    ChartData,
    ChartError,
    DataColumn,
    GetChartDataRequest,
    PerformanceMetadata,
)
from superset.mcp_service.utils.cache_utils import get_cache_status_from_result

logger = logging.getLogger(__name__)


@mcp.tool
@mcp_auth_hook
async def get_chart_data(  # noqa: C901
    request: GetChartDataRequest, ctx: Context
) -> ChartData | ChartError:
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
    await ctx.info(
        "Starting chart data retrieval",
        extra={
            "identifier": request.identifier,
            "format": request.format,
            "limit": request.limit,
        },
    )
    await ctx.debug(
        "Cache settings",
        extra={
            "use_cache": request.use_cache,
            "force_refresh": request.force_refresh,
            "cache_timeout": request.cache_timeout,
        },
    )

    try:
        await ctx.report_progress(1, 4, "Looking up chart")
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
            await ctx.debug(
                "Performing ID-based chart lookup", extra={"chart_id": chart_id}
            )
            chart = ChartDAO.find_by_id(chart_id)
        else:
            await ctx.debug(
                "Performing UUID-based chart lookup", extra={"uuid": request.identifier}
            )
            # Try UUID lookup using DAO flexible method
            chart = ChartDAO.find_by_id(request.identifier, id_column="uuid")

        if not chart:
            await ctx.error("Chart not found", extra={"identifier": request.identifier})
            return ChartError(
                error=f"No chart found with identifier: {request.identifier}",
                error_type="NotFound",
            )

        await ctx.info(
            "Chart found successfully",
            extra={
                "chart_id": chart.id,
                "chart_name": chart.slice_name,
                "viz_type": chart.viz_type,
            },
        )
        logger.info("Getting data for chart %s: %s", chart.id, chart.slice_name)

        import time

        start_time = time.time()

        try:
            await ctx.report_progress(2, 4, "Preparing data query")
            # Get chart data using the existing API
            from superset.commands.chart.data.get_data_command import ChartDataCommand
            from superset.common.query_context_factory import QueryContextFactory

            # Parse the form_data to get query context
            form_data = utils_json.loads(chart.params) if chart.params else {}
            await ctx.debug(
                "Chart form data parsed",
                extra={
                    "has_filters": bool(form_data.get("filters")),
                    "has_groupby": bool(form_data.get("groupby")),
                    "has_metrics": bool(form_data.get("metrics")),
                },
            )

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

            await ctx.report_progress(3, 4, "Executing data query")
            await ctx.debug(
                "Query execution parameters",
                extra={
                    "datasource_id": chart.datasource_id,
                    "datasource_type": chart.datasource_type,
                    "row_limit": request.limit or 100,
                    "force_refresh": request.force_refresh,
                },
            )

            # Execute the query
            command = ChartDataCommand(query_context)
            result = command.run()

            # Handle empty query results for certain chart types
            if not result or ("queries" not in result) or len(result["queries"]) == 0:
                await ctx.warning(
                    "Empty query results",
                    extra={"chart_id": chart.id, "chart_type": chart.viz_type},
                )
                return ChartError(
                    error=f"No query results returned for chart {chart.id}. "
                    f"This may occur with chart types like big_number.",
                    error_type="EmptyQuery",
                )

            # Extract data from result (we've already validated it exists above)
            query_result = result["queries"][0]
            data = query_result.get("data", [])
            raw_columns = query_result.get("colnames", [])

            await ctx.debug(
                "Query results received",
                extra={
                    "row_count": len(data),
                    "column_count": len(raw_columns),
                    "has_cache_key": bool(query_result.get("cache_key")),
                },
            )

            # Check if we have data to work with
            if not data:
                await ctx.warning(
                    "No data in query results", extra={"chart_id": chart.id}
                )
                return ChartError(
                    error=f"No data available for chart {chart.id}", error_type="NoData"
                )

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
                        null_count=sum(1 for row in data if row.get(col_name) is None),
                        unique_count=len({str(row.get(col_name)) for row in data}),
                    )
                )

            # Cache status information using utility function
            cache_status = get_cache_status_from_result(
                query_result, force_refresh=request.force_refresh
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
                "time" in col.lower() or "date" in col.lower() for col in raw_columns
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
                optimization_suggestions.append("Cache is old - consider refreshing")

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

            # Handle different export formats
            if request.format == "csv":
                return _export_data_as_csv(
                    chart,
                    data[: request.limit] if request.limit else data,
                    raw_columns,
                    cache_status,
                    performance,
                )
            elif request.format == "excel":
                return _export_data_as_excel(
                    chart,
                    data[: request.limit] if request.limit else data,
                    raw_columns,
                    cache_status,
                    performance,
                )

            await ctx.report_progress(4, 4, "Building response")

            # Calculate data quality metrics
            data_completeness = 1.0 - (
                sum(col.null_count for col in columns)
                / max(len(data) * len(columns), 1)
            )

            await ctx.info(
                "Chart data retrieval completed successfully",
                extra={
                    "chart_id": chart.id,
                    "rows_returned": len(data),
                    "columns_returned": len(raw_columns),
                    "execution_time_ms": execution_time,
                    "cache_hit": cache_status.cache_hit,
                    "data_completeness": round(data_completeness, 3),
                },
            )

            # Default JSON format
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
                data_quality={"completeness": data_completeness},
                recommended_visualizations=recommended_visualizations,
                data_freshness=None,  # Add missing field
                performance=performance,
                cache_status=cache_status,
            )

        except Exception as data_error:
            await ctx.error(
                "Data retrieval failed",
                extra={
                    "chart_id": chart.id,
                    "error": str(data_error),
                    "error_type": type(data_error).__name__,
                },
            )
            logger.error("Data retrieval error for chart %s: %s", chart.id, data_error)
            return ChartError(
                error=f"Error retrieving chart data: {str(data_error)}",
                error_type="DataError",
            )

    except Exception as e:
        await ctx.error(
            "Chart data retrieval failed",
            extra={
                "identifier": request.identifier,
                "error": str(e),
                "error_type": type(e).__name__,
            },
        )
        logger.error("Error in get_chart_data: %s", e)
        return ChartError(
            error=f"Failed to get chart data: {str(e)}", error_type="InternalError"
        )


def _export_data_as_csv(
    chart: Any,
    data: List[Dict[str, Any]],
    columns: List[str],
    cache_status: Any,
    performance: Any,
) -> "ChartData":
    """Export chart data as CSV format."""
    import csv
    import io

    # Create CSV content
    output = io.StringIO()

    if data and columns:
        writer = csv.DictWriter(output, fieldnames=columns)
        writer.writeheader()

        # Write data rows
        for row in data:
            # Ensure all values are properly formatted for CSV
            csv_row = {}
            for col in columns:
                value = row.get(col, "")
                # Handle None values and convert to string
                if value is None:
                    csv_row[col] = ""
                elif isinstance(value, (list, dict)):
                    csv_row[col] = str(value)
                else:
                    csv_row[col] = value
            writer.writerow(csv_row)

    csv_content = output.getvalue()

    # Return as ChartData with CSV content in a special field
    from superset.mcp_service.chart.schemas import ChartData

    return ChartData(
        chart_id=chart.id,
        chart_name=chart.slice_name or f"Chart {chart.id}",
        chart_type=chart.viz_type or "unknown",
        columns=[],  # Not needed for CSV export
        data=[],  # CSV content is in csv_data field
        row_count=len(data),
        total_rows=len(data),
        summary=f"CSV export of chart '{chart.slice_name}' with {len(data)} rows",
        insights=[f"Data exported as CSV format ({len(csv_content)} characters)"],
        data_quality={},
        recommended_visualizations=[],
        data_freshness=None,
        performance=performance,
        cache_status=cache_status,
        # Store CSV content in data field as string for the response
        csv_data=csv_content,
        format="csv",
    )


def _export_data_as_excel(
    chart: Any,
    data: List[Dict[str, Any]],
    columns: List[str],
    cache_status: Any,
    performance: Any,
) -> "ChartData | ChartError":
    """Export chart data as Excel format."""
    try:
        excel_b64 = _create_excel_with_openpyxl(chart, data, columns)
        return _create_excel_chart_data(
            chart, data, excel_b64, performance, cache_status
        )
    except ImportError:
        return _try_xlsxwriter_fallback(chart, data, columns, cache_status, performance)


def _create_excel_with_openpyxl(
    chart: Any, data: List[Dict[str, Any]], columns: List[str]
) -> str:
    """Create Excel file using openpyxl."""
    import base64
    import io

    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.title = chart.slice_name[:31] if chart.slice_name else "Chart Data"

    if data and columns:
        _write_excel_headers(ws, columns)
        _write_excel_data(ws, data, columns)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return base64.b64encode(output.read()).decode()


def _write_excel_headers(ws: Any, columns: List[str]) -> None:
    """Write headers to Excel worksheet."""
    for idx, col in enumerate(columns, 1):
        ws.cell(row=1, column=idx, value=col)


def _write_excel_data(ws: Any, data: List[Dict[str, Any]], columns: List[str]) -> None:
    """Write data to Excel worksheet."""
    for row_idx, row in enumerate(data, 2):
        for col_idx, col in enumerate(columns, 1):
            value = row.get(col, "")
            if value is None:
                value = ""
            elif isinstance(value, (list, dict)):
                value = str(value)
            ws.cell(row=row_idx, column=col_idx, value=value)


def _try_xlsxwriter_fallback(
    chart: Any,
    data: List[Dict[str, Any]],
    columns: List[str],
    cache_status: Any,
    performance: Any,
) -> "ChartData | ChartError":
    """Try xlsxwriter as fallback for Excel export."""
    try:
        excel_b64 = _create_excel_with_xlsxwriter(chart, data, columns)
        return _create_excel_chart_data_xlsxwriter(
            chart, data, excel_b64, performance, cache_status
        )
    except ImportError:
        from superset.mcp_service.chart.schemas import ChartError

        return ChartError(
            error="Excel export requires openpyxl or xlsxwriter package",
            error_type="ExportError",
        )


def _create_excel_with_xlsxwriter(
    chart: Any, data: List[Dict[str, Any]], columns: List[str]
) -> str:
    """Create Excel file using xlsxwriter."""
    import base64
    import io

    import xlsxwriter

    output = io.BytesIO()
    workbook = xlsxwriter.Workbook(output, {"in_memory": True})
    sheet_name = chart.slice_name[:31] if chart.slice_name else "Chart Data"
    worksheet = workbook.add_worksheet(sheet_name)

    if data and columns:
        _write_xlsxwriter_data(worksheet, data, columns)

    workbook.close()
    output.seek(0)
    return base64.b64encode(output.read()).decode()


def _write_xlsxwriter_data(
    worksheet: Any, data: List[Dict[str, Any]], columns: List[str]
) -> None:
    """Write data to xlsxwriter worksheet."""
    # Write headers
    for idx, col in enumerate(columns):
        worksheet.write(0, idx, col)

    # Write data
    for row_idx, row in enumerate(data):
        for col_idx, col in enumerate(columns):
            value = row.get(col, "")
            if value is None:
                value = ""
            elif isinstance(value, (list, dict)):
                value = str(value)
            worksheet.write(row_idx + 1, col_idx, value)


def _create_excel_chart_data(
    chart: Any,
    data: List[Dict[str, Any]],
    excel_b64: str,
    performance: Any,
    cache_status: Any,
) -> "ChartData":
    """Create ChartData response for Excel export (openpyxl)."""
    from superset.mcp_service.chart.schemas import ChartData

    chart_name = chart.slice_name or f"Chart {chart.id}"
    summary = f"Excel export of chart '{chart.slice_name}' with {len(data)} rows"

    return ChartData(
        chart_id=chart.id,
        chart_name=chart_name,
        chart_type=chart.viz_type or "unknown",
        columns=[],
        data=[],
        row_count=len(data),
        total_rows=len(data),
        summary=summary,
        insights=["Data exported as Excel format (base64 encoded)"],
        data_quality={},
        recommended_visualizations=[],
        data_freshness=None,
        performance=performance,
        cache_status=cache_status,
        excel_data=excel_b64,
        format="excel",
    )


def _create_excel_chart_data_xlsxwriter(
    chart: Any,
    data: List[Dict[str, Any]],
    excel_b64: str,
    performance: Any,
    cache_status: Any,
) -> "ChartData":
    """Create ChartData response for Excel export (xlsxwriter)."""
    from superset.mcp_service.chart.schemas import ChartData

    chart_name = chart.slice_name or f"Chart {chart.id}"
    summary = f"Excel export of chart '{chart.slice_name}' with {len(data)} rows"

    return ChartData(
        chart_id=chart.id,
        chart_name=chart_name,
        chart_type=chart.viz_type or "unknown",
        columns=[],
        data=[],
        row_count=len(data),
        total_rows=len(data),
        summary=summary,
        insights=["Data exported as Excel format (base64 encoded, xlsxwriter)"],
        data_quality={},
        recommended_visualizations=[],
        data_freshness=None,
        performance=performance,
        cache_status=cache_status,
        excel_data=excel_b64,
        format="excel",
    )
