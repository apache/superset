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
MCP tool: list_charts (advanced filtering with metadata cache control)
"""

import logging

from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.chart.schemas import (
    ChartFilter,
    ChartInfo,
    ChartList,
    ListChartsRequest,
    serialize_chart_object,
)
from superset.mcp_service.mcp_app import mcp
from superset.mcp_service.mcp_core import ModelListCore

logger = logging.getLogger(__name__)

DEFAULT_CHART_COLUMNS = [
    "id",
    "slice_name",
    "viz_type",
    "uuid",
    "datasource_name",
    "description",
    "changed_by_name",
    "created_by_name",
    "changed_on",
    "created_on",
]

SORTABLE_CHART_COLUMNS = [
    "id",
    "slice_name",
    "viz_type",
    "datasource_name",
    "description",
    "changed_on",
    "created_on",
]


@mcp.tool
@mcp_auth_hook
def list_charts(request: ListChartsRequest) -> ChartList:
    """
    List charts with advanced filtering, search, and metadata cache control.

    Uses a clear request object schema to avoid validation ambiguity with
    arrays/strings. All parameters are properly typed and have sensible defaults.

    IMPORTANT FOR LLM CLIENTS:
    - When charts have URL fields, ALWAYS display them (e.g., "View chart at: {url}")
    - Note: 'url' is NOT in default columns - explicitly request it with select_columns
    - Example: select_columns=["id", "slice_name", "url"]

    Search columns: slice_name, description
    Sortable columns for order_column: id, slice_name, viz_type, datasource_name,
    description, changed_on, created_on

    Metadata Cache Control:
    - use_cache: Whether to use metadata cache for faster responses
    - refresh_metadata: Force refresh of metadata cache for fresh data

    When refresh_metadata=True, the tool will fetch fresh metadata from the database
    which is useful when database schema has changed.
    """

    from superset.daos.chart import ChartDAO

    tool = ModelListCore(
        dao_class=ChartDAO,  # type: ignore[arg-type]
        output_schema=ChartInfo,
        item_serializer=lambda obj, cols: serialize_chart_object(obj) if obj else None,  # type: ignore[arg-type]
        filter_type=ChartFilter,
        default_columns=DEFAULT_CHART_COLUMNS,
        search_columns=[
            "slice_name",
            "description",
        ],
        list_field_name="charts",
        output_list_schema=ChartList,
        logger=logger,
    )
    return tool.run_tool(
        filters=request.filters,
        search=request.search,
        select_columns=request.select_columns,
        order_column=request.order_column,
        order_direction=request.order_direction,
        page=max(request.page - 1, 0),
        page_size=request.page_size,
    )
