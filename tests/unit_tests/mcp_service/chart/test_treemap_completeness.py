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

"""Treemap regressions spanning native requests, query output and update semantics."""

from contextlib import nullcontext
from copy import deepcopy
from types import SimpleNamespace
from typing import Any
from unittest.mock import Mock, patch

import pytest
from pydantic import ValidationError

from superset.mcp_service.chart.chart_helpers import _build_single_query_dict
from superset.mcp_service.chart.chart_utils import (
    map_treemap_config,
    merge_chart_form_data,
    resolve_treemap_update_config,
)
from superset.mcp_service.chart.query_result import normalize_chart_query_result
from superset.mcp_service.chart.schemas import (
    ChartError,
    GenerateChartRequest,
    GetChartPreviewRequest,
    TreemapChartConfig,
    UpdateChartPreviewRequest,
    UpdateChartRequest,
)
from superset.mcp_service.chart.treemap_preview import treemap_ascii, treemap_vega_lite
from superset.utils import json

FORM_DATA: dict[str, Any] = {
    "viz_type": "treemap_v2",
    "groupby": ["region", "product"],
    "metric": "revenue",
    "datasource": "7__table",
    "color_scheme": "lyftColors",
    "row_limit": 7,
    "sort_by_metric": False,
    "show_labels": False,
    "show_upper_labels": False,
    "number_format": ",.1f",
    "date_format": "%Y",
    "label_type": "value",
    "currency_format": {"symbol": "USD", "symbolPosition": "prefix"},
    "adhoc_filters": [
        {
            "expressionType": "SIMPLE",
            "clause": "WHERE",
            "subject": "region",
            "operator": "==",
            "comparator": "West",
        }
    ],
    "time_range": "2025-01-01 : 2026-01-01",
    "granularity_sqla": "ds",
    "template_params": '{"scale": 2}',
}
ROWS = [
    {"region": "West", "product": "A", "revenue": 30},
    {"region": "West", "product": "B", "revenue": 10},
    {"region": "East", "product": "A", "revenue": 60},
]


@pytest.mark.parametrize("sort", [False, True])
@pytest.mark.parametrize("limit", [None, 0, 1, 7])
def test_hierarchy_query_order_matches_frontend(sort: bool, limit: int | None) -> None:
    """Metric order has precedence, with hierarchy tie-breakers only when bounded."""
    form = {**FORM_DATA, "sort_by_metric": sort, "row_limit": limit}
    query = _build_single_query_dict(form, form["groupby"], [form["metric"]])
    expected = ([("revenue", False)] if sort else []) + [
        ("region", True),
        ("product", True),
    ]
    assert query.get("orderby", []) == (expected if limit else [])


@pytest.mark.parametrize(
    "metric",
    [
        "revenue",
        {"name": "revenue", "saved_metric": True},
        {
            "expressionType": "SIMPLE",
            "column": {"column_name": "amount"},
            "aggregate": "SUM",
            "label": "revenue",
            "hasCustomLabel": True,
        },
        {"expressionType": "SQL", "sqlExpression": "SUM(amount)", "label": "revenue"},
    ],
)
@pytest.mark.parametrize(
    "request_class", [GenerateChartRequest, UpdateChartPreviewRequest]
)
def test_native_request_roundtrip(metric: Any, request_class: Any) -> None:
    """Native columns and all valid metric shapes survive actual request validation."""
    native = {**FORM_DATA, "metric": metric, "slice_id": 1}
    request = request_class(dataset_id=7, config=native)
    result = map_treemap_config(request.config)
    assert result["groupby"] == FORM_DATA["groupby"]
    assert result["show_labels"] is False
    assert result["number_format"] == ",.1f"
    assert result["metric"] == "revenue" or result["metric"]["label"] == "revenue"


@pytest.mark.parametrize(
    "field,value",
    [
        ("javascript", "alert(1)"),
        ("groupby", []),
        ("metric", {"expressionType": "SQL", "sqlExpression": "SUM(amount)"}),
        ("row_limit", 10001),
    ],
)
def test_native_requests_do_not_accept_unbounded_or_hostile_controls(
    field: str, value: Any
) -> None:
    """Unknown executable controls and invalid native roles remain validation errors."""
    with pytest.raises(ValidationError):
        GenerateChartRequest(dataset_id=7, config={**FORM_DATA, field: value})


@pytest.mark.parametrize(
    "patch_data",
    [{"show_labels": True}, {"groupby": ["product", "region"], "metric": "revenue"}],
)
def test_omitted_same_viz_controls_survive(patch_data: dict[str, Any]) -> None:
    """Partial and full-role updates preserve all omitted native controls."""
    request = UpdateChartRequest(
        identifier=1, config={"chart_type": "treemap_v2", **patch_data}
    )
    assert request.config is not None
    config = resolve_treemap_update_config(request.config, FORM_DATA)
    merged = merge_chart_form_data(FORM_DATA, map_treemap_config(config), config)
    for key, value in FORM_DATA.items():
        if key not in patch_data:
            assert merged[key] == value
    for key, value in patch_data.items():
        assert merged[key] == value


@pytest.mark.parametrize(
    "field",
    [
        "color_scheme",
        "currency_format",
        "time_range",
        "granularity_sqla",
        "template_params",
        "filters",
    ],
)
def test_nullable_clears_are_not_replaced_by_defaults(field: str) -> None:
    """Explicit null clears native nullable controls rather than restoring defaults."""
    request = UpdateChartRequest(
        identifier=1, config={"chart_type": "treemap_v2", field: None}
    )
    assert request.config is not None
    config = resolve_treemap_update_config(request.config, FORM_DATA)
    merged = merge_chart_form_data(FORM_DATA, map_treemap_config(config), config)
    assert ("adhoc_filters" if field == "filters" else field) not in merged


def test_empty_filters_and_dataset_rebind() -> None:
    """Rebinds retain presentation only and scrub stale query/template roles."""
    config = TreemapChartConfig(
        groupby=[{"name": "other"}], metric="other_metric", filters=[]
    )
    existing = {**FORM_DATA, "metrics": ["stale"], "x_axis": "stale"}
    merged = merge_chart_form_data(
        existing, map_treemap_config(config), config, dataset_rebind=True
    )
    assert merged["color_scheme"] == "lyftColors"
    assert merged["show_labels"] is False
    assert merged["groupby"] == ["other"]
    assert merged["metric"] == "other_metric"
    for key in (
        "adhoc_filters",
        "time_range",
        "granularity_sqla",
        "template_params",
        "metrics",
        "x_axis",
    ):
        assert key not in merged
    incomplete = UpdateChartRequest(
        identifier=1, config={"chart_type": "treemap_v2", "show_labels": True}
    )
    assert incomplete.config is not None
    with pytest.raises(ValidationError):
        resolve_treemap_update_config(incomplete.config, existing, dataset_rebind=True)


@pytest.mark.parametrize(
    "result",
    [
        None,
        {},
        {"queries": []},
        {"queries": [{}]},
        {"queries": [{"data": {}}]},
        {"queries": [{"data": [None]}]},
        {"queries": [{"data": [{"region": "West", "revenue": 2}]}]},
        {"status": "failed", "message": "Database rejected SQL"},
        {"queries": [{"error": "SQL failed", "data": ROWS}]},
    ],
)
def test_malformed_results_never_produce_success(result: Any) -> None:
    """Missing hierarchy and malformed/error envelopes are actionable failures."""
    assert isinstance(normalize_chart_query_result(result, FORM_DATA), ChartError)


@pytest.mark.parametrize(
    "value", [None, True, "3", float("nan"), float("inf"), 10**400]
)
def test_metric_outputs_must_be_finite_numeric(value: Any) -> None:
    """A single invalid metric fails instead of silently dropping a hierarchy node."""
    rows = [*ROWS, {**ROWS[0], "revenue": value}]
    result = normalize_chart_query_result({"queries": [{"data": rows}]}, FORM_DATA)
    assert isinstance(result, ChartError)
    assert result.error_type == "InvalidTreemapMetric"


def test_result_validation_is_non_mutating_and_chart_specific() -> None:
    """Other charts retain their existing interpretation of data."""
    result = {"queries": [{"data": ROWS}]}
    original = deepcopy(result)
    assert normalize_chart_query_result(result, FORM_DATA) == original
    assert result == original
    unrelated = {"queries": [{"data": [{"x": None}]}]}
    assert normalize_chart_query_result(unrelated, {"viz_type": "table"}) is unrelated


def test_treemap_geometry_area_hierarchy_labels_and_color() -> None:
    """Coordinates partition parents and area follows the metric, not row count."""
    preview = treemap_vega_lite(
        ROWS, {**FORM_DATA, "currency_format": None, "show_labels": True}
    )
    assert not isinstance(preview, ChartError)
    spec = preview.specification
    nodes = spec["data"]["values"]
    leaves = [node for node in nodes if node["leaf"]]
    for leaf in leaves:
        area = (leaf["x1"] - leaf["x0"]) * (leaf["y1"] - leaf["y0"])
        assert area / (600 * 400) == pytest.approx(leaf["value"] / 100)
        parent = next(
            node for node in nodes if node["path"] == leaf["path"].split(" > ")[0]
        )
        assert parent["x0"] <= leaf["x0"] <= leaf["x1"] <= parent["x1"]
        assert parent["y0"] <= leaf["y0"] <= leaf["y1"] <= parent["y1"]
    assert spec["layer"][0]["mark"]["type"] == "rect"
    assert spec["layer"][0]["encoding"]["color"]["scale"]["range"][0] == "#EA0B8C"
    assert spec["layer"][0]["encoding"]["tooltip"][1]["title"] == "revenue"
    assert spec["layer"][1]["mark"]["type"] == "text"
    assert "West > A | 30" in treemap_ascii(ROWS, FORM_DATA)


@pytest.mark.parametrize(
    "rows,override",
    [
        (ROWS, {"color_scheme": "unavailable"}),
        (ROWS, {"currency_format": {"symbol": "USD"}}),
        ([{**ROWS[0], "revenue": -1}], {}),
        (ROWS * 334, {}),
    ],
)
def test_unsupported_geometry_is_explicit(rows: Any, override: Any) -> None:
    """Unsupported representation must not fall back to a plausible bar or scatter."""
    preview = treemap_vega_lite(
        rows, {**FORM_DATA, "currency_format": None, **override}
    )
    assert isinstance(preview, ChartError)
    assert preview.error_type == "UnsupportedTreemapPreview"


@pytest.mark.parametrize("format_name", ["ascii", "table", "vega_lite"])
def test_saved_and_unsaved_preview_dispatch_match(format_name: str) -> None:
    """Both preview entry paths use the Treemap representation and result contract."""
    from superset.mcp_service.chart.preview_utils import generate_preview_from_form_data
    from superset.mcp_service.chart.tool.get_chart_preview import (
        ASCIIPreviewStrategy,
        TablePreviewStrategy,
        VegaLitePreviewStrategy,
    )

    form = {**FORM_DATA, "currency_format": None}
    chart = SimpleNamespace(
        id=1,
        viz_type="treemap_v2",
        slice_name="Treemap",
        datasource_id=7,
        datasource_type="table",
        params=json.dumps(form),
    )
    context = SimpleNamespace(
        queries=[SimpleNamespace(metrics=["revenue"], columns=form["groupby"])]
    )
    with (
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand"
        ) as command,
        patch(
            "superset.mcp_service.chart.tool.get_chart_preview.build_query_context_from_form_data",
            return_value=context,
        ),
        patch(
            "superset.mcp_service.chart.chart_helpers.build_query_context_from_form_data",
            return_value=context,
        ),
        patch("superset.extensions.db.session") as session,
    ):
        session.get.return_value = Mock(id=7)
        command.return_value.run.return_value = {"queries": [{"data": ROWS}]}
        strategy = {
            "ascii": ASCIIPreviewStrategy,
            "table": TablePreviewStrategy,
            "vega_lite": VegaLitePreviewStrategy,
        }[format_name]
        saved = strategy(
            chart, GetChartPreviewRequest(identifier=1, format=format_name)
        ).generate()
        unsaved = generate_preview_from_form_data(form, 7, format_name)
    assert not isinstance(saved, ChartError)
    assert not isinstance(unsaved, ChartError)
    if format_name == "vega_lite":
        assert saved.specification == unsaved.specification
    elif format_name == "ascii":
        assert "West > A | 30" in saved.ascii_content
        assert "West > A | 30" in unsaved.ascii_content
    else:
        assert "region" in saved.table_data
        assert "revenue" in unsaved.table_data


@pytest.mark.parametrize("rebind", [False, True])
def test_saved_update_and_update_preview_payloads_agree(rebind: bool) -> None:
    """Both save and preview-first update paths apply the same omission contract."""
    from superset.mcp_service.chart.tool.update_chart import (
        _build_preview_form_data,
        _build_update_payload,
    )

    config = TreemapChartConfig(
        groupby=[{"name": "region"}], metric="revenue", show_labels=True
    )
    request = UpdateChartRequest(
        identifier=1, config=config, dataset_id=8 if rebind else None
    )
    chart = Mock(
        id=1, datasource_id=7, slice_name="Treemap", params=json.dumps(FORM_DATA)
    )
    with patch(
        "superset.mcp_service.chart.chart_utils._bind_dashboard_time_range_filter"
    ):
        preview = _build_preview_form_data(request, chart, parsed_config=config)
        payload = _build_update_payload(request, chart, parsed_config=config)
    saved = json.loads(payload["params"])
    for key in (
        "color_scheme",
        "row_limit",
        "sort_by_metric",
        "groupby",
        "metric",
        "number_format",
        "show_labels",
    ):
        assert saved[key] == preview[key]
    assert saved["color_scheme"] == "lyftColors"
    assert saved["show_labels"] is True
    assert ("template_params" not in saved) == rebind


def test_normalization_preserves_explicit_field_set_and_rejects_ambiguity() -> None:
    """Canonicalization must not turn default values into explicit update intent."""
    from superset.mcp_service.chart.plugins.treemap import TreemapChartPlugin
    from superset.mcp_service.common.error_schemas import DatasetContext

    context = DatasetContext(
        id=7,
        table_name="sales",
        database_name="database",
        available_columns=[{"name": "Region", "type": "STRING"}],
        available_metrics=[{"name": "Revenue"}],
    )
    config = TreemapChartConfig(groupby=[{"name": "region"}], metric="revenue")
    normalized = TreemapChartPlugin().normalize_column_refs(config, context)
    assert normalized.groupby[0].name == "Region"
    assert normalized.metric.name == "Revenue"
    assert normalized.model_fields_set == config.model_fields_set
    context.available_columns.append({"name": "REGION", "type": "STRING"})
    with pytest.raises(ValueError, match="[Aa]mbiguous"):
        TreemapChartPlugin().normalize_column_refs(config, context)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "metric",
    [
        "revenue",
        {
            "expressionType": "SIMPLE",
            "column": {"column_name": "amount"},
            "aggregate": "SUM",
            "label": "revenue",
        },
        {"expressionType": "SQL", "sqlExpression": "SUM(amount)", "label": "revenue"},
    ],
)
@pytest.mark.parametrize("valid_result", [False, True])
async def test_registered_generate_chart_native_roundtrip(
    metric: Any, valid_result: bool
) -> None:
    """Call the registered FastMCP tool, retaining real request and compile checks."""
    from fastmcp import Client

    from superset.mcp_service.app import mcp

    request = GenerateChartRequest(
        dataset_id=7,
        config={
            "chart_type": "treemap_v2",
            "groupby": ["region", "product"],
            "metric": metric,
        },
        preview_formats=["url"],
    )
    dataset = Mock(id=7, datasource_name="sales", table_name="sales")
    user = Mock(id=1, username="admin", roles=[], groups=[])
    with (
        patch("superset.mcp_service.auth.get_user_from_request", return_value=user),
        patch(
            "superset.mcp_service.chart.validation.ValidationPipeline.validate_request_with_warnings",
            return_value=Mock(is_valid=True, request=request, warnings={}, error=None),
        ),
        patch(
            "superset.mcp_service.chart.chart_utils.generate_explore_link",
            return_value="http://localhost/explore/?form_data_key=treemap",
        ),
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset),
        patch(
            "superset.mcp_service.chart.tool.generate_chart.has_dataset_access",
            return_value=True,
        ),
        patch(
            "superset.mcp_service.chart.chart_helpers.build_query_context_from_form_data",
            return_value=Mock(),
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand"
        ) as command,
    ):
        command.return_value.run.return_value = {
            "queries": [
                {"data": ROWS if valid_result else [{"region": "West", "revenue": 1}]}
            ]
        }
        async with Client(mcp) as client:
            result = await client.call_tool(
                "generate_chart",
                {
                    "request": {
                        "dataset_id": 7,
                        "config": {
                            "viz_type": "treemap_v2",
                            "groupby": ["region", "product"],
                            "metric": metric,
                        },
                        "preview_formats": ["url"],
                    }
                },
            )
    data = result.structured_content
    assert data["success"] is valid_result
    if valid_result:
        assert data["form_data"]["groupby"] == ["region", "product"]
        assert data["form_data"]["viz_type"] == "treemap_v2"
    else:
        assert data["error"]["error_type"] == "InvalidTreemapResult"
    command.return_value.validate.assert_called_once()


def test_vega_scenegraph_renders_nested_metric_geometry() -> None:
    """Compile the specification and inspect rendered rectangles, not a snapshot."""
    import os
    import shutil
    import subprocess

    if not os.environ.get("NODE_PATH"):
        pytest.skip("Requires Node vega@5 and vega-lite@5 via NODE_PATH")
    spec = treemap_vega_lite(
        ROWS, {**FORM_DATA, "currency_format": None, "show_labels": True}
    )
    assert not isinstance(spec, ChartError)
    script = r"""
const assert = require('assert/strict');
const vl = require('vega-lite');
const vega = require('vega');
(async () => {
  const input = JSON.parse(require('fs').readFileSync(0, 'utf8'));
  const warnings = [];
  const compiled = vl.compile(input, {logger: {
    warn: message => warnings.push(message), info() {}, debug() {},
    error: message => { throw Error(message); }
  }}).spec;
  assert.deepEqual(warnings, []);
  const view = new vega.View(vega.parse(compiled), {renderer: 'none'});
  await view.runAsync();
  const rectangles = [];
  const labels = [];
  function walk(item) {
    if (item.mark?.marktype === 'rect') rectangles.push(item);
    if (item.mark?.marktype === 'text') labels.push(item);
    for (const child of item.items || []) walk(child);
  }
  walk(view.scenegraph().root);
  assert.equal(rectangles.length, 5);
  assert(labels.length > 0);
  for (const tile of rectangles.filter(tile => tile.datum.leaf)) {
    assert(tile.width >= 0 && tile.height >= 0);
    assert(Math.abs(tile.width * tile.height / 240000 - tile.datum.value / 100) < 1e-8);
    assert(tile.tooltip.Hierarchy.includes(' > '));
    assert(tile.fill.startsWith('#'));
  }
  assert((await view.toSVG()).includes('<svg'));
  view.finalize();
})().catch(error => { console.error(error); process.exit(1); });
"""
    node = shutil.which("node")
    assert node is not None
    # Run a fixed test script; generated data is supplied only on stdin.
    result = subprocess.run(  # noqa: S603
        [node, "-e", script],
        input=json.dumps(spec.specification),
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr


@pytest.mark.asyncio
@pytest.mark.parametrize("saved", [False, True])
@pytest.mark.parametrize("format_name", ["ascii", "table", "vega_lite"])
async def test_registered_cached_preview_is_treemap(
    saved: bool, format_name: str
) -> None:
    """Cached state overrides saved viz and uses identical Treemap dispatch."""
    import importlib

    from fastmcp import Client

    from superset.mcp_service.app import mcp

    module = importlib.import_module(
        "superset.mcp_service.chart.tool.get_chart_preview"
    )
    form = {**FORM_DATA, "currency_format": None}
    chart = SimpleNamespace(
        id=1,
        viz_type="table",
        slice_name="Chart",
        datasource_id=7,
        datasource_type="table",
        params=json.dumps({"viz_type": "table"}),
    )
    context = SimpleNamespace(
        queries=[SimpleNamespace(metrics=["revenue"], columns=form["groupby"])]
    )
    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=Mock(id=1, username="admin", roles=[], groups=[]),
        ),
        patch.object(module, "find_chart_by_identifier", return_value=chart),
        patch.object(module.db.session, "refresh"),
        patch.object(
            module.event_logger,
            "log_context",
            side_effect=lambda **kwargs: nullcontext(),
        ),
        patch.object(
            module,
            "validate_chart_dataset",
            return_value=Mock(is_valid=True, warnings=[]),
        ),
        patch.object(
            module, "build_query_context_from_form_data", return_value=context
        ),
        patch(
            "superset.commands.explore.form_data.get.GetFormDataCommand.run",
            return_value=json.dumps(form),
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand"
        ) as command,
    ):
        command.return_value.run.return_value = {"queries": [{"data": ROWS}]}
        request = {"form_data_key": "treemap-key", "format": format_name}
        if saved:
            request["identifier"] = "1"
        async with Client(mcp) as client:
            result = await client.call_tool("get_chart_preview", {"request": request})
    data = json.loads(result.content[0].text)
    assert "error_type" not in data, data
    content = data["content"]
    assert content["type"] == format_name
    if format_name == "vega_lite":
        assert content["specification"]["layer"][0]["mark"]["type"] == "rect"
    elif format_name == "ascii":
        assert "West > A | 30" in content["ascii_content"]
    else:
        assert "revenue" in content["table_data"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "patch_data", [{"show_labels": True}, {"filters": []}, {"color_scheme": None}]
)
@pytest.mark.parametrize("known_dataset", [True, False])
async def test_registered_update_preview_preserves_cached_controls(
    patch_data: dict[str, Any],
    known_dataset: bool,
) -> None:
    """Partial native updates reach real FastMCP hydration, merge, and cache writes."""
    import importlib

    from fastmcp import Client

    from superset.mcp_service.app import mcp
    from superset.mcp_service.chart.compile import CompileResult

    module = importlib.import_module(
        "superset.mcp_service.chart.tool.update_chart_preview"
    )
    dataset = Mock(id=7, table_name="sales", schema=None, columns=[], metrics=[])
    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=Mock(id=1, username="admin", roles=[], groups=[]),
        ),
        patch.object(module, "_find_dataset", return_value=dataset),
        patch.object(
            module,
            "_get_previous_form_data",
            return_value=FORM_DATA
            if known_dataset
            else {
                key: value for key, value in FORM_DATA.items() if key != "datasource"
            },
        ),
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset),
        patch.object(module, "has_dataset_access", return_value=True),
        patch(
            "superset.mcp_service.chart.validation.dataset_validator.DatasetValidator.normalize_column_names",
            side_effect=lambda config, *args, **kwargs: config,
        ),
        patch(
            "superset.mcp_service.chart.chart_utils._bind_dashboard_time_range_filter"
        ),
        patch.object(
            module, "validate_and_compile", return_value=CompileResult(success=True)
        ) as compile_check,
        patch.object(
            module,
            "generate_explore_link",
            return_value="http://localhost/explore/?form_data_key=updated",
        ) as cache_write,
    ):
        async with Client(mcp) as client:
            result = await client.call_tool(
                "update_chart_preview",
                {
                    "request": {
                        "dataset_id": 7,
                        "form_data_key": "previous",
                        "config": {"chart_type": "treemap_v2", **patch_data},
                        "generate_preview": False,
                    }
                },
            )
    data = result.structured_content
    if not known_dataset:
        assert data["success"] is False
        cache_write.assert_not_called()
        return
    assert data["success"] is True, data
    merged = data["form_data"]
    assert merged["row_limit"] == 7
    assert merged["sort_by_metric"] is False
    assert merged["metric"] == "revenue"
    assert merged["groupby"] == ["region", "product"]
    for key, value in FORM_DATA.items():
        field = "filters" if key == "adhoc_filters" else key
        if field not in patch_data:
            assert merged[key] == value
    assert compile_check.call_args.kwargs["run_compile_check"] is True
    assert cache_write.call_args.args[1] == merged


@pytest.mark.asyncio
async def test_registered_saved_update_preserves_omissions() -> None:
    """The registered save path persists the same partial Treemap merge as preview."""
    import importlib

    from fastmcp import Client

    from superset.mcp_service.app import mcp

    module = importlib.import_module("superset.mcp_service.chart.tool.update_chart")
    chart = Mock(
        id=1,
        datasource_id=7,
        slice_name="Treemap",
        viz_type="treemap_v2",
        uuid="11111111-1111-1111-1111-111111111111",
        params=json.dumps(FORM_DATA),
    )
    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=Mock(id=1, username="admin", roles=[], groups=[]),
        ),
        patch.object(module, "find_chart_by_identifier", return_value=chart),
        patch(
            "superset.mcp_service.auth.check_chart_data_access",
            return_value=Mock(is_valid=True),
        ),
        patch(
            "superset.mcp_service.chart.validation.dataset_validator.DatasetValidator.normalize_column_names",
            side_effect=lambda config, *args, **kwargs: config,
        ),
        patch.object(
            module, "_validate_update_against_dataset", return_value=None
        ) as validate,
        patch(
            "superset.mcp_service.chart.chart_utils._bind_dashboard_time_range_filter"
        ),
        patch("superset.commands.chart.update.UpdateChartCommand") as update,
        patch("superset.db.session"),
    ):
        update.return_value.run.return_value = chart
        async with Client(mcp) as client:
            result = await client.call_tool(
                "update_chart",
                {
                    "request": {
                        "identifier": 1,
                        "generate_preview": False,
                        "preview_formats": [],
                        "config": {"chart_type": "treemap_v2", "show_labels": True},
                    }
                },
            )
    data = result.structured_content
    assert data["success"] is True, data
    assert data["chart"]["is_unsaved_state"] is False
    persisted = json.loads(update.call_args.args[1]["params"])
    for key, value in FORM_DATA.items():
        assert persisted[key] == (True if key == "show_labels" else value)
    validate.assert_called_once()


def test_treemap_query_ignores_stale_cross_chart_roles() -> None:
    """Saved/native Treemaps must not query a previous plugin's raw columns."""
    from superset.mcp_service.chart.chart_helpers import resolve_metrics_and_groupby

    form = {
        **FORM_DATA,
        "query_mode": "raw",
        "all_columns": ["stale"],
        "metrics": ["stale_metric"],
    }
    metrics, hierarchy = resolve_metrics_and_groupby(form)
    assert metrics == ["revenue"]
    assert hierarchy == ["region", "product"]


@pytest.mark.parametrize("limit", ["0", "0.0", "", "1"])
def test_native_string_row_limits_match_frontend(limit: str) -> None:
    """Frontend applyOrderBy numerically parses string row limits."""
    query = _build_single_query_dict(
        {**FORM_DATA, "row_limit": limit}, ["region"], ["revenue"]
    )
    assert query.get("orderby", []) == ([("region", True)] if limit == "1" else [])


def test_explicit_temporal_clear_keeps_user_filters_and_template_state() -> None:
    """Removing a generated time binding must not erase user-owned predicates."""
    from superset.mcp_service.chart.chart_utils import MCP_DASHBOARD_TIME_FILTER_SUBJECT
    from superset.mcp_service.chart.tool.update_chart import _build_preview_form_data

    existing = {
        **FORM_DATA,
        MCP_DASHBOARD_TIME_FILTER_SUBJECT: "ds",
        "adhoc_filters": [
            *FORM_DATA["adhoc_filters"],
            {
                "expressionType": "SIMPLE",
                "clause": "WHERE",
                "subject": "ds",
                "operator": "TEMPORAL_RANGE",
                "comparator": "No filter",
            },
        ],
    }
    request = UpdateChartRequest(
        identifier=1, config={"chart_type": "treemap_v2", "temporal_column": None}
    )
    assert request.config is not None
    config = resolve_treemap_update_config(request.config, existing)
    chart = Mock(
        id=1, datasource_id=7, slice_name="Treemap", params=json.dumps(existing)
    )
    result = _build_preview_form_data(request, chart, parsed_config=config)
    assert isinstance(result, dict)
    assert result["adhoc_filters"] == FORM_DATA["adhoc_filters"]
    assert result["template_params"] == FORM_DATA["template_params"]
    assert MCP_DASHBOARD_TIME_FILTER_SUBJECT not in result


def test_canonical_metric_reference_keeps_merged_default_sum() -> None:
    """Preserve the community plugin's default SUM for a typed physical column."""
    config = TreemapChartConfig(groupby=[{"name": "region"}], metric={"name": "amount"})
    assert map_treemap_config(config)["metric"]["label"] == "SUM(amount)"
    with pytest.raises(ValidationError):
        TreemapChartConfig(
            groupby=["region"],
            metric={"expressionType": "SIMPLE", "column": {"column_name": "amount"}},
        )


def test_compile_respects_treemap_row_limit() -> None:
    """Compile must not validate rows excluded by a smaller native row limit."""
    from superset.mcp_service.chart.compile import _compile_chart

    with (
        patch(
            "superset.mcp_service.chart.chart_helpers.build_query_context_from_form_data",
            return_value=Mock(),
        ) as build,
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand"
        ) as command,
    ):
        command.return_value.run.return_value = {"queries": [{"data": ROWS[:1]}]}
        result = _compile_chart({**FORM_DATA, "row_limit": 1}, 7)
    assert result.success is True
    assert build.call_args.kwargs["row_limit"] == 1
