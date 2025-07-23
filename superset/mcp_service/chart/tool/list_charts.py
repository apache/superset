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
MCP tool: list_charts (advanced filtering with clear request schema)
"""

import logging

from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.mcp_app import mcp
from superset.mcp_service.model_tools import ModelListTool
from superset.mcp_service.pydantic_schemas import ChartInfo, ChartList
from superset.mcp_service.pydantic_schemas.chart_schemas import (
    ChartFilter,
    ListChartsRequest,
    serialize_chart_object,
)

logger = logging.getLogger(__name__)

DEFAULT_CHART_COLUMNS = [
    "id",
    "slice_name",
    "viz_type",
    "datasource_name",
    "description",
    "changed_by_name",
    "created_by_name",
    "changed_on",
    "created_on",
]


@mcp.tool
@mcp_auth_hook
def list_charts(request: ListChartsRequest) -> ChartList:
    """
    List charts with advanced filtering, search, and column selection.

    Uses a clear request object schema to avoid validation ambiguity with
    arrays/strings.
    All parameters are properly typed and have sensible defaults.
    """

    from superset.daos.chart import ChartDAO

    tool = ModelListTool(
        dao_class=ChartDAO,
        output_schema=ChartInfo,
        item_serializer=lambda obj, cols: serialize_chart_object(obj),
        filter_type=ChartFilter,
        default_columns=DEFAULT_CHART_COLUMNS,
        search_columns=[
            "slice_name",
            "viz_type",
            "datasource_name",
            "description",
            "tags",
        ],
        list_field_name="charts",
        output_list_schema=ChartList,
        logger=logger,
    )
    return tool.run(
        filters=request.filters,
        search=request.search,
        select_columns=request.select_columns,
        order_column=request.order_column,
        order_direction=request.order_direction,
        page=max(request.page - 1, 0),
        page_size=request.page_size,
    )
