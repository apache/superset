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
Utility functions for SQL Lab MCP tools.

This module contains helper functions for SQL execution, validation,
and database access that are shared across SQL Lab tools.
"""

import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)


def check_database_access(database_id: int) -> Any:
    """Check if user has access to the database."""
    # Import inside function to avoid initialization issues
    from superset import db, security_manager
    from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
    from superset.exceptions import SupersetErrorException, SupersetSecurityException
    from superset.models.core import Database

    # Use session query to ensure relationships are loaded
    database = db.session.query(Database).filter_by(id=database_id).first()

    if not database:
        raise SupersetErrorException(
            SupersetError(
                message=f"Database with ID {database_id} not found",
                error_type=SupersetErrorType.DATABASE_NOT_FOUND_ERROR,
                level=ErrorLevel.ERROR,
            )
        )

    # Check database access permissions
    if not security_manager.can_access_database(database):
        raise SupersetSecurityException(
            SupersetError(
                message=f"Access denied to database {database.database_name}",
                error_type=SupersetErrorType.DATABASE_SECURITY_ACCESS_ERROR,
                level=ErrorLevel.ERROR,
            )
        )

    return database


def validate_sql_query(sql: str, database: Any) -> None:
    """Validate SQL query for security and syntax."""
    # Import inside function to avoid initialization issues
    from flask import current_app as app

    from superset.exceptions import (
        SupersetDisallowedSQLFunctionException,
        SupersetDMLNotAllowedException,
    )

    # Simplified validation without complex parsing
    sql_upper = sql.upper().strip()

    # Check for DML operations if not allowed
    dml_keywords = ["INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER", "TRUNCATE"]
    if any(sql_upper.startswith(keyword) for keyword in dml_keywords):
        if not database.allow_dml:
            raise SupersetDMLNotAllowedException()

    # Check for disallowed functions from config
    disallowed_functions = app.config.get("DISALLOWED_SQL_FUNCTIONS", {}).get(
        "sqlite",
        set(),  # Default to sqlite for now
    )
    if disallowed_functions:
        sql_lower = sql.lower()
        for func in disallowed_functions:
            if f"{func.lower()}(" in sql_lower:
                raise SupersetDisallowedSQLFunctionException(disallowed_functions)


def execute_sql_query(
    database: Any,
    sql: str,
    schema: Optional[str],
    limit: int,
    timeout: int,
    parameters: Optional[dict[str, Any]],
) -> dict[str, Any]:
    """Execute SQL query and return results."""
    # Import inside function to avoid initialization issues
    from superset.utils.dates import now_as_float

    start_time = now_as_float()

    # Apply parameters and validate
    sql = _apply_parameters(sql, parameters)
    validate_sql_query(sql, database)

    # Apply limit for SELECT queries
    rendered_sql = _apply_limit(sql, limit)

    # Execute and get results
    results = _execute_query(database, rendered_sql, schema, limit)

    # Calculate execution time
    end_time = now_as_float()
    results["execution_time"] = end_time - start_time

    return results


def _apply_parameters(sql: str, parameters: Optional[dict[str, Any]]) -> str:
    """Apply parameters to SQL query."""
    # Import inside function to avoid initialization issues
    from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
    from superset.exceptions import SupersetErrorException

    if parameters:
        try:
            return sql.format(**parameters)
        except KeyError as e:
            raise SupersetErrorException(
                SupersetError(
                    message=f"Missing parameter: {e}",
                    error_type=SupersetErrorType.INVALID_PAYLOAD_FORMAT_ERROR,
                    level=ErrorLevel.ERROR,
                )
            ) from e
    else:
        # Check if SQL contains placeholders when no parameters provided
        import re

        placeholders = re.findall(r"{(\w+)}", sql)
        if placeholders:
            raise SupersetErrorException(
                SupersetError(
                    message=f"Missing parameter: {placeholders[0]}",
                    error_type=SupersetErrorType.INVALID_PAYLOAD_FORMAT_ERROR,
                    level=ErrorLevel.ERROR,
                )
            )
    return sql


def _apply_limit(sql: str, limit: int) -> str:
    """Apply limit to SELECT queries if not already present."""
    sql_lower = sql.lower().strip()
    if sql_lower.startswith("select") and "limit" not in sql_lower:
        return f"{sql.rstrip().rstrip(';')} LIMIT {limit}"
    return sql


def _execute_query(
    database: Any,
    sql: str,
    schema: Optional[str],
    limit: int,
) -> dict[str, Any]:
    """Execute the query and process results."""
    # Import inside function to avoid initialization issues
    from superset.utils.core import QuerySource

    results = {
        "rows": [],
        "columns": [],
        "row_count": 0,
        "affected_rows": None,
        "execution_time": 0.0,
    }

    try:
        # Execute query with timeout
        with database.get_raw_connection(
            catalog=None,
            schema=schema,
            source=QuerySource.SQL_LAB,
        ) as conn:
            cursor = conn.cursor()
            cursor.execute(sql)

            # Process results based on query type
            if _is_select_query(sql):
                _process_select_results(cursor, results, limit)
            else:
                _process_dml_results(cursor, conn, results)

    except Exception as e:
        logger.error(f"Error executing SQL: {e}", exc_info=True)
        raise

    return results


def _is_select_query(sql: str) -> bool:
    """Check if SQL is a SELECT query."""
    return sql.lower().strip().startswith("select")


def _process_select_results(cursor: Any, results: dict[str, Any], limit: int) -> None:
    """Process SELECT query results."""
    # Fetch results
    data = cursor.fetchmany(limit)

    # Get column metadata
    column_info = []
    if cursor.description:
        for col in cursor.description:
            column_info.append(
                {
                    "name": col[0],
                    "type": str(col[1]) if col[1] else "unknown",
                    "is_nullable": col[6] if len(col) > 6 else None,
                }
            )

    # Set column info regardless of whether there's data
    if column_info:
        results["columns"] = column_info

        # Convert rows to dictionaries
        column_names = [col["name"] for col in column_info]
        results["rows"] = [dict(zip(column_names, row, strict=False)) for row in data]
        results["row_count"] = len(data)


def _process_dml_results(cursor: Any, conn: Any, results: dict[str, Any]) -> None:
    """Process DML query results."""
    results["affected_rows"] = cursor.rowcount
    conn.commit()
