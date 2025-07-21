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

import logging
from typing import Annotated

from pydantic import Field

from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.mcp_app import mcp
from superset.mcp_service.model_tools import ModelGetInfoTool
from superset.mcp_service.pydantic_schemas import ChartError, ChartInfo
from superset.mcp_service.pydantic_schemas.chart_schemas import serialize_chart_object

logger = logging.getLogger(__name__)


@mcp.tool
@mcp_auth_hook
def get_chart_info(
    chart_id: Annotated[
        int, Field(description="ID of the chart to retrieve information for")
    ],
) -> ChartInfo | ChartError:
    """
    Get detailed information about a specific chart.
    Returns a ChartInfo model or ChartError on error.
    """
    from superset.daos.chart import ChartDAO

    tool = ModelGetInfoTool(
        dao_class=ChartDAO,
        output_schema=ChartInfo,
        error_schema=ChartError,
        serializer=serialize_chart_object,
        logger=logger,
    )
    return tool.run(chart_id)
