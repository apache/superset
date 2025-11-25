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
Execute SQL MCP Tool

Tool for executing SQL queries against databases with security validation
and timeout protection.
"""

import logging

from fastmcp import Context
from superset_core.mcp import tool

from superset.mcp_service.sql_lab.execute_sql_core import ExecuteSqlCore
from superset.mcp_service.sql_lab.schemas import (
    ExecuteSqlRequest,
    ExecuteSqlResponse,
)
from superset.mcp_service.utils.schema_utils import parse_request

logger = logging.getLogger(__name__)


@tool
@parse_request(ExecuteSqlRequest)
async def execute_sql(request: ExecuteSqlRequest, ctx: Context) -> ExecuteSqlResponse:
    """Execute SQL query against database.

    Returns query results with security validation and timeout protection.
    """
    await ctx.info(
        "Starting SQL execution: database_id=%s, timeout=%s, limit=%s, schema=%s"
        % (request.database_id, request.timeout, request.limit, request.schema_name)
    )

    # Log SQL query details (truncated for security)
    sql_preview = request.sql[:100] + "..." if len(request.sql) > 100 else request.sql
    await ctx.debug(
        "SQL query details: sql_preview=%r, sql_length=%s, has_parameters=%s"
        % (
            sql_preview,
            len(request.sql),
            bool(request.parameters),
        )
    )

    logger.info("Executing SQL query on database ID: %s", request.database_id)

    try:
        # Use the ExecuteSqlCore to handle all the logic
        sql_tool = ExecuteSqlCore(use_command_mode=False, logger=logger)
        result = sql_tool.run_tool(request)

        # Log successful execution
        if hasattr(result, "data") and result.data:
            row_count = len(result.data) if isinstance(result.data, list) else 1
            await ctx.info(
                "SQL execution completed successfully: rows_returned=%s, "
                "query_duration_ms=%s"
                % (
                    row_count,
                    getattr(result, "query_duration_ms", None),
                )
            )
        else:
            await ctx.info("SQL execution completed: status=no_data_returned")

        return result

    except Exception as e:
        await ctx.error(
            "SQL execution failed: error=%s, database_id=%s"
            % (
                str(e),
                request.database_id,
            )
        )
        raise
