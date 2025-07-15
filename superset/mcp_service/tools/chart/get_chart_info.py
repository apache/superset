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
from superset.mcp_service.pydantic_schemas import ChartInfo, ChartError
from superset.mcp_service.pydantic_schemas.chart_schemas import serialize_chart_object
from datetime import datetime, timezone
from superset.daos.chart import ChartDAO
from pydantic import Field
import logging

logger = logging.getLogger(__name__)

def get_chart_info(
    chart_id: Annotated[
        int,
        Field(description="ID of the chart to retrieve information for")
    ]
) -> ChartInfo | ChartError:
    """
    Get detailed information about a specific chart.
    Returns a ChartInfo model or ChartError on error.
    """
    try:
        chart = ChartDAO.find_by_id(chart_id)
        if chart is None:
            error_data = ChartError(
                error=f"Chart with ID {chart_id} not found",
                error_type="not_found",
                timestamp=datetime.now(timezone.utc)
            )
            logger.warning(f"ChartInfo {chart_id} error: not_found - not found")
            return error_data
        response = serialize_chart_object(chart)
        logger.info(f"ChartInfo response created successfully for chart {chart.id}")
        return response
    except Exception as context_error:
        error_msg = f"Error within Flask app context: {str(context_error)}"
        logger.error(error_msg, exc_info=True)
        raise
    except Exception as e:
        error_msg = f"Unexpected error in get_chart_info: {str(e)}"
        logger.error(error_msg, exc_info=True)
        raise 
