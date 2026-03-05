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
Tests for cancel_query_id validation to prevent SQL/command injection.

These tests verify that the validate_cancel_query_id method properly
rejects malicious input that could be used for SQL injection attacks.
"""

from unittest.mock import Mock, patch

import pytest


class TestValidateCancelQueryId:
    """Tests for BaseEngineSpec.validate_cancel_query_id"""

    def test_validate_cancel_query_id_valid_numeric(self) -> None:
        """Test that valid numeric IDs pass validation"""
        from superset.db_engine_specs.base import BaseEngineSpec

        assert BaseEngineSpec.validate_cancel_query_id("12345") is True
        assert BaseEngineSpec.validate_cancel_query_id("1") is True
        assert BaseEngineSpec.validate_cancel_query_id("999999999") is True

    def test_validate_cancel_query_id_invalid_sql_injection(self) -> None:
        """Test that SQL injection payloads are rejected"""
        from superset.db_engine_specs.base import BaseEngineSpec

        # Common SQL injection payloads
        assert BaseEngineSpec.validate_cancel_query_id("1; DROP TABLE users; --") is False
        assert BaseEngineSpec.validate_cancel_query_id("1' OR '1'='1") is False
        assert BaseEngineSpec.validate_cancel_query_id("1 UNION SELECT * FROM users") is False
        assert BaseEngineSpec.validate_cancel_query_id("1; DELETE FROM users;") is False

    def test_validate_cancel_query_id_invalid_special_chars(self) -> None:
        """Test that special characters are rejected"""
        from superset.db_engine_specs.base import BaseEngineSpec

        assert BaseEngineSpec.validate_cancel_query_id("123&admin=true") is False
        assert BaseEngineSpec.validate_cancel_query_id("123#fragment") is False
        assert BaseEngineSpec.validate_cancel_query_id("123\n456") is False
        assert BaseEngineSpec.validate_cancel_query_id("123\r\nHost: evil") is False

    def test_validate_cancel_query_id_none(self) -> None:
        """Test that None is rejected"""
        from superset.db_engine_specs.base import BaseEngineSpec

        assert BaseEngineSpec.validate_cancel_query_id(None) is False

    def test_validate_cancel_query_id_empty_string(self) -> None:
        """Test that empty string is rejected"""
        from superset.db_engine_specs.base import BaseEngineSpec

        assert BaseEngineSpec.validate_cancel_query_id("") is False

    def test_validate_cancel_query_id_custom_pattern(self) -> None:
        """Test custom regex patterns"""
        from superset.db_engine_specs.base import BaseEngineSpec

        # Hex pattern with exact length (for Impala - 16 hex chars per side)
        assert BaseEngineSpec.validate_cancel_query_id(
            "abc123def4567890:789abc123def4567", r"[A-Fa-f0-9]{16}:[A-Fa-f0-9]{16}"
        ) is True
        assert BaseEngineSpec.validate_cancel_query_id(
            "invalid:pattern!", r"[A-Fa-f0-9]{16}:[A-Fa-f0-9]{16}"
        ) is False

        # Alphanumeric with underscores (for Trino)
        assert BaseEngineSpec.validate_cancel_query_id(
            "20240101_123456_00001_abcde", r"[a-zA-Z0-9_]+"
        ) is True
        assert BaseEngineSpec.validate_cancel_query_id(
            "20240101-123456", r"[a-zA-Z0-9_]+"
        ) is False


class TestMySQLCancelQueryValidation:
    """Tests for MySQL cancel_query input validation"""

    @patch("sqlalchemy.engine.Engine.connect")
    def test_cancel_query_valid_id(self, engine_mock: Mock) -> None:
        """Test that valid MySQL connection ID works"""
        from superset.db_engine_specs.mysql import MySQLEngineSpec
        from superset.models.sql_lab import Query

        query = Query()
        cursor_mock = engine_mock.return_value.__enter__.return_value
        assert MySQLEngineSpec.cancel_query(cursor_mock, query, "12345") is True
        cursor_mock.execute.assert_called_once_with("KILL CONNECTION 12345")

    @patch("sqlalchemy.engine.Engine.connect")
    def test_cancel_query_sql_injection_blocked(self, engine_mock: Mock) -> None:
        """Test that SQL injection is blocked"""
        from superset.db_engine_specs.mysql import MySQLEngineSpec
        from superset.models.sql_lab import Query

        query = Query()
        cursor_mock = engine_mock.return_value.__enter__.return_value

        # SQL injection payload should be rejected before execute is called
        result = MySQLEngineSpec.cancel_query(
            cursor_mock, query, "1; DROP TABLE users; --"
        )
        assert result is False
        cursor_mock.execute.assert_not_called()

    @patch("sqlalchemy.engine.Engine.connect")
    def test_cancel_query_non_numeric_blocked(self, engine_mock: Mock) -> None:
        """Test that non-numeric IDs are blocked"""
        from superset.db_engine_specs.mysql import MySQLEngineSpec
        from superset.models.sql_lab import Query

        query = Query()
        cursor_mock = engine_mock.return_value.__enter__.return_value

        assert MySQLEngineSpec.cancel_query(cursor_mock, query, "abc") is False
        assert MySQLEngineSpec.cancel_query(cursor_mock, query, "12.34") is False
        assert MySQLEngineSpec.cancel_query(cursor_mock, query, "-123") is False
        cursor_mock.execute.assert_not_called()


class TestSingleStoreCancelQueryValidation:
    """Tests for SingleStore cancel_query input validation"""

    @patch("sqlalchemy.engine.Engine.connect")
    def test_cancel_query_valid_id(self, engine_mock: Mock) -> None:
        """Test valid SingleStore connection ID format (two space-separated integers)"""
        from superset.db_engine_specs.singlestore import SingleStoreSpec
        from superset.models.sql_lab import Query

        query = Query()
        cursor_mock = engine_mock.return_value.__enter__.return_value

        # Single integer should work
        assert SingleStoreSpec.cancel_query(cursor_mock, query, "12345") is True

        # Two space-separated integers should work
        cursor_mock.reset_mock()
        assert SingleStoreSpec.cancel_query(cursor_mock, query, "12345 67890") is True

    @patch("sqlalchemy.engine.Engine.connect")
    def test_cancel_query_sql_injection_blocked(self, engine_mock: Mock) -> None:
        """Test that SQL injection is blocked"""
        from superset.db_engine_specs.singlestore import SingleStoreSpec
        from superset.models.sql_lab import Query

        query = Query()
        cursor_mock = engine_mock.return_value.__enter__.return_value

        result = SingleStoreSpec.cancel_query(
            cursor_mock, query, "1; DROP TABLE users; --"
        )
        assert result is False
        cursor_mock.execute.assert_not_called()


class TestPostgresCancelQueryValidation:
    """Tests for PostgreSQL cancel_query input validation"""

    @patch("sqlalchemy.engine.Engine.connect")
    def test_cancel_query_valid_id(self, engine_mock: Mock) -> None:
        """Test that valid PostgreSQL PID works"""
        from superset.db_engine_specs.postgres import PostgresEngineSpec
        from superset.models.sql_lab import Query

        query = Query()
        cursor_mock = engine_mock.return_value.__enter__.return_value
        assert PostgresEngineSpec.cancel_query(cursor_mock, query, "12345") is True

    @patch("sqlalchemy.engine.Engine.connect")
    def test_cancel_query_sql_injection_blocked(self, engine_mock: Mock) -> None:
        """Test that SQL injection is blocked"""
        from superset.db_engine_specs.postgres import PostgresEngineSpec
        from superset.models.sql_lab import Query

        query = Query()
        cursor_mock = engine_mock.return_value.__enter__.return_value

        # SQL injection in WHERE clause
        result = PostgresEngineSpec.cancel_query(
            cursor_mock, query, "1' OR '1'='1"
        )
        assert result is False
        cursor_mock.execute.assert_not_called()


class TestRedshiftCancelQueryValidation:
    """Tests for Redshift cancel_query input validation"""

    @patch("sqlalchemy.engine.Engine.connect")
    def test_cancel_query_valid_id(self, engine_mock: Mock) -> None:
        """Test that valid Redshift PID works"""
        from superset.db_engine_specs.redshift import RedshiftEngineSpec
        from superset.models.sql_lab import Query

        query = Query()
        cursor_mock = engine_mock.return_value.__enter__.return_value
        assert RedshiftEngineSpec.cancel_query(cursor_mock, query, "12345") is True

    @patch("sqlalchemy.engine.Engine.connect")
    def test_cancel_query_sql_injection_blocked(self, engine_mock: Mock) -> None:
        """Test that SQL injection is blocked"""
        from superset.db_engine_specs.redshift import RedshiftEngineSpec
        from superset.models.sql_lab import Query

        query = Query()
        cursor_mock = engine_mock.return_value.__enter__.return_value

        result = RedshiftEngineSpec.cancel_query(
            cursor_mock, query, "1; DROP TABLE users; --"
        )
        assert result is False
        cursor_mock.execute.assert_not_called()


class TestSnowflakeCancelQueryValidation:
    """Tests for Snowflake cancel_query input validation"""

    @patch("sqlalchemy.engine.Engine.connect")
    def test_cancel_query_valid_id(self, engine_mock: Mock) -> None:
        """Test that valid Snowflake session ID works"""
        from superset.db_engine_specs.snowflake import SnowflakeEngineSpec
        from superset.models.sql_lab import Query

        query = Query()
        cursor_mock = engine_mock.return_value.__enter__.return_value
        # Snowflake session IDs are alphanumeric (VARCHAR)
        assert SnowflakeEngineSpec.cancel_query(cursor_mock, query, "34359980038") is True
        cursor_mock.reset_mock()
        # Also test alphanumeric (per Snowflake docs)
        assert SnowflakeEngineSpec.cancel_query(cursor_mock, query, "ABC123def456") is True

    @patch("sqlalchemy.engine.Engine.connect")
    def test_cancel_query_sql_injection_blocked(self, engine_mock: Mock) -> None:
        """Test that SQL injection is blocked"""
        from superset.db_engine_specs.snowflake import SnowflakeEngineSpec
        from superset.models.sql_lab import Query

        query = Query()
        cursor_mock = engine_mock.return_value.__enter__.return_value

        result = SnowflakeEngineSpec.cancel_query(
            cursor_mock, query, "1); DROP TABLE users; --"
        )
        assert result is False
        cursor_mock.execute.assert_not_called()


class TestTrinoCancelQueryValidation:
    """Tests for Trino cancel_query input validation"""

    @patch("sqlalchemy.engine.Engine.connect")
    def test_cancel_query_valid_id(self, engine_mock: Mock) -> None:
        """Test that valid Trino query ID works"""
        from superset.db_engine_specs.trino import TrinoEngineSpec
        from superset.models.sql_lab import Query

        query = Query()
        cursor_mock = engine_mock.return_value.__enter__.return_value

        # Trino query IDs are alphanumeric with underscores
        assert TrinoEngineSpec.cancel_query(
            cursor_mock, query, "20240101_123456_00001_abcde"
        ) is True

    @patch("sqlalchemy.engine.Engine.connect")
    def test_cancel_query_sql_injection_blocked(self, engine_mock: Mock) -> None:
        """Test that SQL injection is blocked"""
        from superset.db_engine_specs.trino import TrinoEngineSpec
        from superset.models.sql_lab import Query

        query = Query()
        cursor_mock = engine_mock.return_value.__enter__.return_value

        result = TrinoEngineSpec.cancel_query(
            cursor_mock, query, "query_id'); DROP TABLE users; --"
        )
        assert result is False
        cursor_mock.execute.assert_not_called()


class TestImpalaCancelQueryValidation:
    """Tests for Impala cancel_query input validation"""

    @patch("requests.post")
    def test_cancel_query_valid_id(self, requests_mock: Mock) -> None:
        """Test that valid Impala query ID works"""
        from superset.db_engine_specs.impala import ImpalaEngineSpec
        from superset.models.sql_lab import Query
        from superset.models.core import Database

        # Mock the database and query
        mock_db = Mock(spec=Database)
        mock_db.url_object.host = "impala-host"

        query = Mock(spec=Query)
        query.database = mock_db

        requests_mock.return_value.status_code = 200

        # Valid Impala query ID format: 16 hex chars per side
        result = ImpalaEngineSpec.cancel_query(
            None, query, "abc123def4567890:789abc123def4567"
        )
        assert result is True
        requests_mock.assert_called_once()

        # Also test uppercase hex (should be valid)
        requests_mock.reset_mock()
        requests_mock.return_value.status_code = 200
        result = ImpalaEngineSpec.cancel_query(
            None, query, "ABC123DEF4567890:789ABC123DEF4567"
        )
        assert result is True

    @patch("requests.post")
    def test_cancel_query_url_injection_blocked(self, requests_mock: Mock) -> None:
        """Test that URL injection is blocked"""
        from superset.db_engine_specs.impala import ImpalaEngineSpec
        from superset.models.sql_lab import Query
        from superset.models.core import Database

        mock_db = Mock(spec=Database)
        mock_db.url_object.host = "impala-host"

        query = Mock(spec=Query)
        query.database = mock_db

        # URL injection payloads should be rejected
        result = ImpalaEngineSpec.cancel_query(
            None, query, "abc123&admin=true"
        )
        assert result is False
        requests_mock.assert_not_called()

        result = ImpalaEngineSpec.cancel_query(
            None, query, "abc123#fragment"
        )
        assert result is False
        requests_mock.assert_not_called()

    @patch("requests.post")
    def test_cancel_query_invalid_format_blocked(self, requests_mock: Mock) -> None:
        """Test that invalid format is blocked"""
        from superset.db_engine_specs.impala import ImpalaEngineSpec
        from superset.models.sql_lab import Query
        from superset.models.core import Database

        mock_db = Mock(spec=Database)
        mock_db.url_object.host = "impala-host"

        query = Mock(spec=Query)
        query.database = mock_db

        # Missing colon
        assert ImpalaEngineSpec.cancel_query(None, query, "abc123def4567890") is False
        # Wrong length (too short)
        assert ImpalaEngineSpec.cancel_query(None, query, "abc:def") is False
        # Wrong length (too long)
        assert (
            ImpalaEngineSpec.cancel_query(
                None, query, "abc123def45678901:789abc123def45678"
            )
            is False
        )
        # Special characters
        assert ImpalaEngineSpec.cancel_query(None, query, "abc!:def@ghijklmn") is False
        # Non-hex characters
        assert (
            ImpalaEngineSpec.cancel_query(
                None, query, "ghijklmnopqrstuv:ghijklmnopqrstuv"
            )
            is False
        )
        requests_mock.assert_not_called()

    @patch("requests.post")
    def test_cancel_query_null_host_blocked(self, requests_mock: Mock) -> None:
        """Test that missing host returns False"""
        from superset.db_engine_specs.impala import ImpalaEngineSpec
        from superset.models.sql_lab import Query
        from superset.models.core import Database

        mock_db = Mock(spec=Database)
        mock_db.url_object.host = None  # Null host

        query = Mock(spec=Query)
        query.database = mock_db

        # Valid query ID but null host should fail
        result = ImpalaEngineSpec.cancel_query(
            None, query, "abc123def4567890:789abc123def4567"
        )
        assert result is False
        requests_mock.assert_not_called()

        # Also test empty string host
        mock_db.url_object.host = ""
        result = ImpalaEngineSpec.cancel_query(
            None, query, "abc123def4567890:789abc123def4567"
        )
        assert result is False
        requests_mock.assert_not_called()
