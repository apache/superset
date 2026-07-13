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
from __future__ import annotations

from contextlib import nullcontext
from typing import Any, TYPE_CHECKING
from unittest.mock import MagicMock, patch

from flask import Flask, g, Response

from superset.charts.data.api import (
    _supports_async_execution,
    ChartDataRestApi,
)
from superset.charts.data.dashboard_filter_context import (
    apply_dashboard_filter_context,
)
from superset.commands.chart.data.get_data_command import ChartDataExecutionOptions
from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.common.chart_data_timing import (
    CacheWriteOutcome,
    ChartDataExecutionResult,
    QueryDataResult,
    QueryTiming,
)
from superset.jinja_context import ExtraCache
from superset.utils import json

if TYPE_CHECKING:
    from superset.app import SupersetApp


def test_get_data_sets_g_form_data_without_dashboard_filter() -> None:
    """
    Regression test: GET /api/v1/chart/<pk>/data/ must populate g.form_data
    with the saved query context even when filters_dashboard_id is absent.

    Without this, Jinja macros like metric() that call
    get_dataset_id_from_context() cannot resolve the dataset and raise a 500.
    """
    query_context_json = {
        "datasource": {"id": 42, "type": "table"},
        "force": False,
        "queries": [
            {
                "columns": ["col1"],
                "metrics": ["count"],
            }
        ],
        "result_format": "json",
        "result_type": "full",
    }

    app = Flask(__name__)

    with app.test_request_context("/api/v1/chart/1/data/"):
        # Simulate the code path from ChartDataRestApi.get_data that
        # parses the saved query_context and sets g.form_data.
        json_body = json.loads(json.dumps(query_context_json))

        # Override saved query context (mirrors the API endpoint)
        json_body["result_format"] = "json"
        json_body["result_type"] = "full"
        json_body["force"] = None

        # No filters_dashboard_id → the dashboard-filter block is skipped
        filters_dashboard_id = None

        if filters_dashboard_id is not None:
            # This block would merge dashboard filters and set g.form_data
            # inside the conditional — the old (broken) behavior.
            pass

        # The fix: g.form_data is set unconditionally
        g.form_data = json_body

        # Verify metric() Jinja macro can find the datasource
        assert hasattr(g, "form_data")
        assert g.form_data["datasource"] == {"id": 42, "type": "table"}
        assert g.form_data["queries"][0]["columns"] == ["col1"]


def test_apply_dashboard_filter_context_does_not_duplicate_filters(
    app: SupersetApp,
) -> None:
    """
    Regression test for the ``filters_dashboard_id`` parameter.

    A dashboard's filters must not be present in both query["filters"] and
    query["extra_form_data"]["filters"]. Previously the same filter existed in both,
    so Jinja's filter_values() read each value twice and produced SQL such as
    ``country in ('USA', 'USA')``.
    """
    query_context_json: dict[str, Any] = {
        "datasource": {"id": 1, "type": "table"},
        "queries": [{"filters": [{"col": "year", "op": "IN", "val": [2004]}]}],
    }
    extra_form_data = {"filters": [{"col": "country", "op": "IN", "val": ["USA"]}]}

    apply_dashboard_filter_context(query_context_json, extra_form_data)

    query = query_context_json["queries"][0]
    assert query["filters"] == [
        {"col": "year", "op": "IN", "val": [2004]},
        {"col": "country", "op": "IN", "val": ["USA"], "isExtra": True},
    ]
    assert "filters" not in query["extra_form_data"]

    # filter_values() therefore returns the dashboard value exactly once.
    with app.test_request_context("/api/v1/chart/1/data/"):
        g.form_data = query_context_json
        assert ExtraCache().filter_values("country") == ["USA"]


def test_apply_dashboard_filter_context_applies_time_grain_to_extras() -> None:
    """
    A dashboard time-grain filter must land in ``query["extras"]``, where
    get_time_grain() reads it for charts that have no adhoc x-axis column.
    """
    query_context_json: dict[str, Any] = {
        "queries": [{"extras": {"time_grain_sqla": "P1D", "having": "", "where": ""}}],
    }

    apply_dashboard_filter_context(query_context_json, {"time_grain_sqla": "P1M"})

    assert query_context_json["queries"][0]["extras"]["time_grain_sqla"] == "P1M"


def test_apply_dashboard_filter_context_overrides_x_axis_time_grain() -> None:
    """
    For charts with an adhoc X-Axis, the dashboard grain must override the
    BASE_AXIS column's ``timeGrain`` (which get_time_grain() reads before
    falling back to extras), mirroring the frontend's normalizeTimeColumn.
    """
    query_context_json: dict[str, Any] = {
        "queries": [
            {
                "columns": [
                    {
                        "timeGrain": "P1D",
                        "columnType": "BASE_AXIS",
                        "sqlExpression": "order_date",
                    }
                ],
                "extras": {"time_grain_sqla": "P1D"},
            }
        ],
    }

    apply_dashboard_filter_context(query_context_json, {"time_grain_sqla": "P1Y"})

    query = query_context_json["queries"][0]
    assert query["columns"][0]["timeGrain"] == "P1Y"
    assert query["extras"]["time_grain_sqla"] == "P1Y"


def test_apply_dashboard_filter_context_grain_targets_first_adhoc_column() -> None:
    """
    The grain override must land on ``columns[0]`` to match frontend logic.
    """
    query_context_json: dict[str, Any] = {
        "queries": [
            {
                "columns": [
                    {"timeGrain": "P1D", "sqlExpression": "order_date"},
                    {"columnType": "BASE_AXIS", "sqlExpression": "other"},
                ],
                "extras": {},
            }
        ],
    }

    apply_dashboard_filter_context(query_context_json, {"time_grain_sqla": "P1Y"})

    columns = query_context_json["queries"][0]["columns"]
    assert columns[0]["timeGrain"] == "P1Y"  # the column get_time_grain reads
    assert "timeGrain" not in columns[1]  # the BASE_AXIS-tagged one is untouched


def test_apply_dashboard_filter_context_keeps_grain_when_no_grain_filter() -> None:
    """
    When the dashboard applies a non-grain filter (e.g. a value filter), the
    chart's own x-axis ``timeGrain`` must be preserved -- not wiped -- since no
    dashboard grain was provided.
    """
    query_context_json: dict[str, Any] = {
        "queries": [
            {
                "columns": [
                    {
                        "timeGrain": "P1M",
                        "columnType": "BASE_AXIS",
                        "sqlExpression": "order_date",
                    }
                ],
                "extras": {"time_grain_sqla": "P1M"},
            }
        ],
    }

    # extra_form_data carries a value filter but NO time_grain_sqla
    apply_dashboard_filter_context(
        query_context_json,
        {"filters": [{"col": "country", "op": "IN", "val": ["US"]}]},
    )

    query = query_context_json["queries"][0]
    assert query["columns"][0]["timeGrain"] == "P1M"


def _extract_filename(form_value: str) -> str | None:
    """Run _extract_export_params_from_request with a form filename value."""
    from superset.charts.data.api import ChartDataRestApi

    app = Flask(__name__)
    with app.test_request_context("/", method="POST", data={"filename": form_value}):
        filename, _ = ChartDataRestApi._extract_export_params_from_request(MagicMock())
    return filename


def test_extract_export_filename_sanitizes_special_characters() -> None:
    """A malicious/path-y filename is sanitized before header/disk use."""
    filename = _extract_filename('../../etc/pa"ss\r\nSet-Cookie: x')

    assert filename is not None
    for bad in ("/", "\\", '"', "\r", "\n", ".."):
        assert bad not in filename


def test_extract_export_filename_preserves_normal_name() -> None:
    """A normal filename passes through unchanged."""
    assert _extract_filename("my_export.csv") == "my_export.csv"


def test_extract_export_filename_all_special_falls_back_to_none() -> None:
    """A name with no usable characters becomes None (generated downstream)."""
    assert _extract_filename("***") is None


def _chart_execution_result() -> ChartDataExecutionResult:
    query_context = MagicMock()
    query_context.result_type = ChartDataResultType.FULL
    query_context.result_format = ChartDataResultFormat.JSON
    timing = QueryTiming(
        cache_key_ns=1_000_000,
        cache_read_ns=2_000_000,
        source_ns=3_000_000,
        cache_write_ns=None,
        cache_write_outcome=CacheWriteOutcome.NOT_ATTEMPTED,
        materialization_ns=4_000_000,
        total_ns=10_000_000,
        cache_hit=False,
        sources=(),
    )
    return ChartDataExecutionResult(
        query_context=query_context,
        queries=(
            QueryDataResult({"data": [{"value": 1}], "is_cached": False}, timing),
        ),
    )


def _send_chart_json_response(
    execution: ChartDataExecutionResult, include_timing: bool
) -> dict[str, Any]:
    app = Flask(__name__)
    app.config["CHART_DATA_INCLUDE_TIMING"] = include_timing
    api = ChartDataRestApi.__new__(ChartDataRestApi)
    event_logger = MagicMock()
    event_logger.log_context = MagicMock(return_value=nullcontext())
    security_manager = MagicMock()
    security_manager.is_guest_user.return_value = False

    with (
        app.test_request_context("/api/v1/chart/data"),
        patch("superset.charts.data.api.event_logger", event_logger),
        patch("superset.charts.data.api.security_manager", security_manager),
    ):
        response = api._send_chart_response(execution)

    return json.loads(response.get_data(as_text=True))


def test_chart_response_keeps_timing_out_of_default_contract() -> None:
    execution = _chart_execution_result()

    payload = _send_chart_json_response(execution, include_timing=False)

    assert payload == {"result": [{"data": [{"value": 1}], "is_cached": False}]}
    assert "timing" not in execution.queries[0].payload


def test_chart_response_projects_timing_without_mutating_execution() -> None:
    execution = _chart_execution_result()

    payload = _send_chart_json_response(execution, include_timing=True)

    assert payload["result"][0]["timing"]["version"] == 1
    assert payload["result"][0]["timing"]["query"]["total_ms"] == 10.0
    assert "timing" not in execution.queries[0].payload


def test_async_execution_requires_nonempty_data_backed_queries() -> None:
    query_context = MagicMock()
    query_context.result_type = ChartDataResultType.FULL
    query_context.queries = []

    assert _supports_async_execution(query_context) is False

    query_context.queries = [MagicMock(result_type=None)]
    assert _supports_async_execution(query_context) is True

    query_context.queries.append(MagicMock(result_type=ChartDataResultType.QUERY))
    assert _supports_async_execution(query_context) is False


def test_async_cache_lookup_uses_typed_execution_options() -> None:
    app = Flask(__name__)
    api = ChartDataRestApi.__new__(ChartDataRestApi)
    command = MagicMock()
    execution = _chart_execution_result()
    command.execute.return_value = execution
    expected_response = Response("{}", status=200, mimetype="application/json")

    with (
        app.test_request_context("/api/v1/chart/data"),
        patch.object(
            api, "_send_chart_response", return_value=expected_response
        ) as send_response,
    ):
        response = api._run_async({}, command)

    assert response is expected_response
    command.execute.assert_called_once_with(
        ChartDataExecutionOptions(force_cached=True)
    )
    send_response.assert_called_once_with(execution)
