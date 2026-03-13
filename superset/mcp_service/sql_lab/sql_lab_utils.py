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
from typing import Any

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


def _split_sql_statements(sql: str) -> list[str]:
    """Split SQL into individual statements by semicolons."""
    statements = [s.strip() for s in sql.split(";")]
    return [s for s in statements if s]


def execute_sql_query(
    database: Any,
    sql: str,
    schema: str | None,
    limit: int,
    timeout: int,
    parameters: dict[str, Any] | None,
) -> dict[str, Any]:
    """Execute SQL query and return results."""
    # Import inside function to avoid initialization issues
    from superset.utils.dates import now_as_float

    start_time = now_as_float()

    # Apply parameters and validate
    sql = _apply_parameters(sql, parameters)

    statements = _split_sql_statements(sql)

    if len(statements) > 1:
        results = _execute_multi_statement(
            database,
            statements,
            schema,
            limit,
        )
    else:
        # Single statement: existing flow
        validate_sql_query(sql, database)
        original_sql = sql
        rendered_sql = _apply_limit(sql, limit)
        results = _execute_query(database, rendered_sql, schema, limit)

        # Wrap single statement result into statement_results
        stmt_result: dict[str, Any] = {
            "original_sql": original_sql,
            "executed_sql": rendered_sql,
            "row_count": results.get("row_count", 0),
            "execution_time_ms": None,
        }
        if results.get("columns"):
            stmt_result["rows"] = results.get("rows", [])
            stmt_result["columns"] = results.get("columns", [])
        else:
            stmt_result["rows"] = None
            stmt_result["columns"] = None
        results["statement_results"] = [stmt_result]
        results["data_bearing_count"] = 1 if results.get("columns") else 0

    # Calculate execution time
    end_time = now_as_float()
    results["execution_time"] = end_time - start_time

    return results


def _execute_multi_statement(
    database: Any,
    statements: list[str],
    schema: str | None,
    limit: int,
) -> dict[str, Any]:
    """Execute multiple SQL statements and collect per-statement results."""
    from superset.utils.core import QuerySource
    from superset.utils.dates import now_as_float

    results: dict[str, Any] = {
        "rows": [],
        "columns": [],
        "row_count": 0,
        "affected_rows": None,
        "execution_time": 0.0,
        "statement_results": [],
        "data_bearing_count": 0,
    }

    try:
        with database.get_raw_connection(
            catalog=None,
            schema=schema,
            source=QuerySource.SQL_LAB,
        ) as conn:
            cursor = conn.cursor()
            needs_commit = False

            for original_sql in statements:
                validate_sql_query(original_sql, database)
                executed_sql = _apply_limit(original_sql, limit)

                stmt_start = now_as_float()
                cursor.execute(executed_sql)
                stmt_end = now_as_float()
                execution_time_ms = (stmt_end - stmt_start) * 1000

                stmt_result: dict[str, Any] = {
                    "original_sql": original_sql,
                    "executed_sql": executed_sql,
                    "execution_time_ms": execution_time_ms,
                }

                if cursor.description:
                    # Data-bearing statement
                    data = cursor.fetchmany(limit)
                    column_info = []
                    for col in cursor.description:
                        column_info.append(
                            {
                                "name": col[0],
                                "type": str(col[1]) if col[1] else "unknown",
                                "is_nullable": col[6] if len(col) > 6 else None,
                            }
                        )
                    column_names = [c["name"] for c in column_info]
                    rows = [dict(zip(column_names, row, strict=False)) for row in data]

                    stmt_result["row_count"] = len(rows)
                    stmt_result["rows"] = rows
                    stmt_result["columns"] = column_info

                    # Update top-level with last data-bearing result
                    results["rows"] = rows
                    results["columns"] = column_info
                    results["row_count"] = len(rows)
                    results["data_bearing_count"] += 1
                else:
                    # DML/DDL statement
                    stmt_result["row_count"] = cursor.rowcount
                    stmt_result["rows"] = None
                    stmt_result["columns"] = None
                    results["affected_rows"] = cursor.rowcount
                    needs_commit = True

                results["statement_results"].append(stmt_result)

            if needs_commit:
                conn.commit()  # pylint: disable=consider-using-transaction

    except Exception as e:
        logger.error("Error executing multi-statement SQL: %s", e)
        raise

    return results


def _apply_parameters(sql: str, parameters: dict[str, Any] | None) -> str:
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
    schema: str | None,
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

            # Use cursor.description to detect whether the last executed
            # statement produced a result set, rather than checking if the
            # SQL text starts with SELECT. This correctly handles
            # multi-statement queries (e.g., SET ...; SELECT ...) where
            # the first statement is not a SELECT but the last one is.
            if cursor.description:
                _process_select_results(cursor, results, limit)
            elif _is_select_query(sql):
                # Fallback: some drivers may not set description for
                # empty result sets, so also check the SQL text
                _process_select_results(cursor, results, limit)
            else:
                _process_dml_results(cursor, conn, results)

    except Exception as e:
        logger.error("Error executing SQL: %s", e)
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
    conn.commit()  # pylint: disable=consider-using-transaction
