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
MCP tool: get_chart_info
"""
from typing import Any, Dict, Optional, Annotated
from superset.mcp_service.pydantic_schemas import ChartInfoResponse, ChartErrorResponse
from superset.mcp_service.dao_wrapper import MCPDAOWrapper
from superset.mcp_service.pydantic_schemas.chart_schemas import serialize_chart_object
from datetime import datetime
from superset.daos.chart import ChartDAO
from pydantic import Field

def get_chart_info(
    chart_id: Annotated[
        int,
        Field(description="ID of the chart to retrieve information for")
    ]
) -> ChartInfoResponse | ChartErrorResponse:
    """
    Get detailed information about a chart by ID (MCP tool).
    Parameters
    ----------
    chart_id : int
        ID of the chart to retrieve information for.
    Returns
    -------
    ChartInfoResponse or ChartErrorResponse
        Detailed chart information or error response.
    """
    try:
        chart_wrapper = MCPDAOWrapper(ChartDAO, "chart")
        chart, error_type, error_message = chart_wrapper.info(chart_id)
        if not chart:
            return ChartErrorResponse(error=error_message or "Chart not found", error_type=error_type or "not_found", timestamp=datetime.utcnow())
        chart_info = serialize_chart_object(chart)
        return ChartInfoResponse(chart=chart_info)
    except Exception as ex:
        return ChartErrorResponse(error=str(ex), error_type="get_chart_info_error", timestamp=datetime.utcnow()) 