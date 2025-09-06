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
Unit tests for SQL Lab utility functions
"""

from unittest.mock import MagicMock, Mock, patch

import pytest

from superset.exceptions import (
    SupersetDisallowedSQLFunctionException,
    SupersetDMLNotAllowedException,
    SupersetErrorException,
    SupersetSecurityException,
)
from superset.mcp_service.sql_lab.sql_lab_utils import (
    check_database_access,
    execute_sql_query,
    validate_sql_query,
)


class TestCheckDatabaseAccess:
    """Tests for check_database_access function."""

    @patch("superset.security_manager")
    @patch("superset.db")
    def test_check_database_access_success(self, mock_db, mock_security_manager):
        """Test successful database access check."""
        mock_database = Mock()
        mock_database.id = 1
        mock_database.database_name = "test_db"

        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            mock_database
        )
        mock_security_manager.can_access_database.return_value = True

        result = check_database_access(1)

        assert result == mock_database
        mock_security_manager.can_access_database.assert_called_once_with(mock_database)

    @patch("superset.db")
    def test_check_database_access_not_found(self, mock_db):
        """Test error when database not found."""
        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            None
        )

        with pytest.raises(SupersetErrorException) as exc_info:
            check_database_access(999)

        assert "Database with ID 999 not found" in str(exc_info.value)

    @patch("superset.security_manager")
    @patch("superset.db")
    def test_check_database_access_denied(self, mock_db, mock_security_manager):
        """Test error when access is denied."""
        mock_database = Mock()
        mock_database.database_name = "restricted_db"

        mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
            mock_database
        )
        # Make it a regular Mock not AsyncMock for synchronous call
        mock_security_manager.can_access_database = Mock(return_value=False)

        with pytest.raises(SupersetSecurityException) as exc_info:
            check_database_access(1)

        assert "Access denied to database restricted_db" in str(exc_info.value)


class TestValidateSqlQuery:
    """Tests for validate_sql_query function."""

    def test_validate_sql_query_select_allowed(self):
        """Test SELECT query validation passes."""
        mock_database = Mock()
        mock_database.allow_dml = False

        # Should not raise any exception
        validate_sql_query("SELECT * FROM users", mock_database)

    def test_validate_sql_query_dml_not_allowed(self):
        """Test DML query validation fails when not allowed."""
        mock_database = Mock()
        mock_database.allow_dml = False

        with pytest.raises(SupersetDMLNotAllowedException):
            validate_sql_query("INSERT INTO users VALUES (1, 'test')", mock_database)

        with pytest.raises(SupersetDMLNotAllowedException):
            validate_sql_query("UPDATE users SET name = 'test'", mock_database)

        with pytest.raises(SupersetDMLNotAllowedException):
            validate_sql_query("DELETE FROM users", mock_database)

    def test_validate_sql_query_dml_allowed(self):
        """Test DML query validation passes when allowed."""
        mock_database = Mock()
        mock_database.allow_dml = True

        # Should not raise any exception
        validate_sql_query("INSERT INTO users VALUES (1, 'test')", mock_database)
        validate_sql_query("UPDATE users SET name = 'test'", mock_database)
        validate_sql_query("DELETE FROM users", mock_database)

    @patch("flask.current_app")
    def test_validate_sql_query_disallowed_function(self, mock_app):
        """Test disallowed function detection."""
        mock_database = Mock()
        mock_database.allow_dml = True

        # Configure disallowed functions - make it a regular Mock not AsyncMock
        mock_app.config = Mock()
        mock_app.config.get.return_value = {
            "sqlite": {"LOAD_FILE", "OUTFILE", "DUMPFILE"}
        }

        with pytest.raises(SupersetDisallowedSQLFunctionException):
            validate_sql_query("SELECT LOAD_FILE('/etc/passwd')", mock_database)

    def test_validate_sql_query_case_insensitive(self):
        """Test that validation is case insensitive."""
        mock_database = Mock()
        mock_database.allow_dml = False

        with pytest.raises(SupersetDMLNotAllowedException):
            validate_sql_query("InSeRt INTO users VALUES (1)", mock_database)


class TestExecuteSqlQuery:
    """Tests for execute_sql_query function."""

    def test_execute_sql_query_select_success(self):
        """Test successful SELECT query execution."""
        mock_database = Mock()
        mock_database.allow_dml = False

        # Mock cursor
        mock_cursor = Mock()
        mock_cursor.description = [
            ("id", "INTEGER", None, None, None, None, False),
            ("name", "VARCHAR", None, None, None, None, True),
        ]
        mock_cursor.fetchmany.return_value = [(1, "Alice"), (2, "Bob")]

        # Mock connection
        mock_conn = Mock()
        mock_conn.cursor.return_value = mock_cursor

        mock_context = MagicMock()
        mock_context.__enter__.return_value = mock_conn
        mock_context.__exit__.return_value = None

        mock_database.get_raw_connection.return_value = mock_context

        result = execute_sql_query(
            database=mock_database,
            sql="SELECT id, name FROM users",
            schema="public",
            limit=10,
            timeout=30,
            parameters=None,
        )

        assert result["row_count"] == 2
        assert len(result["rows"]) == 2
        assert result["rows"][0] == {"id": 1, "name": "Alice"}
        assert result["rows"][1] == {"id": 2, "name": "Bob"}
        assert len(result["columns"]) == 2
        assert result["columns"][0]["name"] == "id"
        assert result["columns"][0]["type"] == "INTEGER"
        assert result["execution_time"] > 0
        assert result["affected_rows"] is None

    def test_execute_sql_query_with_parameters(self):
        """Test query execution with parameter substitution."""
        mock_database = Mock()
        mock_database.allow_dml = False

        # Mock cursor
        mock_cursor = Mock()
        mock_cursor.description = [("count", "INTEGER", None, None, None, None, False)]
        mock_cursor.fetchmany.return_value = [(42,)]

        # Mock connection
        mock_conn = Mock()
        mock_conn.cursor.return_value = mock_cursor

        mock_context = MagicMock()
        mock_context.__enter__.return_value = mock_conn
        mock_context.__exit__.return_value = None

        mock_database.get_raw_connection.return_value = mock_context

        result = execute_sql_query(
            database=mock_database,
            sql="SELECT COUNT(*) as count FROM {table} WHERE status = '{status}'",
            schema=None,
            limit=1,
            timeout=30,
            parameters={"table": "orders", "status": "active"},
        )

        # Verify parameter substitution
        executed_sql = mock_cursor.execute.call_args[0][0]
        assert "orders" in executed_sql
        assert "active" in executed_sql
        assert result["row_count"] == 1
        assert result["rows"][0]["count"] == 42

    def test_execute_sql_query_missing_parameter(self):
        """Test error when parameter is missing."""
        mock_database = Mock()

        with pytest.raises(SupersetErrorException) as exc_info:
            execute_sql_query(
                database=mock_database,
                sql="SELECT * FROM {table_name}",
                schema=None,
                limit=10,
                timeout=30,
                parameters={},  # Missing table_name
            )

        assert "Missing parameter: table_name" in str(exc_info.value)

    def test_execute_sql_query_no_parameters_with_placeholders(self):
        """Test error when no parameters provided but SQL has placeholders."""
        mock_database = Mock()

        with pytest.raises(SupersetErrorException) as exc_info:
            execute_sql_query(
                database=mock_database,
                sql="SELECT * FROM {table_name} WHERE status = '{status}'",
                schema=None,
                limit=10,
                timeout=30,
                parameters=None,  # No parameters at all
            )

        assert "Missing parameter: table_name" in str(exc_info.value)

    def test_execute_sql_query_dml_success(self):
        """Test successful DML query execution."""
        mock_database = Mock()
        mock_database.allow_dml = True

        # Mock cursor for DML
        mock_cursor = Mock()
        mock_cursor.rowcount = 5

        # Mock connection
        mock_conn = Mock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.commit = Mock()

        mock_context = MagicMock()
        mock_context.__enter__.return_value = mock_conn
        mock_context.__exit__.return_value = None

        mock_database.get_raw_connection.return_value = mock_context

        result = execute_sql_query(
            database=mock_database,
            sql="UPDATE users SET active = true WHERE status = 'pending'",
            schema=None,
            limit=10,
            timeout=30,
            parameters=None,
        )

        assert result["affected_rows"] == 5
        assert result["rows"] == []
        assert result["row_count"] == 0
        assert result["execution_time"] > 0
        # Verify commit was called
        mock_conn.commit.assert_called_once()

    def test_execute_sql_query_limit_enforcement(self):
        """Test that LIMIT is added to SELECT queries."""
        mock_database = Mock()
        mock_database.allow_dml = False

        # Mock cursor
        mock_cursor = Mock()
        mock_cursor.description = []
        mock_cursor.fetchmany.return_value = []

        # Mock connection
        mock_conn = Mock()
        mock_conn.cursor.return_value = mock_cursor

        mock_context = MagicMock()
        mock_context.__enter__.return_value = mock_conn
        mock_context.__exit__.return_value = None

        mock_database.get_raw_connection.return_value = mock_context

        execute_sql_query(
            database=mock_database,
            sql="SELECT * FROM users",  # No LIMIT
            schema=None,
            limit=50,
            timeout=30,
            parameters=None,
        )

        # Verify LIMIT was added
        executed_sql = mock_cursor.execute.call_args[0][0]
        assert "LIMIT 50" in executed_sql

    def test_execute_sql_query_existing_limit_preserved(self):
        """Test that existing LIMIT is preserved."""
        mock_database = Mock()
        mock_database.allow_dml = False

        # Mock cursor
        mock_cursor = Mock()
        mock_cursor.description = []
        mock_cursor.fetchmany.return_value = []

        # Mock connection
        mock_conn = Mock()
        mock_conn.cursor.return_value = mock_cursor

        mock_context = MagicMock()
        mock_context.__enter__.return_value = mock_conn
        mock_context.__exit__.return_value = None

        mock_database.get_raw_connection.return_value = mock_context

        original_sql = "SELECT * FROM users LIMIT 10"
        execute_sql_query(
            database=mock_database,
            sql=original_sql,
            schema=None,
            limit=50,
            timeout=30,
            parameters=None,
        )

        # Verify original LIMIT is preserved
        executed_sql = mock_cursor.execute.call_args[0][0]
        assert executed_sql == original_sql

    def test_execute_sql_query_empty_results(self):
        """Test handling of empty result set."""
        mock_database = Mock()
        mock_database.allow_dml = False

        # Mock cursor with no results
        mock_cursor = Mock()
        mock_cursor.description = [("id", "INTEGER", None, None, None, None, False)]
        mock_cursor.fetchmany.return_value = []

        # Mock connection
        mock_conn = Mock()
        mock_conn.cursor.return_value = mock_cursor

        mock_context = MagicMock()
        mock_context.__enter__.return_value = mock_conn
        mock_context.__exit__.return_value = None

        mock_database.get_raw_connection.return_value = mock_context

        result = execute_sql_query(
            database=mock_database,
            sql="SELECT id FROM users WHERE 1=0",
            schema=None,
            limit=10,
            timeout=30,
            parameters=None,
        )

        assert result["row_count"] == 0
        assert result["rows"] == []
        assert len(result["columns"]) == 1  # Column metadata still present
