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
SQL Lab MCP Tools

Combined SQL Lab tools for executing queries and opening SQL Lab with context.
"""

import logging
from urllib.parse import urlencode

from fastmcp import Context

from superset.mcp_service.app import mcp
from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.sql_lab.execute_sql_core import ExecuteSqlCore
from superset.mcp_service.sql_lab.schemas import (
    ExecuteSqlRequest,
    ExecuteSqlResponse,
    OpenSqlLabRequest,
    SqlLabResponse,
)

logger = logging.getLogger(__name__)


@mcp.tool
@mcp_auth_hook
async def execute_sql(request: ExecuteSqlRequest, ctx: Context) -> ExecuteSqlResponse:
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
    await ctx.info(
        "Starting SQL execution",
        extra={
            "database_id": request.database_id,
            "timeout": request.timeout,
            "limit": request.limit,
            "schema": request.schema_name,
        },
    )

    # Log SQL query details (truncated for security)
    sql_preview = request.sql[:100] + "..." if len(request.sql) > 100 else request.sql
    await ctx.debug(
        "SQL query details",
        extra={
            "sql_preview": sql_preview,
            "sql_length": len(request.sql),
            "has_parameters": bool(request.parameters),
        },
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
                "SQL execution completed successfully",
                extra={
                    "rows_returned": row_count,
                    "query_duration_ms": getattr(result, "query_duration_ms", None),
                },
            )
        else:
            await ctx.info(
                "SQL execution completed", extra={"status": "no_data_returned"}
            )

        return result

    except Exception as e:
        await ctx.error(
            "SQL execution failed",
            extra={"error": str(e), "database_id": request.database_id},
        )
        raise


@mcp.tool
@mcp_auth_hook
def open_sql_lab_with_context(
    request: OpenSqlLabRequest, ctx: Context
) -> SqlLabResponse:
    """
    Generate a URL to open SQL Lab with pre-populated context.

    This tool creates a SQL Lab URL with the specified database connection,
    schema, dataset context, and SQL query. The URL can be used to directly
    navigate users to a pre-configured SQL Lab session.

    Args:
        request: OpenSqlLabRequest with database_connection_id, schema,
                dataset_in_context, and sql parameters

    Returns:
        SqlLabResponse with the generated URL and context information
    """
    try:
        from superset.daos.database import DatabaseDAO

        # Validate database exists and is accessible
        database = DatabaseDAO.find_by_id(request.database_connection_id)
        if not database:
            return SqlLabResponse(
                url="",
                database_id=request.database_connection_id,
                schema_name=request.schema_name,
                title=request.title,
                error=f"Database with ID {request.database_connection_id} not found",
            )

        # Build query parameters for SQL Lab URL
        params = {
            "dbid": str(request.database_connection_id),
        }

        if request.schema_name:
            params["schema"] = request.schema_name

        if request.sql:
            params["sql"] = request.sql

        if request.title:
            params["title"] = request.title

        if request.dataset_in_context:
            # Add dataset context as a comment in the SQL if no SQL provided
            if not request.sql:
                context_comment = (
                    f"-- Context: Working with dataset '{request.dataset_in_context}'\n"
                    f"-- Database: {database.database_name}\n"
                )
                if request.schema_name:
                    context_comment += f"-- Schema: {request.schema_name}\n"
                    table_reference = (
                        f"{request.schema_name}.{request.dataset_in_context}"
                    )
                else:
                    table_reference = request.dataset_in_context

                context_comment += f"\nSELECT * FROM {table_reference} LIMIT 100;"
                params["sql"] = context_comment

        # Construct SQL Lab URL
        query_string = urlencode(params)
        url = f"/sqllab?{query_string}"

        logger.info(
            "Generated SQL Lab URL for database %s", request.database_connection_id
        )

        return SqlLabResponse(
            url=url,
            database_id=request.database_connection_id,
            schema_name=request.schema_name,
            title=request.title,
            error=None,
        )

    except Exception as e:
        logger.error("Error generating SQL Lab URL: %s", e)
        return SqlLabResponse(
            url="",
            database_id=request.database_connection_id,
            schema_name=request.schema_name,
            title=request.title,
            error=f"Failed to generate SQL Lab URL: {str(e)}",
        )
