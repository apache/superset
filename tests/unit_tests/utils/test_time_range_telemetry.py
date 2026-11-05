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
"""The log line and counter of each time range rejection."""

from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Any
from unittest.mock import MagicMock

import pytest
from flask import request
from freezegun import freeze_time
from pytest_mock import MockerFixture
from werkzeug.routing import Rule

from superset.extensions import security_manager
from superset.time_range_limits.policy import (
    check_stricter_than_global,
    FEATURE_FLAG,
    Rule as PolicyRule,
    TimeRangeLimitError,
    TimeRangeLimits,
    TimeRangeLimitsUnavailableError,
)
from superset.time_range_limits.telemetry import (
    _path,
    limit_path,
    limit_scope,
    log_global_policy,
)
from superset.utils import json
from tests.fixtures.time_range_enforcement import (
    as_user,
    check,
    make_context,
    make_dashboard,
    make_dataset,
    policy,
    set_limits,
    tr,
    use_dashboards,
    use_datasource,
)
from tests.fixtures.time_range_telemetry import LOGGER
from tests.unit_tests.conftest import with_feature_flags

NOW = "2026-10-21 12:00:00"
FLAG_ON = {FEATURE_FLAG: True}
FORGED = "x=1 path=forged\nnext"
BAD_QUANTITY = {
    **policy(),
    "max_span": {"quantity": "SECRET", "time_grain": "P1D"},
}


@pytest.fixture
def incr(mocker: MockerFixture) -> MagicMock:
    return mocker.patch(
        "superset.time_range_limits.telemetry.stats_logger_manager"
    ).instance.incr


@pytest.fixture
def lines(caplog: pytest.LogCaptureFixture) -> Callable[[], list[logging.LogRecord]]:
    caplog.set_level(logging.DEBUG, logger=LOGGER)
    return lambda: [
        record
        for record in caplog.records
        if record.name == LOGGER and record.levelno >= logging.INFO
    ]


@pytest.fixture
def chart_data(mocker: MockerFixture, client: Any, full_api_access: None) -> Any:
    """``POST /api/v1/chart/data`` on dataset 7 for user 3; no SQL runs."""
    mocker.patch.object(security_manager, "get_guest_rls_filters", return_value=[])
    mocker.patch.object(security_manager, "raise_for_access")
    mocker.patch("superset.commands.chart.data.get_data_command.ChartDataCommand.run")
    mocker.patch("superset.time_range_limits.telemetry.get_user_id", return_value=3)

    def post(time_range: str, **query: Any) -> Any:
        form_data = query.pop("form_data", {})
        return client.post(
            "/api/v1/chart/data",
            json={
                "datasource": {"id": 7, "type": "table"},
                "queries": [
                    {"filters": [tr(time_range)], "metrics": ["count"], **query}
                ],
                "form_data": form_data,
                "result_format": "json",
                "result_type": "full",
            },
        )

    return post


def fields_of(record: logging.LogRecord) -> dict[str, Any]:
    return record.time_range_limit  # type: ignore[attr-defined]


def limit_policy(*, extra: Any = None, **rules: tuple[int, str]) -> str:
    return json.dumps({"time_range_limits": extra or policy(**rules)})


@freeze_time(NOW)
def test_flag_off_records_nothing(
    mocker: MockerFixture, incr: MagicMock, lines: Any
) -> None:
    use_datasource(mocker, make_dataset(extra='{"time_range_limits": '))
    set_limits(mocker, {"schema_version": 1})

    check(make_context([{"filters": [tr("Last year")], "metrics": ["count"]}]))
    TimeRangeLimitError("MAX_SPAN_EXCEEDED", "message", {"rule": "max_span"})
    TimeRangeLimitsUnavailableError(source="global", field="max_span")
    log_global_policy()

    incr.assert_not_called()
    assert lines() == []


RULE_CASES = {
    "max_span": (
        {"dashboard": policy(max_span=(9, "P1W"))},
        "2026-06-22 : 2026-09-14",
        "time_range_limit.rejected.chart_data.max_span.dashboard",
    ),
    "max_look_back": (
        {"global": policy(max_look_back=(1, "P1M"))},
        "2026-01-01 : 2026-02-01",
        "time_range_limit.rejected.chart_data.max_look_back.global",
    ),
    "max_look_forward": (
        {"dataset": policy(max_look_forward=(0, "P1D"))},
        "2026-10-01 : 2026-12-01",
        "time_range_limit.rejected.chart_data.max_look_forward.dataset",
    ),
    "unbounded": (
        {"global": policy(max_span=(90, "P1D"))},
        "No filter",
        "time_range_limit.rejected.chart_data.unbounded.none",
    ),
    "no_valid_range": (
        {"dashboard": policy(max_look_back=(0, "PT1H"), max_look_forward=(0, "PT1H"))},
        "Last week",
        "time_range_limit.rejected.chart_data.no_valid_range.none",
    ),
}
EXPECTED_FIELDS = {
    "max_span": {
        "reason_code": "MAX_SPAN_EXCEEDED",
        "limit": "9xP1W",
        "actual_start": "2026-06-22T00:00:00+00:00",
        "actual_end": "2026-09-14T00:00:00+00:00",
    },
    "max_look_back": {"reason_code": "MAX_LOOK_BACK_EXCEEDED", "limit": "1xP1M"},
    "max_look_forward": {
        "reason_code": "MAX_LOOK_FORWARD_EXCEEDED",
        "limit": "0xP1D",
    },
    "unbounded": {
        "reason_code": "UNBOUNDED_RANGE",
        "limit": "none",
        "actual_start": "none",
        "actual_end": "none",
    },
    "no_valid_range": {"reason_code": "NO_VALID_RANGE", "limit": "none"},
}


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
@pytest.mark.parametrize("rule", RULE_CASES)
def test_rejection_key_and_log_fields(
    mocker: MockerFixture, chart_data: Any, incr: MagicMock, lines: Any, rule: str
) -> None:
    levels, time_range, key = RULE_CASES[rule]
    as_user(mocker, "admin")
    set_limits(mocker, levels.get("global"))
    use_datasource(
        mocker,
        make_dataset(
            extra=limit_policy(extra=levels["dataset"]) if "dataset" in levels else None
        ),
    )
    use_dashboards(mocker, make_dashboard(limits=levels.get("dashboard")))
    form_data = {"dashboardId": 3, "slice_id": 11} if "dashboard" in levels else {}

    response = chart_data(time_range, form_data=form_data)

    assert response.status_code == 400
    incr.assert_called_once_with(key)
    (line,) = lines()
    assert line.levelno == logging.INFO
    fields = fields_of(line)
    assert fields["rule"] == rule
    assert fields["path"] == "chart_data"
    assert fields["dataset_id"] == 7
    assert fields["user_id"] == 3
    assert fields["guest"] == "false"
    assert fields["comparison"] == "false"
    assert "field" not in fields
    assert {name: fields[name] for name in EXPECTED_FIELDS[rule]} == (
        EXPECTED_FIELDS[rule]
    )
    if "dashboard" in levels:
        assert (fields["dashboard_id"], fields["chart_id"]) == (3, 11)
    if rule == "max_span":
        assert line.getMessage() == (
            "Time range rejected: path=chart_data reason_code=MAX_SPAN_EXCEEDED "
            "rule=max_span source=dashboard dashboard_id=3 chart_id=11 dataset_id=7 "
            "user_id=3 guest=false limit=9xP1W "
            "actual_start=2026-06-22T00:00:00+00:00 "
            "actual_end=2026-09-14T00:00:00+00:00 comparison=false"
        )


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_comparison_and_guest_in_the_line(
    mocker: MockerFixture, incr: MagicMock, lines: Any
) -> None:
    use_datasource(mocker, make_dataset())
    as_user(mocker, "guest")
    set_limits(mocker, policy(max_span=(90, "P1D")))
    context = make_context(
        [
            {
                "filters": [tr("Last week")],
                "metrics": ["count"],
                "time_offsets": ["1 year ago"],
                "columns": [{"label": "ds", "sqlExpression": "ds"}],
            }
        ]
    )
    mocker.patch(
        "superset.time_range_limits.enforcement.get_query_ranges",
        return_value=[(None, None, "1 year ago")],
    )

    with pytest.raises(TimeRangeLimitError):
        check(context)

    (line,) = lines()
    assert fields_of(line)["comparison"] == "true"
    assert fields_of(line)["guest"] == "true"
    assert "1 year ago" not in line.getMessage()


UNAVAILABLE_CASES = {
    "global": {"global": BAD_QUANTITY},
    "dataset": {"dataset": BAD_QUANTITY},
    "dashboard": {"dashboard": BAD_QUANTITY},
    "forged_key": {"dataset": {**policy(max_span=(30, "P1D")), FORGED: 1}},
}
UNAVAILABLE_EXTRA: dict[str, dict[str, Any]] = {
    "global": {"source": "global", "field": "max_span.quantity"},
    "dataset": {"source": "dataset", "field": "max_span.quantity", "dataset_id": 7},
    "dashboard": {"source": "dashboard", "field": "max_span.quantity"},
    "forged_key": {"source": "dataset", "field": "other", "dataset_id": 7},
}


def unavailable_response(
    mocker: MockerFixture, chart_data: Any, case: str
) -> tuple[Any, dict[str, Any]]:
    levels = UNAVAILABLE_CASES[case]
    as_user(mocker, "admin")
    set_limits(mocker, levels.get("global"))
    use_datasource(
        mocker,
        make_dataset(
            extra=limit_policy(extra=levels["dataset"]) if "dataset" in levels else None
        ),
    )
    use_dashboards(mocker, make_dashboard(limits=levels.get("dashboard")))
    response = chart_data("Last week", form_data={"dashboardId": 3, "slice_id": 11})
    assert response.status_code == 503
    (error,) = response.json["errors"]
    return response, error


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
@pytest.mark.parametrize("case", ["global", "dataset", "dashboard"])
def test_unavailable_key_has_no_value(
    mocker: MockerFixture, chart_data: Any, incr: MagicMock, lines: Any, case: str
) -> None:
    unavailable_response(mocker, chart_data, case)

    incr.assert_called_once_with(f"time_range_limit.unavailable.chart_data.{case}")
    (line,) = lines()
    assert line.levelno == logging.WARNING
    assert line.getMessage().startswith(
        "Time range limits unavailable: path=chart_data "
        f"reason_code=POLICY_UNAVAILABLE rule=none source={case} "
        "field=max_span.quantity "
    )
    assert fields_of(line)["dataset_id"] == 7
    assert fields_of(line)["chart_id"] == 11
    assert fields_of(line)["dashboard_id"] == 3
    assert "SECRET" not in line.getMessage()
    assert "SECRET" not in json.dumps(fields_of(line))


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
@pytest.mark.parametrize("case", UNAVAILABLE_CASES)
def test_query_path_503_names_the_level(
    mocker: MockerFixture, chart_data: Any, case: str
) -> None:
    response, error = unavailable_response(mocker, chart_data, case)

    error["extra"].pop("issue_codes")
    assert error["message"] == (
        "Time range limits could not be verified. Retry the request."
    )
    assert error["extra"] == {
        "reason_code": "POLICY_UNAVAILABLE",
        **UNAVAILABLE_EXTRA[case],
    }
    assert "SECRET" not in response.get_data(as_text=True)
    assert "forged" not in response.get_data(as_text=True)


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_dashboard_id_on_dashboard_503_query(
    mocker: MockerFixture, chart_data: Any, lines: Any
) -> None:
    unavailable_response(mocker, chart_data, "dashboard")

    (line,) = lines()
    assert " dashboard_id=3 " in line.getMessage()


# The path label


PATH_ROWS = {
    "ChartDataRestApi.data": "chart_data",
    "ChartDataRestApi.get_data": "chart_data",
    "Datasource.samples": "samples",
    "DatasourceRestApi.get_column_values": "column_values",
    "DatasourceRestApi.query": "datasource_query",
    "Api.query": "query_api",
    "ChartRestApi.warm_up_cache": "warm_up",
    "DatasetRestApi.warm_up_cache": "warm_up",
    "Superset.warm_up_cache": "warm_up",
    "ExploreRestApi.get": "explore_load",
}
POLICY_API_ROWS = {
    "TimeRangeLimitsRestApi.get": "policy_api",
    "DashboardRestApi.get_time_range_limits": "policy_api",
    "DashboardRestApi.put_time_range_limits": "policy_api",
    "DashboardRestApi.get_time_range_limits_charts": "policy_api",
    "DatasetRestApi.get_time_range_limits": "policy_api",
    "DatasetRestApi.get_time_range_limits_charts": "policy_api",
    "ChartRangesRestApi.chart_ranges": "policy_api",
}
POLICY_WRITE_ROWS = {
    "DashboardRestApi.post": "policy_write",
    "DashboardRestApi.put": "policy_write",
    "DashboardRestApi.copy_dash": "policy_write",
    "DashboardRestApi.import_": "policy_write",
    "DashboardRestApi.restore_version": "policy_write",
    "DatasetRestApi.put": "policy_write",
    "DatasetRestApi.import_": "policy_write",
    "DatasetRestApi.restore_version": "policy_write",
    "Datasource.save": "policy_write",
    "ImportExportRestApi.import_": "policy_write",
}


@pytest.mark.parametrize("endpoint", PATH_ROWS)
def test_path_from_endpoint(app: Any, endpoint: str) -> None:
    assert endpoint in {rule.endpoint for rule in app.url_map.iter_rules()}
    with app.test_request_context():
        request.url_rule = Rule("/", endpoint=endpoint)
        assert _path() == PATH_ROWS[endpoint]


@pytest.mark.parametrize("endpoint", POLICY_API_ROWS)
def test_policy_api_path_from_the_limits_endpoints(app: Any, endpoint: str) -> None:
    assert endpoint in {rule.endpoint for rule in app.url_map.iter_rules()}
    with app.test_request_context():
        request.url_rule = Rule("/", endpoint=endpoint)
        assert _path() == "policy_api"


@pytest.mark.parametrize("endpoint", POLICY_WRITE_ROWS)
def test_policy_write_path_from_the_write_endpoints(app: Any, endpoint: str) -> None:
    assert endpoint in {rule.endpoint for rule in app.url_map.iter_rules()}
    with app.test_request_context():
        request.url_rule = Rule("/", endpoint=endpoint)
        assert _path() == "policy_write"


@with_feature_flags(**FLAG_ON)
def test_a_bad_global_on_a_dashboard_write_counts_under_policy_write(
    mocker: MockerFixture, app: Any, incr: MagicMock, lines: Any
) -> None:
    set_limits(mocker, {"schema_version": 1})

    with (
        app.test_request_context("/api/v1/dashboard/1", method="PUT"),
        pytest.raises(TimeRangeLimitsUnavailableError) as excinfo,
    ):
        check_stricter_than_global(
            TimeRangeLimits(max_span=PolicyRule(10, "P1D")), None, "dashboard"
        )

    assert excinfo.value.error.extra["source"] == "global"
    incr.assert_called_once_with("time_range_limit.unavailable.policy_write.global")
    (line,) = lines()
    assert fields_of(line)["path"] == "policy_write"


@with_feature_flags(**FLAG_ON)
def test_a_bad_global_on_the_admin_page_lookup_counts_under_policy_api(
    mocker: MockerFixture, app: Any, incr: MagicMock
) -> None:
    from superset.time_range_limits.policy import global_limits_payload

    set_limits(mocker, {"schema_version": 1})

    with (
        app.test_request_context("/api/v1/time_range_limits/", method="GET"),
        pytest.raises(TimeRangeLimitsUnavailableError),
    ):
        global_limits_payload()

    incr.assert_called_once_with("time_range_limit.unavailable.policy_api.global")


@pytest.mark.parametrize("path", ["async_worker", "mcp"])
def test_path_set_by_the_caller_wins_over_the_endpoint(app: Any, path: str) -> None:
    with app.test_request_context():
        request.url_rule = Rule("/", endpoint="ChartDataRestApi.data")
        with limit_path(path):
            assert _path() == path
        assert _path() == "chart_data"


def test_path_decorates_a_function() -> None:
    @limit_path("async_worker")
    def worker() -> str:
        return _path()

    assert worker() == "async_worker"
    assert _path() == "other"


def test_path_is_reset_when_the_block_raises(app: Any) -> None:
    assert _path() == "other"
    with pytest.raises(RuntimeError, match="boom"):  # noqa: PT012
        with limit_path("report"):
            assert _path() == "report"
            raise RuntimeError("boom")
    assert _path() == "other"


@pytest.mark.asyncio
async def test_path_is_reset_when_an_async_block_raises(app: Any) -> None:
    with pytest.raises(RuntimeError, match="boom"):
        async with limit_path("mcp"):
            raise RuntimeError("boom")
    assert _path() == "other"


@pytest.mark.asyncio
async def test_path_mcp_marker(app: Any) -> None:
    @limit_path("mcp")
    async def tool() -> str:
        return _path()

    async with limit_path("mcp"):
        assert _path() == "mcp"
    assert await tool() == "mcp"
    assert _path() == "other"


@pytest.mark.asyncio
async def test_path_other(app: Any) -> None:
    assert _path() == "other"
    with app.test_request_context():
        request.url_rule = Rule("/", endpoint="ChartRestApi.export")
        assert _path() == "other"
    async with limit_path("free text"):
        assert _path() == "other"


# The ids of the scope


def test_nested_scope_keeps_the_outer_ids() -> None:
    from superset.time_range_limits.telemetry import _scope

    with limit_scope(dataset_id=7, chart_id=11):
        with limit_scope(dashboard_id=3, chart_id=None):
            assert tuple(_scope.get()) == (7, 11, 3)
        assert tuple(_scope.get()) == (7, 11, None)
    assert tuple(_scope.get()) == (None, None, None)


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_scope_ids_for_query_context(mocker: MockerFixture, lines: Any) -> None:
    use_datasource(mocker, make_dataset())
    mocker.patch.object(security_manager, "get_guest_rls_filters", return_value=[])
    set_limits(mocker, policy(max_span=(90, "P1D")))
    queries = [{"filters": [tr("Last year")], "metrics": ["count"]}]
    from_form_data = make_context(queries, {"slice_id": 11})
    carried = make_context(queries, {"slice_id": 11})
    carried.limit_slice_id = 12

    for context in (from_form_data, carried):
        with pytest.raises(TimeRangeLimitError):
            check(context)

    assert [
        (fields_of(line)["chart_id"], fields_of(line)["dataset_id"]) for line in lines()
    ] == [
        (11, 7),
        (12, 7),
    ]


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_annotation_scope_ids(mocker: MockerFixture, lines: Any) -> None:
    from superset.common.query_context_processor import QueryContextProcessor

    mocker.patch.object(security_manager, "get_rls_filters", return_value=[])
    mocker.patch.object(security_manager, "get_guest_rls_filters", return_value=[])
    mocker.patch.object(security_manager, "raise_for_access")
    mocker.patch("superset.daos.dashboard.DashboardDAO.find_by_id", return_value=None)
    set_limits(mocker, policy(max_span=(90, "P1D")))
    use_datasource(mocker, make_dataset())
    annotation = MagicMock(id=21)
    annotation.get_query_context.return_value = make_context(
        [{"filters": [tr("Last year")], "metrics": ["count"]}], {"slice_id": 21}
    )
    mocker.patch("superset.daos.chart.ChartDAO.find_by_id", return_value=annotation)

    with (
        limit_scope(dataset_id=50, chart_id=99),
        pytest.raises(TimeRangeLimitError),
    ):
        QueryContextProcessor.get_viz_annotation_data(
            {"value": 21, "name": "layer", "overrides": {}}, force=False
        )

    (line,) = lines()
    assert (fields_of(line)["chart_id"], fields_of(line)["dataset_id"]) == (21, 7)


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_no_sql_in_log_line(mocker: MockerFixture, chart_data: Any, lines: Any) -> None:
    use_datasource(mocker, make_dataset())
    set_limits(mocker, policy(max_span=(90, "P1D")))

    response = chart_data(
        "Last year",
        extras={"where": "secret_where_clause = 1"},
        metrics=[
            {
                "expressionType": "SQL",
                "sqlExpression": "SUM(secret_metric_expression)",
                "label": "secret_label",
            }
        ],
    )

    assert response.status_code == 400
    (line,) = lines()
    text = line.getMessage() + json.dumps(fields_of(line))
    for secret in ("secret_where_clause", "secret_metric_expression", "SELECT"):
        assert secret not in text


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_unknown_field_logs_other(
    mocker: MockerFixture, chart_data: Any, incr: MagicMock, lines: Any
) -> None:
    unavailable_response(mocker, chart_data, "forged_key")

    incr.assert_called_once_with("time_range_limit.unavailable.chart_data.dataset")
    (line,) = lines()
    assert " field=other " in line.getMessage()
    assert "\n" not in line.getMessage()
    assert "forged" not in line.getMessage()
    assert fields_of(line)["field"] == "other"


@with_feature_flags(**FLAG_ON)
def test_label_outside_list_becomes_other(
    mocker: MockerFixture, incr: MagicMock, lines: Any
) -> None:
    TimeRangeLimitError(
        "MAX_SPAN_EXCEEDED",
        "message",
        {
            "rule": "max_span.42",
            "source": "dashboard 42",
            "dashboard_id": "42 x=1",
            "limit": {"quantity": 9, "time_grain": "P1W x=1"},
            "actual": {"start": "2026 x=1", "end": "2026\nnext"},
        },
    )
    TimeRangeLimitError("SOMETHING_ELSE", "message", {})
    TimeRangeLimitsUnavailableError(source="owner text", field=FORGED, dataset_id=7)

    assert [call.args[0] for call in incr.call_args_list] == [
        "time_range_limit.rejected.other.other.other",
        "time_range_limit.rejected.other.other.none",
        "time_range_limit.unavailable.other.other",
    ]
    first, _second, third = lines()
    assert first.getMessage() == (
        "Time range rejected: path=other reason_code=MAX_SPAN_EXCEEDED rule=other "
        "source=other dashboard_id=none chart_id=none dataset_id=none user_id=none "
        "guest=false limit=none actual_start=none actual_end=none "
        "comparison=false"
    )
    assert fields_of(third)["field"] == "other"


@with_feature_flags(**FLAG_ON)
@pytest.mark.parametrize(
    "quantity,limit", [(True, "none"), (False, "none"), (9, "9xP1W")]
)
def test_a_boolean_quantity_logs_no_limit(
    mocker: MockerFixture, incr: MagicMock, lines: Any, quantity: Any, limit: str
) -> None:
    TimeRangeLimitError(
        "MAX_SPAN_EXCEEDED",
        "message",
        {"limit": {"quantity": quantity, "time_grain": "P1W"}},
    )

    (line,) = lines()
    assert fields_of(line)["limit"] == limit


class RaisingFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        raise RuntimeError("filter failed")


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
@pytest.mark.parametrize("failure", ["stats", "log_filter"])
def test_record_failure_keeps_the_limit_error(
    mocker: MockerFixture, incr: MagicMock, lines: Any, failure: str
) -> None:
    use_datasource(mocker, make_dataset())
    mocker.patch.object(security_manager, "get_guest_rls_filters", return_value=[])
    set_limits(mocker, policy(max_span=(90, "P1D")))
    logger = logging.getLogger(LOGGER)
    raising = RaisingFilter()
    if failure == "stats":
        incr.side_effect = OSError("statsd down")
    else:
        logger.addFilter(raising)

    try:
        with pytest.raises(TimeRangeLimitError) as excinfo:
            check(make_context([{"filters": [tr("Last year")], "metrics": ["count"]}]))
    finally:
        logger.removeFilter(raising)

    assert excinfo.value.status == 400
    assert excinfo.value.error.extra["reason_code"] == "MAX_SPAN_EXCEEDED"
    assert excinfo.value.error.message.startswith("Range can't be longer than")
    assert lines() == []


GOOD_GLOBAL = policy(max_span=(90, "P1D"))


@pytest.mark.parametrize(
    "case, flag, limits, level, message",
    [
        (
            "good",
            True,
            GOOD_GLOBAL,
            logging.INFO,
            "Time range limits: global policy max_span=90xP1D max_look_back=none "
            "max_look_forward=none",
        ),
        ("none", True, None, logging.INFO, "Time range limits: no global policy"),
        (
            "bad",
            True,
            BAD_QUANTITY,
            logging.ERROR,
            "Time range limits: TIME_RANGE_LIMITS_GLOBAL is not valid "
            "(max_span.quantity: must be a whole number from 1 to 9999). "
            "Every guarded query fails closed (503).",
        ),
        ("flag_off", False, BAD_QUANTITY, None, None),
    ],
    ids=["good", "none", "bad", "flag_off"],
)
def test_startup_log_global_policy(
    mocker: MockerFixture,
    caplog: pytest.LogCaptureFixture,
    case: str,
    flag: bool,
    limits: Any,
    level: int | None,
    message: str | None,
) -> None:
    caplog.set_level(logging.DEBUG, logger=LOGGER)
    set_limits(mocker, limits)

    with_feature_flags(TIME_RANGE_LIMITS=flag)(log_global_policy)()

    found = [
        (record.levelno, record.getMessage())
        for record in caplog.records
        if record.name == LOGGER
    ]
    assert found == ([] if level is None else [(level, message)])


@pytest.mark.parametrize(
    "app",
    [
        {
            # FEATURE_FLAGS would update Superset's shared DEFAULT_FEATURE_FLAGS dict.
            "GET_FEATURE_FLAGS_FUNC": lambda flags: {**flags, **FLAG_ON},
            "TIME_RANGE_LIMITS_GLOBAL": BAD_QUANTITY,
        }
    ],
    indirect=True,
)
def test_startup_bad_global_app_still_starts(
    caplog: pytest.LogCaptureFixture, app: Any
) -> None:
    errors = [
        record.getMessage()
        for record in caplog.get_records("setup")
        if record.name == LOGGER
    ]

    assert app.config["TIME_RANGE_LIMITS_GLOBAL"] == BAD_QUANTITY
    assert errors == [
        "Time range limits: TIME_RANGE_LIMITS_GLOBAL is not valid "
        "(max_span.quantity: must be a whole number from 1 to 9999). "
        "Every guarded query fails closed (503)."
    ]
    assert "ChartDataRestApi.data" in {
        rule.endpoint for rule in app.url_map.iter_rules()
    }


def test_startup_runs_at_the_end_of_init_app_in_ctx(mocker: MockerFixture) -> None:
    from superset.initialization import SupersetAppInitializer

    order: list[str] = []
    initializer = MagicMock(spec=SupersetAppInitializer)
    initializer.config = {"FLASK_APP_MUTATOR": None}
    initializer.superset_app = MagicMock()
    initializer.init_all_dependencies_and_extensions.side_effect = lambda: order.append(
        "extensions"
    )
    initializer.init_versioning.side_effect = lambda: order.append("versioning")
    mocker.patch(
        "superset.time_range_limits.audit.register_audit_listener",
        side_effect=lambda session: order.append("audit"),
    )
    mocker.patch(
        "superset.time_range_limits.telemetry.log_global_policy",
        side_effect=lambda: order.append("log_global_policy"),
    )

    SupersetAppInitializer.init_app_in_ctx(initializer)

    assert order == ["extensions", "versioning", "audit", "log_global_policy"]
