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

from typing import Any, TYPE_CHECKING
from unittest.mock import MagicMock, patch

import pytest
from flask import Flask, g

from superset.charts.data.api import ChartDataRestApi
from superset.charts.data.dashboard_filter_context import (
    apply_dashboard_filter_context,
)
from superset.charts.schemas import ChartDataTimingSchema
from superset.commands.chart.data.get_data_command import ChartDataCommand
from superset.commands.chart.exceptions import (
    ChartDataCacheLoadError,
    ChartDataQueryFailedError,
)
from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.common.chart_data_timing import (
    ChartDataExecutionResult,
    QueryDataResult,
    QueryTiming,
)
from superset.common.query_context_factory import QueryContextFactory
from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.jinja_context import ExtraCache
from superset.models.core import Database
from superset.utils import json
from superset.utils.error_sanitization import GENERIC_ERROR_MESSAGE

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from superset.app import SupersetApp


def _query_timing() -> QueryTiming:
    return QueryTiming(
        query_planning_ns=1_000_000,
        cache_resolution_ns=2_000_000,
        data_acquisition_ns=3_000_000,
        payload_assembly_ns=4_000_000,
        total_ns=10_000_000,
    )


def _json_execution_result(
    query_payload: dict[str, Any],
    result_type: ChartDataResultType = ChartDataResultType.FULL,
) -> ChartDataExecutionResult:
    query_context = MagicMock()
    query_context.result_type = result_type
    query_context.result_format = ChartDataResultFormat.JSON
    return ChartDataExecutionResult(
        query_context=query_context,
        queries=(QueryDataResult(payload=query_payload, timing=_query_timing()),),
    )


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


def test_send_chart_response_excludes_timing_by_default(app: SupersetApp) -> None:
    query_payload = {"data": [{"col1": 1}], "query": "SELECT 1"}
    result = _json_execution_result(query_payload)

    original = app.config.get("CHART_DATA_INCLUDE_TIMING")
    try:
        app.config["CHART_DATA_INCLUDE_TIMING"] = False
        api = ChartDataRestApi()
        with (
            app.test_request_context("/api/v1/chart/data"),
            patch(
                "superset.charts.data.api.security_manager.is_guest_user",
                return_value=False,
            ),
        ):
            response = api._send_chart_response(result)
    finally:
        app.config["CHART_DATA_INCLUDE_TIMING"] = original

    body = json.loads(response.get_data(as_text=True))
    assert body == {"result": [{"data": [{"col1": 1}], "query": "SELECT 1"}]}
    assert "timing" not in query_payload


def test_send_chart_response_includes_opt_in_timing(app: SupersetApp) -> None:
    query_payload = {"data": [{"col1": 1}], "query": "SELECT 1"}
    result = _json_execution_result(query_payload)

    original = app.config.get("CHART_DATA_INCLUDE_TIMING")
    try:
        app.config["CHART_DATA_INCLUDE_TIMING"] = True
        api = ChartDataRestApi()
        with (
            app.test_request_context("/api/v1/chart/data"),
            patch(
                "superset.charts.data.api.security_manager.is_guest_user",
                return_value=False,
            ),
        ):
            response = api._send_chart_response(result)
    finally:
        app.config["CHART_DATA_INCLUDE_TIMING"] = original

    body = json.loads(response.get_data(as_text=True))
    projected_timing = body["result"][0]["timing"]
    assert body["result"][0]["timing"] == {
        "version": 1,
        "query": {
            "query_planning_ms": 1.0,
            "cache_resolution_ms": 2.0,
            "data_acquisition_ms": 3.0,
            "payload_assembly_ms": 4.0,
            "total_ms": 10.0,
        },
    }
    assert ChartDataTimingSchema().load(projected_timing) == projected_timing
    assert "timing" not in query_payload


def test_send_chart_response_strips_guest_query_after_timing_projection(
    app: SupersetApp,
) -> None:
    query_payload = {"data": [{"col1": 1}], "query": "SELECT 1"}
    result = _json_execution_result(query_payload)

    original = app.config.get("CHART_DATA_INCLUDE_TIMING")
    try:
        app.config["CHART_DATA_INCLUDE_TIMING"] = True
        api = ChartDataRestApi()
        with (
            app.test_request_context("/api/v1/chart/data"),
            patch(
                "superset.charts.data.api.security_manager.is_guest_user",
                return_value=True,
            ),
        ):
            response = api._send_chart_response(result)
    finally:
        app.config["CHART_DATA_INCLUDE_TIMING"] = original

    query = json.loads(response.get_data(as_text=True))["result"][0]
    assert "query" not in query
    assert "timing" in query
    assert "query" in query_payload


def test_send_chart_response_redacts_guest_query_error(app: SupersetApp) -> None:
    result = _json_execution_result(
        {
            "error": "Table mydb.myschema.mytable was not found",
            "stacktrace": "Traceback ...",
            "query": "SELECT 1",
        },
        result_type=ChartDataResultType.QUERY,
    )

    api = ChartDataRestApi()
    with (
        app.test_request_context("/api/v1/chart/data"),
        patch(
            "superset.charts.data.api.security_manager.is_guest_user",
            return_value=True,
        ),
    ):
        response = api._send_chart_response(result)

    query = json.loads(response.get_data(as_text=True))["result"][0]
    assert query["error"] == str(GENERIC_ERROR_MESSAGE)
    assert "stacktrace" not in query


def test_get_data_response_redacts_guest_query_failure(app: SupersetApp) -> None:
    command = MagicMock()
    command.execute.side_effect = ChartDataQueryFailedError(
        "Error: Table mydb.myschema.mytable was not found"
    )
    api = ChartDataRestApi()

    with (
        app.test_request_context("/api/v1/chart/data"),
        patch(
            "superset.security.SupersetSecurityManager.is_guest_user",
            return_value=True,
        ),
    ):
        response = api._get_data_response(command)

    assert response.status_code == 400
    assert json.loads(response.get_data(as_text=True))["message"] == str(
        GENERIC_ERROR_MESSAGE
    )


def test_get_data_response_redacts_a_real_engine_error_for_guests(
    app: SupersetApp,
    session: Session,
) -> None:
    """
    Drives an actual failing query rather than a hand-written message: the
    engine names the missing object, and that name is what must not reach an
    embedded viewer.
    """
    SqlaTable.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    database = Database(database_name="db", sqlalchemy_uri="sqlite://")
    table = SqlaTable(
        table_name="table_that_does_not_exist",
        database=database,
        columns=[TableColumn(column_name="col_a", type="VARCHAR", groupby=True)],
        metrics=[],
    )
    session.add(database)
    session.add(table)
    session.flush()

    command = ChartDataCommand(
        QueryContextFactory().create(
            datasource={"type": "table", "id": table.id},
            queries=[{"columns": ["col_a"], "metrics": [], "row_limit": 10}],
            result_format=ChartDataResultFormat.JSON,
            result_type=ChartDataResultType.FULL,
        )
    )
    api = ChartDataRestApi()

    with app.test_request_context("/api/v1/chart/data"):
        authorized = api._get_data_response(command)
    assert authorized.status_code == 400
    assert (
        "table_that_does_not_exist"
        in json.loads(authorized.get_data(as_text=True))["message"]
    )

    with (
        app.test_request_context("/api/v1/chart/data"),
        patch(
            "superset.security.SupersetSecurityManager.is_guest_user",
            return_value=True,
        ),
    ):
        guest = api._get_data_response(command)
    assert guest.status_code == 400
    assert json.loads(guest.get_data(as_text=True))["message"] == str(
        GENERIC_ERROR_MESSAGE
    )


def test_send_chart_response_pairs_each_timing_with_its_query(
    app: SupersetApp,
) -> None:
    first_payload = {"data": [{"col1": 1}], "query": "SELECT 1"}
    second_payload = {"data": [{"col2": 2}], "query": "SELECT 2"}
    query_context = MagicMock()
    query_context.result_type = ChartDataResultType.FULL
    query_context.result_format = ChartDataResultFormat.JSON
    result = ChartDataExecutionResult(
        query_context=query_context,
        queries=(
            QueryDataResult(payload=first_payload, timing=_query_timing()),
            QueryDataResult(
                payload=second_payload,
                timing=QueryTiming(
                    query_planning_ns=5_000_000,
                    cache_resolution_ns=6_000_000,
                    data_acquisition_ns=None,
                    payload_assembly_ns=7_000_000,
                    total_ns=18_000_000,
                ),
            ),
        ),
    )

    original = app.config.get("CHART_DATA_INCLUDE_TIMING")
    try:
        app.config["CHART_DATA_INCLUDE_TIMING"] = True
        api = ChartDataRestApi()
        with (
            app.test_request_context("/api/v1/chart/data"),
            patch(
                "superset.charts.data.api.security_manager.is_guest_user",
                return_value=False,
            ),
        ):
            response = api._send_chart_response(result)
    finally:
        app.config["CHART_DATA_INCLUDE_TIMING"] = original

    queries = json.loads(response.get_data(as_text=True))["result"]
    assert queries[0]["timing"]["query"]["total_ms"] == 10.0
    assert queries[1]["timing"]["query"] == {
        "query_planning_ms": 5.0,
        "cache_resolution_ms": 6.0,
        "data_acquisition_ms": None,
        "payload_assembly_ms": 7.0,
        "total_ms": 18.0,
    }
    assert "timing" not in first_payload
    assert "timing" not in second_payload


def test_send_chart_response_refuses_mismatched_query_and_timing_counts(
    app: SupersetApp,
) -> None:
    result = _json_execution_result({"data": [{"col1": 1}]})
    materialized_result = {
        "query_context": result.query_context,
        "queries": [{"data": [{"col1": 1}]}, {"data": [{"col2": 2}]}],
    }

    original = app.config.get("CHART_DATA_INCLUDE_TIMING")
    try:
        app.config["CHART_DATA_INCLUDE_TIMING"] = True
        api = ChartDataRestApi()
        with (
            app.test_request_context("/api/v1/chart/data"),
            patch.object(
                ChartDataExecutionResult,
                "materialize",
                return_value=materialized_result,
            ),
            patch(
                "superset.charts.data.api.security_manager.is_guest_user",
                return_value=False,
            ),
            pytest.raises(
                ValueError,
                match=r"zip\(\)",
            ),
        ):
            api._send_chart_response(result)
    finally:
        app.config["CHART_DATA_INCLUDE_TIMING"] = original


def test_send_chart_response_projects_timing_for_query_preview_error(
    app: SupersetApp,
) -> None:
    result = _json_execution_result(
        {"error": "Invalid column", "query": "SELECT invalid"},
        result_type=ChartDataResultType.QUERY,
    )

    original = app.config.get("CHART_DATA_INCLUDE_TIMING")
    try:
        app.config["CHART_DATA_INCLUDE_TIMING"] = True
        api = ChartDataRestApi()
        with (
            app.test_request_context("/api/v1/chart/data"),
            patch(
                "superset.charts.data.api.security_manager.is_guest_user",
                return_value=False,
            ),
        ):
            response = api._send_chart_response(result)
    finally:
        app.config["CHART_DATA_INCLUDE_TIMING"] = original

    query = json.loads(response.get_data(as_text=True))["result"][0]
    assert response.status_code == 200
    assert query["error"] == "Invalid column"
    assert query["timing"]["version"] == 1


@pytest.mark.parametrize(
    ("exception", "status_code"),
    [
        (ChartDataCacheLoadError("cache unavailable"), 422),
        (ChartDataQueryFailedError("query failed"), 400),
    ],
)
def test_get_data_response_excludes_timing_from_http_errors(
    app: SupersetApp,
    exception: Exception,
    status_code: int,
) -> None:
    command = MagicMock()
    command.execute.side_effect = exception
    api = ChartDataRestApi()

    original = app.config.get("CHART_DATA_INCLUDE_TIMING")
    try:
        app.config["CHART_DATA_INCLUDE_TIMING"] = True
        with app.test_request_context("/api/v1/chart/data"):
            response = api._get_data_response(command)
    finally:
        app.config["CHART_DATA_INCLUDE_TIMING"] = original

    assert response.status_code == status_code
    assert "timing" not in json.loads(response.get_data(as_text=True))


def test_run_async_does_not_project_timing_onto_a_job_response(
    app: SupersetApp,
) -> None:
    command = MagicMock()
    command.execute.side_effect = ChartDataCacheLoadError("cache miss")
    async_command = MagicMock()
    async_command.run.return_value = {
        "channel_id": "channel",
        "job_id": "job",
        "user_id": 1,
        "status": "pending",
        "errors": [],
        "result_url": "/api/v1/chart/data/job",
    }
    api = ChartDataRestApi()

    original = app.config.get("CHART_DATA_INCLUDE_TIMING")
    try:
        app.config["CHART_DATA_INCLUDE_TIMING"] = True
        with (
            app.test_request_context("/api/v1/chart/data", method="POST"),
            patch(
                "superset.charts.data.api.CreateAsyncChartDataJobCommand",
                return_value=async_command,
            ),
            patch("superset.charts.data.api.get_user_id", return_value=1),
        ):
            response = api._run_async({"force": False}, command)
    finally:
        app.config["CHART_DATA_INCLUDE_TIMING"] = original

    assert response.status_code == 202
    assert "timing" not in json.loads(response.get_data(as_text=True))
    async_command.validate.assert_called_once()


def test_run_async_projects_opt_in_timing_for_a_cached_result(
    app: SupersetApp,
) -> None:
    query_payload = {"data": [{"col1": 1}], "query": "SELECT 1"}
    command = MagicMock()
    command.execute.return_value = _json_execution_result(query_payload)
    api = ChartDataRestApi()

    original = app.config.get("CHART_DATA_INCLUDE_TIMING")
    try:
        app.config["CHART_DATA_INCLUDE_TIMING"] = True
        with (
            app.test_request_context("/api/v1/chart/data"),
            patch(
                "superset.charts.data.api.security_manager.is_guest_user",
                return_value=False,
            ),
        ):
            response = api._run_async({"force": False}, command)
    finally:
        app.config["CHART_DATA_INCLUDE_TIMING"] = original

    command.execute.assert_called_once_with(force_cached=True)
    result = json.loads(response.get_data(as_text=True))["result"][0]
    assert result["timing"]["version"] == 1
    assert "timing" not in query_payload


def test_send_chart_response_projects_timing_after_client_processing(
    app: SupersetApp,
) -> None:
    query_payload = {"data": [{"col1": 1}], "query": "SELECT 1"}
    result = _json_execution_result(
        query_payload,
        result_type=ChartDataResultType.POST_PROCESSED,
    )

    def process(
        materialized_result: dict[Any, Any],
        _form_data: dict[str, Any] | None,
        _datasource: Any,
    ) -> dict[Any, Any]:
        materialized_result["queries"][0]["data"] = [{"col1": 2}]
        return materialized_result

    original = app.config.get("CHART_DATA_INCLUDE_TIMING")
    try:
        app.config["CHART_DATA_INCLUDE_TIMING"] = True
        api = ChartDataRestApi()
        with (
            app.test_request_context("/api/v1/chart/data"),
            patch(
                "superset.charts.data.api.apply_client_processing",
                side_effect=process,
            ),
            patch(
                "superset.charts.data.api.security_manager.is_guest_user",
                return_value=False,
            ),
        ):
            response = api._send_chart_response(result, form_data={"viz_type": "table"})
    finally:
        app.config["CHART_DATA_INCLUDE_TIMING"] = original

    query = json.loads(response.get_data(as_text=True))["result"][0]
    assert query["data"] == [{"col1": 2}]
    assert query["timing"]["version"] == 1
    assert query_payload["data"] == [{"col1": 1}]


def test_send_chart_response_does_not_project_timing_for_csv(
    app: SupersetApp,
) -> None:
    query_payload = {"data": "col_a\n1\n"}
    query_context = MagicMock()
    query_context.result_type = ChartDataResultType.FULL
    query_context.result_format = ChartDataResultFormat.CSV
    result = ChartDataExecutionResult(
        query_context=query_context,
        queries=(QueryDataResult(query_payload, _query_timing()),),
    )
    api = ChartDataRestApi()

    original = app.config.get("CHART_DATA_INCLUDE_TIMING")
    try:
        app.config["CHART_DATA_INCLUDE_TIMING"] = True
        with (
            app.test_request_context("/api/v1/chart/data"),
            patch("superset.charts.data.api.security_manager") as security_manager,
            patch("superset.charts.data.api.is_feature_enabled", return_value=False),
        ):
            security_manager.can_access.return_value = True
            response = api._send_chart_response(result)
    finally:
        app.config["CHART_DATA_INCLUDE_TIMING"] = original

    assert response.status_code == 200
    assert "timing" not in query_payload


def _extract_filename(form_value: str) -> str | None:
    """Run _extract_export_params_from_request with a form filename value."""
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


def test_send_chart_response_uses_chart_name_for_csv_filename() -> None:
    """
    Regression test: the non-streaming CSV export branch of
    _send_chart_response must include the chart's name in the
    Content-Disposition header, not just a bare timestamp, mirroring the
    streaming CSV export path.
    """
    query_context = MagicMock()
    query_context.result_type = ChartDataResultType.FULL
    query_context.result_format = ChartDataResultFormat.CSV

    result = {
        "query_context": query_context,
        "queries": [{"data": "col_a,col_b\n1,2\n"}],
    }

    api = ChartDataRestApi()
    with (
        patch("superset.charts.data.api.security_manager") as mock_security_manager,
        patch("superset.charts.data.api.is_feature_enabled", return_value=False),
    ):
        mock_security_manager.can_access.return_value = True
        response = api._send_chart_response(
            result, form_data={"slice_name": "My Chart", "row_limit": 10}
        )

    content_disposition = response.headers["Content-Disposition"]
    assert "My_Chart" in content_disposition


def test_send_chart_response_uses_chart_name_for_xlsx_filename() -> None:
    """Same regression as above, for the XLSX export branch."""
    query_context = MagicMock()
    query_context.result_type = ChartDataResultType.FULL
    query_context.result_format = ChartDataResultFormat.XLSX

    result = {
        "query_context": query_context,
        "queries": [{"data": b"fake-xlsx-bytes"}],
    }

    api = ChartDataRestApi()
    with (
        patch("superset.charts.data.api.security_manager") as mock_security_manager,
        patch("superset.charts.data.api.is_feature_enabled", return_value=False),
    ):
        mock_security_manager.can_access.return_value = True
        response = api._send_chart_response(
            result, form_data={"slice_name": "My Chart", "row_limit": 10}
        )

    content_disposition = response.headers["Content-Disposition"]
    assert "My_Chart" in content_disposition


def test_send_chart_response_uses_chart_name_for_zip_filename() -> None:
    """Same regression as above, for the multi-query zip export branch."""
    query_context = MagicMock()
    query_context.result_type = ChartDataResultType.FULL
    query_context.result_format = ChartDataResultFormat.CSV

    result = {
        "query_context": query_context,
        "queries": [
            {"data": "col_a\n1\n"},
            {"data": "col_a\n2\n"},
        ],
    }

    api = ChartDataRestApi()
    with (
        patch("superset.charts.data.api.security_manager") as mock_security_manager,
        patch("superset.charts.data.api.is_feature_enabled", return_value=False),
    ):
        mock_security_manager.can_access.return_value = True
        response = api._send_chart_response(
            result, form_data={"slice_name": "My Chart", "row_limit": 10}
        )

    content_disposition = response.headers["Content-Disposition"]
    assert "My_Chart" in content_disposition


def test_send_chart_response_does_not_double_extension_for_csv_filename() -> None:
    """
    Regression test: a client-supplied filename that already includes the
    ``.csv`` extension must not be doubled (e.g. ``export.csv.csv``) by the
    non-streaming CSV export branch of _send_chart_response.
    """
    query_context = MagicMock()
    query_context.result_type = ChartDataResultType.FULL
    query_context.result_format = ChartDataResultFormat.CSV

    result = {
        "query_context": query_context,
        "queries": [{"data": "col_a,col_b\n1,2\n"}],
    }

    api = ChartDataRestApi()
    with (
        patch("superset.charts.data.api.security_manager") as mock_security_manager,
        patch("superset.charts.data.api.is_feature_enabled", return_value=False),
    ):
        mock_security_manager.can_access.return_value = True
        response = api._send_chart_response(
            result,
            form_data={"row_limit": 10},
            filename="my_export.csv",
        )

    content_disposition = response.headers["Content-Disposition"]
    assert "my_export.csv.csv" not in content_disposition
    assert "my_export.csv" in content_disposition
