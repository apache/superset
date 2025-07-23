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
MCP tool: list_charts (advanced filtering)
"""

import logging
from typing import Annotated, List, Literal, Optional

from pydantic import Field, PositiveInt

from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.mcp_app import mcp
from superset.mcp_service.model_tools import ModelListTool
from superset.mcp_service.pydantic_schemas import ChartInfo, ChartList
from superset.mcp_service.pydantic_schemas.chart_schemas import ChartFilter

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
def list_charts(
    filters: Annotated[
        List[ChartFilter] | None,
        Field(description="List of filter objects (column, operator, value)"),
    ] = None,
    select_columns: Annotated[
        List[str] | None,
        Field(description="List of columns to select (overrides 'columns' and 'keys')"),
    ] = None,
    search: Annotated[
        Optional[str],
        Field(description="Text search string to match against chart fields"),
    ] = None,
    order_column: Annotated[
        Optional[str],
        Field(description="Column to order results by"),
    ] = None,
    order_direction: Annotated[
        Optional[Literal["asc", "desc"]],
        Field(description="Direction to order results ('asc' or 'desc')"),
    ] = "asc",
    page: Annotated[
        PositiveInt, Field(description="Page number for pagination (1-based)")
    ] = 1,
    page_size: Annotated[
        PositiveInt, Field(description="Number of items per page")
    ] = 100,
) -> ChartList:
    """
    List charts with advanced filtering, search, and column selection.
    """

    from superset.daos.chart import ChartDAO

    tool = ModelListTool(
        dao_class=ChartDAO,
        output_schema=ChartInfo,
        item_serializer=lambda obj, cols: ChartInfo(**dict(obj._mapping))
        if not cols
        else ChartInfo(**{k: v for k, v in dict(obj._mapping).items() if k in cols}),
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
        filters=filters,
        search=search,
        select_columns=select_columns,
        order_column=order_column,
        order_direction=order_direction,
        page=max(page - 1, 0),
        page_size=page_size,
    )
