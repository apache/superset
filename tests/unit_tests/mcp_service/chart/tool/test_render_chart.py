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

"""Unit tests for the render_chart MCP Apps tools."""

import importlib
import re
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest

from superset.mcp_service.chart.schemas import (
    ChartData,
    ChartError,
    PerformanceMetadata,
    RenderChartRequeryRequest,
    RenderChartRequest,
)
from superset.mcp_service.chart.tool.render_chart import (
    _build_explore_url,
    _requery_extra_form_data,
    CHART_VIEWER_URI,
)

# The package re-exports the ``render_chart`` function, shadowing the submodule
# attribute, so resolve the module unambiguously via importlib (same pattern as
# test_get_chart_data.py) to reach the undecorated ``_impl`` helpers.
render_chart_mod = importlib.import_module(
    "superset.mcp_service.chart.tool.render_chart"
)

RENDER_MODULE = "superset.mcp_service.chart.tool.render_chart"


def _sample_chart_data() -> ChartData:
    return ChartData(
        chart_id=42,
        chart_name="Revenue by month",
        chart_type="echarts_timeseries_line",
        columns=[],
        data=[{"month": "2026-01", "revenue": 100}],
        row_count=1,
        total_rows=1,
        summary="Revenue by month",
        insights=[],
        data_quality={},
        recommended_visualizations=[],
        data_freshness=None,
        performance=PerformanceMetadata(
            query_duration_ms=1, cache_status="fresh_query"
        ),
        cache_status=None,
    )


# --------------------------------------------------------------------------
# _build_explore_url
# --------------------------------------------------------------------------


def test_build_explore_url_numeric_id() -> None:
    with patch(f"{RENDER_MODULE}.get_superset_base_url", return_value="https://x.io/"):
        assert _build_explore_url(42) == "https://x.io/explore/?slice_id=42"


def test_build_explore_url_unsaved_chart_id_zero() -> None:
    # chart_id 0 = unsaved chart; no deep link.
    with patch(f"{RENDER_MODULE}.get_superset_base_url", return_value="https://x.io"):
        assert _build_explore_url(0) is None


def test_build_explore_url_none_chart_id() -> None:
    with patch(f"{RENDER_MODULE}.get_superset_base_url", return_value="https://x.io"):
        assert _build_explore_url(None) is None


def test_build_explore_url_no_base_url() -> None:
    with patch(f"{RENDER_MODULE}.get_superset_base_url", return_value=""):
        assert _build_explore_url(42) is None


def test_build_explore_url_swallows_errors() -> None:
    with patch(
        f"{RENDER_MODULE}.get_superset_base_url", side_effect=RuntimeError("boom")
    ):
        assert _build_explore_url(42) is None


# --------------------------------------------------------------------------
# _requery_extra_form_data
# --------------------------------------------------------------------------


def test_requery_extra_form_data_filter() -> None:
    req = RenderChartRequeryRequest(identifier=1, filter_col="country", filter_val="US")
    extra = _requery_extra_form_data(req)
    assert extra["filters"] == [{"col": "country", "op": "==", "val": "US"}]


def test_requery_extra_form_data_time_range_and_grain() -> None:
    req = RenderChartRequeryRequest(
        identifier=1, time_range="Last quarter", granularity="P1D"
    )
    extra = _requery_extra_form_data(req)
    assert extra["time_range"] == "Last quarter"
    assert extra["time_grain_sqla"] == "P1D"


def test_requery_extra_form_data_empty() -> None:
    req = RenderChartRequeryRequest(identifier=1)
    assert _requery_extra_form_data(req) == {}


def test_requery_filter_requires_both_col_and_val() -> None:
    # Only a column, no value -> no filter emitted (avoids a malformed clause).
    req = RenderChartRequeryRequest(identifier=1, filter_col="country")
    assert "filters" not in _requery_extra_form_data(req)


def test_requery_filter_object_form() -> None:
    # The widget sends filter as {"col","val"}; it maps to the same clause.
    req = RenderChartRequeryRequest(
        identifier=1, filter={"col": "country", "val": "US"}
    )
    extra = _requery_extra_form_data(req)
    assert extra["filters"] == [{"col": "country", "op": "==", "val": "US"}]


def test_requery_filter_object_supports_value_key() -> None:
    req = RenderChartRequeryRequest(identifier=1, filter={"col": "c", "value": 7})
    extra = _requery_extra_form_data(req)
    assert extra["filters"] == [{"col": "c", "op": "==", "val": 7}]


# --------------------------------------------------------------------------
# render_chart tool wrapper
# --------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_render_chart_populates_explore_url() -> None:
    ctx = AsyncMock()
    core = AsyncMock(return_value=_sample_chart_data())
    with (
        patch(f"{RENDER_MODULE}.get_chart_data_core", core),
        patch(f"{RENDER_MODULE}.get_superset_base_url", return_value="https://s.io"),
    ):
        result = await render_chart_mod._render_chart_impl(
            RenderChartRequest(identifier=42), ctx
        )
    assert isinstance(result, ChartData)
    assert result.explore_url == "https://s.io/explore/?slice_id=42"
    # The shared core is called with a json-format GetChartDataRequest.
    passed_request = core.call_args.args[0]
    assert passed_request.identifier == 42
    assert passed_request.format == "json"


@pytest.mark.asyncio
async def test_render_chart_passes_through_errors() -> None:
    ctx = AsyncMock()
    err = ChartError(error="nope", error_type="NotFound")
    with patch(f"{RENDER_MODULE}.get_chart_data_core", AsyncMock(return_value=err)):
        result = await render_chart_mod._render_chart_impl(
            RenderChartRequest(identifier=999), ctx
        )
    assert isinstance(result, ChartError)
    assert result.error_type == "NotFound"


@pytest.mark.asyncio
async def test_render_chart_requery_applies_filter_and_time_range() -> None:
    ctx = AsyncMock()
    captured: dict[str, Any] = {}

    async def _capture(req: Any, _ctx: Any) -> ChartData:
        captured["extra"] = req.extra_form_data
        return _sample_chart_data()

    with (
        patch(f"{RENDER_MODULE}.get_chart_data_core", side_effect=_capture),
        patch(f"{RENDER_MODULE}.get_superset_base_url", return_value="https://s.io"),
    ):
        result = await render_chart_mod._render_chart_requery_impl(
            RenderChartRequeryRequest(
                identifier=7,
                filter={"col": "country", "val": "US"},
                time_range="Last quarter",
            ),
            ctx,
        )
    assert isinstance(result, ChartData)
    # Filter + time range reach the shared query path (these actually merge).
    assert captured["extra"]["filters"] == [{"col": "country", "op": "==", "val": "US"}]
    assert captured["extra"]["time_range"] == "Last quarter"
    # explore_url is derived from the resolved numeric chart_id (42 in sample).
    assert result.explore_url == "https://s.io/explore/?slice_id=42"


# --------------------------------------------------------------------------
# Registration / MCP Apps descriptor metadata
# --------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_render_chart_registered_with_ui_meta(app: Any) -> None:
    from superset.mcp_service.app import mcp
    from superset.mcp_service.chart.resources.chart_viewer import (
        CHART_VIEWER_URI as RESOURCE_CHART_VIEWER_URI,
    )

    tool = await mcp.get_tool("render_chart")
    ui = (tool.meta or {}).get("ui")
    assert ui is not None
    assert CHART_VIEWER_URI == RESOURCE_CHART_VIEWER_URI
    # Version suffix is required: hosts cache the bundle by URI, so shipping a
    # changed widget depends on being able to bump it. The specific number is
    # not pinned here, or every bump would fail this test.
    assert re.fullmatch(r"ui://superset/chart-viewer/v\d+", CHART_VIEWER_URI)
    assert ui["resourceUri"] == CHART_VIEWER_URI
    assert ui["visibility"] == ["model", "app"]
    # Exempt from structured-content stripping, so the widget can read it.
    assert tool.output_schema is not None


@pytest.mark.asyncio
async def test_requery_tool_is_app_only(app: Any) -> None:
    from superset.mcp_service.app import mcp

    tool = await mcp.get_tool("render_chart_requery")
    ui = (tool.meta or {}).get("ui")
    assert ui is not None
    assert ui["visibility"] == ["app"]


# --------------------------------------------------------------------------
# Theme pass-through (consistent branding — the reason customers use theming)
# --------------------------------------------------------------------------


def test_instance_theme_tokens_selects_allowlisted_keys(app: Any) -> None:
    from superset.mcp_service.chart.tool.render_chart import _instance_theme_tokens

    app.config["THEME_DEFAULT"] = {
        "token": {
            "colorPrimary": "#2893B3",
            "fontFamily": "Inter, sans-serif",
            # Not in the allow-list — must not be forwarded.
            "brandLogoUrl": "https://example.com/logo.png",
            # Non-string values are skipped.
            "transitionTiming": 0.3,
        }
    }
    with app.app_context():
        tokens = _instance_theme_tokens()
    assert tokens == {
        "colorPrimary": "#2893B3",
        "fontFamily": "Inter, sans-serif",
    }
    assert "brandLogoUrl" not in tokens


def test_instance_theme_tokens_missing_theme(app: Any) -> None:
    from superset.mcp_service.chart.tool.render_chart import _instance_theme_tokens

    app.config["THEME_DEFAULT"] = {}
    with app.app_context():
        assert _instance_theme_tokens() is None


@pytest.mark.asyncio
async def test_render_chart_attaches_theme() -> None:
    ctx = AsyncMock()
    with (
        patch(
            f"{RENDER_MODULE}.get_chart_data_core",
            AsyncMock(return_value=_sample_chart_data()),
        ),
        patch(f"{RENDER_MODULE}.get_superset_base_url", return_value="https://s.io"),
        patch(
            f"{RENDER_MODULE}._instance_theme_tokens",
            return_value={"colorPrimary": "#2893B3"},
        ),
    ):
        result = await render_chart_mod._render_chart_impl(
            RenderChartRequest(identifier=42), ctx
        )
    assert isinstance(result, ChartData)
    assert result.theme == {"colorPrimary": "#2893B3"}
