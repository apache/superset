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
MCP tool: execute_sql

This tool executes SQL queries against Superset databases and returns results
in a structured format, with full security and validation support.
"""

import logging

from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.mcp_app import mcp
from superset.mcp_service.sql_lab.schemas import (
    ExecuteSqlRequest,
    ExecuteSqlResponse,
)
from superset.mcp_service.sql_lab.tool.execute_sql_tool import ExecuteSqlTool

logger = logging.getLogger(__name__)

# Create a single instance of the tool to reuse
sql_tool = ExecuteSqlTool(use_command_mode=False, logger=logger)


@mcp.tool
@mcp_auth_hook
def execute_sql(request: ExecuteSqlRequest) -> ExecuteSqlResponse:
    """
    Execute SQL queries against Superset databases.

    This tool provides direct SQL execution capabilities with full security
    validation, query limits, and timeout protection. It supports both
    SELECT queries (returning results) and DML operations (INSERT, UPDATE, DELETE)
    when allowed by the database configuration.

    Security features:
    - Database access permission validation
    - Disallowed SQL function checking
    - DML operation restrictions
    - Query timeout enforcement
    - Result size limits

    Args:
        request: ExecuteSqlRequest with database_id, sql, schema, limit,
                timeout, and optional parameters

    Returns:
        ExecuteSqlResponse with query results or error information
    """
    logger.info(f"Executing SQL query on database ID: {request.database_id}")

    # Use the ExecuteSqlTool to handle all the logic
    return sql_tool.execute(request)
