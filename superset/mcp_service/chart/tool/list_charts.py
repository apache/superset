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
from typing import Any, cast, TYPE_CHECKING

from fastmcp import Context

if TYPE_CHECKING:
    from superset.models.slice import Slice

from superset.mcp_service.app import mcp
from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.chart.schemas import (
    ChartFilter,
    ChartInfo,
    ChartLike,
    ChartList,
    ListChartsRequest,
    serialize_chart_object,
)
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
async def list_charts(request: ListChartsRequest, ctx: Context) -> ChartList:
    """List charts with filtering and search.

    Returns chart metadata including id, name, and viz_type.

    Sortable columns for order_column: id, slice_name, viz_type,
    datasource_name, description, changed_on, created_on
    """
    await ctx.info(
        "Listing charts: page=%s, page_size=%s, search=%s"
        % (
            request.page,
            request.page_size,
            request.search,
        )
    )
    await ctx.debug(
        "Chart listing filters: filters=%s, order_column=%s, order_direction=%s"
        % (
            len(request.filters),
            request.order_column,
            request.order_direction,
        )
    )

    from superset.daos.chart import ChartDAO

    def _serialize_chart(obj: "Slice | None", cols: Any) -> ChartInfo | None:
        """Serialize chart object with proper type casting."""
        return serialize_chart_object(cast(ChartLike | None, obj))

    tool = ModelListCore(
        dao_class=ChartDAO,
        output_schema=ChartInfo,
        item_serializer=_serialize_chart,
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

    try:
        result = tool.run_tool(
            filters=request.filters,
            search=request.search,
            select_columns=request.select_columns,
            order_column=request.order_column,
            order_direction=request.order_direction,
            page=max(request.page - 1, 0),
            page_size=request.page_size,
        )
        count = len(result.charts) if hasattr(result, "charts") else 0
        total_pages = getattr(result, "total_pages", None)
        await ctx.info(
            "Charts listed successfully: count=%s, total_pages=%s"
            % (count, total_pages)
        )
        return result
    except Exception as e:
        await ctx.error("Failed to list charts: %s" % (str(e),))
        raise
