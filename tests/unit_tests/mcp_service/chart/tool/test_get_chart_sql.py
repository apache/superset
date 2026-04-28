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

from superset.mcp_service.auth import CLASS_PERMISSION_ATTR, METHOD_PERMISSION_ATTR
from superset.mcp_service.chart.schemas import (
    ChartError,
    ChartSql,
    GetChartSqlRequest,
)
from superset.mcp_service.chart.tool.get_chart_sql import (
    _build_query_context_from_form_data,
    _extract_sql_from_result,
    _find_chart_by_identifier,
    _resolve_datasource_name,
    _resolve_effective_form_data,
    _resolve_groupby,
    _resolve_metrics,
    _resolve_metrics_and_groupby,
    get_chart_sql,
)

_get_chart_sql_mod = importlib.import_module(
    "superset.mcp_service.chart.tool.get_chart_sql"
)


def test_get_chart_sql_requires_sql_lab_execute_permission():
    """Rendered SQL should not be exposed through basic chart read permission."""
    assert getattr(get_chart_sql, CLASS_PERMISSION_ATTR) == "SQLLab"
    assert getattr(get_chart_sql, METHOD_PERMISSION_ATTR) == "execute_sql_query"


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


class TestResolveMetricsAndGroupby:
    """Tests for metric/groupby resolution helpers."""

    def test_bubble_chart_extracts_x_y_size(self):
        """Bubble charts store measures in x, y, size fields."""
        form_data = {
            "viz_type": "bubble",
            "x": "col_x",
            "y": "col_y",
            "size": "col_size",
        }
        metrics = _resolve_metrics(form_data, "bubble")
        assert metrics == ["col_x", "col_y", "col_size"]

    def test_bubble_chart_via_resolve_metrics_and_groupby(self):
        """Integration: _resolve_metrics_and_groupby handles bubble type."""
        form_data = {
            "viz_type": "bubble",
            "x": "metric_a",
            "y": "metric_b",
            "size": "metric_c",
            "groupby": ["dim1"],
        }
        metrics, groupby = _resolve_metrics_and_groupby(form_data, chart=None)
        assert metrics == ["metric_a", "metric_b", "metric_c"]
        assert groupby == ["dim1"]

    def test_bubble_chart_missing_fields(self):
        """Bubble charts with missing x/y/size fields produce partial metrics."""
        form_data = {"viz_type": "bubble", "x": "only_x"}
        metrics = _resolve_metrics(form_data, "bubble")
        assert metrics == ["only_x"]

    def test_string_groupby_normalised_to_list(self):
        """A scalar string groupby must become a single-item list, not chars."""
        groupby = _resolve_groupby({"groupby": "country"})
        assert groupby == ["country"]

    def test_list_groupby_unchanged(self):
        """A list groupby should pass through normally."""
        groupby = _resolve_groupby({"groupby": ["col_a", "col_b"]})
        assert groupby == ["col_a", "col_b"]

    def test_empty_groupby_falls_back_to_entity_series(self):
        """Missing groupby falls back to entity/series/columns."""
        form_data = {"entity": "country", "series": "year"}
        groupby = _resolve_groupby(form_data)
        assert groupby == ["country", "year"]

    def test_empty_groupby_falls_back_to_columns(self):
        """Missing groupby falls back to columns list."""
        form_data = {"columns": ["a", "b"]}
        groupby = _resolve_groupby(form_data)
        assert groupby == ["a", "b"]


class TestBuildQueryContextFromFormData:
    """Regression tests for fallback query context construction.

    Verifies that temporal fields, adhoc_filters, and legacy filters from
    form_data are passed through to QueryContextFactory (not dropped).
    """

    @patch("superset.common.query_context_factory.QueryContextFactory")
    @patch("superset.daos.datasource.DatasourceDAO.get_datasource")
    def test_temporal_fields_passed_to_factory(self, mock_get_ds, mock_factory_cls):
        """time_range, adhoc_filters from form_data are processed and
        forwarded to the factory — not dropped."""
        mock_ds = Mock()
        mock_ds.database.db_engine_spec.engine = "postgresql"
        mock_get_ds.return_value = mock_ds

        mock_factory = Mock()
        mock_factory.create.return_value = Mock()
        mock_factory_cls.return_value = mock_factory

        form_data = {
            "datasource_id": 1,
            "datasource_type": "table",
            "metrics": ["count"],
            "groupby": ["country"],
            "time_range": "Last 7 days",
            "granularity_sqla": "created_at",
            "adhoc_filters": [
                {
                    "clause": "WHERE",
                    "expressionType": "SIMPLE",
                    "subject": "status",
                    "operator": "==",
                    "comparator": "active",
                }
            ],
            "where": "region = 'US'",
            "having": "count > 10",
            "filters": [{"col": "city", "op": "==", "val": "NYC"}],
        }

        with patch(
            "superset.common.chart_data.ChartDataResultType"
        ) as mock_result_type:
            mock_result_type.QUERY = "QUERY"
            _build_query_context_from_form_data(form_data, chart=None)

        call_kwargs = mock_factory.create.call_args[1]
        assert call_kwargs["form_data"] is form_data
        assert call_kwargs["form_data"]["time_range"] == "Last 7 days"
        assert call_kwargs["form_data"]["granularity_sqla"] == "created_at"

        # adhoc_filters are preprocessed by split_adhoc_filters_into_base_filters
        # into form_data["filters"]/["where"]/["having"], then included
        # in the query dict as concrete filter clauses.
        queries = call_kwargs["queries"]
        assert len(queries) == 1
        assert queries[0]["time_range"] == "Last 7 days"
        assert "adhoc_filters" not in queries[0]
        # The simple adhoc WHERE filter (status == active) should be
        # merged into filters by split_adhoc_filters_into_base_filters.
        filters = queries[0].get("filters", [])
        assert {"col": "status", "op": "==", "val": "active"} in filters

    @patch("superset.common.query_context_factory.QueryContextFactory")
    def test_metrics_and_groupby_in_queries(self, mock_factory_cls):
        """Resolved metrics and groupby are passed in queries parameter."""
        mock_factory = Mock()
        mock_factory.create.return_value = Mock()
        mock_factory_cls.return_value = mock_factory

        form_data = {
            "datasource_id": 1,
            "datasource_type": "table",
            "metrics": ["sum_revenue"],
            "groupby": ["product"],
        }

        with patch(
            "superset.common.chart_data.ChartDataResultType"
        ) as mock_result_type:
            mock_result_type.QUERY = "QUERY"
            _build_query_context_from_form_data(form_data, chart=None)

        call_kwargs = mock_factory.create.call_args[1]
        queries = call_kwargs["queries"]
        assert len(queries) == 1
        assert queries[0]["metrics"] == ["sum_revenue"]
        assert queries[0]["columns"] == ["product"]


class TestResolveDatasourceName:
    """Tests for _resolve_datasource_name helper."""

    def test_returns_chart_datasource_name_when_chart_exists(self):
        """When a chart object is provided, use its datasource_name."""
        chart = Mock()
        chart.datasource_name = "my_dataset"
        result = _resolve_datasource_name({"datasource_id": 1}, chart)
        assert result == "my_dataset"

    @patch(
        "superset.mcp_service.chart.tool.get_chart_sql.DatasourceDAO",
        create=True,
    )
    def test_resolves_from_form_data_when_chart_is_none(self, mock_dao):
        """Unsaved charts resolve datasource name via DAO lookup."""
        mock_ds = Mock()
        mock_ds.name = "resolved_dataset"

        with patch(
            "superset.daos.datasource.DatasourceDAO.get_datasource",
            return_value=mock_ds,
        ):
            result = _resolve_datasource_name(
                {"datasource_id": 42, "datasource_type": "table"}, chart=None
            )
        assert result == "resolved_dataset"

    def test_returns_none_when_no_datasource_id(self):
        """Returns None when form_data has no datasource info."""
        result = _resolve_datasource_name({}, chart=None)
        assert result is None

    def test_returns_none_when_datasource_not_found(self):
        """Returns None when DAO raises DatasourceNotFound."""
        from superset.daos.exceptions import DatasourceNotFound

        with patch(
            "superset.daos.datasource.DatasourceDAO.get_datasource",
            side_effect=DatasourceNotFound(),
        ):
            result = _resolve_datasource_name(
                {"datasource_id": 999, "datasource_type": "table"}, chart=None
            )
        assert result is None

    def test_returns_none_on_unsupported_type(self):
        """Returns None when DAO raises DatasourceTypeNotSupportedError."""
        from superset.daos.exceptions import DatasourceTypeNotSupportedError

        with patch(
            "superset.daos.datasource.DatasourceDAO.get_datasource",
            side_effect=DatasourceTypeNotSupportedError(),
        ):
            result = _resolve_datasource_name(
                {"datasource_id": 1, "datasource_type": "invalid"}, chart=None
            )
        assert result is None

    @patch("superset.daos.datasource.DatasourceDAO.get_datasource")
    def test_resolves_combined_datasource_field(self, mock_get_ds):
        """Handles combined 'datasource' field like '123__table'."""
        mock_ds = Mock()
        mock_ds.name = "combined_dataset"
        mock_get_ds.return_value = mock_ds

        result = _resolve_datasource_name({"datasource": "123__table"}, chart=None)
        assert result == "combined_dataset"


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
