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
from copy import deepcopy
from pathlib import Path
from typing import Any
from unittest.mock import patch

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
    "supports_vega_lite_preview",
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
    assert isinstance(plugin.dataset_rebind_roles, str)
    assert plugin.dataset_rebind_roles
    assert isinstance(plugin.invalid_result_suggestions, tuple)
    assert plugin.invalid_result_suggestions
    assert all(isinstance(s, str) and s for s in plugin.invalid_result_suggestions)
    if plugin.normalize_data_results:
        # Exposing rows through get_chart_data under a contract requires one.
        assert (
            type(plugin).normalize_query_result
            is not BaseChartPlugin.normalize_query_result
        )
    if plugin.requires_config_for_dataset_rebind:
        assert plugin.requires_compile_check


@pytest.mark.parametrize(("plugin", "example"), EXAMPLES, ids=EXAMPLE_IDS)
def test_vega_lite_support_matches_preview_hook(
    plugin: ChartTypePlugin, example: dict[str, Any]
) -> None:
    """A plugin that opts out of Vega-Lite rejects Vega-Lite previews."""
    if plugin.supports_vega_lite_preview:
        return
    form_data = _form_data(plugin, example)
    assert isinstance(plugin.vega_lite_preview([], deepcopy(form_data)), ChartError)


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
_DISPATCHERS: dict[Any, tuple[str, ...]] = {
    chart_helpers: (
        "build_query_dicts_from_form_data",
        "build_single_query_dict",
        "resolve_metrics",
        "resolve_metrics_and_groupby",
    ),
    query_result: ("normalize_chart_query_result",),
    preview_utils: (
        "generate_preview_from_form_data",
        "_generate_ascii_preview_from_data",
        "_generate_vega_lite_preview_from_data",
    ),
    compile_module: ("_compile_chart",),
    chart_utils: ("merge_chart_form_data",),
}
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
                f"line {node.lineno}: isinstance {element.id}"
                for element in elements
                if isinstance(element, ast.Name) and element.id.endswith("ChartConfig")
            )
            continue
        if not isinstance(node, ast.Compare):
            continue
        expression = ast.unparse(node)
        if "viz_type" not in expression and "chart_type" not in expression:
            # e.g. datasource_type == "table" is not a chart-type branch.
            continue
        for operand in (node.left, *node.comparators):
            literals: list[ast.AST] = [operand]
            if isinstance(operand, (ast.Tuple, ast.List, ast.Set)):
                literals = list(operand.elts)
            for literal in literals:
                if (
                    isinstance(literal, ast.Constant)
                    and isinstance(literal.value, str)
                    and literal.value in names
                ):
                    found.append(f"line {node.lineno}: {literal.value!r}")
    return found


def test_dispatchers_do_not_branch_on_registered_chart_types() -> None:
    """Chart-specific behavior lives in plugin hooks, not shared dispatchers."""
    names = _registered_names()
    violations: list[str] = []
    for module, functions in _DISPATCHERS.items():
        for name in functions:
            source = inspect.getsource(getattr(module, name))
            tree = ast.parse(inspect.cleandoc("\n" + source))
            violations.extend(
                f"{module.__name__}.{name} {hit}"
                for hit in _branches_on_registered_type(tree, names)
            )
    root = Path(chart_helpers.__file__).resolve().parents[3]
    for relative in _DISPATCH_MODULES:
        tree = ast.parse((root / relative).read_text())
        violations.extend(
            f"{relative} {hit}" for hit in _branches_on_registered_type(tree, names)
        )
    assert not violations, "\n".join(violations)


def test_capped_compile_row_limit_default_and_override() -> None:
    """The named compile cap preserves the default and explicit overrides."""
    from superset.mcp_service.chart.plugin import (
        capped_compile_row_limit,
        DEFAULT_COMPILE_ROW_LIMIT,
    )

    assert DEFAULT_COMPILE_ROW_LIMIT == 10
    assert capped_compile_row_limit({}) == DEFAULT_COMPILE_ROW_LIMIT
    assert capped_compile_row_limit({"row_limit": 100}) == DEFAULT_COMPILE_ROW_LIMIT
    assert capped_compile_row_limit({}, cap=5) == 5
    assert capped_compile_row_limit({"row_limit": 100}, cap=5) == 5
    assert capped_compile_row_limit({"row_limit": 3}, cap=5) == 3


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
