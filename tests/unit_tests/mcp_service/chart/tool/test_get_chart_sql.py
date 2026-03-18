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
Unit tests for get_chart_sql MCP tool
"""

import importlib
from unittest.mock import Mock, patch

import pytest

from superset.mcp_service.chart.schemas import (
    ChartError,
    ChartSql,
    GetChartSqlRequest,
)
from superset.mcp_service.chart.tool.get_chart_sql import (
    _extract_sql_from_result,
    _find_chart_by_identifier,
    _resolve_effective_form_data,
)

_get_chart_sql_mod = importlib.import_module(
    "superset.mcp_service.chart.tool.get_chart_sql"
)


class TestGetChartSqlRequestSchema:
    """Tests for GetChartSqlRequest schema validation."""

    def test_valid_request_with_identifier(self):
        """Test creating request with a numeric identifier."""
        request = GetChartSqlRequest(identifier=123)
        assert request.identifier == 123
        assert request.form_data_key is None

    def test_valid_request_with_uuid_identifier(self):
        """Test creating request with a UUID string identifier."""
        request = GetChartSqlRequest(identifier="abc-def-123")
        assert request.identifier == "abc-def-123"
        assert request.form_data_key is None

    def test_valid_request_with_form_data_key_only(self):
        """Test creating request with form_data_key only (unsaved chart)."""
        request = GetChartSqlRequest(form_data_key="some-key")
        assert request.identifier is None
        assert request.form_data_key == "some-key"

    def test_valid_request_with_both(self):
        """Test creating request with both identifier and form_data_key."""
        request = GetChartSqlRequest(identifier=42, form_data_key="some-key")
        assert request.identifier == 42
        assert request.form_data_key == "some-key"

    def test_invalid_request_neither_provided(self):
        """Test request fails when neither identifier nor key given."""
        with pytest.raises(ValueError, match="At least one of"):
            GetChartSqlRequest()


class TestExtractSqlFromResult:
    """Tests for the _extract_sql_from_result helper."""

    def test_successful_sql_extraction(self):
        """Test extracting SQL from a normal result."""
        result = {
            "queries": [
                {
                    "query": "SELECT * FROM my_table WHERE x > 1",
                    "language": "sql",
                }
            ]
        }
        output = _extract_sql_from_result(
            result,
            chart_id=10,
            chart_name="Sales Chart",
            datasource_name="my_table",
        )
        assert isinstance(output, ChartSql)
        assert output.sql == "SELECT * FROM my_table WHERE x > 1"
        assert output.language == "sql"
        assert output.chart_id == 10
        assert output.chart_name == "Sales Chart"
        assert output.datasource_name == "my_table"
        assert output.error is None

    def test_empty_queries_returns_error(self):
        """Test that empty query results return a ChartError."""
        result = {"queries": []}
        output = _extract_sql_from_result(
            result, chart_id=1, chart_name="Test", datasource_name="ds"
        )
        assert isinstance(output, ChartError)
        assert output.error_type == "EmptyQuery"

    def test_missing_queries_key_returns_error(self):
        """Test that missing 'queries' key returns a ChartError."""
        result = {}
        output = _extract_sql_from_result(
            result, chart_id=1, chart_name="Test", datasource_name="ds"
        )
        assert isinstance(output, ChartError)
        assert output.error_type == "EmptyQuery"

    def test_no_sql_with_error_returns_chart_error(self):
        """Test that empty sql with an error message returns ChartError."""
        result = {
            "queries": [
                {
                    "query": "",
                    "language": "sql",
                    "error": "Unknown column 'foo'",
                }
            ]
        }
        output = _extract_sql_from_result(
            result, chart_id=5, chart_name="Bad Chart", datasource_name="ds"
        )
        assert isinstance(output, ChartError)
        assert output.error_type == "QueryGenerationFailed"
        assert "Unknown column" in output.error

    def test_sql_with_error_returns_chart_sql(self):
        """Test that partial SQL with a non-fatal error returns ChartSql with error."""
        result = {
            "queries": [
                {
                    "query": "SELECT col1 FROM tbl",
                    "language": "sql",
                    "error": "Warning: column col2 not found",
                }
            ]
        }
        output = _extract_sql_from_result(
            result, chart_id=7, chart_name="Partial", datasource_name="tbl"
        )
        assert isinstance(output, ChartSql)
        assert output.sql == "SELECT col1 FROM tbl"
        assert output.error is not None

    def test_null_chart_metadata(self):
        """Test extraction when chart metadata is None."""
        result = {"queries": [{"query": "SELECT 1", "language": "sql"}]}
        output = _extract_sql_from_result(
            result, chart_id=None, chart_name=None, datasource_name=None
        )
        assert isinstance(output, ChartSql)
        assert output.chart_id is None
        assert output.chart_name is None
        assert output.datasource_name is None


class TestFindChartByIdentifier:
    """Tests for the _find_chart_by_identifier helper."""

    @patch("superset.daos.chart.ChartDAO.find_by_id")
    def test_find_by_numeric_id(self, mock_find):
        """Test finding chart by numeric ID."""
        mock_chart = Mock()
        mock_find.return_value = mock_chart

        result = _find_chart_by_identifier(42)

        mock_find.assert_called_once_with(42)
        assert result == mock_chart

    @patch("superset.daos.chart.ChartDAO.find_by_id")
    def test_find_by_digit_string(self, mock_find):
        """Test finding chart by digit string (treated as numeric ID)."""
        mock_chart = Mock()
        mock_find.return_value = mock_chart

        result = _find_chart_by_identifier("123")

        mock_find.assert_called_once_with(123)
        assert result == mock_chart

    @patch("superset.daos.chart.ChartDAO.find_by_id")
    def test_find_by_uuid_string(self, mock_find):
        """Test finding chart by UUID string."""
        mock_chart = Mock()
        mock_find.return_value = mock_chart

        result = _find_chart_by_identifier("abc-123-def")

        mock_find.assert_called_once_with("abc-123-def", id_column="uuid")
        assert result == mock_chart

    @patch("superset.daos.chart.ChartDAO.find_by_id")
    def test_not_found_returns_none(self, mock_find):
        """Test that None is returned when chart is not found."""
        mock_find.return_value = None

        result = _find_chart_by_identifier(999)

        assert result is None


class TestResolveEffectiveFormData:
    """Tests for the _resolve_effective_form_data helper."""

    def test_returns_saved_params_when_no_form_data_key(self):
        """Test that saved chart params are returned when no form_data_key."""
        mock_chart = Mock()
        mock_chart.params = '{"metrics": ["count"], "viz_type": "table"}'

        form_data, using_unsaved = _resolve_effective_form_data(
            mock_chart, form_data_key=None
        )

        assert form_data == {"metrics": ["count"], "viz_type": "table"}
        assert using_unsaved is False

    def test_returns_empty_dict_when_no_params(self):
        """Test that empty dict is returned when chart has no params."""
        mock_chart = Mock()
        mock_chart.params = None

        form_data, using_unsaved = _resolve_effective_form_data(
            mock_chart, form_data_key=None
        )

        assert form_data == {}
        assert using_unsaved is False

    def test_returns_empty_dict_for_invalid_json_params(self):
        """Test that invalid JSON in params returns empty dict."""
        mock_chart = Mock()
        mock_chart.params = "not-valid-json"

        form_data, using_unsaved = _resolve_effective_form_data(
            mock_chart, form_data_key=None
        )

        assert form_data == {}
        assert using_unsaved is False

    @patch.object(_get_chart_sql_mod, "_get_cached_form_data")
    def test_returns_cached_form_data_when_key_provided(self, mock_get_cached):
        """Test that cached form_data is used when form_data_key is provided."""
        mock_get_cached.return_value = '{"metrics": ["sum_sales"], "unsaved": true}'
        mock_chart = Mock()
        mock_chart.params = '{"metrics": ["count"]}'

        form_data, using_unsaved = _resolve_effective_form_data(
            mock_chart, form_data_key="test-key-123"
        )

        assert form_data == {"metrics": ["sum_sales"], "unsaved": True}
        assert using_unsaved is True

    @patch.object(_get_chart_sql_mod, "_get_cached_form_data")
    def test_falls_back_to_saved_when_cache_miss(self, mock_get_cached):
        """Test fallback to saved params when cache returns nothing."""
        mock_get_cached.return_value = None
        mock_chart = Mock()
        mock_chart.params = '{"metrics": ["count"]}'

        form_data, using_unsaved = _resolve_effective_form_data(
            mock_chart, form_data_key="expired-key"
        )

        assert form_data == {"metrics": ["count"]}
        assert using_unsaved is False


class TestGetChartSqlTool:
    """Integration-style tests for the get_chart_sql MCP tool via Client."""

    @pytest.fixture(autouse=True)
    def mock_auth(self):
        """Mock authentication for all tests."""
        with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
            mock_user = Mock()
            mock_user.id = 1
            mock_user.username = "admin"
            mock_get_user.return_value = mock_user
            yield mock_get_user

    @pytest.fixture
    def mcp_server(self):
        from superset.mcp_service.app import mcp

        return mcp

    @patch.object(_get_chart_sql_mod, "validate_chart_dataset")
    @patch.object(_get_chart_sql_mod, "_find_chart_by_identifier")
    @pytest.mark.asyncio
    async def test_chart_not_found(self, mock_find, mock_validate, mcp_server):
        """Test that a not-found chart returns an error."""
        from fastmcp import Client

        mock_find.return_value = None

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_chart_sql", {"request": {"identifier": 999}}
            )

            data = result.structured_content.get("result", result.structured_content)
            assert data["error_type"] == "NotFound"
            assert "999" in data["error"]

    @patch.object(_get_chart_sql_mod, "_sql_from_form_data")
    @patch.object(_get_chart_sql_mod, "_sql_from_saved_query_context")
    @patch.object(_get_chart_sql_mod, "_resolve_effective_form_data")
    @patch.object(_get_chart_sql_mod, "validate_chart_dataset")
    @patch.object(_get_chart_sql_mod, "_find_chart_by_identifier")
    @pytest.mark.asyncio
    async def test_success_via_saved_query_context(
        self,
        mock_find,
        mock_validate,
        mock_resolve,
        mock_saved_qc,
        mock_form_data_sql,
        mcp_server,
    ):
        """Test successful SQL retrieval via saved query_context."""
        from fastmcp import Client

        from superset.mcp_service.chart.chart_utils import (
            DatasetValidationResult,
        )

        mock_chart = Mock()
        mock_chart.id = 10
        mock_chart.slice_name = "Sales Chart"
        mock_chart.viz_type = "table"
        mock_find.return_value = mock_chart

        mock_validate.return_value = DatasetValidationResult(
            is_valid=True, dataset_id=1, dataset_name="ds", warnings=[]
        )
        mock_resolve.return_value = ({"metrics": ["count"]}, False)
        mock_saved_qc.return_value = ChartSql(
            chart_id=10,
            chart_name="Sales Chart",
            sql="SELECT COUNT(*) FROM sales",
            language="sql",
            datasource_name="sales",
        )

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_chart_sql", {"request": {"identifier": 10}}
            )

            data = result.structured_content.get("result", result.structured_content)
            assert "SELECT COUNT(*) FROM sales" in data["sql"]
            assert data["chart_id"] == 10

    @patch.object(_get_chart_sql_mod, "_sql_from_form_data")
    @patch.object(_get_chart_sql_mod, "_sql_from_saved_query_context")
    @patch.object(_get_chart_sql_mod, "_resolve_effective_form_data")
    @patch.object(_get_chart_sql_mod, "validate_chart_dataset")
    @patch.object(_get_chart_sql_mod, "_find_chart_by_identifier")
    @pytest.mark.asyncio
    async def test_fallback_to_form_data_when_saved_qc_fails(
        self,
        mock_find,
        mock_validate,
        mock_resolve,
        mock_saved_qc,
        mock_form_data_sql,
        mcp_server,
    ):
        """Test fallback to form_data path when saved query_context returns None."""
        from fastmcp import Client

        from superset.mcp_service.chart.chart_utils import (
            DatasetValidationResult,
        )

        mock_chart = Mock()
        mock_chart.id = 20
        mock_chart.slice_name = "Revenue"
        mock_chart.viz_type = "bar"
        mock_find.return_value = mock_chart

        mock_validate.return_value = DatasetValidationResult(
            is_valid=True, dataset_id=2, dataset_name="revenue", warnings=[]
        )
        mock_resolve.return_value = ({"metrics": ["sum_revenue"]}, False)
        mock_saved_qc.return_value = None
        mock_form_data_sql.return_value = ChartSql(
            chart_id=20,
            chart_name="Revenue",
            sql="SELECT SUM(revenue) FROM orders",
            language="sql",
            datasource_name="orders",
        )

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_chart_sql", {"request": {"identifier": 20}}
            )

            data = result.structured_content.get("result", result.structured_content)
            assert "SELECT SUM(revenue) FROM orders" in data["sql"]
            mock_form_data_sql.assert_called_once()

    @patch.object(_get_chart_sql_mod, "validate_chart_dataset")
    @patch.object(_get_chart_sql_mod, "_find_chart_by_identifier")
    @pytest.mark.asyncio
    async def test_dataset_not_accessible(self, mock_find, mock_validate, mcp_server):
        """Test that inaccessible dataset returns error."""
        from fastmcp import Client

        from superset.mcp_service.chart.chart_utils import (
            DatasetValidationResult,
        )

        mock_chart = Mock()
        mock_chart.id = 30
        mock_chart.slice_name = "Restricted"
        mock_chart.viz_type = "table"
        mock_find.return_value = mock_chart

        mock_validate.return_value = DatasetValidationResult(
            is_valid=False,
            dataset_id=3,
            dataset_name="secret_ds",
            warnings=[],
            error="Access denied to dataset secret_ds",
        )

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_chart_sql", {"request": {"identifier": 30}}
            )

            data = result.structured_content.get("result", result.structured_content)
            assert data["error_type"] == "DatasetNotAccessible"
            assert "Access denied" in data["error"]
