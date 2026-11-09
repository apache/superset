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
"""Time range limits on samples, drill, Drill by, column values, the async worker,
warm-up and cached annotation data."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from freezegun import freeze_time
from pytest_mock import MockerFixture

from superset.common.chart_data import ChartDataResultType
from superset.extensions import feature_flag_manager, security_manager
from superset.time_range_limits.policy import (
    FEATURE_FLAG,
    TimeRangeLimitError,
)
from superset.utils import json
from tests.fixtures.time_range_query_paths import (
    as_user,
    BAD_GLOBAL,
    layout,
    make_dataset,
    MODERN,
    NOW,
    policy,
    saved_chart,
    set_global,
    SqlRanError,
    time_filter,
    tr,
    use_dashboards,
)

with_flag_on = pytest.mark.usefixtures("flag_on")


@pytest.fixture
def flag_on() -> Iterator[None]:
    with flag(True):
        yield


@contextmanager
def flag(on: bool) -> Iterator[None]:
    base = feature_flag_manager._feature_flags or {}
    with patch.object(
        feature_flag_manager,
        "get_feature_flags",
        return_value={**base, FEATURE_FLAG: on},
    ):
        yield


def make_dashboard(
    dashboard_id: int = 3,
    limits: dict[str, Any] | None = None,
    slices: Any = ((11, 7),),
    native_filters: list[dict[str, Any]] | None = None,
    position_json: str | None = None,
) -> Any:
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

    metadata: dict[str, Any] = {"native_filter_configuration": native_filters or []}
    if limits is not None:
        metadata["time_range_limits"] = limits
    return Dashboard(
        id=dashboard_id,
        json_metadata=json.dumps(metadata),
        position_json=position_json,
        slices=[
            Slice(id=slice_id, datasource_id=ds_id, datasource_type="table")
            for slice_id, ds_id in slices
        ],
    )


def drill_body(time_range: str | None) -> Any:
    """The body ``getDrillPayload`` sends for a chart with ``time_range``."""
    return {
        "granularity": "ds",
        "time_range": time_range,
        "filters": [tr(time_range)] if time_range else [],
        "extras": {"where": ""},
    }


def reason_of(call: Any) -> Any:
    with pytest.raises(TimeRangeLimitError) as info:
        call()
    return info.value.error


def runs_sql(sql: list[str], call: Any) -> None:
    sql.clear()
    with pytest.raises(SqlRanError):
        call()
    assert sql


# /datasource/samples and drill to detail


@freeze_time(NOW)
@with_flag_on
@pytest.mark.parametrize(
    "time_range,reason",
    [
        ("Last week", None),
        ("Last 90 days", None),
        (None, "UNBOUNDED_RANGE"),
        ("Last year", "MAX_SPAN_EXCEEDED"),
    ],
)
def test_samples_and_drill_detail_are_fully_checked(
    sql: list[str],
    dataset: Any,
    mocker: MockerFixture,
    time_range: str | None,
    reason: str | None,
) -> None:
    from superset.views.datasource.utils import get_samples

    as_user(mocker, "alpha")
    set_global(mocker, policy(90))
    mocker.patch.object(security_manager, "raise_for_access")

    def call() -> Any:
        return get_samples("table", 7, payload=drill_body(time_range))

    if reason is None:
        runs_sql(sql, call)
        return
    sql.clear()
    error = reason_of(call)
    assert error.error_type == "TIME_RANGE_LIMIT_ERROR"
    assert error.extra["reason_code"] == reason
    assert error.extra["dashboard_id"] is None
    assert sql == []


@freeze_time(NOW)
@with_flag_on
@pytest.mark.parametrize(
    "dashboard,applies",
    [
        (make_dashboard(limits=policy(30)), True),
        (make_dashboard(limits=policy(30), slices=((11, 8),)), False),
        (make_dashboard(limits=policy(30), dashboard_id=4), False),
    ],
    ids=["chart on the dataset", "no chart on the dataset", "unknown id"],
)
def test_samples_get_the_dashboard_limit(
    sql: list[str],
    dataset: Any,
    mocker: MockerFixture,
    dashboard: Any,
    applies: bool,
) -> None:
    from superset.views.datasource.utils import get_samples

    as_user(mocker, "alpha")
    set_global(mocker, policy(90))
    use_dashboards(mocker, dashboard)
    seen: list[Any] = []
    mocker.patch.object(
        security_manager,
        "raise_for_access",
        side_effect=lambda **kwargs: seen.append(kwargs["query_context"]),
    )

    def call() -> Any:
        return get_samples(
            "table", 7, payload=drill_body("Last 60 days"), limit_dashboard_id=3
        )

    if applies:
        error = reason_of(call)
        assert error.extra["reason_code"] == "MAX_SPAN_EXCEEDED"
        assert error.extra["source"] == "dashboard"
        assert error.extra["dashboard_id"] == 3
        assert error.message.startswith("Range can't be longer than 30 days.")
        assert sql == []
    else:
        runs_sql(sql, call)
    assert seen
    for query_context in seen:
        assert query_context.form_data is None
        assert query_context.limit_dashboard_id == 3


@freeze_time(NOW)
@with_flag_on
@pytest.mark.parametrize("dashboard_id", ["abc", "5.0", -3, 2**40])
def test_samples_junk_dashboard_id_loads_no_dashboard(
    sql: list[str], dataset: Any, mocker: MockerFixture, dashboard_id: Any
) -> None:
    from superset.views.datasource.utils import get_samples

    as_user(mocker, "alpha")
    set_global(mocker, policy(90))
    find = use_dashboards(mocker, make_dashboard(limits=policy(30)))
    mocker.patch.object(security_manager, "raise_for_access")

    runs_sql(
        sql,
        lambda: get_samples(
            "table",
            7,
            payload=drill_body("Last 60 days"),
            limit_dashboard_id=dashboard_id,
        ),
    )
    find.assert_not_called()


@freeze_time(NOW)
@with_flag_on
def test_samples_dashboard_the_user_cant_open(
    sql: list[str], dataset: Any, mocker: MockerFixture
) -> None:
    from superset.views.datasource.utils import get_samples

    can_open = as_user(mocker, "alpha", can_open=False)
    set_global(mocker, policy(90))
    use_dashboards(mocker, make_dashboard(limits=policy(30)))
    mocker.patch.object(security_manager, "raise_for_access")

    runs_sql(
        sql,
        lambda: get_samples(
            "table", 7, payload=drill_body("Last 60 days"), limit_dashboard_id=3
        ),
    )
    error = reason_of(
        lambda: get_samples(
            "table", 7, payload=drill_body("Last year"), limit_dashboard_id=3
        )
    )
    assert error.extra["source"] == "global"
    assert error.extra["dashboard_id"] is None
    assert can_open.called


@freeze_time(NOW)
@with_flag_on
def test_samples_guest_keeps_the_dashboard_in_form_data(
    sql: list[str], dataset: Any, mocker: MockerFixture
) -> None:
    from superset.views.datasource.utils import get_samples

    can_open = as_user(mocker, "guest")
    set_global(mocker, policy(90))
    use_dashboards(mocker, make_dashboard(limits=policy(30)))
    seen: list[Any] = []
    mocker.patch.object(
        security_manager,
        "raise_for_access",
        side_effect=lambda **kwargs: seen.append(kwargs["query_context"]),
    )

    error = reason_of(
        lambda: get_samples(
            "table", 7, payload=drill_body("Last 60 days"), dashboard_id=3
        )
    )

    assert error.extra["dashboard_id"] == 3
    assert seen[0].form_data == {"dashboardId": 3}
    assert seen[0].limit_dashboard_id is None
    can_open.assert_not_called()


def test_samples_view_passes_the_dashboard_id_for_every_user(
    mocker: MockerFixture, client: Any, full_api_access: None
) -> None:
    get_samples = mocker.patch(
        "superset.views.datasource.views.get_samples", return_value={}
    )
    mocker.patch(
        "superset.views.datasource.views._load_dataset_for_samples",
        return_value=(mocker.MagicMock(), None),
    )
    mocker.patch.object(security_manager, "is_guest_user", return_value=False)

    response = client.post(
        "/datasource/samples?datasource_type=table&datasource_id=7&dashboard_id=3",
        json={"filters": []},
    )

    assert response.status_code == 200
    assert get_samples.call_args.kwargs["dashboard_id"] is None
    assert get_samples.call_args.kwargs["limit_dashboard_id"] == 3


@freeze_time(NOW)
@with_flag_on
def test_samples_view_returns_the_sip40_error(
    sql: list[str],
    dataset: Any,
    mocker: MockerFixture,
    client: Any,
    full_api_access: None,
) -> None:
    as_user(mocker, "alpha")
    set_global(mocker, policy(90))
    mocker.patch.object(security_manager, "raise_for_access")

    response = client.post(
        "/datasource/samples?datasource_type=table&datasource_id=7",
        json=drill_body("Last year"),
    )
    unbounded = client.post(
        "/datasource/samples?datasource_type=table&datasource_id=7",
        json=drill_body(None),
    )

    assert response.status_code == 400
    (error,) = response.json["errors"]
    assert error["error_type"] == "TIME_RANGE_LIMIT_ERROR"
    assert error["extra"]["reason_code"] == "MAX_SPAN_EXCEEDED"
    assert unbounded.json["errors"][0]["extra"]["reason_code"] == "UNBOUNDED_RANGE"
    assert sql == []


# The dashboard rule


def make_context(
    queries: list[dict[str, Any]],
    form_data: dict[str, Any] | None = None,
    result_type: ChartDataResultType | None = None,
) -> Any:
    from superset.common.query_context_factory import QueryContextFactory

    return QueryContextFactory().create(
        datasource={"type": "table", "id": 7},
        queries=queries,
        form_data=form_data or {},
        result_type=result_type,
    )


def check(context: Any) -> None:
    from superset.time_range_limits.enforcement import (
        check_query_context_date_ranges,
    )

    check_query_context_date_ranges(context)


def chart_query(time_range: str) -> list[dict[str, Any]]:
    return [{"filters": [tr(time_range)], "metrics": ["count"], "columns": ["name"]}]


@freeze_time(NOW)
@with_flag_on
@pytest.mark.parametrize(
    "slices,applies",
    [(((11, 7),), True), (((11, 8),), False)],
    ids=["chart on the dataset", "no chart on the dataset"],
)
def test_drill_by_gets_the_dashboard_limit(
    sql: list[str],
    dataset: Any,
    mocker: MockerFixture,
    slices: Any,
    applies: bool,
) -> None:
    as_user(mocker, "alpha")
    set_global(mocker, policy(90))
    use_dashboards(mocker, make_dashboard(limits=policy(30), slices=slices))
    drill_by = make_context(
        chart_query("Last 60 days"), {"dashboardId": 3, "slice_id": 0}
    )

    if not applies:
        check(drill_by)
        return
    error = reason_of(lambda: check(drill_by))
    assert error.extra["reason_code"] == "MAX_SPAN_EXCEEDED"
    assert error.extra["source"] == "dashboard"
    assert error.extra["dashboard_id"] == 3
    assert error.message.startswith("Range can't be longer than 30 days.")


@freeze_time(NOW)
@with_flag_on
@pytest.mark.parametrize(
    "slice_id,applies",
    [
        (None, True),
        (0, True),
        (11, True),
        ("11", True),
        (51, False),
        (-3, True),
        ("abc", True),
        ("5.0", True),
        (51.5, True),
        (True, True),
    ],
    ids=repr,
)
def test_slice_id_is_read_strictly(
    sql: list[str],
    dataset: Any,
    mocker: MockerFixture,
    slice_id: Any,
    applies: bool,
) -> None:
    can_open = as_user(mocker, "alpha")
    set_global(mocker, policy(90))
    use_dashboards(mocker, make_dashboard(limits=policy(30), slices=((11, 7), (51, 8))))
    context = make_context(
        chart_query("Last 60 days"), {"dashboardId": 3, "slice_id": slice_id}
    )

    if applies:
        assert reason_of(lambda: check(context)).extra["dashboard_id"] == 3
        can_open.assert_called_once()
    else:
        check(context)
        can_open.assert_not_called()


@freeze_time(NOW)
@with_flag_on
@pytest.mark.parametrize("can_open", [True, False])
def test_dashboard_limit_needs_dashboard_access(
    sql: list[str], dataset: Any, mocker: MockerFixture, can_open: bool
) -> None:
    access = as_user(mocker, "alpha", can_open=can_open)
    set_global(mocker, policy(90))
    use_dashboards(mocker, make_dashboard(limits=policy(30)))
    form_data = {"dashboardId": 3, "slice_id": 11}

    last_60 = make_context(chart_query("Last 60 days"), form_data)
    if can_open:
        error = reason_of(lambda: check(last_60))
        assert error.extra["source"] == "dashboard"
        assert error.extra["dashboard_id"] == 3
    else:
        check(last_60)
        error = reason_of(
            lambda: check(make_context(chart_query("Last year"), form_data))
        )
        assert error.extra["source"] == "global"
        assert error.extra["dashboard_id"] is None
        assert "30" not in error.message
    access.assert_called()


NATIVE_SELECT = [
    {
        "id": "NATIVE_FILTER-select",
        "targets": [{"datasetId": 7, "column": {"name": "name"}}],
        "controlValues": {},
    }
]


@freeze_time(NOW)
@with_flag_on
@pytest.mark.parametrize("can_open", [True, False])
def test_native_filter_values_need_dashboard_access(
    sql: list[str], dataset: Any, mocker: MockerFixture, can_open: bool
) -> None:
    access = as_user(mocker, "alpha", can_open=can_open)
    set_global(mocker, policy(90))
    use_dashboards(mocker, make_dashboard(native_filters=NATIVE_SELECT))
    context = make_context(
        [{"columns": ["name"], "metrics": [], "orderby": [["name", True]]}],
        {
            "type": "NATIVE_FILTER",
            "native_filter_id": "NATIVE_FILTER-select",
            "dashboardId": 3,
        },
    )

    if can_open:
        check(context)
    else:
        error = reason_of(lambda: check(context))
        assert error.extra["reason_code"] == "UNBOUNDED_RANGE"
        assert error.extra["dashboard_id"] is None
    access.assert_called_once()


@freeze_time(NOW)
@with_flag_on
@pytest.mark.parametrize("user", ["guest", "rbac"])
def test_dashboard_users_need_no_access_check(
    sql: list[str], dataset: Any, mocker: MockerFixture, user: str
) -> None:
    access = as_user(mocker, user, can_open=False)
    set_global(mocker, policy(90))
    use_dashboards(
        mocker, make_dashboard(limits=policy(30), native_filters=NATIVE_SELECT)
    )

    error = reason_of(
        lambda: check(make_context(chart_query("Last 60 days"), {"dashboardId": 3}))
    )
    check(
        make_context(
            [{"columns": ["name"], "metrics": []}],
            {
                "type": "NATIVE_FILTER",
                "native_filter_id": "NATIVE_FILTER-select",
                "dashboardId": 3,
            },
        )
    )

    assert error.extra["dashboard_id"] == 3
    access.assert_not_called()


@freeze_time(NOW)
@with_flag_on
def test_out_of_band_dashboard_replaces_the_form_data_one(
    sql: list[str], dataset: Any, mocker: MockerFixture
) -> None:
    as_user(mocker, "rbac")
    set_global(mocker, policy(90))
    find = use_dashboards(
        mocker,
        make_dashboard(limits=policy(30)),
        make_dashboard(dashboard_id=4, limits=policy(10)),
    )
    context = make_context(chart_query("Last 20 days"), {"dashboardId": 4})
    context.limit_dashboard_id = 3

    check(context)
    assert find.call_args.args == (3,)

    context.limit_dashboard_id = "abc"
    check(context)
    assert find.call_count == 1


@freeze_time(NOW)
@with_flag_on
def test_out_of_band_dashboard_never_counts_as_reached_through(
    sql: list[str], dataset: Any, mocker: MockerFixture
) -> None:
    access = as_user(mocker, "rbac", can_open=False)
    set_global(mocker, policy(90))
    use_dashboards(mocker, make_dashboard(limits=policy(30), slices=((11, 8),)))
    context = make_context(chart_query("Last 60 days"))
    context.limit_dashboard_id = 3

    check(context)
    access.assert_not_called()


# The column values endpoint


def column_values(
    mocker: MockerFixture, client: Any, found: Any
) -> tuple[Any, MagicMock]:
    mocker.patch(
        "superset.datasource.api.DatasourceDAO.get_datasource", return_value=found
    )
    mocker.patch.object(security_manager, "raise_for_access")
    values = mocker.patch.object(type(found), "values_for_column", return_value=["a"])
    return client.get("/api/v1/datasource/table/7/column/name/values/"), values


@freeze_time(NOW)
@pytest.mark.parametrize(
    "limits", [policy(90), BAD_GLOBAL, None], ids=["rule", "bad_global", "no_rule"]
)
@pytest.mark.parametrize("enabled", [False, True], ids=["flag-off", "flag-on"])
def test_column_values_run_as_before(
    mocker: MockerFixture,
    client: Any,
    full_api_access: None,
    limits: Any,
    enabled: bool,
) -> None:
    set_global(mocker, limits)
    read = mocker.patch(
        "superset.time_range_limits.enforcement.get_effective_time_range_limits"
    )

    with flag(enabled):
        response, values = column_values(mocker, client, make_dataset())

    assert response.status_code == 200
    assert response.json["result"] == ["a"]
    values.assert_called_once()
    read.assert_not_called()


# The async worker


# Warm-up


def warm_up(
    mocker: MockerFixture, chart: Any, dashboard_id: Any = None
) -> dict[str, Any]:
    from superset.commands.chart.warm_up_cache import ChartWarmUpCacheCommand

    mocker.patch(
        "superset.commands.chart.warm_up_cache.get_dashboard_extra_filters",
        return_value=[],
    )
    return ChartWarmUpCacheCommand(chart, dashboard_id, None).run()


def assert_limit_result(
    result: dict[str, Any], reason: str, dashboard_id: int | None
) -> None:
    (error,) = result["errors"]
    assert error["error_type"] == "TIME_RANGE_LIMIT_ERROR"
    assert error["extra"]["reason_code"] == reason
    assert error["extra"]["dashboard_id"] == dashboard_id
    assert result["viz_error"] == error["message"]
    assert result["viz_status"] is None


@freeze_time(NOW)
@with_flag_on
def test_warm_up_with_the_dashboard_limit(
    warm: list[str], mocker: MockerFixture
) -> None:
    set_global(mocker, policy(90))
    use_dashboards(
        mocker,
        make_dashboard(
            limits=policy(30),
            position_json=layout(11),
            native_filters=[time_filter(excluded=[11])],
        ),
    )

    result = warm_up(mocker, saved_chart(11, "Last 60 days"), 3)

    assert_limit_result(result, "MAX_SPAN_EXCEEDED", 3)
    assert result["viz_error"].startswith("Range can't be longer than 30 days.")
    assert warm == []


@freeze_time(NOW)
@with_flag_on
def test_warm_up_chart_not_on_the_dashboard(
    warm: list[str], mocker: MockerFixture
) -> None:
    set_global(mocker, policy(90))
    use_dashboards(mocker, make_dashboard(limits=policy(30), slices=((12, 7),)))

    warm_up(mocker, saved_chart(11, "Last 60 days"), 3)

    assert len(warm) == 1


@freeze_time(NOW)
@with_flag_on
@pytest.mark.parametrize("on_dashboard", [True, False])
def test_warm_up_without_dashboard_id_uses_the_saved_dashboard(
    warm: list[str], mocker: MockerFixture, on_dashboard: bool
) -> None:
    set_global(mocker, policy(90))
    slices = ((11, 7),) if on_dashboard else ((12, 7),)
    use_dashboards(mocker, make_dashboard(limits=policy(30), slices=slices))
    chart = saved_chart(11, "Last 60 days", dashboardId=3)

    result = warm_up(mocker, chart)

    if on_dashboard:
        assert_limit_result(result, "MAX_SPAN_EXCEEDED", 3)
        assert warm == []
    else:
        assert "errors" not in result
        assert len(warm) == 1


@freeze_time(NOW)
@with_flag_on
@pytest.mark.parametrize("on_dashboard", [True, False])
def test_warm_up_saved_from_explore_names_its_chart(
    warm: list[str], mocker: MockerFixture, on_dashboard: bool
) -> None:
    set_global(mocker, policy(90))
    slices = ((11, 7), (12, 7)) if on_dashboard else ((12, 7),)
    use_dashboards(mocker, make_dashboard(limits=policy(30), slices=slices))
    chart = saved_chart(11, "Last 60 days", dashboardId=3)
    query_context = json.loads(chart.query_context)
    del query_context["form_data"]["slice_id"]
    chart.query_context = json.dumps(query_context)

    result = warm_up(mocker, chart)

    if on_dashboard:
        assert_limit_result(result, "MAX_SPAN_EXCEEDED", 3)
        assert warm == []
    else:
        assert "errors" not in result
        assert len(warm) == 1


@freeze_time(NOW)
@with_flag_on
def test_warm_up_other_errors_keep_the_string(
    warm: list[str], mocker: MockerFixture
) -> None:
    set_global(mocker, policy(90))
    chart = saved_chart(11)
    chart.query_context = None

    result = warm_up(mocker, chart, 3)

    assert result["viz_error"].startswith("Chart's query context does not exist")
    assert "errors" not in result


@freeze_time(NOW)
@with_flag_on
def test_warm_up_bad_global_error_is_sanitized_for_a_guest(
    warm: list[str], mocker: MockerFixture
) -> None:
    set_global(mocker, BAD_GLOBAL)
    mocker.patch(
        "superset.utils.error_sanitization.is_sanitization_required",
        return_value=True,
    )

    result = warm_up(mocker, saved_chart(11, "Last 60 days"))

    (error,) = result["errors"]
    assert set(error["extra"]) == {"reason_code", "source", "issue_codes"}
    assert result["viz_error"] == error["message"]
    assert warm == []


@freeze_time(NOW)
@with_flag_on
def test_warm_up_uses_the_dashboard_time_defaults(
    warm: list[str], mocker: MockerFixture
) -> None:
    set_global(mocker, policy(90))
    use_dashboards(
        mocker,
        make_dashboard(
            slices=((11, 7), (12, 7)),
            position_json=layout(11, 12),
            native_filters=[time_filter("Last 30 days", excluded=[12])],
        ),
    )

    chart_a = warm_up(mocker, saved_chart(11), 3)
    a_sql = list(warm)
    warm.clear()
    chart_b = warm_up(mocker, saved_chart(12), 3)

    assert "errors" not in chart_a
    assert len(a_sql) == 1
    assert "2026-09-21 00:00:00" in a_sql[0]
    assert "2025-10-21" not in a_sql[0]
    assert_limit_result(chart_b, "MAX_SPAN_EXCEEDED", 3)
    assert warm == []


@freeze_time(NOW)
@with_flag_on
def test_warm_up_skips_the_time_defaults_of_a_dashboard_the_user_cannot_access(
    warm: list[str], mocker: MockerFixture
) -> None:
    from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
    from superset.exceptions import SupersetSecurityException

    def deny_dashboard(**kwargs: Any) -> None:
        if "dashboard" in kwargs:
            raise SupersetSecurityException(
                SupersetError(
                    message="denied",
                    error_type=SupersetErrorType.DASHBOARD_SECURITY_ACCESS_ERROR,
                    level=ErrorLevel.ERROR,
                )
            )

    set_global(mocker, policy(90))
    use_dashboards(
        mocker,
        make_dashboard(
            slices=((11, 7),),
            position_json=layout(11),
            native_filters=[time_filter("Last 30 days")],
        ),
    )
    mocker.patch.object(
        security_manager, "raise_for_access", side_effect=deny_dashboard
    )

    result = warm_up(mocker, saved_chart(11), 3)

    (error,) = result["errors"]
    assert error["extra"]["reason_code"] == "MAX_SPAN_EXCEEDED"
    assert "2026-09-21" not in json.dumps(result)
    assert warm == []


def x_axis_query(grain: str, time_range: str | None = None) -> dict[str, Any]:
    """A timeseries query as ``buildQuery`` sends it with ``grain`` set."""
    return {
        "columns": [
            {
                "timeGrain": grain,
                "columnType": "BASE_AXIS",
                "sqlExpression": "ds",
                "label": "ds",
                "expressionType": "SQL",
                "isColumnReference": True,
            }
        ],
        "metrics": ["count"],
        "filters": [tr("No filter")],
        "extras": {"time_grain_sqla": grain, "having": "", "where": ""},
        **({"time_range": time_range} if time_range else {}),
    }


@freeze_time(NOW)
@with_flag_on
def test_warm_up_sends_the_time_grain_of_the_dashboard(
    warm: list[str], mocker: MockerFixture
) -> None:
    from superset.common.query_context_factory import QueryContextFactory
    from superset.models.slice import Slice
    from superset.time_range_limits.enforcement import (
        chart_query_context,
        dashboard_time_extras,
    )

    dashboard = make_dashboard(
        position_json=layout(11),
        native_filters=[
            time_filter("Last 30 days"),
            time_filter("P1M", filter_type="filter_timegrain", filter_id="grain"),
        ],
    )
    form_data = {"datasource": "7__table", "viz_type": MODERN, "slice_id": 11}
    chart = Slice(
        id=11,
        datasource_id=7,
        datasource_type="table",
        viz_type=MODERN,
        params=json.dumps(form_data),
        query_context=json.dumps(
            {
                "datasource": {"type": "table", "id": 7},
                "queries": [x_axis_query("P1D")],
                "form_data": form_data,
                "result_type": "full",
            }
        ),
    )

    warmed = chart_query_context(chart, dashboard_time_extras(dashboard, 11))
    sent = QueryContextFactory().create(
        datasource={"type": "table", "id": 7},
        queries=[x_axis_query("P1M", "Last 30 days")],
        form_data=form_data,
        result_type=ChartDataResultType.FULL,
    )

    assert warmed is not None
    assert warmed.query_cache_key(warmed.queries[0]) == sent.query_cache_key(
        sent.queries[0]
    )


@freeze_time(NOW)
def test_warm_up_flag_off_runs_as_before(
    warm: list[str], mocker: MockerFixture
) -> None:
    set_global(mocker, policy(90))
    find = use_dashboards(
        mocker,
        make_dashboard(
            limits=policy(30),
            slices=((11, 7),),
            position_json=layout(11),
            native_filters=[time_filter("Last 30 days")],
        ),
    )
    extras = mocker.patch("superset.commands.chart.warm_up_cache.dashboard_time_extras")

    with flag(False):
        result = warm_up(mocker, saved_chart(11), 3)

    assert "errors" not in result
    assert len(warm) == 1
    assert "2025-10-21 00:00:00" in warm[0]
    find.assert_not_called()
    extras.assert_not_called()


@freeze_time(NOW)
@with_flag_on
def test_warm_up_no_limits_still_uses_the_dashboard_dates(
    warm: list[str], mocker: MockerFixture
) -> None:
    set_global(mocker, None)
    use_dashboards(
        mocker,
        make_dashboard(position_json=layout(11), native_filters=[time_filter()]),
    )

    warm_up(mocker, saved_chart(11), 3)

    assert "2026-09-21 00:00:00" in warm[0]


def test_warm_up_response_schemas_list_errors() -> None:
    from superset.charts.schemas import ChartCacheWarmUpResponseSingleSchema
    from superset.datasets.schemas import DatasetCacheWarmUpResponseSingleSchema

    for schema in (
        ChartCacheWarmUpResponseSingleSchema,
        DatasetCacheWarmUpResponseSingleSchema,
    ):
        assert "errors" in schema().fields


# Annotation data on a main query cache hit


def annotation_chart(time_range: str, time_compare: list[str] | None = None) -> Any:
    return saved_chart(
        21,
        time_range,
        **({"time_compare": time_compare} if time_compare else {}),
    )


def cached_main_query(
    mocker: MockerFixture, annotation_source: Any, cache_hit: bool = True
) -> Any:
    """A chart query with a ``line`` layer from ``annotation_source``, served
    from the cache."""
    from superset.common.utils.query_cache_manager import QueryCacheManager

    mocker.patch(
        "superset.daos.chart.ChartDAO.find_by_id", return_value=annotation_source
    )
    cache = QueryCacheManager()
    cache.is_loaded = cache_hit
    cache.is_cached = cache_hit
    cache.applied_filter_columns = ["ds"]
    mocker.patch.object(QueryCacheManager, "get", return_value=cache)
    layer = {
        "name": "layer",
        "annotationType": "TIME_SERIES",
        "sourceType": "line",
        "value": 21,
        "overrides": {},
        "show": True,
    }
    return make_context([{**chart_query("Last week")[0], "annotation_layers": [layer]}])


def checked_then_served(context: Any) -> Any:
    """The layer check every request runs before the payload, then the payload."""
    context.check_annotation_layers()
    return context.get_payload()


@freeze_time(NOW)
@with_flag_on
def test_cached_annotation_data_is_rechecked(
    warm: list[str], mocker: MockerFixture
) -> None:
    set_global(mocker, policy(90))
    context = cached_main_query(mocker, annotation_chart("Last year"))

    error = reason_of(lambda: checked_then_served(context))

    assert error.extra["reason_code"] == "MAX_SPAN_EXCEEDED"
    assert warm == []


@freeze_time(NOW)
@with_flag_on
def test_cached_annotation_time_compare_is_rechecked(
    warm: list[str], mocker: MockerFixture
) -> None:
    set_global(mocker, policy(back=90))
    context = cached_main_query(
        mocker, annotation_chart("Last 30 days", ["1 year ago"])
    )

    error = reason_of(lambda: checked_then_served(context))

    assert error.extra["reason_code"] == "MAX_LOOK_BACK_EXCEEDED"
    assert error.extra["time_offset"] == "1 year ago"
    assert warm == []


@freeze_time(NOW)
@pytest.mark.parametrize(
    "on,source", [(True, None), (False, "chart")], ids=["deleted", "flag_off"]
)
def test_cached_annotation_data_served_as_before(
    warm: list[str], mocker: MockerFixture, on: bool, source: Any
) -> None:
    set_global(mocker, policy(90))
    context = cached_main_query(
        mocker, annotation_chart("Last year") if source else None
    )
    find = mocker.patch("superset.daos.chart.ChartDAO.find_by_id", return_value=None)

    with flag(on):
        payload = checked_then_served(context)

    assert payload["queries"][0]["is_cached"] is True
    assert warm == []
    if on:
        assert find.called


@freeze_time(NOW)
@with_flag_on
def test_cached_annotation_compliant_range_is_served(
    warm: list[str], mocker: MockerFixture
) -> None:
    set_global(mocker, policy(90))
    context = cached_main_query(mocker, annotation_chart("Last 30 days"))

    assert context.get_payload()["queries"][0]["is_cached"] is True
    assert warm == []


# The native filter time defaults reader


def extras(dashboard: Any, slice_id: int = 11, data_mask: Any = None) -> Any:
    from superset.time_range_limits.enforcement import dashboard_time_extras

    return dashboard_time_extras(dashboard, slice_id, data_mask)


def reader_dashboard(
    native_filters: list[dict[str, Any]], position_json: str | None = None
) -> Any:
    return make_dashboard(
        slices=((11, 7), (12, 7)),
        native_filters=native_filters,
        position_json=position_json if position_json is not None else layout(11, 12),
    )


def test_reader_in_scope_and_excluded() -> None:
    dashboard = reader_dashboard([time_filter(excluded=[12])])

    assert extras(dashboard, 11) == {"time_range": "Last 30 days"}
    assert extras(dashboard, 12) == {}


def test_reader_chart_not_on_the_dashboard() -> None:
    assert extras(reader_dashboard([time_filter()]), 99) == {}


def test_reader_chart_missing_from_the_layout() -> None:
    in_grid = reader_dashboard([time_filter(root_path=["GRID_ID"])], layout(12))
    in_a_tab = reader_dashboard([time_filter(root_path=["TAB-1"])], layout(12))

    assert extras(in_grid, 11) == {"time_range": "Last 30 days"}
    assert extras(in_a_tab, 11) == {}


def layer_filter(selected_layers: list[Any], **kwargs: Any) -> dict[str, Any]:
    native_filter = time_filter(**kwargs)
    native_filter["scope"]["selectedLayers"] = selected_layers
    return native_filter


@pytest.mark.parametrize(
    "native_filter,chart_11,chart_12",
    [
        (layer_filter(["chart-11-layer-0"], excluded=[11]), True, True),
        (layer_filter(["chart-11-layer-2"], root_path=["TAB-X"]), True, False),
        (layer_filter(["chart-11-layer-0"], excluded=[11, 12]), True, False),
        (layer_filter(["chart-\u0661\u0661-layer-0"], excluded=[11]), False, True),
        (layer_filter([11, None, "chart-11"], excluded=[11]), False, True),
        (layer_filter([], excluded=[11]), False, True),
    ],
    ids=[
        "excluded-chart-with-a-layer",
        "outside-root-path-with-a-layer",
        "other-chart-keeps-the-usual-rule",
        "non-ascii-digits",
        "not-a-layer-key",
        "no-selected-layers",
    ],
)
def test_a_chart_named_by_a_selected_layer_is_in_scope(
    native_filter: dict[str, Any], chart_11: bool, chart_12: bool
) -> None:
    dashboard = reader_dashboard([native_filter])
    in_scope = {"time_range": "Last 30 days"}

    assert (extras(dashboard, 11) == in_scope) is chart_11
    assert (extras(dashboard, 12) == in_scope) is chart_12


@pytest.mark.parametrize(
    "scope",
    [None, {"rootPath": ["ROOT_ID"]}, {"rootPath": ["ROOT_ID"], "excluded": "12"}],
)
def test_reader_filter_with_no_scope(scope: Any) -> None:
    native_filter = time_filter()
    native_filter["scope"] = scope

    assert extras(reader_dashboard([native_filter])) == {}


@pytest.mark.parametrize("value", ["No filter", "", None])
def test_reader_no_filter(value: Any) -> None:
    assert extras(reader_dashboard([time_filter(value)])) == {}


def test_reader_state_wins_over_extra_form_data() -> None:
    native_filter = time_filter("Last 30 days", time_range="Last year")

    assert extras(reader_dashboard([native_filter])) == {"time_range": "Last 30 days"}


def test_reader_data_mask_override() -> None:
    dashboard = reader_dashboard([time_filter()])
    report = {"NATIVE_FILTER-time": {"filterState": {"value": "Last year"}}}
    cleared = {"NATIVE_FILTER-time": {"filterState": {"value": "No filter"}}}

    assert extras(dashboard, data_mask=report) == {"time_range": "Last year"}
    assert extras(dashboard, data_mask=cleared) == {}
    assert extras(dashboard, data_mask={"other": {}}) == {"time_range": "Last 30 days"}


def test_reader_last_wins_over_two_filters() -> None:
    dashboard = reader_dashboard(
        [
            time_filter("Last 30 days", filter_id="NATIVE_FILTER-a"),
            time_filter("Last week", filter_id="NATIVE_FILTER-b"),
            time_filter("Last year", filter_id="NATIVE_FILTER-c", excluded=[11]),
        ]
    )

    assert extras(dashboard) == {"time_range": "Last week"}


def test_reader_time_column_and_grain() -> None:
    dashboard = reader_dashboard(
        [
            time_filter("ds", filter_type="filter_timecolumn", filter_id="col"),
            time_filter("P1W", filter_type="filter_timegrain", filter_id="grain"),
            time_filter(
                None,
                filter_type="filter_timegrain",
                filter_id="grain-efd",
                time_grain_sqla="P1M",
            ),
            time_filter(
                "ds2",
                filter_type="filter_timecolumn",
                filter_id="col-stale",
                granularity_sqla="other_ts",
            ),
        ]
    )

    assert extras(dashboard) == {"granularity_sqla": "ds2", "time_grain_sqla": "P1M"}


def test_reader_skips_dividers_and_other_filters() -> None:
    divider = {"id": "DIVIDER-1", "type": "DIVIDER", "scope": {}}
    select = {**time_filter("Last year"), "filterType": "filter_select"}

    assert extras(reader_dashboard([divider, select])) == {}


@pytest.mark.parametrize(
    "json_metadata,position_json",
    [
        ("{", layout(11)),
        ('{"native_filter_configuration": []', layout(11)),
        (None, "not json"),
        (None, "[]"),
        (
            None,
            json.dumps(
                {
                    "ROOT_ID": {"type": "ROOT", "children": ["GRID_ID"]},
                    "GRID_ID": {"type": "GRID", "children": ["ROOT_ID"]},
                }
            ),
        ),
        (
            None,
            json.dumps({"ROOT_ID": {"type": "ROOT", "children": ["ROOT_ID"]}}),
        ),
    ],
    ids=[
        "bad metadata",
        "truncated metadata",
        "bad layout",
        "layout not a dict",
        "cycle",
        "self loop",
    ],
)
def test_reader_junk_json(json_metadata: str | None, position_json: str) -> None:
    dashboard = reader_dashboard([time_filter()], position_json)
    if json_metadata is not None:
        dashboard.json_metadata = json_metadata

    assert extras(dashboard) == {}


def test_reader_deep_layout() -> None:
    position: dict[str, Any] = {"ROOT_ID": {"type": "ROOT", "children": ["N-0"]}}
    for depth in range(5000):
        position[f"N-{depth}"] = {"type": "COLUMN", "children": [f"N-{depth + 1}"]}
    position["N-5000"] = {"type": "CHART", "meta": {"chartId": 11}}
    dashboard = reader_dashboard(
        [time_filter(root_path=["N-4999"])], json.dumps(position)
    )

    assert extras(dashboard) == {"time_range": "Last 30 days"}


# Flag off


@freeze_time(NOW)
def test_flag_off_does_no_db_read_and_no_parsing(
    warm: list[str], mocker: MockerFixture
) -> None:
    from superset.views.datasource.utils import get_samples

    set_global(mocker, policy(1))
    for target in (
        "superset.time_range_limits.enforcement.get_query_ranges",
        "superset.time_range_limits.enforcement.get_effective_time_range_limits",
        "superset.time_range_limits.enforcement.dashboard_time_extras",
        "superset.commands.chart.warm_up_cache.dashboard_time_extras",
        "superset.daos.dashboard.DashboardDAO.find_by_id",
    ):
        mocker.patch(target, side_effect=AssertionError(target))

    with flag(False):
        runs_sql(
            warm,
            lambda: get_samples(
                "table", 7, payload=drill_body("Last year"), dashboard_id=3
            ),
        )
        warm.clear()
        assert "errors" not in warm_up(mocker, saved_chart(11), 3)
        assert len(warm) == 1
