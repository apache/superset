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
MCP tool: get_chart_available_filters
"""

import logging

from fastmcp import Context
from superset_core.mcp import tool

from superset.mcp_service.chart.schemas import (
    ChartAvailableFiltersResponse,
    GetChartAvailableFiltersRequest,
)
from superset.mcp_service.mcp_core import ModelGetAvailableFiltersCore
from superset.mcp_service.utils.schema_utils import parse_request

logger = logging.getLogger(__name__)


@tool(tags=["discovery"])
@parse_request(GetChartAvailableFiltersRequest)
def get_chart_available_filters(
    request: GetChartAvailableFiltersRequest, ctx: Context
) -> ChartAvailableFiltersResponse:
    """Get available chart filter fields and operators."""
    from superset.daos.chart import ChartDAO

    tool = ModelGetAvailableFiltersCore(
        dao_class=ChartDAO,
        output_schema=ChartAvailableFiltersResponse,
        logger=logger,
    )
    return tool.run_tool()
