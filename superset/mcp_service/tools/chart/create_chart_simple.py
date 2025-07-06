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
MCP tool: create_chart_simple
"""
from typing import Annotated
from pydantic import Field
from superset.mcp_service.pydantic_schemas.chart_schemas import (
    CreateSimpleChartRequest, CreateSimpleChartResponse, ChartListItem
)
from superset.commands.chart.create import CreateChartCommand
from superset.mcp_service.pydantic_schemas.chart_schemas import serialize_chart_object
import json

def create_chart_simple(
    request: Annotated[
        CreateSimpleChartRequest,
        Field(description="Request object for creating a simple chart")
    ]
) -> CreateSimpleChartResponse:
    """
    Create a new chart (visualization) in Superset with a simple, fixed schema.

    This tool allows you to programmatically create a chart by specifying the core chart configuration fields, without needing to construct a full UI form payload. It is designed for LLMs and automation agents to easily create basic charts for a given dataset.

    **Required fields:**
      - slice_name: Name of the chart (string)
      - viz_type: Chart type (e.g., "bar", "line", "table", "pie")
      - datasource_id: The ID of the dataset to use (integer)
      - metrics: List of metric names to display (list of strings)
      - dimensions: List of dimension (column) names to group by (list of strings)

    **Optional fields:**
      - filters: List of filter objects (column, operator, value)
      - description: Chart description (string)
      - owners: List of owner user IDs (list of integers)
      - dashboards: List of dashboard IDs to add this chart to (list of integers)
      - return_embed: If true, return embeddable chart assets (embed_url, thumbnail_url, embed_html) in the response.

    The tool will build a minimal Superset chart configuration and create the chart. The created chart will be available in the Superset UI and can be added to dashboards.

    **Example usage:**
    ```python
    create_chart_simple(
        request=CreateSimpleChartRequest(
            slice_name="Total Sales by Product Line (2024)",
            viz_type="bar",
            datasource_id=23,
            metrics=["sales"],
            dimensions=["product_line"],
            filters=[{"col": "year", "opr": "eq", "value": 2024}],
            description="Total sales by product line for 2024 (bar chart).",
            return_embed=True
        )
    )
    ```

    **Returns:**
      - On success: The created chart info (ID, name, type, etc.), and if requested, embeddable chart assets (embed_url, thumbnail_url, embed_html)
      - On error: An error message describing what went wrong

    **LLM Guidance:**
      - Use this tool when you want to create a new chart for a dataset, given the chart type, metrics, and dimensions.
      - You must know the dataset ID and the names of the metrics and columns you want to use.
      - Set return_embed=True if you want to immediately embed the chart in a chat or web UI.
      - For more advanced chart types or customizations, use a specialized chart creation tool or agent if available.
    """
    try:
        # Build minimal form_data and params for the chart
        form_data = {
            "metrics": request.metrics,
            "groupby": request.dimensions,
            "filters": request.filters or [],
            "viz_type": request.viz_type,
            "datasource": f"{request.datasource_id}__{request.datasource_type}",
        }
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
            base_url = "/explore/?slice_id="
            # If you have a public URL, replace with your Superset base URL
            embed_url = f"/explore/?slice_id={chart.id}"
            thumbnail_url = f"/api/v1/chart/{chart.id}/thumbnail/"
            embed_html = f'<iframe src="/explore/?slice_id={chart.id}" width="600" height="400" frameborder="0" allowfullscreen></iframe>'
        return CreateSimpleChartResponse(
            chart=chart_item,
            embed_url=embed_url,
            thumbnail_url=thumbnail_url,
            embed_html=embed_html,
        )
    except Exception as ex:
        return CreateSimpleChartResponse(error=str(ex)) 
