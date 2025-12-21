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
    from superset.sql.parse import SQLScript

    # Use SQLScript for proper SQL parsing
    script = SQLScript(sql, database.db_engine_spec.engine)

    # Check for DML operations if not allowed
    if script.has_mutation() and not database.allow_dml:
        raise SupersetDMLNotAllowedException()

    # Check for disallowed functions from config
    disallowed_functions = app.config.get("DISALLOWED_SQL_FUNCTIONS", {}).get(
        database.db_engine_spec.engine,
        set(),
    )
    if disallowed_functions and script.check_functions_present(disallowed_functions):
        raise SupersetDisallowedSQLFunctionException(disallowed_functions)


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
    validate_sql_query(sql, database)

    # Apply limit for SELECT queries using SQLScript
    rendered_sql = _apply_limit(sql, limit, database)

    # Execute and get results
    results = _execute_query(database, rendered_sql, schema, limit)

    # Calculate execution time
    end_time = now_as_float()
    results["execution_time"] = end_time - start_time

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


def _apply_limit(sql: str, limit: int, database: Any) -> str:
    """Apply limit to SELECT queries using SQLScript for proper parsing."""
    from superset.sql.parse import LimitMethod, SQLScript

    script = SQLScript(sql, database.db_engine_spec.engine)

    # Only apply limit to non-mutating (SELECT-like) queries
    if script.has_mutation():
        return sql

    # Apply limit to each statement in the script
    for statement in script.statements:
        # Only set limit if not already present
        if statement.get_limit_value() is None:
            statement.set_limit_value(limit, LimitMethod.FORCE_LIMIT)

    return script.format()


def _execute_query(
    database: Any,
    sql: str,
    schema: str | None,
    limit: int,
) -> dict[str, Any]:
    """Execute the query and process results."""
    # Import inside function to avoid initialization issues
    from superset.sql.parse import SQLScript
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

            # Use SQLScript for proper SQL parsing to determine query type
            script = SQLScript(sql, database.db_engine_spec.engine)
            if script.has_mutation():
                _process_dml_results(cursor, conn, results)
            else:
                _process_select_results(cursor, results, limit)

    except Exception as e:
        logger.error("Error executing SQL: %s", e)
        raise

    return results


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
