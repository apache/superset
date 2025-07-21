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
MCP tool: create_chart (polymorphic, viz_type-discriminated)
"""

from typing import Annotated, Union

from pydantic import Field

from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.mcp_app import mcp
from superset.mcp_service.pydantic_schemas.chart_schemas import (
    CreateSimpleChartResponse,
    EchartsAreaChartCreateRequest,
    EchartsTimeseriesBarChartCreateRequest,
    EchartsTimeseriesLineChartCreateRequest,
    serialize_chart_object,
    TableChartCreateRequest,  # Reuse response for now
)
from superset.utils import json


@mcp.tool
@mcp_auth_hook
def create_chart(
    request: Annotated[
        Union[
            EchartsTimeseriesLineChartCreateRequest,
            EchartsTimeseriesBarChartCreateRequest,
            EchartsAreaChartCreateRequest,
            TableChartCreateRequest,
        ],
        Field(
            discriminator="viz_type",
            description="Request object for creating a chart (polymorphic by viz_type)",
        ),
    ],
) -> CreateSimpleChartResponse:
    """
    Create a new chart (visualization) in Superset with a type-safe,
    viz_type-specific schema.
    Accepts ECharts timeseries line, bar, area, and table charts.
    """
    from superset.commands.chart.create import CreateChartCommand

    try:
        # Determine chart type and build form_data accordingly
        if isinstance(
            request,
            (
                EchartsTimeseriesLineChartCreateRequest,
                EchartsTimeseriesBarChartCreateRequest,
                EchartsAreaChartCreateRequest,
            ),
        ):
            # Remove x_axis from groupby if present
            x_axis_col = request.x_axis
            groupby_cols = request.groupby or []
            groupby_cols = [col for col in groupby_cols if col != x_axis_col]
            form_data = {
                "viz_type": request.viz_type,
                "x_axis": request.x_axis,
                "x_axis_sort": request.x_axis_sort,
                "metrics": request.metrics,
                "groupby": groupby_cols,
                "contributionMode": request.contribution_mode,
                "filters": request.filters or [],
                "series_limit": request.series_limit,
                "orderby": request.orderby or [],
                "row_limit": request.row_limit,
                "truncate_metric": request.truncate_metric,
                "show_empty_columns": request.show_empty_columns,
                "stack": request.stack,
                "area": request.area,
                "smooth": request.smooth,
                "show_value": request.show_value,
                "color_scheme": request.color_scheme,
                "legend_type": request.legend_type,
                "legend_orientation": request.legend_orientation,
                "tooltip_sorting": request.tooltip_sorting,
                "y_axis_format": request.y_axis_format,
                "y_axis_bounds": request.y_axis_bounds,
                "x_axis_time_format": request.x_axis_time_format,
                "rich_tooltip": request.rich_tooltip,
                "datasource": f"{request.datasource_id}__{request.datasource_type}",
            }
            # Remove None values
            form_data = {k: v for k, v in form_data.items() if v is not None}
            # Merge in extra_options if provided
            extra_options = getattr(request, "extra_options", None)
            if extra_options is not None:
                form_data.update(extra_options)
        elif isinstance(request, TableChartCreateRequest):
            form_data = {
                "viz_type": request.viz_type,
                "all_columns": request.all_columns,
                "metrics": request.metrics or [],
                "groupby": request.groupby or [],
                "adhoc_filters": request.adhoc_filters or [],
                "order_by_cols": request.order_by_cols or [],
                "row_limit": request.row_limit,
                "order_desc": request.order_desc,
                "datasource": f"{request.datasource_id}__{request.datasource_type}",
            }
        else:
            return CreateSimpleChartResponse(error="Unsupported chart type or viz_type")

        params = json.dumps(form_data)
        chart_data = {
            "slice_name": request.slice_name,
            "viz_type": request.viz_type,
            "datasource_id": request.datasource_id,
            "datasource_type": request.datasource_type,
            "params": params,
            "description": request.description,
            "owners": request.owners or [],
            "dashboards": request.dashboards or [],
        }
        command = CreateChartCommand(chart_data)
        chart = command.run()
        chart_item = serialize_chart_object(chart)
        # If return_embed is requested, build embed URLs/snippets
        embed_url = None
        thumbnail_url = None
        embed_html = None
        if getattr(request, "return_embed", False) and hasattr(chart, "id"):
            embed_url = f"/explore/?slice_id={chart.id}"
            thumbnail_url = f"/api/v1/chart/{chart.id}/thumbnail/"
            embed_html = (
                f'<iframe src="/explore/?slice_id={chart.id}" width="600" '
                f'height="400" frameborder="0" allowfullscreen></iframe>'
            )
        return CreateSimpleChartResponse(
            chart=chart_item,
            embed_url=embed_url,
            thumbnail_url=thumbnail_url,
            embed_html=embed_html,
        )
    except Exception as ex:
        return CreateSimpleChartResponse(error=str(ex))
