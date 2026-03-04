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

"""Unit tests for MCP save_sql_query tool."""

import pytest

from superset.mcp_service.sql_lab.schemas import (
    SaveSqlQueryRequest,
    SaveSqlQueryResponse,
)


class TestSaveSqlQuerySchemas:
    """Tests for save_sql_query request/response schemas."""

    def test_valid_request(self):
        """Test creating a valid SaveSqlQueryRequest."""
        request = SaveSqlQueryRequest(
            database_id=1,
            sql="SELECT * FROM users",
            label="All Users",
        )
        assert request.database_id == 1
        assert request.sql == "SELECT * FROM users"
        assert request.label == "All Users"
        assert request.description is None
        assert request.schema_name is None
        assert request.catalog is None
        assert request.template_parameters is None

    def test_request_with_all_fields(self):
        """Test request with all optional fields populated."""
        request = SaveSqlQueryRequest(
            database_id=1,
            sql="SELECT * FROM {{ table }}",
            label="Parameterized Query",
            description="A query with Jinja2 templates",
            schema="public",
            catalog="main",
            template_parameters='{"table": "users"}',
        )
        assert request.description == "A query with Jinja2 templates"
        assert request.schema_name == "public"
        assert request.catalog == "main"
        assert request.template_parameters == '{"table": "users"}'

    def test_request_rejects_empty_sql(self):
        """Test that empty SQL is rejected."""
        with pytest.raises(ValueError, match="SQL query cannot be empty"):
            SaveSqlQueryRequest(
                database_id=1,
                sql="   ",
                label="Bad Query",
            )

    def test_request_rejects_empty_label(self):
        """Test that empty label is rejected."""
        with pytest.raises(ValueError):
            SaveSqlQueryRequest(
                database_id=1,
                sql="SELECT 1",
                label="",
            )

    def test_request_strips_sql_whitespace(self):
        """Test that SQL whitespace is stripped."""
        request = SaveSqlQueryRequest(
            database_id=1,
            sql="  SELECT 1  ",
            label="Simple",
        )
        assert request.sql == "SELECT 1"

    def test_response_structure(self):
        """Test SaveSqlQueryResponse structure."""
        response = SaveSqlQueryResponse(
            id=42,
            label="My Query",
            sql_lab_url="http://localhost:8088/sqllab?savedQueryId=42",
            database_name="examples",
        )
        assert response.id == 42
        assert response.label == "My Query"
        assert "savedQueryId=42" in response.sql_lab_url
        assert response.database_name == "examples"
        assert response.error is None

    def test_response_with_error(self):
        """Test SaveSqlQueryResponse with error."""
        response = SaveSqlQueryResponse(
            id=0,
            label="Failed Query",
            sql_lab_url="",
            error="Database not found",
        )
        assert response.id == 0
        assert response.error == "Database not found"
