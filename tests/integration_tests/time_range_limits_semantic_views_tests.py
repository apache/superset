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
"""Time range limits on charts over persisted semantic views."""

from __future__ import annotations

import uuid
from collections.abc import Iterator
from datetime import datetime, timedelta
from typing import Any
from unittest.mock import patch, PropertyMock

import pytest
from flask.testing import FlaskClient
from superset_core.semantic_layers.layer import SemanticLayer as ProviderLayer

from superset import db
from superset.commands.report.exceptions import ReportScheduleTimeRangeLimitError
from superset.commands.report.execute import BaseReportState
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.reports.models import ReportSchedule, ReportScheduleType
from superset.semantic_layers.models import SemanticLayer, SemanticView
from superset.time_range_limits.policy import FEATURE_FLAG
from superset.utils import json
from tests.fixtures.time_range_semantic_views import TimedOrdersView, X_AXIS
from tests.integration_tests.conftest import with_feature_flags
from tests.integration_tests.test_app import app

FLAGS = {FEATURE_FLAG: True, "SEMANTIC_LAYERS": True}
LOOK_BACK_30 = {
    "TIME_RANGE_LIMITS_GLOBAL": {
        "schema_version": 1,
        "max_span": None,
        "max_look_back": {"quantity": 30, "time_grain": "P1D"},
        "max_look_forward": None,
    }
}
DASHBOARD_LOOK_BACK_5 = {
    "schema_version": 1,
    "max_span": None,
    "max_look_back": {"quantity": 5, "time_grain": "P1D"},
    "max_look_forward": None,
}


def day(days_ago: int) -> str:
    today = datetime.combine(datetime.now().date(), datetime.min.time())
    return (today - timedelta(days=days_ago)).isoformat()


OLD = "2000-01-01 : 2001-01-01"
RECENT = f"{day(12)} : {day(1)}"


def chart_body(view_id: int, time_range: str | None, **form_data: Any) -> Any:
    filters = (
        [{"col": "order_date", "op": "TEMPORAL_RANGE", "val": time_range}]
        if time_range
        else []
    )
    return {
        "datasource": {"id": view_id, "type": "semantic_view"},
        "queries": [
            {
                "columns": [X_AXIS] if time_range else ["category"],
                "metrics": ["total_amount"],
                "filters": filters,
            }
        ],
        "form_data": form_data,
        "result_type": "full",
        "result_format": "json",
    }


@pytest.fixture
def provider() -> Iterator[TimedOrdersView]:
    view = TimedOrdersView()
    with (
        patch.object(
            SemanticView,
            "implementation",
            new_callable=PropertyMock,
            return_value=view,
        ),
        patch.dict("superset.semantic_layers.models.registry", {"test": ProviderLayer}),
    ):
        yield view


@pytest.fixture
def semantic(app_context: Any, provider: TimedOrdersView) -> Iterator[dict[str, Any]]:
    """A persisted view, a chart on it saved with a recent range, and a
    dashboard with that chart and a 5-day look-back."""
    suffix = uuid.uuid4().hex[:8]
    layer = SemanticLayer(
        uuid=uuid.uuid4(), name=f"limits_{suffix}", type="test", configuration="{}"
    )
    view = SemanticView(
        uuid=uuid.uuid4(),
        name=f"limits_view_{suffix}",
        semantic_layer=layer,
        configuration="{}",
    )
    db.session.add_all([layer, view])
    db.session.flush()
    chart = Slice(
        slice_name=f"Orders by day {suffix}",
        viz_type="echarts_timeseries_bar",
        datasource_type="semantic_view",
        datasource_id=view.id,
        params=json.dumps({"datasource": f"{view.id}__semantic_view"}),
    )
    db.session.add(chart)
    db.session.flush()
    chart.query_context = json.dumps(chart_body(view.id, RECENT, slice_id=chart.id))
    position: dict[str, Any] = {
        "ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["GRID_ID"]},
        "GRID_ID": {"id": "GRID_ID", "type": "GRID", "children": ["ROW-1"]},
        "ROW-1": {"id": "ROW-1", "type": "ROW", "children": [f"CHART-{chart.id}"]},
        f"CHART-{chart.id}": {
            "id": f"CHART-{chart.id}",
            "type": "CHART",
            "children": [],
            "meta": {"chartId": chart.id},
        },
    }
    dashboard = Dashboard(
        dashboard_title=f"Semantic limits {suffix}",
        slug=f"semantic-limits-{suffix}",
        slices=[chart],
        position_json=json.dumps(position),
        json_metadata=json.dumps({"time_range_limits": DASHBOARD_LOOK_BACK_5}),
        published=True,
    )
    db.session.add(dashboard)
    db.session.commit()
    ids = {"view": view.id, "chart": chart.id, "dashboard": dashboard.id}
    layer_uuid = layer.uuid

    yield ids

    db.session.rollback()
    db.session.delete(db.session.get(Dashboard, ids["dashboard"]))
    db.session.delete(db.session.get(Slice, ids["chart"]))
    db.session.delete(db.session.get(SemanticView, ids["view"]))
    db.session.delete(db.session.get(SemanticLayer, layer_uuid))
    db.session.commit()


def reason(response: Any) -> Any:
    (error,) = response.json["errors"]
    assert error["error_type"] == "TIME_RANGE_LIMIT_ERROR"
    return error["extra"]["reason_code"], error["extra"]["source"]


@with_feature_flags(**FLAGS)
def test_chart_data_on_a_persisted_view(
    semantic: dict[str, Any],
    provider: TimedOrdersView,
    test_client: FlaskClient,
    login_as_admin: None,
) -> None:
    def post(time_range: str | None) -> Any:
        return test_client.post(
            "/api/v1/chart/data", json=chart_body(semantic["view"], time_range)
        )

    with patch.dict(app.config, LOOK_BACK_30):
        old, open_ = post(OLD), post(None)
        assert old.status_code == 400, old.json
        assert reason(old) == ("MAX_LOOK_BACK_EXCEEDED", "global")
        assert open_.status_code == 400, open_.json
        assert reason(open_)[0] == "UNBOUNDED_RANGE"
        assert provider.queries == []
        recent = post(RECENT)
        assert recent.status_code == 200, recent.json
        assert len(provider.queries) == 1


def report_state(chart: Slice) -> BaseReportState:
    schedule = ReportSchedule(
        id=0,
        name="Semantic limits",
        type=ReportScheduleType.REPORT,
        chart=chart,
        chart_id=chart.id,
        extra_json="{}",
    )
    return BaseReportState(schedule, datetime.utcnow(), uuid.uuid4())


@with_feature_flags(**FLAGS)
def test_a_chart_report_on_a_persisted_semantic_chart(
    semantic: dict[str, Any], login_as_admin: None
) -> None:
    from superset import security_manager
    from superset.tasks.types import FixedExecutor

    chart = db.session.get(Slice, semantic["chart"])
    admin = security_manager.find_user("admin")
    with patch.dict(
        app.config,
        {
            **LOOK_BACK_30,
            "ALERT_REPORTS_EXECUTORS": [FixedExecutor(username=admin.username)],
        },
    ):
        state = report_state(chart)
        state._check_date_ranges()

        saved = json.loads(chart.query_context)
        saved["form_data"]["dashboardId"] = semantic["dashboard"]
        chart.query_context = json.dumps(saved)
        db.session.commit()
        with pytest.raises(ReportScheduleTimeRangeLimitError) as info:
            report_state(chart)._check_date_ranges()

    (error,) = info.value.errors
    assert (error.extra["reason_code"], error.extra["source"]) == (
        "MAX_LOOK_BACK_EXCEEDED",
        "dashboard",
    )
