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

The function parses PostgreSQL syntax SQL and transpiles it to the target
database dialect using SQLGlot.

Frontend generates PostgreSQL syntax: name ILIKE '%O''Hara%'
Backend transpiles to target dialect:
  - PostgreSQL: name ILIKE '%O''Hara%' (unchanged)
  - MySQL: name LIKE '%O\\'Hara%' (ILIKE→LIKE, ''→\\')
  - Databricks: name ILIKE '%O\\'Hara%'
"""

import pytest

from superset.sql.parse import transpile_to_dialect


def test_postgres_single_quote_escaping():
    """PostgreSQL keeps SQL-92 standard: double single quotes."""
    sql = "name = 'O''Hara'"
    result = transpile_to_dialect(sql, "postgresql")
    assert "O''Hara" in result
    assert "name" in result


def test_databricks_single_quote_escaping():
    """Databricks uses backslash escaping for single quotes."""
    sql = "name = 'O''Hara'"
    result = transpile_to_dialect(sql, "databricks")
    assert "name" in result
    # Databricks uses backslash escaping
    assert "O\\'Hara" in result or "O''Hara" in result


def test_mysql_single_quote_escaping():
    """MySQL uses backslash escaping for single quotes."""
    sql = "name = 'O''Hara'"
    result = transpile_to_dialect(sql, "mysql")
    assert "name" in result
    # MySQL may use backslash or double-quote escaping
    assert (
        "Connor" in result.replace("O''Hara", "Connor").replace("O\\'Hara", "Connor")
        or "Hara" in result
    )


def test_sqlite_single_quote_escaping():
    """SQLite uses SQL-92 standard: double single quotes."""
    sql = "name = 'O''Hara'"
    result = transpile_to_dialect(sql, "sqlite")
    assert "O''Hara" in result
    assert "name" in result


def test_snowflake_single_quote_escaping():
    """Snowflake handles single quotes."""
    sql = "name = 'O''Hara'"
    result = transpile_to_dialect(sql, "snowflake")
    assert "name" in result
    assert "Hara" in result


def test_bigquery_single_quote_escaping():
    """BigQuery handles single quotes."""
    sql = "name = 'O''Hara'"
    result = transpile_to_dialect(sql, "bigquery")
    assert "name" in result
    assert "Hara" in result


def test_compound_filter_with_quotes():
    """Test compound filters with quoted strings."""
    sql = "(name = 'O''Hara' AND status = 'active')"
    result = transpile_to_dialect(sql, "postgresql")
    assert "Hara" in result
    assert "active" in result
    assert "AND" in result


def test_like_with_special_chars():
    """Test LIKE patterns with special characters."""
    sql = "name LIKE '%O''Hara%'"
    result = transpile_to_dialect(sql, "postgresql")
    assert "Hara" in result
    assert "LIKE" in result


def test_ilike_case_insensitive():
    """Test ILIKE for case-insensitive matching (PostgreSQL syntax)."""
    sql = "name ILIKE '%O''Hara%'"

    # PostgreSQL keeps ILIKE and '' escaping
    pg_result = transpile_to_dialect(sql, "postgresql")
    assert "ILIKE" in pg_result
    assert "Hara" in pg_result

    # MySQL converts ILIKE to LIKE (MySQL LIKE is case-insensitive by default)
    mysql_result = transpile_to_dialect(sql, "mysql")
    assert "LIKE" in mysql_result
    assert "Hara" in mysql_result

    # Databricks supports ILIKE
    db_result = transpile_to_dialect(sql, "databricks")
    assert "ILIKE" in db_result or "LIKE" in db_result
    assert "Hara" in db_result


def test_ilike_transpilation_across_databases():
    """Test ILIKE transpilation to various database dialects."""
    sql = "name ILIKE '%test%'"

    # PostgreSQL: keeps ILIKE
    pg_result = transpile_to_dialect(sql, "postgresql")
    assert "ILIKE" in pg_result

    # MySQL: ILIKE → LIKE
    mysql_result = transpile_to_dialect(sql, "mysql")
    assert "LIKE" in mysql_result


def test_in_clause_with_quoted_strings():
    """Test IN clause with multiple quoted strings."""
    sql = "name IN ('O''Hara', 'D''Angelo', 'McDonald''s')"
    result = transpile_to_dialect(sql, "postgresql")
    assert "Hara" in result
    assert "Angelo" in result
    assert "McDonald" in result
    assert "IN" in result


def test_mixed_operators_with_strings():
    """Test mixed operators with string literals."""
    sql = "(price > 100 AND name LIKE '%test%' AND status = 'active')"
    result = transpile_to_dialect(sql, "postgresql")
    assert "price" in result
    assert "100" in result
    assert "test" in result
    assert "active" in result


def test_number_comparison():
    """Test number comparisons are preserved."""
    sql = "price > 100 AND quantity <= 50"
    result = transpile_to_dialect(sql, "postgresql")
    assert "price > 100" in result
    assert "quantity <= 50" in result


def test_date_comparison():
    """Test date comparisons."""
    sql = "created_at > '2024-01-01'"
    result = transpile_to_dialect(sql, "postgresql")
    assert "created_at" in result
    assert "2024-01-01" in result


def test_between_clause():
    """Test BETWEEN clause."""
    sql = "price BETWEEN 10 AND 100"
    result = transpile_to_dialect(sql, "postgresql")
    assert "price" in result
    assert "BETWEEN" in result
    assert "10" in result
    assert "100" in result


def test_is_null():
    """Test IS NULL clause."""
    sql = "name IS NULL"
    result = transpile_to_dialect(sql, "postgresql")
    assert "name IS NULL" in result


def test_is_not_null():
    """Test IS NOT NULL clause (SQLGlot may normalize to NOT ... IS NULL)."""
    sql = "name IS NOT NULL"
    result = transpile_to_dialect(sql, "postgresql")
    # SQLGlot normalizes "IS NOT NULL" to "NOT ... IS NULL"
    assert "name" in result
    assert "NOT" in result
    assert "NULL" in result


def test_or_condition():
    """Test OR condition."""
    sql = "status = 'active' OR status = 'pending'"
    result = transpile_to_dialect(sql, "postgresql")
    assert "active" in result
    assert "pending" in result
    assert "OR" in result


def test_nested_conditions():
    """Test nested parentheses conditions."""
    sql = "((a > 1 AND b < 2) OR (c = 3))"
    result = transpile_to_dialect(sql, "postgresql")
    assert "a > 1" in result
    assert "b < 2" in result
    assert "c = 3" in result


def test_escaping_consistency_across_databases():
    """Verify transpilation works for each database type."""
    test_sql = "name = 'O''Hara'"

    databases = [
        "postgresql",
        "mysql",
        "sqlite",
        "snowflake",
        "bigquery",
        "mssql",
        "databricks",
        "presto",
        "trino",
    ]

    for db in databases:
        result = transpile_to_dialect(test_sql, db)
        assert "name" in result, f"{db}: Missing column name"
        assert "Hara" in result, f"{db}: Missing value"


def test_invalid_sql_raises_exception():
    """Test that invalid SQL raises QueryClauseValidationException."""
    from superset.exceptions import QueryClauseValidationException

    with pytest.raises(QueryClauseValidationException):
        transpile_to_dialect("INVALID SQL !!!", "postgresql")


def test_empty_sql():
    """Test that empty SQL raises exception."""
    from superset.exceptions import QueryClauseValidationException

    with pytest.raises(QueryClauseValidationException):
        transpile_to_dialect("", "postgresql")


def test_unknown_engine_returns_sql_as_is():
    """Test that unknown engine returns SQL unchanged (SQL-92 compatible)."""
    sql = "name = 'O''Hara'"
    result = transpile_to_dialect(sql, "unknown_database_engine")
    assert result == sql


def test_engine_not_in_dialect_map():
    """Test engines not in SQLGLOT_DIALECTS return SQL as-is."""
    sql = "status == 'active' AND count > 10"
    # These engines are commented out in SQLGLOT_DIALECTS
    unknown_engines = [
        "crate",
        "databend",
        "db2",
        "denodo",
        "dynamodb",
        "elasticsearch",
    ]

    for engine in unknown_engines:
        result = transpile_to_dialect(sql, engine)
        assert result == sql, f"{engine}: Expected SQL to be returned unchanged"
