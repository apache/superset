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
Get available dataset filters FastMCP tool
"""
import logging
from superset.mcp_service.pydantic_schemas.dataset_schemas import DatasetAvailableFilters

logger = logging.getLogger(__name__)

def get_dataset_available_filters() -> DatasetAvailableFilters:
    """
    Get information about available dataset filters and their operators
    Returns:
        DatasetAvailableFilters
    """
    try:
        filters = {
            "table_name": {
                "name": "table_name",
                "description": "Filter by table name (partial match)",
                "type": "string",
                "operators": ["sw", "in", "eq"],
                "values": None
            },
            "schema": {
                "name": "schema",
                "description": "Filter by schema name",
                "type": "string",
                "operators": ["eq", "in"],
                "values": None
            },
            "database_name": {
                "name": "database_name",
                "description": "Filter by database name",
                "type": "string",
                "operators": ["eq", "in"],
                "values": None
            },
            "changed_by": {
                "name": "changed_by",
                "description": "Filter by last modifier",
                "type": "string",
                "operators": ["in", "eq"],
                "values": None
            },
            "created_by": {
                "name": "created_by",
                "description": "Filter by creator",
                "type": "string",
                "operators": ["in", "eq"],
                "values": None
            },
            "owner": {
                "name": "owner",
                "description": "Filter by owner",
                "type": "string",
                "operators": ["in", "eq"],
                "values": None
            },
            "is_virtual": {
                "name": "is_virtual",
                "description": "Filter by whether the dataset is virtual (uses SQL)",
                "type": "boolean",
                "operators": ["eq"],
                "values": [True, False]
            },
            "tags": {
                "name": "tags",
                "description": "Filter by tags",
                "type": "string",
                "operators": ["in"],
                "values": None
            }
        }
        operators = ["eq", "ne", "in", "nin", "sw", "ew"]
        columns = [
            "id", "table_name", "schema", "database_name", "description", "changed_by",
            "changed_on", "created_by", "created_on", "is_virtual", "database_id", "schema_perm",
            "url", "tags", "owners"
        ]
        response = DatasetAvailableFilters(
            filters=filters,
            operators=operators,
            columns=columns
        )
        logger.info("Successfully retrieved available dataset filters and operators")
        return response
    except Exception as e:
        error_msg = f"Unexpected error in get_dataset_available_filters: {str(e)}"
        logger.error(error_msg, exc_info=True)
        raise 
