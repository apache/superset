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

from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from celery.exceptions import SoftTimeLimitExceeded

from superset.charts.data.dashboard_filter_context import DashboardFilterContext
from superset.dashboards.excel_export import screenshot as screenshot_module
from superset.dashboards.excel_export.screenshot import render_chart_image
from superset.utils import json

MODULE = "superset.dashboards.excel_export.screenshot"


def _chart(
    chart_id: int = 42,
    params: str = '{"viz_type": "pie"}',
    digest: str = "abc123",
) -> MagicMock:
    chart = MagicMock()
    chart.id = chart_id
    chart.params = params
    chart.digest = digest
    return chart


def _patched_app() -> Any:
    app = MagicMock()
    app.config = {"WEBDRIVER_WINDOW": {"slice": (3000, 1200)}}
    return app


def test_render_chart_image_builds_url_with_slice_id_and_filters() -> None:
    chart = _chart()
    active_mask = {"NATIVE_FILTER-1": {"extraFormData": {"filters": [{"col": "a"}]}}}
    filter_context = DashboardFilterContext(
        extra_form_data={"filters": [{"col": "a", "op": "IN", "val": ["x"]}]}
    )

    screenshot_instance = MagicMock()
    screenshot_instance.get_screenshot.return_value = b"PNGBYTES"

    with (
        patch(
            f"{MODULE}.get_dashboard_filter_context", return_value=filter_context
        ) as mock_ctx,
        patch(f"{MODULE}.get_url_path", return_value="/explore/url") as mock_url,
        patch(
            f"{MODULE}.ChartScreenshot", return_value=screenshot_instance
        ) as mock_screenshot,
        patch.object(screenshot_module, "current_app", _patched_app()),
    ):
        user = MagicMock()
        result = render_chart_image(
            chart, dashboard_id=7, active_data_mask=active_mask, user=user
        )

    assert result == b"PNGBYTES"

    # Live filter state is resolved for this chart on this dashboard.
    mock_ctx.assert_called_once_with(
        dashboard_id=7, chart_id=42, active_data_mask=active_mask
    )

    # The Explore URL carries the slice id and the live extra_form_data.
    _, url_kwargs = mock_url.call_args
    form_data = json.loads(url_kwargs["form_data"])
    assert form_data["slice_id"] == 42
    assert form_data["viz_type"] == "pie"
    assert form_data["extra_form_data"] == filter_context.extra_form_data

    # ChartScreenshot is built with the chart digest + slice window sizing.
    args, kwargs = mock_screenshot.call_args
    assert args[0] == "/explore/url"
    assert args[1] == "abc123"
    assert kwargs["window_size"] == (3000, 1200)
    assert kwargs["thumb_size"] == (3000, 1200)
    screenshot_instance.get_screenshot.assert_called_once_with(user=user)


def test_render_chart_image_omits_extra_form_data_when_no_filters() -> None:
    chart = _chart()
    filter_context = DashboardFilterContext(extra_form_data={})
    screenshot_instance = MagicMock()
    screenshot_instance.get_screenshot.return_value = b"PNG"

    with (
        patch(f"{MODULE}.get_dashboard_filter_context", return_value=filter_context),
        patch(f"{MODULE}.get_url_path", return_value="/u") as mock_url,
        patch(f"{MODULE}.ChartScreenshot", return_value=screenshot_instance),
        patch.object(screenshot_module, "current_app", _patched_app()),
    ):
        render_chart_image(chart, dashboard_id=7, active_data_mask={}, user=MagicMock())

    _, url_kwargs = mock_url.call_args
    form_data = json.loads(url_kwargs["form_data"])
    assert "extra_form_data" not in form_data


def test_render_chart_image_returns_none_when_screenshot_fails() -> None:
    chart = _chart()
    screenshot_instance = MagicMock()
    screenshot_instance.get_screenshot.return_value = None

    with (
        patch(
            f"{MODULE}.get_dashboard_filter_context",
            return_value=DashboardFilterContext(),
        ),
        patch(f"{MODULE}.get_url_path", return_value="/u"),
        patch(f"{MODULE}.ChartScreenshot", return_value=screenshot_instance),
        patch.object(screenshot_module, "current_app", _patched_app()),
    ):
        result = render_chart_image(
            chart, dashboard_id=7, active_data_mask={}, user=MagicMock()
        )

    assert result is None


def test_render_chart_image_returns_none_on_exception() -> None:
    chart = _chart()

    with patch(
        f"{MODULE}.get_dashboard_filter_context", side_effect=ValueError("boom")
    ):
        result = render_chart_image(
            chart, dashboard_id=7, active_data_mask={}, user=MagicMock()
        )

    assert result is None


def test_render_chart_image_propagates_soft_time_limit() -> None:
    # A soft timeout must abort the export, not be swallowed into a ``None``
    # result (which the caller would mis-report as a per-chart render failure).
    chart = _chart()

    with (
        patch(
            f"{MODULE}.get_dashboard_filter_context",
            side_effect=SoftTimeLimitExceeded(),
        ),
        pytest.raises(SoftTimeLimitExceeded),
    ):
        render_chart_image(chart, dashboard_id=7, active_data_mask={}, user=MagicMock())
