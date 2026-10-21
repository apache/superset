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

"""Scheduled report content accepts charts backed by semantic views."""

from datetime import datetime
from io import BytesIO
from typing import Any
from unittest.mock import MagicMock
from urllib.parse import parse_qs, urlparse

import pandas as pd
import pytest
from flask.testing import FlaskClient
from flask_appbuilder.security.sqla.models import User
from marshmallow import ValidationError
from pytest_mock import MockerFixture
from superset_core.semantic_layers.view import SemanticView as SemanticViewABC
from werkzeug.test import TestResponse

from superset import db
from superset.app import SupersetApp
from superset.commands.report.create import CreateReportScheduleCommand
from superset.commands.report.execute import BaseReportState
from superset.daos.datasource import Datasource, DatasourceDAO
from superset.models.slice import Slice
from superset.reports.models import ReportDataFormat, ReportSchedule, ReportScheduleType
from superset.reports.notifications.base import NotificationContent
from superset.semantic_layers.models import SemanticView
from superset.tasks.types import FixedExecutor
from superset.utils import json
from superset.utils.report_execution import ReportExecutionContext
from superset.utils.screenshots import ChartScreenshot
from tests.unit_tests.commands.report.execute_test import (
    _active_report_context,
    _valid_png,
    create_report_schedule,
)

pytestmark: pytest.MarkDecorator = pytest.mark.parametrize(
    "app", [{"SQLALCHEMY_DATABASE_URI": "sqlite://"}], indirect=True
)


@pytest.fixture
def semantic_report_state(
    app: SupersetApp,
    mocker: MockerFixture,
    stub_view: SemanticViewABC,
    semantic_layers_enabled: None,
) -> BaseReportState:
    """Reuse the report helpers and extension-backed semantic provider fixture."""
    assert db.engine.dialect.name == "sqlite"
    datasource: Datasource = DatasourceDAO.get_datasource("semantic_view", 91)
    assert isinstance(datasource, SemanticView)
    view: SemanticView = datasource
    form_data: dict[str, Any] = {
        "viz_type": "table",
        "datasource": "91__semantic_view",
        "groupby": ["category"],
        "metrics": ["total_amount"],
        "query_mode": "aggregate",
    }
    query_context: dict[str, Any] = {
        "datasource": {"id": 91, "type": "semantic_view"},
        "queries": [
            {
                "columns": ["category"],
                "metrics": ["total_amount"],
                "filters": [{"col": "category", "op": "==", "val": "Books"}],
                "row_limit": 100,
            }
        ],
        "form_data": form_data,
        "result_type": "full",
        "result_format": "json",
    }
    chart: Slice = Slice(
        id=501,
        slice_name="Semantic Books",
        datasource_id=view.id,
        datasource_type="semantic_view",
        semantic_view=view,
        viz_type="table",
        params=json.dumps(form_data),
        query_context=json.dumps(query_context),
    )
    user: User = User(id=9, username="report_executor", active=True)
    mocker.patch.dict(
        app.config,
        {
            "ALERT_REPORTS_EXECUTORS": [FixedExecutor(username=user.username)],
            "THUMBNAIL_EXECUTORS": [FixedExecutor(username=user.username)],
        },
    )
    mocker.patch(
        "superset.commands.report.execute.security_manager.find_user", return_value=user
    )
    mocker.patch(
        "superset.commands.report.execute.get_dynamic_executor", return_value=None
    )
    mocker.patch(
        "superset.commands.report.execute.machine_auth_provider_factory.instance.get_auth_cookies",
        return_value={"session": "test-cookie"},
    )
    schedule: ReportSchedule = create_report_schedule(mocker)
    schedule.id = 11
    schedule.chart = chart
    schedule.chart_id = chart.id
    schedule.force_screenshot = False
    context: ReportExecutionContext = _active_report_context()
    return BaseReportState(
        schedule, datetime(2021, 1, 1), context.execution_id, context
    )


@pytest.mark.parametrize("report_format", [ReportDataFormat.CSV, ReportDataFormat.TEXT])
def test_semantic_chart_report_exports_provider_results(
    client: FlaskClient,
    full_api_access: None,
    mocker: MockerFixture,
    semantic_report_state: BaseReportState,
    report_format: ReportDataFormat,
) -> None:
    """CSV/TEXT preserve the semantic datasource through report and API processing."""
    state: BaseReportState = semantic_report_state
    state._report_schedule.report_format = report_format
    payloads: list[dict[str, Any]] = []

    def post_local(
        chart_url: str,
        auth_cookies: dict[str, str],
        request_payload: dict[str, Any],
        timeout: float | None = None,
    ) -> bytes:
        """Replace outbound HTTP with the actual in-process chart-data endpoint."""
        assert urlparse(chart_url).path.rstrip("/") == "/api/v1/chart/data"
        assert auth_cookies == {"session": "test-cookie"}
        payloads.append(request_payload)
        response: TestResponse = client.post("/api/v1/chart/data", json=request_payload)
        assert response.status_code == 200, response.get_data(as_text=True)
        return response.data

    mocker.patch.object(state, "_post_chart_data", side_effect=post_local)
    content: NotificationContent = state._get_notification_content()
    assert len(payloads) == 1
    assert payloads[0]["datasource"] == {"id": 91, "type": "semantic_view"}
    assert payloads[0]["result_type"] == "post_processed"
    frame: pd.DataFrame
    if report_format == ReportDataFormat.CSV:
        assert content.csv is not None
        frame = pd.read_csv(BytesIO(content.csv))
    else:
        assert content.embedded_data is not None
        frame = content.embedded_data.copy()
        frame.columns = frame.columns.get_level_values(0)
    assert frame["Category"].tolist() == ["Books"]
    expected_total: int | str = 15 if report_format == ReportDataFormat.CSV else "15"
    assert frame["Total amount"].tolist() == [expected_total]


@pytest.mark.parametrize("report_format", [ReportDataFormat.PNG, ReportDataFormat.PDF])
def test_semantic_chart_report_captures_explore_url(
    mocker: MockerFixture,
    semantic_report_state: BaseReportState,
    report_format: ReportDataFormat,
) -> None:
    """Image reports use the saved semantic chart's URL and executor identity."""
    state: BaseReportState = semantic_report_state
    state._report_schedule.report_format = report_format
    image: bytes = _valid_png()
    capture: MagicMock = mocker.patch(
        "superset.commands.report.execute.ChartScreenshot.get_screenshot",
        return_value=image,
        autospec=True,
    )
    content: NotificationContent = state._get_notification_content()
    capture.assert_called_once()
    screenshot: ChartScreenshot = capture.call_args.args[0]
    url: str = screenshot.url
    assert urlparse(url).path.rstrip("/") == "/explore"
    assert json.loads(parse_qs(urlparse(url).query)["form_data"][0]) == {
        "slice_id": 501
    }
    assert state._report_schedule.chart.datasource_type == "semantic_view"
    assert screenshot.digest is not None
    assert screenshot.digest == state._report_schedule.chart.digest
    assert capture.call_args.kwargs["user"].username == "report_executor"
    if report_format == ReportDataFormat.PNG:
        assert content.screenshots == [image]
    else:
        assert content.pdf is not None
        assert content.pdf.startswith(b"%PDF")


def test_report_asset_validation_accepts_semantic_chart(
    mocker: MockerFixture,
    semantic_report_state: BaseReportState,
) -> None:
    """Report creation accepts semantic charts even though their table is None."""
    chart: Slice = semantic_report_state._report_schedule.chart
    assert chart.datasource is None
    mocker.patch(
        "superset.commands.report.base.ChartDAO.find_by_id", return_value=chart
    )
    access: MagicMock = mocker.patch(
        "superset.commands.report.base.security_manager.raise_for_access"
    )
    command: CreateReportScheduleCommand = CreateReportScheduleCommand(
        {
            "type": ReportScheduleType.REPORT,
            "chart": chart.id,
        }
    )
    errors: list[ValidationError] = []
    command.validate_chart_dashboard(errors)
    assert errors == []
    access.assert_called_once_with(chart=chart)
