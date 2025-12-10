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
Tests for transpile_to_dialect function in superset/sql/parse.py
"""

import pytest

from superset.sql.parse import transpile_to_dialect


@pytest.mark.parametrize(
    "sql,dialect,expected",
    [
        # PostgreSQL - SQL-92 standard double single quotes
        ("name = 'O''Hara'", "postgresql", "name = 'O''Hara'"),
        # MySQL - SQL-92 standard double single quotes
        ("name = 'O''Hara'", "mysql", "name = 'O''Hara'"),
        # SQLite - SQL-92 standard double single quotes
        ("name = 'O''Hara'", "sqlite", "name = 'O''Hara'"),
        # Snowflake - backslash escaping
        ("name = 'O''Hara'", "snowflake", "name = 'O\\'Hara'"),
        # BigQuery - backslash escaping
        ("name = 'O''Hara'", "bigquery", "name = 'O\\'Hara'"),
        # Databricks - backslash escaping
        ("name = 'O''Hara'", "databricks", "name = 'O\\'Hara'"),
        # Presto - SQL-92 standard double single quotes
        ("name = 'O''Hara'", "presto", "name = 'O''Hara'"),
        # Trino - SQL-92 standard double single quotes
        ("name = 'O''Hara'", "trino", "name = 'O''Hara'"),
    ],
)
def test_single_quote_escaping(sql: str, dialect: str, expected: str) -> None:
    """Test single quote escaping across different database dialects."""
    assert transpile_to_dialect(sql, dialect) == expected


@pytest.mark.parametrize(
    "sql,dialect,expected",
    [
        (
            "(name = 'O''Hara' AND status = 'active')",
            "postgresql",
            "(name = 'O''Hara' AND status = 'active')",
        ),
        (
            "(name = 'O''Hara' AND status = 'active')",
            "mysql",
            "(name = 'O''Hara' AND status = 'active')",
        ),
        (
            "(name = 'O''Hara' AND status = 'active')",
            "snowflake",
            "(name = 'O\\'Hara' AND status = 'active')",
        ),
        (
            "(name = 'O''Hara' AND status = 'active')",
            "databricks",
            "(name = 'O\\'Hara' AND status = 'active')",
        ),
    ],
)
def test_compound_filter_with_quotes(sql: str, dialect: str, expected: str) -> None:
    """Test compound filters with quoted strings."""
    assert transpile_to_dialect(sql, dialect) == expected


@pytest.mark.parametrize(
    "sql,dialect,expected",
    [
        ("name LIKE '%O''Hara%'", "postgresql", "name LIKE '%O''Hara%'"),
        ("name LIKE '%O''Hara%'", "mysql", "name LIKE '%O''Hara%'"),
        ("name LIKE '%O''Hara%'", "snowflake", "name LIKE '%O\\'Hara%'"),
        ("name LIKE '%O''Hara%'", "databricks", "name LIKE '%O\\'Hara%'"),
    ],
)
def test_like_with_special_chars(sql: str, dialect: str, expected: str) -> None:
    """Test LIKE patterns with special characters."""
    assert transpile_to_dialect(sql, dialect) == expected


@pytest.mark.parametrize(
    "sql,dialect,expected",
    [
        # PostgreSQL keeps ILIKE
        ("name ILIKE '%test%'", "postgresql", "name ILIKE '%test%'"),
        # MySQL converts ILIKE to LOWER(col) LIKE LOWER(pattern)
        ("name ILIKE '%test%'", "mysql", "LOWER(name) LIKE LOWER('%test%')"),
        # SQLite converts ILIKE to LOWER(col) LIKE LOWER(pattern)
        ("name ILIKE '%test%'", "sqlite", "LOWER(name) LIKE LOWER('%test%')"),
        # Snowflake keeps ILIKE
        ("name ILIKE '%test%'", "snowflake", "name ILIKE '%test%'"),
        # BigQuery converts ILIKE to LOWER(col) LIKE LOWER(pattern)
        ("name ILIKE '%test%'", "bigquery", "LOWER(name) LIKE LOWER('%test%')"),
        # Databricks keeps ILIKE
        ("name ILIKE '%test%'", "databricks", "name ILIKE '%test%'"),
        # Presto converts ILIKE to LOWER(col) LIKE LOWER(pattern)
        ("name ILIKE '%test%'", "presto", "LOWER(name) LIKE LOWER('%test%')"),
        # Trino converts ILIKE to LOWER(col) LIKE LOWER(pattern)
        ("name ILIKE '%test%'", "trino", "LOWER(name) LIKE LOWER('%test%')"),
    ],
)
def test_ilike_transpilation(sql: str, dialect: str, expected: str) -> None:
    """Test ILIKE transpilation to various database dialects."""
    assert transpile_to_dialect(sql, dialect) == expected


@pytest.mark.parametrize(
    "sql,dialect,expected",
    [
        (
            "name IN ('O''Hara', 'D''Angelo')",
            "postgresql",
            "name IN ('O''Hara', 'D''Angelo')",
        ),
        (
            "name IN ('O''Hara', 'D''Angelo')",
            "mysql",
            "name IN ('O''Hara', 'D''Angelo')",
        ),
        (
            "name IN ('O''Hara', 'D''Angelo')",
            "snowflake",
            "name IN ('O\\'Hara', 'D\\'Angelo')",
        ),
        (
            "name IN ('O''Hara', 'D''Angelo')",
            "databricks",
            "name IN ('O\\'Hara', 'D\\'Angelo')",
        ),
    ],
)
def test_in_clause_with_quoted_strings(sql: str, dialect: str, expected: str) -> None:
    """Test IN clause with multiple quoted strings."""
    assert transpile_to_dialect(sql, dialect) == expected


@pytest.mark.parametrize(
    "sql,dialect,expected",
    [
        (
            "price > 100 AND quantity <= 50",
            "postgresql",
            "price > 100 AND quantity <= 50",
        ),
        ("price > 100 AND quantity <= 50", "mysql", "price > 100 AND quantity <= 50"),
        (
            "price > 100 AND quantity <= 50",
            "snowflake",
            "price > 100 AND quantity <= 50",
        ),
    ],
)
def test_number_comparison(sql: str, dialect: str, expected: str) -> None:
    """Test number comparisons are preserved."""
    assert transpile_to_dialect(sql, dialect) == expected


@pytest.mark.parametrize(
    "sql,dialect,expected",
    [
        ("created_at > '2024-01-01'", "postgresql", "created_at > '2024-01-01'"),
        ("created_at > '2024-01-01'", "mysql", "created_at > '2024-01-01'"),
        ("created_at > '2024-01-01'", "snowflake", "created_at > '2024-01-01'"),
    ],
)
def test_date_comparison(sql: str, dialect: str, expected: str) -> None:
    """Test date comparisons."""
    assert transpile_to_dialect(sql, dialect) == expected


@pytest.mark.parametrize(
    "sql,dialect,expected",
    [
        ("price BETWEEN 10 AND 100", "postgresql", "price BETWEEN 10 AND 100"),
        ("price BETWEEN 10 AND 100", "mysql", "price BETWEEN 10 AND 100"),
        ("price BETWEEN 10 AND 100", "snowflake", "price BETWEEN 10 AND 100"),
    ],
)
def test_between_clause(sql: str, dialect: str, expected: str) -> None:
    """Test BETWEEN clause."""
    assert transpile_to_dialect(sql, dialect) == expected


@pytest.mark.parametrize(
    "sql,dialect,expected",
    [
        ("name IS NULL", "postgresql", "name IS NULL"),
        ("name IS NULL", "mysql", "name IS NULL"),
        ("name IS NULL", "snowflake", "name IS NULL"),
    ],
)
def test_is_null(sql: str, dialect: str, expected: str) -> None:
    """Test IS NULL clause."""
    assert transpile_to_dialect(sql, dialect) == expected


@pytest.mark.parametrize(
    "sql,dialect,expected",
    [
        # SQLGlot normalizes "IS NOT NULL" to "NOT ... IS NULL"
        ("name IS NOT NULL", "postgresql", "NOT name IS NULL"),
        ("name IS NOT NULL", "mysql", "NOT name IS NULL"),
        ("name IS NOT NULL", "snowflake", "NOT name IS NULL"),
    ],
)
def test_is_not_null(sql: str, dialect: str, expected: str) -> None:
    """Test IS NOT NULL clause (SQLGlot normalizes to NOT ... IS NULL)."""
    assert transpile_to_dialect(sql, dialect) == expected


@pytest.mark.parametrize(
    "sql,dialect,expected",
    [
        (
            "status = 'active' OR status = 'pending'",
            "postgresql",
            "status = 'active' OR status = 'pending'",
        ),
        (
            "status = 'active' OR status = 'pending'",
            "mysql",
            "status = 'active' OR status = 'pending'",
        ),
    ],
)
def test_or_condition(sql: str, dialect: str, expected: str) -> None:
    """Test OR condition."""
    assert transpile_to_dialect(sql, dialect) == expected


@pytest.mark.parametrize(
    "sql,dialect,expected",
    [
        (
            "((a > 1 AND b < 2) OR (c = 3))",
            "postgresql",
            "((a > 1 AND b < 2) OR (c = 3))",
        ),
        ("((a > 1 AND b < 2) OR (c = 3))", "mysql", "((a > 1 AND b < 2) OR (c = 3))"),
    ],
)
def test_nested_conditions(sql: str, dialect: str, expected: str) -> None:
    """Test nested parentheses conditions."""
    assert transpile_to_dialect(sql, dialect) == expected


@pytest.mark.parametrize(
    "dialect",
    [
        "postgresql",
        "mysql",
        "sqlite",
        "snowflake",
        "bigquery",
        "mssql",
        "databricks",
        "presto",
        "trino",
        # Unknown engines should return SQL unchanged
        "unknown_database_engine",
        "crate",
        "databend",
        "db2",
        "denodo",
        "dynamodb",
        "elasticsearch",
    ],
)
def test_transpilation_does_not_error(dialect: str) -> None:
    """Verify transpilation does not raise errors for known and unknown dialects."""
    sql = "name = 'test' AND price > 100"
    # Should not raise an exception
    result = transpile_to_dialect(sql, dialect)
    assert result is not None
    assert len(result) > 0


@pytest.mark.parametrize(
    "engine",
    [
        "unknown_database_engine",
        "crate",
        "databend",
        "db2",
        "denodo",
        "dynamodb",
        "elasticsearch",
    ],
)
def test_unknown_engine_returns_sql_unchanged(engine: str) -> None:
    """Test that unknown engines return SQL unchanged."""
    sql = "name = 'O''Hara'"
    assert transpile_to_dialect(sql, engine) == sql


def test_invalid_sql_raises_exception() -> None:
    """Test that invalid SQL raises QueryClauseValidationException."""
    from superset.exceptions import QueryClauseValidationException

    with pytest.raises(QueryClauseValidationException):
        transpile_to_dialect("INVALID SQL !!!", "postgresql")


def test_empty_sql_raises_exception() -> None:
    """Test that empty SQL raises exception."""
    from superset.exceptions import QueryClauseValidationException

    with pytest.raises(QueryClauseValidationException):
        transpile_to_dialect("", "postgresql")


def test_sqlglot_generation_error_raises_exception() -> None:
    """Test that SQLGlot generation errors are caught and wrapped."""
    from unittest.mock import MagicMock, patch

    from superset.exceptions import QueryClauseValidationException

    # Create a mock parsed expression
    mock_parsed = MagicMock()

    # Mock parse_one to succeed, then make generate fail
    with patch("superset.sql.parse.sqlglot.parse_one", return_value=mock_parsed):
        with patch("superset.sql.parse.Dialect.get_or_raise") as mock_get_dialect:
            mock_dialect = mock_get_dialect.return_value
            mock_dialect.generate.side_effect = RuntimeError("SQLGlot internal error")

            with pytest.raises(
                QueryClauseValidationException,
                match="Cannot transpile SQL to postgresql",
            ):
                transpile_to_dialect("name = 'test'", "postgresql")
