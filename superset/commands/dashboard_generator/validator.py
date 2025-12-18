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
SQL Validator for Dashboard Generation.

Validates LLM-generated SQL before creating datasets:
- Syntax validation using sqlglot
- Execution validation with LIMIT
- Column presence verification
- Row count sanity checks
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from superset.connectors.sqla.utils import get_columns_description
from superset.models.core import Database
from superset.sql.parse import SQLStatement

logger = logging.getLogger(__name__)


# Thresholds for validation
MAX_ROW_COUNT_WARNING = 10_000_000  # Warn if more than 10M rows
SAMPLE_LIMIT = 5  # Number of sample rows to fetch


@dataclass
class ValidationResult:
    """Result of SQL validation."""

    success: bool
    error_message: str | None = None
    warning_message: str | None = None
    actual_columns: list[str] = field(default_factory=list)
    missing_columns: list[str] = field(default_factory=list)
    extra_columns: list[str] = field(default_factory=list)
    sample_rows: list[dict[str, Any]] = field(default_factory=list)
    row_count_estimate: int | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API response."""
        return {
            "success": self.success,
            "error_message": self.error_message,
            "warning_message": self.warning_message,
            "actual_columns": self.actual_columns,
            "missing_columns": self.missing_columns,
            "extra_columns": self.extra_columns,
            "sample_rows": self.sample_rows,
            "row_count_estimate": self.row_count_estimate,
        }


class SQLValidator:
    """
    Validates SQL for dashboard generation.

    Uses existing Superset utilities:
    - SQLStatement for syntax parsing
    - get_columns_description for column extraction
    """

    def validate(
        self,
        sql: str,
        expected_columns: list[str],
        database: Database,
        schema: str | None = None,
        catalog: str | None = None,
    ) -> ValidationResult:
        """
        Validate SQL against expected requirements.

        :param sql: The SQL query to validate
        :param expected_columns: List of column names expected in output
        :param database: Database to validate against
        :param schema: Schema name
        :param catalog: Catalog name
        :return: ValidationResult with details
        """
        logger.info("Validating generated SQL")

        # Step 1: Syntax check using sqlglot
        syntax_result = self._validate_syntax(sql, database)
        if not syntax_result.success:
            return syntax_result

        # Step 2: Check for mutating operations
        mutating_result = self._check_no_mutations(sql, database)
        if not mutating_result.success:
            return mutating_result

        # Step 3: Execute with LIMIT to get columns
        execution_result = self._validate_execution(
            sql, database, schema, catalog
        )
        if not execution_result.success:
            return execution_result

        # Step 4: Check expected columns
        column_result = self._validate_columns(
            execution_result.actual_columns, expected_columns
        )

        # Step 5: Get sample rows
        sample_result = self._get_sample_data(sql, database, schema, catalog)

        # Step 6: Estimate row count
        row_count = self._estimate_row_count(sql, database, schema, catalog)

        # Build final result
        result = ValidationResult(
            success=column_result.success,
            error_message=column_result.error_message,
            actual_columns=execution_result.actual_columns,
            missing_columns=column_result.missing_columns,
            extra_columns=column_result.extra_columns,
            sample_rows=sample_result,
            row_count_estimate=row_count,
        )

        # Add warnings
        if row_count and row_count > MAX_ROW_COUNT_WARNING:
            result.warning_message = (
                f"Dataset has {row_count:,} rows which may impact performance"
            )
        elif row_count == 0:
            result.warning_message = "Dataset returns no rows"

        return result

    def _validate_syntax(
        self, sql: str, database: Database
    ) -> ValidationResult:
        """Validate SQL syntax using sqlglot."""
        try:
            engine = database.db_engine_spec.engine
            stmt = SQLStatement(sql, engine=engine)
            # Just parsing is enough - if it fails, we'll get an exception
            _ = stmt
            return ValidationResult(success=True)
        except Exception as e:
            logger.error("SQL syntax error: %s", str(e))
            return ValidationResult(
                success=False,
                error_message=f"SQL syntax error: {str(e)}",
            )

    def _check_no_mutations(
        self, sql: str, database: Database
    ) -> ValidationResult:
        """Ensure SQL doesn't contain mutating operations."""
        try:
            engine = database.db_engine_spec.engine
            stmt = SQLStatement(sql, engine=engine)
            if stmt.is_mutating():
                return ValidationResult(
                    success=False,
                    error_message="SQL contains mutating operations (INSERT, UPDATE, DELETE, etc.)",
                )
            return ValidationResult(success=True)
        except Exception as e:
            logger.warning("Could not check mutations: %s", str(e))
            # If we can't parse, allow it through - execution will catch issues
            return ValidationResult(success=True)

    def _validate_execution(
        self,
        sql: str,
        database: Database,
        schema: str | None,
        catalog: str | None,
    ) -> ValidationResult:
        """Execute SQL with LIMIT to verify it runs and get columns."""
        try:
            # Wrap in subquery with LIMIT for safety
            limited_sql = f"SELECT * FROM ({sql}) _validation_subquery LIMIT 0"

            columns = get_columns_description(
                database=database,
                catalog=catalog,
                schema=schema,
                query=limited_sql,
            )

            actual_columns = [col["column_name"] for col in columns]

            return ValidationResult(
                success=True,
                actual_columns=actual_columns,
            )
        except Exception as e:
            logger.error("SQL execution error: %s", str(e))
            return ValidationResult(
                success=False,
                error_message=f"SQL execution failed: {str(e)}",
            )

    def _validate_columns(
        self,
        actual_columns: list[str],
        expected_columns: list[str],
    ) -> ValidationResult:
        """Check if expected columns are present in actual columns."""
        actual_set = set(col.lower() for col in actual_columns)
        expected_set = set(col.lower() for col in expected_columns)

        missing = expected_set - actual_set
        extra = actual_set - expected_set

        # Allow case-insensitive matching for missing
        missing_case_insensitive = []
        for exp_col in missing:
            if exp_col not in actual_set:
                missing_case_insensitive.append(exp_col)

        if missing_case_insensitive:
            return ValidationResult(
                success=False,
                error_message=f"Missing columns: {', '.join(missing_case_insensitive)}",
                missing_columns=list(missing_case_insensitive),
                extra_columns=list(extra),
            )

        return ValidationResult(
            success=True,
            extra_columns=list(extra),
        )

    def _get_sample_data(
        self,
        sql: str,
        database: Database,
        schema: str | None,
        catalog: str | None,
    ) -> list[dict[str, Any]]:
        """Get sample rows from the query."""
        try:
            limited_sql = f"SELECT * FROM ({sql}) _sample_subquery LIMIT {SAMPLE_LIMIT}"

            with database.get_raw_connection(catalog=catalog, schema=schema) as conn:
                cursor = conn.cursor()
                cursor.execute(limited_sql)

                columns = [desc[0] for desc in cursor.description or []]
                rows = cursor.fetchall()

                return [dict(zip(columns, row)) for row in rows]
        except Exception as e:
            logger.warning("Could not get sample data: %s", str(e))
            return []

    def _estimate_row_count(
        self,
        sql: str,
        database: Database,
        schema: str | None,
        catalog: str | None,
    ) -> int | None:
        """Estimate row count for the query."""
        try:
            count_sql = f"SELECT COUNT(*) FROM ({sql}) _count_subquery"

            with database.get_raw_connection(catalog=catalog, schema=schema) as conn:
                cursor = conn.cursor()
                cursor.execute(count_sql)
                result = cursor.fetchone()
                return result[0] if result else None
        except Exception as e:
            logger.warning("Could not estimate row count: %s", str(e))
            return None


def validate_generated_sql(
    sql: str,
    expected_columns: list[str],
    database: Database,
    schema: str | None = None,
    catalog: str | None = None,
) -> ValidationResult:
    """
    Convenience function to validate generated SQL.

    :param sql: The SQL query to validate
    :param expected_columns: List of column names expected in output
    :param database: Database to validate against
    :param schema: Schema name
    :param catalog: Catalog name
    :return: ValidationResult with details
    """
    return SQLValidator().validate(
        sql=sql,
        expected_columns=expected_columns,
        database=database,
        schema=schema,
        catalog=catalog,
    )
