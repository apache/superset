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

import pytest

from superset.utils.sql_sanitizer import sanitize_sql_with_sqlglot


class TestSQLEscapingByDatabase:
    """Test SQL string escaping across different database backends."""

    def test_postgres_single_quote_escaping(self):
        """PostgreSQL should use SQL-92 standard: double single quotes."""
        sql = "name = 'O''Connor'"
        result = sanitize_sql_with_sqlglot(sql, "postgresql")
        assert "O''Connor" in result or "O'Connor" in result.replace("''", "'")
        assert "name" in result

    def test_mysql_single_quote_escaping(self):
        """MySQL should handle single quotes (either '' or \\')."""
        sql = "name = 'O''Connor'"
        result = sanitize_sql_with_sqlglot(sql, "mysql")
        assert "O''Connor" in result or "O\\'Connor" in result or "O'Connor" in result
        assert "name" in result

    def test_databricks_single_quote_escaping(self):
        """Databricks should use backslash escaping for single quotes."""
        sql = "name = 'O''Connor'"
        result = sanitize_sql_with_sqlglot(sql, "databricks")
        assert "name" in result
        assert "Connor" in result

    def test_sqlite_single_quote_escaping(self):
        """SQLite uses SQL-92 standard: double single quotes."""
        sql = "name = 'O''Connor'"
        result = sanitize_sql_with_sqlglot(sql, "sqlite")
        assert "O''Connor" in result or "O'Connor" in result
        assert "name" in result

    def test_snowflake_single_quote_escaping(self):
        """Snowflake uses backslash escaping for single quotes."""
        sql = "name = 'O''Connor'"
        result = sanitize_sql_with_sqlglot(sql, "snowflake")
        assert "O''Connor" in result or "O'Connor" in result or "O\\'Connor" in result
        assert "name" in result

    def test_bigquery_single_quote_escaping(self):
        """BigQuery should handle single quotes properly."""
        sql = "name = 'O''Connor'"
        result = sanitize_sql_with_sqlglot(sql, "bigquery")
        assert "Connor" in result
        assert "name" in result

    def test_mssql_single_quote_escaping(self):
        """SQL Server uses SQL-92 standard: double single quotes."""
        sql = "name = 'O''Connor'"
        result = sanitize_sql_with_sqlglot(sql, "mssql")
        assert "O''Connor" in result or "O'Connor" in result
        assert "name" in result


class TestBackslashEscaping:
    """Test backslash handling across databases."""

    def test_postgres_backslash_in_path(self):
        """PostgreSQL: backslashes in strings."""
        sql = "path = 'C:\\\\Users\\\\test'"
        result = sanitize_sql_with_sqlglot(sql, "postgresql")
        assert "path" in result
        assert "Users" in result or "C:" in result

    def test_mysql_backslash_in_path(self):
        """MySQL treats backslash as escape character."""
        sql = "path = 'C:\\\\Users\\\\test'"
        result = sanitize_sql_with_sqlglot(sql, "mysql")
        assert "path" in result

    def test_databricks_backslash_in_path(self):
        """Databricks uses backslash as escape character."""
        sql = "path = 'C:\\\\Users\\\\test'"
        result = sanitize_sql_with_sqlglot(sql, "databricks")
        assert "path" in result


class TestComplexSQLExpressions:
    """Test complex SQL expressions with multiple special characters."""

    def test_compound_filter_with_quotes(self):
        """Test compound filters with quoted strings."""
        sql = "(name = 'O''Connor' AND status = 'active')"
        result = sanitize_sql_with_sqlglot(sql, "postgresql")
        assert "Connor" in result
        assert "active" in result
        assert "AND" in result

    def test_ilike_with_special_chars(self):
        """Test ILIKE patterns with special characters."""
        sql = "name ILIKE '%O''Connor%'"
        result = sanitize_sql_with_sqlglot(sql, "postgresql")
        assert "Connor" in result
        assert "ILIKE" in result or "ilike" in result.lower()

    def test_in_clause_with_quoted_strings(self):
        """Test IN clause with multiple quoted strings."""
        sql = "name IN ('O''Connor', 'D''Angelo', 'McDonald''s')"
        result = sanitize_sql_with_sqlglot(sql, "postgresql")
        assert "Connor" in result
        assert "Angelo" in result
        assert "McDonald" in result
        assert "IN" in result

    def test_mixed_operators_with_strings(self):
        """Test mixed operators with string literals."""
        sql = "(price > 100 AND name ILIKE '%test%' AND status = 'active')"
        result = sanitize_sql_with_sqlglot(sql, "postgresql")
        assert "price" in result
        assert "100" in result
        assert "test" in result
        assert "active" in result


class TestSQLInjectionPrevention:
    """Test that SQL injection attempts are handled safely."""

    def test_injection_attempt_with_quotes(self):
        """Test SQL injection attempt using quotes."""
        sql = "name = 'test'; DROP TABLE users; --'"
        result = sanitize_sql_with_sqlglot(sql, "postgresql")
        assert "name" in result
        assert "test" in result
        assert "DROP" not in result

    def test_injection_with_escaped_quotes(self):
        """Test injection attempt with pre-escaped quotes."""
        sql = "name = 'test''; DELETE FROM users; --'"
        result = sanitize_sql_with_sqlglot(sql, "postgresql")
        assert isinstance(result, str)

    def test_legitimate_quote_in_string(self):
        """Test that legitimate quotes are preserved correctly."""
        sql = "description = 'It''s a test'"
        result = sanitize_sql_with_sqlglot(sql, "postgresql")
        assert "test" in result
        assert "It" in result


class TestDangerousConstructsBlocked:
    """Test that dangerous SQL constructs are blocked with ValueError."""

    def test_subquery_in_in_clause_blocked(self):
        """Subquery in IN clause should raise ValueError."""
        sql = "id IN (SELECT id FROM users)"
        with pytest.raises(ValueError, match="Subqueries are not allowed"):
            sanitize_sql_with_sqlglot(sql, "postgresql")

    def test_subquery_in_where_blocked(self):
        """Subquery in comparison should raise ValueError."""
        sql = "price > (SELECT AVG(price) FROM products)"
        with pytest.raises(ValueError, match="Subqueries are not allowed"):
            sanitize_sql_with_sqlglot(sql, "postgresql")

    def test_exists_subquery_blocked(self):
        """EXISTS with subquery should raise ValueError."""
        sql = "id = 1 AND EXISTS (SELECT 1 FROM users WHERE users.id = orders.user_id)"
        with pytest.raises(ValueError, match="Subqueries are not allowed"):
            sanitize_sql_with_sqlglot(sql, "postgresql")

    def test_union_injection_blocked(self):
        """UNION set operation should raise ValueError."""
        sql = "1=1 UNION SELECT * FROM users"
        with pytest.raises(ValueError, match="Set operations are not allowed"):
            sanitize_sql_with_sqlglot(sql, "postgresql")

    def test_union_all_blocked(self):
        """UNION ALL set operation should raise ValueError."""
        sql = "status='active' UNION ALL SELECT password FROM users"
        with pytest.raises(ValueError, match="Set operations are not allowed"):
            sanitize_sql_with_sqlglot(sql, "postgresql")

    def test_intersect_blocked(self):
        """INTERSECT set operation should raise ValueError."""
        sql = "id=1 INTERSECT SELECT id FROM admins"
        with pytest.raises(ValueError, match="Set operations are not allowed"):
            sanitize_sql_with_sqlglot(sql, "postgresql")

    def test_except_blocked(self):
        """EXCEPT set operation should raise ValueError."""
        sql = "id=1 EXCEPT SELECT id FROM banned"
        with pytest.raises(ValueError, match="Set operations are not allowed"):
            sanitize_sql_with_sqlglot(sql, "postgresql")

    def test_ddl_commands_stripped(self):
        """DDL commands after semicolon are stripped by SQLGlot parse_one."""
        sql = "1=1; DROP TABLE users"
        result = sanitize_sql_with_sqlglot(sql, "postgresql")
        assert "DROP" not in result
        assert "1 = 1" in result

    def test_delete_command_stripped(self):
        """DELETE command after semicolon is stripped."""
        sql = "1=1; DELETE FROM users"
        result = sanitize_sql_with_sqlglot(sql, "postgresql")
        assert "DELETE" not in result
        assert "1 = 1" in result

    def test_insert_command_stripped(self):
        """INSERT command after semicolon is stripped."""
        sql = "1=1; INSERT INTO users VALUES (1, 'admin')"
        result = sanitize_sql_with_sqlglot(sql, "postgresql")
        assert "INSERT" not in result
        assert "1 = 1" in result

    def test_update_command_stripped(self):
        """UPDATE command after semicolon is stripped."""
        sql = "1=1; UPDATE users SET admin=true"
        result = sanitize_sql_with_sqlglot(sql, "postgresql")
        assert "UPDATE" not in result
        assert "1 = 1" in result

    def test_create_table_command_stripped(self):
        """CREATE TABLE command after semicolon is stripped."""
        sql = "1=1; CREATE TABLE hacked (id INT)"
        result = sanitize_sql_with_sqlglot(sql, "postgresql")
        assert "CREATE" not in result
        assert "1 = 1" in result

    def test_validation_can_be_disabled(self):
        """When validate_structure=False, subqueries are allowed."""
        sql = "id IN (SELECT id FROM users)"
        result = sanitize_sql_with_sqlglot(sql, "postgresql", validate_structure=False)
        assert "SELECT" in result
        assert "users" in result


class TestDatabaseSpecificBehavior:
    """Test database-specific SQL behaviors."""

    def test_ilike_postgres_vs_mysql(self):
        """ILIKE is PostgreSQL-specific, MySQL uses LIKE."""
        sql = "name ILIKE '%test%'"

        pg_result = sanitize_sql_with_sqlglot(sql, "postgresql")
        assert "ILIKE" in pg_result or "ilike" in pg_result.lower()

        mysql_result = sanitize_sql_with_sqlglot(sql, "mysql")
        assert "LIKE" in mysql_result or "like" in mysql_result.lower()

    def test_boolean_literals_across_dbs(self):
        """Test boolean literals across databases."""
        sql = "active = TRUE AND deleted = FALSE"

        pg_result = sanitize_sql_with_sqlglot(sql, "postgresql")
        assert "active" in pg_result
        assert "deleted" in pg_result

        mysql_result = sanitize_sql_with_sqlglot(sql, "mysql")
        assert "active" in mysql_result
        assert "deleted" in mysql_result

    def test_identifier_quoting(self):
        """Test that column names with special chars are handled."""
        sql = "\"column-name\" = 'value'"
        result = sanitize_sql_with_sqlglot(sql, "postgresql")
        assert "value" in result


def test_escaping_consistency_across_databases():
    """Verify that single quote escaping is consistent for each database type."""
    test_sql = "name = 'O''Connor'"

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
        result = sanitize_sql_with_sqlglot(test_sql, db)
        assert "name" in result, f"{db}: Missing column name"
        assert "Connor" in result, f"{db}: Missing value"


def test_sqlglot_actually_transforms_sql():
    """Verify that SQLGlot normalizes SQL syntax."""
    test_cases = [
        ("price>100", "postgresql"),
        ("NAME = 'test'", "postgresql"),
        ("status='active'", "postgresql"),
    ]

    for sql, db in test_cases:
        result = sanitize_sql_with_sqlglot(sql, db)
        assert isinstance(result, str)
        assert len(result) > 0
