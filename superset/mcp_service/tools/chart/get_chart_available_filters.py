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
from superset.mcp_service.pydantic_schemas import ChartAvailableFiltersResponse

def get_chart_available_filters() -> ChartAvailableFiltersResponse:
    """
    Return available chart filter fields, types, and supported operators (MCP tool).
    """
    filters = {
        "slice_name": {"type": "string", "description": "Chart name"},
        "viz_type": {"type": "string", "description": "Visualization type"},
        "datasource_name": {"type": "string", "description": "Datasource name"},
        "changed_by": {"type": "string", "description": "Last modifier (username)"},
        "created_by": {"type": "string", "description": "Chart creator (username)"},
        "owner": {"type": "string", "description": "Chart owner (username)"},
        "tags": {"type": "string", "description": "Chart tags (comma-separated)"},
    }
    operators = ["eq", "ne", "sw", "in", "not_in", "like", "ilike", "gt", "lt", "gte", "lte", "is_null", "is_not_null"]
    columns = [
        "id", "slice_name", "viz_type", "datasource_name", "datasource_type", "url", "description", "cache_timeout", "changed_by", "created_by", "owner", "tags"
    ]
    return ChartAvailableFiltersResponse(filters=filters, operators=operators, columns=columns) 
