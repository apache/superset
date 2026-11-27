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

from collections.abc import Callable
from functools import partial
from typing import Any

import pandas as pd
import pytest
from pytest_mock import MockerFixture

from superset.charts.client_processing import apply_client_processing
from superset.commands.report.execute import BaseReportState
from superset.common.chart_data import ChartDataResultFormat
from superset.utils import excel, json
from tests.unit_tests.commands.report.execute_test import create_report_schedule


@pytest.mark.parametrize(
    "result_format", [ChartDataResultFormat.CSV, ChartDataResultFormat.XLSX]
)
@pytest.mark.parametrize("datasource_type", ["semantic_view", "table"])
@pytest.mark.parametrize(
    "viz_type",
    [
        "pivot_table_v2",
        "table",
        "ag-grid-table",
        "echarts_timeseries_line",
        "mixed_timeseries",
    ],
)
def test_legacy_supported_report_preserves_raw_export(
    mocker: MockerFixture,
    result_format: ChartDataResultFormat,
    datasource_type: str,
    viz_type: str,
) -> None:
    """Missing saved form data must not activate an incomplete export processor."""
    state: BaseReportState = BaseReportState(
        create_report_schedule(mocker), "January 1, 2021", "test-execution"
    )
    state._report_schedule.chart.datasource_type = datasource_type
    state._report_schedule.chart.viz_type = viz_type
    state._report_schedule.chart.query_context = json.dumps({"queries": [{}]})
    payload: dict[str, Any] = state._get_chart_data_request_payload(result_format)
    frame: pd.DataFrame = pd.DataFrame({"region": ["East"], "count": [2]})
    raw: str | bytes = (
        frame.to_csv(index=False)
        if result_format == ChartDataResultFormat.CSV
        else excel.df_to_excel(frame, index=False)
    )
    result: dict[str, Any] = {
        "queries": [{"data": raw, "result_format": result_format}]
    }
    processed: dict[str, Any] = apply_client_processing(
        result, payload.get("form_data")
    )
    assert processed["queries"][0]["data"] == raw
    assert "form_data" not in payload


@pytest.mark.parametrize(
    "result_format", [ChartDataResultFormat.CSV, ChartDataResultFormat.XLSX]
)
@pytest.mark.parametrize("saved_form_data", [None, {"metrics": ["count"]}])
def test_refused_report_chart_still_reaches_validation(
    mocker: MockerFixture,
    result_format: ChartDataResultFormat,
    saved_form_data: dict[str, Any] | None,
) -> None:
    """The report identifies refused charts while retaining existing query settings."""
    from unittest.mock import Mock

    from superset.commands.chart.data.get_data_command import ChartDataCommand
    from superset.common.query_context import QueryContext
    from superset.exceptions import QueryObjectValidationError

    state: BaseReportState = BaseReportState(
        create_report_schedule(mocker), "January 1, 2021", "test-execution"
    )
    state._report_schedule.chart.datasource_type = "semantic_view"
    state._report_schedule.chart.viz_type = "histogram_v2"
    state._report_schedule.chart.query_context = json.dumps(
        {"queries": [{}], "form_data": saved_form_data}
    )
    payload: dict[str, Any] = state._get_chart_data_request_payload(result_format)
    if saved_form_data is not None:
        assert payload["form_data"]["metrics"] == ["count"]
    context: Mock = Mock(spec=QueryContext)
    context.datasource = Mock(type="semantic_view")
    context.form_data = payload["form_data"]
    context.slice_ = None
    error: pytest.ExceptionInfo[QueryObjectValidationError]
    with pytest.raises(QueryObjectValidationError) as error:
        ChartDataCommand(context).validate()
    assert str(error.value) == (
        "Histogram is not yet supported on semantic views. "
        "Use a Bar or Table chart with an explicit count metric."
    )
    context.raise_for_access.assert_called_once_with()


@pytest.mark.parametrize(
    "viz_type",
    [
        "pivot_table_v2",
        "table",
        "ag-grid-table",
        "echarts_timeseries_line",
        "mixed_timeseries",
    ],
)
@pytest.mark.parametrize("datasource_type", ["semantic_view", "table"])
def test_supported_report_retains_saved_processing_settings(
    mocker: MockerFixture, viz_type: str, datasource_type: str
) -> None:
    """Supported reports keep their full saved settings without a type override."""
    state: BaseReportState = BaseReportState(
        create_report_schedule(mocker), "January 1, 2021", "test-execution"
    )
    state._report_schedule.chart.datasource_type = datasource_type
    state._report_schedule.chart.viz_type = viz_type
    settings: dict[str, Any] = {
        "viz_type": viz_type,
        "metrics": ["count"],
        "groupbyRows": ["region"],
    }
    state._report_schedule.chart.query_context = json.dumps(
        {"queries": [{}], "form_data": settings}
    )
    payload: dict[str, Any] = state._get_chart_data_request_payload(
        ChartDataResultFormat.CSV
    )
    assert payload["form_data"] == {
        **settings,
        "result_format": "csv",
        "result_type": "post_processed",
        "force": False,
    }


@pytest.mark.parametrize(
    ("result_format", "error_name"),
    [
        (ChartDataResultFormat.CSV, "ReportScheduleCsvFailedError"),
        (ChartDataResultFormat.XLSX, "ReportScheduleXlsxFailedError"),
        (ChartDataResultFormat.JSON, "ReportScheduleDataFrameFailedError"),
    ],
)
def test_refused_report_chart_fails_with_its_reason_before_requesting(
    mocker: MockerFixture, result_format: ChartDataResultFormat, error_name: str
) -> None:
    """The chart data API redacts 400 bodies, so the refusal is raised locally."""
    from superset.commands.report import exceptions

    state: BaseReportState = BaseReportState(
        create_report_schedule(mocker), "January 1, 2021", "test-execution"
    )
    state._report_schedule.chart.datasource_type = "semantic_view"
    state._report_schedule.chart.viz_type = "rose"
    state._report_schedule.chart.query_context = json.dumps({"queries": [{}]})
    request = mocker.patch("superset.commands.report.execute.request_chart_data")
    post = mocker.patch.object(state, "_post_chart_data")
    fetch: Callable[[], object] = (
        state._get_embedded_data
        if result_format == ChartDataResultFormat.JSON
        else partial(state._get_data, result_format)
    )
    with pytest.raises(getattr(exceptions, error_name), match="Nightingale Rose"):
        fetch()
    request.assert_not_called()
    post.assert_not_called()
