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
"""Time range limits on charts over semantic views."""

from __future__ import annotations

import logging
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime
from typing import Any
from unittest.mock import MagicMock, patch, PropertyMock

import pyarrow as pa
import pytest
from flask import current_app
from flask.testing import FlaskClient
from freezegun import freeze_time
from pytest_mock import MockerFixture
from superset_core.semantic_layers.layer import SemanticLayer
from superset_core.semantic_layers.types import (
    Dimension,
    Grains,
)
from superset_core.semantic_layers.view import SemanticView as SemanticViewABC

from superset.extensions import feature_flag_manager
from superset.semantic_layers.models import (
    SemanticLayer as SemanticLayerModel,
    SemanticView as SemanticViewModel,
)
from superset.semantic_layers.transport import build_provider_transport
from superset.time_range_limits.policy import FEATURE_FLAG
from superset.utils import json
from tests.fixtures.time_range_semantic_views import (
    query,
    TimedOrdersView,
    X_AXIS,
)
from tests.unit_tests.semantic_layers.conftest import make_execution_context, STUB_TYPE

NOW = "2026-11-02 12:00:00"
VIEW_ID = 91


def serve(
    mocker: MockerFixture, view: SemanticViewABC, view_id: int = VIEW_ID
) -> SemanticViewModel:
    model = SemanticViewModel(
        id=view_id,
        name=view.name,
        cache_timeout=-1,
        semantic_layer=SemanticLayerModel(type=STUB_TYPE),
    )
    mocker.patch.object(
        SemanticViewModel,
        "implementation",
        new_callable=PropertyMock,
        return_value=view,
    )
    mocker.patch(
        "superset.daos.datasource.DatasourceDAO.get_datasource", return_value=model
    )
    mocker.patch.object(SemanticViewModel, "raise_for_access")
    return model


@pytest.fixture
def timed_view(stub_layer: type[SemanticLayer[Any, Any]], mocker: MockerFixture):
    view = TimedOrdersView()
    serve(mocker, view)
    return view


@pytest.fixture
def stub_orders(stub_layer: type[SemanticLayer[Any, Any]], mocker: MockerFixture):
    """Master's stub view, which has no temporal dimension."""
    view = stub_layer.from_configuration(
        {},
        cache_token="test",  # noqa: S106
        context=make_execution_context(),
        transport=build_provider_transport(),
    ).get_semantic_view("orders", {})
    serve(mocker, view)
    return view


@contextmanager
def flag(on: bool) -> Iterator[None]:
    base = feature_flag_manager._feature_flags or {}
    with patch.object(
        feature_flag_manager,
        "get_feature_flags",
        return_value={**base, FEATURE_FLAG: on},
    ):
        yield


@pytest.fixture
def flag_on() -> Iterator[None]:
    with flag(True):
        yield


def policy(span: int | None = None, back: int | None = None) -> dict[str, Any]:
    return {
        "schema_version": 1,
        "max_span": {"quantity": span, "time_grain": "P1D"} if span else None,
        "max_look_back": {"quantity": back, "time_grain": "P1D"} if back else None,
        "max_look_forward": None,
    }


@pytest.fixture
def look_back_30(mocker: MockerFixture) -> None:
    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": policy(back=30)})


OLD = "2000-01-01 : 2001-01-01"
RECENT = "2026-10-20 : 2026-11-01"
ONE_SIDED = "2026-10-30 : "


def tr(column: str, value: str) -> dict[str, Any]:
    return {"col": column, "op": "TEMPORAL_RANGE", "val": value}


def body(**query: Any) -> dict[str, Any]:
    return {
        "datasource": {"id": VIEW_ID, "type": "semantic_view"},
        "queries": [{"metrics": ["total_amount"], "columns": ["category"], **query}],
        "result_type": "full",
        "result_format": "json",
    }


PROBES: dict[str, dict[str, Any]] = {
    "A x-axis + filter out of range": body(
        columns=[X_AXIS], filters=[tr("order_date", OLD)]
    ),
    "B no time filter": body(),
    "C granularity + time_range out of range": body(
        granularity="order_date", time_range=OLD
    ),
    "D filter on ship_date, x-axis order_date": body(
        columns=[X_AXIS], filters=[tr("ship_date", OLD)]
    ),
    "E time_range only, no time column": body(time_range=OLD),
    "G granularity + one-sided time_range": body(
        granularity="order_date", time_range=ONE_SIDED
    ),
    "H x-axis + one-sided filter": body(
        columns=[X_AXIS], filters=[tr("order_date", ONE_SIDED)]
    ),
    "I granularity + one-sided filter on it": body(
        granularity="order_date", filters=[tr("order_date", ONE_SIDED)]
    ),
    "No filter on the x-axis": body(
        columns=[X_AXIS], filters=[tr("order_date", "No filter")]
    ),
}


def reason(response: Any) -> str | None:
    errors = (response.json or {}).get("errors") or []
    return errors[0].get("extra", {}).get("reason_code") if errors else None


OUT_OF_RANGE = {
    "A x-axis + filter out of range",
    "C granularity + time_range out of range",
    "D filter on ship_date, x-axis order_date",
}


@freeze_time(NOW)
@pytest.mark.usefixtures("full_api_access", "flag_on", "look_back_30")
@pytest.mark.parametrize("probe", list(PROBES))
def test_probes_are_rejected_before_the_provider_runs(
    client: FlaskClient, timed_view: TimedOrdersView, probe: str
) -> None:
    response = client.post("/api/v1/chart/data", json=PROBES[probe])
    assert response.status_code == 400, (probe, response.json)
    assert reason(response) == (
        "MAX_LOOK_BACK_EXCEEDED" if probe in OUT_OF_RANGE else "UNBOUNDED_RANGE"
    ), response.json
    assert timed_view.queries == []


@freeze_time(NOW)
@pytest.mark.usefixtures("full_api_access", "flag_on", "look_back_30")
def test_semantic_probe_keeps_the_mapper_error(
    client: FlaskClient, timed_view: TimedOrdersView
) -> None:
    response = client.post(
        "/api/v1/chart/data",
        json=body(columns=[X_AXIS], filters=[tr("Order date", RECENT)]),
    )
    assert response.status_code == 400
    assert reason(response) is None
    assert "not in this semantic view" in response.json["message"]


@freeze_time(NOW)
@pytest.mark.usefixtures("full_api_access", "flag_on", "look_back_30")
@pytest.mark.parametrize(
    "request_body",
    [
        body(columns=[X_AXIS], filters=[tr("order_date", RECENT)]),
        body(granularity="order_date", time_range=RECENT),
    ],
    ids=["x-axis", "granularity"],
)
def test_a_range_within_the_limits_reaches_the_provider(
    client: FlaskClient, timed_view: TimedOrdersView, request_body: dict[str, Any]
) -> None:
    response = client.post("/api/v1/chart/data", json=request_body)
    assert response.status_code == 200, response.json
    assert timed_view.provider_filters() == [
        "order_date < 2026-11-01 00:00:00",
        "order_date >= 2026-10-20 00:00:00",
    ]


@freeze_time(NOW)
@pytest.mark.usefixtures("full_api_access", "flag_on", "look_back_30")
def test_a_filter_on_another_temporal_dimension_bounds_that_dimension(
    client: FlaskClient, timed_view: TimedOrdersView
) -> None:
    response = client.post(
        "/api/v1/chart/data",
        json=body(
            columns=[X_AXIS],
            filters=[tr("order_date", RECENT), tr("ship_date", OLD)],
        ),
    )
    assert response.status_code == 400, response.json
    assert reason(response) == "MAX_LOOK_BACK_EXCEEDED"
    assert timed_view.queries == []


@freeze_time(NOW)
@pytest.mark.usefixtures("full_api_access", "flag_on")
@pytest.mark.parametrize("offset,status", [("1 year ago", 200), ("2 years ago", 400)])
def test_a_time_comparison_is_judged_as_the_mapper_shifts_it(
    client: FlaskClient,
    timed_view: TimedOrdersView,
    mocker: MockerFixture,
    offset: str,
    status: int,
) -> None:
    mocker.patch.dict(
        current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": policy(back=400)}
    )
    response = client.post(
        "/api/v1/chart/data",
        json=body(
            columns=[X_AXIS],
            filters=[tr("order_date", RECENT)],
            time_offsets=[offset],
        ),
    )
    assert response.status_code == status, response.json
    if status == 400:
        assert reason(response) == "MAX_LOOK_BACK_EXCEEDED"
        assert timed_view.queries == []
    else:
        assert "order_date >= 2025-10-20 00:00:00" in timed_view.provider_filters()


@freeze_time(NOW)
@pytest.mark.usefixtures("full_api_access", "flag_on", "look_back_30")
def test_a_comparison_that_is_not_a_time_series_shifts_the_other_filters(
    client: FlaskClient, timed_view: TimedOrdersView
) -> None:
    response = client.post(
        "/api/v1/chart/data",
        json=body(
            filters=[
                tr("order_date", RECENT),
                tr("ship_date", "2026-10-08 : 2026-10-31"),
            ],
            time_offsets=["1 week ago"],
        ),
    )
    assert response.status_code == 400, response.json
    error = response.json["errors"][0]
    assert error["extra"]["reason_code"] == "MAX_LOOK_BACK_EXCEEDED"
    assert error["extra"]["time_offset"] == "1 week ago"
    assert timed_view.queries == []


@freeze_time(NOW)
@pytest.mark.usefixtures("full_api_access", "flag_on", "look_back_30")
def test_only_the_axis_filter_the_bounds_replace_is_dropped(
    client: FlaskClient, timed_view: TimedOrdersView
) -> None:
    response = client.post(
        "/api/v1/chart/data",
        json=body(
            columns=[X_AXIS],
            filters=[tr("order_date", RECENT), tr("order_date", OLD)],
        ),
    )
    assert response.status_code == 400, response.json
    assert reason(response) == "MAX_LOOK_BACK_EXCEEDED"
    assert timed_view.queries == []


class GrainedOrdersView(TimedOrdersView):
    """``TimedOrdersView`` with a month variant of ``ship_date``."""

    def get_dimensions(self) -> set[Dimension]:
        return {
            *super().get_dimensions(),
            Dimension(
                "ship_date_month", "ship_date", pa.timestamp("us"), grain=Grains.MONTH
            ),
        }


@freeze_time(NOW)
@pytest.mark.usefixtures("full_api_access", "flag_on")
@pytest.mark.parametrize("grain,status", [(None, 200), ("P1M", 400)])
def test_a_filter_grain_widens_the_range_it_bounds(
    client: FlaskClient,
    stub_layer: type[SemanticLayer[Any, Any]],
    mocker: MockerFixture,
    grain: str | None,
    status: int,
) -> None:
    view = GrainedOrdersView()
    serve(mocker, view)
    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": policy(span=7)})
    response = client.post(
        "/api/v1/chart/data",
        json=body(
            columns=[X_AXIS],
            filters=[
                tr("order_date", "2026-10-30 : 2026-11-01"),
                {
                    **tr("ship_date", "2026-10-02 : 2026-10-03"),
                    **({"grain": grain} if grain else {}),
                },
            ],
        ),
    )
    assert response.status_code == status, response.json
    if status == 400:
        assert reason(response) == "MAX_SPAN_EXCEEDED"
        assert view.queries == []


@freeze_time(NOW)
@pytest.mark.usefixtures("full_api_access", "flag_on", "look_back_30")
def test_a_view_with_no_temporal_dimension_is_not_limited(
    client: FlaskClient, stub_orders: SemanticViewABC
) -> None:
    from superset.daos.datasource import DatasourceDAO
    from superset.time_range_limits.enforcement import has_temporal_column

    response = client.post("/api/v1/chart/data", json=body())
    assert response.status_code == 200, response.json
    assert response.json["result"][0]["data"]
    assert not has_temporal_column(DatasourceDAO.get_datasource("semantic_view", 91))


@freeze_time(NOW)
@pytest.mark.usefixtures("full_api_access", "flag_on", "look_back_30")
def test_a_view_with_no_preferred_temporal_dimension_is_still_checked(
    client: FlaskClient,
    stub_layer: type[SemanticLayer[Any, Any]],
    mocker: MockerFixture,
) -> None:
    view = TimedOrdersView(preferred=None)
    serve(mocker, view)
    response = client.post("/api/v1/chart/data", json=body())
    assert response.status_code == 400
    assert reason(response) == "UNBOUNDED_RANGE"


@freeze_time(NOW)
@pytest.mark.usefixtures("full_api_access", "look_back_30")
def test_flag_off_runs_as_on_master(
    client: FlaskClient, timed_view: TimedOrdersView
) -> None:
    with flag(False):
        response = client.post(
            "/api/v1/chart/data", json=PROBES["A x-axis + filter out of range"]
        )
    assert response.status_code == 200, response.json
    assert len(timed_view.queries) == 1


# The dashboard level


def semantic_dashboard(
    limits: dict[str, Any] | None = None,
    slice_type: str = "semantic_view",
    native_filters: list[dict[str, Any]] | None = None,
    position_json: str | None = None,
) -> Any:
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

    metadata: dict[str, Any] = {"native_filter_configuration": native_filters or []}
    if limits is not None:
        metadata["time_range_limits"] = limits
    return Dashboard(
        id=3,
        json_metadata=json.dumps(metadata),
        position_json=position_json,
        slices=[Slice(id=11, datasource_id=VIEW_ID, datasource_type=slice_type)],
    )


def use_dashboard(mocker: MockerFixture, dashboard: Any) -> None:
    mocker.patch(
        "superset.daos.dashboard.DashboardDAO.find_by_id",
        side_effect=lambda model_id, **kwargs: dashboard
        if model_id == dashboard.id
        else None,
    )


@freeze_time(NOW)
@pytest.mark.usefixtures("full_api_access", "flag_on", "look_back_30")
@pytest.mark.parametrize("slice_type,status", [("semantic_view", 400), ("table", 200)])
def test_the_dashboard_limit_applies_to_a_chart_on_the_view(
    client: FlaskClient,
    timed_view: TimedOrdersView,
    mocker: MockerFixture,
    slice_type: str,
    status: int,
) -> None:
    as_user(mocker, "admin")
    use_dashboard(mocker, semantic_dashboard(policy(back=5), slice_type))
    request_body = body(columns=[X_AXIS], filters=[tr("order_date", RECENT)])
    request_body["form_data"] = {"dashboardId": 3, "slice_id": 11}

    response = client.post("/api/v1/chart/data", json=request_body)

    assert response.status_code == status, response.json
    if status == 400:
        extra = response.json["errors"][0]["extra"]
        assert (extra["source"], extra["dashboard_id"]) == ("dashboard", 3)


# The async worker's re-check


@freeze_time(NOW)
@pytest.mark.usefixtures("flag_on")
def test_the_async_worker_rejects_a_query_tightened_while_queued(
    timed_view: TimedOrdersView, mocker: MockerFixture
) -> None:
    from superset_core.tasks.types import TaskStatus

    from tests.fixtures.time_range_request_paths import run_worker_task

    as_user(mocker, "admin")
    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": policy(back=30)})
    query_context = semantic_context(
        [query(columns=[X_AXIS], filters=[tr("order_date", RECENT)])]
    )
    check(query_context)
    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": policy(back=5)})
    sql = mocker.patch.object(query_context, "get_df_payload_result")

    result, _transition, task_context = run_worker_task(mocker, query_context)

    assert result["status"] == TaskStatus.FAILURE.value
    sql.assert_not_called()
    task_context.update_task.assert_called_once_with(
        payload={"time_range_limit_error": "MAX_LOOK_BACK_EXCEEDED"},
        immediate=True,
    )


def semantic_context(
    queries: list[dict[str, Any]], form_data: dict[str, Any] | None = None
) -> Any:
    from superset.common.query_context_factory import QueryContextFactory

    return QueryContextFactory().create(
        datasource={"type": "semantic_view", "id": VIEW_ID},
        queries=queries,
        form_data=form_data or {},
    )


def check(query_context: Any) -> None:
    from superset.time_range_limits.enforcement import (
        check_query_context_date_ranges,
    )

    check_query_context_date_ranges(query_context)


# GET /api/v1/chart/<pk>/data/?filters_dashboard_id=


@freeze_time(NOW)
@pytest.mark.usefixtures("full_api_access", "flag_on")
def test_filters_dashboard_id_applies_the_dashboard_limit_to_a_saved_chart(
    client: FlaskClient, timed_view: TimedOrdersView, mocker: MockerFixture
) -> None:
    from flask import Response

    from superset.charts.data.api import ChartDataRestApi

    as_user(mocker, "admin")
    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": None})
    use_dashboard(mocker, semantic_dashboard(policy(back=5)))
    saved = MagicMock(id=11, params="{}")
    request_body = body(columns=[X_AXIS], filters=[tr("order_date", RECENT)])
    request_body["form_data"] = {"slice_id": 11}
    saved.query_context = json.dumps(request_body)
    mocker.patch.object(ChartDataRestApi.datamodel, "get", return_value=saved)
    mocker.patch(
        "superset.charts.data.api.get_dashboard_filter_context",
        return_value=MagicMock(extra_form_data={}),
    )
    data = mocker.patch(
        "superset.charts.data.api.ChartDataRestApi._get_data_response",
        return_value=Response("{}", status=200),
    )

    rejected = client.get("/api/v1/chart/11/data/?filters_dashboard_id=3")
    without = client.get("/api/v1/chart/11/data/")

    assert rejected.status_code == 400, rejected.json
    extra = rejected.json["errors"][0]["extra"]
    assert (extra["source"], extra["dashboard_id"]) == ("dashboard", 3)
    assert without.status_code == 200
    data.assert_called_once()


# The ranges the dashboard hold reads


@freeze_time(NOW)
@pytest.mark.usefixtures("full_api_access", "flag_on", "look_back_30")
def test_chart_ranges_reads_what_the_mapper_sends(
    client: FlaskClient, timed_view: TimedOrdersView
) -> None:
    response = client.post(
        "/api/v1/time_range_limits/chart_ranges/",
        json={
            "charts": [
                {
                    "key": "bounded",
                    "query_context": body(
                        columns=[X_AXIS], filters=[tr("order_date", OLD)]
                    ),
                },
                {"key": "open", "query_context": body()},
            ]
        },
    )

    assert response.status_code == 200, response.json
    bounded, open_ = response.json["result"]["charts"]
    assert bounded["status"] == "ok", bounded
    assert bounded["dataset_id"] is None
    assert [(r["since"], r["until"]) for r in bounded["ranges"]] == [
        ("2000-01-01T00:00:00", "2001-01-01T00:00:00")
    ]
    assert bounded["ranges"][0]["source"] == [
        {"kind": "adhoc_filter", "query_index": 0, "index": 0}
    ]
    assert [(r["since"], r["until"], r["source"]) for r in open_["ranges"]] == [
        (None, None, None)
    ]
    assert timed_view.queries == []


# Native filters


SELECT_FILTER = {
    "id": "NATIVE_FILTER-select",
    "filterType": "filter_select",
    "targets": [
        {
            "datasetId": VIEW_ID,
            "datasourceType": "semantic_view",
            "column": {"name": "category"},
        }
    ],
    "controlValues": {},
}
VALUES_FORM_DATA = {
    "type": "NATIVE_FILTER",
    "native_filter_id": "NATIVE_FILTER-select",
    "dashboardId": 3,
}


@freeze_time(NOW)
@pytest.mark.usefixtures("flag_on", "look_back_30")
def test_a_select_filter_value_list_on_the_view_may_run_open(
    timed_view: TimedOrdersView, mocker: MockerFixture
) -> None:
    from superset.time_range_limits.policy import TimeRangeLimitError

    as_user(mocker, "admin")
    use_dashboard(mocker, semantic_dashboard(native_filters=[SELECT_FILTER]))
    values = [{"columns": ["category"], "metrics": []}]

    check(semantic_context(values, VALUES_FORM_DATA))
    with pytest.raises(TimeRangeLimitError):
        check(semantic_context(values, {"dashboardId": 3}))


@freeze_time(NOW)
@pytest.mark.usefixtures("flag_on", "look_back_30")
def test_a_semantic_view_filter_does_not_exempt_a_table_with_the_same_id(
    mocker: MockerFixture,
) -> None:
    from superset.time_range_limits.policy import TimeRangeLimitError
    from tests.fixtures.time_range_enforcement import (
        make_context,
        make_dataset,
        use_datasource,
    )

    as_user(mocker, "admin")
    mocker.patch(
        "superset.extensions.security_manager.get_guest_rls_filters", return_value=[]
    )
    table = make_dataset()
    table.id = VIEW_ID
    use_datasource(mocker, table)
    on_name = {
        **SELECT_FILTER,
        "targets": [
            {
                "datasetId": VIEW_ID,
                "datasourceType": "semantic_view",
                "column": {"name": "name"},
            }
        ],
    }
    use_dashboard(mocker, semantic_dashboard(native_filters=[on_name]))

    with pytest.raises(TimeRangeLimitError) as info:
        check(make_context([{"columns": ["name"], "metrics": []}], VALUES_FORM_DATA))
    assert info.value.error.extra["reason_code"] == "UNBOUNDED_RANGE"


@freeze_time(NOW)
@pytest.mark.usefixtures("flag_on", "look_back_30")
def test_a_target_with_no_type_is_a_dataset_target(
    timed_view: TimedOrdersView, mocker: MockerFixture
) -> None:
    from superset.time_range_limits.policy import TimeRangeLimitError

    as_user(mocker, "admin")
    untyped = {
        **SELECT_FILTER,
        "targets": [{"datasetId": VIEW_ID, "column": {"name": "category"}}],
    }
    use_dashboard(mocker, semantic_dashboard(native_filters=[untyped]))

    with pytest.raises(TimeRangeLimitError):
        check(
            semantic_context(
                [{"columns": ["category"], "metrics": []}], VALUES_FORM_DATA
            )
        )


# The column values API


@pytest.mark.usefixtures("full_api_access", "look_back_30")
@pytest.mark.parametrize("flag_value", [True, False])
def test_column_values_on_a_view_with_a_temporal_dimension(
    client: FlaskClient, timed_view: TimedOrdersView, flag_value: bool
) -> None:
    with flag(flag_value):
        response = client.get(
            f"/api/v1/datasource/semantic_view/{VIEW_ID}/column/category/values/"
        )
    assert response.status_code == 200, response.json


# MCP get_table


@freeze_time(NOW)
@pytest.mark.usefixtures("flag_on", "look_back_30")
def test_get_table_queries_are_checked(
    timed_view: TimedOrdersView, mocker: MockerFixture
) -> None:
    from superset.common.tabular_query import execute_tabular_query
    from superset.extensions import security_manager
    from superset.mcp_service.semantic_layer.schemas import GetTableRequest
    from superset.mcp_service.semantic_layer.tool.get_table import _build_query_dict
    from superset.time_range_limits.policy import TimeRangeLimitError

    def run(time_range: str | None) -> Any:
        request = GetTableRequest(
            view_id=VIEW_ID,
            metrics=["total_amount"],
            dimensions=["order_date"],
            time_range=time_range,
        )
        return execute_tabular_query(
            VIEW_ID, "semantic_view", _build_query_dict(request, "order_date")
        )

    mocker.patch.object(security_manager, "raise_for_access")
    for time_range, reason_code in (
        (OLD, "MAX_LOOK_BACK_EXCEEDED"),
        (None, "UNBOUNDED_RANGE"),
    ):
        with pytest.raises(TimeRangeLimitError) as info:
            run(time_range)
        assert info.value.error.extra["reason_code"] == reason_code
    assert timed_view.queries == []
    run(RECENT)
    assert len(timed_view.queries) == 1


def as_user(mocker: MockerFixture, kind: str) -> None:
    from tests.fixtures.time_range_enforcement import as_user as as_dataset_user

    as_dataset_user(mocker, kind)


# Saved charts: the save check and reports


def semantic_chart(
    chart_id: int = 11,
    request_body: dict[str, Any] | None = None,
    name: str = "Orders by day",
    **form_data: Any,
) -> Any:
    from superset.daos.datasource import DatasourceDAO
    from superset.models.slice import Slice

    view = DatasourceDAO.get_datasource("semantic_view", VIEW_ID)
    params = {
        "datasource": f"{VIEW_ID}__semantic_view",
        "viz_type": "echarts_timeseries_bar",
        **form_data,
    }
    if request_body is not None:
        request_body = {**request_body, "form_data": {**params, "slice_id": chart_id}}
    return Slice(
        id=chart_id,
        slice_name=name,
        datasource_id=VIEW_ID,
        datasource_type="semantic_view",
        semantic_view=view,
        viz_type="echarts_timeseries_bar",
        params=json.dumps(params),
        query_context=json.dumps(request_body) if request_body is not None else None,
    )


OLD_CHART = body(columns=[X_AXIS], filters=[tr("order_date", OLD)])
RECENT_CHART = body(columns=[X_AXIS], filters=[tr("order_date", RECENT)])


def save_check(
    chart: Any,
    proposed: dict[str, Any] | None = None,
    datasets: dict[int, Any] | None = None,
) -> dict[str, Any]:
    from superset.time_range_limits.policy import parse_time_range_limits
    from superset.time_range_limits.save_check import (
        dashboard_save_check,
        StoredLevels,
    )

    dashboard = semantic_dashboard()
    dashboard.slices = [chart]
    levels = StoredLevels(
        parse_time_range_limits(current_app.config["TIME_RANGE_LIMITS_GLOBAL"]),
        {
            key: parse_time_range_limits(value)
            for key, value in (datasets or {}).items()
        },
    )
    return dashboard_save_check(
        dashboard, levels, parse_time_range_limits(proposed), datetime.now()
    )


def listed(result: dict[str, Any]) -> dict[str, list[int]]:
    return {key: [item["id"] for item in items] for key, items in result.items()}


@freeze_time(NOW)
@pytest.mark.usefixtures("flag_on", "look_back_30")
def test_the_save_check_lists_a_semantic_chart_the_policy_breaks(
    timed_view: TimedOrdersView, mocker: MockerFixture
) -> None:
    as_user(mocker, "admin")
    result = save_check(semantic_chart(request_body=OLD_CHART))
    assert listed(result) == {
        "charts": [11],
        "filters": [],
        "unlimited": [],
        "unchecked": [],
    }
    assert result["charts"][0]["reason_code"] == "MAX_LOOK_BACK_EXCEEDED"
    assert listed(save_check(semantic_chart(request_body=RECENT_CHART)))["charts"] == []


@freeze_time(NOW)
@pytest.mark.usefixtures("flag_on", "look_back_30")
def test_a_semantic_chart_with_no_saved_query_context_is_unchecked(
    timed_view: TimedOrdersView, mocker: MockerFixture
) -> None:
    as_user(mocker, "admin")
    result = save_check(semantic_chart(request_body=None, time_range=OLD))
    assert listed(result)["unchecked"] == [11]


@freeze_time(NOW)
@pytest.mark.usefixtures("flag_on", "look_back_30")
def test_a_chart_on_a_view_with_no_temporal_dimension_is_unlimited(
    stub_orders: SemanticViewABC, mocker: MockerFixture
) -> None:
    as_user(mocker, "admin")
    result = save_check(semantic_chart(request_body=body()))
    assert listed(result)["unlimited"] == [11]


@freeze_time(NOW)
@pytest.mark.usefixtures("flag_on")
def test_a_dataset_policy_never_applies_to_a_view_with_the_same_id(
    timed_view: TimedOrdersView, mocker: MockerFixture
) -> None:
    as_user(mocker, "admin")
    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": None})
    result = save_check(
        semantic_chart(request_body=RECENT_CHART), datasets={VIEW_ID: policy(back=5)}
    )
    assert listed(result)["charts"] == []


def report_state(chart: Any, mocker: MockerFixture) -> Any:
    from flask_appbuilder.security.sqla.models import User

    from superset.commands.report.execute import BaseReportState
    from superset.reports.models import ReportScheduleType
    from superset.tasks.types import FixedExecutor
    from tests.unit_tests.commands.report.execute_test import (
        _active_report_context,
        create_report_schedule,
    )

    user = User(id=9, username="report_executor", active=True)
    mocker.patch.dict(
        current_app.config,
        {"ALERT_REPORTS_EXECUTORS": [FixedExecutor(username=user.username)]},
    )
    mocker.patch(
        "superset.commands.report.execute.security_manager.find_user", return_value=user
    )
    mocker.patch(
        "superset.commands.report.execute.get_dynamic_executor", return_value=None
    )
    schedule = create_report_schedule(mocker)
    schedule.id = 11
    schedule.type = ReportScheduleType.REPORT
    schedule.chart = chart
    schedule.chart_id = chart.id
    context = _active_report_context()
    return BaseReportState(
        schedule, datetime(2021, 1, 1), context.execution_id, context
    )


def report_errors(state: Any) -> list[Any] | None:
    from superset.commands.report.exceptions import (
        ReportScheduleTimeRangeLimitError,
    )

    try:
        state._check_date_ranges()
    except ReportScheduleTimeRangeLimitError as ex:
        return ex.errors
    return None


@freeze_time(NOW)
@pytest.mark.usefixtures("flag_on", "look_back_30")
def test_a_chart_report_on_a_semantic_chart_is_checked(
    timed_view: TimedOrdersView, mocker: MockerFixture
) -> None:
    as_user(mocker, "admin")
    errors = report_errors(report_state(semantic_chart(request_body=OLD_CHART), mocker))
    assert errors is not None
    assert [error.extra["reason_code"] for error in errors] == [
        "MAX_LOOK_BACK_EXCEEDED"
    ]
    assert (
        report_errors(report_state(semantic_chart(request_body=RECENT_CHART), mocker))
        is None
    )


@freeze_time(NOW)
@pytest.mark.usefixtures("flag_on")
def test_a_chart_report_applies_the_saved_dashboard_limit(
    timed_view: TimedOrdersView, mocker: MockerFixture
) -> None:
    as_user(mocker, "admin")
    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": None})
    use_dashboard(mocker, semantic_dashboard(policy(back=5)))
    chart = semantic_chart(request_body=RECENT_CHART, dashboardId=3)

    errors = report_errors(report_state(chart, mocker))

    assert errors is not None
    assert [(e.extra["reason_code"], e.extra["source"]) for e in errors] == [
        ("MAX_LOOK_BACK_EXCEEDED", "dashboard")
    ]


@freeze_time(NOW)
@pytest.mark.usefixtures("flag_on", "look_back_30")
def test_a_dashboard_report_checks_its_semantic_chart(
    timed_view: TimedOrdersView, mocker: MockerFixture
) -> None:
    from superset.commands.report.execute import _ReportPage, BaseReportState
    from tests.fixtures.time_range_query_paths import layout

    as_user(mocker, "admin")
    chart = semantic_chart(request_body=OLD_CHART)
    dashboard = semantic_dashboard(position_json=layout(11))
    dashboard.slices = [chart]
    state = report_state(chart, mocker)
    state._report_schedule.chart = None
    state._report_schedule.dashboard = dashboard
    mocker.patch.object(BaseReportState, "_raise_for_executor_dashboard_access")
    mocker.patch.object(
        BaseReportState, "_report_page", return_value=_ReportPage(None, None, {})
    )

    errors = report_errors(state)

    assert errors is not None
    assert [error.extra["reason_code"] for error in errors] == [
        "MAX_LOOK_BACK_EXCEEDED"
    ]


@freeze_time(NOW)
@pytest.mark.usefixtures("flag_on", "look_back_30")
def test_a_chart_report_on_a_view_with_no_temporal_dimension_is_sent(
    stub_orders: SemanticViewABC, mocker: MockerFixture
) -> None:
    as_user(mocker, "admin")
    chart = semantic_chart(request_body=None, time_range=OLD)
    assert report_errors(report_state(chart, mocker)) is None


@freeze_time(NOW)
@pytest.mark.usefixtures("flag_on", "look_back_30")
def test_a_dashboard_report_on_a_view_with_no_temporal_dimension_is_sent(
    stub_orders: SemanticViewABC, mocker: MockerFixture
) -> None:
    from superset.commands.report.execute import _ReportPage, BaseReportState
    from tests.fixtures.time_range_query_paths import layout

    as_user(mocker, "admin")
    chart = semantic_chart(request_body=None, time_range=OLD)
    dashboard = semantic_dashboard(position_json=layout(11))
    dashboard.slices = [chart]
    state = report_state(chart, mocker)
    state._report_schedule.chart = None
    state._report_schedule.dashboard = dashboard
    mocker.patch.object(BaseReportState, "_raise_for_executor_dashboard_access")
    mocker.patch.object(
        BaseReportState, "_report_page", return_value=_ReportPage(None, None, {})
    )

    assert report_errors(state) is None


# Telemetry


@freeze_time(NOW)
@pytest.mark.usefixtures("full_api_access", "flag_on", "look_back_30")
def test_a_rejection_on_a_view_is_logged_without_a_dataset_id(
    client: FlaskClient,
    timed_view: TimedOrdersView,
    caplog: pytest.LogCaptureFixture,
) -> None:
    from tests.fixtures.time_range_telemetry import LOGGER

    caplog.set_level(logging.INFO, logger=LOGGER)
    response = client.post("/api/v1/chart/data", json=OLD_CHART)

    assert response.status_code == 400
    (record,) = [r for r in caplog.records if r.name == LOGGER]
    fields = record.time_range_limit
    assert fields["dataset_id"] == "none"
    assert fields["reason_code"] == "MAX_LOOK_BACK_EXCEEDED"


@freeze_time(NOW)
@pytest.mark.usefixtures("full_api_access", "flag_on", "look_back_30")
@pytest.mark.parametrize(
    "probe",
    ["G granularity + one-sided time_range", "I granularity + one-sided filter on it"],
)
def test_a_one_sided_axis_range_reads_as_open_as_the_mapper_drops_it(
    client: FlaskClient, timed_view: TimedOrdersView, probe: str
) -> None:
    response = client.post(
        "/api/v1/time_range_limits/chart_ranges/",
        json={"charts": [{"key": probe, "query_context": PROBES[probe]}]},
    )

    assert response.status_code == 200, response.json
    (answer,) = response.json["result"]["charts"]
    assert [(r["since"], r["until"], r["source"]) for r in answer["ranges"]] == [
        (None, None, None)
    ]


@freeze_time(NOW)
@pytest.mark.usefixtures("flag_on")
def test_an_unbuildable_chart_report_fails_with_only_its_saved_dashboard_limit(
    timed_view: TimedOrdersView, mocker: MockerFixture
) -> None:
    as_user(mocker, "admin")
    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": None})
    use_dashboard(mocker, semantic_dashboard(policy(back=5)))
    chart = semantic_chart(request_body=None, dashboardId=3, time_range=RECENT)

    errors = report_errors(report_state(chart, mocker))

    assert errors is not None
    assert [error.extra["reason_code"] for error in errors] == ["POLICY_UNAVAILABLE"]


class BrokenMetadataView(TimedOrdersView):
    """A view whose provider fails to list its dimensions."""

    def get_dimensions(self) -> set[Dimension]:
        raise RuntimeError("metadata unavailable")


@freeze_time(NOW)
@pytest.mark.usefixtures("flag_on", "look_back_30")
def test_a_report_fails_closed_when_the_view_metadata_cannot_be_read(
    stub_layer: type[SemanticLayer[Any, Any]], mocker: MockerFixture
) -> None:
    serve(mocker, BrokenMetadataView())
    as_user(mocker, "admin")
    chart = semantic_chart(request_body=None, time_range=OLD)

    errors = report_errors(report_state(chart, mocker))

    assert errors is not None
    assert [error.extra["reason_code"] for error in errors] == ["POLICY_UNAVAILABLE"]
