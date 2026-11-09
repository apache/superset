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

import re
from datetime import datetime
from types import SimpleNamespace
from typing import Any

import pandas as pd
import pytest
from flask import current_app
from freezegun import freeze_time
from jinja2.sandbox import SandboxedEnvironment
from pytest_mock import MockerFixture

from superset.common.chart_data import ChartDataResultType
from superset.exceptions import QueryObjectValidationError
from superset.extensions import feature_flag_manager, security_manager
from superset.time_range_limits.policy import (
    FEATURE_FLAG,
    TimeRangeLimitError,
    TimeRangeLimitsUnavailableError,
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
from tests.unit_tests.conftest import with_feature_flags

NOW = "2026-10-21 12:00:00"
OPEN = (None, None, None)
FLAG_ON = {FEATURE_FLAG: True}
LAST_WEEK = (datetime(2026, 10, 14), datetime(2026, 10, 21), None)


@pytest.fixture
def dataset(mocker: MockerFixture) -> Any:
    mocker.patch.object(security_manager, "get_guest_rls_filters", return_value=[])
    return use_datasource(mocker, make_dataset())


def ranges_of(context: Any, index: int = 0) -> list[Any]:
    from superset.time_range_limits.enforcement import get_query_ranges

    query = context.queries[index]
    return get_query_ranges(
        context.datasource, query, query.result_type or context.result_type
    )


def sql_ranges(datasource: Any, query: dict[str, Any]) -> list[Any]:
    """The ``(since, until)`` bounds in the SQL ``WHERE``, in order."""
    return [
        (since, until, None)
        for _col, since, until in sql_column_ranges(datasource, query)
    ]


def sql_overlap(datasource: Any, query: dict[str, Any]) -> list[Any]:
    """The overlap of the SQL bounds on each column, in the order columns appear."""
    overlap: dict[str, list[Any]] = {}
    for col, since, until in sql_column_ranges(datasource, query):
        found = overlap.setdefault(col, [None, None])
        if since is not None:
            found[0] = since if found[0] is None else max(found[0], since)
        if until is not None:
            found[1] = until if found[1] is None else min(found[1], until)
    return [(since, until, None) for since, until in overlap.values()]


def sql_column_ranges(datasource: Any, query: dict[str, Any]) -> list[Any]:
    """The ``(column, since, until)`` bounds in the SQL ``WHERE``, in order."""
    sql = " ".join(datasource.get_query_str_extended(query, mutate=False).sql.split())
    where = re.search(r"WHERE (.*?)(?: GROUP BY| ORDER BY| LIMIT|$)", sql)
    bounds = re.findall(
        r"(\w+) (>=|<) '([0-9-]+ [0-9:]+)'", where.group(1) if where else ""
    )
    found: list[Any] = []
    for col, op, value in bounds:
        day = datetime.fromisoformat(value)
        if op == ">=":
            found.append([col, day, None])
        elif found and found[-1][0] == col and found[-1][2] is None:
            found[-1][2] = day
        else:
            found.append([col, None, day])
    return [tuple(bounds) for bounds in found]


NATIVE_FILTERS: list[dict[str, Any]] = [
    {
        "id": "NATIVE_FILTER-select",
        "targets": [{"datasetId": 7, "column": {"name": "name"}}],
        "controlValues": {},
    },
    {
        "id": "NATIVE_FILTER-sorted",
        "targets": [{"datasetId": 7, "column": {"name": "name"}}],
        "controlValues": {"sortMetric": "count"},
    },
    {
        "id": "NATIVE_FILTER-range",
        "targets": [{"datasetId": 7, "column": {"name": "value"}}],
    },
    {
        "id": "NATIVE_FILTER-timed",
        "targets": [{"datasetId": 7, "column": {"name": "name"}}],
        "granularity_sqla": "ds",
    },
]


def reason_of(context: Any) -> str:
    with pytest.raises(TimeRangeLimitError) as excinfo:
        check(context)
    return excinfo.value.error.extra["reason_code"]


# Flag off


@freeze_time(NOW)
def test_flag_off_does_no_parsing_and_no_db_read(
    mocker: MockerFixture, dataset: Any
) -> None:
    set_limits(mocker, policy(max_span=(1, "P1D")))
    context = make_context([{"filters": [tr("Last year")], "metrics": ["count"]}])
    for target in (
        "superset.time_range_limits.enforcement.get_query_ranges",
        "superset.time_range_limits.enforcement.get_effective_time_range_limits",
        "superset.daos.dashboard.DashboardDAO.find_by_id",
    ):
        mocker.patch(target, side_effect=AssertionError(target))
    mocker.patch.object(security_manager, "raise_for_access")

    check(context)
    context.raise_for_access()


# No limits, and limits that can't be loaded


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
@pytest.mark.parametrize("extra", [None, "{", "not json", "[]"])
def test_no_limits_change_nothing(mocker: MockerFixture, extra: str | None) -> None:
    use_datasource(mocker, make_dataset(extra=extra))
    set_limits(mocker, None)

    check(make_context([{"columns": ["name"], "metrics": ["count"]}]))
    check(make_context([{"filters": [tr("No filter")], "metrics": ["count"]}]))


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_truncated_dataset_limits_fail_closed(mocker: MockerFixture) -> None:
    use_datasource(mocker, make_dataset(extra='{"time_range_limits": '))
    set_limits(mocker, None)
    logger = mocker.patch("superset.time_range_limits.enforcement.logger")

    with pytest.raises(TimeRangeLimitsUnavailableError) as excinfo:
        check(make_context([{"filters": [tr("Last week")], "metrics": ["count"]}]))

    error = excinfo.value.error
    assert excinfo.value.status == 503
    assert error.error_type == "TIME_RANGE_LIMIT_ERROR"
    assert (
        error.message == "Time range limits could not be verified. Retry the request."
    )
    assert error.extra["issue_codes"][0]["code"] == 1042
    assert error.extra["reason_code"] == "POLICY_UNAVAILABLE"
    assert "time_range_limits" not in json.dumps(error.extra)
    logger.exception.assert_called_once()


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
@pytest.mark.parametrize("time_range", ["Last year", "Last 90 days"])
def test_global_limit_on_the_main_range(
    mocker: MockerFixture, dataset: Any, time_range: str
) -> None:
    set_limits(mocker, policy(max_span=(90, "P1D")))
    context = make_context([{"filters": [tr(time_range)], "metrics": ["count"]}])

    if time_range == "Last year":
        assert reason_of(context) == "MAX_SPAN_EXCEEDED"
    else:
        check(context)


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_several_queries_only_the_second_breaks(
    mocker: MockerFixture, dataset: Any
) -> None:
    set_limits(mocker, policy(max_span=(90, "P1D")))
    context = make_context(
        [
            {"filters": [tr("Last 30 days")], "metrics": ["count"]},
            {"filters": [tr("Last year")], "metrics": ["count"]},
        ]
    )

    with pytest.raises(TimeRangeLimitError) as excinfo:
        check(context)
    assert excinfo.value.error.extra["reason_code"] == "MAX_SPAN_EXCEEDED"
    assert excinfo.value.error.extra["actual"] == {
        "start": "2025-10-21T00:00:00+00:00",
        "end": "2026-10-21T00:00:00+00:00",
    }
    check(
        make_context(
            [
                {"filters": [tr("Last 30 days")], "metrics": ["count"]},
                {"filters": [tr("Last week")], "metrics": ["count"]},
            ]
        )
    )


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_chart_data_api_returns_the_limit_error(
    mocker: MockerFixture, client: Any, full_api_access: None, dataset: Any
) -> None:
    set_limits(mocker, policy(max_span=(90, "P1D")))
    mocker.patch.object(security_manager, "raise_for_access")
    run = mocker.patch(
        "superset.commands.chart.data.get_data_command.ChartDataCommand.run"
    )

    response = client.post(
        "/api/v1/chart/data",
        json={
            "datasource": {"id": 7, "type": "table"},
            "queries": [{"filters": [tr("Last year")], "metrics": ["count"]}],
            "result_format": "json",
            "result_type": "full",
        },
    )

    assert response.status_code == 400
    (error,) = response.json["errors"]
    assert error["error_type"] == "TIME_RANGE_LIMIT_ERROR"
    assert error["extra"]["reason_code"] == "MAX_SPAN_EXCEEDED"
    run.assert_not_called()


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_chart_data_api_returns_503_when_limits_cant_be_loaded(
    mocker: MockerFixture, client: Any, full_api_access: None
) -> None:
    use_datasource(mocker, make_dataset(extra='{"time_range_limits": '))
    mocker.patch.object(security_manager, "raise_for_access")

    response = client.post(
        "/api/v1/chart/data",
        json={
            "datasource": {"id": 7, "type": "table"},
            "queries": [{"filters": [tr("Last week")], "metrics": ["count"]}],
        },
    )

    assert response.status_code == 503
    (error,) = response.json["errors"]
    assert error["error_type"] == "TIME_RANGE_LIMIT_ERROR"
    assert error["message"] == (
        "Time range limits could not be verified. Retry the request."
    )
    assert error["level"] == "error"
    issue_codes = error["extra"].pop("issue_codes")
    assert [code["code"] for code in issue_codes] == [1042]
    assert error["extra"] == {
        "reason_code": "POLICY_UNAVAILABLE",
        "source": "dataset",
        "dataset_id": 7,
    }
    assert "time_range_limits" not in response.get_data(as_text=True)
    assert "max_span" not in response.get_data(as_text=True)


# The ranges are the ones the SQL WHERE uses


PARITY_CASES: dict[str, tuple[list[dict[str, Any]], list[Any]]] = {
    "1 chart filter": ([{"filters": [tr("Last week")]}], [LAST_WEEK]),
    "2 time_range over No filter": (
        [{"filters": [tr("No filter")], "time_range": "Last month"}],
        [(datetime(2026, 9, 21), datetime(2026, 10, 21), None)],
    ),
    "3 no time filter": ([{"columns": ["name"], "metrics": []}], [OPEN]),
    "4 granularity + time_range": (
        [{"granularity": "ds", "time_range": "Last week"}],
        [LAST_WEEK],
    ),
    "5 unknown column": ([{"filters": [tr("Last week", col="nope")]}], [OPEN]),
    "7 second filter No filter": (
        [{"filters": [tr("Last week"), tr("No filter", col="other_ts")]}],
        [LAST_WEEK],
    ),
    "8 granularity other_ts + filter on ds": (
        [{"granularity": "other_ts", "filters": [tr("Last week")]}],
        [LAST_WEEK],
    ),
    "9 granularity not temporal": (
        [{"granularity": "name", "time_range": "Last week"}],
        [LAST_WEEK],
    ),
    "10 time_shift": (
        [{"filters": [tr("Last week")], "time_shift": "1 year ago"}],
        [(datetime(2025, 10, 14), datetime(2025, 10, 21), None)],
    ),
}


@freeze_time(NOW)
@pytest.mark.parametrize("case", PARITY_CASES)
def test_ranges_match_the_sql(dataset: Any, case: str) -> None:
    queries, expected = PARITY_CASES[case]
    context = make_context([{"metrics": ["count"], **queries[0]}])

    ranges = ranges_of(context)

    assert ranges == expected
    assert sql_ranges(dataset, context.queries[0].to_dict()) == [
        r for r in expected if r != OPEN
    ]


@freeze_time(NOW)
def test_ranges_match_the_sql_without_a_main_column(mocker: MockerFixture) -> None:
    mocker.patch.object(security_manager, "get_guest_rls_filters", return_value=[])
    dataset = use_datasource(mocker, make_dataset(main=None))
    context = make_context(
        [
            {
                "granularity": "name",
                "filters": [tr("Last week")],
                "time_range": "Last week",
                "metrics": ["count"],
            }
        ]
    )

    assert context.queries[0].from_dttm is not None
    assert sql_ranges(dataset, context.queries[0].to_dict()) == []
    assert ranges_of(context) == [OPEN]


@freeze_time(NOW)
def test_ranges_filter_by_verbose_name_matches_the_sql(mocker: MockerFixture) -> None:
    mocker.patch.object(security_manager, "get_guest_rls_filters", return_value=[])
    dataset = use_datasource(mocker, make_dataset(verbose={"other_ts": "Other time"}))
    context = make_context(
        [{"filters": [tr("Last week", col="Other time")], "metrics": ["count"]}]
    )

    assert ranges_of(context) == [LAST_WEEK]
    assert sql_ranges(dataset, context.queries[0].to_dict()) == [LAST_WEEK]


@freeze_time(NOW)
def test_ranges_non_string_value_is_open(dataset: Any) -> None:
    context = make_context(
        [
            {
                "filters": [tr("Last week"), tr(["x"], col="other_ts")],
                "metrics": ["count"],
            }
        ]
    )

    assert ranges_of(context) == [LAST_WEEK]


def samples_query(mocker: MockerFixture, context: Any) -> dict[str, Any]:
    """The query dict a samples request runs, taken from the real preparer."""
    from superset.common import query_actions

    return dict(
        query_actions._prepare_samples_query(context, context.queries[0]).to_dict()
    )


@freeze_time(NOW)
@pytest.mark.parametrize(
    "query,expected",
    [
        pytest.param(
            {
                "filters": [tr("Last week")],
                "granularity": "ds",
                "time_range": "Last week",
            },
            [OPEN],
            id="12 filter removed by granularity",
        ),
        pytest.param(
            {"filters": [tr("Last week", col="other_ts")]},
            [LAST_WEEK],
            id="12b filter on another column",
        ),
    ],
)
def test_samples_ranges_match_the_sql(
    mocker: MockerFixture, dataset: Any, query: dict[str, Any], expected: list[Any]
) -> None:
    context = make_context([query], result_type=ChartDataResultType.SAMPLES)

    assert ranges_of(context) == expected
    assert sql_ranges(dataset, samples_query(mocker, context)) == [
        r for r in expected if r != OPEN
    ]


@freeze_time(NOW)
@pytest.mark.parametrize(
    "result_type,expected",
    [
        (ChartDataResultType.SAMPLES, [OPEN]),
        (ChartDataResultType.DRILL_DETAIL, [LAST_WEEK]),
    ],
)
def test_timestamp_filter_bounds_nothing_without_timeseries(
    mocker: MockerFixture,
    dataset: Any,
    result_type: ChartDataResultType,
    expected: list[Any],
) -> None:
    from superset.common import query_actions

    context = make_context(
        [
            {
                "granularity": "ds",
                "is_timeseries": True,
                "filters": [tr("Last week"), tr("Last year", col="__timestamp")],
                "metrics": ["count"],
            }
        ],
        result_type=result_type,
    )

    preparer = query_actions._data_result_type_preparers[result_type]
    assert preparer is not None
    prepared = preparer(context, context.queries[0])

    assert ranges_of(context) == expected
    assert sql_ranges(dataset, dict(prepared.to_dict())) == [
        r for r in expected if r != OPEN
    ]


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_ranges_without_time_bounds_are_rejected_as_open(mocker: MockerFixture) -> None:
    set_limits(mocker, policy(max_span=(90, "P1D")))
    use_datasource(mocker, make_dataset())
    unknown = make_context(
        [{"filters": [tr("Last week", col="nope")], "metrics": ["count"]}]
    )
    assert reason_of(unknown) == "UNBOUNDED_RANGE"

    use_datasource(mocker, make_dataset(main=None))
    no_main = make_context(
        [{"granularity": "name", "time_range": "Last week", "metrics": ["count"]}]
    )
    assert reason_of(no_main) == "UNBOUNDED_RANGE"


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_full_query_in_a_columns_context_is_checked(
    mocker: MockerFixture, dataset: Any
) -> None:
    set_limits(mocker, policy(max_span=(90, "P1D")))
    context = make_context(
        [{"filters": [tr("Last year")], "metrics": ["count"], "result_type": "full"}],
        result_type=ChartDataResultType.COLUMNS,
    )

    assert reason_of(context) == "MAX_SPAN_EXCEEDED"


# Time comparison


def offset_sql_ranges(
    mocker: MockerFixture, dataset: Any, query: Any, datetime_index: bool
) -> list[Any]:
    """The ranges in the SQL ``processing_time_offsets`` runs for one offset."""
    return sql_ranges(dataset, offset_query(mocker, dataset, query, datetime_index))


def offset_query(
    mocker: MockerFixture, dataset: Any, query: Any, datetime_index: bool
) -> dict[str, Any]:
    """The query dict ``processing_time_offsets`` runs for one offset."""
    captured: list[dict[str, Any]] = []

    def fake_query(query_dict: dict[str, Any]) -> Any:
        captured.append(query_dict)
        raise RuntimeError("stop")

    mocker.patch.object(dataset, "query", side_effect=fake_query)
    df = (
        pd.DataFrame({"ds": pd.to_datetime(["2026-10-01"]), "count": [1]})
        if datetime_index
        else pd.DataFrame({"name": ["a"], "count": [1]})
    )
    with pytest.raises(RuntimeError):
        dataset.processing_time_offsets(df, query)
    return captured[0]


@freeze_time(NOW)
@with_feature_flags(DATE_RANGE_TIMESHIFTS_ENABLED=True)
@pytest.mark.parametrize("datetime_index", [True, False])
@pytest.mark.parametrize("time_shift", [None, "1 month ago"])
@pytest.mark.parametrize(
    "offset",
    ["1 year ago", "1 year later", "inherit", "2026-01-01", "2025-01-01 : 2025-03-31"],
)
def test_time_offset_ranges_cover_the_sql(
    mocker: MockerFixture,
    dataset: Any,
    offset: str,
    time_shift: str | None,
    datetime_index: bool,
) -> None:
    columns: list[Any] = (
        [
            {
                "label": "ds",
                "sqlExpression": "ds",
                "columnType": "BASE_AXIS",
                "timeGrain": "P1D",
            }
        ]
        if datetime_index
        else ["name"]
    )
    context = make_context(
        [
            {
                "filters": [tr("Last 90 days")],
                "columns": columns,
                "metrics": ["count"],
                "time_offsets": [offset],
                "time_shift": time_shift,
            }
        ]
    )
    query = context.queries[0]

    offset_ranges = [r[:2] for r in ranges_of(context) if r[2] == offset]

    for since, until, _ in offset_sql_ranges(mocker, dataset, query, datetime_index):
        assert (since, until) in offset_ranges


@freeze_time(NOW)
def test_one_year_later_checks_the_helper_and_the_reshift(dataset: Any) -> None:
    context = make_context(
        [
            {
                "filters": [tr("Last 90 days")],
                "columns": ["name"],
                "metrics": ["count"],
                "time_offsets": ["1 year later"],
            }
        ]
    )

    assert ranges_of(context)[1:] == [
        (datetime(2027, 7, 23), datetime(2027, 10, 21), "1 year later"),
        (datetime(2025, 7, 23), datetime(2025, 10, 21), "1 year later"),
    ]


@freeze_time(NOW)
def test_grained_comparison_helpers_bound_no_column(dataset: Any) -> None:
    from superset.time_range_limits.enforcement import _time_offset_ranges

    query = offset_context("1 year ago").queries[0]
    filters = [
        ("ds", {"grain": "P1W", "val": "Last 90 days"}),
        ("ds", {"grain": "P1M", "val": "Last 90 days"}),
    ]

    ranges = _time_offset_ranges(query, filters)

    assert [(column, origins) for column, *_r, origins in ranges] == [
        (None, (("time_comparison", 0),)),
        (None, (("time_comparison", 0),)),
        ("ds", (("time_comparison", 0),)),
        (None, (("time_comparison", 0),)),
        ("ds", (("time_comparison", 0),)),
    ]


def offset_context(offset: str) -> Any:
    return make_context(
        [
            {
                "filters": [tr("Last 90 days")],
                "columns": ["name"],
                "metrics": ["count"],
                "time_offsets": [offset],
            }
        ]
    )


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON, DATE_RANGE_TIMESHIFTS_ENABLED=True)
@pytest.mark.parametrize(
    "offset", ["1 year ago", "1 year later", "inherit", "2025-07-23 : 2025-10-21"]
)
def test_time_comparison_within_the_longest_range_passes(
    mocker: MockerFixture, dataset: Any, offset: str
) -> None:
    set_limits(mocker, policy(max_span=(90, "P1D")))

    check(offset_context(offset))


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON, DATE_RANGE_TIMESHIFTS_ENABLED=True)
@pytest.mark.parametrize(
    "offset,limits,reason",
    [
        ("2 years ago", policy(max_look_back=(13, "P1M")), "MAX_LOOK_BACK_EXCEEDED"),
        (
            "1 year later",
            policy(max_look_forward=(0, "P1D")),
            "MAX_LOOK_FORWARD_EXCEEDED",
        ),
        ("1 year later", policy(max_look_back=(13, "P1M")), "MAX_LOOK_BACK_EXCEEDED"),
        (
            "2024-01-01 : 2024-02-01",
            policy(max_look_back=(13, "P1M")),
            "MAX_LOOK_BACK_EXCEEDED",
        ),
    ],
)
def test_time_comparison_breaking_the_limits_is_named(
    mocker: MockerFixture,
    dataset: Any,
    offset: str,
    limits: dict[str, Any],
    reason: str,
) -> None:
    set_limits(mocker, limits)

    with pytest.raises(TimeRangeLimitError) as excinfo:
        check(offset_context(offset))

    assert excinfo.value.error.extra["reason_code"] == reason
    assert excinfo.value.error.extra["time_offset"] == offset
    assert excinfo.value.error.message.startswith(f'Time comparison "{offset}": ')


@freeze_time(NOW)
def test_time_comparison_without_an_enclosed_range_is_left_to_superset(
    dataset: Any,
) -> None:
    context = make_context(
        [
            {
                "columns": ["name"],
                "metrics": ["count"],
                "time_offsets": ["1 year ago"],
            }
        ]
    )
    df = pd.DataFrame({"name": ["a"], "count": [1]})
    with pytest.raises(QueryObjectValidationError, match="An enclosed time range"):
        dataset.processing_time_offsets(df, context.queries[0])

    assert ranges_of(context) == [OPEN]


# No time filter, temporal columns


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_no_time_filter_on_a_temporal_dataset_is_open(
    mocker: MockerFixture, dataset: Any
) -> None:
    set_limits(mocker, policy(max_span=(90, "P1D")))

    assert (
        reason_of(make_context([{"columns": ["name"], "metrics": ["count"]}]))
        == "UNBOUNDED_RANGE"
    )


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_no_time_filter_on_a_dataset_without_temporal_columns_passes(
    mocker: MockerFixture,
) -> None:
    use_datasource(mocker, make_dataset(temporal=False))
    set_limits(mocker, policy(max_span=(90, "P1D")))
    context = make_context([{"columns": ["name"], "metrics": ["count"]}])

    assert ranges_of(context) == []
    check(context)


def make_query_datasource() -> Any:
    from superset.models.core import Database
    from superset.models.sql_lab import Query

    return Query(
        id=7,
        sql="select 1",
        database=Database(id=1, database_name="db", sqlalchemy_uri="sqlite://"),
        extra_json=json.dumps(
            {
                "columns": [
                    {"column_name": "ds", "is_dttm": True, "type": "TIMESTAMP"},
                    {"column_name": "name", "is_dttm": False, "type": "VARCHAR"},
                ]
            }
        ),
    )


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_query_datasource_never_reads_main_dttm_col(mocker: MockerFixture) -> None:
    from superset.models.sql_lab import Query

    use_datasource(mocker, make_query_datasource())
    mocker.patch.object(
        Query,
        "main_dttm_col",
        new_callable=mocker.PropertyMock,
        side_effect=AssertionError("main_dttm_col"),
    )
    set_limits(mocker, policy(max_span=(90, "P1D")))

    bounded = make_context(
        [{"filters": [tr("Last week")], "columns": ["name"]}], datasource_type="query"
    )
    assert ranges_of(bounded) == [LAST_WEEK]
    check(bounded)
    not_temporal = make_context(
        [{"granularity": "name", "time_range": "Last week", "columns": ["name"]}],
        datasource_type="query",
    )
    assert reason_of(not_temporal) == "UNBOUNDED_RANGE"


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_query_datasource_ignores_a_dashboard_its_chart_is_not_on(
    mocker: MockerFixture,
) -> None:
    use_datasource(mocker, make_query_datasource())
    as_user(mocker, "rbac")
    set_limits(mocker, policy(max_span=(90, "P1D")))
    use_dashboards(mocker, make_dashboard(limits=policy(max_span=(30, "P1D"))))

    check(
        make_context(
            [{"filters": [tr("Last 60 days")], "columns": ["name"]}],
            {"dashboardId": 3, "slice_id": 11},
            datasource_type="query",
        )
    )


# Native filter option queries


REAL_BODY: dict[str, Any] = {
    "filters": [],
    "extras": {"having": "", "where": ""},
    "applied_time_extras": {},
    "annotation_layers": [],
    "row_limit": 1000,
    "series_limit": 0,
    "order_desc": True,
    "url_params": {},
    "custom_params": {},
    "custom_form_data": {},
}


def native_body(
    filter_id: str,
    columns: list[Any],
    metrics: list[Any],
    query: dict[str, Any] | None = None,
    **form_data: Any,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """A native filter body shaped like ``buildQueryContext`` sends it."""
    return (
        [{**REAL_BODY, "columns": columns, "metrics": metrics, **(query or {})}],
        {
            "type": "NATIVE_FILTER",
            "native_filter_id": filter_id,
            "dashboardId": 3,
            **form_data,
        },
    )


def min_max(column: str) -> list[dict[str, Any]]:
    return [
        {
            "aggregate": aggregate,
            "column": {"column_name": column},
            "expressionType": "SIMPLE",
            "label": aggregate.lower(),
        }
        for aggregate in ("MIN", "MAX")
    ]


NATIVE_PASS = {
    "select": native_body(
        "NATIVE_FILTER-select", ["name"], [], {"orderby": [["name", True]]}
    ),
    "select without sort": native_body("NATIVE_FILTER-select", ["name"], []),
    "select with sort metric": native_body(
        "NATIVE_FILTER-sorted", ["name"], ["count"], {"orderby": [["count", False]]}
    ),
    "select with a time column": native_body(
        "NATIVE_FILTER-timed",
        ["name"],
        [],
        {"orderby": [["name", True]], "granularity": "ds", "time_range": "No filter"},
    ),
    "range": native_body("NATIVE_FILTER-range", [], min_max("value")),
}


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
@pytest.mark.parametrize("user", ["admin", "alpha", "rbac", "guest"])
@pytest.mark.parametrize("body", NATIVE_PASS)
def test_native_filter_option_queries_need_no_range(
    mocker: MockerFixture, dataset: Any, body: str, user: str
) -> None:
    from superset.time_range_limits.enforcement import native_filter_dashboard

    as_user(mocker, user)
    set_limits(mocker, policy(max_span=(90, "P1D")))
    dashboard = make_dashboard(native_filters=NATIVE_FILTERS)
    use_dashboards(mocker, dashboard)
    queries, form_data = NATIVE_PASS[body]
    context = make_context(queries, form_data)

    assert native_filter_dashboard(dataset, context.queries[0], form_data) == (
        dashboard,
        "value" if body == "range" else "name",
    )
    check(context)


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
@pytest.mark.parametrize("user", ["admin", "rbac"])
def test_native_filter_range_gets_the_dashboard_limit(
    mocker: MockerFixture, dataset: Any, user: str
) -> None:
    as_user(mocker, user)
    set_limits(mocker, policy(max_span=(90, "P1D")))
    use_dashboards(
        mocker,
        make_dashboard(
            limits=policy(max_span=(30, "P1D")), native_filters=NATIVE_FILTERS
        ),
    )
    queries, form_data = NATIVE_PASS["select"]
    queries = [{**queries[0], "filters": [tr("Last 60 days")]}]

    with pytest.raises(TimeRangeLimitError) as excinfo:
        check(make_context(queries, form_data))

    assert excinfo.value.error.extra["source"] == "dashboard"

    assert excinfo.value.error.extra["limit"] == {
        "quantity": 30,
        "time_grain": "P1D",
    }


NATIVE_FAIL = {
    "no dashboardId": native_body(
        "NATIVE_FILTER-select", ["name"], [], dashboardId=None
    ),
    "unknown filter id": native_body("NATIVE_FILTER-nope", ["name"], []),
    "another dashboard": native_body(
        "NATIVE_FILTER-select", ["name"], [], dashboardId=4
    ),
    "extra column": native_body("NATIVE_FILTER-select", ["name", "value"], []),
    "extra metric": native_body("NATIVE_FILTER-sorted", ["name"], ["count", "sum"]),
    "metric without sort metric": native_body(
        "NATIVE_FILTER-select", ["name"], ["count"]
    ),
    "min of another column": native_body("NATIVE_FILTER-range", [], min_max("name")),
    "plain chart": native_body("NATIVE_FILTER-select", ["name", "ds"], ["count"]),
    "is_timeseries + granularity": native_body(
        "NATIVE_FILTER-select",
        ["name"],
        [],
        {"granularity": "ds", "is_timeseries": True},
    ),
    "granularity not the filter's time column": native_body(
        "NATIVE_FILTER-timed", ["name"], [], {"granularity": "other_ts"}
    ),
    "adhoc SQL orderby": native_body(
        "NATIVE_FILTER-select",
        ["name"],
        [],
        {
            "orderby": [
                [{"expressionType": "SQL", "sqlExpression": "SUM(value)"}, False]
            ]
        },
    ),
    "series_limit_metric": native_body(
        "NATIVE_FILTER-select",
        ["name"],
        [],
        {
            "series_columns": ["name"],
            "series_limit": 5,
            "series_limit_metric": {
                "expressionType": "SQL",
                "sqlExpression": "SUM(value)",
                "label": "s",
            },
        },
    ),
    "extras.having": native_body(
        "NATIVE_FILTER-select",
        ["name"],
        [],
        {"extras": {"having": "SUM(value) > 10"}},
    ),
    "time_offsets": native_body(
        "NATIVE_FILTER-select", ["name"], [], {"time_offsets": ["1 year ago"]}
    ),
    "is_timeseries on the filter's time column": native_body(
        "NATIVE_FILTER-timed",
        ["name"],
        [],
        {"granularity": "ds", "is_timeseries": True},
    ),
    "series_columns": native_body(
        "NATIVE_FILTER-select", ["name"], [], {"series_columns": ["name"]}
    ),
    "series_limit": native_body(
        "NATIVE_FILTER-select", ["name"], [], {"series_limit": 5}
    ),
    "series_limit_metric alone": native_body(
        "NATIVE_FILTER-select", ["name"], [], {"series_limit_metric": "count"}
    ),
    "post_processing": native_body(
        "NATIVE_FILTER-select",
        ["name"],
        [],
        {"post_processing": [{"operation": "sort", "options": {"by": "name"}}]},
    ),
    "annotation_layers": native_body(
        "NATIVE_FILTER-select",
        ["name"],
        [],
        {
            "annotation_layers": [
                {"annotationType": "EVENT", "sourceType": "NATIVE", "value": 1}
            ]
        },
    ),
    "empty orderby item": native_body(
        "NATIVE_FILTER-select", ["name"], [], {"orderby": [[]]}
    ),
    "orderby on None": native_body(
        "NATIVE_FILTER-select", ["name"], [], {"orderby": [[None, True]]}
    ),
}


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
@pytest.mark.parametrize("body", NATIVE_FAIL)
def test_other_native_filter_bodies_need_a_range(
    mocker: MockerFixture, dataset: Any, body: str
) -> None:
    as_user(mocker, "admin")
    set_limits(mocker, policy(max_span=(90, "P1D")))
    use_dashboards(
        mocker,
        make_dashboard(native_filters=NATIVE_FILTERS),
        make_dashboard(dashboard_id=4),
    )
    queries, form_data = NATIVE_FAIL[body]

    assert reason_of(make_context(queries, form_data)) == "UNBOUNDED_RANGE"


def outcome(context: Any) -> str | None:
    try:
        check(context)
    except TimeRangeLimitError as ex:
        return (ex.error.extra or {})["reason_code"]
    return None


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
@pytest.mark.parametrize(
    "result_type", ["drill_detail", "samples", "results", "query", "post_processed"]
)
@pytest.mark.parametrize("per_query", [True, False])
@pytest.mark.parametrize("body", NATIVE_PASS)
def test_native_filter_exemption_is_for_full_results_only(
    mocker: MockerFixture, dataset: Any, body: str, per_query: bool, result_type: str
) -> None:
    as_user(mocker, "alpha")
    set_limits(mocker, policy(max_span=(90, "P1D")))
    use_dashboards(mocker, make_dashboard(native_filters=NATIVE_FILTERS))
    queries, form_data = NATIVE_PASS[body]

    def context(form: dict[str, Any], kind: str) -> Any:
        if per_query:
            return make_context([{**queries[0], "result_type": kind}], form)
        return make_context(queries, form, result_type=ChartDataResultType(kind))

    assert outcome(context(form_data, "full")) is None
    assert outcome(context({}, "full")) == "UNBOUNDED_RANGE"
    assert outcome(context(form_data, result_type)) == outcome(context({}, result_type))


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_native_filter_drill_detail_runs_no_sql(
    mocker: MockerFixture, client: Any, full_api_access: None, dataset: Any
) -> None:
    from superset.connectors.sqla.models import SqlaTable

    for name in ("raise_for_access", "get_rls_filters", "get_rls_cache_key"):
        mocker.patch.object(security_manager, name, return_value=[])
    as_user(mocker, "alpha")
    mocker.patch.object(SqlaTable, "get_sqla_row_level_filters", return_value=[])
    get_df = mocker.patch("superset.models.core.Database.get_df")
    use_dashboards(mocker, make_dashboard(native_filters=NATIVE_FILTERS))
    set_limits(mocker, policy(max_span=(90, "P1D")))
    queries, form_data = native_body(
        "NATIVE_FILTER-select", ["name"], [], {"row_offset": 1000}
    )

    response = client.post(
        "/api/v1/chart/data",
        json={
            "datasource": {"id": 7, "type": "table"},
            "queries": queries,
            "form_data": form_data,
            "result_format": "json",
            "result_type": "drill_detail",
        },
    )

    assert response.status_code == 400
    assert response.json["errors"][0]["extra"]["reason_code"] == "UNBOUNDED_RANGE"
    get_df.assert_not_called()


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
@pytest.mark.parametrize("user", ["admin", "alpha"])
def test_native_filter_exemption_is_for_datasets_only(
    mocker: MockerFixture, user: str
) -> None:
    from superset.time_range_limits.enforcement import native_filter_dashboard

    datasource = use_datasource(mocker, make_query_datasource())
    as_user(mocker, user)
    set_limits(mocker, policy(max_span=(90, "P1D")))
    use_dashboards(mocker, make_dashboard(native_filters=NATIVE_FILTERS))
    queries, form_data = NATIVE_PASS["select"]
    context = make_context(queries, form_data, datasource_type="query")

    assert native_filter_dashboard(datasource, context.queries[0], form_data) is None
    assert reason_of(context) == "UNBOUNDED_RANGE"


# Samples and drill to detail


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_samples_need_a_range(mocker: MockerFixture, dataset: Any) -> None:
    set_limits(mocker, policy(max_span=(90, "P1D")))

    for query in ({}, {"granularity": "ds", "time_range": "Last year"}):
        context = make_context([query], result_type=ChartDataResultType.SAMPLES)
        assert reason_of(context) == "UNBOUNDED_RANGE"


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_samples_range_on_another_column_is_checked(
    mocker: MockerFixture, dataset: Any
) -> None:
    set_limits(mocker, policy(max_span=(90, "P1D")))
    context = make_context(
        [{"filters": [tr("Last year", col="other_ts")]}],
        result_type=ChartDataResultType.SAMPLES,
    )

    assert reason_of(context) == "MAX_SPAN_EXCEEDED"


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_drill_detail_needs_a_range(mocker: MockerFixture, dataset: Any) -> None:
    set_limits(mocker, policy(max_span=(90, "P1D")))
    context = make_context([{}], result_type=ChartDataResultType.DRILL_DETAIL)

    assert reason_of(context) == "UNBOUNDED_RANGE"


# Which dashboard's limits apply


def chart_context(**form_data: Any) -> Any:
    return make_context(
        [{"filters": [tr("Last 60 days")], "metrics": ["count"]}], form_data
    )


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
@pytest.mark.parametrize(
    "user,form_data",
    [
        ("admin", {"dashboardId": 3, "slice_id": 11}),
        ("admin", {"dashboardId": "3", "slice_id": "11"}),
        ("alpha", {"dashboardId": 3, "slice_id": 11}),
        ("admin", {"dashboardId": 3}),
        ("alpha", {"dashboardId": 3, "slice_id": 0}),
        ("guest", {"dashboardId": 3}),
        ("rbac", {"dashboardId": 3}),
    ],
)
def test_dashboard_limit_applies(
    mocker: MockerFixture, dataset: Any, user: str, form_data: dict[str, Any]
) -> None:
    as_user(mocker, user)
    set_limits(mocker, policy(max_span=(90, "P1D")))
    use_dashboards(mocker, make_dashboard(limits=policy(max_span=(30, "P1D"))))

    with pytest.raises(TimeRangeLimitError) as excinfo:
        check(chart_context(**form_data))

    assert excinfo.value.error.message.startswith("Range can't be longer than 30 days.")


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
@pytest.mark.parametrize(
    "form_data,slices",
    [
        ({}, [(11, 7)]),
        ({"dashboardId": "abc", "slice_id": 11}, [(11, 7)]),
        ({"dashboardId": 2**70, "slice_id": 11}, [(11, 7)]),
        ({"dashboardId": 99, "slice_id": 11}, [(11, 7)]),
        ({"dashboardId": 3, "slice_id": 12}, [(11, 7)]),
        ({"dashboardId": 3}, [(11, 8)]),
        ({"dashboardId": 3, "slice_id": 11}, [(11, 8)]),
    ],
    ids=[
        "no id",
        "bad id",
        "huge id",
        "unknown id",
        "chart not on it",
        "no chart",
        "chart on another datasource",
    ],
)
@pytest.mark.parametrize("user", ["admin", "alpha"])
def test_dashboard_limit_ignored_for_users_with_dataset_access(
    mocker: MockerFixture,
    dataset: Any,
    form_data: dict[str, Any],
    slices: list[tuple[int, int]],
    user: str,
) -> None:
    as_user(mocker, user)
    set_limits(mocker, policy(max_span=(90, "P1D")))
    use_dashboards(
        mocker, make_dashboard(limits=policy(max_span=(30, "P1D")), slices=slices)
    )

    check(chart_context(**form_data))


UNREADABLE_DASHBOARD_IDS = [
    "5.0",
    "5e0",
    "5_0",
    "+5",
    " 5",
    "5abc",
    "\u0665",
    5.0,
    True,
    [5],
    {"id": 5},
    0,
    -5,
    2**31,
    "2147483648",
    "1" * 5000,
]


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
@pytest.mark.parametrize("dashboard_id", [5, "5", "05"])
@pytest.mark.parametrize("user", ["guest", "rbac"])
def test_readable_dashboard_id_gets_the_dashboard_limit(
    mocker: MockerFixture, dataset: Any, user: str, dashboard_id: Any
) -> None:
    as_user(mocker, user)
    set_limits(mocker, policy(max_span=(1, "P1Y")))
    find = use_dashboards(
        mocker, make_dashboard(5, limits=policy(max_span=(30, "P1D")))
    )
    last_6_months = make_context(
        [{"filters": [tr("Last 6 months")], "metrics": ["count"]}],
        {"dashboardId": dashboard_id},
    )

    with pytest.raises(TimeRangeLimitError) as excinfo:
        check(last_6_months)
    check(
        make_context(
            [{"filters": [tr("Last 2 weeks")], "metrics": ["count"]}],
            {"dashboardId": dashboard_id},
        )
    )

    error = excinfo.value.error
    assert error.extra["reason_code"] == "MAX_SPAN_EXCEEDED"
    assert error.extra["source"] == "dashboard"
    assert error.extra["dashboard_id"] == 5
    assert error.message.startswith("Range can't be longer than 30 days.")
    assert find.call_args.args == (5,)


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
@pytest.mark.parametrize("dashboard_id", UNREADABLE_DASHBOARD_IDS, ids=repr)
@pytest.mark.parametrize("user", ["guest", "rbac"])
def test_unreadable_dashboard_id_is_refused_for_dashboard_users(
    mocker: MockerFixture, dataset: Any, user: str, dashboard_id: Any
) -> None:
    as_user(mocker, user)
    set_limits(mocker, policy(max_span=(1, "P1Y")))
    find = use_dashboards(
        mocker, make_dashboard(5, limits=policy(max_span=(30, "P1D")))
    )

    with pytest.raises(TimeRangeLimitsUnavailableError) as excinfo:
        check(
            make_context(
                [{"filters": [tr("Last 6 months")], "metrics": ["count"]}],
                {"dashboardId": dashboard_id, "slice_id": 11},
            )
        )

    assert excinfo.value.status == 503
    extra = excinfo.value.error.extra
    assert extra["reason_code"] == "POLICY_UNAVAILABLE"
    assert extra["source"] == "dashboard"
    assert extra["field"] == "dashboardId"
    assert "value" not in extra
    find.assert_not_called()


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
@pytest.mark.parametrize("dashboard_id", [None, ""])
@pytest.mark.parametrize("user", ["guest", "rbac"])
def test_missing_dashboard_id_loads_no_dashboard(
    mocker: MockerFixture, dataset: Any, user: str, dashboard_id: Any
) -> None:
    as_user(mocker, user)
    set_limits(mocker, policy(max_span=(1, "P1Y")))
    find = use_dashboards(
        mocker, make_dashboard(5, limits=policy(max_span=(30, "P1D")))
    )

    check(chart_context(dashboardId=dashboard_id, slice_id=11))

    find.assert_not_called()


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
@pytest.mark.parametrize("dashboard_id", UNREADABLE_DASHBOARD_IDS, ids=repr)
@pytest.mark.parametrize("user", ["admin", "alpha"])
def test_unreadable_dashboard_id_is_ignored_with_dataset_access(
    mocker: MockerFixture, dataset: Any, user: str, dashboard_id: Any
) -> None:
    as_user(mocker, user)
    set_limits(mocker, policy(max_span=(1, "P1Y")))
    find = use_dashboards(
        mocker, make_dashboard(5, limits=policy(max_span=(30, "P1D")))
    )

    check(
        make_context(
            [{"filters": [tr("Last 6 months")], "metrics": ["count"]}],
            {"dashboardId": dashboard_id, "slice_id": 11},
        )
    )

    find.assert_not_called()


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_unreadable_dashboard_id_is_ignored_on_a_query_datasource(
    mocker: MockerFixture,
) -> None:
    use_datasource(mocker, make_query_datasource())
    as_user(mocker, "guest")
    set_limits(mocker, policy(max_span=(1, "P1Y")))
    find = use_dashboards(
        mocker, make_dashboard(5, limits=policy(max_span=(30, "P1D")))
    )

    check(
        make_context(
            [{"filters": [tr("Last 6 months")], "columns": ["name"]}],
            {"dashboardId": "5.0"},
            datasource_type="query",
        )
    )

    find.assert_not_called()


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_native_filter_query_with_an_unreadable_id_is_refused(
    mocker: MockerFixture, dataset: Any
) -> None:
    as_user(mocker, "guest")
    set_limits(mocker, policy(max_span=(1, "P1Y")))
    use_dashboards(
        mocker,
        make_dashboard(
            5, limits=policy(max_span=(30, "P1D")), native_filters=NATIVE_FILTERS
        ),
    )

    with pytest.raises(TimeRangeLimitsUnavailableError):
        check(
            make_context(
                *native_body("NATIVE_FILTER-select", ["name"], [], dashboardId="5.0")
            )
        )


# "now"


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_range_ending_now_passes_look_forward_zero_hours(
    mocker: MockerFixture, dataset: Any
) -> None:
    set_limits(mocker, policy(max_look_forward=(0, "PT1H")))

    check(
        make_context(
            [{"filters": [tr("2026-10-01 : now")], "metrics": ["count"]}],
        )
    )


# Parse errors keep Superset's status


@freeze_time(NOW)
@with_feature_flags(DATE_RANGE_TIMESHIFTS_ENABLED=True)
def test_inverted_date_range_offset_is_left_to_superset(dataset: Any) -> None:
    context = offset_context("2025-03-01 : 2025-01-01")
    df = pd.DataFrame({"name": ["a"], "count": [1]})
    with pytest.raises(QueryObjectValidationError):
        dataset.processing_time_offsets(df, context.queries[0])

    assert ranges_of(context) == [(datetime(2026, 7, 23), datetime(2026, 10, 21), None)]


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
@pytest.mark.parametrize(
    "result_type", [ChartDataResultType.COLUMNS, ChartDataResultType.TIMEGRAINS]
)
def test_columns_and_timegrains_are_never_checked(
    mocker: MockerFixture, dataset: Any, result_type: ChartDataResultType
) -> None:
    set_limits(mocker, policy(max_span=(1, "P1D")))
    context = make_context([{"filters": [tr("Last year")]}], {"dashboardId": 3})
    for query in context.queries:
        query.result_type = None
    context.result_type = result_type
    for target in (
        "superset.time_range_limits.enforcement.get_query_ranges",
        "superset.daos.dashboard.DashboardDAO.find_by_id",
    ):
        mocker.patch(target, side_effect=AssertionError(target))

    check(context)


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_bad_dashboard_limits_fail_closed(mocker: MockerFixture, dataset: Any) -> None:
    as_user(mocker, "admin")
    set_limits(mocker, None)
    use_dashboards(
        mocker,
        make_dashboard(json_metadata='{"time_range_limits": {"max_span": 9'),
    )

    with pytest.raises(TimeRangeLimitsUnavailableError):
        check(chart_context(dashboardId=3, slice_id=11))


# The contribution totals query: ensure_totals_available runs it whatever its type


CONTRIBUTION = {"operation": "contribution", "options": {"orientation": "column"}}


def contribution_context(
    totals: dict[str, Any], result_type: ChartDataResultType | None = None
) -> Any:
    return make_context(
        [
            {"metrics": ["count"], "columns": [], **totals},
            {
                "filters": [tr("Last week")],
                "metrics": ["count"],
                "columns": ["name"],
                "post_processing": [CONTRIBUTION],
            },
        ],
        result_type=result_type,
    )


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
@pytest.mark.parametrize("totals_type", ["columns", "timegrains", "samples"])
@pytest.mark.parametrize(
    "time_range,reason",
    [
        (None, "UNBOUNDED_RANGE"),
        ("Last 10 years", "MAX_SPAN_EXCEEDED"),
        ("Last 30 days", None),
    ],
)
def test_contribution_totals_query_is_checked_as_full(
    mocker: MockerFixture,
    dataset: Any,
    totals_type: str,
    time_range: str | None,
    reason: str | None,
) -> None:
    set_limits(mocker, policy(max_span=(90, "P1D")))
    filters = [tr(time_range)] if time_range else []
    context = contribution_context({"result_type": totals_type, "filters": filters})

    if reason:
        assert reason_of(context) == reason
    else:
        check(context)


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
@pytest.mark.parametrize(
    "time_range,reason", [(None, "UNBOUNDED_RANGE"), ("Last 30 days", None)]
)
def test_contribution_totals_query_is_checked_in_a_columns_context(
    mocker: MockerFixture, dataset: Any, time_range: str | None, reason: str | None
) -> None:
    set_limits(mocker, policy(max_span=(90, "P1D")))
    filters = [tr(time_range)] if time_range else []
    context = contribution_context(
        {"filters": filters}, result_type=ChartDataResultType.COLUMNS
    )

    if reason:
        assert reason_of(context) == reason
    else:
        check(context)


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_contribution_totals_query_never_gets_the_native_filter_exemption(
    mocker: MockerFixture, dataset: Any
) -> None:
    as_user(mocker, "admin")
    set_limits(mocker, policy(max_span=(90, "P1D")))
    use_dashboards(mocker, make_dashboard(native_filters=NATIVE_FILTERS))
    queries, form_data = NATIVE_PASS["range"]
    context = make_context(
        [
            *queries,
            {
                "filters": [tr("Last week")],
                "metrics": ["count"],
                "columns": ["name"],
                "post_processing": [CONTRIBUTION],
            },
        ],
        form_data,
    )

    assert reason_of(context) == "UNBOUNDED_RANGE"


UNRANGED_COLUMNS = {"result_type": "columns", "filters": []}
RANGED_TOTALS = {"metrics": ["count"], "columns": [], "filters": [tr("Last week")]}


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
@pytest.mark.parametrize(
    "first,second,reason",
    [
        (
            {**UNRANGED_COLUMNS, "metrics": ["count"], "columns": []},
            RANGED_TOTALS,
            "UNBOUNDED_RANGE",
        ),
        (
            {**UNRANGED_COLUMNS, "metrics": ["count"], "columns": ["name"]},
            {**RANGED_TOTALS, "result_type": "columns"},
            None,
        ),
        ({**UNRANGED_COLUMNS, "metrics": [], "columns": []}, RANGED_TOTALS, None),
        (
            {
                **UNRANGED_COLUMNS,
                "metrics": ["count"],
                "columns": [],
                "post_processing": [{"operation": "sort", "options": {"by": "count"}}],
            },
            RANGED_TOTALS,
            None,
        ),
    ],
    ids=["first candidate", "has columns", "no metrics", "has post_processing"],
)
def test_contribution_totals_query_is_the_first_candidate(
    mocker: MockerFixture,
    dataset: Any,
    first: dict[str, Any],
    second: dict[str, Any],
    reason: str | None,
) -> None:
    set_limits(mocker, policy(max_span=(90, "P1D")))
    context = make_context(
        [
            first,
            second,
            {
                "filters": [tr("Last week")],
                "metrics": ["count"],
                "columns": ["name"],
                "post_processing": [CONTRIBUTION],
            },
        ]
    )

    assert outcome(context) == reason


# A time grain on a TEMPORAL_RANGE: the SQL compares the truncated column

GRAINED = "2026-10-14T06:30:00 : 2026-10-21T06:31:17.500000"
SINCE = datetime(2026, 10, 14, 6, 30)
MIDNIGHT = datetime(2026, 10, 14)


def grained(time_range: str, grain: Any) -> dict[str, Any]:
    return {**tr(time_range), "grain": grain}


GRAIN_CASES: list[tuple[Any, datetime | None, datetime | None]] = [
    ("PT1S", SINCE, datetime(2026, 10, 21, 6, 31, 18)),
    ("PT5S", SINCE, datetime(2026, 10, 21, 6, 31, 20)),
    ("PT30S", SINCE, datetime(2026, 10, 21, 6, 31, 30)),
    ("PT1M", SINCE, datetime(2026, 10, 21, 6, 32)),
    ("PT5M", SINCE, datetime(2026, 10, 21, 6, 35)),
    ("PT10M", SINCE, datetime(2026, 10, 21, 6, 40)),
    ("PT15M", SINCE, datetime(2026, 10, 21, 6, 45)),
    ("PT30M", SINCE, datetime(2026, 10, 21, 7)),
    ("PT0.5H", SINCE, datetime(2026, 10, 21, 7)),
    ("PT1H", SINCE, datetime(2026, 10, 21, 7)),
    ("PT6H", SINCE, datetime(2026, 10, 21, 12)),
    ("P1D", MIDNIGHT, datetime(2026, 10, 22)),
    ("P1W", MIDNIGHT, datetime(2026, 10, 26)),
    ("1969-12-28T00:00:00Z/P1W", MIDNIGHT, datetime(2026, 10, 25)),
    ("1969-12-29T00:00:00Z/P1W", MIDNIGHT, datetime(2026, 10, 26)),
    ("P1W/1970-01-03T00:00:00Z", datetime(2026, 10, 11), datetime(2026, 10, 18)),
    ("P1W/1970-01-04T00:00:00Z", datetime(2026, 10, 12), datetime(2026, 10, 19)),
    ("P1M", MIDNIGHT, datetime(2026, 11, 1)),
    ("P3M", MIDNIGHT, datetime(2027, 1, 1)),
    ("P0.25Y", MIDNIGHT, datetime(2027, 1, 1)),
    ("P1Y", MIDNIGHT, datetime(2027, 1, 1)),
    ("P2W", None, None),
    (["P1D"], None, None),
]


def test_grain_cases_cover_every_time_grain() -> None:
    from superset.constants import TimeGrain

    assert {grain.value for grain in TimeGrain} <= {
        grain for grain, *_ in GRAIN_CASES if isinstance(grain, str)
    }


@pytest.mark.parametrize("grain,since,until", GRAIN_CASES)
def test_grain_widens_the_range_to_its_buckets(
    dataset: Any, grain: Any, since: datetime | None, until: datetime | None
) -> None:
    context = make_context([{"filters": [grained(GRAINED, grain)]}])

    assert ranges_of(context) == [(since, until, None)]


@pytest.mark.parametrize(
    "grain,time_range,since,until",
    [
        (
            "P1W",
            "2026-10-14T06:30:00 : 2026-10-25T06:30:00",
            MIDNIGHT,
            datetime(2026, 11, 1),
        ),
        (
            "P1M",
            "2026-10-01 : 2026-11-01",
            datetime(2026, 10, 1),
            datetime(2026, 11, 1),
        ),
        (
            "P1W/1970-01-03T00:00:00Z",
            "2026-10-17 : 2026-10-24",
            datetime(2026, 10, 11),
            datetime(2026, 10, 18),
        ),
        (
            "P1W/1970-01-03T00:00:00Z",
            "2026-10-17T06:30:00 : 2026-10-24",
            datetime(2026, 10, 11),
            datetime(2026, 10, 18),
        ),
    ],
    ids=[
        "P1W ends on a Sunday",
        "P1M on its boundaries",
        "week ending on boundaries",
        "week ending starts after midnight",
    ],
)
def test_grain_period_edges(
    dataset: Any, grain: str, time_range: str, since: datetime, until: datetime
) -> None:
    context = make_context([{"filters": [grained(time_range, grain)]}])

    assert ranges_of(context) == [(since, until, None)]


EDGE_RANGES = [
    "0001-01-01 : 0001-01-08",
    "0001-01-01T00:00:00 : 0001-01-01T12:00:00",
    "9999-12-01 : 9999-12-31",
    "9999-12-31T12:00:00 : 9999-12-31T23:59:59",
    "9999-03-01 : 9999-03-02",
]


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
@pytest.mark.parametrize("time_range", EDGE_RANGES)
@pytest.mark.parametrize("grain", [grain for grain, *_ in GRAIN_CASES])
def test_grain_at_the_calendar_edge_never_errors(
    mocker: MockerFixture, dataset: Any, grain: Any, time_range: str
) -> None:
    context = make_context(
        [{"filters": [grained(time_range, grain)], "metrics": ["count"]}]
    )

    set_limits(mocker, None)
    check(context)
    set_limits(mocker, policy(max_span=(400, "P1D")))
    try:
        check(context)
    except TimeRangeLimitError:
        pass


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_grain_past_the_calendar_edge_is_open(
    mocker: MockerFixture, dataset: Any
) -> None:
    set_limits(mocker, policy(max_span=(400, "P1D")))
    year_end = make_context([{"filters": [grained("9999-03-01 : 9999-03-02", "P1Y")]}])
    year_start = make_context([{"filters": [grained(EDGE_RANGES[0], "P1W")]}])

    assert ranges_of(year_end) == [OPEN]
    assert ranges_of(year_start) == [(None, datetime(1, 1, 14), None)]
    assert reason_of(year_end) == "UNBOUNDED_RANGE"
    assert reason_of(year_start) == "UNBOUNDED_RANGE"


@freeze_time(NOW)
def test_grain_past_the_calendar_edge_keeps_the_superset_response_without_limits(
    mocker: MockerFixture, client: Any, full_api_access: None, dataset: Any
) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.extensions import feature_flag_manager

    for name in ("raise_for_access", "get_rls_filters", "get_rls_cache_key"):
        mocker.patch.object(security_manager, name, return_value=[])
    mocker.patch.object(SqlaTable, "get_sqla_row_level_filters", return_value=[])
    mocker.patch(
        "superset.models.core.Database.get_df",
        return_value=pd.DataFrame({"count": [1]}),
    )
    set_limits(mocker, None)
    body = {
        "datasource": {"id": 7, "type": "table"},
        "queries": [
            {
                "filters": [grained("9999-03-01 : 9999-03-02", "P1Y")],
                "metrics": ["count"],
            }
        ],
        "result_format": "json",
        "result_type": "full",
    }
    flags = feature_flag_manager._feature_flags or {}

    def respond(flag: bool) -> Any:
        mocker.patch.object(
            feature_flag_manager,
            "get_feature_flags",
            return_value={**flags, FEATURE_FLAG: flag},
        )
        response = client.post("/api/v1/chart/data", json=body)
        return response.status_code, response.json["result"][0]["data"]

    assert respond(False) == (200, [{"count": 1}])
    assert respond(True) == respond(False)


@freeze_time(NOW)
@pytest.mark.parametrize("grain", ["P1D", "P1W", "P1M"])
def test_day_grain_rows_on_duckdb_start_at_the_checked_since(
    dataset: Any, grain: str
) -> None:
    import duckdb

    from superset.models.core import Database

    dataset.database = Database(
        id=1, database_name="duck", sqlalchemy_uri="duckdb:///:memory:"
    )
    context = make_context(
        [
            {
                "filters": [
                    grained("2025-07-03T23:52:16 : 2025-07-11T18:54:32", grain)
                ],
                "columns": ["ds"],
            }
        ]
    )
    [(since, _until, _offset)] = ranges_of(context)
    sql = dataset.get_query_str_extended(context.queries[0].to_dict()).sql
    connection = duckdb.connect()
    connection.execute("CREATE TABLE t (ds TIMESTAMP)")
    connection.execute(
        "INSERT INTO t VALUES ('2025-06-30 01:00:00'), ('2025-07-03 15:59:00')"
    )

    assert all(row[0] >= since for row in connection.execute(sql).fetchall())


@freeze_time(NOW)
def test_day_grain_on_a_postgres_date_column_starts_at_midnight(
    mocker: MockerFixture,
) -> None:
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.models.core import Database

    mocker.patch.object(security_manager, "get_guest_rls_filters", return_value=[])
    datasource = use_datasource(
        mocker,
        SqlaTable(
            id=7,
            table_name="t",
            main_dttm_col="ds",
            columns=[TableColumn(column_name="ds", is_dttm=1, type="DATE")],
            database=Database(
                id=1, database_name="pg", sqlalchemy_uri="postgresql+psycopg2://u@h/d"
            ),
        ),
    )
    context = make_context(
        [
            {
                "filters": [grained("2026-10-14T13:00:00 : 2026-10-16", "P1D")],
                "columns": ["ds"],
            }
        ]
    )
    sql = datasource.get_query_str_extended(context.queries[0].to_dict()).sql

    assert "TO_DATE('2026-10-14', 'YYYY-MM-DD')" in sql
    assert ranges_of(context) == [(MIDNIGHT, datetime(2026, 10, 16), None)]


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
@pytest.mark.parametrize(
    "time_range,grain,reason",
    [
        ("2026-01-01 : 2026-01-02", "P1Y", "MAX_SPAN_EXCEEDED"),
        ("2026-01-01 : 2026-01-02", "P1M", None),
        ("Last 90 days", "P1D", None),
        ("Last 30 days", "P2W", "UNBOUNDED_RANGE"),
    ],
)
def test_grain_is_checked_against_the_limits(
    mocker: MockerFixture,
    dataset: Any,
    time_range: str,
    grain: str,
    reason: str | None,
) -> None:
    set_limits(mocker, policy(max_span=(90, "P1D")))
    context = make_context(
        [{"filters": [grained(time_range, grain)], "metrics": ["count"]}]
    )

    if reason:
        assert reason_of(context) == reason
    else:
        check(context)


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_runtime_grain_keeps_the_limit(mocker: MockerFixture, dataset: Any) -> None:
    set_limits(mocker, policy(max_span=(90, "P1D")))
    limits = []
    for grain in ("P1D", "P1M"):
        for query in (
            {"filters": [grained("Last year", grain)]},
            {"filters": [tr("Last year")], "extras": {"time_grain_sqla": grain}},
        ):
            with pytest.raises(TimeRangeLimitError) as excinfo:
                check(make_context([{**query, "metrics": ["count"]}]))
            assert excinfo.value.error.extra["reason_code"] == "MAX_SPAN_EXCEEDED"
            limits.append(excinfo.value.error.extra["limit"])

    assert limits == [{"quantity": 90, "time_grain": "P1D"}] * 4


@freeze_time(NOW)
def test_grain_widens_the_time_comparison_ranges(dataset: Any) -> None:
    context = make_context(
        [
            {
                "filters": [grained("2026-01-01 : 2026-01-02", "P1Y")],
                "columns": ["name"],
                "metrics": ["count"],
                "time_offsets": ["1 year ago"],
            }
        ]
    )

    assert (datetime(2025, 1, 1), datetime(2026, 1, 1), "1 year ago") in ranges_of(
        context
    )


# Only a TEMPORAL_RANGE on a temporal column bounds the query


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
@pytest.mark.parametrize(
    "col", ["name", "value", "Name label"], ids=["text", "int", "verbose name"]
)
@pytest.mark.parametrize("with_ds", [False, True])
def test_range_on_a_non_temporal_column_bounds_nothing(
    mocker: MockerFixture, col: str, with_ds: bool
) -> None:
    mocker.patch.object(security_manager, "get_guest_rls_filters", return_value=[])
    use_datasource(mocker, make_dataset(verbose={"name": "Name label"}))
    set_limits(mocker, policy(max_span=(90, "P1D")))
    filters = [tr("Last week", col=col)] + ([tr("Last week")] if with_ds else [])
    context = make_context([{"filters": filters, "metrics": ["count"]}])

    if with_ds:
        assert ranges_of(context) == [LAST_WEEK]
        check(context)
    else:
        assert ranges_of(context) == [OPEN]
        assert reason_of(context) == "UNBOUNDED_RANGE"


@freeze_time(NOW)
def test_range_on_a_non_temporal_column_is_in_the_sql_but_not_counted(
    dataset: Any,
) -> None:
    context = make_context(
        [{"filters": [tr("Last week", col="name")], "metrics": ["count"]}]
    )

    assert sql_ranges(dataset, context.queries[0].to_dict()) == [LAST_WEEK]
    assert ranges_of(context) == [OPEN]


@freeze_time(NOW)
def test_name_match_wins_over_a_verbose_name(mocker: MockerFixture) -> None:
    mocker.patch.object(security_manager, "get_guest_rls_filters", return_value=[])
    use_datasource(mocker, make_dataset(verbose={"ds": "name"}))
    context = make_context([{"filters": [tr("Last week", col="name")]}])

    assert ranges_of(context) == [OPEN]


@freeze_time(NOW)
def test_first_column_wins_a_shared_verbose_name(mocker: MockerFixture) -> None:
    mocker.patch.object(security_manager, "get_guest_rls_filters", return_value=[])
    use_datasource(mocker, make_dataset(verbose={"name": "T", "ds": "T"}))
    context = make_context([{"filters": [tr("Last week", col="T")]}])

    assert ranges_of(context) == [OPEN]


# Time comparison errors keep Superset's status and body


TIME_COMPARISON_ERRORS: dict[str, tuple[dict[str, Any], list[Any]]] = {
    "no enclosed range": (
        {"columns": ["name"], "metrics": ["count"], "time_offsets": ["1 year ago"]},
        [None],
    ),
    "inverted date range": (
        {
            "filters": [tr("Last 30 days")],
            "columns": ["name"],
            "metrics": ["count"],
            "time_offsets": ["2025-03-01 : 2025-01-01"],
        },
        [None, policy(max_span=(90, "P1D"))],
    ),
}


@freeze_time(NOW)
@pytest.mark.parametrize("case", TIME_COMPARISON_ERRORS)
def test_time_comparison_errors_keep_the_superset_response(
    mocker: MockerFixture, client: Any, full_api_access: None, dataset: Any, case: str
) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.extensions import feature_flag_manager

    for name in ("raise_for_access", "get_rls_filters", "get_rls_cache_key"):
        mocker.patch.object(security_manager, name, return_value=[])
    mocker.patch.object(SqlaTable, "get_sqla_row_level_filters", return_value=[])
    mocker.patch(
        "superset.models.core.Database.get_df",
        return_value=pd.DataFrame({"name": ["a"], "count": [1]}),
    )
    query, limits_cases = TIME_COMPARISON_ERRORS[case]
    body = {
        "datasource": {"id": 7, "type": "table"},
        "queries": [query],
        "result_format": "json",
        "result_type": "full",
    }
    flags = feature_flag_manager._feature_flags or {}

    def respond(flag: bool, limits: dict[str, Any] | None) -> Any:
        mocker.patch.object(
            feature_flag_manager,
            "get_feature_flags",
            return_value={
                **flags,
                "DATE_RANGE_TIMESHIFTS_ENABLED": True,
                FEATURE_FLAG: flag,
            },
        )
        set_limits(mocker, limits)
        posted = client.post("/api/v1/chart/data", json=body)
        return (posted.status_code, posted.json)

    flag_off = respond(False, None)

    assert flag_off[0] >= 400
    assert flag_off[0] != 500
    for limits in limits_cases:
        assert respond(True, limits) == flag_off


# The SIP-40 error contract: TIME_RANGE_LIMIT_ERROR

UNBOUNDED_DASHBOARD_MESSAGE = (
    "This chart requires a bounded time range. Ask a dashboard editor to add or "
    "scope a time range filter."
)
EXAMPLE_RANGE = "2026-06-22T00:00:00 : 2026-09-14T10:30:00"


def limit_error(context: Any) -> Any:
    with pytest.raises(TimeRangeLimitError) as excinfo:
        check(context)
    error = excinfo.value.error
    assert error.error_type == "TIME_RANGE_LIMIT_ERROR"
    assert [code["code"] for code in error.extra["issue_codes"]] == [1042]
    return error


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_dashboard_span_error_has_the_full_extra(
    mocker: MockerFixture, dataset: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("TZ", "America/Sao_Paulo")
    as_user(mocker, "admin")
    set_limits(mocker, None)
    use_dashboards(mocker, make_dashboard(limits=policy(max_span=(9, "P1W"))))
    context = make_context(
        [{"filters": [tr(EXAMPLE_RANGE)], "metrics": ["count"]}],
        {"dashboardId": 3, "slice_id": 11},
    )

    error = limit_error(context)

    error.extra.pop("issue_codes")
    assert error.message == (
        "Range can't be longer than 9 weeks. This one is 12 weeks and 1 day."
    )
    assert error.extra == {
        "reason_code": "MAX_SPAN_EXCEEDED",
        "rule": "max_span",
        "source": "dashboard",
        "limit": {"quantity": 9, "time_grain": "P1W"},
        "actual": {
            "start": datetime(2026, 6, 22).astimezone().isoformat(),
            "end": datetime(2026, 9, 14, 10, 30).astimezone().isoformat(),
        },
        "timezone": "America/Sao_Paulo",
        "dashboard_id": 3,
        "filter_id": None,
        "time_offset": None,
    }


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_chart_data_api_returns_the_sip40_body_for_a_dashboard_chart(
    mocker: MockerFixture, client: Any, full_api_access: None, dataset: Any
) -> None:
    as_user(mocker, "admin")
    set_limits(mocker, None)
    use_dashboards(mocker, make_dashboard(limits=policy(max_span=(9, "P1W"))))
    mocker.patch.object(security_manager, "raise_for_access")
    run = mocker.patch(
        "superset.commands.chart.data.get_data_command.ChartDataCommand.run"
    )

    response = client.post(
        "/api/v1/chart/data",
        json={
            "datasource": {"id": 7, "type": "table"},
            "form_data": {"dashboardId": 3, "slice_id": 11},
            "queries": [{"filters": [tr(EXAMPLE_RANGE)], "metrics": ["count"]}],
            "result_format": "json",
            "result_type": "full",
        },
    )

    assert response.status_code == 400
    (error,) = response.json["errors"]
    assert error["error_type"] == "TIME_RANGE_LIMIT_ERROR"
    assert error["level"] == "error"
    extra = error["extra"]
    assert extra["reason_code"] == "MAX_SPAN_EXCEEDED"
    assert extra["rule"] == "max_span"
    assert extra["source"] == "dashboard"
    assert extra["limit"] == {"quantity": 9, "time_grain": "P1W"}
    assert re.fullmatch(r"2026-06-22T00:00:00[+-]\d\d:\d\d", extra["actual"]["start"])
    assert re.fullmatch(r"2026-09-14T10:30:00[+-]\d\d:\d\d", extra["actual"]["end"])
    assert extra["timezone"]
    assert extra["dashboard_id"] == 3
    assert extra["filter_id"] is None
    assert extra["time_offset"] is None
    assert extra["issue_codes"][0]["code"] == 1042
    run.assert_not_called()


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_timezone_falls_back_to_the_server_zone_name(
    mocker: MockerFixture, dataset: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("TZ", raising=False)
    set_limits(mocker, policy(max_span=(90, "P1D")))

    error = limit_error(
        make_context([{"filters": [tr("Last year")], "metrics": ["count"]}])
    )

    assert error.extra["timezone"] == datetime.now().astimezone().tzname()


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
@pytest.mark.parametrize(
    "global_limits,dashboard_limits,time_range,reason,rule,source,limit,on_dashboard",
    [
        (
            policy(max_look_back=(1, "P1M")),
            None,
            "2026-01-01 : 2026-02-01",
            "MAX_LOOK_BACK_EXCEEDED",
            "max_look_back",
            "global",
            {"quantity": 1, "time_grain": "P1M"},
            False,
        ),
        (
            policy(max_look_back=(1, "P1M")),
            None,
            "2026-01-01 : 2026-02-01",
            "MAX_LOOK_BACK_EXCEEDED",
            "max_look_back",
            "global",
            {"quantity": 1, "time_grain": "P1M"},
            True,
        ),
        (
            policy(max_look_forward=(0, "P1D")),
            None,
            "2026-10-01 : 2026-12-01",
            "MAX_LOOK_FORWARD_EXCEEDED",
            "max_look_forward",
            "global",
            {"quantity": 0, "time_grain": "P1D"},
            False,
        ),
        (
            policy(max_look_forward=(0, "P1D")),
            None,
            "2026-10-01 : 2026-12-01",
            "MAX_LOOK_FORWARD_EXCEEDED",
            "max_look_forward",
            "global",
            {"quantity": 0, "time_grain": "P1D"},
            True,
        ),
        (
            policy(max_look_back=(1, "P1Y")),
            policy(max_look_back=(1, "P1W")),
            "2026-10-01 : 2026-10-20",
            "MAX_LOOK_BACK_EXCEEDED",
            "max_look_back",
            "dashboard",
            {"quantity": 1, "time_grain": "P1W"},
            True,
        ),
        (
            policy(max_look_forward=(1, "P1Y")),
            policy(max_look_forward=(2, "PT1H")),
            "2026-10-01 : 2026-10-22",
            "MAX_LOOK_FORWARD_EXCEEDED",
            "max_look_forward",
            "dashboard",
            {"quantity": 2, "time_grain": "PT1H"},
            True,
        ),
    ],
    ids=[
        "global look-back, explore",
        "global look-back, dashboard without policy",
        "global look-forward, explore",
        "global look-forward, dashboard without policy",
        "dashboard look-back",
        "dashboard look-forward",
    ],
)
def test_look_back_and_forward_errors_name_rule_and_source(
    mocker: MockerFixture,
    dataset: Any,
    global_limits: dict[str, Any],
    dashboard_limits: dict[str, Any] | None,
    time_range: str,
    reason: str,
    rule: str,
    source: str,
    limit: dict[str, Any],
    on_dashboard: bool,
) -> None:
    as_user(mocker, "admin")
    set_limits(mocker, global_limits)
    use_dashboards(mocker, make_dashboard(limits=dashboard_limits))
    form_data = {"dashboardId": 3, "slice_id": 11} if on_dashboard else {}

    error = limit_error(
        make_context([{"filters": [tr(time_range)], "metrics": ["count"]}], form_data)
    )

    assert error.extra["reason_code"] == reason
    assert error.extra["rule"] == rule
    assert error.extra["source"] == source
    assert error.extra["limit"] == limit
    assert error.extra["dashboard_id"] == (3 if on_dashboard else None)
    assert error.extra["filter_id"] is None


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_explore_query_ignores_an_unverified_dashboard_id(
    mocker: MockerFixture, dataset: Any
) -> None:
    as_user(mocker, "admin")
    set_limits(mocker, policy(max_span=(90, "P1D")))
    use_dashboards(mocker, make_dashboard(limits=policy(max_span=(30, "P1D"))))

    error = limit_error(
        make_context(
            [{"filters": [tr("Last year")], "metrics": ["count"]}],
            {"dashboardId": 3, "slice_id": 12},
        )
    )

    assert error.extra["source"] == "global"
    assert error.extra["dashboard_id"] is None


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
@pytest.mark.parametrize(
    "filters,form_data,message",
    [
        ([], {"dashboardId": 3, "slice_id": 11}, UNBOUNDED_DASHBOARD_MESSAGE),
        (
            [tr("2026-10-01 : ")],
            {"dashboardId": 3, "slice_id": 11},
            UNBOUNDED_DASHBOARD_MESSAGE,
        ),
        ([], {}, "Choose a start and an end date. Time range limits are on."),
        (
            [tr("2026-10-01 : ")],
            {},
            "An end date is required.",
        ),
    ],
    ids=["dashboard", "dashboard, no end", "explore", "explore, no end"],
)
def test_unbounded_range_messages(
    mocker: MockerFixture,
    dataset: Any,
    filters: list[dict[str, Any]],
    form_data: dict[str, Any],
    message: str,
) -> None:
    as_user(mocker, "admin")
    set_limits(mocker, policy(max_span=(90, "P1D")))
    use_dashboards(mocker, make_dashboard())

    error = limit_error(
        make_context([{"filters": filters, "metrics": ["count"]}], form_data)
    )

    assert error.extra["reason_code"] == "UNBOUNDED_RANGE"
    assert error.extra["rule"] is None
    assert error.extra["source"] is None
    assert error.extra["limit"] is None
    assert error.extra["dashboard_id"] == (3 if form_data else None)
    assert error.message == message


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
@pytest.mark.parametrize(
    "filters,form_data,message",
    [
        (
            [],
            {"type": "NATIVE_FILTER", "dashboardId": 3},
            "Choose a start and an end date. Time range limits are on.",
        ),
        (
            [tr("2026-10-01 : ")],
            {"type": "NATIVE_FILTER", "dashboardId": 3},
            "An end date is required.",
        ),
        (
            [],
            {
                "type": "NATIVE_FILTER",
                "native_filter_id": "NATIVE_FILTER-missing",
                "dashboardId": 3,
            },
            UNBOUNDED_DASHBOARD_MESSAGE,
        ),
        ([], {"dashboardId": 3}, UNBOUNDED_DASHBOARD_MESSAGE),
        (
            [],
            {"type": "CHART_CUSTOMIZATION", "dashboardId": 3},
            UNBOUNDED_DASHBOARD_MESSAGE,
        ),
    ],
    ids=[
        "new filter preview",
        "new filter preview, no end",
        "with a filter id",
        "no type",
        "chart customization",
    ],
)
def test_a_new_filter_preview_gets_the_editor_message(
    mocker: MockerFixture,
    dataset: Any,
    filters: list[dict[str, Any]],
    form_data: dict[str, Any],
    message: str,
) -> None:
    as_user(mocker, "admin")
    set_limits(mocker, policy(max_span=(90, "P1D")))
    use_dashboards(mocker, make_dashboard(native_filters=NATIVE_FILTERS))

    error = limit_error(
        make_context([{"filters": filters, "metrics": ["count"]}], form_data)
    )

    assert error.extra["reason_code"] == "UNBOUNDED_RANGE"
    assert error.extra["dashboard_id"] == 3
    assert error.message == message


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_a_query_context_without_form_data_keeps_the_message(
    mocker: MockerFixture, dataset: Any
) -> None:
    as_user(mocker, "admin")
    set_limits(mocker, policy(max_span=(90, "P1D")))
    context = make_context([{"filters": [], "metrics": ["count"]}])
    context.form_data = None

    error = limit_error(context)

    assert error.extra["reason_code"] == "UNBOUNDED_RANGE"
    assert error.extra["dashboard_id"] is None
    assert error.message == (
        "Choose a start and an end date. Time range limits are on."
    )


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_impossible_policy_is_no_valid_range(
    mocker: MockerFixture, dataset: Any
) -> None:
    as_user(mocker, "admin")
    set_limits(mocker, None)
    use_dashboards(
        mocker,
        make_dashboard(
            limits=policy(max_look_back=(0, "PT1H"), max_look_forward=(0, "PT1H"))
        ),
    )

    error = limit_error(chart_context(dashboardId=3, slice_id=11))

    assert error.extra["reason_code"] == "NO_VALID_RANGE"
    assert error.extra["rule"] is None
    assert error.extra["source"] is None
    assert error.extra["limit"] is None
    assert error.extra["dashboard_id"] == 3


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON, DATE_RANGE_TIMESHIFTS_ENABLED=True)
def test_time_comparison_error_has_the_contract(
    mocker: MockerFixture, dataset: Any
) -> None:
    set_limits(mocker, policy(max_look_back=(13, "P1M")))

    error = limit_error(offset_context("2 years ago"))

    assert error.message.startswith('Time comparison "2 years ago": ')
    assert error.extra["reason_code"] == "MAX_LOOK_BACK_EXCEEDED"
    assert error.extra["rule"] == "max_look_back"
    assert error.extra["time_offset"] == "2 years ago"
    assert error.extra["actual"]["start"].startswith("2024-07-23T00:00:00")


# The ranges of several filters on one column are combined

LAST_30_DAYS = (datetime(2026, 9, 21), datetime(2026, 10, 21), None)
BASE_AXIS = {
    "label": "ds",
    "sqlExpression": "ds",
    "columnType": "BASE_AXIS",
    "timeGrain": "P1D",
}


def combined_context(
    filters: list[dict[str, Any]],
    form_data: dict[str, Any] | None = None,
    **query: Any,
) -> Any:
    return make_context(
        [{"columns": ["name"], "metrics": ["count"], "filters": filters, **query}],
        form_data,
    )


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
@pytest.mark.parametrize(
    "filters,expected",
    [
        pytest.param(
            [tr("No filter"), tr("Last 30 days")], [LAST_30_DAYS], id="B1 No filter"
        ),
        pytest.param(
            [tr("Last 6 months"), tr("Last 30 days")],
            [LAST_30_DAYS],
            id="B2 Last 6 months",
        ),
        pytest.param(
            [tr("2026-01-01 : 2026-03-31"), tr("2026-03-01 : 2026-05-31")],
            [(datetime(2026, 3, 1), datetime(2026, 3, 31), None)],
            id="B3 Jan-Mar and Mar-May",
        ),
        pytest.param(
            [tr("2026-09-01 : "), tr(" : 2026-10-01")],
            [(datetime(2026, 9, 1), datetime(2026, 10, 1), None)],
            id="B6 two half-open",
        ),
        pytest.param(
            [tr("No filter"), tr("Last 30 days", col="other_ts")],
            [LAST_30_DAYS],
            id="C1 No filter on another column",
        ),
    ],
)
def test_overlap_within_the_limits_passes(
    mocker: MockerFixture,
    dataset: Any,
    filters: list[dict[str, Any]],
    expected: list[Any],
) -> None:
    set_limits(mocker, policy(max_span=(90, "P1D")))
    context = combined_context(filters)

    assert ranges_of(context) == expected
    assert sql_overlap(dataset, context.queries[0].to_dict()) == expected
    check(context)


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_overlap_over_the_limit_names_the_overlap(
    mocker: MockerFixture, dataset: Any
) -> None:
    set_limits(mocker, policy(max_span=(90, "P1D")))
    context = combined_context([tr("Last 6 months"), tr("Last 4 months")])

    error = limit_error(context)

    assert error.extra["reason_code"] == "MAX_SPAN_EXCEEDED"
    assert error.extra["actual"]["start"].startswith("2026-06-21T00:00:00")
    assert error.extra["actual"]["end"].startswith("2026-10-21T00:00:00")


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
@pytest.mark.parametrize(
    "filters,reason",
    [
        pytest.param(
            [tr("Last 30 days"), tr("Last 6 months", col="other_ts")],
            "MAX_SPAN_EXCEEDED",
            id="C2 each column is checked",
        ),
        pytest.param(
            [tr("2026-06-01 : "), tr("Last 30 days", col="other_ts")],
            "UNBOUNDED_RANGE",
            id="half-open column next to a closed one",
        ),
    ],
)
def test_every_bounded_column_is_checked(
    mocker: MockerFixture, dataset: Any, filters: list[dict[str, Any]], reason: str
) -> None:
    set_limits(mocker, policy(max_span=(90, "P1D")))

    assert reason_of(combined_context(filters)) == reason


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_time_column_bounds_join_its_filters(
    mocker: MockerFixture, dataset: Any
) -> None:
    set_limits(mocker, policy(max_span=(90, "P1D")))
    context = make_context(
        [
            {
                "columns": [
                    {**BASE_AXIS, "label": "other_ts", "sqlExpression": "other_ts"}
                ],
                "metrics": ["count"],
                "filters": [tr("Last 6 months"), tr("Last 30 days", col="other_ts")],
                "granularity": "ds",
            }
        ],
        {"x_axis": "other_ts"},
    )

    assert ranges_of(context) == [LAST_30_DAYS]
    assert sql_overlap(dataset, context.queries[0].to_dict()) == [LAST_30_DAYS]
    check(context)


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
@pytest.mark.parametrize(
    "filters,reason",
    [
        pytest.param(
            [tr("2026-01-01 : 2026-02-01"), tr("2026-03-01 : 2026-04-01")],
            None,
            id="B5 January and March",
        ),
        pytest.param(
            [tr("2026-01-01 : 2026-02-01"), tr("2026-02-01 : 2026-03-01")],
            None,
            id="adjacent months",
        ),
        pytest.param(
            [tr(" : 2026-10-01"), tr("2026-10-01 : ")],
            None,
            id="zero-length overlap",
        ),
        pytest.param(
            [tr("2024-01-01 : 2024-02-01"), tr("2024-03-01 : 2024-04-01")],
            "MAX_LOOK_BACK_EXCEEDED",
            id="E1 both too far back",
        ),
        pytest.param(
            [tr("2026-01-01 : 2026-02-01"), tr("2026-06-01 : ")],
            "UNBOUNDED_RANGE",
            id="E2 January and half-open June",
        ),
    ],
)
def test_empty_overlap_checks_each_range_alone(
    mocker: MockerFixture,
    dataset: Any,
    filters: list[dict[str, Any]],
    reason: str | None,
) -> None:
    set_limits(mocker, policy(max_span=(90, "P1D"), max_look_back=(1, "P1Y")))

    assert outcome(combined_context(filters)) == reason


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
@pytest.mark.parametrize("datetime_index", [True, False])
@pytest.mark.parametrize(
    "filters",
    [
        pytest.param([tr("Last 6 months"), tr("Last 30 days")], id="Q4a"),
        pytest.param([tr("No filter"), tr("Last 30 days")], id="Q4b"),
    ],
)
def test_time_comparison_reshifts_are_combined(
    mocker: MockerFixture,
    dataset: Any,
    filters: list[dict[str, Any]],
    datetime_index: bool,
) -> None:
    from superset.commands.chart.exceptions import TimeRangeParseFailError

    set_limits(mocker, policy(max_span=(90, "P1D")))
    context = combined_context(
        filters,
        columns=[BASE_AXIS] if datetime_index else ["name"],
        time_offsets=["1 year ago"],
    )
    check(context)

    query = offset_query(mocker, dataset, context.queries[0], datetime_index)
    if not datetime_index and filters[0]["val"] == "No filter":
        with pytest.raises(TimeRangeParseFailError):
            sql_overlap(dataset, query)
        return
    checked = [r[:2] for r in ranges_of(context) if r[2] == "1 year ago"]
    for since, until, _ in sql_overlap(dataset, query):
        assert any(start <= since and until <= end for start, end in checked), (
            since,
            until,
        )


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
@pytest.mark.parametrize("datetime_index", [True, False])
def test_time_comparison_helper_is_checked_alone(
    mocker: MockerFixture, dataset: Any, datetime_index: bool
) -> None:
    set_limits(mocker, policy(max_span=(90, "P1D")))
    context = combined_context(
        [tr("Last 30 days"), tr("Last 6 months")],
        columns=[BASE_AXIS] if datetime_index else ["name"],
        time_offsets=["1 year ago"],
    )

    error = limit_error(context)

    assert error.extra["reason_code"] == "MAX_SPAN_EXCEEDED"
    assert error.extra["time_offset"] == "1 year ago"
    assert error.extra["actual"]["start"].startswith("2025-04-21T00:00:00")


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
@pytest.mark.parametrize(
    "filters,reason",
    [
        pytest.param(
            [{**tr("Last 90 days"), "grain": "P1M"}],
            "MAX_SPAN_EXCEEDED",
            id="Q5a grain alone",
        ),
        pytest.param(
            [tr("Last 6 months"), {**tr("2026-08-15 : 2026-10-15"), "grain": "P1M"}],
            None,
            id="Q5b",
        ),
        pytest.param(
            [
                {**tr("2026-07-01 : 2026-10-01"), "grain": "P1M"},
                tr("2026-07-15 : 2026-10-10"),
            ],
            None,
            id="Q5c",
        ),
    ],
)
def test_grain_is_applied_before_combining(
    mocker: MockerFixture,
    dataset: Any,
    filters: list[dict[str, Any]],
    reason: str | None,
) -> None:
    set_limits(mocker, policy(max_span=(90, "P1D")))

    assert outcome(combined_context(filters)) == reason


TEMPLATED_METRIC = (
    "SUM(CASE WHEN ds >= "
    "{{ get_time_filter('ds', remove_filter=True).from_expr or \"'1900-01-01'\" }} "
    "THEN 1 END)"
)
TEMPLATED_COLUMN = "'{{ get_time_filter('ds', remove_filter=True).time_range }}'"


def add_template(dataset: Any, where: str, template: str) -> None:
    from superset.connectors.sqla.models import SqlMetric, TableColumn

    if where == "sql":
        dataset.sql = template
    elif where == "metric":
        dataset.metrics.append(SqlMetric(metric_name="templated", expression=template))
    else:
        dataset.columns.append(TableColumn(column_name="win", expression=template))


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
@pytest.mark.parametrize(
    "where,template,filters,reason",
    [
        pytest.param(
            "sql",
            "SELECT * FROM t WHERE ds >= "
            "{{ get_time_filter('ds', remove_filter=True).from_expr }}",
            [tr("No filter"), tr("Last 30 days")],
            "UNBOUNDED_RANGE",
            id="J1 expression",
        ),
        pytest.param(
            "sql",
            "SELECT * FROM t {% if 1 %}WHERE 1 = 1{% endif %}",
            [tr("No filter"), tr("Last 30 days")],
            "UNBOUNDED_RANGE",
            id="statement",
        ),
        pytest.param(
            "sql",
            "SELECT * FROM t",
            [tr("No filter"), tr("Last 30 days")],
            None,
            id="no template",
        ),
        pytest.param(
            "metric",
            TEMPLATED_METRIC,
            [tr("No filter"), tr("Last 30 days")],
            "UNBOUNDED_RANGE",
            id="saved metric",
        ),
        pytest.param(
            "column",
            TEMPLATED_COLUMN,
            [tr("No filter"), tr("Last 30 days")],
            "UNBOUNDED_RANGE",
            id="calculated column",
        ),
        pytest.param(
            "metric",
            TEMPLATED_METRIC,
            [tr("Last 6 months"), tr("Last 30 days")],
            "MAX_SPAN_EXCEEDED",
            id="J-metric 2",
        ),
        pytest.param(
            "metric",
            "{% if 1 %}COUNT(*){% endif %}",
            [tr("No filter"), tr("Last 30 days")],
            "UNBOUNDED_RANGE",
            id="saved metric statement",
        ),
    ],
)
def test_templated_dataset_checks_each_range_alone(
    mocker: MockerFixture,
    dataset: Any,
    where: str,
    template: str,
    filters: list[dict[str, Any]],
    reason: str | None,
) -> None:
    set_limits(mocker, policy(max_span=(90, "P1D")))
    add_template(dataset, where, template)

    assert outcome(combined_context(filters)) == reason


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_query_datasource_without_metrics_is_combined(mocker: MockerFixture) -> None:
    use_datasource(mocker, make_query_datasource())
    set_limits(mocker, policy(max_span=(90, "P1D")))

    context = make_context(
        [{"columns": ["name"], "filters": [tr("No filter"), tr("Last 30 days")]}],
        datasource_type="query",
    )

    assert ranges_of(context) == [LAST_30_DAYS]
    check(context)


@pytest.mark.parametrize(
    "datasource,templated",
    [
        pytest.param(SimpleNamespace(), False, id="no sql, columns or metrics"),
        pytest.param(SimpleNamespace(sql="{{ 1 }}"), True, id="sql only"),
        pytest.param(
            SimpleNamespace(columns=None, metrics=None), False, id="None lists"
        ),
        pytest.param(
            SimpleNamespace(columns=[SimpleNamespace(expression=None)]),
            False,
            id="column without expression",
        ),
        pytest.param(
            SimpleNamespace(columns=[SimpleNamespace()]),
            False,
            id="column with no expression attribute",
        ),
        pytest.param(
            SimpleNamespace(metrics=[SimpleNamespace(expression=123)]),
            False,
            id="metric expression that isn't text",
        ),
    ],
)
def test_is_templated_without_columns_or_metrics(
    datasource: Any, templated: bool
) -> None:
    from superset.time_range_limits.enforcement import _is_templated

    assert _is_templated(datasource) is templated


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON, ENABLE_TEMPLATE_PROCESSING=True)
@pytest.mark.parametrize(
    "where,template,query,filters,reason",
    [
        pytest.param(
            "metric",
            TEMPLATED_METRIC,
            {"columns": ["name"], "metrics": ["templated"]},
            [tr("No filter"), tr("Last 30 days")],
            "UNBOUNDED_RANGE",
            id="J-metric",
        ),
        pytest.param(
            "column",
            TEMPLATED_COLUMN,
            {"columns": ["win"], "metrics": ["count"]},
            [tr("No filter"), tr("Last 30 days")],
            "UNBOUNDED_RANGE",
            id="J-column",
        ),
        pytest.param(
            "metric",
            TEMPLATED_METRIC,
            {"columns": ["name"], "metrics": ["templated"]},
            [tr("Last 6 months"), tr("Last 30 days")],
            "MAX_SPAN_EXCEEDED",
            id="J-metric 2",
        ),
        pytest.param(
            "sql",
            "SELECT * FROM t WHERE ds >= {{ get_time_filter('ds', "
            "remove_filter=True).from_expr or \"'1900-01-01'\" }}",
            {"columns": ["name"], "metrics": ["count"]},
            [tr("No filter"), tr("Last 30 days")],
            "UNBOUNDED_RANGE",
            id="J1 control",
        ),
    ],
)
def test_template_removing_the_time_filter_checks_each_range_alone(
    mocker: MockerFixture,
    app: Any,
    dataset: Any,
    where: str,
    template: str,
    query: dict[str, Any],
    filters: list[dict[str, Any]],
    reason: str | None,
) -> None:
    set_limits(mocker, policy(max_span=(90, "P1D")))
    add_template(dataset, where, template)
    query = {**query, "filters": filters}

    with app.test_request_context(json={"queries": [query]}):
        context = make_context([query])

        assert sql_column_ranges(dataset, context.queries[0].to_dict()) == []
        assert outcome(context) == reason


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON, DATE_RANGE_TIMESHIFTS_ENABLED=True)
def test_open_column_is_kept_next_to_the_time_comparison_helper(
    mocker: MockerFixture, dataset: Any
) -> None:
    set_limits(mocker, policy(max_span=(90, "P1D")))
    context = combined_context(
        [tr("No filter"), tr("Last week", col="nope")], time_offsets=["1 year ago"]
    )

    assert ranges_of(context)[0] == OPEN
    assert reason_of(context) == "UNBOUNDED_RANGE"


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
@pytest.mark.parametrize(
    "query,form_data,reason",
    [
        pytest.param(
            {"filters": [tr("Last 6 months")], "time_range": "Last 30 days"},
            {},
            None,
            id="A1 two native time range filters",
        ),
        pytest.param(
            {"filters": [tr("Last 30 days")]}, {}, None, id="A2 native No filter"
        ),
        pytest.param(
            {"filters": [tr("No filter")], "time_range": "Last 30 days"},
            {},
            None,
            id="A3 chart No filter",
        ),
        pytest.param(
            {"filters": [tr("Last 30 days")], "granularity": "other_ts"},
            {},
            None,
            id="D1 Time Column on another column",
        ),
        pytest.param(
            {
                "filters": [tr("Last 30 days")],
                "granularity": "ds",
                "time_range": "Last 6 months",
            },
            {},
            "MAX_SPAN_EXCEEDED",
            id="D3 legacy granularity",
        ),
        pytest.param(
            {
                "filters": [tr("Last 6 months"), tr("Last 30 days", col="other_ts")],
                "granularity": "ds",
                "columns": ["other_ts", "name"],
                "time_range": "Last 7 days",
            },
            {"x_axis": "other_ts"},
            None,
            id="D4 Time Column and native Time Range",
        ),
    ],
)
def test_native_filter_shapes_are_unchanged(
    mocker: MockerFixture,
    dataset: Any,
    query: dict[str, Any],
    form_data: dict[str, Any],
    reason: str | None,
) -> None:
    set_limits(mocker, policy(max_span=(90, "P1D")))

    assert (
        outcome(
            make_context(
                [{"columns": ["name"], "metrics": ["count"], **query}], form_data
            )
        )
        == reason
    )


# Chart Jinja that removes a time filter

GT = "get_time_filter('ds', remove_filter=True)"
GF = "get_filters('ds', remove_filter=True)"
FV = "filter_values('ds', remove_filter=True)"
JINJA_FLAGS = {**FLAG_ON, "ENABLE_TEMPLATE_PROCESSING": True}
# A removing call that only a second render of the order-by text runs.
SECOND_RENDER = (
    'COUNT(*) + LENGTH(\'{% raw %}{% if get_filters("ds", remove_filter=True) %}'
    "{% endif %}{% endraw %}')"
)
DS_30_DAYS = [tr("Last 30 days"), tr("Last 30 days", "other_ts")]
DS_6_MONTHS = [tr("Last 6 months"), tr("Last 30 days", "other_ts")]
DS_ADHOC = {
    "expressionType": "SIMPLE",
    "clause": "WHERE",
    "subject": "ds",
    "operator": "TEMPORAL_RANGE",
    "comparator": "Last 30 days",
}


def sql_metric(expression: str, label: str = "m") -> dict[str, Any]:
    return {"expressionType": "SQL", "sqlExpression": expression, "label": label}


def sql_column(expression: str, label: str = "x", **extra: Any) -> dict[str, Any]:
    return {
        "expressionType": "SQL",
        "sqlExpression": expression,
        "label": label,
        **extra,
    }


def removing(call: str) -> str:
    return "COUNT(*) {% if " + call + " %}{% endif %}"


def removing_if(condition: str) -> str:
    return "COUNT(*) {% if " + condition + " %}{{ " + GF + " }}{% endif %}"


def chart_query(**query: Any) -> dict[str, Any]:
    return {
        "columns": ["name"],
        "metrics": [sql_metric("COUNT(*)")],
        "filters": [tr("Last 30 days")],
        **query,
    }


def in_place(place: str, call: str) -> dict[str, Any]:
    jinja = "{% if " + call + " %}{% endif %}"
    if place == "metric":
        return chart_query(metrics=[sql_metric(f"COUNT(*) {jinja}")])
    if place == "adhoc column":
        return chart_query(columns=[sql_column(f"name {jinja}")])
    if place == "group-by expression":
        return chart_query(columns=[f"upper(name) {jinja}"])
    if place == "order-by":
        return chart_query(orderby=[[sql_metric(f"COUNT(*) {jinja}", "o"), False]])
    return chart_query(
        filters=[
            {"col": sql_column(f"name {jinja}"), "op": "IS NOT NULL"},
            tr("Last 30 days"),
        ]
    )


@pytest.fixture
def chart(mocker: MockerFixture) -> Any:
    mocker.patch.object(security_manager, "get_guest_rls_filters", return_value=[])
    mocker.patch.object(security_manager, "get_rls_filters", return_value=[])
    mocker.patch.object(security_manager, "get_rls_cache_key", return_value=[])
    mocker.patch.object(security_manager, "raise_for_access")
    set_limits(mocker, policy(max_span=(90, "P1D")))
    return use_datasource(mocker, make_dataset())


def run_chart(
    mocker: MockerFixture,
    datasource: Any,
    queries: list[dict[str, Any]],
    result_type: ChartDataResultType | None = None,
    form_data: dict[str, Any] | None = None,
    request: dict[str, Any] | None = None,
) -> tuple[str | None, int, str]:
    """
    The reason code the chart data API gives, how many queries ran on the
    datasource, and the SQL Superset builds for the first query (or its error).

    The request (a JSON body unless ``request`` gives the request arguments) also
    carries a ``TEMPORAL_RANGE`` adhoc filter on ``ds``, which ``get_time_filter``
    needs to remove its filter. Checks the limit changes no query object.
    """
    import copy

    from superset.connectors.sqla.models import SqlaTable

    ran = mocker.spy(SqlaTable, "query")
    mocker.patch.object(
        type(datasource.database),
        "get_df",
        return_value=pd.DataFrame({"name": ["a"], "x": ["a"], "m": [1], "o": [1]}),
    )
    body = {
        "queries": [{**queries[0], "adhoc_filters": [DS_ADHOC]}, *queries[1:]],
        "form_data": form_data or {},
    }
    with current_app.test_request_context(**(request or {"json": body})):
        context = make_context(copy.deepcopy(queries), form_data, result_type)
        before = [copy.deepcopy(query.to_dict()) for query in context.queries]
        reason = outcome(context)
        assert [query.to_dict() for query in context.queries] == before
        try:
            context.raise_for_access()
            context.get_payload()
        except Exception:  # noqa: BLE001, S110
            pass
        count = ran.call_count
        try:
            sql = " ".join(
                datasource.get_query_str_extended(
                    context.queries[0].to_dict(), mutate=False
                ).sql.split()
            )
        except Exception as ex:  # noqa: BLE001
            sql = f"{type(ex).__name__}: {ex}"
    return reason, count, sql


def bounded_columns(sql: str) -> set[str]:
    where = re.search(r"WHERE (.*?)(?: GROUP BY| ORDER BY| LIMIT|$)", sql)
    return set(re.findall(r"(\w+) >= '", where.group(1) if where else ""))


@freeze_time(NOW)
@with_feature_flags(**JINJA_FLAGS)
@pytest.mark.parametrize("call", [GT, GF, FV], ids=lambda call: call.split("(")[0])
@pytest.mark.parametrize(
    "place",
    ["metric", "adhoc column", "group-by expression", "order-by", "filter column"],
)
def test_chart_jinja_removing_the_time_filter_is_unbounded(
    mocker: MockerFixture, chart: Any, place: str, call: str
) -> None:
    reason, ran, sql = run_chart(mocker, chart, [in_place(place, call)])

    assert reason == "UNBOUNDED_RANGE"
    assert ran == 0
    if place != "order-by":
        assert "ds" not in bounded_columns(sql)


@freeze_time(NOW)
@with_feature_flags(**JINJA_FLAGS)
def test_j2_printed_get_filters(mocker: MockerFixture, chart: Any) -> None:
    query = chart_query(metrics=[sql_metric("COUNT(*) {{ " + GF + " }}")])

    reason, ran, sql = run_chart(mocker, chart, [query])

    assert (reason, ran) == ("UNBOUNDED_RANGE", 0)
    assert " WHERE " not in sql


@freeze_time(NOW)
@with_feature_flags(**JINJA_FLAGS)
@pytest.mark.parametrize(
    "query",
    [
        pytest.param(
            chart_query(
                columns=[
                    sql_column(
                        "{{ \"~get_filters('ds',True)~\" }}",
                        "n",
                        isColumnReference=True,
                    )
                ]
            ),
            id="NEW-a column reference",
        ),
        pytest.param(
            {
                "columns": ["{{ \"~get_filters('ds',True)~\" }}"],
                "filters": [tr("Last 30 days")],
            },
            id="NEW-e raw columns",
        ),
    ],
)
def test_quoted_texts_are_read_as_superset_renders_them(
    mocker: MockerFixture, chart: Any, query: dict[str, Any]
) -> None:
    reason, ran, sql = run_chart(mocker, chart, [query])

    assert (reason, ran) == ("UNBOUNDED_RANGE", 0)
    assert "ds" not in bounded_columns(sql)


@freeze_time(NOW)
@with_feature_flags(**JINJA_FLAGS)
@pytest.mark.parametrize(
    "call,reason",
    [
        ("get_time_filter('ds', None, None, None, True)", "UNBOUNDED_RANGE"),
        ("get_filters('ds', True)", "UNBOUNDED_RANGE"),
        ("filter_values('ds', None, True)", "UNBOUNDED_RANGE"),
        ("get_filters('ds', remove_filter=False)", None),
        ("get_filters('ds')", None),
        ("get_filters('ds', False)", None),
        ("get_time_filter('ds', remove_filter=None)", None),
        ("filter_values('ds', None, 0)", None),
    ],
)
def test_positional_and_false_forms(
    mocker: MockerFixture, chart: Any, call: str, reason: str | None
) -> None:
    found, ran, sql = run_chart(mocker, chart, [in_place("metric", call)])

    assert found == reason
    assert ("ds" in bounded_columns(sql)) is (reason is None)
    assert (ran > 0) is (reason is None)


@freeze_time(NOW)
@with_feature_flags(**JINJA_FLAGS)
@pytest.mark.parametrize(
    "call",
    [
        "get_filters('ds', remove_filter=flag)",
        "get_filters('ds', remove_filter=not flag)",
        "get_time_filter('ds', remove_filter='no')",
        "get_filters('ds', **{'remove_filter': False})",
        "filter_values('ds', *[None, True])",
    ],
)
def test_remove_filter_that_isnt_a_false_constant_removes(
    mocker: MockerFixture, chart: Any, call: str
) -> None:
    reason, ran, _sql = run_chart(mocker, chart, [in_place("metric", call)])

    assert (reason, ran) == ("UNBOUNDED_RANGE", 0)


@freeze_time(NOW)
@with_feature_flags(**JINJA_FLAGS)
@pytest.mark.parametrize(
    "expression",
    [
        removing("get_filters(time_column, remove_filter=True)"),
        removing("get_filters('d' ~ 's', remove_filter=True)"),
        removing("get_filters(*['ds', True])"),
        removing("get_filters(**{'column': 'ds', 'remove_filter': True})"),
        "COUNT(*) {% set f = get_filters %}{% if f('ds', True) %}{% endif %}",
        "COUNT(*) {{ get_filters | length }}",
        removing("metric.args[2]['get_' ~ 'filters']('ds', True)"),
        "COUNT(*) {{ metric.args[1].from_string("
        "'{% if get_filters(\"ds\", True) %}{% endif %}').render(metric.args[2]) }}",
        "{% set m = metric %}{{ m('evil', 8) }}",
        "{{ metric('evil', 8) }}",
        "{{ metric('evil', dataset_id=8) }}",
        "{% set a = ['evil', 8] %}{{ metric(*a) }}",
        "{{ metric(**{'metric_key': 'evil', 'dataset_id': 8}) }}",
    ],
)
def test_non_literal_forms_open_every_time_column(
    mocker: MockerFixture, chart: Any, expression: str
) -> None:
    from superset.connectors.sqla.models import SqlaTable, SqlMetric

    other = SqlaTable(
        id=8,
        table_name="mine",
        metrics=[SqlMetric(metric_name="evil", expression=removing(GF))],
    )
    mocker.patch(
        "superset.daos.dataset.DatasetDAO.find_by_id",
        side_effect=lambda model_id, **kwargs: other if model_id == 8 else chart,
    )
    query = chart_query(
        metrics=[sql_metric(expression)],
        filters=[tr("Last 30 days"), tr("Last 30 days", "other_ts")],
    )

    reason, ran, _sql = run_chart(mocker, chart, [query])

    assert (reason, ran) == ("UNBOUNDED_RANGE", 0)


@freeze_time(NOW)
@with_feature_flags(**JINJA_FLAGS)
def test_metric_of_the_queried_dataset_is_unbounded(
    mocker: MockerFixture, chart: Any
) -> None:
    mocker.patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=chart)
    query = chart_query(metrics=[sql_metric("{{ metric('count') }}")])

    reason, ran, _sql = run_chart(
        mocker, chart, [query], form_data={"datasource": "7__table"}
    )

    assert (reason, ran) == ("UNBOUNDED_RANGE", 0)


@freeze_time(NOW)
@with_feature_flags(**JINJA_FLAGS)
@pytest.mark.parametrize(
    "url,method",
    [
        ("/api/v1/chart/data", "POST"),
        ("/api/v1/chart/1/data/", "GET"),
    ],
    ids=["form POST", "saved chart GET"],
)
def test_metric_without_a_dataset_id_from_the_url_is_unbounded(
    mocker: MockerFixture, chart: Any, url: str, method: str
) -> None:
    from urllib.parse import quote

    from superset.connectors.sqla.models import SqlaTable, SqlMetric

    other = SqlaTable(
        id=8,
        table_name="mine",
        metrics=[SqlMetric(metric_name="evil", expression=removing(GF))],
    )
    mocker.patch(
        "superset.daos.dataset.DatasetDAO.find_by_id",
        side_effect=lambda model_id, **kwargs: (
            other if str(model_id) == "8" else chart
        ),
    )
    query = chart_query(metrics=[sql_metric("{{ metric('evil') }}")])
    form_data = {"datasource": "7__table"}
    body = {
        "datasource": {"id": 7, "type": "table"},
        "queries": [{**query, "adhoc_filters": [DS_ADHOC]}],
        "form_data": form_data,
    }
    request: dict[str, Any] = {
        "path": url + "?form_data=" + quote(json.dumps({"datasource": "8__table"})),
        "method": method,
    }
    if method == "POST":
        request["data"] = {"form_data": json.dumps(body)}

    reason, ran, sql = run_chart(
        mocker, chart, [query], form_data=form_data, request=request
    )

    assert (reason, ran) == ("UNBOUNDED_RANGE", 0)
    assert "ds" not in bounded_columns(sql)


@freeze_time(NOW)
@with_feature_flags(**JINJA_FLAGS)
def test_get_time_filter_without_a_column_is_unchanged(
    mocker: MockerFixture, chart: Any
) -> None:
    query = in_place("metric", "get_time_filter(remove_filter=True)")

    reason, _ran, sql = run_chart(mocker, chart, [query])

    assert reason is None
    assert bounded_columns(sql) == {"ds"}


ROW_LIMIT_CONTRIBUTION = [
    chart_query(post_processing=[{"operation": "contribution", "options": {}}]),
    chart_query(columns=[], metrics=[sql_metric(removing_if("row_limit is none"))]),
]


@freeze_time(NOW)
@with_feature_flags(**JINJA_FLAGS)
@pytest.mark.parametrize(
    "queries,result_type,joins",
    [
        pytest.param(
            [
                chart_query(
                    metrics=[sql_metric(removing_if("from_dttm < '2026-01-01'"))],
                    time_offsets=["1 year ago"],
                )
            ],
            None,
            True,
            id="offset",
        ),
        pytest.param(
            [
                chart_query(
                    metrics=[sql_metric(removing_if("row_limit > 1000"))],
                    time_offsets=["1 year ago"],
                    row_limit=10,
                )
            ],
            None,
            True,
            id="NEW-1 offset row limit",
        ),
        pytest.param(ROW_LIMIT_CONTRIBUTION, None, True, id="NEW-2 totals"),
        pytest.param(
            [
                {
                    "filters": [
                        {
                            "col": sql_column(
                                "name {% if columns %}{{ " + GF + " }}{% endif %}"
                            ),
                            "op": "IS NOT NULL",
                        },
                        tr("Last 30 days"),
                    ],
                    "metrics": [sql_metric("COUNT(*)")],
                    "columns": ["name"],
                }
            ],
            ChartDataResultType.DRILL_DETAIL,
            True,
            id="drill detail",
        ),
        pytest.param(
            [
                {
                    "filters": [
                        {
                            "col": sql_column(
                                "name {% if from_dttm and from_dttm < '2026-01-01' %}"
                                "{{ " + GF + " }}{% endif %}"
                            ),
                            "op": "IS NOT NULL",
                        },
                        tr("Last 30 days"),
                    ],
                    "time_offsets": ["1 year ago"],
                }
            ],
            ChartDataResultType.DRILL_DETAIL,
            True,
            id="NEW-3 drill detail offset",
        ),
        pytest.param(
            [
                chart_query(
                    metrics=[sql_metric(removing_if("row_limit == 5"))],
                    series_limit=5,
                    series_columns=["name"],
                    row_limit=100,
                )
            ],
            None,
            False,
            id="prequery",
        ),
        pytest.param(
            [
                chart_query(
                    metrics=[
                        sql_metric(
                            "COUNT(*) {% macro x() %}{{ " + GF + " }}{% endmacro %}"
                        )
                    ]
                )
            ],
            None,
            True,
            id="unused macro",
        ),
        pytest.param(
            [
                chart_query(
                    orderby=[[sql_metric(SECOND_RENDER, "o"), False]],
                    time_offsets=["1 year ago"],
                )
            ],
            None,
            True,
            id="NEW-f order-by offset",
        ),
        pytest.param(
            [
                chart_query(
                    orderby=[[sql_metric(SECOND_RENDER, "o"), False]],
                    series_limit=5,
                    series_columns=["name"],
                    row_limit=100,
                )
            ],
            None,
            False,
            id="NEW-g order-by prequery",
        ),
        pytest.param(
            [
                chart_query(
                    metrics=[sql_metric("COUNT(*) + LENGTH('{{ url_param(\"x\") }}')")],
                    orderby=[[sql_metric(SECOND_RENDER, "o"), False]],
                )
            ],
            None,
            True,
            id="NEW-i order-by cache key",
        ),
        pytest.param(
            [
                chart_query(
                    columns=[sql_column("name || '{{ current_username() }}'", "n")],
                    orderby=[[sql_metric(SECOND_RENDER, "o"), False]],
                )
            ],
            None,
            True,
            id="NEW-i3 order-by cache key",
        ),
        pytest.param(
            [chart_query(orderby=[[sql_metric(SECOND_RENDER, "o"), False]])],
            None,
            True,
            id="order-by no second render",
        ),
        pytest.param(
            [
                chart_query(
                    orderby=[[sql_metric(SECOND_RENDER, "o"), False]],
                    filters=[tr("Last 30 days"), tr("Last 30 days", "other_ts")],
                )
            ],
            None,
            True,
            id="order-by other_ts bounds",
        ),
    ],
)
def test_branches_and_derived_queries_are_unbounded(
    mocker: MockerFixture,
    chart: Any,
    queries: list[dict[str, Any]],
    result_type: ChartDataResultType | None,
    joins: bool,
) -> None:
    mocker.patch.object(chart.db_engine_spec, "allows_joins", joins)

    reason, ran, _sql = run_chart(mocker, chart, queries, result_type)

    assert (reason, ran) == ("UNBOUNDED_RANGE", 0)


@freeze_time(NOW)
@with_feature_flags(**JINJA_FLAGS)
def test_plain_order_by_with_an_offset_runs(mocker: MockerFixture, chart: Any) -> None:
    parse = mocker.spy(SandboxedEnvironment, "parse")
    query = chart_query(
        orderby=[[sql_metric("COUNT(*)", "o"), False]], time_offsets=["1 year ago"]
    )

    reason, ran, sql = run_chart(mocker, chart, [query])

    assert reason is None
    assert ran == 2
    assert bounded_columns(sql) == {"ds"}
    parse.assert_not_called()


@freeze_time(NOW)
@with_feature_flags(**JINJA_FLAGS)
def test_order_by_string_with_jinja_keeps_the_superset_error(
    mocker: MockerFixture, chart: Any
) -> None:
    query = chart_query(orderby=[["name {{ " + GF + " }}", False]])

    reason, _ran, sql = run_chart(mocker, chart, [query])

    assert reason is None
    assert sql.startswith("QueryObjectValidationError: Unknown column used in orderby")


@freeze_time(NOW)
@with_feature_flags(**JINJA_FLAGS)
@pytest.mark.parametrize(
    "query,reason",
    [
        pytest.param(
            chart_query(
                columns=[],
                metrics=[sql_metric(removing(GT))],
                filters=[],
                granularity="ds",
                time_range="Last 30 days",
            ),
            "UNBOUNDED_RANGE",
            id="granularity ds",
        ),
        pytest.param(
            chart_query(
                metrics=[sql_metric(removing(GF))],
                filters=[],
                granularity="name",
                time_range="Last 30 days",
            ),
            "UNBOUNDED_RANGE",
            id="R4-a granularity name falls back to ds",
        ),
        pytest.param(
            {
                "metrics": [sql_metric(removing(GF))],
                "granularity": "ds",
                "is_timeseries": True,
                "filters": [tr("Last 30 days", "__timestamp")],
            },
            "UNBOUNDED_RANGE",
            id="__timestamp filter, ds removed",
        ),
        pytest.param(
            {
                "metrics": [sql_metric(removing("get_filters('__timestamp', True)"))],
                "granularity": "ds",
                "is_timeseries": True,
                "filters": [tr("Last 30 days", "__timestamp")],
            },
            "UNBOUNDED_RANGE",
            id="__timestamp filter, __timestamp removed",
        ),
    ],
)
def test_removed_time_column(
    mocker: MockerFixture, chart: Any, query: dict[str, Any], reason: str
) -> None:
    found, ran, _sql = run_chart(mocker, chart, [query])

    assert (found, ran) == (reason, 0)


@freeze_time(NOW)
@with_feature_flags(**JINJA_FLAGS)
@pytest.mark.parametrize(
    "call,reason",
    [
        (GF, None),
        ("get_filters('Day', remove_filter=True)", "UNBOUNDED_RANGE"),
        ("get_filters('D' ~ 'ay', remove_filter=True)", "UNBOUNDED_RANGE"),
    ],
    ids=["ds removed", "Day removed", "Day built"],
)
def test_filter_on_the_verbose_name(
    mocker: MockerFixture, call: str, reason: str | None
) -> None:
    mocker.patch.object(security_manager, "get_guest_rls_filters", return_value=[])
    mocker.patch.object(security_manager, "get_rls_filters", return_value=[])
    mocker.patch.object(security_manager, "raise_for_access")
    set_limits(mocker, policy(max_span=(90, "P1D")))
    datasource = use_datasource(mocker, make_dataset(verbose={"ds": "Day"}))
    query = chart_query(
        metrics=[sql_metric(removing(call))], filters=[tr("Last 30 days", "Day")]
    )

    found, _ran, sql = run_chart(mocker, datasource, [query])

    assert found == reason
    assert ("ds" in bounded_columns(sql)) is (reason is None)


@freeze_time(NOW)
@with_feature_flags(**JINJA_FLAGS)
@pytest.mark.parametrize(
    ("filters", "other_first", "offsets", "reason", "ran"),
    [
        (DS_30_DAYS, False, [], None, 1),
        (DS_30_DAYS, True, [], None, 1),
        (DS_6_MONTHS, False, [], None, 1),
        (DS_6_MONTHS, True, [], None, 1),
        (DS_30_DAYS, False, ["1 year ago"], None, 2),
        (DS_30_DAYS, True, ["1 year ago"], None, 2),
        (DS_6_MONTHS, False, ["1 year ago"], None, 2),
        # Superset shifts the last time filter, the removed 6 months on ds.
        (DS_6_MONTHS, True, ["1 year ago"], "MAX_SPAN_EXCEEDED", 0),
    ],
    ids=[
        "ds first-ds 30 days",
        "other first-ds 30 days",
        "ds first-ds 6 months",
        "other first-ds 6 months",
        "offset-ds first-ds 30 days",
        "offset-other first-ds 30 days",
        "offset-ds first-ds 6 months",
        "offset-other first-ds 6 months",
    ],
)
def test_bounded_by_another_time_column(
    mocker: MockerFixture,
    chart: Any,
    filters: list[dict[str, Any]],
    other_first: bool,
    offsets: list[str],
    reason: str | None,
    ran: int,
) -> None:
    query = chart_query(
        metrics=[sql_metric(removing(GF))],
        filters=filters[::-1] if other_first else filters,
        time_offsets=offsets,
    )

    found, count, sql = run_chart(mocker, chart, [query])

    assert (found, count) == (reason, ran)
    assert bounded_columns(sql) == {"other_ts"}


@freeze_time(NOW)
@with_feature_flags(**JINJA_FLAGS)
def test_time_comparison(mocker: MockerFixture, chart: Any) -> None:
    query = chart_query(metrics=[sql_metric(removing(GF))], time_offsets=["1 year ago"])

    assert run_chart(mocker, chart, [query])[:2] == ("UNBOUNDED_RANGE", 0)


@freeze_time(NOW)
@with_feature_flags(**JINJA_FLAGS)
@pytest.mark.parametrize("where", ["body", "url"])
def test_dataset_template_reads_the_checked_query(
    mocker: MockerFixture, chart: Any, where: str
) -> None:
    chart.sql = (
        "SELECT * FROM t WHERE ds >= {{ get_time_filter('ds', remove_filter=True)"
        ".from_expr or \"'1900-01-01'\" }}"
    )
    query = chart_query()
    no_filter = [{**DS_ADHOC, "comparator": "No filter"}]
    request: dict[str, Any] = {
        "json": {"queries": [{**query, "adhoc_filters": no_filter}], "form_data": {}}
    }
    if where == "url":
        request = {
            "json": {"queries": [query], "form_data": {}},
            "query_string": {"form_data": json.dumps({"adhoc_filters": no_filter})},
        }

    reason, ran, sql = run_chart(mocker, chart, [query], request=request)

    assert (reason, ran) == (None, 1)
    assert "ds >= '2026-09-21 00:00:00'" in sql
    assert "1900-01-01" not in sql


@freeze_time(NOW)
@with_feature_flags(**JINJA_FLAGS)
def test_saved_query_context_reads_the_checked_query(
    mocker: MockerFixture, chart: Any, full_api_access: None
) -> None:
    from superset.charts.data.api import ChartDataRestApi

    chart.sql = (
        "SELECT * FROM t WHERE ds >= {{ get_time_filter('ds', remove_filter=True)"
        ".from_expr or \"'1900-01-01'\" }}"
    )
    no_filter = [{**DS_ADHOC, "comparator": "No filter"}]
    saved = {
        "datasource": {"id": 7, "type": "table"},
        "queries": [{**chart_query(), "adhoc_filters": no_filter}],
        "form_data": {},
    }
    api = ChartDataRestApi()
    api.datamodel = mocker.MagicMock()
    api.datamodel.get.return_value = SimpleNamespace(
        id=1, params="{}", query_context=json.dumps(saved)
    )
    built: list[str] = []

    def respond(command: Any, **kwargs: Any) -> Any:
        query = command.query_context.queries[0].to_dict()
        built.append(chart.get_query_str_extended(query, mutate=False).sql)
        return api.response(200)

    mocker.patch.object(api, "_get_data_response", side_effect=respond)

    with current_app.test_request_context("/api/v1/chart/1/data/"):
        api.get_data(pk=1)
    sql = " ".join(built[0].split())

    assert "ds >= '2026-09-21 00:00:00'" in sql
    assert "1900-01-01" not in sql


@freeze_time(NOW)
@with_feature_flags(**JINJA_FLAGS)
def test_checked_query_leaves_the_request_form_data(chart: Any) -> None:
    from superset.views.utils import get_form_data

    query = chart_query()
    with current_app.test_request_context(json={"queries": [query], "form_data": {}}):
        before, _ = get_form_data()
        make_context([query], None, None).raise_for_access()

        assert get_form_data() == (before, None)


@freeze_time(NOW)
@with_feature_flags(**JINJA_FLAGS)
def test_templated_dataset(mocker: MockerFixture, chart: Any) -> None:
    chart.sql = "SELECT * FROM t WHERE {{ 1 }} = 1"

    reason, ran, _sql = run_chart(mocker, chart, [in_place("metric", GF)])

    assert (reason, ran) == ("UNBOUNDED_RANGE", 0)


@freeze_time(NOW)
@with_feature_flags(**JINJA_FLAGS)
@pytest.mark.parametrize(
    "result_type",
    [
        ChartDataResultType.QUERY,
        ChartDataResultType.DRILL_DETAIL,
        ChartDataResultType.SAMPLES,
    ],
)
def test_every_result_type(
    mocker: MockerFixture, chart: Any, result_type: ChartDataResultType
) -> None:
    found, _ran, _sql = run_chart(
        mocker, chart, [in_place("filter column", GF)], result_type
    )

    assert found == "UNBOUNDED_RANGE"


@freeze_time(NOW)
@with_feature_flags(**JINJA_FLAGS)
def test_datasource_samples(mocker: MockerFixture, chart: Any) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.views.datasource.utils import get_samples

    ran = mocker.spy(SqlaTable, "query")
    payload = in_place("filter column", GF)
    with current_app.test_request_context(json=payload):
        with pytest.raises(TimeRangeLimitError) as info:
            get_samples("table", 7, payload=payload)

    assert info.value.error.extra["reason_code"] == "UNBOUNDED_RANGE"
    ran.assert_not_called()


@freeze_time(NOW)
@with_feature_flags(**JINJA_FLAGS)
def test_open_query_parses_nothing(mocker: MockerFixture, chart: Any) -> None:
    from superset.time_range_limits.enforcement import check_datasource_open_query

    parse = mocker.spy(SandboxedEnvironment, "parse")

    with pytest.raises(TimeRangeLimitError):
        check_datasource_open_query(chart)
    parse.assert_not_called()


@freeze_time(NOW)
@with_feature_flags(**JINJA_FLAGS)
@pytest.mark.parametrize(
    "extras",
    [
        {"where": removing(GF).replace("COUNT(*)", "1=1")},
        {"having": removing(GF).replace("COUNT(*)", "1=1")},
    ],
    ids=["where", "having"],
)
def test_where_and_having_render_after_the_filters(
    mocker: MockerFixture, chart: Any, extras: dict[str, str]
) -> None:
    parse = mocker.spy(SandboxedEnvironment, "parse")

    reason, ran, sql = run_chart(mocker, chart, [chart_query(extras=extras)])

    assert reason is None
    assert ran == 1
    assert bounded_columns(sql) == {"ds"}
    parse.assert_not_called()


@freeze_time(NOW)
@with_feature_flags(**JINJA_FLAGS)
@pytest.mark.parametrize(
    "query",
    [
        pytest.param(
            chart_query(metrics=[sql_metric("COUNT(*) + {{ 1 }}")]), id="no macro"
        ),
        pytest.param(
            in_place("metric", "get_filters('name', remove_filter=True)"),
            id="non-time column",
        ),
        pytest.param(
            chart_query(metrics=[sql_metric("COUNT(*) {% if " + GF + " %}")]),
            id="doesn't parse",
        ),
    ],
)
def test_other_chart_jinja_is_unchanged(
    mocker: MockerFixture, chart: Any, query: dict[str, Any]
) -> None:
    parse = mocker.spy(SandboxedEnvironment, "parse")

    reason, _ran, _sql = run_chart(mocker, chart, [query])

    assert reason is None
    parse.assert_called()


@freeze_time(NOW)
@with_feature_flags(**JINJA_FLAGS)
@pytest.mark.parametrize("limits", [True, False], ids=["limits", "no limits"])
def test_text_too_deep_to_parse_keeps_the_superset_error(
    mocker: MockerFixture, chart: Any, limits: bool
) -> None:
    if not limits:
        set_limits(mocker, None)
    deep = "{{ " + "(" * 2000 + "1" + ")" * 2000 + " }}"
    query = chart_query(metrics=[sql_metric(f"COUNT(*) + {deep}")])

    reason, ran, sql = run_chart(mocker, chart, [query])

    assert (reason, ran) == (None, 1)
    assert sql.startswith("QueryObjectValidationError")
    assert "RecursionError" in sql
    type(chart.database).get_df.assert_not_called()


LONG_SUM = "COUNT(*) + {{ (x" + " + x" * 1000 + ") | length }}"
LONG_FILTER = "COUNT(*) + {{ 'a'" + "|lower" * 1000 + " }}"


@freeze_time(NOW)
@with_feature_flags(**JINJA_FLAGS)
@pytest.mark.parametrize("text", [LONG_SUM, LONG_FILTER], ids=["sum", "filter"])
def test_text_too_deep_to_walk_is_unbounded(
    mocker: MockerFixture, chart: Any, text: str
) -> None:
    query = chart_query(metrics=[sql_metric(text)])

    reason, ran, _sql = run_chart(mocker, chart, [query])

    assert (reason, ran) == ("UNBOUNDED_RANGE", 0)


@freeze_time(NOW)
@with_feature_flags(**JINJA_FLAGS)
def test_samples_text_too_deep_to_walk_without_limits_is_unchanged(
    mocker: MockerFixture, chart: Any
) -> None:
    from superset.common.db_query_status import QueryStatus
    from superset.common.query_context import QueryContext

    set_limits(mocker, None)
    payload = mocker.spy(QueryContext, "get_payload")
    query = chart_query(metrics=[sql_metric(LONG_SUM)])

    reason, ran, _sql = run_chart(mocker, chart, [query], ChartDataResultType.SAMPLES)

    assert (reason, ran) == (None, 1)
    assert [
        (result["status"], result["rowcount"])
        for result in payload.spy_return["queries"]
    ] == [(QueryStatus.SUCCESS, 1)]


@freeze_time(NOW)
@pytest.mark.parametrize(
    "flags,limits",
    [
        ({**FLAG_ON, "ENABLE_TEMPLATE_PROCESSING": False}, True),
        (
            {
                FEATURE_FLAG: False,
                "ENABLE_TEMPLATE_PROCESSING": True,
            },
            True,
        ),
        (JINJA_FLAGS, False),
    ],
    ids=["template processing off", "flag off", "no limits"],
)
@pytest.mark.parametrize("place", ["metric", "order-by"])
def test_unchanged_without_template_processing_flag_or_limits(
    mocker: MockerFixture, chart: Any, flags: dict[str, bool], limits: bool, place: str
) -> None:
    mocker.patch.object(
        feature_flag_manager,
        "get_feature_flags",
        return_value={**(feature_flag_manager._feature_flags or {}), **flags},
    )
    parse = mocker.spy(SandboxedEnvironment, "parse")
    if not limits:
        set_limits(mocker, None)
    query = (
        in_place("metric", GF)
        if place == "metric"
        else chart_query(orderby=[[sql_metric(SECOND_RENDER, "o"), False]])
    )

    reason, ran, _sql = run_chart(mocker, chart, [query])

    assert reason is None
    assert ran == 1
    if limits:
        parse.assert_not_called()


@freeze_time(NOW)
@with_feature_flags(**JINJA_FLAGS)
def test_order_by_that_doesnt_parse_is_unbounded(
    mocker: MockerFixture, chart: Any
) -> None:
    parse = mocker.spy(SandboxedEnvironment, "parse")
    query = chart_query(orderby=[[sql_metric("COUNT(*) {% if x %}", "o"), False]])

    reason, ran, _sql = run_chart(mocker, chart, [query])

    assert (reason, ran) == ("UNBOUNDED_RANGE", 0)
    parse.assert_not_called()


@freeze_time(NOW)
@with_feature_flags(**JINJA_FLAGS)
def test_check_changes_no_query_object(chart: Any) -> None:
    import copy

    query = chart_query(
        metrics=[sql_metric(removing(GF))],
        filters=[tr("Last 30 days"), tr("Last 30 days", "other_ts")],
        granularity="ds",
        time_range="Last 30 days",
        time_offsets=["1 year ago"],
    )
    context = make_context([query])
    filters = copy.deepcopy(context.queries[0].filter)
    dates = (context.queries[0].from_dttm, context.queries[0].to_dttm)

    check(context)

    assert context.queries[0].filter == filters
    assert (context.queries[0].from_dttm, context.queries[0].to_dttm) == dates


# The query check and the chart ranges endpoint read the same ranges


def mixed_result_types(result_type: ChartDataResultType) -> Any:
    context = make_context(
        [
            {"filters": [tr("Last year")], "metrics": ["count"]},
            {"filters": [tr("Last week")], "metrics": ["count"]},
        ]
    )
    context.queries[0].result_type = ChartDataResultType.FULL
    context.queries[1].result_type = None
    context.result_type = result_type
    return context


READER_CONTEXTS = {
    "totals query": (
        lambda: contribution_context(
            {"result_type": "samples", "filters": [tr("Last 10 years")]}
        ),
        2,
    ),
    "totals query in a columns context": (
        lambda: contribution_context(
            {"filters": [tr("Last 10 years")]}, result_type=ChartDataResultType.COLUMNS
        ),
        1,
    ),
    "samples": (
        lambda: make_context(
            [{"filters": [tr("Last week")], "metrics": ["count"]}],
            result_type=ChartDataResultType.SAMPLES,
        ),
        1,
    ),
    "columns": (lambda: mixed_result_types(ChartDataResultType.COLUMNS), 1),
    "timegrains": (lambda: mixed_result_types(ChartDataResultType.TIMEGRAINS), 1),
    "two queries": (
        lambda: make_context(
            [
                {"filters": [tr("Last week")], "metrics": ["count"]},
                {
                    "filters": [tr("Last year")],
                    "metrics": ["count"],
                    "time_offsets": ["1 year ago"],
                },
            ]
        ),
        2,
    ),
}


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
@pytest.mark.parametrize("independent_filter", [False, True])
def test_inline_series_ranking_requires_its_own_time_bound(
    mocker: MockerFixture, chart: Any, independent_filter: bool
) -> None:
    """An outer time window must not hide an unbounded ranking subquery."""
    mocker.patch.object(chart.db_engine_spec, "time_groupby_inline", True)
    query = chart_query(
        is_timeseries=True,
        granularity="ds",
        time_range="2026-10-20 : 2026-10-21",
        filters=[
            tr("2026-10-20 : 2026-10-21"),
            tr("2026-10-20 : 2026-10-21", "other_ts"),
        ]
        if independent_filter
        else [],
        series_limit=5,
    )
    reason, ran, sql = run_chart(mocker, chart, [query])
    assert "JOIN (SELECT" in sql
    assert reason == (None if independent_filter else "UNBOUNDED_RANGE")
    assert ran == (1 if independent_filter else 0)


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON, EMBEDDED_SUPERSET=True)
@pytest.mark.parametrize("configured_child", [True, False])
@pytest.mark.parametrize("user", ["alpha", "guest"])
def test_multilayer_child_uses_validated_parent_dashboard(
    mocker: MockerFixture,
    client: Any,
    full_api_access: None,
    dataset: Any,
    session: Any,
    configured_child: bool,
    user: str,
) -> None:
    """Layer requests inherit dashboard limits only through a configured parent."""
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.slice import Slice

    SqlaTable.metadata.create_all(session.get_bind())
    dashboard = make_dashboard(limits=policy(max_span=(7, "P1D")), slices=[(11, 8)])
    parent = dashboard.slices[0]
    parent.params = json.dumps(
        {"viz_type": "deck_multi", "deck_slices": [12] if configured_child else []}
    )
    child = Slice(id=12, datasource_id=7, datasource_type="table", params="{}")
    session.add_all([dataset, dashboard, child])
    session.flush()
    use_dashboards(mocker, dashboard)
    as_user(mocker, user)
    set_limits(mocker, None)
    mocker.patch.object(
        security_manager, "get_current_guest_user_if_guest", return_value=None
    )
    mocker.patch("superset.security.manager.query_context_modified", return_value=False)
    mocker.patch.object(security_manager, "is_viewer", return_value=False)
    run = mocker.spy(SqlaTable, "query")
    mocker.patch.object(
        type(dataset.database), "get_df", return_value=pd.DataFrame({"count": [1]})
    )

    response = client.post(
        "/api/v1/chart/data",
        json={
            "datasource": {"id": 7, "type": "table"},
            "form_data": {"dashboardId": 3, "slice_id": 12, "parent_slice_id": 11},
            "queries": [{"filters": [tr("Last year")], "metrics": ["count"]}],
            "result_format": "json",
            "result_type": "full",
        },
    )
    if configured_child:
        assert response.status_code == 400
        assert response.json["errors"][0]["extra"]["source"] == "dashboard"
        run.assert_not_called()
    elif user == "guest":
        assert response.status_code == 403
        run.assert_not_called()
    else:
        run.assert_called_once()
