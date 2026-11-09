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
"""The time range limits on the async chart data path and the other request
paths that reach a chart data query."""

from datetime import datetime
from typing import Any
from unittest import mock
from uuid import uuid4

import pytest
from flask import Response
from freezegun import freeze_time
from pytest_mock import MockerFixture
from superset_core.tasks.types import TaskStatus

from superset.extensions import security_manager
from superset.time_range_limits.policy import FEATURE_FLAG, TimeRangeLimitError
from superset.time_range_limits.telemetry import _path
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
from tests.fixtures.time_range_request_paths import run_worker_task
from tests.unit_tests.conftest import with_feature_flags

NOW = datetime(2026, 10, 16, 14, 30)
FLAG_ON = {FEATURE_FLAG: True}
LONG_RANGE = "2026-06-22T00:00:00 : 2026-09-14T10:30:00"
SHORT_RANGE = "2026-10-01T00:00:00 : 2026-10-05T00:00:00"


@pytest.fixture
def dataset(mocker: MockerFixture) -> Any:
    mocker.patch.object(security_manager, "get_guest_rls_filters", return_value=[])
    return use_datasource(mocker, make_dataset())


def chart_body(time_range: str, form_data: dict[str, Any] | None = None) -> Any:
    return {
        "datasource": {"id": 7, "type": "table"},
        "form_data": form_data or {},
        "queries": [{"filters": [tr(time_range)], "metrics": ["count"]}],
        "result_format": "json",
        "result_type": "full",
    }


def limit_body(response: Any) -> dict[str, Any]:
    (error,) = response.json["errors"]
    assert error["error_type"] == "TIME_RANGE_LIMIT_ERROR"
    return error["extra"]


# Async submit: the check runs in ``raise_for_access``, before the submit


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_rejected_async_request_never_submits_a_task(
    mocker: MockerFixture, client: Any, full_api_access: None, dataset: Any
) -> None:
    from superset.charts.data.api import ChartDataRestApi

    as_user(mocker, "admin")
    set_limits(mocker, policy(max_span=(9, "P1W")))
    mocker.patch.object(security_manager, "raise_for_access")
    mocker.patch.object(ChartDataRestApi, "_should_run_async", return_value=True)
    submit = mocker.patch("superset.charts.data.api.submit_chart_data_query_tasks")

    response = client.post("/api/v1/chart/data", json=chart_body(LONG_RANGE))

    assert response.status_code == 400
    assert limit_body(response)["reason_code"] == "MAX_SPAN_EXCEEDED"
    submit.assert_not_called()


# ``GET /api/v1/chart/<pk>/data/?filters_dashboard_id=`` names the dashboard


def saved_chart(mocker: MockerFixture, time_range: str) -> Any:
    from superset.charts.data.api import ChartDataRestApi

    chart = mock.MagicMock(id=11, params="{}")
    chart.query_context = json.dumps(chart_body(time_range, {"slice_id": 11}))
    mocker.patch.object(ChartDataRestApi.datamodel, "get", return_value=chart)
    mocker.patch(
        "superset.charts.data.api.get_dashboard_filter_context",
        return_value=mock.MagicMock(extra_form_data={}),
    )
    return chart


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_filters_dashboard_id_applies_the_dashboard_limits(
    mocker: MockerFixture, client: Any, full_api_access: None, dataset: Any
) -> None:
    as_user(mocker, "admin")
    set_limits(mocker, None)
    use_dashboards(mocker, make_dashboard(limits=policy(max_span=(9, "P1W"))))
    mocker.patch.object(security_manager, "raise_for_access")
    saved_chart(mocker, LONG_RANGE)
    data = mocker.patch(
        "superset.charts.data.api.ChartDataRestApi._get_data_response",
        return_value=Response("{}", status=200),
    )

    rejected = client.get("/api/v1/chart/11/data/?filters_dashboard_id=3")
    without = client.get("/api/v1/chart/11/data/")

    assert rejected.status_code == 400
    extra = limit_body(rejected)
    assert (extra["source"], extra["dashboard_id"]) == ("dashboard", 3)
    assert without.status_code == 200
    data.assert_called_once()


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_filters_dashboard_id_reaches_the_async_worker(
    mocker: MockerFixture, client: Any, full_api_access: None, dataset: Any
) -> None:
    from superset.charts.data.api import ChartDataRestApi
    from superset.common.query_serialization import serialize_query

    as_user(mocker, "admin")
    set_limits(mocker, None)
    use_dashboards(mocker, make_dashboard(limits=policy(max_span=(9, "P1W"))))
    mocker.patch.object(security_manager, "raise_for_access")
    saved_chart(mocker, SHORT_RANGE)
    mocker.patch.object(ChartDataRestApi, "_should_run_async", return_value=True)
    mocker.patch(
        "superset.commands.chart.data.get_data_command.ChartDataCommand.execute",
        return_value=None,
    )
    submit = mocker.patch(
        "superset.charts.data.api.submit_chart_data_query_tasks",
        return_value={"task_ids": [], "cursor": ""},
    )

    response = client.get("/api/v1/chart/11/data/?filters_dashboard_id=3")

    assert response.status_code == 202
    query_context = submit.call_args.args[0]
    serialized = serialize_query(query_context, 0)
    assert serialized["limit_slice_id"] == 11
    assert serialized["limit_dashboard_id"] == 3


# Trusted ids in the serialized query


def serializable_context(**ids: Any) -> Any:
    context = mock.MagicMock()
    context.cache_values = {
        "datasource": {"id": 7, "type": "table"},
        "queries": [{"metrics": ["count"]}],
    }
    context.queries = [mock.MagicMock(row_limit=10)]
    context.form_data = {}
    context.result_type = "full"
    context.result_format = "json"
    context.force = False
    context.force_nonce = None
    context.custom_cache_timeout = None
    context.limit_slice_id = ids.get("slice_id")
    context.limit_dashboard_id = ids.get("dashboard_id")
    return context


@with_feature_flags(**FLAG_ON)
def test_serialized_query_carries_the_limit_ids(mocker: MockerFixture) -> None:
    from superset.common.query_serialization import (
        load_serialized_query,
        serialize_query,
    )

    payload = serialize_query(serializable_context(slice_id=11, dashboard_id=3), 0)
    create = mocker.patch(
        "superset.common.query_context_factory.QueryContextFactory.create"
    )
    loaded = load_serialized_query(payload)

    assert (payload["limit_slice_id"], payload["limit_dashboard_id"]) == (
        11,
        3,
    )
    assert loaded is create.return_value
    assert (loaded.limit_slice_id, loaded.limit_dashboard_id) == (11, 3)


@pytest.mark.parametrize(
    "flag,ids",
    [(False, {"slice_id": 11, "dashboard_id": 3}), (True, {})],
    ids=["flag off", "no ids"],
)
def test_serialized_query_leaves_out_unset_limit_ids(
    mocker: MockerFixture, flag: bool, ids: dict[str, Any]
) -> None:
    from superset.common.query_serialization import serialize_query
    from superset.extensions import feature_flag_manager

    flags = feature_flag_manager._feature_flags or {}
    mocker.patch.object(
        feature_flag_manager,
        "get_feature_flags",
        return_value={**flags, FEATURE_FLAG: flag},
    )

    payload = serialize_query(serializable_context(**ids), 0)

    assert "limit_slice_id" not in payload
    assert "limit_dashboard_id" not in payload


# Shared tasks are split by the dashboard whose limits apply


@freeze_time(NOW)
def test_limit_task_key_names_the_resolved_dashboard(
    mocker: MockerFixture, dataset: Any
) -> None:
    from superset.extensions import feature_flag_manager
    from superset.time_range_limits.enforcement import limit_task_key

    as_user(mocker, "rbac")
    use_dashboards(mocker, make_dashboard(3), make_dashboard(4))
    query = {"filters": [tr(SHORT_RANGE)], "metrics": ["count"]}
    on_three = make_context([query], {"dashboardId": 3, "slice_id": 11})
    on_four = make_context([query], {"dashboardId": 4, "slice_id": 11})
    in_explore = make_context([query], {"slice_id": 11})
    flags = feature_flag_manager._feature_flags or {}

    def keys(flag: bool) -> list[str | None]:
        mocker.patch.object(
            feature_flag_manager,
            "get_feature_flags",
            return_value={**flags, FEATURE_FLAG: flag},
        )
        return [limit_task_key(ctx) for ctx in (on_three, on_four, in_explore)]

    assert keys(True) == [
        "time_range_limits:3",
        "time_range_limits:4",
        "time_range_limits:",
    ]
    assert keys(False) == [None, None, None]


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_limit_task_key_reuses_the_dashboard_the_check_loaded(
    mocker: MockerFixture, dataset: Any
) -> None:
    from superset.time_range_limits.enforcement import limit_task_key

    as_user(mocker, "alpha")
    set_limits(mocker, policy(max_span=(9, "P1W")))
    find = use_dashboards(mocker, make_dashboard(3))
    context = make_context(
        [{"filters": [tr(SHORT_RANGE)], "metrics": ["count"]}],
        {"dashboardId": 3, "slice_id": 11},
    )

    check(context)
    key = limit_task_key(context)

    assert key == "time_range_limits:3"
    find.assert_called_once()


def fake_query_context() -> Any:
    context = mock.MagicMock()
    context.queries = [mock.MagicMock(name="q0")]
    context.cache_values = {"queries": [{"i": 0}]}
    context.query_cache_key.return_value = "same-query"
    context.prepare_contribution_totals.return_value = ([], None)
    return context


def scheduled_task_keys(mocker: MockerFixture, contexts: list[Any]) -> list[Any]:
    from superset.tasks.async_queries import submit_chart_data_query_tasks

    scheduled: list[Any] = []

    def schedule(*args: Any, **kwargs: Any) -> Any:
        scheduled.append(kwargs["options"].task_key)
        return mock.MagicMock(uuid=uuid4())

    mocker.patch(
        "superset.tasks.async_queries.execute_chart_query.schedule",
        side_effect=schedule,
    )
    mocker.patch("superset.tasks.async_queries.serialize_query", return_value={})
    guest = mocker.patch("superset.tasks.async_queries.security_manager")
    guest.get_current_guest_user_if_guest = mock.MagicMock(return_value=None)
    for context in contexts:
        submit_chart_data_query_tasks(context, user_id=1)
    return scheduled


def test_same_query_on_two_dashboards_runs_two_tasks(mocker: MockerFixture) -> None:
    on_three, on_four = fake_query_context(), fake_query_context()
    mocker.patch(
        "superset.tasks.async_queries.limit_task_key",
        side_effect=lambda ctx: (
            "time_range_limits:3" if ctx is on_three else "time_range_limits:4"
        ),
    )

    keys = scheduled_task_keys(mocker, [on_three, on_four])

    assert keys == [
        "same-query:time_range_limits:3",
        "same-query:time_range_limits:4",
    ]


@with_feature_flags(**{FEATURE_FLAG: False})
def test_task_key_is_the_cache_key_while_the_flag_is_off(
    mocker: MockerFixture,
) -> None:
    find = mocker.patch("superset.daos.dashboard.DashboardDAO.find_by_id")
    contexts = [fake_query_context(), fake_query_context()]
    for context in contexts:
        context.form_data = {"dashboardId": 3, "slice_id": 11}

    keys = scheduled_task_keys(mocker, contexts)

    assert keys == ["same-query", "same-query"]
    find.assert_not_called()


# The worker checks again: a policy tightened while queued fails the task, no SQL


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_policy_tightened_while_queued_fails_the_task_without_sql(
    mocker: MockerFixture, dataset: Any
) -> None:
    as_user(mocker, "admin")
    set_limits(mocker, policy(max_span=(90, "P1D")))
    query_context = make_context(
        [{"filters": [tr(LONG_RANGE)], "metrics": ["count"]}], {"slice_id": 11}
    )
    check(query_context)
    sql = mocker.patch.object(query_context, "get_df_payload_result")
    set_limits(mocker, policy(max_span=(9, "P1W")))
    paths: list[str] = []
    mocker.patch(
        "superset.time_range_limits.telemetry.stats_logger_manager.instance.incr",
        side_effect=lambda key: paths.append(f"{key} {_path()}"),
    )

    result, transition, task_context = run_worker_task(mocker, query_context)

    assert result["status"] == TaskStatus.FAILURE.value
    assert transition.call_args.kwargs["new_status"] == TaskStatus.FAILURE
    sql.assert_not_called()
    task_context.update_task.assert_called_once_with(
        payload={"time_range_limit_error": "MAX_SPAN_EXCEEDED"}, immediate=True
    )
    assert [path for path in paths if path.startswith("time_range_limit.")] == [
        "time_range_limit.rejected.async_worker.max_span.global async_worker"
    ]


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_worker_runs_the_query_when_it_still_fits(
    mocker: MockerFixture, dataset: Any
) -> None:
    as_user(mocker, "admin")
    set_limits(mocker, policy(max_span=(9, "P1W")))
    query_context = make_context(
        [{"filters": [tr(SHORT_RANGE)], "metrics": ["count"]}], {"slice_id": 11}
    )
    sql = mocker.patch.object(query_context, "get_df_payload_result")
    sql.return_value.payload = {"status": "success", "cache_key": "worker-key"}

    result, _transition, task_context = run_worker_task(mocker, query_context)

    assert result["status"] == TaskStatus.SUCCESS.value
    sql.assert_called_once()
    task_context.update_task.assert_called_once_with(
        payload={"cache_key": "worker-key"}, immediate=True
    )


# The datasource query API and ``/api/v1/query/``


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_datasource_query_api_returns_the_limit_error(
    mocker: MockerFixture, app: Any, dataset: Any
) -> None:
    from superset.datasource.api import DatasourceRestApi

    as_user(mocker, "admin")
    set_limits(mocker, policy(max_span=(9, "P1W")))
    mocker.patch.object(security_manager, "raise_for_access")
    resolved = mock.MagicMock()
    resolved.explorable.id = 7
    resolved.explorable.type = "table"
    payload = {
        "result_format": "json",
        "use_cache": True,
        "force": False,
        "cache_timeout": None,
    }
    query_dict = {"filters": [tr(LONG_RANGE)], "metrics": ["count"]}

    with app.test_request_context():
        response: Any = DatasourceRestApi()._run(resolved, payload, query_dict)

    assert response.status_code == 400
    (error,) = response.json["errors"]
    assert error["error_type"] == "TIME_RANGE_LIMIT_ERROR"
    assert error["extra"]["reason_code"] == "MAX_SPAN_EXCEEDED"


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_query_api_returns_the_limit_error(
    mocker: MockerFixture, client: Any, full_api_access: None, dataset: Any
) -> None:
    as_user(mocker, "admin")
    set_limits(mocker, policy(max_span=(9, "P1W")))
    mocker.patch.object(security_manager, "raise_for_access")
    payload = mocker.patch("superset.common.query_context.QueryContext.get_payload")

    response = client.post(
        "/api/v1/query/",
        data={"query_context": json.dumps(chart_body(LONG_RANGE))},
    )

    assert response.status_code == 400
    assert limit_body(response)["reason_code"] == "MAX_SPAN_EXCEEDED"
    payload.assert_not_called()


def test_limit_error_is_a_400_with_the_sip40_shape() -> None:
    error = TimeRangeLimitError("MAX_SPAN_EXCEEDED", "message", {"rule": "max_span"})

    extra = error.error.extra or {}
    assert error.status == 400
    assert extra["reason_code"] == "MAX_SPAN_EXCEEDED"
    assert [code["code"] for code in extra["issue_codes"]] == [1042]


@pytest.mark.parametrize(
    "grant,expected",
    [
        ("can_access_schema", True),
        ("can_access", True),
        ("_semantic_layer_grant_allows", True),
        ("is_editor", True),
        (None, False),
    ],
)
def test_dataset_access_follows_the_datasource_access_rule(
    mocker: MockerFixture, grant: str | None, expected: bool
) -> None:
    from superset.time_range_limits.enforcement import _has_dataset_access

    for name in (
        "can_access_schema",
        "can_access",
        "_semantic_layer_grant_allows",
        "is_editor",
    ):
        mocker.patch.object(security_manager, name, return_value=name == grant)

    assert _has_dataset_access(mock.MagicMock(perm="[db].[t](id:7)")) is expected


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_dataset_editor_is_not_held_to_an_unverified_dashboard(
    mocker: MockerFixture, dataset: Any
) -> None:
    as_user(mocker, "editor")
    set_limits(mocker, None)
    use_dashboards(
        mocker, make_dashboard(limits=policy(max_span=(9, "P1W")), slices=[(12, 8)])
    )

    check(
        make_context(
            [{"filters": [tr(LONG_RANGE)], "metrics": ["count"]}],
            {"dashboardId": 3, "slice_id": 11},
        )
    )


@pytest.mark.parametrize("datasource_type", ["table", "query"])
def test_chart_ranges_denied_access_does_not_validate(
    mocker: MockerFixture, app: Any, datasource_type: str
) -> None:
    """Denied datasource access must precede query template validation."""
    from superset.time_range_limits.api import _modern_ranges

    context = mocker.Mock()
    context.datasource.type = datasource_type
    query = mocker.Mock()
    context.queries = [query]
    mocker.patch(
        "superset.time_range_limits.api.ChartDataQueryContextSchema"
    ).return_value.load.return_value = context
    access = mocker.patch.object(
        security_manager, "raise_for_access", side_effect=PermissionError("denied")
    )
    with app.test_request_context():
        result = _modern_ranges("chart", {})
    assert result["status"] == "error"
    query.validate.assert_not_called()
    if datasource_type == "query":
        access.assert_called_once_with(query=context.datasource, allow_editorship=False)
    else:
        access.assert_called_once_with(query_context=context)
