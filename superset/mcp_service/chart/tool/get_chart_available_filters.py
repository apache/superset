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
from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.pydantic_schemas import ChartAvailableFiltersResponse
from superset.mcp_service.mcp_app import mcp
from superset.mcp_service.model_tools import ModelGetAvailableFiltersTool

logger = logging.getLogger(__name__)

@mcp.tool
@mcp_auth_hook
def get_chart_available_filters() -> ChartAvailableFiltersResponse:
    """
    Return available chart filter fields, types, and supported operators (MCP tool).
    """
    from superset.daos.chart import ChartDAO
    tool = ModelGetAvailableFiltersTool(
        dao_class=ChartDAO,
        output_schema=ChartAvailableFiltersResponse,
        logger=logger,
    )
    return tool.run() 
