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
from unittest.mock import Mock, patch

import pytest

from superset.commands.chart.warm_up_cache import ChartWarmUpCacheCommand
from superset.models.slice import Slice


@patch("superset.commands.chart.warm_up_cache.get_dashboard_extra_filters")
@patch("superset.commands.chart.warm_up_cache.ChartDataCommand")
def test_applies_dashboard_filters_to_non_legacy_chart(
    mock_chart_data_command, mock_get_dashboard_filters
):
    """Verify dashboard filters are added to query.filter for non-legacy viz"""
    # Setup: Mock dashboard filters response
    mock_get_dashboard_filters.return_value = [
        {"col": "country", "op": "in", "val": ["USA", "France"]}
    ]

    # Create a chart with non-legacy viz type
    chart = Slice(
        id=123,
        slice_name="Test Chart",
        viz_type="echarts_timeseries_bar",
        datasource_id=1,
        datasource_type="table",
    )

    # Create mock query with empty filter list
    mock_query = Mock()
    mock_query.filter = []
    mock_qc = Mock()
    mock_qc.queries = [mock_query]
    mock_qc.force = False

    # Mock dependencies
    with patch.object(chart, "get_query_context", return_value=mock_qc):
        with patch(
            "superset.commands.chart.warm_up_cache.get_form_data",
            return_value=[{"viz_type": "echarts_timeseries_bar"}],
        ):
            mock_chart_data_command.return_value.run.return_value = {
                "queries": [{"error": None, "status": "success"}]
            }

            # Execute with dashboard_id
            result = ChartWarmUpCacheCommand(chart, 42, None).run()

            # VALIDATE: Filters were added to query.filter
            assert len(mock_query.filter) == 1, "Filter should be added to query"
            assert mock_query.filter[0] == {
                "col": "country",
                "op": "in",
                "val": ["USA", "France"],
            }, "Filter content should match dashboard filter"

            # VALIDATE: get_dashboard_extra_filters was called correctly
            mock_get_dashboard_filters.assert_called_once_with(123, 42)

            # VALIDATE: force flag was set
            assert mock_qc.force is True, "force should be set to True"

            # VALIDATE: Result is correct
            assert result["chart_id"] == 123


@patch("superset.commands.chart.warm_up_cache.ChartDataCommand")
def test_no_filters_applied_without_dashboard_id(mock_chart_data_command):
    """Verify no filters are added when dashboard_id is not provided"""
    chart = Slice(
        id=124,
        slice_name="Test Chart",
        viz_type="big_number",
        datasource_id=1,
        datasource_type="table",
    )

    # Query starts with one existing filter
    mock_query = Mock()
    mock_query.filter = [{"col": "existing", "op": "==", "val": "filter"}]
    mock_qc = Mock()
    mock_qc.queries = [mock_query]

    with patch.object(chart, "get_query_context", return_value=mock_qc):
        with patch(
            "superset.commands.chart.warm_up_cache.get_form_data",
            return_value=[{"viz_type": "big_number"}],
        ):
            mock_chart_data_command.return_value.run.return_value = {
                "queries": [{"error": None, "status": "success"}]
            }

            # Execute WITHOUT dashboard_id
            ChartWarmUpCacheCommand(chart, None, None).run()

            # VALIDATE: Filter list unchanged (no dashboard filters added)
            assert len(mock_query.filter) == 1, "Filter count should remain the same"
            assert mock_query.filter == [
                {"col": "existing", "op": "==", "val": "filter"}
            ], "Existing filters should be unchanged"


@patch("superset.commands.chart.warm_up_cache.get_dashboard_extra_filters")
@patch("superset.commands.chart.warm_up_cache.ChartDataCommand")
def test_extra_filters_parameter_takes_precedence(
    mock_chart_data_command, mock_get_dashboard_filters
):
    """Verify extra_filters parameter is used instead of fetching from dashboard"""
    chart = Slice(
        id=125,
        slice_name="Test Chart",
        viz_type="pie",
        datasource_id=1,
        datasource_type="table",
    )

    mock_query = Mock()
    mock_query.filter = []
    mock_qc = Mock()
    mock_qc.queries = [mock_query]

    with patch.object(chart, "get_query_context", return_value=mock_qc):
        with patch(
            "superset.commands.chart.warm_up_cache.get_form_data",
            return_value=[{"viz_type": "pie"}],
        ):
            mock_chart_data_command.return_value.run.return_value = {
                "queries": [{"error": None, "status": "success"}]
            }

            # Execute with extra_filters parameter
            extra_filters_json = '[{"col": "state", "op": "==", "val": "CA"}]'
            ChartWarmUpCacheCommand(chart, 42, extra_filters_json).run()

            # VALIDATE: get_dashboard_extra_filters should NOT be called
            mock_get_dashboard_filters.assert_not_called()

            # VALIDATE: extra_filters were parsed and applied
            assert len(mock_query.filter) == 1
            assert mock_query.filter[0] == {"col": "state", "op": "==", "val": "CA"}


@patch("superset.commands.chart.warm_up_cache.get_dashboard_extra_filters")
@patch("superset.commands.chart.warm_up_cache.ChartDataCommand")
def test_handles_multiple_queries_in_query_context(
    mock_chart_data_command, mock_get_dashboard_filters
):
    """Verify filters are added to ALL queries in the query context"""
    mock_get_dashboard_filters.return_value = [
        {"col": "country", "op": "==", "val": "USA"}
    ]

    chart = Slice(
        id=126,
        slice_name="Test Chart",
        viz_type="heatmap_v2",
        datasource_id=1,
        datasource_type="table",
    )

    # Create query context with MULTIPLE queries
    mock_query1 = Mock()
    mock_query1.filter = []
    mock_query2 = Mock()
    mock_query2.filter = []
    mock_qc = Mock()
    mock_qc.queries = [mock_query1, mock_query2]

    with patch.object(chart, "get_query_context", return_value=mock_qc):
        with patch(
            "superset.commands.chart.warm_up_cache.get_form_data",
            return_value=[{"viz_type": "heatmap_v2"}],
        ):
            mock_chart_data_command.return_value.run.return_value = {
                "queries": [
                    {"error": None, "status": "success"},
                    {"error": None, "status": "success"},
                ]
            }

            ChartWarmUpCacheCommand(chart, 42, None).run()

            # VALIDATE: Filters added to BOTH queries
            assert len(mock_query1.filter) == 1, "Filter should be added to query 1"
            assert len(mock_query2.filter) == 1, "Filter should be added to query 2"
            assert mock_query1.filter[0]["col"] == "country"
            assert mock_query2.filter[0]["col"] == "country"


@patch("superset.commands.chart.warm_up_cache.get_dashboard_extra_filters")
@patch("superset.commands.chart.warm_up_cache.ChartDataCommand")
def test_handles_empty_dashboard_filters(
    mock_chart_data_command, mock_get_dashboard_filters
):
    """Verify graceful handling when dashboard has no filters configured"""
    # get_dashboard_extra_filters returns empty list
    mock_get_dashboard_filters.return_value = []

    chart = Slice(
        id=127,
        slice_name="Test Chart",
        viz_type="echarts_area",
        datasource_id=1,
        datasource_type="table",
    )

    mock_query = Mock()
    mock_query.filter = []
    mock_qc = Mock()
    mock_qc.queries = [mock_query]

    with patch.object(chart, "get_query_context", return_value=mock_qc):
        with patch(
            "superset.commands.chart.warm_up_cache.get_form_data",
            return_value=[{"viz_type": "echarts_area"}],
        ):
            mock_chart_data_command.return_value.run.return_value = {
                "queries": [{"error": None, "status": "success"}]
            }

            ChartWarmUpCacheCommand(chart, 42, None).run()

            # VALIDATE: No filters added (empty list case)
            assert len(mock_query.filter) == 0, (
                "No filters should be added when dashboard has no filters"
            )
            assert mock_get_dashboard_filters.called, (
                "Should still call get_dashboard_extra_filters"
            )


@patch("superset.commands.chart.warm_up_cache.ChartDataCommand")
def test_invalid_json_in_extra_filters_raises_error(mock_chart_data_command):
    """Verify that invalid JSON in extra_filters raises appropriate error"""
    chart = Slice(
        id=128,
        slice_name="Test Chart",
        viz_type="pie",
        datasource_id=1,
        datasource_type="table",
    )

    # Invalid JSON string - missing closing brace
    invalid_json = '{"col": "state", "op": "==", "val": ["CA"]'

    mock_query = Mock()
    mock_query.filter = []
    mock_qc = Mock()
    mock_qc.queries = [mock_query]

    with patch.object(chart, "get_query_context", return_value=mock_qc):
        with patch(
            "superset.commands.chart.warm_up_cache.get_form_data",
            return_value=[{"viz_type": "pie"}],
        ):
            result = ChartWarmUpCacheCommand(chart, 42, invalid_json).run()

            assert result["viz_error"] is not None, "Should return an error"
            assert result["chart_id"] == 128
            # JSONDecodeError messages vary across Python versions
            error_str = str(result["viz_error"]).lower()
            assert (
                "json" in error_str
                or "decode" in error_str
                or "expecting" in error_str
                or "delimiter" in error_str
            ), f"Error should be a JSON decode issue: {result['viz_error']}"


@patch("superset.commands.chart.warm_up_cache.ChartDataCommand")
def test_none_query_context_raises_chart_invalid_error(mock_chart_data_command):
    """Verify that None query context raises ChartInvalidError for non-legacy charts"""
    chart = Slice(
        id=129,
        slice_name="Test Chart",
        viz_type="echarts_timeseries",
        datasource_id=1,
        datasource_type="table",
    )

    # Mock get_query_context to return None (chart has no query_context)
    with patch.object(chart, "get_query_context", return_value=None):
        with patch(
            "superset.commands.chart.warm_up_cache.get_form_data",
            return_value=[{"viz_type": "echarts_timeseries"}],
        ):
            result = ChartWarmUpCacheCommand(chart, None, None).run()

            assert result["viz_error"] is not None, "Should return an error"
            assert result["chart_id"] == 129
            error_str = str(result["viz_error"]).lower()
            assert "query context" in error_str, (
                f"Error should mention query context: {result['viz_error']}"
            )
            assert "not exist" in error_str, (
                f"Error should mention not exist: {result['viz_error']}"
            )


@patch("superset.commands.chart.warm_up_cache.viz_types", ["table"])
def test_legacy_chart_without_datasource_raises_error():
    """Verify that legacy chart without datasource raises ChartInvalidError"""
    chart = Slice(
        id=130,
        slice_name="Legacy Chart",
        viz_type="table",
        datasource_id=None,
        datasource_type=None,
    )

    with patch.object(
        type(chart), "datasource", new_callable=lambda: property(lambda self: None)
    ):
        with patch(
            "superset.commands.chart.warm_up_cache.get_form_data",
            return_value=[{"viz_type": "table"}],
        ):
            result = ChartWarmUpCacheCommand(chart, None, None).run()

            assert result["viz_error"] is not None, "Should return an error"
            assert result["chart_id"] == 130
            error_str = str(result["viz_error"]).lower()
            assert "datasource" in error_str, (
                f"Error should mention datasource: {result['viz_error']}"
            )
            assert "not exist" in error_str, (
                f"Error should mention not exist: {result['viz_error']}"
            )


@patch("superset.commands.chart.warm_up_cache.get_dashboard_extra_filters")
@patch("superset.commands.chart.warm_up_cache.get_viz")
@patch("superset.commands.chart.warm_up_cache.viz_types", ["table"])
@patch("superset.commands.chart.warm_up_cache.g")
def test_legacy_chart_warm_up_with_dashboard(
    mock_g, mock_get_viz, mock_get_dashboard_filters
):
    """Test successful legacy chart warm-up with dashboard filters"""
    mock_get_dashboard_filters.return_value = [
        {"col": "country", "op": "==", "val": "USA"}
    ]

    chart = Slice(
        id=131,
        slice_name="Legacy Table",
        viz_type="table",
        datasource_id=1,
        datasource_type="table",
    )

    mock_datasource = Mock()
    mock_datasource.type = "table"
    mock_datasource.id = 1

    mock_viz = Mock()
    mock_viz.get_payload.return_value = {"errors": None, "status": "success"}
    mock_get_viz.return_value = mock_viz

    with patch.object(
        type(chart),
        "datasource",
        new_callable=lambda: property(lambda self: mock_datasource),
    ):
        with patch(
            "superset.commands.chart.warm_up_cache.get_form_data",
            return_value=[{"viz_type": "table"}],
        ):
            result = ChartWarmUpCacheCommand(chart, 42, None).run()

            assert result["chart_id"] == 131
            assert result["viz_error"] is None
            assert result["viz_status"] == "success"
            assert hasattr(mock_g, "form_data") is False
            mock_get_dashboard_filters.assert_called_once_with(131, 42)


@patch("superset.commands.chart.warm_up_cache.get_viz")
@patch("superset.commands.chart.warm_up_cache.viz_types", ["table"])
@patch("superset.commands.chart.warm_up_cache.g")
def test_legacy_chart_warm_up_without_dashboard(mock_g, mock_get_viz):
    """Test successful legacy chart warm-up without dashboard"""
    chart = Slice(
        id=134,
        slice_name="Legacy Table",
        viz_type="table",
        datasource_id=1,
        datasource_type="table",
    )

    mock_datasource = Mock()
    mock_datasource.type = "table"
    mock_datasource.id = 1

    mock_viz = Mock()
    mock_viz.get_payload.return_value = {"errors": None, "status": "success"}
    mock_get_viz.return_value = mock_viz

    with patch.object(
        type(chart),
        "datasource",
        new_callable=lambda: property(lambda self: mock_datasource),
    ):
        with patch(
            "superset.commands.chart.warm_up_cache.get_form_data",
            return_value=[{"viz_type": "table"}],
        ):
            result = ChartWarmUpCacheCommand(chart, None, None).run()

            assert result["chart_id"] == 134
            assert result["viz_error"] is None
            assert result["viz_status"] == "success"


@patch("superset.commands.chart.warm_up_cache.ChartDataCommand")
def test_non_legacy_chart_returns_first_error(mock_chart_data_command):
    """Test that first query error is returned when multiple queries exist"""
    chart = Slice(
        id=132,
        slice_name="Chart with Error",
        viz_type="echarts_timeseries",
        datasource_id=1,
        datasource_type="table",
    )

    mock_query = Mock()
    mock_query.filter = []
    mock_qc = Mock()
    mock_qc.queries = [mock_query]

    with patch.object(chart, "get_query_context", return_value=mock_qc):
        with patch(
            "superset.commands.chart.warm_up_cache.get_form_data",
            return_value=[{"viz_type": "echarts_timeseries"}],
        ):
            mock_chart_data_command.return_value.run.return_value = {
                "queries": [
                    {"error": "Database connection failed", "status": "failed"},
                    {"error": None, "status": "success"},
                ]
            }

            result = ChartWarmUpCacheCommand(chart, None, None).run()

            assert result["chart_id"] == 132
            assert result["viz_error"] == "Database connection failed"
            assert result["viz_status"] == "failed"


@patch("superset.commands.chart.warm_up_cache.db")
def test_validate_with_integer_chart_id(mock_db):
    """Test validation when passing integer chart ID instead of Slice object"""
    chart = Slice(id=133, slice_name="Test Chart")
    mock_db.session.query.return_value.filter_by.return_value.scalar.return_value = (
        chart
    )

    command = ChartWarmUpCacheCommand(133, None, None)
    command.validate()

    assert command._chart_or_id == chart
    mock_db.session.query.assert_called_once()


@patch("superset.commands.chart.warm_up_cache.db")
def test_validate_with_nonexistent_chart_id(mock_db):
    """Test validation raises error when chart ID does not exist"""
    from superset.commands.chart.exceptions import WarmUpCacheChartNotFoundError

    mock_db.session.query.return_value.filter_by.return_value.scalar.return_value = None

    command = ChartWarmUpCacheCommand(99999, None, None)

    with pytest.raises(WarmUpCacheChartNotFoundError):
        command.validate()
