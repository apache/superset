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

Tool for executing SQL queries against databases using the unified
Database.execute() API with RLS, template rendering, and security validation.
"""

from __future__ import annotations

import logging
from typing import Any

from fastmcp import Context
from superset_core.api.types import CacheOptions, QueryOptions, QueryResult, QueryStatus
from superset_core.mcp import tool

from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetErrorException, SupersetSecurityException
from superset.extensions import event_logger
from superset.mcp_service.sql_lab.schemas import (
    ColumnInfo,
    ExecuteSqlRequest,
    ExecuteSqlResponse,
    StatementInfo,
)
from superset.mcp_service.utils.schema_utils import parse_request

logger = logging.getLogger(__name__)


@tool(tags=["mutate"])
@parse_request(ExecuteSqlRequest)
async def execute_sql(request: ExecuteSqlRequest, ctx: Context) -> ExecuteSqlResponse:
    """Execute SQL query against database using the unified Database.execute() API."""
    await ctx.info(
        "Starting SQL execution: database_id=%s, timeout=%s, limit=%s, schema=%s"
        % (request.database_id, request.timeout, request.limit, request.schema_name)
    )

    # Log SQL query details (truncated for security)
    sql_preview = request.sql[:100] + "..." if len(request.sql) > 100 else request.sql
    await ctx.debug(
        "SQL query details: sql_preview=%r, sql_length=%s, has_template_params=%s"
        % (
            sql_preview,
            len(request.sql),
            bool(request.template_params),
        )
    )

    logger.info("Executing SQL query on database ID: %s", request.database_id)

    try:
        # Import inside function to avoid initialization issues
        from superset import db, security_manager
        from superset.models.core import Database

        # 1. Get database and check access
        with event_logger.log_context(action="mcp.execute_sql.db_validation"):
            database = (
                db.session.query(Database).filter_by(id=request.database_id).first()
            )
            if not database:
                raise SupersetErrorException(
                    SupersetError(
                        message=f"Database with ID {request.database_id} not found",
                        error_type=SupersetErrorType.DATABASE_NOT_FOUND_ERROR,
                        level=ErrorLevel.ERROR,
                    )
                )

            if not security_manager.can_access_database(database):
                raise SupersetSecurityException(
                    SupersetError(
                        message=(f"Access denied to database {database.database_name}"),
                        error_type=SupersetErrorType.DATABASE_SECURITY_ACCESS_ERROR,
                        level=ErrorLevel.ERROR,
                    )
                )

        # 2. Build QueryOptions and execute query
        cache_opts = CacheOptions(force_refresh=True) if request.force_refresh else None
        options = QueryOptions(
            catalog=request.catalog,
            schema=request.schema_name,
            limit=request.limit,
            timeout_seconds=request.timeout,
            template_params=request.template_params,
            dry_run=request.dry_run,
            cache=cache_opts,
        )

        # 3. Execute query
        with event_logger.log_context(action="mcp.execute_sql.query_execution"):
            result = database.execute(request.sql, options)

        # 4. Convert to MCP response format
        with event_logger.log_context(action="mcp.execute_sql.response_conversion"):
            response = _convert_to_response(result)

        # Log successful execution
        if response.success:
            await ctx.info(
                "SQL execution completed successfully: rows_returned=%s, "
                "execution_time=%s"
                % (
                    response.row_count,
                    response.execution_time,
                )
            )
        else:
            await ctx.info(
                "SQL execution failed: error=%s, error_type=%s"
                % (response.error, response.error_type)
            )

        return response

    except Exception as e:
        await ctx.error(
            "SQL execution failed: error=%s, database_id=%s"
            % (
                str(e),
                request.database_id,
            )
        )
        raise


def _convert_to_response(result: QueryResult) -> ExecuteSqlResponse:
    """Convert QueryResult to ExecuteSqlResponse."""
    if result.status != QueryStatus.SUCCESS:
        return ExecuteSqlResponse(
            success=False,
            error=result.error_message,
            error_type=result.status.value,
        )

    # Build statement info list
    statements = [
        StatementInfo(
            original_sql=stmt.original_sql,
            executed_sql=stmt.executed_sql,
            row_count=stmt.row_count,
            execution_time_ms=stmt.execution_time_ms,
        )
        for stmt in result.statements
    ]

    # Find the last statement with data (SELECT results).
    # For single statements this is the same as first.
    # For multi-statement queries (e.g., SET ...; SELECT ...) this skips
    # non-data statements and returns the actual query results.
    rows: list[dict[str, Any]] | None = None
    columns: list[ColumnInfo] | None = None
    row_count: int | None = None
    affected_rows: int | None = None

    data_stmt = None
    for stmt in reversed(result.statements):
        if stmt.data is not None:
            data_stmt = stmt
            break

    if data_stmt is not None and data_stmt.data is not None:
        # SELECT query - convert DataFrame
        df = data_stmt.data
        rows = df.to_dict(orient="records")
        columns = [ColumnInfo(name=col, type=str(df[col].dtype)) for col in df.columns]
        row_count = len(df)
    elif result.statements:
        # DML-only query
        last_stmt = result.statements[-1]
        affected_rows = last_stmt.row_count

    return ExecuteSqlResponse(
        success=True,
        rows=rows,
        columns=columns,
        row_count=row_count,
        affected_rows=affected_rows,
        execution_time=(
            result.total_execution_time_ms / 1000
            if result.total_execution_time_ms is not None
            else None
        ),
        statements=statements,
    )
