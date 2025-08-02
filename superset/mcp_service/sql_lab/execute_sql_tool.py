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
Generic SQL execution tool for MCP service.
"""

import logging
from typing import Any, Optional

from superset.mcp_service.schemas.sql_lab_schemas import (
    ExecuteSqlRequest,
    ExecuteSqlResponse,
)


class ExecuteSqlTool:
    """
    Generic tool for executing SQL queries with security validation.

    This tool provides a high-level interface for SQL execution that can be used
    by different MCP tools or other components. It handles:
    - Database access validation
    - SQL query validation (DML permissions, disallowed functions)
    - Parameter substitution
    - Query execution with timeout
    - Result formatting

    The tool can work in two modes:
    1. Simple mode: Direct SQL execution using sql_lab_utils (default)
    2. Command mode: Using ExecuteSqlCommand for full SQL Lab features
    """

    def __init__(
        self,
        use_command_mode: bool = False,
        logger: Optional[logging.Logger] = None,
    ) -> None:
        self.use_command_mode = use_command_mode
        self.logger = logger or logging.getLogger(__name__)

    def execute(self, request: ExecuteSqlRequest) -> ExecuteSqlResponse:
        """
        Execute SQL query and return results.

        Args:
            request: ExecuteSqlRequest with database_id, sql, and optional parameters

        Returns:
            ExecuteSqlResponse with success status, results, or error information
        """
        try:
            # Import inside method to avoid initialization issues
            from superset.mcp_service.sql_lab.sql_lab_utils import check_database_access

            # Check database access
            database = check_database_access(request.database_id)

            if self.use_command_mode:
                # Use full SQL Lab command for complex queries
                return self._execute_with_command(request, database)
            else:
                # Use simplified execution for basic queries
                return self._execute_simple(request, database)

        except Exception as e:
            # Handle errors and return error response with proper error types
            self.logger.error(f"Error executing SQL: {e}", exc_info=True)
            return self._handle_execution_error(e)

    def _execute_simple(
        self,
        request: ExecuteSqlRequest,
        database: Any,
    ) -> ExecuteSqlResponse:
        """Execute SQL using simplified sql_lab_utils."""
        # Import inside method to avoid initialization issues
        from superset.mcp_service.sql_lab.sql_lab_utils import execute_sql_query

        results = execute_sql_query(
            database=database,
            sql=request.sql,
            schema=request.schema_name,
            limit=request.limit,
            timeout=request.timeout,
            parameters=request.parameters,
        )

        return ExecuteSqlResponse(
            success=True,
            rows=results.get("rows"),
            columns=results.get("columns"),
            row_count=results.get("row_count"),
            affected_rows=results.get("affected_rows"),
            query_id=None,  # Not available in simple mode
            execution_time=results.get("execution_time"),
            error=None,
            error_type=None,
        )

    def _execute_with_command(
        self,
        request: ExecuteSqlRequest,
        database: Any,
    ) -> ExecuteSqlResponse:
        """Execute SQL using full SQL Lab command (not implemented yet)."""
        # This would use ExecuteSqlCommand for full SQL Lab features
        # Including query caching, async execution, complex parsing, etc.
        # For now, we'll fall back to simple execution
        self.logger.info("Command mode not fully implemented, using simple mode")
        return self._execute_simple(request, database)

        # Future implementation would look like:
        # context = SqlJsonExecutionContext(
        #     database_id=request.database_id,
        #     sql=request.sql,
        #     schema=request.schema_name,
        #     limit=request.limit,
        #     # ... other context fields
        # )
        #
        # command = ExecuteSqlCommand(
        #     execution_context=context,
        #     query_dao=QueryDAO(),
        #     database_dao=DatabaseDAO(),
        #     # ... other dependencies
        # )
        #
        # result = command.run()
        # return self._format_command_result(result)

    def _handle_execution_error(self, e: Exception) -> ExecuteSqlResponse:
        """Map exceptions to error responses."""
        error_type = self._get_error_type(e)
        return ExecuteSqlResponse(
            success=False,
            error=str(e),
            error_type=error_type,
            rows=None,
            columns=None,
            row_count=None,
            affected_rows=None,
            query_id=None,
            execution_time=None,
        )

    def _get_error_type(self, e: Exception) -> str:
        """Determine error type from exception."""
        # Import inside method to avoid initialization issues
        from superset.exceptions import (
            SupersetDisallowedSQLFunctionException,
            SupersetDMLNotAllowedException,
            SupersetErrorException,
            SupersetSecurityException,
            SupersetTimeoutException,
        )

        if isinstance(e, SupersetSecurityException):
            return "SECURITY_ERROR"
        elif isinstance(e, SupersetTimeoutException):
            return "TIMEOUT"
        elif isinstance(e, SupersetDMLNotAllowedException):
            return "DML_NOT_ALLOWED"
        elif isinstance(e, SupersetDisallowedSQLFunctionException):
            return "DISALLOWED_FUNCTION"
        elif isinstance(e, SupersetErrorException):
            return self._extract_superset_error_type(e)
        else:
            return "EXECUTION_ERROR"

    def _extract_superset_error_type(self, e: Exception) -> str:
        """Extract error type from SupersetErrorException."""
        if hasattr(e, "error") and hasattr(e.error, "error_type"):
            error_type_name = e.error.error_type.name
            # Map common error type patterns
            if "INVALID_PAYLOAD" in error_type_name:
                return "INVALID_PAYLOAD_FORMAT_ERROR"
            elif "DATABASE_NOT_FOUND" in error_type_name:
                return "DATABASE_NOT_FOUND_ERROR"
            elif "SECURITY" in error_type_name:
                return "SECURITY_ERROR"
            elif "TIMEOUT" in error_type_name:
                return "TIMEOUT"
            elif "DML_NOT_ALLOWED" in error_type_name:
                return "DML_NOT_ALLOWED"
            else:
                return error_type_name
        return "EXECUTION_ERROR"

    def _format_command_result(
        self, command_result: dict[str, Any]
    ) -> ExecuteSqlResponse:
        """Format ExecuteSqlCommand result into ExecuteSqlResponse."""
        # This would extract relevant fields from command result
        # Placeholder implementation for future use
        return ExecuteSqlResponse(
            success=command_result.get("success", False),
            rows=command_result.get("data"),
            columns=command_result.get("columns"),
            row_count=command_result.get("row_count"),
            affected_rows=command_result.get("affected_rows"),
            query_id=command_result.get("query_id"),
            execution_time=command_result.get("execution_time"),
            error=command_result.get("error"),
            error_type=command_result.get("error_type"),
        )
