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
from superset.mcp_service.pydantic_schemas.chart_schemas import (
    ChartData,
    ChartError,
    GetChartDataRequest,
)

logger = logging.getLogger(__name__)


@mcp.tool
@mcp_auth_hook
def get_chart_data(request: GetChartDataRequest) -> ChartData | ChartError:
    """
    Get the underlying data for a chart in a text-friendly format.

    This tool returns the actual data behind a chart, making it easy for LLM clients
    to understand and describe the chart contents without needing image rendering.

    Supports lookup by:
    - Numeric ID (e.g., 123)
    - UUID string (e.g., "a1b2c3d4-e5f6-7890-abcd-ef1234567890")

    Returns chart data in a structured format with summary.
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

        try:
            # Get chart data using the existing API
            from superset.commands.chart.data.get_data_command import ChartDataCommand
            from superset.common.query_context_factory import QueryContextFactory

            # Parse the form_data to get query context
            form_data = utils_json.loads(chart.params) if chart.params else {}

            # Create a proper QueryContext using the factory
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
                    }
                ],
                form_data=form_data,
                force=False,
            )

            # Execute the query
            command = ChartDataCommand(query_context)
            result = command.run()

            # Extract data from result
            if result and "queries" in result and len(result["queries"]) > 0:
                query_result = result["queries"][0]
                data = query_result.get("data", [])
                columns = query_result.get("colnames", [])

                # Generate summary
                summary_parts = [
                    f"Chart '{chart.slice_name}' ({chart.viz_type})",
                    f"Contains {len(data)} rows of data",
                ]

                if columns:
                    summary_parts.append(f"Columns: {', '.join(columns)}")

                if data and len(data) > 0:
                    summary_parts.append(
                        f"Sample data shows values like: {str(data[0])[:200]}..."
                    )

                summary = ". ".join(summary_parts)

                return ChartData(
                    chart_id=chart.id,
                    chart_name=chart.slice_name,
                    chart_type=chart.viz_type or "unknown",
                    columns=columns,
                    data=data[: request.limit] if request.limit else data,
                    row_count=len(data),
                    total_rows=query_result.get("rowcount"),
                    summary=summary,
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
