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
"""Shared lifecycle contract enforced for every registered chart plugin.

Each test is parametrized over the live registry, so a newly registered
chart type is covered automatically and fails here until it publishes an
example and honors the query, result, preview and update contracts.
"""

from __future__ import annotations

import ast
import inspect
from collections import Counter
from copy import deepcopy
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from pydantic import TypeAdapter

from superset.mcp_service.chart import (
    chart_helpers,
    chart_utils,
    compile as compile_module,
    preview_utils,
    query_result,
)
from superset.mcp_service.chart.chart_helpers import build_query_dicts_from_form_data
from superset.mcp_service.chart.chart_utils import merge_chart_form_data
from superset.mcp_service.chart.plugin import BaseChartPlugin, ChartTypePlugin
from superset.mcp_service.chart.preview_utils import (
    _generate_ascii_preview_from_data,
    _generate_table_preview_from_data,
    _generate_vega_lite_preview_from_data,
)
from superset.mcp_service.chart.query_result import normalize_chart_query_result
from superset.mcp_service.chart.registry import get_registry, plugin_for_viz_type
from superset.mcp_service.chart.schemas import (
    ASCIIPreview,
    ChartConfig,
    ChartError,
    TablePreview,
    VegaLitePreview,
)
from superset.mcp_service.chart.tool.get_chart_type_schema import _CHART_EXAMPLES

PLUGINS: list[ChartTypePlugin] = get_registry().all_plugins()
PLUGIN_IDS = [plugin.chart_type for plugin in PLUGINS]

EXAMPLES: list[tuple[ChartTypePlugin, dict[str, Any]]] = [
    (plugin, example)
    for plugin in PLUGINS
    for example in _CHART_EXAMPLES.get(plugin.chart_type, [])
]
EXAMPLE_IDS = [
    f"{plugin.chart_type}-{index}"
    for plugin in PLUGINS
    for index, _example in enumerate(_CHART_EXAMPLES.get(plugin.chart_type, []))
]

HOOKS = (
    "resolve_query_fields",
    "build_query_dicts",
    "normalize_query_result",
    "compile_row_limit",
    "preview_row_limit",
    "ascii_preview",
    "vega_lite_preview",
    "resolve_update_config",
    "merge_update_form_data",
    "validate_merged_form_data",
)
FLAGS = (
    "requires_compile_check",
    "requires_config_for_dataset_rebind",
    "strict_dataset_rebind",
    "unbound_form_data_is_rebind",
    "normalize_data_results",
    "allows_empty_result",
    "resizes_saved_preview",
    "supports_column_append",
)

MALFORMED_RESULTS: list[Any] = [
    None,
    {},
    {"queries": None},
    {"queries": []},
    {"queries": [{"data": None}]},
    {"queries": [{"data": []}]},
    {"queries": [{"data": [{"unexpected": "row"}]}]},
    {"queries": [{"error": "query failed", "data": []}]},
]


def _form_data(plugin: ChartTypePlugin, example: dict[str, Any]) -> dict[str, Any]:
    """Map a published example through the plugin without dataset lookups."""
    config = TypeAdapter(ChartConfig).validate_python(example)
    with (
        patch(
            "superset.mcp_service.chart.chart_utils.is_column_truly_temporal",
            return_value=True,
        ),
        patch(
            "superset.mcp_service.chart.chart_utils._find_dataset_by_id_or_uuid",
            return_value=None,
        ),
    ):
        form_data = plugin.to_form_data(config, dataset_id=1)
    form_data.setdefault("datasource", "1__table")
    return form_data


def _config(example: dict[str, Any]) -> Any:
    return TypeAdapter(ChartConfig).validate_python(example)


@pytest.mark.parametrize("plugin", PLUGINS, ids=PLUGIN_IDS)
def test_plugin_implements_lifecycle_contract(plugin: ChartTypePlugin) -> None:
    """Every hook exists and every contract flag has the declared type."""
    assert isinstance(plugin, ChartTypePlugin)
    assert isinstance(plugin, BaseChartPlugin)
    for hook in HOOKS:
        assert callable(getattr(plugin, hook)), hook
    for flag in FLAGS:
        assert isinstance(getattr(plugin, flag), bool), flag
    assert isinstance(plugin.additional_viz_types, frozenset)
    assert plugin.preview_note is None or isinstance(plugin.preview_note, str)
    assert plugin.invalid_result_error_code
    assert plugin.invalid_result_message
    if plugin.normalize_data_results:
        # Exposing rows through get_chart_data under a contract requires one.
        assert (
            type(plugin).normalize_query_result
            is not BaseChartPlugin.normalize_query_result
        )
    if plugin.requires_config_for_dataset_rebind:
        assert plugin.requires_compile_check


@pytest.mark.parametrize("plugin", PLUGINS, ids=PLUGIN_IDS)
def test_plugin_publishes_examples(plugin: ChartTypePlugin) -> None:
    """Every registered chart type ships at least one schema example."""
    assert _CHART_EXAMPLES.get(plugin.chart_type), plugin.chart_type


@pytest.mark.parametrize("plugin", PLUGINS, ids=PLUGIN_IDS)
def test_viz_type_ownership_is_unique(plugin: ChartTypePlugin) -> None:
    """Each native or additional viz type resolves to exactly its plugin."""
    owned = set(plugin.native_viz_types) | set(plugin.additional_viz_types)
    assert owned
    for viz_type in owned:
        assert plugin_for_viz_type(viz_type) is plugin, viz_type
        claimants = [
            other.chart_type
            for other in PLUGINS
            if viz_type in other.native_viz_types
            or viz_type in other.additional_viz_types
        ]
        assert claimants == [plugin.chart_type], viz_type


def test_disabled_plugins_still_own_saved_viz_types() -> None:
    """Saved charts keep their contract when creating the type is disabled."""
    from superset.mcp_service.chart import registry

    plugin = PLUGINS[0]
    viz_type = next(iter(plugin.native_viz_types))
    with patch.object(
        registry,
        "_filter_config",
        registry._PluginFilterConfig(disabled_plugins=frozenset({plugin.chart_type})),
    ):
        assert get_registry().get(plugin.chart_type) is None
        assert plugin_for_viz_type(viz_type) is plugin
    assert plugin_for_viz_type("not_a_registered_viz") is None
    assert plugin_for_viz_type(None) is None


@pytest.mark.parametrize(("plugin", "example"), EXAMPLES, ids=EXAMPLE_IDS)
def test_mapped_viz_type_round_trips_to_plugin(
    plugin: ChartTypePlugin, example: dict[str, Any]
) -> None:
    """Form data produced by a plugin is always interpreted by that plugin."""
    form_data = _form_data(plugin, example)
    assert plugin_for_viz_type(form_data["viz_type"]) is plugin
    assert plugin.resolve_viz_type(_config(example)) == form_data["viz_type"]


@pytest.mark.parametrize(("plugin", "example"), EXAMPLES, ids=EXAMPLE_IDS)
def test_query_construction_contract(
    plugin: ChartTypePlugin, example: dict[str, Any]
) -> None:
    """The shared builder yields well-formed queries and honors plugin hooks."""
    form_data = _form_data(plugin, example)
    with patch.object(
        chart_helpers, "resolve_datasource_engine", return_value="sqlite"
    ):
        queries = build_query_dicts_from_form_data(deepcopy(form_data), 1, "table")
    assert isinstance(queries, list)
    assert queries
    for query in queries:
        assert isinstance(query, dict)
        assert isinstance(query["columns"], list)
        assert isinstance(query["metrics"], list)
        assert isinstance(query["filters"], list)
        assert query["columns"] or query["metrics"], "query selects nothing"

    # A plugin-built query set is exactly what the shared builder returns.
    prepared = deepcopy(form_data)
    with patch.object(
        chart_helpers, "resolve_datasource_engine", return_value="sqlite"
    ):
        chart_helpers.prepare_form_data_for_query(
            prepared, 1, "table", None, datasource_engine="sqlite"
        )
    hooked = plugin.build_query_dicts(
        deepcopy(prepared),
        viz_type=form_data["viz_type"],
        engine="sqlite",
        row_limit=None,
        order_desc=None,
    )
    if hooked is not None:
        assert hooked == queries


@pytest.mark.parametrize(("plugin", "example"), EXAMPLES, ids=EXAMPLE_IDS)
@pytest.mark.parametrize("result", MALFORMED_RESULTS)
def test_result_normalization_contract(
    plugin: ChartTypePlugin, example: dict[str, Any], result: Any
) -> None:
    """Normalization never raises or mutates its input on malformed envelopes."""
    form_data = _form_data(plugin, example)
    original = deepcopy(result)
    normalized = normalize_chart_query_result(result, form_data)
    assert result == original
    assert (
        isinstance(normalized, ChartError) or normalized is not None or (result is None)
    )
    if isinstance(normalized, ChartError):
        assert normalized.error
        assert normalized.error_type


@pytest.mark.parametrize(("plugin", "example"), EXAMPLES, ids=EXAMPLE_IDS)
def test_query_failures_are_not_masked(
    plugin: ChartTypePlugin, example: dict[str, Any]
) -> None:
    """A failed query is surfaced as an error by every plugin that validates."""
    form_data = _form_data(plugin, example)
    failed = {"queries": [{"error": "database exploded", "data": []}]}
    normalized = normalize_chart_query_result(failed, form_data)
    if type(plugin).normalize_query_result is BaseChartPlugin.normalize_query_result:
        assert normalized is failed
    else:
        assert isinstance(normalized, ChartError)


@pytest.mark.parametrize(("plugin", "example"), EXAMPLES, ids=EXAMPLE_IDS)
def test_row_limits_are_positive(
    plugin: ChartTypePlugin, example: dict[str, Any]
) -> None:
    """Compile and preview row limits stay bounded and positive."""
    form_data = _form_data(plugin, example)
    assert 1 <= plugin.compile_row_limit(form_data) <= 10000
    for fallback in (20, 50, 1000):
        assert 1 <= plugin.preview_row_limit(form_data, fallback) <= 10000


@pytest.mark.parametrize(("plugin", "example"), EXAMPLES, ids=EXAMPLE_IDS)
@pytest.mark.parametrize("data", [[], [{"unexpected": 1}]])
def test_preview_contract(
    plugin: ChartTypePlugin, example: dict[str, Any], data: list[Any]
) -> None:
    """Every preview format returns a typed preview or error, never raises."""
    form_data = _form_data(plugin, example)
    ascii_preview = _generate_ascii_preview_from_data(deepcopy(data), form_data)
    assert isinstance(ascii_preview, (ASCIIPreview, ChartError))
    table_preview = _generate_table_preview_from_data(deepcopy(data), form_data)
    assert isinstance(table_preview, (TablePreview, ChartError))
    vega_preview = _generate_vega_lite_preview_from_data(deepcopy(data), form_data)
    assert isinstance(vega_preview, (VegaLitePreview, ChartError))


@pytest.mark.parametrize("allows_empty", [False, True])
@pytest.mark.parametrize("plugin_renderer", [False, True])
def test_saved_empty_preview_obeys_plugin_contract(
    allows_empty: bool, plugin_renderer: bool
) -> None:
    """The flag governs empty rows for both plugin and generic renderers."""
    from superset.mcp_service.chart.schemas import GetChartPreviewRequest
    from superset.mcp_service.chart.tool.get_chart_preview import (
        VegaLitePreviewStrategy,
    )

    chart = MagicMock(id=1, viz_type="__contract__", params="{}")
    strategy = VegaLitePreviewStrategy(
        chart, GetChartPreviewRequest(identifier=1, format="vega_lite")
    )
    plugin = BaseChartPlugin()
    preview = VegaLitePreview(type="vega_lite", specification={"data": {"values": []}})
    module = "superset.mcp_service.chart.tool.get_chart_preview"
    with (
        patch.object(BaseChartPlugin, "allows_empty_result", allows_empty),
        patch(f"{module}.plugin_for_viz_type", return_value=plugin),
        patch(f"{module}.build_query_context_from_form_data"),
        patch.object(strategy, "_authorize_guest_query"),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand"
        ) as command,
        patch.object(
            strategy,
            "_create_plugin_preview",
            return_value=preview if plugin_renderer else None,
        ) as render,
    ):
        command.return_value.run.return_value = {"queries": [{"data": []}]}
        result = strategy.generate()
    if allows_empty:
        assert isinstance(result, VegaLitePreview)
        assert result.specification["data"]["values"] == []
    else:
        assert isinstance(result, ChartError)
        assert result.error_type == "NoDataError"
        render.assert_not_called()


@pytest.mark.parametrize(
    "chart_type", ["bubble_v2", "treemap_v2", "gauge", "histogram", "gantt"]
)
def test_empty_rendering_plugins_opt_in(chart_type: str) -> None:
    """Every plugin intentionally rendering empty rows declares that capability."""
    plugin = get_registry().get(chart_type)
    assert plugin is not None
    assert plugin.allows_empty_result


@pytest.mark.parametrize(("plugin", "example"), EXAMPLES, ids=EXAMPLE_IDS)
def test_saved_and_unsaved_vega_previews_share_plugin_renderer(
    plugin: ChartTypePlugin, example: dict[str, Any]
) -> None:
    """Saved-chart previews reuse the plugin renderer used for unsaved charts."""
    from superset.mcp_service.chart.schemas import GetChartPreviewRequest
    from superset.mcp_service.chart.tool.get_chart_preview import (
        VegaLitePreviewStrategy,
    )

    form_data = _form_data(plugin, example)
    chart = type(
        "SavedChart",
        (),
        {"id": 1, "slice_name": "Saved", "viz_type": form_data["viz_type"]},
    )()
    strategy = VegaLitePreviewStrategy(
        chart, GetChartPreviewRequest(identifier=1, format="vega_lite")
    )
    saved = strategy._create_plugin_preview([], deepcopy(form_data))
    unsaved = plugin.vega_lite_preview([], deepcopy(form_data))
    assert type(saved) is type(unsaved)
    if isinstance(saved, VegaLitePreview) and isinstance(unsaved, VegaLitePreview):
        frame = {"description", "width", "height"}
        if plugin.resizes_saved_preview:
            saved_spec = {
                k: v for k, v in saved.specification.items() if k not in frame
            }
            unsaved_spec = {
                k: v for k, v in unsaved.specification.items() if k not in frame
            }
        else:
            saved_spec, unsaved_spec = saved.specification, unsaved.specification
        assert saved_spec == unsaved_spec


@pytest.mark.parametrize(("plugin", "example"), EXAMPLES, ids=EXAMPLE_IDS)
def test_same_viz_update_keeps_newly_mapped_state(
    plugin: ChartTypePlugin, example: dict[str, Any]
) -> None:
    """An update never loses a query role the new config just mapped."""
    config = _config(example)
    form_data = _form_data(plugin, example)
    existing = {**deepcopy(form_data), "saved_only_control": "kept"}
    merged = merge_chart_form_data(existing, deepcopy(form_data), config)
    assert merged["viz_type"] == form_data["viz_type"]
    for key in ("metric", "metrics", "groupby", "x_axis", "all_columns"):
        if key in form_data:
            assert merged[key] == form_data[key], key


@pytest.mark.parametrize(("plugin", "example"), EXAMPLES, ids=EXAMPLE_IDS)
def test_dataset_rebind_drops_saved_query_roles(
    plugin: ChartTypePlugin, example: dict[str, Any]
) -> None:
    """A dataset rebind never inherits roles that only the old chart had."""
    config = _config(example)
    form_data = _form_data(plugin, example)
    stale = {
        "stale_dataset_role": "old_column",
        "adhoc_filters": [
            {
                "expressionType": "SIMPLE",
                "clause": "WHERE",
                "subject": "old_column",
                "operator": "==",
                "comparator": "x",
            }
        ],
    }
    existing = {**deepcopy(form_data), **stale}
    new_form_data = deepcopy(form_data)
    merged = merge_chart_form_data(existing, new_form_data, config, dataset_rebind=True)
    assert "stale_dataset_role" not in merged
    assert stale["adhoc_filters"][0] not in merged.get("adhoc_filters", [])
    resolved = plugin.resolve_update_config(config, existing, dataset_rebind=True)
    assert resolved.chart_type == config.chart_type


def test_viz_type_change_never_inherits_controls() -> None:
    """Changing viz type replaces every saved control, for every plugin."""
    for plugin, example in EXAMPLES:
        form_data = _form_data(plugin, example)
        existing = {"viz_type": "__another_viz__", "stale": True, "groupby": ["x"]}
        merged = merge_chart_form_data(existing, deepcopy(form_data), _config(example))
        assert merged == form_data


# Functions and modules that must dispatch through plugin hooks rather than
# branching on a registered chart's viz_type or chart_type.
_DISPATCHERS = (chart_helpers, query_result, preview_utils, compile_module, chart_utils)
_DISPATCH_MODULES = (
    "superset/mcp_service/chart/tool/get_chart_preview.py",
    "superset/mcp_service/chart/tool/get_chart_data.py",
    "superset/mcp_service/chart/tool/update_chart.py",
    "superset/mcp_service/chart/tool/update_chart_preview.py",
)


def _registered_names() -> set[str]:
    names: set[str] = set()
    for plugin in PLUGINS:
        names.add(plugin.chart_type)
        names.update(plugin.native_viz_types)
        names.update(plugin.additional_viz_types)
    return names


def _branches_on_registered_type(tree: ast.AST, names: set[str]) -> list[str]:
    """Return comparisons against registered chart names in ``tree``."""
    found: list[str] = []
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Name)
            and node.func.id == "isinstance"
            and len(node.args) == 2
        ):
            # Dispatch on a chart config class is a chart-type branch too.
            classes = node.args[1]
            elements = (
                classes.elts
                if isinstance(classes, (ast.Tuple, ast.List))
                else [classes]
            )
            found.extend(
                ast.unparse(node)
                for element in elements
                if isinstance(element, ast.Name) and element.id.endswith("ChartConfig")
            )
            continue
        operands: list[ast.expr | None] = []
        if isinstance(node, ast.Compare):
            operands = [node.left, *node.comparators]
        elif isinstance(node, ast.Dict):
            operands = list(node.keys)
        elif (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "get"
        ):
            # The key is dispatch; a default such as fd.get("viz_type", "table")
            # is not. Inspecting structure also catches renamed locals.
            operands = list(node.args[:1])
        elif isinstance(node, ast.Subscript):
            operands = [node.slice]
        for operand in operands:
            if operand is None:
                continue
            literals = (
                operand.elts
                if isinstance(operand, (ast.Tuple, ast.List, ast.Set))
                else [operand]
            )
            if any(
                isinstance(literal, ast.Constant)
                and isinstance(literal.value, str)
                and literal.value in names
                for literal in literals
            ):
                found.append(ast.unparse(node))
                break
    return found


# Exact pre-existing expressions outside the lifecycle dispatchers: plugin-owned
# implementation helpers, generic fallback renderers, presentation metadata and
# preview-format selection ("table" also names a chart). Keep whole files scanned:
# unlike a function allowlist, this multiset rejects added or duplicated branches.
_LEGACY_TYPE_BRANCHES = (
    (
        "superset.mcp_service.chart.query_result: form_data.get('viz_type') != "
        "'gauge_chart'"
    ),
    (
        "superset.mcp_service.chart.preview_utils: {'bar': "
        "_generate_safe_ascii_bar_chart, 'dist_bar': _generate_safe_ascii_bar_chart, "
        "'column': _generate_safe_ascii_bar_chart, 'line': "
        "_generate_safe_ascii_line_chart, 'area': _generate_safe_ascii_line_chart, "
        "'pie': _generate_safe_ascii_pie_chart}"
    ),
    (
        "superset.mcp_service.chart.preview_utils: {'echarts_timeseries_line': 'line', "
        "'echarts_timeseries_bar': 'bar', 'echarts_area': 'area', "
        "'echarts_timeseries_scatter': 'point', 'bar': 'bar', 'line': 'line', 'area': "
        "'area', 'scatter': 'point', 'pie': 'arc', 'table': 'text'}"
    ),
    "superset.mcp_service.chart.preview_utils: preview_format == 'table'",
    (
        "superset.mcp_service.chart.chart_utils: {'table': 'table chart', "
        "'ag-grid-table': 'interactive table chart'}"
    ),
    (
        "superset.mcp_service.chart.chart_utils: form_data.get('viz_type') != "
        "'gantt_chart'"
    ),
    "superset.mcp_service.chart.chart_utils: viz_type == 'big_number'",
    (
        "superset.mcp_service.chart.chart_utils: viz_type in ['table', "
        "'pivot_table_v2', 'ag-grid-table', 'ag-grid-pivot-table']"
    ),
    (
        "superset.mcp_service.chart.chart_utils: viz_type in "
        "['echarts_timeseries_line', 'echarts_timeseries_bar']"
    ),
    (
        "superset.mcp_service.chart.chart_utils: {'echarts_timeseries_line': 'Shows "
        "trends and changes over time', 'echarts_timeseries_bar': 'Compares values "
        "across categories or time periods', 'table': 'Displays detailed data in "
        "tabular format', 'ag-grid-table': 'Interactive table with advanced features "
        "like column resizing, sorting, filtering, and server-side pagination', 'pie': "
        "'Shows proportional relationships within a dataset', 'echarts_area': "
        "'Emphasizes cumulative totals and part-to-whole relationships', "
        "'pivot_table_v2': 'Cross-tabulates data with rows, columns, and aggregated "
        "metrics for multi-dimensional analysis', 'ag-grid-pivot-table': "
        "'Interactively cross-tabulates data with AG Grid row groups, pivot columns, "
        "value aggregation, and side-panel reconfiguration', 'mixed_timeseries': "
        "'Combines two different chart types on the same time axis for comparing "
        "related metrics with different scales', 'handlebars': 'Renders data using a "
        "custom Handlebars HTML template for fully flexible layouts like KPI cards, "
        "leaderboards, and reports', 'big_number': 'Displays a key metric with a "
        "trendline showing how the value changes over time', 'big_number_total': "
        "'Highlights a single key metric value as a prominent number'}"
    ),
    (
        "superset.mcp_service.chart.chart_utils: viz_type in "
        "['echarts_timeseries_line', 'echarts_timeseries_bar']"
    ),
    (
        "superset.mcp_service.chart.chart_utils: previous_form_data.get('viz_type') != "
        "'gantt_chart'"
    ),
    (
        "superset.mcp_service.chart.chart_utils: new_form_data.get('viz_type') != "
        "'gantt_chart'"
    ),
    "superset.mcp_service.chart.chart_utils: isinstance(config, TreemapChartConfig)",
    "superset.mcp_service.chart.chart_utils: existing.get('viz_type') == 'treemap_v2'",
    (
        "superset/mcp_service/chart/tool/get_chart_preview.py {'url': "
        "URLPreviewStrategy, 'ascii': ASCIIPreviewStrategy, 'table': "
        "TablePreviewStrategy, 'vega_lite': VegaLitePreviewStrategy}"
    ),
    (
        "superset/mcp_service/chart/tool/get_chart_preview.py {'line': "
        "['echarts_timeseries_line', 'echarts_timeseries', "
        "'echarts_timeseries_smooth', 'echarts_timeseries_step', 'line'], 'bar': "
        "['echarts_timeseries_bar', 'echarts_timeseries_column', 'bar', 'column', "
        "'waterfall'], 'area': ['echarts_area', 'area'], 'scatter': "
        "['echarts_timeseries_scatter', 'scatter'], 'pie': ['pie'], 'big_number': "
        "['big_number', 'big_number_total'], 'histogram': ['histogram', "
        "'histogram_v2'], 'box_plot': ['box_plot'], 'heatmap': ['heatmap', "
        "'heatmap_v2', 'cal_heatmap'], 'funnel': ['funnel'], 'mixed': "
        "['mixed_timeseries'], 'table': ['table']}"
    ),
    (
        "superset/mcp_service/chart/tool/get_chart_data.py {'echarts_timeseries_line': "
        "'line', 'echarts_timeseries_smooth': 'line', 'echarts_timeseries_step': "
        "'line', 'echarts_timeseries': 'line', 'echarts_timeseries_bar': 'bar', "
        "'echarts_area': 'area', 'echarts_timeseries_scatter': 'scatter', "
        "'mixed_timeseries': 'line', 'table': 'table', 'pie': 'pie', 'big_number': "
        "'kpi', 'big_number_total': 'kpi', 'pop_kpi': 'kpi', 'dist_bar': 'bar', "
        "'line': 'line', 'area': 'area', 'scatter': 'scatter', 'bubble': 'bubble', "
        "'bubble_v2': 'bubble', 'treemap_v2': 'treemap', 'sunburst_v2': 'treemap', "
        "'heatmap_v2': 'heatmap', 'gauge_chart': 'gauge', 'funnel': 'funnel', "
        "'histogram': 'histogram', 'histogram_v2': 'histogram', 'box_plot': "
        "'box_plot', 'world_map': 'map', 'pivot_table_v2': 'table', "
        "'ag-grid-pivot-table': 'table', 'waterfall': 'waterfall', 'gantt_chart': "
        "'gantt'}"
    ),
    (
        "superset/mcp_service/chart/tool/get_chart_data.py {'line chart': 'line', "
        "'multi-line chart': 'line', 'area chart': 'area', 'bar chart': 'bar', "
        "'scatter plot': 'scatter', 'bubble chart': 'bubble', 'pie chart': 'pie', "
        "'treemap': 'treemap', 'heatmap': 'heatmap', 'big number / KPI': 'kpi', 'gauge "
        "chart': 'gauge', 'histogram': 'histogram', 'table': 'table'}"
    ),
)


def test_dispatchers_do_not_branch_on_registered_chart_types() -> None:
    """Chart-specific behavior lives in plugin hooks, not shared dispatchers."""
    names = _registered_names()
    violations: list[str] = []
    for module in _DISPATCHERS:
        tree = ast.parse(inspect.getsource(module))
        violations.extend(
            f"{module.__name__}: {hit}"
            for hit in _branches_on_registered_type(tree, names)
        )
    root = Path(chart_helpers.__file__).resolve().parents[3]
    for relative in _DISPATCH_MODULES:
        tree = ast.parse((root / relative).read_text())
        violations.extend(
            f"{relative} {hit}" for hit in _branches_on_registered_type(tree, names)
        )
    unexpected = Counter(violations) - Counter(_LEGACY_TYPE_BRANCHES)
    stale = Counter(_LEGACY_TYPE_BRANCHES) - Counter(violations)
    assert not unexpected, "\n".join(unexpected)
    assert not stale, "Remove obsolete baseline entries: " + "\n".join(stale)


@pytest.mark.parametrize("chart_type", ["gauge", "treemap_v2"])
@pytest.mark.parametrize(
    "value", [None, "invalid", [1], {"limit": 1}, float("inf"), -1, 0, 1, "3", 100]
)
def test_compile_row_limit_handles_persisted_values(
    chart_type: str, value: Any
) -> None:
    """Malformed saved limits fall back while valid small limits are preserved."""
    plugin = get_registry().get(chart_type)
    assert plugin is not None
    expected = 1 if value == 1 else 3 if value == "3" else 10
    assert plugin.compile_row_limit({"row_limit": value}) == expected


@pytest.mark.parametrize("groupby", ["stage", ["stage"]])
def test_saved_scalar_groupby_waterfall_query(groupby: str | list[str]) -> None:
    """Saved params bypass ChartConfig and must preserve full column names."""
    plugin = get_registry().get("waterfall")
    assert plugin is not None
    queries = plugin.build_query_dicts(
        {"x_axis": "month", "groupby": groupby, "metric": "revenue"},
        viz_type="waterfall",
        engine="sqlite",
        row_limit=10,
        order_desc=False,
    )
    assert queries is not None
    assert queries[0]["columns"] == ["month", "stage"]
    assert queries[0]["orderby"] == [("month", True), ("stage", True)]


@pytest.mark.parametrize("groupby", ["stage", ["stage"]])
def test_saved_scalar_groupby_funnel_preview(groupby: str | list[str]) -> None:
    """Scalar saved groupby binds the complete funnel stage name."""
    funnel = preview_utils.generate_funnel_vega_lite_preview(
        [{"stage": "Qualified", "revenue": 5}],
        {"groupby": groupby, "metric": "revenue"},
    )
    assert isinstance(funnel, VegaLitePreview)
    assert funnel.specification["encoding"]["y"]["field"] == "stage"


@pytest.mark.parametrize("groupby", ["stage", ["stage"]])
def test_saved_scalar_groupby_histogram_preview(groupby: str | list[str]) -> None:
    """Scalar saved groupby is excluded from bins and retained as the series."""
    histogram = preview_utils.generate_histogram_vega_lite_preview(
        [{"stage": "Qualified", "0-10": 5}], {"groupby": groupby}
    )
    assert histogram.specification["data"]["values"] == [
        {"bin": "0-10", "value": 5, "series": "Qualified"}
    ]


@pytest.mark.parametrize(
    "source",
    [
        'vt = fd.get("viz_type"); result = vt == "waterfall"',
        'result = alias in ("waterfall", "other")',
        'handlers = {"waterfall": handler}',
        'result = handlers.get("waterfall")',
        'result = handlers["waterfall"]',
        (
            'def previously_unlisted_helper(fd):\n    vt = fd.get("viz_type")\n    '
            'return vt == "waterfall"'
        ),
    ],
)
def test_dispatch_guard_detects_structural_branches(source: str) -> None:
    """Aliases, keyed dispatch and unlisted helpers cannot evade the guard."""
    assert _branches_on_registered_type(ast.parse(source), {"waterfall"})


def test_dispatch_guard_ignores_get_default() -> None:
    """A default chart name does not select chart-specific behavior."""
    assert not _branches_on_registered_type(
        ast.parse('fd.get("viz_type", "table")'), {"table"}
    )


@pytest.mark.parametrize("value", [True, False])
def test_boolean_compile_limit_uses_fallback(value: bool) -> None:
    """Booleans are malformed persisted limits, not one-row samples."""
    from superset.mcp_service.chart.plugin import capped_compile_row_limit

    assert capped_compile_row_limit({"row_limit": value}) == 10


@pytest.mark.parametrize("nullable", [False, True])
def test_compact_schema_annotations_are_isolated(nullable: bool) -> None:
    """Mutating one annotation cannot corrupt other chart tool schemas."""
    from superset.mcp_service.chart.schemas import (
        CHART_CONFIG_REFERENCE_SCHEMA,
        chart_config_reference_schema,
    )

    first = chart_config_reference_schema(nullable=nullable)
    second = chart_config_reference_schema(nullable=nullable)
    assert first.json_schema == second.json_schema
    assert first.json_schema is not None
    schema = first.json_schema["anyOf"][0] if nullable else first.json_schema
    schema["properties"]["chart_type"]["enum"].append("mutation")
    assert first.json_schema != second.json_schema
    assert (
        "mutation"
        not in CHART_CONFIG_REFERENCE_SCHEMA["properties"]["chart_type"]["enum"]
    )
