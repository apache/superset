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

from io import BytesIO
from unittest.mock import Mock, patch

import pytest
from flask import current_app, Response

from superset.charts.data.api import ChartDataRestApi
from superset.commands.chart.data.get_data_command import ChartDataCommand
from superset.common.query_context import QueryContext
from superset.exceptions import QueryObjectValidationError
from superset.models.slice import Slice
from superset.utils import json

UNSUPPORTED_CHARTS: list[tuple[str, str]] = [
    ("histogram_v2", "Histogram"),
    ("cal_heatmap", "Calendar Heatmap"),
    ("time_table", "Time-series Table"),
    ("time_pivot", "Time-series Period Pivot"),
    ("rose", "Nightingale Rose"),
    ("horizon", "Horizon"),
    ("paired_ttest", "Paired t-test"),
]


def _context(viz_type: str, datasource_type: str = "semantic_view") -> Mock:
    """Keep query execution/cache reads observable without a provider."""
    context: Mock = Mock(spec=QueryContext)
    context.datasource = Mock(type=datasource_type)
    context.form_data = {"viz_type": viz_type}
    context.slice_ = None
    return context


@pytest.mark.parametrize(("viz_type", "label"), UNSUPPORTED_CHARTS)
@pytest.mark.parametrize("saved", [False, True])
def test_semantic_chart_type_refused(viz_type: str, label: str, saved: bool) -> None:
    """Unsaved and saved charts fail with a useful message before data access."""
    context: Mock = _context(viz_type)
    if saved:
        context.form_data = None
        context.slice_ = Slice(viz_type=viz_type)
    error: pytest.ExceptionInfo[QueryObjectValidationError]
    with pytest.raises(QueryObjectValidationError, match=label) as error:
        ChartDataCommand(context).validate()
    assert "not yet supported on semantic views. Use " in str(error.value)
    context.raise_for_access.assert_called_once_with()
    context.get_payload.assert_not_called()
    context.get_payload_result.assert_not_called()


@pytest.mark.parametrize(("viz_type", "label"), UNSUPPORTED_CHARTS)
def test_ordinary_dataset_chart_types_unchanged(viz_type: str, label: str) -> None:
    """The refusal does not change these chart types on SQL datasets."""
    context: Mock = _context(viz_type, "table")
    ChartDataCommand(context).validate()
    context.raise_for_access.assert_called_once_with()


@pytest.mark.parametrize(
    "viz_type", ["table", "echarts_timeseries_line", "mixed_timeseries"]
)
def test_supported_semantic_chart_types_unchanged(viz_type: str) -> None:
    """Supported visualizations still validate on semantic views."""
    context: Mock = _context(viz_type)
    ChartDataCommand(context).validate()


def test_access_failure_precedes_chart_type_refusal() -> None:
    """Do not disclose the visualization restriction before access checks."""
    context: Mock = _context("histogram_v2")
    context.raise_for_access.side_effect = PermissionError("denied")
    with pytest.raises(PermissionError, match="denied"):
        ChartDataCommand(context).validate()


def test_switch_saved_chart_to_supported_type() -> None:
    """An explicit Explore selection takes precedence over the saved type."""
    context: Mock = _context("table")
    context.slice_ = Slice(viz_type="histogram_v2")
    ChartDataCommand(context).validate()


@pytest.mark.parametrize(("viz_type", "label"), UNSUPPORTED_CHARTS)
@pytest.mark.parametrize("async_mode", [False, True])
def test_chart_data_refusal_precedes_cache_and_async(
    viz_type: str, label: str, async_mode: bool, full_api_access: None
) -> None:
    """The real command returns HTTP 400 before async or cached data dispatch."""
    api: ChartDataRestApi = ChartDataRestApi()
    context: Mock = _context(viz_type)
    response: Response
    get_data: Mock
    run_async: Mock
    with (
        current_app.test_request_context(
            "/api/v1/chart/data",
            method="POST",
            json={
                "datasource": {"id": 1, "type": "semantic_view"},
                "queries": [{}],
                "form_data": {"viz_type": viz_type},
                "async_mode": async_mode,
            },
        ),
        patch.object(api, "_create_query_context_from_form", return_value=context),
        patch.object(api, "_run_async") as run_async,
        patch.object(api, "_get_data_response") as get_data,
    ):
        response = api.data()
    assert response.status_code == 400
    assert label in response.get_json()["message"]
    run_async.assert_not_called()
    get_data.assert_not_called()
    context.get_payload_result.assert_not_called()


def test_saved_chart_without_form_data_is_refused(full_api_access: None) -> None:
    """Saved GET must supply its known chart type even with an old query context."""
    api: ChartDataRestApi = ChartDataRestApi()
    chart: Slice = Slice(
        id=1,
        viz_type="histogram_v2",
        query_context=json.dumps(
            {"datasource": {"id": 1, "type": "semantic_view"}, "queries": [{}]}
        ),
    )
    api.datamodel = Mock()
    api.datamodel.get.return_value = chart
    api._base_filters = []
    context: Mock = _context("histogram_v2")
    context.form_data = None
    response: Response
    get_data: Mock
    with (
        current_app.test_request_context("/api/v1/chart/1/data/?format=csv"),
        patch.object(api, "_create_query_context_from_form", return_value=context),
        patch.object(api, "_get_data_response") as get_data,
    ):
        response = api.get_data(1)
    assert response.status_code == 400
    assert "Histogram" in response.get_json()["message"]
    get_data.assert_not_called()


@pytest.mark.parametrize("saved", [False, True])
def test_queued_chart_task_refuses_before_cache_or_execution(saved: bool) -> None:
    """A task queued before the policy changed must not acquire chart data."""
    from superset.common.query_serialization import SerializedQuery
    from superset.tasks.async_queries import execute_chart_query

    context: Mock = _context("histogram_v2")
    context.datasource.id = 1
    context.queries = [Mock()]
    context.get_df_payload_result.return_value.payload = {}
    if saved:
        context.form_data = None
        context.slice_ = Slice(viz_type="histogram_v2")
    payload: SerializedQuery = {
        "datasource": {"id": 1, "type": "semantic_view"},
        "query": {},
        "form_data": {"viz_type": "histogram_v2"},
        "result_type": "full",
        "result_format": "json",
        "force": False,
        "custom_cache_timeout": None,
    }
    with (
        patch("superset.tasks.async_queries._resolve_user"),
        patch("superset.tasks.async_queries.get_context"),
        patch("superset.tasks.async_queries._capture_query_cancellation"),
        patch("superset.charts.data.form_data.set_query_context_form_data"),
        patch("superset.tasks.async_queries.override_user"),
        patch(
            "superset.tasks.async_queries.load_serialized_query", return_value=context
        ),
        pytest.raises(QueryObjectValidationError, match="Histogram"),
    ):
        execute_chart_query.func(payload, user_id=7)
    context.get_df_payload_result.assert_not_called()
    context.raise_for_access.assert_not_called()


@pytest.mark.parametrize("viz_type", [["histogram_v2"], {"type": "histogram_v2"}, 1])
def test_malformed_semantic_chart_type_is_validation_error(viz_type: object) -> None:
    """Free-form visualization metadata must not turn a refusal into a 500."""
    context: Mock = _context("histogram_v2")
    context.form_data = {"viz_type": viz_type}
    with pytest.raises(QueryObjectValidationError, match="must be a string"):
        ChartDataCommand(context).validate()


@pytest.mark.parametrize("surface", ["thumbnail", "screenshot", "cache_screenshot"])
def test_cached_image_refused_before_read(full_api_access: None, surface: str) -> None:
    """Existing image bytes must not bypass the semantic visualization policy."""
    from superset.charts.api import ChartRestApi

    chart: Slice = Slice(id=1, viz_type="histogram_v2", datasource_type="semantic_view")
    api: ChartRestApi = ChartRestApi()
    api.datamodel = Mock()
    api.datamodel.get.return_value = chart
    api._base_filters = []
    response: Response
    screenshot: Mock
    metrics: Mock
    with (
        current_app.test_request_context("/thumbnail/"),
        patch("superset.views.base_api.is_feature_enabled", return_value=True),
        patch(
            "superset.semantic_layers.access.is_semantic_layers_enabled",
            return_value=True,
        ),
        patch("superset.charts.api.ChartScreenshot") as screenshot,
        patch.object(api, "incr_stats") as metrics,
    ):
        cached_image: Mock = screenshot.return_value.get_from_cache_key.return_value
        cached_image.should_trigger_task.return_value = False
        cached_image.get_image.return_value = BytesIO(b"cached-image")
        if surface == "cache_screenshot":
            response = api.cache_screenshot(1)
        else:
            response = getattr(api, surface)(1, chart.digest)
    assert response.status_code == 400
    assert response.get_json()["message"] == (
        "Histogram is not yet supported on semantic views. "
        "Use a Bar or Table chart with an explicit count metric."
    )
    screenshot.assert_not_called()
    metrics.assert_called_once_with("warning", surface)


def test_ordinary_saved_get_preserves_context(full_api_access: None) -> None:
    """An old SQL chart context must retain its original slice/cache semantics."""
    api: ChartDataRestApi = ChartDataRestApi()
    chart: Slice = Slice(
        id=1,
        viz_type="histogram_v2",
        query_context=json.dumps(
            {"datasource": {"id": 1, "type": "table"}, "queries": [{}]}
        ),
    )
    api.datamodel = Mock()
    api.datamodel.get.return_value = chart
    api._base_filters = []
    context: Mock = _context("histogram_v2", "table")
    context.form_data = None
    with (
        current_app.test_request_context("/api/v1/chart/1/data/"),
        patch.object(api, "_create_query_context_from_form", return_value=context),
        patch.object(api, "_should_run_async", return_value=False),
        patch.object(api, "_get_data_response", return_value=Response("{}")),
    ):
        assert api.get_data(1).status_code == 200
    assert context.slice_ is None


@pytest.mark.parametrize("download_format", ["png", "pdf"])
def test_dashboard_download_allows_refusal_tile(
    download_format: str, full_api_access: None
) -> None:
    """A refused chart tile does not prevent dashboard PNG/PDF downloads."""
    from superset.dashboards.api import DashboardRestApi
    from superset.models.dashboard import Dashboard
    from superset.utils.screenshots import (
        ScreenshotCachePayload,
    )

    chart: Slice = Slice(id=1, viz_type="histogram_v2", datasource_type="semantic_view")
    dashboard: Dashboard = Dashboard(id=1, slices=[chart])
    api: DashboardRestApi = DashboardRestApi()
    api.datamodel = Mock()
    api.datamodel.get.return_value = dashboard
    api._base_filters = []
    # Browser capture is substituted; the tile's 400 message is pinned above.
    tile: bytes = b"png-capture-with-refusal-tile"
    payload: ScreenshotCachePayload = ScreenshotCachePayload(
        image=tile, scope="dashboard:1"
    )
    response: Response
    with (
        current_app.test_request_context(
            f"/screenshot/key/?download_format={download_format}"
        ),
        patch("superset.views.base_api.is_feature_enabled", return_value=True),
        patch(
            "superset.semantic_layers.access.is_semantic_layers_enabled",
            return_value=True,
        ),
        patch(
            "superset.dashboards.api.DashboardScreenshot.get_from_cache_key",
            return_value=payload,
        ),
        patch(
            "superset.dashboards.api.build_pdf_from_screenshots",
            return_value=b"pdf-refusal-tile",
        ),
    ):
        response = api.screenshot(1, "key")
    assert response.status_code == 200
    response.direct_passthrough = False
    assert response.get_data() == (
        tile if download_format == "png" else b"pdf-refusal-tile"
    )
