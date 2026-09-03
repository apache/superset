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

"""Product-path coverage for typed MCP Sunburst support."""

from collections.abc import Iterator, Mapping
from copy import deepcopy
from decimal import Decimal
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, Mock, patch

import pytest
import yaml
from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError

from superset.common.form_data_query_context import (
    build_query_context_from_form_data,
)
from superset.mcp_service.chart.chart_helpers import (
    build_query_context_from_form_data as build_mcp_query_context_from_form_data,
    build_query_dicts_from_form_data,
    canonicalize_operation_form_data,
    resolve_form_data_datasource,
)
from superset.mcp_service.chart.chart_utils import (
    analyze_chart_semantics,
    generate_explore_link,
    map_config_to_form_data,
    merge_form_data_for_update,
)
from superset.mcp_service.chart.compile import (
    _compile_chart,
    CompileResult,
    validate_and_compile,
)
from superset.mcp_service.chart.plugins.interactive_pivot import (
    map_interactive_pivot_config,
)
from superset.mcp_service.chart.preview_utils import (
    _generate_ascii_preview_from_data,
    _generate_table_preview_from_data,
    _generate_vega_lite_preview_from_data,
    generate_preview_from_form_data,
)
from superset.mcp_service.chart.query_result import first_query_data
from superset.mcp_service.chart.registry import display_name_for_viz_type, get_registry
from superset.mcp_service.chart.schemas import (
    BigNumberChartConfig,
    BoxPlotChartConfig,
    ChartConfig,
    ChartError,
    ColumnRef,
    GenerateChartRequest,
    GenerateExploreLinkRequest,
    GetChartDataRequest,
    GetChartPreviewRequest,
    HandlebarsChartConfig,
    HistogramChartConfig,
    InteractivePivotChartConfig,
    MixedTimeseriesChartConfig,
    PieChartConfig,
    PivotTableChartConfig,
    SunburstChartConfig,
    SunburstNativeMetricColumn,
    TableChartConfig,
    UpdateChartPreviewRequest,
    UpdateChartRequest,
    WaterfallChartConfig,
    XYChartConfig,
)
from superset.mcp_service.chart.sunburst import (
    normalize_sunburst_form_data_references,
    resolve_sunburst_result_roles,
    validate_sunburst_result_data,
)
from superset.mcp_service.chart.tool.generate_chart import generate_chart
from superset.mcp_service.chart.tool.get_chart_data import get_chart_data
from superset.mcp_service.chart.tool.get_chart_preview import (
    ASCIIPreviewStrategy,
    TablePreviewStrategy,
    VegaLitePreviewStrategy,
)
from superset.mcp_service.chart.tool.get_chart_type_schema import (
    _get_chart_type_schema_impl,
)
from superset.mcp_service.chart.tool.update_chart import (
    _build_preview_form_data,
    _build_update_payload,
    update_chart,
)
from superset.mcp_service.chart.tool.update_chart_preview import update_chart_preview
from superset.mcp_service.chart.validation.dataset_validator import DatasetValidator
from superset.mcp_service.chart.validation.runtime.chart_type_suggester import (
    ChartTypeSuggester,
)
from superset.mcp_service.common.error_schemas import DatasetContext
from superset.utils import json
from superset.utils.core import GenericDataType
from tests.unit_tests.mcp_service.chart.query_result_fixtures import (
    chart_data_command_result,
)


@pytest.fixture(autouse=True)
def mock_programmatic_query_form_data_seed():
    """Keep query-result tests focused on their isolated context doubles."""
    with patch("superset.charts.data.form_data.set_query_context_form_data"):
        yield


def _config(**overrides: object) -> SunburstChartConfig:
    payload: dict[str, object] = {
        "chart_type": "sunburst",
        "hierarchy": [{"name": "region"}, {"name": "country"}],
        "metric": {"name": "sales", "aggregate": "SUM", "label": "Sales"},
    }
    payload.update(overrides)
    return SunburstChartConfig.model_validate(payload)


def _frontend_column_meta(
    column_name: object = "sales", type_: object = "DOUBLE"
) -> dict[object, object]:
    """Mirror the frontend TestDataset ColumnMeta shape plus future fields."""
    return {
        "advanced_data_type": None,
        "certification_details": None,
        "certified_by": None,
        "column_name": column_name,
        "description": None,
        "expression": "",
        "filterable": True,
        "groupby": True,
        "id": 332,
        "is_certified": False,
        "is_dttm": False,
        "python_date_format": None,
        "type": type_,
        "type_generic": 0,
        "verbose_name": None,
        "warning_markdown": None,
        "forward_compatible": {
            "nested": ["value", 1, 1.5, True, None, {"enabled": False}]
        },
    }


def _frontend_native_metric() -> dict[str, object]:
    return {
        "expressionType": "SIMPLE",
        "column": _frontend_column_meta(),
        "aggregate": "SUM",
        "hasCustomLabel": False,
        "label": "SUM(sales)",
    }


def _hostile_native_metric_cases(  # noqa: C901
    calls: list[str],
) -> list[tuple[str, object]]:
    """Build hostile values without relying on their application hooks."""

    class HostileObject:
        def __repr__(self) -> str:
            calls.append("object.repr")
            raise AssertionError

        def __str__(self) -> str:
            calls.append("object.str")
            raise AssertionError

        def __hash__(self) -> int:
            calls.append("object.hash")
            raise AssertionError

        def __eq__(self, _other: object) -> bool:
            calls.append("object.eq")
            raise AssertionError

        def __bool__(self) -> bool:
            calls.append("object.bool")
            raise AssertionError

        def __iter__(self) -> Iterator[object]:
            calls.append("object.iter")
            raise AssertionError

        def __getitem__(self, _key: object) -> object:
            calls.append("object.getitem")
            raise AssertionError

    class HostileStr(str):
        def __repr__(self) -> str:
            calls.append("str.repr")
            raise AssertionError

        def __str__(self) -> str:
            calls.append("str.str")
            raise AssertionError

        def __hash__(self) -> int:
            calls.append("str.hash")
            return str.__hash__(self)

        def __eq__(self, _other: object) -> bool:
            calls.append("str.eq")
            raise AssertionError

    class HostileDict(dict[object, object]):
        def __repr__(self) -> str:
            calls.append("dict.repr")
            raise AssertionError

        def __iter__(self) -> Iterator[object]:
            calls.append("dict.iter")
            raise AssertionError

        def items(self):
            calls.append("dict.items")
            raise AssertionError

        def keys(self):
            calls.append("dict.keys")
            raise AssertionError

        def get(self, _key: object, _default: object = None) -> object:
            calls.append("dict.get")
            raise AssertionError

        def __getitem__(self, _key: object) -> object:
            calls.append("dict.getitem")
            raise AssertionError

    class HostileList(list[object]):
        def __repr__(self) -> str:
            calls.append("list.repr")
            raise AssertionError

        def __iter__(self) -> Iterator[object]:
            calls.append("list.iter")
            raise AssertionError

        def __getitem__(self, _key: object) -> object:  # type: ignore[override]
            calls.append("list.getitem")
            raise AssertionError

    class HostileMapping(Mapping[object, object]):
        def __repr__(self) -> str:
            calls.append("mapping.repr")
            raise AssertionError

        def __iter__(self) -> Iterator[object]:
            calls.append("mapping.iter")
            raise AssertionError

        def __len__(self) -> int:
            calls.append("mapping.len")
            raise AssertionError

        def __getitem__(self, _key: object) -> object:
            calls.append("mapping.getitem")
            raise AssertionError

    def simple(**overrides: object) -> dict[object, object]:
        metric: dict[object, object] = {
            "expressionType": "SIMPLE",
            "column": "sales",
            "aggregate": "SUM",
        }
        for key, value in overrides.items():
            dict.__setitem__(metric, key, value)
        return metric

    hostile_key = HostileStr("expressionType")
    hostile_key_metric: dict[object, object] = {
        hostile_key: "SIMPLE",
        "column": "sales",
        "aggregate": "SUM",
    }
    return [
        ("label string subclass", simple(label=HostileStr("Sales"))),
        ("aggregate string subclass", simple(aggregate=HostileStr("SUM"))),
        (
            "SQL expression string subclass",
            {
                "expressionType": "SQL",
                "sqlExpression": HostileStr("SUM(sales)"),
                "label": "Sales",
            },
        ),
        ("option name string subclass", simple(optionName=HostileStr("metric"))),
        ("expression object", simple(expressionType=HostileObject())),
        ("custom label boolean object", simple(hasCustomLabel=HostileObject())),
        ("datasource warning object", simple(datasourceWarning=HostileObject())),
        (
            "column dict subclass",
            simple(column=HostileDict(column_name="sales")),
        ),
        ("column list subclass", simple(column=HostileList(["sales"]))),
        (
            "nested ColumnMeta scalar",
            simple(column={"column_name": "sales", "future": HostileObject()}),
        ),
        (
            "nested ColumnMeta dict subclass",
            simple(
                column={
                    "column_name": "sales",
                    "future": HostileDict(enabled=True),
                }
            ),
        ),
        (
            "nested ColumnMeta list subclass",
            simple(
                column={
                    "column_name": "sales",
                    "future": HostileList([True]),
                }
            ),
        ),
        ("mapping wrapper", HostileMapping()),
        ("list wrapper", HostileList([])),
        (
            "dict wrapper subclass",
            HostileDict(expressionType="SIMPLE", column="sales", aggregate="SUM"),
        ),
        ("hostile wrapper key", hostile_key_metric),
    ]


def _frontend_native_config(**overrides: object) -> SunburstChartConfig:
    payload: dict[str, object] = {
        "viz_type": "sunburst_v2",
        "columns": ["region", "country"],
        "metric": _frontend_native_metric(),
    }
    payload.update(overrides)
    return SunburstChartConfig.model_validate(payload)


def _registered_query_role_matrix() -> list[ChartConfig]:
    """Return configs covering every registered native viz and query mode."""
    metric = ColumnRef(name="sales", aggregate="SUM")
    return [
        TableChartConfig(
            viz_type=viz_type,
            query_mode=query_mode,
            columns=(
                [ColumnRef(name="region")]
                if query_mode == "raw"
                else [ColumnRef(name="region"), metric]
            ),
        )
        for viz_type in ("table", "ag-grid-table")
        for query_mode in ("raw", "aggregate")
    ] + [
        PieChartConfig(dimension=ColumnRef(name="region"), metric=metric),
        *[
            XYChartConfig(
                kind=kind,
                x=ColumnRef(name="order_date"),
                y=[metric],
            )
            for kind in ("line", "bar", "area", "scatter")
        ],
        PivotTableChartConfig(
            rows=[ColumnRef(name="region")],
            columns=[ColumnRef(name="country")],
            metrics=[metric],
        ),
        MixedTimeseriesChartConfig(
            x=ColumnRef(name="order_date"),
            y=[metric],
            y_secondary=[ColumnRef(name="profit", aggregate="SUM")],
        ),
        HandlebarsChartConfig(
            chart_type="handlebars",
            handlebars_template="{{ data }}",
            query_mode="raw",
            columns=[ColumnRef(name="region")],
        ),
        HandlebarsChartConfig(
            chart_type="handlebars",
            handlebars_template="{{ data }}",
            query_mode="aggregate",
            groupby=[ColumnRef(name="region")],
            metrics=[metric],
        ),
        BigNumberChartConfig(chart_type="big_number", metric=metric),
        BigNumberChartConfig(
            chart_type="big_number",
            metric=metric,
            show_trendline=True,
            temporal_column="order_date",
        ),
        HistogramChartConfig(column=ColumnRef(name="sales")),
        BoxPlotChartConfig(
            metrics=[metric],
            distribute_across=[ColumnRef(name="country")],
            dimensions=[ColumnRef(name="region")],
        ),
        WaterfallChartConfig(
            x_axis=ColumnRef(name="order_date"),
            metric=metric,
            breakdown=ColumnRef(name="region"),
        ),
        _config(),
    ]


def _dataset() -> Mock:
    """Return dataset metadata sufficient for normalization product paths."""
    database = Mock(database_name="main", db_engine_spec=None)
    columns = []
    for name, type_, is_numeric in (
        ("Region", "VARCHAR", False),
        ("Country", "VARCHAR", False),
        ("Sales", "DOUBLE", True),
        ("Profit", "DOUBLE", True),
        ("Status", "VARCHAR", False),
        ("OrderDate", "TIMESTAMP", False),
    ):
        columns.append(
            Mock(
                column_name=name,
                type=type_,
                is_temporal=name == "OrderDate",
                is_dttm=name == "OrderDate",
                is_numeric=is_numeric,
            )
        )
    return Mock(
        id=7,
        table_name="sales",
        schema="analytics",
        database=database,
        columns=columns,
        metrics=[
            Mock(metric_name="SavedSales", expression="SUM(sales)", description=None)
        ],
    )


def _rural_breakdown_params() -> dict[str, object]:
    """Load the repository's exported Sunburst form_data fixture."""
    fixture = (
        Path(__file__).parents[4]
        / "superset/examples/world_health/charts/Rural_Breakdown.yaml"
    )
    payload = yaml.safe_load(fixture.read_text())
    assert isinstance(payload["params"], dict)
    return payload["params"]


def test_schema_uses_typed_mcp_and_frontend_tags() -> None:
    config = _config()
    assert config.chart_type == "sunburst"
    assert config.viz_type == "sunburst_v2"
    assert get_registry().get("sunburst") is not None
    assert display_name_for_viz_type("sunburst_v2") == "Sunburst Chart"


def test_operation_fields_are_owned_without_weakening_native_round_trip() -> None:
    """Native envelope values survive parsing but never choose an operation target."""
    config = _config(datasource="10__table", slice_id=404)
    native = map_config_to_form_data(config)
    assert native["datasource"] == "10__table"
    assert native["slice_id"] == 404

    unsaved = canonicalize_operation_form_data(native, datasource_id=99)
    assert unsaved["datasource"] == "99__table"
    assert "slice_id" not in unsaved

    update = canonicalize_operation_form_data(
        native,
        datasource_id=99,
        datasource_type="table",
        chart_id=19,
    )
    assert update["datasource"] == "99__table"
    assert update["slice_id"] == 19


@pytest.mark.parametrize("viz_type", ["sunburst_v2", "table", "pie"])
def test_operation_identity_is_canonicalized_for_every_target_viz(
    viz_type: str,
) -> None:
    native = {
        "viz_type": viz_type,
        "datasource": "10__table",
        "datasource_id": 10,
        "datasource_type": "table",
        "slice_id": 404,
    }

    unsaved = canonicalize_operation_form_data(native, datasource_id=99)
    saved = canonicalize_operation_form_data(
        native,
        datasource_id=99,
        datasource_type="table",
        chart_id=19,
    )

    assert unsaved["datasource"] == "99__table"
    assert "slice_id" not in unsaved
    assert saved["datasource"] == "99__table"
    assert saved["slice_id"] == 19
    assert {"datasource_id", "datasource_type"}.isdisjoint(unsaved)


@pytest.mark.parametrize(
    "target_config",
    [
        TableChartConfig(columns=[{"name": "region"}]),
        PieChartConfig(
            dimension={"name": "region"},
            metric={"name": "sales", "aggregate": "SUM"},
        ),
    ],
    ids=["table", "pie"],
)
@pytest.mark.parametrize("generate_preview", [False, True])
def test_sunburst_cross_viz_rebind_owns_target_identity(
    target_config: TableChartConfig | PieChartConfig,
    generate_preview: bool,
) -> None:
    chart = Mock(
        id=19,
        datasource_id=10,
        datasource_type="table",
        slice_name="Saved hierarchy",
        params=json.dumps(
            {
                "viz_type": "sunburst_v2",
                "columns": ["region", "country"],
                "metric": "SavedSales",
                "order_by_cols": ['["country", false]'],
                "adhoc_filters": [{"subject": "region"}],
                "column_config": {"region": {"columnWidth": 120}},
                "show_labels": True,
                "datasource": "10__table",
                "slice_id": 777,
            }
        ),
    )
    request = UpdateChartRequest(
        identifier=19,
        dataset_id=99,
        config=target_config,
        generate_preview=generate_preview,
    )

    if generate_preview:
        state = _build_preview_form_data(request, chart, parsed_config=target_config)
    else:
        payload = _build_update_payload(request, chart, parsed_config=target_config)
        assert isinstance(payload, dict)
        assert payload["datasource_id"] == 99
        state = json.loads(payload["params"])

    assert isinstance(state, dict)
    assert state["viz_type"] in {"table", "pie"}
    assert state["datasource"] == "99__table"
    assert state["slice_id"] == 19
    assert resolve_form_data_datasource(state) == (99, "table")


@pytest.mark.parametrize(
    "strategy_class",
    [ASCIIPreviewStrategy, TablePreviewStrategy, VegaLitePreviewStrategy],
)
def test_saved_preview_formats_bind_rebound_chart_identity(
    strategy_class: type,
) -> None:
    chart = Mock(
        id=19,
        datasource_id=99,
        datasource_type="table",
        params=json.dumps(
            {
                "viz_type": "table",
                "datasource": "10__table",
                "slice_id": 777,
            }
        ),
    )
    strategy = strategy_class(chart, GetChartPreviewRequest(identifier=19))

    state = strategy._canonical_form_data(json.loads(chart.params))

    assert state["datasource"] == "99__table"
    assert state["slice_id"] == 19


def test_compile_uses_resolved_dataset_and_discards_native_chart_identity() -> None:
    form_data = map_config_to_form_data(_config(datasource="10__table", slice_id=404))
    query_builder = MagicMock(return_value=object())
    command = MagicMock()
    command.run.return_value = {
        "queries": [
            {
                "data": [
                    {"region": "North", "country": "CA", "Sales": 1},
                ]
            }
        ]
    }

    with (
        patch(
            "superset.mcp_service.chart.chart_helpers."
            "build_query_context_from_form_data",
            query_builder,
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand",
            return_value=command,
        ),
    ):
        result = _compile_chart(form_data, 99)

    assert result.success is True
    compiled_form_data = query_builder.call_args.args[0]
    assert compiled_form_data["datasource"] == "99__table"
    assert "slice_id" not in compiled_form_data


@pytest.mark.parametrize(
    "form_data",
    [
        {
            "viz_type": "table",
            "query_mode": "raw",
            "all_columns": ["region"],
            "datasource": "10__table",
            "slice_id": 404,
        },
        {
            "viz_type": "pie",
            "groupby": ["region"],
            "metric": "SavedSales",
            "datasource": "10__table",
            "slice_id": 404,
        },
    ],
    ids=["table", "pie"],
)
def test_compile_canonicalization_does_not_depend_on_target_viz(
    form_data: dict[str, object],
) -> None:
    query_builder = MagicMock(return_value=object())
    command = MagicMock()
    command.run.return_value = {"queries": [{"data": [{"region": "North"}]}]}

    with (
        patch(
            "superset.mcp_service.chart.chart_helpers."
            "build_query_context_from_form_data",
            query_builder,
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand",
            return_value=command,
        ),
    ):
        result = _compile_chart(form_data, 99)

    assert result.success is True
    compiled_form_data = query_builder.call_args.args[0]
    assert compiled_form_data["datasource"] == "99__table"
    assert "slice_id" not in compiled_form_data


@pytest.mark.asyncio
async def test_get_chart_data_fallback_uses_rebound_chart_identity() -> None:
    chart = Mock(
        id=19,
        datasource_id=99,
        datasource_type="table",
        slice_name="Rebound table",
        viz_type="table",
        query_context=None,
        params=json.dumps(
            {
                "viz_type": "table",
                "query_mode": "raw",
                "all_columns": ["Region"],
                "datasource": "10__table",
                "slice_id": 777,
            }
        ),
    )
    context = MagicMock()
    context.info = AsyncMock()
    context.debug = AsyncMock()
    context.warning = AsyncMock()
    context.error = AsyncMock()
    context.report_progress = AsyncMock()
    factory = MagicMock()
    query_context = object()
    factory.create.return_value = query_context
    command = MagicMock()
    command.run.return_value = {
        "queries": [
            {
                "data": [{"Region": "North"}],
                "colnames": ["Region"],
                "coltypes": [0],
                "rowcount": 1,
            }
        ]
    }
    seed_form_data = MagicMock()

    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=Mock(id=1, username="admin", roles=[], groups=[]),
        ),
        patch(
            "superset.mcp_service.chart.tool.get_chart_data.find_chart_by_identifier",
            return_value=chart,
        ),
        patch(
            "superset.mcp_service.chart.tool.get_chart_data.validate_chart_dataset",
            return_value=Mock(is_valid=True, warnings=[], error=None),
        ),
        patch(
            "superset.mcp_service.chart.tool.get_chart_data."
            "set_query_context_form_data",
            seed_form_data,
        ),
        patch(
            "superset.common.query_context_factory.QueryContextFactory",
            return_value=factory,
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand",
            return_value=command,
        ),
    ):
        result = await get_chart_data(
            GetChartDataRequest(identifier=19),
            ctx=context,
        )

    assert not isinstance(result, ChartError)
    created = factory.create.call_args.kwargs
    assert created["datasource"] == {"id": 99, "type": "table"}
    assert created["form_data"]["datasource"] == "99__table"
    assert created["form_data"]["slice_id"] == 19
    seed_form_data.assert_called_once_with(query_context, 99, "table")


def test_unsaved_explore_cache_cannot_inherit_native_chart_identity() -> None:
    form_data = map_config_to_form_data(_config(datasource="10__table", slice_id=404))
    cache_command = MagicMock()
    cache_command.return_value.run.return_value = "new-chart-key"

    with (
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=Mock(id=99)),
        patch(
            "superset.mcp_service.commands.create_form_data.MCPCreateFormDataCommand",
            cache_command,
        ),
        patch(
            "superset.mcp_service.chart.chart_utils.get_superset_base_url",
            return_value="http://localhost:8088",
        ),
    ):
        explore_url = generate_explore_link(99, form_data, prefer_permalink=False)

    assert explore_url.endswith("/explore/?form_data_key=new-chart-key")
    assert "slice_id=" not in explore_url
    command_params = cache_command.call_args.args[0]
    cached = json.loads(command_params.form_data)
    assert command_params.chart_id == 0
    assert cached["datasource"] == "99__table"
    assert "slice_id" not in cached


def test_registering_sunburst_keeps_all_core_chart_plugins() -> None:
    assert {
        "xy",
        "table",
        "pie",
        "pivot_table",
        "mixed_timeseries",
        "handlebars",
        "big_number",
        "histogram",
        "box_plot",
        "waterfall",
        "sunburst",
    } <= set(get_registry().all_types())


@pytest.mark.parametrize(
    "config",
    [
        TableChartConfig(columns=[ColumnRef(name="region")]),
        PieChartConfig(
            dimension=ColumnRef(name="region"),
            metric=ColumnRef(name="sales", aggregate="SUM"),
        ),
        HistogramChartConfig(column=ColumnRef(name="sales")),
        XYChartConfig(
            x=ColumnRef(name="order_date"),
            y=[ColumnRef(name="sales", aggregate="SUM")],
        ),
        MixedTimeseriesChartConfig(
            x=ColumnRef(name="order_date"),
            y=[ColumnRef(name="sales", aggregate="SUM")],
            y_secondary=[ColumnRef(name="profit", aggregate="SUM")],
        ),
        _config(),
    ],
    ids=["table", "pie", "histogram", "xy", "mixed", "sunburst"],
)
def test_registered_same_viz_updates_preserve_native_plugin_controls(config) -> None:
    """Same-viz merges retain valid native state not exposed by typed configs."""
    with patch(
        "superset.mcp_service.chart.chart_utils.is_column_truly_temporal",
        return_value=True,
    ):
        mapped = (
            map_interactive_pivot_config(config)
            if isinstance(config, InteractivePivotChartConfig)
            else map_config_to_form_data(config)
        )

    existing = {
        "viz_type": mapped["viz_type"],
        "native_plugin_control": {"enabled": True},
    }
    merged = merge_form_data_for_update(existing, mapped, config)
    assert merged["native_plugin_control"] == {"enabled": True}

    cross_viz = merge_form_data_for_update(
        {"viz_type": "foreign_viz", "native_plugin_control": {"enabled": True}},
        mapped,
        config,
    )
    assert "native_plugin_control" not in cross_viz


@pytest.mark.parametrize(
    "config,existing_key,existing_value,expected",
    [
        (
            PieChartConfig(
                dimension=ColumnRef(name="region"),
                metric=ColumnRef(name="sales", aggregate="SUM"),
                show_total=False,
            ),
            "show_total",
            True,
            False,
        ),
        (
            HistogramChartConfig(column=ColumnRef(name="sales"), normalize=False),
            "normalize",
            True,
            False,
        ),
        (
            PivotTableChartConfig(
                rows=[ColumnRef(name="region")],
                metrics=[ColumnRef(name="sales", aggregate="SUM")],
                combine_metric=False,
            ),
            "combineMetric",
            True,
            False,
        ),
        (
            InteractivePivotChartConfig(
                rows=[ColumnRef(name="region")],
                metrics=[ColumnRef(name="sales", aggregate="SUM")],
                show_column_totals=False,
            ),
            "colTotals",
            True,
            False,
        ),
        (
            WaterfallChartConfig(
                x_axis=ColumnRef(name="order_date"),
                metric=ColumnRef(name="sales", aggregate="SUM"),
                show_legend=False,
            ),
            "show_legend",
            True,
            False,
        ),
        (
            HandlebarsChartConfig(
                chart_type="handlebars",
                handlebars_template="{{ data }}",
                query_mode="raw",
                columns=[ColumnRef(name="region")],
                style_template=None,
            ),
            "styleTemplate",
            "old css",
            None,
        ),
        (
            BigNumberChartConfig(
                chart_type="big_number",
                metric=ColumnRef(name="sales", aggregate="SUM"),
                subheader=None,
            ),
            "subheader",
            "old subtitle",
            None,
        ),
        (
            TableChartConfig(columns=[ColumnRef(name="region")], color_scheme=None),
            "color_scheme",
            "old scheme",
            None,
        ),
    ],
    ids=[
        "pie-false",
        "histogram-false",
        "pivot-false",
        "interactive-pivot-false",
        "waterfall-false",
        "handlebars-null",
        "big-number-null",
        "table-null",
    ],
)
def test_explicit_sparse_controls_replace_same_viz_preservation(
    config: ChartConfig,
    existing_key: str,
    existing_value: object,
    expected: object,
) -> None:
    """Explicit false/null wins for every sparse mapper family."""
    with patch(
        "superset.mcp_service.chart.chart_utils._find_dataset_by_id_or_uuid",
        return_value=None,
    ):
        mapped = (
            map_interactive_pivot_config(config)
            if isinstance(config, InteractivePivotChartConfig)
            else map_config_to_form_data(config)
        )
    existing = {"viz_type": mapped["viz_type"], existing_key: existing_value}
    merged = merge_form_data_for_update(existing, mapped, config)
    if expected is None:
        assert existing_key not in merged
    else:
        assert merged[existing_key] == expected


def test_xy_explicit_false_clears_immediate_preview_and_cached_state() -> None:
    config = XYChartConfig(
        x=ColumnRef(name="order_date"),
        y=[ColumnRef(name="sales", aggregate="SUM")],
        stacked=False,
        show_value=False,
    )
    chart = Mock(
        id=19,
        datasource_id=7,
        datasource_type="table",
        slice_name="Saved XY",
        params=json.dumps(
            {
                "viz_type": "echarts_timeseries_line",
                "x_axis": "old_date",
                "metrics": ["old_metric"],
                "stack": "Stack",
                "show_value": True,
            }
        ),
    )
    request = UpdateChartRequest(identifier=19, config=config)
    with patch(
        "superset.mcp_service.chart.chart_utils.is_column_truly_temporal",
        return_value=True,
    ):
        mapped = map_config_to_form_data(config)
        cached = merge_form_data_for_update(json.loads(chart.params), mapped, config)
        immediate = _build_update_payload(request, chart, parsed_config=config)
        preview = _build_preview_form_data(request, chart, parsed_config=config)
    assert isinstance(immediate, dict)
    assert isinstance(preview, dict)
    for state in (cached, json.loads(immediate["params"]), preview):
        assert "stack" not in state
        assert "show_value" not in state


@pytest.mark.parametrize("viz_type", ["table", "ag-grid-table"])
def test_table_explicit_empty_sort_removes_saved_order_by_cols(
    viz_type: str,
) -> None:
    config = TableChartConfig(
        viz_type=viz_type,
        columns=[ColumnRef(name="region")],
        sort_by=[],
    )
    mapped = map_config_to_form_data(config)
    merged = merge_form_data_for_update(
        {
            "viz_type": viz_type,
            "all_columns": ["old_region"],
            "order_by_cols": ['["old_region", false]'],
        },
        mapped,
        config,
    )
    assert "order_by_cols" not in merged


@pytest.mark.parametrize(
    "config",
    _registered_query_role_matrix(),
    ids=lambda config: (
        f"{config.chart_type}-{getattr(config, 'viz_type', '')}-"
        f"{getattr(config, 'query_mode', '')}-{getattr(config, 'kind', '')}"
    ),
)
def test_registered_same_viz_role_registry_is_complete_across_update_products(
    config: ChartConfig,
) -> None:
    """Every native viz/mode replaces aliases without changing real queries."""
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
        mapped = map_config_to_form_data(config)

    role_keys = get_registry().query_role_keys_for_viz_type(mapped["viz_type"])
    assert role_keys
    list_roles = {
        "all_columns",
        "columns",
        "groupby",
        "groupby_b",
        "groupbyColumns",
        "groupbyRows",
        "metrics",
        "metrics_b",
        "orderby",
        "order_by_cols",
        "percent_metrics",
    }
    stale_roles: dict[str, object] = {
        key: [f"stale_{key}"] if key in list_roles else f"stale_{key}"
        for key in role_keys
    }
    existing = {
        "viz_type": mapped["viz_type"],
        **stale_roles,
        "native_plugin_control": {"enabled": True},
    }
    chart = Mock(
        id=19,
        datasource_id=7,
        datasource_type="table",
        slice_name="Alias adversary",
        params=json.dumps(existing),
    )
    request = UpdateChartRequest(identifier=19, config=config)

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
        cached_overlay = merge_form_data_for_update(existing, mapped, config)
        immediate = _build_update_payload(request, chart, parsed_config=config)
        preview = _build_preview_form_data(request, chart, parsed_config=config)

    assert isinstance(immediate, dict)
    assert isinstance(preview, dict)
    saved = json.loads(immediate["params"])
    for state in (cached_overlay, saved, preview):
        assert state["native_plugin_control"] == {"enabled": True}
        assert {key: state[key] for key in role_keys if key in state} == {
            key: mapped[key] for key in role_keys if key in mapped
        }

        # Both production query rebuilders must be invariant to the adversarial
        # aliases after immediate, saved-preview, or cached overlay updates.
        common_query = build_query_context_from_form_data(
            deepcopy(state),
            {"id": 7, "type": "table"},
            viz_type=mapped["viz_type"],
        )
        mapped_common_query = build_query_context_from_form_data(
            deepcopy(mapped),
            {"id": 7, "type": "table"},
            viz_type=mapped["viz_type"],
        )
        common_queries_without_limits = [
            {key: value for key, value in query.items() if key != "row_limit"}
            for query in common_query["queries"]
        ]
        mapped_queries_without_limits = [
            {key: value for key, value in query.items() if key != "row_limit"}
            for query in mapped_common_query["queries"]
        ]
        assert common_queries_without_limits == mapped_queries_without_limits

        with patch(
            "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
            return_value="base",
        ):
            chart_queries = build_query_dicts_from_form_data(
                deepcopy(state),
                datasource_id=7,
                datasource_type="table",
            )
            mapped_chart_queries = build_query_dicts_from_form_data(
                deepcopy(mapped),
                datasource_id=7,
                datasource_type="table",
            )
        chart_queries_without_limits = [
            {key: value for key, value in query.items() if key != "row_limit"}
            for query in chart_queries
        ]
        mapped_chart_queries_without_limits = [
            {key: value for key, value in query.items() if key != "row_limit"}
            for query in mapped_chart_queries
        ]
        assert chart_queries_without_limits == mapped_chart_queries_without_limits

    # The generated matrix must cover every native viz alias in the registry.
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
        covered_viz_types = {
            map_config_to_form_data(matrix_config)["viz_type"]
            for matrix_config in _registered_query_role_matrix()
        }
    enabled_viz_types: set[str] = set()
    for chart_type in get_registry().all_types():
        plugin = get_registry().get(chart_type)
        assert plugin is not None
        enabled_viz_types.update(plugin.native_viz_types)
    assert covered_viz_types == enabled_viz_types


@pytest.mark.parametrize(
    "config",
    _registered_query_role_matrix(),
    ids=lambda config: f"{config.chart_type}-fields-set",
)
def test_registered_normalizers_preserve_explicit_field_sets(
    config: ChartConfig,
) -> None:
    """Canonical column casing must not materialize omitted control defaults."""
    context = DatasetContext(
        id=7,
        table_name="sales",
        schema="analytics",
        database_name="main",
        available_columns=[
            {"name": name, "type": "DOUBLE", "is_temporal": name == "order_date"}
            for name in ("region", "country", "sales", "profit", "order_date")
        ],
    )
    plugin = get_registry().get(config.chart_type)
    assert plugin is not None
    normalized = plugin.normalize_column_refs(config, context)
    assert normalized.model_fields_set == config.model_fields_set


def test_generate_request_accepts_native_viz_type_alias() -> None:
    request = GenerateChartRequest.model_validate(
        {
            "dataset_id": 7,
            "config": {
                "viz_type": "sunburst_v2",
                "columns": ["region", "country"],
                "metric": "count",
            },
        }
    )
    assert isinstance(request.config, SunburstChartConfig)
    assert [column.name for column in request.config.hierarchy] == [
        "region",
        "country",
    ]
    assert request.config.metric.saved_metric is True


def test_native_simple_sql_and_saved_metrics_round_trip() -> None:
    config = SunburstChartConfig.model_validate(
        {
            "chart_type": "sunburst",
            "viz_type": "sunburst_v2",
            "columns": ["region", "country"],
            "metric": {
                "expressionType": "SIMPLE",
                "column": {"column_name": "sales", "type": "DOUBLE"},
                "aggregate": "SUM",
                "hasCustomLabel": True,
                "label": "Sales",
            },
            "secondary_metric": {
                "expressionType": "SQL",
                "sqlExpression": "SUM(profit)",
                "hasCustomLabel": True,
                "label": "Profit",
            },
            "adhoc_filters": [
                {
                    "expressionType": "SIMPLE",
                    "clause": "WHERE",
                    "subject": "status",
                    "operator": "==",
                    "comparator": "active",
                }
            ],
        }
    )
    assert config.metric.name == "sales"
    assert config.metric.aggregate == "SUM"
    assert config.secondary_metric is not None
    assert config.secondary_metric.sql_expression == "SUM(profit)"
    assert config.filters is not None
    assert config.filters[0].op == "="

    round_trip = map_config_to_form_data(config)
    assert round_trip["viz_type"] == "sunburst_v2"
    assert round_trip["columns"] == ["region", "country"]
    assert round_trip["metric"]["expressionType"] == "SIMPLE"
    assert round_trip["secondary_metric"]["expressionType"] == "SQL"


def test_native_saved_form_data_preserves_bounded_ui_state_on_round_trip() -> None:
    config = SunburstChartConfig.model_validate(
        {
            "viz_type": "sunburst_v2",
            "columns": ["region", "country"],
            "groupby": [],
            "metric": "count",
            "since": "2025-01-01",
            "until": "2025-02-01",
            "annotation_layers": [],
            "compare_lag": "10",
            "compare_suffix": "over prior period",
            "standardizedFormData": {
                "controls": {"metrics": ["count"], "columns": ["region"]},
                "memorizedFormData": [["pie", {"viz_type": "pie"}]],
            },
        }
    )

    assert config.metric.saved_metric is True
    assert config.time_range == "2025-01-01 : 2025-02-01"
    round_trip = map_config_to_form_data(config)
    assert round_trip["columns"] == ["region", "country"]
    assert round_trip["metric"] == "count"
    assert round_trip["since"] == "2025-01-01"
    assert round_trip["until"] == "2025-02-01"
    assert round_trip["annotation_layers"] == []
    assert round_trip["compare_lag"] == "10"
    assert round_trip["standardizedFormData"]["memorizedFormData"] == [
        ["pie", {"viz_type": "pie"}]
    ]


def _native_request_payload(
    request_model: type[
        GenerateChartRequest
        | GenerateExploreLinkRequest
        | UpdateChartRequest
        | UpdateChartPreviewRequest
    ],
    metric: object,
    secondary_metric: object | None,
) -> dict[str, object]:
    config: dict[str, object] = {
        "viz_type": "sunburst_v2",
        "columns": ["region", "country"],
        "metric": metric,
        "secondary_metric": secondary_metric,
        "since": "2025-01-01",
        "until": "2025-02-01",
        "annotation_layers": [{"name": "release", "annotationType": "FORMULA"}],
        "dashboardId": 12,
        "extra_form_data": {"time_range": "Last year"},
        "time_compare": ["1 year ago"],
        "standardizedFormData": {
            "controls": {"metrics": [metric], "columns": ["region", "country"]},
            "memorizedFormData": [["table", {"viz_type": "table"}]],
        },
    }
    if request_model in (GenerateChartRequest, GenerateExploreLinkRequest):
        return {"dataset_id": 7, "config": config}
    if request_model is UpdateChartRequest:
        return {"identifier": 19, "config": config}
    return {"dataset_id": 7, "form_data_key": "native-key", "config": config}


@pytest.mark.parametrize(
    "request_model",
    [
        GenerateChartRequest,
        GenerateExploreLinkRequest,
        UpdateChartRequest,
        UpdateChartPreviewRequest,
    ],
)
@pytest.mark.parametrize(
    "metric,secondary_metric,expected_metric,expected_secondary",
    [
        ("SavedSales", None, "SavedSales", None),
        (
            {
                "expressionType": "SIMPLE",
                "column": {"column_name": "sales", "type": "DOUBLE"},
                "aggregate": "SUM",
                "hasCustomLabel": True,
                "label": "Sales",
            },
            "SavedProfit",
            "SIMPLE",
            "SavedProfit",
        ),
        (
            {
                "expressionType": "SQL",
                "sqlExpression": "SUM(sales)",
                "hasCustomLabel": False,
                "label": "SUM(sales)",
            },
            {
                "expressionType": "SQL",
                "sqlExpression": "SUM(profit)",
                "hasCustomLabel": True,
                "label": "Profit",
            },
            "SQL",
            "SQL",
        ),
    ],
)
def test_real_native_request_schema_round_trip(
    request_model: type[
        GenerateChartRequest
        | GenerateExploreLinkRequest
        | UpdateChartRequest
        | UpdateChartPreviewRequest
    ],
    metric: object,
    secondary_metric: object | None,
    expected_metric: str,
    expected_secondary: str | None,
) -> None:
    request = request_model.model_validate(
        _native_request_payload(request_model, metric, secondary_metric)
    )
    assert isinstance(request.config, SunburstChartConfig)

    form_data = map_config_to_form_data(request.config)
    mapped_metric = form_data["metric"]
    assert (
        mapped_metric
        if isinstance(mapped_metric, str)
        else mapped_metric["expressionType"]
    ) == expected_metric
    mapped_secondary = form_data.get("secondary_metric")
    assert (
        mapped_secondary
        if isinstance(mapped_secondary, str) or mapped_secondary is None
        else mapped_secondary["expressionType"]
    ) == expected_secondary
    assert form_data["since"] == "2025-01-01"
    assert form_data["until"] == "2025-02-01"
    assert form_data["annotation_layers"][0]["name"] == "release"
    assert form_data["dashboardId"] == 12
    assert form_data["time_compare"] == ["1 year ago"]
    assert form_data["standardizedFormData"]["memorizedFormData"][0][0] == "table"

    round_trip_payload = _native_request_payload(request_model, "SavedSales", None)
    round_trip_payload["config"] = form_data
    reparsed = request_model.model_validate(round_trip_payload)
    reparsed_form_data = map_config_to_form_data(reparsed.config)
    for key in (
        "viz_type",
        "columns",
        "metric",
        "secondary_metric",
        "since",
        "until",
        "annotation_layers",
        "dashboardId",
        "extra_form_data",
        "time_compare",
        "standardizedFormData",
    ):
        assert reparsed_form_data.get(key) == form_data.get(key)


@pytest.mark.parametrize(
    "request_model",
    [
        GenerateChartRequest,
        GenerateExploreLinkRequest,
        UpdateChartRequest,
        UpdateChartPreviewRequest,
    ],
)
def test_public_native_requests_accept_complete_frontend_column_meta(
    request_model: type[
        GenerateChartRequest
        | GenerateExploreLinkRequest
        | UpdateChartRequest
        | UpdateChartPreviewRequest
    ],
) -> None:
    """ColumnMeta is open-ended, but only its owned projection is retained."""
    payload = _native_request_payload(request_model, _frontend_native_metric(), None)
    request = request_model.model_validate(payload)
    assert isinstance(request.config, SunburstChartConfig)
    assert request.config.metric.name == "sales"
    assert request.config.metric.dtype == "DOUBLE"

    form_data = map_config_to_form_data(request.config)
    assert form_data["metric"]["column"] == {"column_name": "sales"}
    assert "forward_compatible" not in form_data["metric"]["column"]

    config = payload["config"]
    assert isinstance(config, dict)
    config["metric"] = form_data["metric"]
    reparsed = request_model.model_validate(payload)
    assert isinstance(reparsed.config, SunburstChartConfig)
    assert map_config_to_form_data(reparsed.config)["metric"] == form_data["metric"]


@pytest.mark.parametrize(
    "column,expected_name,expected_type",
    [
        ("sales", "sales", None),
        ({"column_name": "sales"}, "sales", None),
        ({"columnName": "sales", "type": "DOUBLE"}, "sales", "DOUBLE"),
        (
            {"column_name": "sales", "future_column_nmae": "ignored"},
            "sales",
            None,
        ),
    ],
)
def test_native_simple_metric_reduced_column_shapes_remain_supported(
    column: object, expected_name: str, expected_type: str | None
) -> None:
    metric = _frontend_native_metric()
    metric["column"] = column
    request = GenerateChartRequest.model_validate(
        _native_request_payload(GenerateChartRequest, metric, None)
    )
    assert isinstance(request.config, SunburstChartConfig)
    assert request.config.metric.name == expected_name
    assert request.config.metric.dtype == expected_type


@pytest.mark.parametrize(
    "column,error",
    [
        ({}, "column_name"),
        ({"column_nmae": "sales"}, "column_name"),
        ({"column_name": ""}, "column_name"),
        ({"column_name": 7}, "column_name"),
        ({"column_name": "x" * 256}, "column_name"),
        ({"column_name": "sales", "type": 7}, "type"),
        ({"column_name": "sales", "type": "x" * 256}, "type"),
        ({"column_name": "sales", "future": float("nan")}, "finite"),
        (
            {"column_name": "sales", "future": [None] * 129},
            "array is too large",
        ),
        (
            {
                "column_name": "sales",
                **{f"future_{index}": None for index in range(128)},
            },
            "object is too large",
        ),
        (
            {"column_name": "sales", "future": "x" * (16 * 1024 + 1)},
            "string is too long",
        ),
        (
            {"column_name": "sales", "x" * 1_025: True},
            "key is too long",
        ),
    ],
)
def test_native_column_meta_rejects_invalid_owned_and_bounded_values(
    column: dict[object, object], error: str
) -> None:
    metric = _frontend_native_metric()
    metric["column"] = column
    with pytest.raises(ValidationError, match=error):
        GenerateChartRequest.model_validate(
            _native_request_payload(GenerateChartRequest, metric, None)
        )


def test_native_column_meta_bounds_depth_total_values_and_integer_size() -> None:
    deeply_nested: object = None
    for _ in range(9):
        deeply_nested = {"nested": deeply_nested}

    for future_value in (
        deeply_nested,
        [[0, 1, 2, 3] for _ in range(128)],
        1 << 64,
    ):
        metric = _frontend_native_metric()
        metric["column"] = {
            "column_name": "sales",
            "future": future_value,
        }
        with pytest.raises(ValidationError):
            GenerateChartRequest.model_validate(
                _native_request_payload(GenerateChartRequest, metric, None)
            )


def test_native_column_meta_accepts_exact_key_and_string_boundaries() -> None:
    metric = _frontend_native_metric()
    metric["column"] = {
        "column_name": "sales",
        "k" * 1_024: "v" * (16 * 1_024),
    }
    request = GenerateChartRequest.model_validate(
        _native_request_payload(GenerateChartRequest, metric, None)
    )
    assert isinstance(request.config, SunburstChartConfig)
    assert request.config.metric.name == "sales"


def test_native_column_meta_rejects_hostile_objects_without_hooks() -> None:  # noqa: C901
    calls: list[str] = []

    class HostileDict(dict[object, object]):
        def __iter__(self) -> Iterator[object]:
            calls.append("iter")
            if calls:
                raise AssertionError
            return iter(())

        def items(self):
            calls.append("items")
            raise AssertionError

        def __repr__(self) -> str:
            calls.append("repr")
            if calls:
                raise AssertionError
            return ""

        def __str__(self) -> str:
            calls.append("str")
            if calls:
                raise AssertionError
            return ""

    class HostileStr(str):
        def __repr__(self) -> str:
            calls.append("repr")
            if calls:
                raise AssertionError
            return ""

        def __str__(self) -> str:
            calls.append("str")
            if calls:
                raise AssertionError
            return ""

        def encode(self, *_args, **_kwargs):
            calls.append("encode")
            raise AssertionError

    class HostileValue:
        def __repr__(self) -> str:
            calls.append("repr")
            if calls:
                raise AssertionError
            return ""

        def __str__(self) -> str:
            calls.append("str")
            if calls:
                raise AssertionError
            return ""

    hostile_columns: list[object] = [
        HostileDict(column_name="sales"),
        {HostileStr("column_name"): "sales"},
        {"column_name": HostileStr("sales")},
        {"column_name": "sales", "future": HostileValue()},
    ]
    for column in hostile_columns:
        metric = _frontend_native_metric()
        metric["column"] = column
        with pytest.raises(ValidationError):
            GenerateChartRequest.model_validate(
                _native_request_payload(GenerateChartRequest, metric, None)
            )
        assert calls == []


def test_native_metric_owned_typo_remains_rejected() -> None:
    metric = _frontend_native_metric()
    metric["aggregat"] = metric.pop("aggregate")
    with pytest.raises(ValidationError, match="aggregat"):
        GenerateChartRequest.model_validate(
            _native_request_payload(GenerateChartRequest, metric, None)
        )


def test_native_metric_wrapper_hostile_objects_are_hook_free() -> None:  # noqa: C901
    calls: list[str] = []

    class HostileStr(str):
        def __hash__(self) -> int:
            calls.append("hash")
            return str.__hash__(self)

        def __eq__(self, _other: object) -> bool:
            calls.append("eq")
            raise AssertionError

        def __str__(self) -> str:
            calls.append("str")
            if calls:
                raise AssertionError
            return ""

        def __repr__(self) -> str:
            calls.append("repr")
            if calls:
                raise AssertionError
            return ""

    class HostileDict(dict[object, object]):
        def __contains__(self, _key: object) -> bool:
            calls.append("contains")
            raise AssertionError

        def __iter__(self) -> Iterator[object]:
            calls.append("iter")
            if calls:
                raise AssertionError
            return iter(())

        def items(self):
            calls.append("items")
            raise AssertionError

        def get(self, _key: object, _default: object = None) -> object:
            calls.append("get")
            raise AssertionError

        def __repr__(self) -> str:
            calls.append("repr")
            if calls:
                raise AssertionError
            return ""

    hostile_key = HostileStr("expressionType")
    key_wrapper = {
        hostile_key: "SIMPLE",
        "column": "sales",
        "aggregate": "SUM",
    }
    calls.clear()
    hostile_value = HostileStr("SIMPLE")
    value_wrapper = {
        "expressionType": hostile_value,
        "column": "sales",
        "aggregate": "SUM",
    }
    wrapper_subclass = HostileDict(
        expressionType="SIMPLE", column="sales", aggregate="SUM"
    )

    for wrapper in (key_wrapper, value_wrapper, wrapper_subclass):
        with pytest.raises(ValidationError):
            GenerateChartRequest.model_validate(
                {
                    "dataset_id": 7,
                    "config": {
                        "viz_type": "sunburst_v2",
                        "columns": ["region"],
                        "annotation_layers": [],
                        "metric": wrapper,
                    },
                }
            )
        assert calls == []


def _assert_validation_error_is_hook_free_and_bounded(
    error: ValidationError, calls: list[str]
) -> None:
    """Exercise every normal Pydantic error-rendering surface."""
    assert calls == []
    rendered = str(error)
    represented = repr(error)
    details = error.errors()
    represented_details = repr(details)
    assert calls == []
    for output in (rendered, represented, represented_details):
        assert len(output.encode()) < 64 * 1024


def test_rejected_native_metric_subtrees_are_sanitized_before_rendering() -> None:
    """All rejected native metric categories have safe retained inputs."""
    request_models = (
        GenerateChartRequest,
        UpdateChartRequest,
        GenerateExploreLinkRequest,
    )
    for request_model in request_models:
        for index in range(16):
            calls: list[str] = []
            description, metric = _hostile_native_metric_cases(calls)[index]
            calls.clear()  # constructing the hostile-key dictionary needs hashing
            payload = _native_request_payload(request_model, metric, None)
            with pytest.raises(ValidationError) as validation_error:
                request_model.model_validate(payload)
            _assert_validation_error_is_hook_free_and_bounded(
                validation_error.value, calls
            )
            assert description


@pytest.mark.parametrize(
    "metric_path",
    ["secondary_metric", "secondaryMetric", "standardized metrics"],
)
def test_all_native_metric_aliases_sanitize_rejected_retained_inputs(
    metric_path: str,
) -> None:
    calls: list[str] = []
    metric = _hostile_native_metric_cases(calls)[0][1]
    calls.clear()
    payload = _native_request_payload(
        GenerateChartRequest, _frontend_native_metric(), None
    )
    config = payload["config"]
    assert isinstance(config, dict)
    if metric_path == "standardized metrics":
        standardized = config["standardizedFormData"]
        assert isinstance(standardized, dict)
        controls = standardized["controls"]
        assert isinstance(controls, dict)
        controls["metrics"] = [metric]
    else:
        config[metric_path] = metric

    with pytest.raises(ValidationError) as validation_error:
        GenerateChartRequest.model_validate(payload)
    _assert_validation_error_is_hook_free_and_bounded(validation_error.value, calls)


def test_direct_native_column_rejection_has_safe_pydantic_input() -> None:
    calls: list[str] = []
    cases = _hostile_native_metric_cases(calls)
    for index in (7, 8, 9, 10, 11):
        calls.clear()
        metric = cases[index][1]
        assert isinstance(metric, dict)
        column = dict.__getitem__(metric, "column")
        with pytest.raises(ValidationError) as validation_error:
            SunburstNativeMetricColumn.model_validate(column)
        _assert_validation_error_is_hook_free_and_bounded(validation_error.value, calls)


@pytest.mark.parametrize(
    "metric",
    [
        {
            "expressionType": "SIMPLE",
            "column": "sales",
            "aggregate": 7,
        },
        {
            "expressionType": "SQL",
            "sqlExpression": ["SUM(sales)"],
            "label": "Sales",
        },
        {
            "expressionType": "SIMPLE",
            "column": {"column_name": "sales", "future": [None] * 129},
            "aggregate": "SUM",
        },
    ],
)
def test_native_metric_json_validation_errors_remain_bounded(
    metric: dict[str, object],
) -> None:
    """JSON-native malformed values retain normal client compatibility."""
    payload = _native_request_payload(GenerateChartRequest, metric, None)
    serialized = json.dumps(payload)
    with pytest.raises(ValidationError) as validation_error:
        GenerateChartRequest.model_validate_json(serialized)
    _assert_validation_error_is_hook_free_and_bounded(validation_error.value, [])


@pytest.mark.parametrize(
    "expression_type",
    [None, True, 1, [], "simple", "SQL_QUERY", ""],
)
def test_native_metric_wrapper_rejects_malformed_expression_type(
    expression_type: object,
) -> None:
    metric = {
        "expressionType": expression_type,
        "column": "sales",
        "aggregate": "SUM",
    }
    with pytest.raises(ValidationError, match="expressionType"):
        GenerateChartRequest.model_validate(
            _native_request_payload(GenerateChartRequest, metric, None)
        )


def test_native_metric_wrapper_requires_expression_type() -> None:
    metric = {"column": "sales", "aggregate": "SUM"}
    with pytest.raises(ValidationError, match="requires expressionType"):
        GenerateChartRequest.model_validate(
            _native_request_payload(GenerateChartRequest, metric, None)
        )


def test_typed_metric_remains_valid_with_native_envelope_fields() -> None:
    request = GenerateChartRequest.model_validate(
        {
            "dataset_id": 7,
            "config": {
                "viz_type": "sunburst_v2",
                "columns": ["region"],
                "annotation_layers": [],
                "metric": {"name": "sales", "aggregate": "SUM"},
            },
        }
    )
    assert isinstance(request.config, SunburstChartConfig)
    assert request.config.metric.name == "sales"
    assert request.config.metric.aggregate == "SUM"


@pytest.mark.parametrize(
    "metric,expected",
    [
        (
            {
                "expressionType": "SIMPLE",
                "column": "sales",
                "aggregate": "SUM",
            },
            ("sales", None),
        ),
        (
            {
                "expressionType": "SQL",
                "sqlExpression": "SUM(sales)",
                "label": "Sales",
            },
            (None, "SUM(sales)"),
        ),
    ],
)
def test_native_metric_wrapper_accepts_explicit_simple_and_sql(
    metric: dict[str, object], expected: tuple[str | None, str | None]
) -> None:
    request = GenerateChartRequest.model_validate(
        _native_request_payload(GenerateChartRequest, metric, None)
    )
    assert isinstance(request.config, SunburstChartConfig)
    assert (
        request.config.metric.name,
        request.config.metric.sql_expression,
    ) == expected


def test_native_column_meta_model_validate_json_handles_dual_aliases() -> None:
    column = _frontend_column_meta()
    column["columnName"] = "sales"
    parsed = SunburstNativeMetricColumn.model_validate_json(json.dumps(column))
    assert parsed.column_name == "sales"
    assert parsed.type == "DOUBLE"

    column["columnName"] = "profit"
    with pytest.raises(ValidationError, match="must match"):
        SunburstNativeMetricColumn.model_validate_json(json.dumps(column))

    column["column_name"] = 7
    with pytest.raises(ValidationError, match="both be exact strings"):
        SunburstNativeMetricColumn.model_validate_json(json.dumps(column))


@pytest.mark.parametrize(
    "request_model",
    [GenerateChartRequest, UpdateChartRequest, GenerateExploreLinkRequest],
)
def test_public_requests_accept_equal_dual_column_aliases_with_full_metadata(
    request_model: type[
        GenerateChartRequest | UpdateChartRequest | GenerateExploreLinkRequest
    ],
) -> None:
    metric = _frontend_native_metric()
    column = metric["column"]
    assert isinstance(column, dict)
    column["columnName"] = "sales"
    request = request_model.model_validate(
        _native_request_payload(request_model, metric, None)
    )
    assert isinstance(request.config, SunburstChartConfig)
    assert request.config.metric.name == "sales"


@pytest.mark.parametrize(
    "request_model",
    [GenerateChartRequest, UpdateChartRequest, GenerateExploreLinkRequest],
)
@pytest.mark.parametrize(
    "snake_name,camel_name,error",
    [
        ("sales", "profit", "must match"),
        (7, "sales", "both be exact strings"),
        ("sales", False, "both be exact strings"),
    ],
)
def test_public_requests_reject_conflicting_or_malformed_dual_column_aliases(
    request_model: type[
        GenerateChartRequest | UpdateChartRequest | GenerateExploreLinkRequest
    ],
    snake_name: object,
    camel_name: object,
    error: str,
) -> None:
    metric = _frontend_native_metric()
    column = metric["column"]
    assert isinstance(column, dict)
    column["column_name"] = snake_name
    column["columnName"] = camel_name
    with pytest.raises(ValidationError, match=error):
        request_model.model_validate(
            _native_request_payload(request_model, metric, None)
        )


@pytest.mark.parametrize(
    "request_model",
    [GenerateChartRequest, UpdateChartRequest, UpdateChartPreviewRequest],
)
def test_native_requests_omit_explicit_null_mapping_envelopes(request_model) -> None:
    """Validated null mapping fields never reach persisted or cached form data."""
    payload = _native_request_payload(request_model, "SavedSales", None)
    config_payload = payload["config"]
    assert isinstance(config_payload, dict)
    config_payload.update(
        {
            "extra_form_data": None,
            "url_params": None,
            "standardizedFormData": None,
        }
    )

    request = request_model.model_validate(payload)
    form_data = map_config_to_form_data(request.config)

    assert {
        "extra_form_data",
        "url_params",
        "standardizedFormData",
    }.isdisjoint(form_data)


@pytest.mark.parametrize("source_viz", ["sunburst_v2", "pie"])
def test_explicit_null_extra_form_data_deletes_same_and_cross_viz_state(
    source_viz: str,
) -> None:
    config = _config(extra_form_data=None)
    existing = {
        "viz_type": source_viz,
        "extra_form_data": {"filters": [{"col": "region", "op": "IN"}]},
    }

    merged = merge_form_data_for_update(
        existing, map_config_to_form_data(config), config
    )

    assert "extra_form_data" not in merged
    canonical = canonicalize_operation_form_data(
        {**merged, "extra_form_data": None}, datasource_id=7
    )
    assert "extra_form_data" not in canonical


def test_compile_and_preview_pass_only_mapping_envelopes() -> None:
    """Null native envelope values are omitted before query preparation."""
    form_data = {
        "viz_type": "table",
        "query_mode": "raw",
        "all_columns": ["region"],
        "datasource": "7__table",
        "extra_form_data": None,
        "url_params": None,
        "standardizedFormData": None,
    }
    compiled: list[dict[str, object]] = []
    previewed: list[dict[str, object]] = []
    command = MagicMock()
    command.run.return_value = {"queries": [{"data": [{"region": "North"}]}]}

    def capture_compile(query_form_data, **_kwargs):
        compiled.append(deepcopy(query_form_data))
        return object()

    with (
        patch(
            "superset.mcp_service.chart.chart_helpers."
            "build_query_context_from_form_data",
            side_effect=capture_compile,
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand",
            return_value=command,
        ),
    ):
        result = _compile_chart(form_data, 7)
    assert result.success is True

    def capture_preview(query_form_data, **_kwargs):
        previewed.append(deepcopy(query_form_data))
        return object()

    with (
        patch("superset.extensions.db.session.get", return_value=Mock(id=7)),
        patch(
            "superset.mcp_service.chart.chart_helpers."
            "build_query_context_from_form_data",
            side_effect=capture_preview,
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand",
            return_value=command,
        ),
    ):
        preview = generate_preview_from_form_data(form_data, 7, "table")
    assert not isinstance(preview, ChartError)

    for prepared in (*compiled, *previewed):
        assert {
            "extra_form_data",
            "url_params",
            "standardizedFormData",
        }.isdisjoint(prepared)


@pytest.mark.parametrize(
    "request_model",
    [GenerateChartRequest, UpdateChartRequest, UpdateChartPreviewRequest],
)
def test_repository_rural_breakdown_fixture_round_trips_through_requests(
    request_model: type[
        GenerateChartRequest | UpdateChartRequest | UpdateChartPreviewRequest
    ],
) -> None:
    params = _rural_breakdown_params()
    if request_model is GenerateChartRequest:
        payload: dict[str, object] = {"dataset_id": 7, "config": params}
    elif request_model is UpdateChartRequest:
        payload = {"identifier": 19, "config": params}
    else:
        payload = {
            "dataset_id": 7,
            "form_data_key": "rural-breakdown",
            "config": params,
        }

    request = request_model.model_validate(payload)
    assert isinstance(request.config, SunburstChartConfig)
    assert [column.name for column in request.config.hierarchy] == [
        "region",
        "country_name",
    ]
    assert request.config.metric.name == "sum__SP_POP_TOTL"
    assert request.config.metric.saved_metric is True
    assert request.config.secondary_metric is not None
    assert request.config.secondary_metric.name == "SP_RUR_TOTL"

    form_data = map_config_to_form_data(request.config)
    assert form_data["columns"] == ["region", "country_name"]
    assert form_data["metric"] == "sum__SP_POP_TOTL"
    assert form_data["secondary_metric"]["column"] == {"column_name": "SP_RUR_TOTL"}
    assert form_data["row_limit"] == 50000
    assert form_data["time_range"] == "2014-01-01 : 2014-01-02"
    assert _SUNBURST_LEGACY_FIXTURE_KEYS.isdisjoint(form_data)

    second_payload = dict(payload)
    second_payload["config"] = form_data
    reparsed = request_model.model_validate(second_payload)
    assert isinstance(reparsed.config, SunburstChartConfig)
    assert map_config_to_form_data(reparsed.config) == form_data


_SUNBURST_LEGACY_FIXTURE_KEYS = {
    "country_fieldtype",
    "entity",
    "granularity",
    "limit",
    "markup_type",
    "show_bubbles",
}


@pytest.mark.parametrize(
    "mutation,error",
    [
        (lambda params: params.__setitem__("show_bubbles", "true"), "show_bubbles"),
        (
            lambda params: params["secondary_metric"]["column"].update(
                {"column_nmae": params["secondary_metric"]["column"].pop("column_name")}
            ),
            "column_name",
        ),
        (lambda params: params.__setitem__("show_buble", True), "show_buble"),
    ],
)
def test_repository_rural_breakdown_fixture_rejects_bad_native_state(
    mutation: object, error: str
) -> None:
    params = deepcopy(_rural_breakdown_params())
    assert callable(mutation)
    mutation(params)
    with pytest.raises(ValidationError, match=error):
        GenerateChartRequest.model_validate({"dataset_id": 7, "config": params})


def test_native_simple_where_filter_clause_round_trips_without_coercion() -> None:
    payload = _native_request_payload(GenerateChartRequest, "SavedSales", None)
    config = payload["config"]
    assert isinstance(config, dict)
    config["adhoc_filters"] = [
        {
            "expressionType": "SIMPLE",
            "clause": "WHERE",
            "subject": "status",
            "operator": "==",
            "comparator": "active",
        }
    ]
    request = GenerateChartRequest.model_validate(payload)
    assert isinstance(request.config, SunburstChartConfig)
    assert request.config.filters is not None
    assert request.config.filters[0].clause == "WHERE"
    assert (
        map_config_to_form_data(request.config)["adhoc_filters"][0]["clause"] == "WHERE"
    )


@pytest.mark.parametrize("clause", ["HAVING", "where", "GROUP", "", None, 7])
def test_native_simple_filter_rejects_malformed_clause(clause: object) -> None:
    payload = _native_request_payload(GenerateChartRequest, "SavedSales", None)
    config = payload["config"]
    assert isinstance(config, dict)
    config["adhoc_filters"] = [
        {
            "expressionType": "SIMPLE",
            "clause": clause,
            "subject": "status",
            "operator": "==",
            "comparator": "active",
        }
    ]
    with pytest.raises(ValidationError, match="clause"):
        GenerateChartRequest.model_validate(payload)


def test_saved_simple_having_is_rejected_by_both_sunburst_query_builders() -> None:
    form_data = map_config_to_form_data(_config())
    form_data["adhoc_filters"] = [
        {
            "expressionType": "SIMPLE",
            "clause": "HAVING",
            "subject": "Sales",
            "operator": ">",
            "comparator": 10,
        }
    ]
    with pytest.raises(ValueError, match="SIMPLE HAVING filters are unsupported"):
        build_query_context_from_form_data(
            form_data,
            {"id": 7, "type": "table"},
            viz_type="sunburst_v2",
        )
    with (
        patch(
            "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
            return_value="base",
        ),
        pytest.raises(ValueError, match="SIMPLE HAVING filters are unsupported"),
    ):
        build_query_dicts_from_form_data(
            form_data,
            datasource_id=7,
            datasource_type="table",
        )


@pytest.mark.parametrize(
    "request_model",
    [GenerateChartRequest, UpdateChartRequest, UpdateChartPreviewRequest],
)
@pytest.mark.parametrize(
    "bad_key,bad_value,error",
    [
        ("show_lables", True, "Unknown field 'show_lables'"),
        ("annotation_layers", [["not-an-object"]], "annotation_layers"),
        ("adhoc_filters", ["not-an-object"], "adhoc_filter must be an object"),
        (
            "standardizedFormData",
            {"controls": {"metrics": "bad", "columns": []}},
            "metrics",
        ),
    ],
)
def test_native_requests_reject_unknown_and_malformed_nested_state(
    request_model: type[
        GenerateChartRequest | UpdateChartRequest | UpdateChartPreviewRequest
    ],
    bad_key: str,
    bad_value: object,
    error: str,
) -> None:
    payload = _native_request_payload(request_model, "SavedSales", None)
    config = payload["config"]
    assert isinstance(config, dict)
    config[bad_key] = bad_value
    with pytest.raises(ValidationError, match=error):
        request_model.model_validate(payload)


def test_native_noncustom_sql_metric_uses_effective_frontend_label() -> None:
    request = GenerateChartRequest.model_validate(
        _native_request_payload(
            GenerateChartRequest,
            {
                "expressionType": "SQL",
                "sqlExpression": "SUM(sales)",
                "hasCustomLabel": False,
                "label": "",
            },
            None,
        )
    )
    assert request.config.metric.label == "SUM(sales)"
    form_data = map_config_to_form_data(request.config)
    assert form_data["metric"]["label"] == "SUM(sales)"
    assert form_data["metric"]["hasCustomLabel"] is False


def test_typed_input_still_rejects_unknown_fields() -> None:
    with pytest.raises(ValidationError, match="Unknown field 'show_lables'"):
        _config(show_lables=True)


@pytest.mark.parametrize(
    "overrides, message",
    [
        ({"hierarchy": [{"name": "Region"}, {"name": "region"}]}, "unique"),
        ({"metric": {"name": "sales"}}, "must define aggregate"),
        (
            {
                "secondary_metric": {
                    "name": "profit",
                    "aggregate": "SUM",
                    "label": "Sales",
                }
            },
            "Duplicate Sunburst query output label",
        ),
    ],
)
def test_role_and_output_constraints(
    overrides: dict[str, object], message: str
) -> None:
    with pytest.raises(ValidationError, match=message):
        _config(**overrides)


@pytest.mark.parametrize(
    "metric",
    [
        {"name": "sales", "aggregate": "SUM", "label": "Sales"},
        {"name": "SavedSales", "saved_metric": True, "label": "Sales"},
        {"sql_expression": "SUM(sales)", "label": "Sales"},
    ],
    ids=["simple", "saved", "sql"],
)
def test_same_primary_and_secondary_metric_selects_categorical_fallback(
    metric: dict[str, object],
) -> None:
    """The native control permits selecting the primary metric twice."""
    config = _config(metric=metric, secondary_metric=metric)
    form_data = map_config_to_form_data(config)

    assert form_data["metric"] == form_data["secondary_metric"]
    roles, error = resolve_sunburst_result_roles(form_data)

    assert error is None
    assert roles is not None
    assert roles.secondary_metric is None
    assert (
        validate_sunburst_result_data(
            [
                {
                    "region": "West",
                    "country": "US",
                    roles.primary_metric: Decimal("1.5"),
                }
            ],
            form_data,
        )[1]
        is None
    )


@pytest.mark.parametrize(
    "request_model",
    [GenerateChartRequest, UpdateChartRequest, GenerateExploreLinkRequest],
)
def test_same_metric_is_accepted_at_public_request_boundaries(
    request_model: type[
        GenerateChartRequest | UpdateChartRequest | GenerateExploreLinkRequest
    ],
) -> None:
    metric = {
        "expressionType": "SIMPLE",
        "column": {"column_name": "sales"},
        "aggregate": "SUM",
        "label": "SUM(sales)",
    }
    payload = _native_request_payload(request_model, metric, metric)

    request = request_model.model_validate(payload)
    form_data = map_config_to_form_data(request.config)

    assert form_data["metric"] == form_data["secondary_metric"]


def test_sunburst_semantics_describe_hierarchy_metric_and_ellipsis() -> None:
    concise = analyze_chart_semantics("sunburst_v2", _config())
    config = _config(
        hierarchy=[
            {"name": "continent"},
            {"name": "country"},
            {"name": "state"},
            {"name": "city"},
        ]
    )

    semantics = analyze_chart_semantics("sunburst_v2", config)

    assert concise.data_story == (
        "This sunburst_v2 chart analyzes region, country, sales"
    )
    assert "hierarchical part-to-whole" in semantics.primary_insight
    assert semantics.data_story == (
        "This sunburst_v2 chart analyzes continent, country, state..."
    )


def test_mapper_covers_query_time_filter_limit_and_presentation_contract() -> None:
    config = _config(
        secondary_metric={"name": "profit", "aggregate": "SUM"},
        filters=[{"column": "status", "op": "=", "value": "active"}],
        temporal_column="order_date",
        time_range="Last year",
        time_grain="P1M",
        row_limit=321,
        sort_by_metric=False,
        color_scheme="supersetColors",
        linear_color_scheme="superset_seq_1",
        show_labels=True,
        show_labels_threshold=2.5,
        show_total=True,
        show_null_values=False,
        label_type="key_value",
        number_format="$,.2f",
        date_format="%Y-%m",
        currency_format={"symbol": "USD", "symbol_position": "prefix"},
    )

    form_data = map_config_to_form_data(config, dataset_id=None)
    assert form_data["viz_type"] == "sunburst_v2"
    assert form_data["columns"] == ["region", "country"]
    assert form_data["metric"]["column"] == {"column_name": "sales"}
    assert form_data["metric"]["label"] == "Sales"
    assert form_data["secondary_metric"]["column"] == {"column_name": "profit"}
    assert form_data["secondary_metric"]["label"] == "SUM(profit)"
    assert form_data["sort_by_metric"] is False
    assert form_data["row_limit"] == 321
    assert form_data["show_labels"] is True
    assert form_data["show_labels_threshold"] == 2.5
    assert form_data["show_total"] is True
    assert form_data["show_null_values"] is False
    assert form_data["label_type"] == "key_value"
    assert form_data["number_format"] == "$,.2f"
    assert form_data["date_format"] == "%Y-%m"
    assert form_data["color_scheme"] == "supersetColors"
    assert form_data["linear_color_scheme"] == "superset_seq_1"
    assert form_data["time_range"] == "Last year"
    assert form_data["time_grain_sqla"] == "P1M"
    assert form_data["granularity_sqla"] == "order_date"
    assert form_data["currency_format"] == {
        "symbol": "USD",
        "symbolPosition": "prefix",
    }
    assert form_data["adhoc_filters"][0] == {
        "clause": "WHERE",
        "expressionType": "SIMPLE",
        "subject": "status",
        "operator": "==",
        "comparator": "active",
    }
    assert form_data["adhoc_filters"][1]["subject"] == "order_date"
    assert form_data["adhoc_filters"][1]["operator"] == "TEMPORAL_RANGE"


def test_shared_query_builder_mirrors_frontend_build_query() -> None:
    form_data = map_config_to_form_data(
        _config(
            secondary_metric={"name": "profit", "aggregate": "SUM"},
            temporal_column="order_date",
            time_range="Last year",
            time_grain="P1M",
            row_limit=25,
            sort_by_metric=True,
        )
    )
    query = build_query_context_from_form_data(
        form_data,
        {"id": 7, "type": "table"},
        viz_type="sunburst_v2",
    )["queries"][0]

    assert query["columns"] == ["region", "country"]
    assert query["metrics"] == [
        form_data["metric"],
        form_data["secondary_metric"],
    ]
    assert query["orderby"] == [[form_data["metric"], False]]
    assert query["granularity"] == "order_date"
    assert query["extras"]["time_grain_sqla"] == "P1M"
    assert query["time_range"] == "Last year"
    assert query["row_limit"] == 25


def test_get_chart_data_fallback_query_keeps_hierarchy_metrics_and_order() -> None:
    form_data = map_config_to_form_data(
        _config(
            secondary_metric={"name": "profit", "aggregate": "SUM"},
            sort_by_metric=True,
        )
    )
    with patch(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        return_value="base",
    ):
        query = build_query_dicts_from_form_data(
            form_data,
            datasource_id=7,
            datasource_type="table",
        )[0]

    assert query["columns"] == ["region", "country"]
    assert query["metrics"] == [
        form_data["metric"],
        form_data["secondary_metric"],
    ]
    assert query["orderby"] == [[form_data["metric"], False]]


@pytest.mark.parametrize("sort_by_metric", [False, True])
def test_query_builders_have_matching_sunburst_ordering(
    sort_by_metric: bool,
) -> None:
    form_data = map_config_to_form_data(
        _config(sort_by_metric=sort_by_metric, row_limit=17)
    )
    common_query = build_query_context_from_form_data(
        form_data,
        {"id": 7, "type": "table"},
        viz_type="sunburst_v2",
    )["queries"][0]
    with patch(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        return_value="base",
    ):
        chart_query = build_query_dicts_from_form_data(
            form_data,
            datasource_id=7,
            datasource_type="table",
        )[0]

    expected = [[form_data["metric"], False]] if sort_by_metric else []
    assert common_query["orderby"] == expected
    assert chart_query.get("orderby", []) == expected
    assert common_query["row_limit"] == chart_query["row_limit"] == 17


@pytest.mark.parametrize(
    "source_form_data",
    [
        {
            "viz_type": "pie",
            "groupby": ["old_pie_dimension"],
            "metric": "old_pie_metric",
        },
        {
            "viz_type": "echarts_timeseries_line",
            "x_axis": "old_x",
            "groupby": ["old_series"],
            "metrics": ["old_xy_metric"],
            "series": "old_series_role",
            "groupby_b": ["old_secondary_group"],
            "metrics_b": ["old_secondary_metric"],
        },
        {
            "viz_type": "table",
            "query_mode": "raw",
            "all_columns": ["old_raw_column"],
            "columns": ["old_table_column"],
            "metrics": ["old_table_metric"],
        },
    ],
    ids=["pie", "xy", "table"],
)
def test_cross_viz_preview_and_compile_start_from_mapped_sunburst_roles(
    source_form_data: dict[str, object],
) -> None:
    source_form_data = {
        **source_form_data,
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "expressionType": "SIMPLE",
                "subject": "status",
                "operator": "==",
                "comparator": "active",
            }
        ],
        "annotation_layers": [{"source": "source-plugin-query-state"}],
        "color_scheme": "savedScheme",
        "extra_form_data": {"dashboard_filter": True},
        "time_range": "Last year",
        "plugin_only_ui_state": {"must_not_cross": True},
    }
    chart = Mock(
        id=19,
        datasource_id=0,
        slice_name="Source chart",
        params=json.dumps(source_form_data),
    )
    config = _config(
        secondary_metric={"name": "profit", "aggregate": "SUM"},
        sort_by_metric=True,
    )
    request = UpdateChartRequest(identifier=19, config=config)

    preview = _build_preview_form_data(request, chart, parsed_config=config)
    payload = _build_update_payload(request, chart, parsed_config=config)
    assert isinstance(preview, dict)
    assert isinstance(payload, dict)
    saved = json.loads(payload["params"])

    stale_query_keys = {
        "all_columns",
        "groupby",
        "groupby_b",
        "metrics",
        "metrics_b",
        "query_mode",
        "series",
        "x_axis",
    }
    for state in (preview, saved):
        assert state["viz_type"] == "sunburst_v2"
        assert state["columns"] == ["region", "country"]
        assert state["metric"]["column"] == {"column_name": "sales"}
        assert state["secondary_metric"]["column"] == {"column_name": "profit"}
        assert stale_query_keys.isdisjoint(state)
        assert "plugin_only_ui_state" not in state
        assert "annotation_layers" not in state
        assert state["adhoc_filters"][0]["subject"] == "status"
        assert state["color_scheme"] == "savedScheme"
        assert state["extra_form_data"] == {"dashboard_filter": True}
        assert state["time_range"] == "Last year"

    # Exercise the real shared query builder, then the real compile product
    # through QueryContextFactory's boundary. Only database execution/factory
    # construction are isolated; no transition or query-building helper is mocked.
    query = build_query_context_from_form_data(
        preview,
        {"id": 7, "type": "table"},
        viz_type="sunburst_v2",
    )["queries"][0]
    assert query["columns"] == ["region", "country"]
    assert query["metrics"] == [preview["metric"], preview["secondary_metric"]]

    factory = MagicMock()
    factory.create.return_value = object()
    command = MagicMock()
    command.run.return_value = {"queries": [{"data": []}]}
    with (
        patch(
            "superset.common.query_context_factory.QueryContextFactory",
            return_value=factory,
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand",
            return_value=command,
        ),
    ):
        result = _compile_chart(preview, 7)
    assert result.success is True
    compiled_query = factory.create.call_args.kwargs["queries"][0]
    assert compiled_query["columns"] == ["region", "country"]
    assert compiled_query["metrics"] == [
        preview["metric"],
        preview["secondary_metric"],
    ]


def test_compile_path_uses_chart_faithful_query() -> None:
    form_data = map_config_to_form_data(
        _config(
            secondary_metric={"name": "profit", "aggregate": "SUM"},
            sort_by_metric=True,
        )
    )
    factory = MagicMock()
    factory.create.return_value = object()
    command = MagicMock()
    command.run.return_value = {"queries": [{"data": []}]}

    with (
        patch(
            "superset.common.query_context_factory.QueryContextFactory",
            return_value=factory,
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand",
            return_value=command,
        ),
    ):
        result = _compile_chart(form_data, 7)

    assert result.success is True
    query = factory.create.call_args.kwargs["queries"][0]
    assert query["columns"] == ["region", "country"]
    assert query["metrics"] == [
        form_data["metric"],
        form_data["secondary_metric"],
    ]
    assert query["orderby"] == [[form_data["metric"], False]]
    assert query["row_limit"] == 2


@pytest.mark.parametrize(
    "metric, result_label",
    [
        (
            {"name": "sales", "aggregate": "SUM", "label": "Simple Sales"},
            "Simple Sales",
        ),
        ({"name": "SavedSales", "saved_metric": True}, "SavedSales"),
        ({"sql_expression": "SUM(sales)", "label": "SQL Sales"}, "SQL Sales"),
    ],
)
def test_compile_proves_numeric_metric_by_resolved_alias(
    metric: dict[str, object], result_label: str
) -> None:
    form_data = map_config_to_form_data(_config(metric=metric))
    factory = MagicMock()
    factory.create.return_value = object()
    command = MagicMock()
    command.run.return_value = chart_data_command_result(
        [{"region": "A", "country": "B", result_label: Decimal("4.50")}],
        columns=["region", "country", result_label],
        coltypes=[
            GenericDataType.STRING,
            GenericDataType.STRING,
            GenericDataType.NUMERIC,
        ],
    )
    with (
        patch(
            "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
            return_value="base",
        ),
        patch(
            "superset.common.query_context_factory.QueryContextFactory",
            return_value=factory,
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand",
            return_value=command,
        ),
    ):
        result = _compile_chart(form_data, 7)

    assert result.success is True
    assert result.row_count == 1


def test_real_decimal_producer_preserves_sunburst_numeric_provenance() -> None:
    """The full producer envelope keeps exact numerics for Sunburst consumers."""
    value = Decimal("0.10000000000000000000000000000000000001")
    form_data = map_config_to_form_data(_config())
    result = chart_data_command_result(
        [{"region": "A", "country": "B", "Sales": value}],
        columns=["region", "country", "Sales"],
        coltypes=[
            GenericDataType.STRING,
            GenericDataType.STRING,
            GenericDataType.NUMERIC,
        ],
    )

    data, result_error = first_query_data(result)
    roles, sunburst_error = validate_sunburst_result_data(data, form_data)

    assert result_error is None
    assert sunburst_error is None
    assert roles is not None
    assert data is not None
    assert data[0]["Sales"] is value


@pytest.mark.parametrize(
    "value",
    [Decimal("9" * 1024), Decimal("1e4096"), Decimal("1e-4096")],
    ids=["digit-limit", "positive-exponent-limit", "negative-exponent-limit"],
)
def test_compile_accepts_finite_decimal_boundaries(value: Decimal) -> None:
    form_data = map_config_to_form_data(_config())
    command = MagicMock()
    command.run.return_value = chart_data_command_result(
        [{"region": "A", "country": "B", "Sales": value}],
        columns=["region", "country", "Sales"],
        coltypes=[
            GenericDataType.STRING,
            GenericDataType.STRING,
            GenericDataType.NUMERIC,
        ],
    )
    with (
        patch(
            "superset.mcp_service.chart.chart_helpers."
            "build_query_context_from_form_data",
            return_value=object(),
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand",
            return_value=command,
        ),
    ):
        result = _compile_chart(form_data, 7)

    assert result.success is True
    assert result.row_count == 1


@pytest.mark.parametrize(
    "data,expected_error_code",
    [
        ([{"region": "A", "country": "B"}], "INVALID_SUNBURST_RESULT"),
        (
            [{"region": "A", "country": "B", "Sales": "12.50"}],
            "INVALID_SUNBURST_RESULT",
        ),
        (
            [{"region": "A", "country": "B", "Sales": float("nan")}],
            "INVALID_SUNBURST_RESULT",
        ),
        (
            [{"region": "A", "country": "B", "Sales": float("inf")}],
            "CHART_COMPILE_FAILED",
        ),
        (
            [{"region": "A", "country": "B", "Sales": Decimal("NaN")}],
            "CHART_COMPILE_FAILED",
        ),
        (
            [{"region": "A", "country": "B", "Sales": Decimal("Infinity")}],
            "CHART_COMPILE_FAILED",
        ),
        (
            [{"region": "A", "country": "B", "Sales": Decimal("1e4097")}],
            "CHART_COMPILE_FAILED",
        ),
        (
            [{"region": "A", "country": "B", "Sales": Decimal("1e-4097")}],
            "CHART_COMPILE_FAILED",
        ),
        (
            [{"region": "A", "country": "B", "Sales": Decimal("9" * 1025)}],
            "CHART_COMPILE_FAILED",
        ),
    ],
)
def test_compile_rejects_invalid_sunburst_metric_results(
    data: list[dict[str, object]],
    expected_error_code: str,
) -> None:
    form_data = map_config_to_form_data(_config())
    factory = MagicMock()
    factory.create.return_value = object()
    command = MagicMock()
    command.run.return_value = {"queries": [{"data": data}]}
    with (
        patch(
            "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
            return_value="base",
        ),
        patch(
            "superset.common.query_context_factory.QueryContextFactory",
            return_value=factory,
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand",
            return_value=command,
        ),
    ):
        result = _compile_chart(form_data, 7)

    assert result.success is False
    assert result.error_code == expected_error_code


def test_compile_allows_legitimate_empty_sunburst_result() -> None:
    form_data = map_config_to_form_data(_config())
    factory = MagicMock()
    factory.create.return_value = object()
    command = MagicMock()
    command.run.return_value = {"queries": [{"status": "success", "data": []}]}
    with (
        patch(
            "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
            return_value="base",
        ),
        patch(
            "superset.common.query_context_factory.QueryContextFactory",
            return_value=factory,
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand",
            return_value=command,
        ),
    ):
        result = _compile_chart(form_data, 7)

    assert result.success is True
    assert result.row_count == 0


def test_ascii_preview_keeps_hierarchy_and_both_metric_aliases() -> None:
    form_data = map_config_to_form_data(
        _config(secondary_metric={"name": "profit", "aggregate": "SUM"})
    )
    preview = _generate_ascii_preview_from_data(
        [
            {
                "region": "Americas",
                "country": "Brazil",
                "Sales": 120,
                "SUM(profit)": 18,
            }
        ],
        form_data,
    )

    assert "Americas > Brazil" in preview.ascii_content
    assert "Sales=120" in preview.ascii_content
    assert "SUM(profit)=18" in preview.ascii_content


@pytest.mark.parametrize(
    "metric, result_label",
    [
        ({"name": "sales", "aggregate": "SUM", "label": "Sales Alias"}, "Sales Alias"),
        ({"name": "SavedSales", "saved_metric": True}, "SavedSales"),
        ({"sql_expression": "SUM(sales)", "label": "SQL Sales"}, "SQL Sales"),
    ],
)
def test_result_validation_resolves_simple_saved_and_sql_aliases(
    metric: dict[str, object], result_label: str
) -> None:
    form_data = map_config_to_form_data(_config(metric=metric))
    roles, error = validate_sunburst_result_data(
        [{"region": "Americas", "country": "Brazil", result_label: 10.5}],
        form_data,
    )

    assert error is None
    assert roles is not None
    assert roles.primary_metric == result_label


@pytest.mark.parametrize(
    "bad_row, error_text",
    [
        ({"region": "A", "country": "B"}, "missing required"),
        ({"region": "A", "country": "B", "Sales": "12"}, "finite numeric"),
        ({"region": "A", "country": "B", "Sales": float("nan")}, "finite numeric"),
        ({"region": "A", "country": "B", "Sales": float("inf")}, "finite numeric"),
        ({"region": ["A"], "country": "B", "Sales": 12}, "malformed hierarchy"),
    ],
)
def test_result_validation_rejects_malformed_rows(
    bad_row: dict[str, object], error_text: str
) -> None:
    _, error = validate_sunburst_result_data(
        [
            {"region": "valid", "country": "valid", "Sales": 1},
            *[
                {"region": f"row-{index}", "country": "valid", "Sales": index}
                for index in range(2, 22)
            ],
            bad_row,
        ],
        map_config_to_form_data(_config()),
    )

    assert error is not None
    assert error_text in error.error
    assert "row 22" in error.error


def test_sunburst_table_is_validated_and_vega_is_explicitly_unsupported() -> None:
    form_data = map_config_to_form_data(_config())
    table = _generate_table_preview_from_data(
        [{"region": "A", "country": "B", "Sales": 3}], form_data
    )
    vega = _generate_vega_lite_preview_from_data(
        [{"region": "A", "country": "B", "Sales": 3}], form_data
    )

    assert not isinstance(table, ChartError)
    assert "region" in table.table_data
    assert isinstance(vega, ChartError)
    assert vega.error_type == "UnsupportedFormat"


@pytest.mark.parametrize("saved", [False, True], ids=["unsaved", "saved"])
@pytest.mark.parametrize("preview_format", ["ascii", "table"])
def test_decimal_sunburst_saved_and_unsaved_previews(
    saved: bool, preview_format: str
) -> None:
    """Every executable Sunburst preview mode accepts producer Decimals."""
    form_data = map_config_to_form_data(
        _config(secondary_metric={"name": "profit", "aggregate": "SUM"})
    )
    command = MagicMock()
    command.run.return_value = chart_data_command_result(
        [
            {
                "region": "Americas",
                "country": "Brazil",
                "Sales": Decimal("12.50"),
                "SUM(profit)": Decimal("1.25"),
            }
        ],
        columns=["region", "country", "Sales", "SUM(profit)"],
        coltypes=[
            GenericDataType.STRING,
            GenericDataType.STRING,
            GenericDataType.NUMERIC,
            GenericDataType.NUMERIC,
        ],
    )
    with (
        patch("superset.extensions.db.session.get", return_value=Mock(id=7)),
        patch(
            "superset.mcp_service.chart.chart_helpers."
            "build_query_context_from_form_data",
            return_value=object(),
        ),
        patch(
            "superset.mcp_service.chart.tool.get_chart_preview."
            "build_query_context_from_form_data",
            return_value=object(),
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand",
            return_value=command,
        ),
    ):
        if saved:
            chart = Mock(
                id=11,
                slice_name="Hierarchy",
                viz_type="sunburst_v2",
                datasource_id=7,
                datasource_type="table",
                params=json.dumps(form_data),
            )
            strategy = (
                ASCIIPreviewStrategy
                if preview_format == "ascii"
                else TablePreviewStrategy
            )
            preview = strategy(
                chart, GetChartPreviewRequest(identifier=11, format=preview_format)
            ).generate()
        else:
            preview = generate_preview_from_form_data(form_data, 7, preview_format)

    assert not isinstance(preview, ChartError)
    preview_text = (
        preview.ascii_content if preview_format == "ascii" else preview.table_data
    )
    assert "12.50" in preview_text
    assert "1.25" in preview_text


@pytest.mark.parametrize(
    "data, expected, error_type",
    [
        ([], "No data available for sunburst chart", None),
        (["malformed"], None, "InvalidSunburstResult"),
    ],
)
def test_ascii_preview_handles_empty_and_malformed_results(
    data: list[object], expected: str | None, error_type: str | None
) -> None:
    form_data = map_config_to_form_data(_config())
    preview = _generate_ascii_preview_from_data(data, form_data)  # type: ignore[arg-type]
    if error_type:
        assert isinstance(preview, ChartError)
        assert preview.error_type == error_type
    else:
        assert not isinstance(preview, ChartError)
        assert preview.ascii_content == expected


def test_dataset_validation_and_casefold_canonicalization() -> None:
    context = DatasetContext(
        id=7,
        table_name="sales",
        schema="analytics",
        database_name="main",
        available_columns=[
            {"name": "Region", "type": "VARCHAR", "is_temporal": False},
            {"name": "Country", "type": "VARCHAR", "is_temporal": False},
            {"name": "Sales", "type": "DOUBLE", "is_temporal": False},
            {"name": "Status", "type": "VARCHAR", "is_temporal": False},
        ],
        available_metrics=[
            {"name": "Profit", "expression": "SUM(profit)"},
        ],
    )
    config = _config(
        hierarchy=[{"name": "REGION"}, {"name": "country"}],
        metric={"name": "sales", "aggregate": "SUM"},
        secondary_metric={"name": "profit", "saved_metric": True},
        filters=[{"column": "status", "op": "=", "value": "active"}],
    )
    normalized = DatasetValidator.normalize_column_names(
        config, 7, dataset_context=context
    )
    assert [column.name for column in normalized.hierarchy] == ["Region", "Country"]
    assert normalized.metric.name == "Sales"
    assert normalized.secondary_metric is not None
    assert normalized.secondary_metric.name == "Profit"
    assert normalized.filters is not None
    assert normalized.filters[0].column == "Status"
    assert DatasetValidator.validate_against_dataset(
        normalized, 7, dataset_context=context
    ) == (True, None)


def test_cross_namespace_references_resolve_with_role_specific_precedence() -> None:
    """Exact metric spellings cannot steal physical Sunburst roles."""
    context = DatasetContext(
        id=7,
        table_name="sales",
        schema="analytics",
        database_name="main",
        available_columns=[
            {"name": "Region", "type": "VARCHAR", "is_temporal": False},
            {
                "name": "Sales",
                "type": "DOUBLE",
                "is_temporal": False,
                "is_numeric": True,
            },
            {"name": "Status", "type": "VARCHAR", "is_temporal": False},
            {"name": "EventTime", "type": "TIMESTAMP", "is_temporal": True},
            {"name": "savedprofit", "type": "DOUBLE", "is_numeric": True},
        ],
        available_metrics=[
            {"name": "region", "expression": "COUNT(*)"},
            {"name": "sales", "expression": "SUM(sales)"},
            {"name": "status", "expression": "COUNT(*)"},
            {"name": "eventtime", "expression": "MAX(event_time)"},
            {"name": "SavedProfit", "expression": "SUM(profit)"},
        ],
    )
    config = _config(
        hierarchy=[{"name": "region"}],
        metric={"name": "sales", "aggregate": "SUM", "label": "Revenue"},
        secondary_metric={"name": "savedprofit", "saved_metric": True},
        filters=[{"column": "status", "op": "=", "value": "active"}],
        temporal_column="eventtime",
        time_grain="P1D",
        sort_by_metric=True,
    )

    assert DatasetValidator.validate_against_dataset(
        config, 7, dataset_context=context
    ) == (True, None)
    normalized = DatasetValidator.normalize_column_names(
        config, 7, dataset_context=context
    )
    assert [column.name for column in normalized.hierarchy] == ["Region"]
    assert normalized.metric.name == "Sales"
    assert normalized.secondary_metric is not None
    # saved_metric=True stays in the saved-metric namespace even though an
    # exactly spelled physical column exists.
    assert normalized.secondary_metric.name == "SavedProfit"
    assert normalized.filters is not None
    assert normalized.filters[0].column == "Status"
    assert normalized.temporal_column == "EventTime"

    form_data = map_config_to_form_data(normalized)
    query = build_query_context_from_form_data(
        form_data,
        {"id": 7, "type": "table"},
        viz_type="sunburst_v2",
    )["queries"][0]
    assert query["columns"] == ["Region"]
    assert form_data["metric"]["column"] == {"column_name": "Sales"}
    assert form_data["secondary_metric"] == "SavedProfit"
    assert query["orderby"] == [[form_data["metric"], False]]
    assert query["granularity"] == "EventTime"
    assert query["extras"]["time_grain_sqla"] == "P1D"
    assert form_data["adhoc_filters"][0]["subject"] == "Status"


def test_native_cross_namespace_references_use_the_same_role_precedence() -> None:
    """Saved/native form data canonicalizes physical and metric roles apart."""
    context = DatasetContext(
        id=7,
        table_name="sales",
        schema=None,
        database_name="main",
        available_columns=[
            {"name": "Region", "type": "VARCHAR"},
            {"name": "Sales", "type": "DOUBLE", "is_numeric": True},
            {"name": "Status", "type": "VARCHAR"},
            {"name": "EventTime", "type": "TIMESTAMP", "is_temporal": True},
            {"name": "savedprofit", "type": "DOUBLE", "is_numeric": True},
        ],
        available_metrics=[
            {"name": "region", "expression": "COUNT(*)"},
            {"name": "sales", "expression": "SUM(sales)"},
            {"name": "status", "expression": "COUNT(*)"},
            {"name": "eventtime", "expression": "MAX(event_time)"},
            {"name": "SavedProfit", "expression": "SUM(profit)"},
        ],
    )
    form_data = {
        "viz_type": "sunburst_v2",
        "columns": ["region"],
        "metric": {
            "expressionType": "SIMPLE",
            "aggregate": "SUM",
            "column": {"column_name": "sales"},
            "label": "Revenue",
        },
        "secondary_metric": "savedprofit",
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "expressionType": "SIMPLE",
                "subject": "status",
                "operator": "==",
                "comparator": "active",
            }
        ],
        "granularity_sqla": "eventtime",
        "time_grain_sqla": "P1D",
        "sort_by_metric": True,
    }

    normalized = normalize_sunburst_form_data_references(form_data, context)
    assert normalized["columns"] == ["Region"]
    assert normalized["metric"]["column"]["column_name"] == "Sales"
    assert normalized["secondary_metric"] == "SavedProfit"
    assert normalized["adhoc_filters"][0]["subject"] == "Status"
    assert normalized["granularity_sqla"] == "EventTime"

    query = build_query_context_from_form_data(
        normalized,
        {"id": 7, "type": "table"},
        viz_type="sunburst_v2",
    )["queries"][0]
    assert query["orderby"] == [[normalized["metric"], False]]
    assert query["granularity"] == "EventTime"


def test_exact_dataset_reference_wins_and_ambiguous_casefold_is_rejected() -> None:
    context = DatasetContext(
        id=7,
        table_name="sales",
        schema="analytics",
        database_name="main",
        available_columns=[
            {"name": "Region", "type": "VARCHAR", "is_temporal": False},
            {"name": "region", "type": "VARCHAR", "is_temporal": False},
            {"name": "Country", "type": "VARCHAR", "is_temporal": False},
            {"name": "Sales", "type": "DOUBLE", "is_numeric": True},
        ],
    )
    exact = _config(
        hierarchy=[{"name": "Region"}, {"name": "Country"}],
        metric={"name": "Sales", "aggregate": "SUM"},
    )
    ambiguous = _config(
        hierarchy=[{"name": "REGION"}, {"name": "Country"}],
        metric={"name": "Sales", "aggregate": "SUM"},
    )

    assert DatasetValidator.validate_against_dataset(
        exact, 7, dataset_context=context
    ) == (True, None)
    valid, error = DatasetValidator.validate_against_dataset(
        ambiguous, 7, dataset_context=context
    )
    assert valid is False
    assert error is not None
    assert error.error_code == "AMBIGUOUS_DATASET_REFERENCE"
    assert "'Region'" in error.details
    assert "'region'" in error.details


@pytest.mark.parametrize("aggregate", ["MIN", "MAX"])
def test_text_physical_metrics_are_rejected_for_sunburst(aggregate: str) -> None:
    context = DatasetContext(
        id=7,
        table_name="sales",
        schema="analytics",
        database_name="main",
        available_columns=[
            {"name": "region", "type": "VARCHAR", "is_temporal": False},
            {"name": "country", "type": "VARCHAR", "is_temporal": False},
            {"name": "category", "type": "VARCHAR", "is_temporal": False},
        ],
    )

    valid, error = DatasetValidator.validate_against_dataset(
        _config(metric={"name": "category", "aggregate": aggregate}),
        7,
        dataset_context=context,
    )

    assert valid is False
    assert error is not None
    assert error.error_code == "INVALID_AGGREGATION"


def test_count_of_text_is_a_numeric_sunburst_metric() -> None:
    context = DatasetContext(
        id=7,
        table_name="sales",
        schema="analytics",
        database_name="main",
        available_columns=[
            {"name": "region", "type": "VARCHAR", "is_temporal": False},
            {"name": "country", "type": "VARCHAR", "is_temporal": False},
            {"name": "category", "type": "VARCHAR", "is_temporal": False},
        ],
    )
    assert DatasetValidator.validate_against_dataset(
        _config(metric={"name": "category", "aggregate": "COUNT"}),
        7,
        dataset_context=context,
    ) == (True, None)


def test_schema_discovery_exposes_sunburst_example() -> None:
    result = _get_chart_type_schema_impl("sunburst")
    assert result["chart_type"] == "sunburst"
    assert result["schema"]["properties"]["viz_type"]["const"] == "sunburst_v2"
    assert result["examples"][0]["hierarchy"]


def test_recommendation_metadata_includes_sunburst_for_hierarchical_data() -> None:
    assert "hierarchical" in ChartTypeSuggester.get_chart_type_description("sunburst")
    is_appropriate, suggestion = ChartTypeSuggester.analyze_and_suggest(
        TableChartConfig(
            chart_type="table",
            columns=[
                ColumnRef(name="region"),
                ColumnRef(name="country"),
                ColumnRef(name="sales", aggregate="SUM"),
            ],
        ),
        dataset_id=7,
    )
    assert is_appropriate is False
    assert suggestion is not None
    assert "sunburst" in suggestion["recommended_types"]


def test_update_tool_preserves_omitted_state_and_honors_explicit_values() -> None:
    chart = Mock(
        id=19,
        datasource_id=7,
        slice_name="Saved hierarchy",
        params=json.dumps(
            {
                "viz_type": "sunburst_v2",
                "columns": ["old_region", "old_country"],
                "metric": "old_metric",
                "secondary_metric": "old_secondary_metric",
                "all_columns": ["old_raw_column"],
                "groupby": ["old_groupby"],
                "metrics": ["old_plural_metric"],
                "series": "old_series",
                "x_axis": "old_x_axis",
                "color_scheme": "savedScheme",
                "show_labels": True,
                "show_total": True,
                "show_null_values": True,
                "adhoc_filters": [
                    {
                        "expressionType": "SIMPLE",
                        "clause": "WHERE",
                        "subject": "status",
                        "operator": "==",
                        "comparator": "active",
                    }
                ],
                "plugin_only_ui_state": {"kept": True},
            }
        ),
    )
    config = _config(show_labels=False, secondary_metric=None)
    request = UpdateChartRequest(
        identifier=19,
        config=config,
        generate_preview=False,
    )

    payload = _build_update_payload(request, chart, parsed_config=config)
    preview = _build_preview_form_data(request, chart, parsed_config=config)

    assert isinstance(payload, dict)
    assert isinstance(preview, dict)
    persisted = json.loads(payload["params"])
    for form_data in (persisted, preview):
        assert form_data["columns"] == ["region", "country"]
        assert form_data["show_labels"] is False
        assert form_data["show_total"] is True
        assert form_data["color_scheme"] == "savedScheme"
        assert form_data["adhoc_filters"][0]["subject"] == "status"
        assert form_data["plugin_only_ui_state"] == {"kept": True}
        assert "secondary_metric" not in form_data
        assert {
            "all_columns",
            "groupby",
            "metrics",
            "series",
            "x_axis",
        }.isdisjoint(form_data)

    query = build_query_context_from_form_data(
        preview,
        {"id": 7, "type": "table"},
        viz_type="sunburst_v2",
    )["queries"][0]
    assert query["columns"] == ["region", "country"]
    assert query["metrics"] == [preview["metric"]]

    factory = MagicMock()
    factory.create.return_value = object()
    command = MagicMock()
    command.run.return_value = {"queries": [{"data": []}]}
    with (
        patch(
            "superset.common.query_context_factory.QueryContextFactory",
            return_value=factory,
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand",
            return_value=command,
        ),
    ):
        result = _compile_chart(preview, 7)
    assert result.success is True
    compiled_query = factory.create.call_args.kwargs["queries"][0]
    assert compiled_query["columns"] == ["region", "country"]
    assert compiled_query["metrics"] == [preview["metric"]]


@pytest.mark.parametrize("generate_preview", [False, True])
def test_update_rebind_owns_chart_and_datasource_identity(
    generate_preview: bool,
) -> None:
    chart = Mock(
        id=19,
        datasource_id=10,
        datasource_type="table",
        slice_name="Saved hierarchy",
        params=json.dumps(
            {
                "viz_type": "sunburst_v2",
                "columns": ["region", "country"],
                "metric": "SavedSales",
                "datasource": "10__table",
                "slice_id": 19,
            }
        ),
    )
    config = _config(datasource="10__table", slice_id=777)
    request = UpdateChartRequest(
        identifier=19,
        dataset_id=99,
        config=config,
        generate_preview=generate_preview,
    )

    if generate_preview:
        state = _build_preview_form_data(request, chart, parsed_config=config)
    else:
        payload = _build_update_payload(request, chart, parsed_config=config)
        assert isinstance(payload, dict)
        assert payload["datasource_id"] == 99
        assert payload["datasource_type"] == "table"
        state = json.loads(payload["params"])

    assert isinstance(state, dict)
    assert state["slice_id"] == 19
    assert state["datasource"] == "99__table"
    assert resolve_form_data_datasource(state) == (99, "table")


def test_dataset_only_rebind_rewrites_saved_sunburst_params() -> None:
    chart = Mock(
        id=19,
        datasource_id=10,
        datasource_type="table",
        slice_name="Saved hierarchy",
        params=json.dumps(
            {
                "viz_type": "sunburst_v2",
                "columns": ["region", "country"],
                "metric": "SavedSales",
                "order_by_cols": ['["country", false]'],
                "adhoc_filters": [{"subject": "region"}],
                "column_config": {"region": {"columnWidth": 120}},
                "show_labels": True,
                "datasource": "10__table",
                "slice_id": 777,
            }
        ),
    )
    request = UpdateChartRequest(
        identifier=19,
        dataset_id=99,
        generate_preview=False,
    )

    payload = _build_update_payload(request, chart)

    assert isinstance(payload, dict)
    assert payload["datasource_id"] == 99
    assert payload["datasource_type"] == "table"
    assert payload["query_context"] is None
    persisted = json.loads(payload["params"])
    assert persisted["slice_id"] == 19
    assert persisted["datasource"] == "99__table"
    assert persisted["show_labels"] is True
    assert {
        "adhoc_filters",
        "column_config",
        "columns",
        "metric",
        "order_by_cols",
    }.isdisjoint(persisted)
    assert resolve_form_data_datasource(persisted) == (99, "table")


def test_update_tool_explicit_empty_filters_clear_saved_filters() -> None:
    chart = Mock(
        id=19,
        datasource_id=7,
        slice_name="Saved hierarchy",
        params=json.dumps(
            {
                "viz_type": "sunburst_v2",
                "columns": ["region"],
                "metric": "count",
                "adhoc_filters": [{"subject": "status"}],
            }
        ),
    )
    config = _config(filters=[])
    request = UpdateChartRequest(identifier=19, config=config)
    payload = _build_update_payload(request, chart, parsed_config=config)
    assert isinstance(payload, dict)
    assert "adhoc_filters" not in json.loads(payload["params"])


@pytest.mark.parametrize("source_viz", ["sunburst_v2", "pie", "table"])
def test_explicit_sunburst_clears_win_in_immediate_and_preview_updates(
    source_viz: str,
) -> None:
    chart = Mock(
        id=19,
        datasource_id=7,
        datasource_type="table",
        slice_name="Saved chart",
        params=json.dumps(
            {
                "viz_type": source_viz,
                "color_scheme": "savedCategorical",
                "linear_color_scheme": "savedLinear",
                "granularity_sqla": "order_date",
                "time_grain_sqla": "P1M",
                "time_range": "Last month",
                "since": "2025-01-01",
                "until": "2025-02-01",
                "adhoc_filters": [
                    {
                        "clause": "WHERE",
                        "expressionType": "SIMPLE",
                        "subject": "order_date",
                        "operator": "TEMPORAL_RANGE",
                        "comparator": "Last month",
                    },
                    {
                        "clause": "WHERE",
                        "expressionType": "SIMPLE",
                        "subject": "status",
                        "operator": "==",
                        "comparator": "active",
                    },
                ],
            }
        ),
    )
    config = _config(
        color_scheme=None,
        linear_color_scheme=None,
        temporal_column=None,
        time_grain=None,
        time_range=None,
    )
    request = UpdateChartRequest(identifier=19, config=config)

    payload = _build_update_payload(request, chart, parsed_config=config)
    preview = _build_preview_form_data(request, chart, parsed_config=config)

    assert isinstance(payload, dict)
    assert isinstance(preview, dict)
    for state in (json.loads(payload["params"]), preview):
        assert {
            "color_scheme",
            "linear_color_scheme",
            "granularity_sqla",
            "time_grain_sqla",
            "time_range",
            "since",
            "until",
        }.isdisjoint(state)
        filters = state.get("adhoc_filters", [])
        assert all(filter_.get("operator") != "TEMPORAL_RANGE" for filter_ in filters)
        assert any(filter_.get("subject") == "status" for filter_ in filters)


@pytest.mark.parametrize("source_viz", ["sunburst_v2", "pie"])
def test_sunburst_clear_preserves_only_omitted_independent_state(
    source_viz: str,
) -> None:
    existing = {
        "viz_type": source_viz,
        "color_scheme": "savedCategorical",
        "linear_color_scheme": "savedLinear",
        "granularity_sqla": "order_date",
        "time_grain_sqla": "P1M",
        "time_range": "Last month",
        "since": "2025-01-01",
        "until": "2025-02-01",
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "expressionType": "SIMPLE",
                "subject": "order_date",
                "operator": "TEMPORAL_RANGE",
                "comparator": "Last month",
            }
        ],
    }

    color_config = _config(color_scheme=None)
    color_clear = merge_form_data_for_update(
        existing,
        map_config_to_form_data(color_config),
        color_config,
    )
    assert "color_scheme" not in color_clear
    assert color_clear["linear_color_scheme"] == "savedLinear"
    assert color_clear["granularity_sqla"] == "order_date"
    assert color_clear["time_grain_sqla"] == "P1M"
    assert color_clear["time_range"] == "Last month"
    assert color_clear["since"] == "2025-01-01"
    assert color_clear["until"] == "2025-02-01"
    assert color_clear["adhoc_filters"][0]["operator"] == "TEMPORAL_RANGE"

    range_config = _config(time_range=None)
    range_clear = merge_form_data_for_update(
        existing,
        map_config_to_form_data(range_config),
        range_config,
    )
    assert {
        "granularity_sqla",
        "time_grain_sqla",
        "time_range",
        "since",
        "until",
    }.isdisjoint(range_clear)
    assert range_clear.get("adhoc_filters", []) == []


def test_native_temporal_alias_none_is_an_explicit_atomic_clear() -> None:
    config = SunburstChartConfig.model_validate(
        {
            "viz_type": "sunburst_v2",
            "columns": ["region", "country"],
            "metric": "SavedSales",
            "color_scheme": None,
            "linear_color_scheme": None,
            "granularity_sqla": None,
            "time_grain_sqla": None,
            "time_range": None,
            "adhoc_filters": [
                {
                    "clause": "WHERE",
                    "expressionType": "SIMPLE",
                    "subject": "order_date",
                    "operator": "TEMPORAL_RANGE",
                    "comparator": "Last month",
                }
            ],
        }
    )

    assert {
        "color_scheme",
        "linear_color_scheme",
        "temporal_column",
        "time_grain",
        "time_range",
    } <= config.model_fields_set
    assert config.temporal_column is None
    assert config.time_grain is None
    assert config.time_range is None

    merged = merge_form_data_for_update(
        {
            "viz_type": "pie",
            "color_scheme": "savedCategorical",
            "linear_color_scheme": "savedLinear",
            "granularity_sqla": "order_date",
            "time_grain_sqla": "P1M",
            "time_range": "Last month",
            "since": "2025-01-01",
            "until": "2025-02-01",
            "adhoc_filters": [
                {
                    "clause": "WHERE",
                    "expressionType": "SIMPLE",
                    "subject": "order_date",
                    "operator": "TEMPORAL_RANGE",
                    "comparator": "Last month",
                }
            ],
        },
        map_config_to_form_data(config),
        config,
    )
    assert {
        "color_scheme",
        "linear_color_scheme",
        "granularity_sqla",
        "time_grain_sqla",
        "time_range",
        "since",
        "until",
        "adhoc_filters",
    }.isdisjoint(merged)


@pytest.mark.parametrize("cleared_field", ["time_range", "temporal_column"])
def test_explicit_temporal_clear_removes_preserved_temporal_filters(
    cleared_field: str,
) -> None:
    chart = Mock(
        id=19,
        datasource_id=7,
        slice_name="Saved hierarchy",
        params=json.dumps(
            {
                "viz_type": "sunburst_v2",
                "columns": ["region", "country"],
                "metric": "SavedSales",
                "granularity_sqla": "order_date",
                "time_range": "Last month",
                "adhoc_filters": [
                    {
                        "clause": "WHERE",
                        "expressionType": "SIMPLE",
                        "subject": "order_date",
                        "operator": "TEMPORAL_RANGE",
                        "comparator": "Last month",
                    },
                    {
                        "clause": "WHERE",
                        "expressionType": "SIMPLE",
                        "subject": "status",
                        "operator": "==",
                        "comparator": "active",
                    },
                ],
            }
        ),
    )
    config = _config(**{cleared_field: None})
    request = UpdateChartRequest(identifier=19, config=config)
    payload = _build_update_payload(request, chart, parsed_config=config)
    preview = _build_preview_form_data(request, chart, parsed_config=config)
    assert isinstance(payload, dict)
    assert isinstance(preview, dict)

    for state in (json.loads(payload["params"]), preview):
        filters = state.get("adhoc_filters", [])
        assert all(filter_.get("comparator") != "Last month" for filter_ in filters)
        assert any(filter_["subject"] == "status" for filter_ in filters)
        if cleared_field == "temporal_column":
            assert all(filter_["operator"] != "TEMPORAL_RANGE" for filter_ in filters)


@pytest.mark.parametrize("source_viz", ["sunburst_v2", "pie"])
@pytest.mark.parametrize(
    "cleared_field", ["time_range", "temporal_column", "time_grain"]
)
def test_each_temporal_clear_scrubs_every_reconstruction_source(
    source_viz: str,
    cleared_field: str,
) -> None:
    """A clear wins after adversarial native and override merge ordering."""
    temporal_adhoc = {
        "clause": "WHERE",
        "expressionType": "SIMPLE",
        "subject": "order_date",
        "operator": "TEMPORAL_RANGE",
        "comparator": "Last month",
    }
    regular_adhoc = {
        "clause": "WHERE",
        "expressionType": "SIMPLE",
        "subject": "status",
        "operator": "==",
        "comparator": "active",
    }
    existing = {
        "viz_type": source_viz,
        "granularity": "order_date",
        "granularity_sqla": "order_date",
        "time_grain": "P1M",
        "time_grain_sqla": "P1M",
        "time_range": "Last month",
        "since": "2025-01-01",
        "until": "2025-02-01",
        "adhoc_filters": [temporal_adhoc, regular_adhoc],
        "extra_filters": [
            {"col": "__time_range", "op": "==", "val": "Last year"},
            {"col": "country", "op": "IN", "val": ["US"]},
        ],
        "filters": [
            {"col": "ship_date", "op": "TEMPORAL_RANGE", "val": "Last year"},
            {"col": "region", "op": "IN", "val": ["North"]},
        ],
        "extra_form_data": {
            "granularity_sqla": "ship_date",
            "time_grain_sqla": "P1Y",
            "time_range": "Last year",
            "filters": [
                {"col": "ship_date", "op": "TEMPORAL_RANGE", "val": "Last year"},
                {"col": "segment", "op": "IN", "val": ["Enterprise"]},
            ],
            "adhoc_filters": [temporal_adhoc, regular_adhoc],
            "custom_form_data": {"retained": True},
        },
    }
    chart = Mock(
        id=19,
        datasource_id=7,
        datasource_type="table",
        slice_name="Saved chart",
        params=json.dumps(existing),
    )
    config = _config(**{cleared_field: None})
    request = UpdateChartRequest(identifier=19, config=config)

    payload = _build_update_payload(request, chart, parsed_config=config)
    preview = _build_preview_form_data(request, chart, parsed_config=config)
    assert isinstance(payload, dict)
    assert isinstance(preview, dict)

    for state in (json.loads(payload["params"]), preview):
        assert {
            "granularity",
            "granularity_sqla",
            "since",
            "time_grain",
            "time_grain_sqla",
            "time_range",
            "until",
        }.isdisjoint(state)
        assert state["adhoc_filters"] == [regular_adhoc]
        assert state["extra_filters"] == [{"col": "country", "op": "IN", "val": ["US"]}]
        assert state["filters"] == [{"col": "region", "op": "IN", "val": ["North"]}]
        extra = state["extra_form_data"]
        assert extra["custom_form_data"] == {"retained": True}
        assert extra["filters"] == [
            {"col": "segment", "op": "IN", "val": ["Enterprise"]}
        ]
        assert extra["adhoc_filters"] == [regular_adhoc]
        assert {
            "granularity_sqla",
            "time_grain_sqla",
            "time_range",
        }.isdisjoint(extra)

        factory = MagicMock()
        factory.create.return_value = object()
        with patch(
            "superset.common.query_context_factory.QueryContextFactory",
            return_value=factory,
        ):
            build_mcp_query_context_from_form_data(deepcopy(state))
        query = factory.create.call_args.kwargs["queries"][0]
        assert "granularity" not in query
        assert "time_range" not in query
        assert "time_grain_sqla" not in query.get("extras", {})
        assert all(
            filter_.get("op") != "TEMPORAL_RANGE"
            for filter_ in query.get("filters", [])
        )
        assert {"col": "region", "op": "IN", "val": ["North"]} in query.get(
            "filters", []
        )


@pytest.mark.parametrize(
    "overrides, expected_column, expected_grain",
    [
        ({}, "order_date", "P1M"),
        ({"temporal_column": None}, None, None),
        ({"time_grain": None}, None, None),
        ({"time_grain": "P1Y"}, "order_date", "P1Y"),
        ({"temporal_column": "ship_date"}, "ship_date", "P1M"),
        (
            {"temporal_column": "ship_date", "time_grain": "P1W"},
            "ship_date",
            "P1W",
        ),
    ],
)
def test_temporal_pair_merges_atomically_for_cached_and_immediate_paths(
    overrides: dict[str, object],
    expected_column: str | None,
    expected_grain: str | None,
) -> None:
    chart = Mock(
        id=19,
        datasource_id=7,
        slice_name="Saved hierarchy",
        params=json.dumps(
            {
                "viz_type": "sunburst_v2",
                "columns": ["region", "country"],
                "metric": "SavedSales",
                "granularity_sqla": "order_date",
                "time_grain_sqla": "P1M",
            }
        ),
    )
    config = _config(**overrides)
    request = UpdateChartRequest(identifier=19, config=config)
    payload = _build_update_payload(request, chart, parsed_config=config)
    preview = _build_preview_form_data(request, chart, parsed_config=config)
    assert isinstance(payload, dict)
    assert isinstance(preview, dict)

    for state in (json.loads(payload["params"]), preview):
        assert state.get("granularity_sqla") == expected_column
        assert state.get("time_grain_sqla") == expected_grain


def test_orphan_grain_and_temporal_hierarchy_are_preserved_then_rejected() -> None:
    """A temporal hierarchy is not the frontend's granularity subject."""
    config = _config(
        hierarchy=[{"name": "OrderDate"}],
        metric={"name": "Sales", "aggregate": "SUM", "label": "Sales"},
        time_grain="P1M",
    )
    form_data = map_config_to_form_data(config)
    assert form_data["columns"] == ["OrderDate"]
    assert form_data["time_grain_sqla"] == "P1M"
    assert "granularity_sqla" not in form_data

    tier_one = validate_and_compile(
        config, form_data, _dataset(), run_compile_check=False
    )
    assert tier_one.success is False
    assert tier_one.error_obj is not None
    assert tier_one.error_obj.error_code == "INVALID_TEMPORAL_STATE"

    # generate_chart calls _compile_chart directly after its request pipeline;
    # the same final-form guard must run before a query command is constructed.
    compiled = _compile_chart(form_data, 7)
    assert compiled.success is False
    assert compiled.tier == "validation"
    assert compiled.error_obj is not None
    assert compiled.error_obj.error_code == "INVALID_TEMPORAL_STATE"


@pytest.mark.parametrize("source_viz", ["sunburst_v2", "pie"])
def test_orphan_grain_survives_same_and_cross_viz_merge_for_validation(
    source_viz: str,
) -> None:
    """Merge code must not erase an invalid final state before validation."""
    existing = {
        "viz_type": source_viz,
        "time_grain_sqla": "P1M",
    }
    config = _config()
    merged = merge_form_data_for_update(
        existing, map_config_to_form_data(config), config
    )
    assert merged["time_grain_sqla"] == "P1M"
    assert "granularity_sqla" not in merged

    result = validate_and_compile(config, merged, _dataset(), run_compile_check=False)
    assert result.success is False
    assert result.error_obj is not None
    assert result.error_obj.error_code == "INVALID_TEMPORAL_STATE"


def test_setting_grain_while_clearing_subject_is_rejected_in_both_update_forms() -> (
    None
):
    chart = Mock(
        id=19,
        datasource_id=7,
        slice_name="Saved hierarchy",
        params=json.dumps(
            {
                "viz_type": "sunburst_v2",
                "columns": ["Region", "Country"],
                "metric": "SavedSales",
                "granularity_sqla": "OrderDate",
                "time_grain_sqla": "P1M",
            }
        ),
    )
    config = _config(temporal_column=None, time_grain="P1W")
    request = UpdateChartRequest(identifier=19, config=config)
    payload = _build_update_payload(request, chart, parsed_config=config)
    preview = _build_preview_form_data(request, chart, parsed_config=config)
    assert isinstance(payload, dict)
    assert isinstance(preview, dict)

    for state in (json.loads(payload["params"]), preview):
        assert state["time_grain_sqla"] == "P1W"
        assert "granularity_sqla" not in state
        result = validate_and_compile(
            config, state, _dataset(), run_compile_check=False
        )
        assert result.success is False
        assert result.error_obj is not None
        assert result.error_obj.error_code == "INVALID_TEMPORAL_STATE"


def test_cached_update_preview_rejects_orphan_grain_before_recaching() -> None:
    config = _config(time_grain="P1Y")
    request = UpdateChartPreviewRequest(
        form_data_key="orphan-grain-key",
        dataset_id=7,
        config=config,
        generate_preview=False,
    )
    dataset = _dataset()
    generate_link = MagicMock(
        return_value="http://localhost/explore/?form_data_key=unexpected"
    )

    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=Mock(id=1, username="admin", roles=[], groups=[]),
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview._find_dataset",
            return_value=dataset,
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview."
            "_get_previous_form_data",
            return_value={
                "viz_type": "sunburst_v2",
                "columns": ["Region", "Country"],
                "metric": "SavedSales",
            },
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview.has_dataset_access",
            return_value=True,
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview."
            "generate_explore_link",
            generate_link,
        ),
    ):
        result = update_chart_preview(request, ctx=MagicMock())

    assert result["success"] is False
    assert result["error"]["error_code"] == "INVALID_TEMPORAL_STATE"
    generate_link.assert_not_called()


def test_cached_update_preview_rebinds_datasource_and_stays_unsaved() -> None:
    config = _config(datasource="10__table", slice_id=777)
    request = UpdateChartPreviewRequest(
        form_data_key="dataset-10-preview",
        dataset_id=99,
        config=config,
        generate_preview=False,
    )
    dataset = _dataset()
    dataset.id = 99
    compile_calls: list[dict[str, object]] = []

    def validate(
        _config: object,
        form_data: dict[str, object],
        _dataset: object,
        *,
        run_compile_check: bool,
    ) -> Mock:
        if run_compile_check:
            compile_calls.append(deepcopy(form_data))
        return Mock(success=True)

    generate_link = MagicMock(
        return_value="http://localhost/explore/?form_data_key=dataset-99-preview"
    )
    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=Mock(id=1, username="admin", roles=[], groups=[]),
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview._find_dataset",
            return_value=dataset,
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview."
            "_get_previous_form_data",
            return_value={
                "viz_type": "sunburst_v2",
                "columns": ["Region", "Country"],
                "metric": "SavedSales",
                "datasource": "10__table",
                "slice_id": 19,
            },
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview.has_dataset_access",
            return_value=True,
        ),
        patch.object(DatasetValidator, "normalize_column_names", return_value=config),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview."
            "normalize_sunburst_form_data_references",
            side_effect=lambda form_data, _context: form_data,
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview.validate_and_compile",
            side_effect=validate,
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview."
            "generate_explore_link",
            generate_link,
        ),
    ):
        result = update_chart_preview(request, ctx=MagicMock())

    assert result["success"] is True
    assert compile_calls == [generate_link.call_args.args[1]]
    final_form_data = compile_calls[0]
    assert final_form_data["datasource"] == "99__table"
    assert "slice_id" not in final_form_data
    assert "slice_id=" not in result["explore_url"]


@pytest.mark.parametrize("source_viz", ["sunburst_v2", "pie", "table"])
@pytest.mark.parametrize(
    "cleared_field", ["time_range", "temporal_column", "time_grain"]
)
def test_cached_update_preview_honors_explicit_sunburst_clears(
    source_viz: str, cleared_field: str
) -> None:
    config = _config(**{cleared_field: None})
    request = UpdateChartPreviewRequest(
        form_data_key="saved-preview",
        dataset_id=7,
        config=config,
        generate_preview=False,
    )
    dataset = _dataset()
    captured: dict[str, object] = {}

    def generate_link(
        _dataset_id: int | str,
        form_data: dict[str, object],
        *,
        prefer_permalink: bool,
    ) -> str:
        assert prefer_permalink is False
        captured.update(deepcopy(form_data))
        return "http://localhost/explore/?form_data_key=cleared-preview"

    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=Mock(id=1, username="admin", roles=[], groups=[]),
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview._find_dataset",
            return_value=dataset,
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview."
            "_get_previous_form_data",
            return_value={
                "viz_type": source_viz,
                "datasource": "7__table",
                "color_scheme": "savedCategorical",
                "linear_color_scheme": "savedLinear",
                "granularity_sqla": "OrderDate",
                "time_grain_sqla": "P1M",
                "time_range": "Last month",
                "since": "2025-01-01",
                "until": "2025-02-01",
                "extra_filters": [
                    {"col": "__time_range", "op": "==", "val": "Last year"},
                    {"col": "Region", "op": "IN", "val": ["North"]},
                ],
                "filters": [
                    {
                        "col": "OrderDate",
                        "op": "TEMPORAL_RANGE",
                        "val": "Last year",
                    },
                    {"col": "Country", "op": "IN", "val": ["US"]},
                ],
                "extra_form_data": {
                    "time_range": "Last year",
                    "granularity_sqla": "OrderDate",
                    "time_grain_sqla": "P1Y",
                    "custom_form_data": {"retained": True},
                },
                "adhoc_filters": [
                    {
                        "clause": "WHERE",
                        "expressionType": "SIMPLE",
                        "subject": "OrderDate",
                        "operator": "TEMPORAL_RANGE",
                        "comparator": "Last month",
                    }
                ],
            },
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview.has_dataset_access",
            return_value=True,
        ),
        patch.object(DatasetValidator, "normalize_column_names", return_value=config),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview."
            "normalize_sunburst_form_data_references",
            side_effect=lambda form_data, _context: form_data,
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview.validate_and_compile",
            return_value=Mock(success=True),
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview."
            "generate_explore_link",
            side_effect=generate_link,
        ),
    ):
        result = update_chart_preview(request, ctx=MagicMock())

    assert result["success"] is True
    assert {
        "granularity",
        "granularity_sqla",
        "time_grain",
        "time_grain_sqla",
        "time_range",
        "since",
        "until",
    }.isdisjoint(captured)
    assert captured.get("adhoc_filters", []) == []
    assert captured["extra_filters"] == [
        {"col": "Region", "op": "IN", "val": ["North"]}
    ]
    assert captured["filters"] == [{"col": "Country", "op": "IN", "val": ["US"]}]
    assert captured["extra_form_data"] == {"custom_form_data": {"retained": True}}

    common_query = build_query_context_from_form_data(
        deepcopy(captured),
        {"id": 7, "type": "table"},
        viz_type="sunburst_v2",
    )["queries"][0]
    assert "granularity" not in common_query
    assert common_query["time_range"] == "No filter"
    assert "time_grain_sqla" not in common_query.get("extras", {})
    assert all(
        filter_.get("op") != "TEMPORAL_RANGE"
        for filter_ in common_query.get("filters", [])
    )

    factory = MagicMock()
    factory.create.return_value = object()
    with (
        patch(
            "superset.common.query_context_factory.QueryContextFactory",
            return_value=factory,
        ),
        patch(
            "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
            return_value="base",
        ),
    ):
        build_mcp_query_context_from_form_data(deepcopy(captured))
    final_query = factory.create.call_args.kwargs["queries"][0]
    assert "granularity" not in final_query
    assert "time_range" not in final_query
    assert "time_grain_sqla" not in final_query.get("extras", {})
    assert all(
        filter_.get("op") != "TEMPORAL_RANGE"
        for filter_ in final_query.get("filters", [])
    )


@pytest.mark.parametrize(
    "target_config",
    [
        TableChartConfig(columns=[{"name": "region"}]),
        PieChartConfig(
            dimension={"name": "region"},
            metric={"name": "sales", "aggregate": "SUM"},
        ),
    ],
    ids=["table", "pie"],
)
def test_cached_sunburst_cross_viz_rebind_discards_stale_identity(
    target_config: TableChartConfig | PieChartConfig,
) -> None:
    request = UpdateChartPreviewRequest(
        form_data_key="sunburst-preview",
        dataset_id=99,
        config=target_config,
        generate_preview=False,
    )
    dataset = _dataset()
    dataset.id = 99
    captured: dict[str, object] = {}

    def generate_link(
        _dataset_id: int | str,
        form_data: dict[str, object],
        *,
        prefer_permalink: bool,
    ) -> str:
        assert prefer_permalink is False
        captured.update(deepcopy(form_data))
        return "http://localhost/explore/?form_data_key=rebound-preview"

    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=Mock(id=1, username="admin", roles=[], groups=[]),
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview._find_dataset",
            return_value=dataset,
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview."
            "_get_previous_form_data",
            return_value={
                "viz_type": "sunburst_v2",
                "columns": ["Region", "Country"],
                "metric": "SavedSales",
                "datasource": "10__table",
                "slice_id": 777,
            },
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview.has_dataset_access",
            return_value=True,
        ),
        patch.object(
            DatasetValidator, "normalize_column_names", return_value=target_config
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview.validate_and_compile",
            return_value=Mock(success=True),
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview."
            "generate_explore_link",
            side_effect=generate_link,
        ),
    ):
        result = update_chart_preview(request, ctx=MagicMock())

    assert result["success"] is True
    assert captured["datasource"] == "99__table"
    assert "slice_id" not in captured


@pytest.mark.asyncio
@pytest.mark.parametrize("generate_preview", [False, True])
@pytest.mark.parametrize("source_viz", ["sunburst_v2", "pie"])
async def test_saved_update_product_paths_reject_same_and_cross_viz_orphan_grain(
    generate_preview: bool, source_viz: str
) -> None:
    dataset = _dataset()
    source_params: dict[str, object] = {
        "viz_type": source_viz,
        "time_grain_sqla": "P1M",
    }
    if source_viz == "sunburst_v2":
        source_params.update({"columns": ["Region", "Country"], "metric": "SavedSales"})
    else:
        source_params.update({"groupby": ["Region"], "metric": "SavedSales"})
    chart = Mock(
        id=19,
        datasource_id=7,
        datasource_type="table",
        datasource=dataset,
        slice_name="Saved chart",
        viz_type=source_viz,
        uuid="chart-uuid",
        params=json.dumps(source_params),
    )
    request = UpdateChartRequest(
        identifier=19,
        config=_config(),
        generate_preview=generate_preview,
    )
    context = MagicMock()
    context.info = AsyncMock()
    context.debug = AsyncMock()
    context.warning = AsyncMock()
    context.error = AsyncMock()
    context.report_progress = AsyncMock()
    update_command = MagicMock()
    create_preview = MagicMock()

    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=Mock(id=1, username="admin", roles=[], groups=[]),
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart.find_chart_by_identifier",
            return_value=chart,
        ),
        patch(
            "superset.mcp_service.auth.check_chart_data_access",
            return_value=Mock(is_valid=True, error=None),
        ),
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset),
        patch("superset.commands.chart.update.UpdateChartCommand", update_command),
        patch(
            "superset.mcp_service.chart.tool.update_chart._create_preview_url",
            create_preview,
        ),
    ):
        result = await update_chart(request=request, ctx=context)

    assert result.success is False
    assert result.error is not None
    assert result.error.error_code == "INVALID_TEMPORAL_STATE"
    update_command.assert_not_called()
    create_preview.assert_not_called()


def test_update_chart_preview_product_path_preserves_cached_sunburst_state() -> None:
    config = _config(show_labels=False)
    request = UpdateChartPreviewRequest(
        form_data_key="saved-sunburst-key",
        dataset_id=7,
        config=config,
        generate_preview=True,
        preview_formats=["table"],
    )
    dataset = _dataset()
    cached_form_data = {
        "viz_type": "sunburst_v2",
        "datasource": "7__table",
        "columns": ["old_region", "old_country"],
        "metric": "count",
        "all_columns": ["stale_raw"],
        "column": "stale_column",
        "groupby": ["stale_group"],
        "groupby_b": ["stale_secondary_group"],
        "groupbyColumns": ["stale_pivot_column"],
        "groupbyRows": ["stale_pivot_row"],
        "metrics": ["stale_metric"],
        "metrics_b": ["stale_secondary_metric"],
        "query_mode": "raw",
        "secondary_metric": "stale_secondary_singular_metric",
        "series": "stale_series",
        "x_axis": "stale_x",
        "color_scheme": "savedScheme",
        "show_labels": True,
        "show_total": True,
        "adhoc_filters": [{"subject": "status"}],
        "plugin_only_ui_state": {"kept": True},
    }
    captured_form_data: dict[str, object] = {}
    command = MagicMock()
    command.run.return_value = chart_data_command_result(
        [{"Region": "Americas", "Country": "Brazil", "Sales": 10}],
        columns=["Region", "Country", "Sales"],
        coltypes=[
            GenericDataType.STRING,
            GenericDataType.STRING,
            GenericDataType.NUMERIC,
        ],
    )

    def generate_link(
        dataset_id: int | str,
        form_data: dict[str, object],
        prefer_permalink: bool,
    ) -> str:
        assert dataset_id == 7
        assert prefer_permalink is False
        captured_form_data.update(form_data)
        return "http://localhost/explore/?form_data_key=new-sunburst-key"

    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=Mock(id=1, username="admin", roles=[], groups=[]),
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview._find_dataset",
            return_value=dataset,
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview."
            "_get_previous_form_data",
            return_value=cached_form_data,
        ),
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview.has_dataset_access",
            return_value=True,
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview.validate_and_compile",
            return_value=Mock(success=True),
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview."
            "generate_explore_link",
            side_effect=generate_link,
        ),
        patch(
            "superset.mcp_service.chart.chart_helpers."
            "build_query_context_from_form_data",
            return_value=object(),
        ),
        patch("superset.extensions.db.session.get", return_value=dataset),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand",
            return_value=command,
        ),
    ):
        result = update_chart_preview(request, ctx=MagicMock())

    assert result["success"] is True
    assert result["previews"]["table"]["row_count"] == 1
    assert result["form_data_key"] == "new-sunburst-key"
    assert result["chart"]["viz_type"] == "sunburst_v2"
    assert captured_form_data["columns"] == ["Region", "Country"]
    metric = captured_form_data["metric"]
    filters = captured_form_data["adhoc_filters"]
    assert isinstance(metric, dict)
    assert isinstance(filters, list)
    assert metric["column"] == {"column_name": "Sales"}
    assert filters[0]["subject"] == "Status"
    assert captured_form_data["show_labels"] is False
    assert captured_form_data["show_total"] is True
    assert captured_form_data["color_scheme"] == "savedScheme"
    assert captured_form_data["plugin_only_ui_state"] == {"kept": True}
    role_keys = get_registry().query_role_keys_for_viz_type("sunburst_v2")
    assert (role_keys - {"columns", "metric"}).isdisjoint(captured_form_data)


def test_cached_mixed_timeseries_update_preserves_native_controls() -> None:
    """Cached preview updates use the same same-viz preservation contract."""
    config = MixedTimeseriesChartConfig(
        x=ColumnRef(name="OrderDate"),
        y=[ColumnRef(name="Sales", aggregate="SUM")],
        y_secondary=[ColumnRef(name="Profit", aggregate="SUM")],
        show_value=False,
    )
    request = UpdateChartPreviewRequest(
        form_data_key="mixed-key",
        dataset_id=7,
        config=config,
        generate_preview=False,
    )
    captured: dict[str, object] = {}

    def generate_link(
        _dataset_id: int | str,
        form_data: dict[str, object],
        *,
        prefer_permalink: bool,
    ) -> str:
        assert prefer_permalink is False
        captured.update(deepcopy(form_data))
        return "http://localhost/explore/?form_data_key=mixed-next"

    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=Mock(id=1, username="admin", roles=[], groups=[]),
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview._find_dataset",
            return_value=_dataset(),
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview."
            "_get_previous_form_data",
            return_value={
                "viz_type": "mixed_timeseries",
                "datasource": "7__table",
                "metrics": ["OldSales"],
                "metrics_b": ["OldProfit"],
                "query_mode": "raw",
                "all_columns": ["OldRaw"],
                "columns": ["OldColumns"],
                "metric": "OldSingular",
                "secondary_metric": "OldSecondarySingular",
                "series": "OldSeries",
                "time_compare": ["1 year ago"],
                "comparison_type_b": "percentage",
                "show_value": True,
                "y_axis_format": ",.2f",
            },
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview.has_dataset_access",
            return_value=True,
        ),
        patch.object(DatasetValidator, "normalize_column_names", return_value=config),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview.validate_and_compile",
            return_value=Mock(success=True),
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview."
            "generate_explore_link",
            side_effect=generate_link,
        ),
    ):
        result = update_chart_preview(request, ctx=MagicMock())

    assert result["success"] is True
    assert captured["time_compare"] == ["1 year ago"]
    assert captured["comparison_type_b"] == "percentage"
    assert captured["y_axis_format"] == ",.2f"
    assert "show_value" not in captured
    assert captured["metrics"] != ["OldSales"]
    assert captured["metrics_b"] != ["OldProfit"]
    assert {
        "all_columns",
        "columns",
        "metric",
        "query_mode",
        "secondary_metric",
        "series",
    }.isdisjoint(captured)


def test_cached_update_deletes_explicit_null_mapping_envelopes() -> None:
    config = _config(
        extra_form_data=None,
        url_params=None,
        standardized_form_data=None,
    )
    request = UpdateChartPreviewRequest(
        form_data_key="mapping-key",
        dataset_id=7,
        config=config,
        generate_preview=False,
    )
    captured: dict[str, object] = {}

    def generate_link(
        _dataset_id: int | str,
        form_data: dict[str, object],
        *,
        prefer_permalink: bool,
    ) -> str:
        captured.update(deepcopy(form_data))
        return "http://localhost/explore/?form_data_key=mapping-next"

    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=Mock(id=1, username="admin", roles=[], groups=[]),
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview._find_dataset",
            return_value=_dataset(),
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview."
            "_get_previous_form_data",
            return_value={
                "viz_type": "sunburst_v2",
                "extra_form_data": {"filters": []},
                "url_params": {"tenant": "acme"},
                "standardizedFormData": {"controls": {}},
            },
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview.has_dataset_access",
            return_value=True,
        ),
        patch.object(DatasetValidator, "normalize_column_names", return_value=config),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview.validate_and_compile",
            return_value=Mock(success=True),
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview."
            "normalize_sunburst_form_data_references",
            side_effect=lambda form_data, _context: form_data,
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview."
            "generate_explore_link",
            side_effect=generate_link,
        ),
    ):
        result = update_chart_preview(request, ctx=MagicMock())

    assert result["success"] is True
    assert {
        "extra_form_data",
        "url_params",
        "standardizedFormData",
    }.isdisjoint(captured)


def test_unsaved_preview_validates_query_envelopes_and_all_rows() -> None:
    form_data = map_config_to_form_data(_config())
    command = MagicMock()
    command.run.return_value = {
        "queries": [
            {
                "status": "success",
                "data": [
                    {"region": "A", "country": "B", "Sales": 1},
                    {"region": "C", "country": "D", "Sales": "bad"},
                ],
            }
        ]
    }
    with (
        patch("superset.extensions.db.session.get", return_value=Mock(id=7)),
        patch(
            "superset.mcp_service.chart.chart_helpers."
            "build_query_context_from_form_data",
            return_value=object(),
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand",
            return_value=command,
        ),
    ):
        result = generate_preview_from_form_data(form_data, 7, "ascii")

    assert isinstance(result, ChartError)
    assert result.error_type == "InvalidSunburstMetric"

    command.run.return_value = {
        "status": "failed",
        "message": "warehouse timeout",
        "queries": [],
    }
    with (
        patch("superset.extensions.db.session.get", return_value=Mock(id=7)),
        patch(
            "superset.mcp_service.chart.chart_helpers."
            "build_query_context_from_form_data",
            return_value=object(),
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand",
            return_value=command,
        ),
    ):
        failure = generate_preview_from_form_data(form_data, 7, "table")

    assert isinstance(failure, ChartError)
    assert failure.error_type == "QueryError"
    assert "warehouse timeout" in failure.error


def test_saved_preview_is_sunburst_faithful_and_vega_is_unsupported() -> None:
    form_data = map_config_to_form_data(
        _config(metric={"sql_expression": "SUM(sales)", "label": "SQL Sales"})
    )
    chart = Mock(
        id=11,
        slice_name="Hierarchy",
        viz_type="sunburst_v2",
        datasource_id=7,
        datasource_type="table",
        params=json.dumps(form_data),
    )
    request = GetChartPreviewRequest(identifier=11, format="ascii")
    command = MagicMock()
    command.run.return_value = {
        "queries": [
            {
                "data": [
                    {
                        "region": "Americas",
                        "country": "Brazil",
                        "SQL Sales": 10,
                    }
                ]
            }
        ]
    }
    with (
        patch(
            "superset.mcp_service.chart.tool.get_chart_preview."
            "build_query_context_from_form_data",
            return_value=object(),
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand",
            return_value=command,
        ),
    ):
        ascii_result = ASCIIPreviewStrategy(chart, request).generate()

    assert not isinstance(ascii_result, ChartError)
    assert "Americas > Brazil" in ascii_result.ascii_content
    assert "SQL Sales=10" in ascii_result.ascii_content

    vega_result = VegaLitePreviewStrategy(
        chart, GetChartPreviewRequest(identifier=11, format="vega_lite")
    ).generate()
    assert isinstance(vega_result, ChartError)
    assert vega_result.error_type == "UnsupportedFormat"
    command.run.assert_called_once()


@pytest.mark.asyncio
async def test_generate_chart_product_path_returns_sunburst_preview() -> None:
    request = GenerateChartRequest(
        dataset_id=7,
        config=_frontend_native_config(),
        preview_formats=["url"],
    )
    context = MagicMock()
    context.info = AsyncMock()
    context.debug = AsyncMock()
    context.warning = AsyncMock()
    context.error = AsyncMock()
    context.report_progress = AsyncMock()
    validation_result = Mock(
        is_valid=True,
        request=request,
        warnings={},
        error=None,
    )
    user = Mock(id=1, username="admin", roles=[], groups=[])

    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=user,
        ),
        patch(
            "superset.mcp_service.chart.validation.ValidationPipeline."
            "validate_request_with_warnings",
            return_value=validation_result,
        ),
        patch(
            "superset.mcp_service.chart.chart_utils.generate_explore_link",
            return_value="http://localhost/explore/?form_data_key=sunburst-key",
        ),
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=None),
    ):
        result = await generate_chart(request, ctx=context)

    assert result.success is True
    assert result.chart is None  # Preview-only requests do not persist a chart.
    assert result.form_data is not None
    assert result.form_data["viz_type"] == "sunburst_v2"
    assert result.form_data["columns"] == ["region", "country"]
    assert result.form_data_key == "sunburst-key"


@pytest.mark.asyncio
@pytest.mark.parametrize("input_slice_id", [404, 999999])
async def test_unsaved_generate_ignores_native_chart_and_datasource_identity(
    input_slice_id: int,
) -> None:
    """Missing/deleted/inaccessible native IDs cannot change subsequent Save."""
    request = GenerateChartRequest(
        dataset_id=7,
        config=_config(datasource="10__table", slice_id=input_slice_id),
        preview_formats=["url"],
    )
    context = MagicMock()
    context.info = AsyncMock()
    context.debug = AsyncMock()
    context.warning = AsyncMock()
    context.error = AsyncMock()
    context.report_progress = AsyncMock()
    validation_result = Mock(
        is_valid=True,
        request=request,
        warnings={},
        error=None,
    )
    generate_link = MagicMock(
        return_value="http://localhost/explore/?form_data_key=new-chart-key"
    )

    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=Mock(id=1, username="admin", roles=[], groups=[]),
        ),
        patch(
            "superset.mcp_service.chart.validation.ValidationPipeline."
            "validate_request_with_warnings",
            return_value=validation_result,
        ),
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=_dataset()),
        patch(
            "superset.mcp_service.chart.tool.generate_chart.has_dataset_access",
            return_value=True,
        ),
        patch(
            "superset.mcp_service.chart.tool.generate_chart._compile_chart",
            return_value=CompileResult(success=True),
        ),
        patch(
            "superset.mcp_service.chart.chart_utils.generate_explore_link",
            generate_link,
        ),
    ):
        result = await generate_chart(request, ctx=context)

    assert result.success is True
    assert result.form_data is not None
    assert result.form_data["datasource"] == "7__table"
    assert "slice_id" not in result.form_data
    assert "slice_id=" not in (result.explore_url or "")
    cached_form_data = generate_link.call_args.args[1]
    assert cached_form_data["datasource"] == "7__table"
    assert "slice_id" not in cached_form_data


@pytest.mark.asyncio
async def test_saved_generate_assigns_only_the_new_chart_identity() -> None:
    request = GenerateChartRequest(
        dataset_id=7,
        config=_frontend_native_config(datasource="10__table", slice_id=404),
        chart_name="New hierarchy",
        save_chart=True,
        generate_preview=False,
    )
    context = MagicMock()
    context.info = AsyncMock()
    context.debug = AsyncMock()
    context.warning = AsyncMock()
    context.error = AsyncMock()
    context.report_progress = AsyncMock()
    validation_result = Mock(
        is_valid=True,
        request=request,
        warnings={},
        error=None,
    )
    dataset = _dataset()
    chart = Mock(
        id=88,
        slice_name="New hierarchy",
        viz_type="sunburst_v2",
        uuid="00000000-0000-4000-8000-000000000088",
        datasource_id=7,
    )
    create_command = MagicMock()
    create_command.return_value.run.return_value = chart
    cache_command = MagicMock()
    cache_command.return_value.run.return_value = "saved-form-data-key"

    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=Mock(id=1, username="admin", roles=[], groups=[]),
        ),
        patch(
            "superset.mcp_service.chart.validation.ValidationPipeline."
            "validate_request_with_warnings",
            return_value=validation_result,
        ),
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset),
        patch(
            "superset.mcp_service.chart.tool.generate_chart.has_dataset_access",
            return_value=True,
        ),
        patch(
            "superset.mcp_service.chart.tool.generate_chart._compile_chart",
            return_value=CompileResult(success=True),
        ),
        patch("superset.commands.chart.create.CreateChartCommand", create_command),
        patch(
            "superset.mcp_service.chart.tool.generate_chart.validate_chart_dataset",
            return_value=Mock(is_valid=True, warnings=[], error=None),
        ),
        patch(
            "superset.mcp_service.commands.create_form_data.MCPCreateFormDataCommand",
            cache_command,
        ),
        patch("superset.db.session.refresh"),
        patch(
            "superset.daos.chart.ChartDAO.find_by_id",
            side_effect=SQLAlchemyError("detached"),
        ),
    ):
        result = await generate_chart(request, ctx=context)

    assert result.success is True
    create_payload = create_command.call_args.args[0]
    persisted = json.loads(create_payload["params"])
    assert persisted["datasource"] == "7__table"
    assert "slice_id" not in persisted

    cache_params = cache_command.call_args.args[0]
    cached = json.loads(cache_params.form_data)
    assert cache_params.chart_id == 88
    assert cached["datasource"] == "7__table"
    assert cached["slice_id"] == 88
    assert result.form_data is not None
    assert result.form_data["slice_id"] == 88
    assert result.explore_url is not None
    assert result.explore_url.endswith("/explore/?slice_id=88")


@pytest.mark.asyncio
async def test_generate_chart_rejects_orphan_grain_before_caching_preview() -> None:
    request = GenerateChartRequest(
        dataset_id=7,
        config=_config(time_grain="P1M"),
        preview_formats=["url"],
    )
    context = MagicMock()
    context.info = AsyncMock()
    context.debug = AsyncMock()
    context.warning = AsyncMock()
    context.error = AsyncMock()
    context.report_progress = AsyncMock()
    validation_result = Mock(
        is_valid=True,
        request=request,
        warnings={},
        error=None,
    )
    generate_link = MagicMock(
        return_value="http://localhost/explore/?form_data_key=unexpected"
    )

    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=Mock(id=1, username="admin", roles=[], groups=[]),
        ),
        patch(
            "superset.mcp_service.chart.validation.ValidationPipeline."
            "validate_request_with_warnings",
            return_value=validation_result,
        ),
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=_dataset()),
        patch(
            "superset.mcp_service.chart.tool.generate_chart.has_dataset_access",
            return_value=True,
        ),
        patch(
            "superset.mcp_service.chart.chart_utils.generate_explore_link",
            generate_link,
        ),
    ):
        result = await generate_chart(request, ctx=context)

    assert result.success is False
    assert result.error is not None
    assert result.error.error_code == "INVALID_TEMPORAL_STATE"
    generate_link.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "source_viz,source_params",
    [
        ("pie", {"groupby": ["old_region"], "metric": "old_count"}),
        (
            "echarts_timeseries_line",
            {
                "x_axis": "old_date",
                "groupby": ["old_series"],
                "metrics": ["old_xy_metric"],
            },
        ),
        (
            "table",
            {
                "query_mode": "raw",
                "all_columns": ["old_table_column"],
                "metrics": ["old_table_metric"],
            },
        ),
    ],
    ids=["pie", "xy", "table"],
)
async def test_cross_viz_preview_update_and_immediate_save_report_sunburst_state(
    source_viz: str, source_params: dict[str, object]
) -> None:
    chart = Mock(
        id=19,
        datasource_id=7,
        datasource_type="table",
        slice_name="Source chart",
        viz_type=source_viz,
        uuid="chart-uuid",
        params=json.dumps({"viz_type": source_viz, **source_params}),
    )
    config = _frontend_native_config()
    context = MagicMock()
    context.warning = AsyncMock()
    context.error = AsyncMock()
    access = Mock(is_valid=True, error=None)

    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=Mock(id=1, username="admin", roles=[], groups=[]),
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart.find_chart_by_identifier",
            return_value=chart,
        ),
        patch("superset.mcp_service.auth.check_chart_data_access", return_value=access),
        patch.object(DatasetValidator, "normalize_column_names", return_value=config),
        patch(
            "superset.mcp_service.chart.tool.update_chart."
            "_validate_update_against_dataset",
            return_value=None,
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart._create_preview_url",
            return_value=(
                "http://localhost/explore/?form_data_key=cross-viz-key&slice_id=19",
                "cross-viz-key",
                [],
            ),
        ),
    ):
        preview = await update_chart(
            request=UpdateChartRequest(identifier=19, config=config), ctx=context
        )

    assert preview.success is True
    assert preview.chart is not None
    assert preview.chart.viz_type == "sunburst_v2"
    assert preview.form_data["viz_type"] == "sunburst_v2"
    assert preview.form_data["columns"] == ["region", "country"]

    dataset = _dataset()
    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=Mock(id=1, username="admin", roles=[], groups=[]),
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview._find_dataset",
            return_value=dataset,
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview.has_dataset_access",
            return_value=True,
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview."
            "_get_previous_form_data",
            return_value=preview.form_data,
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview.validate_and_compile",
            return_value=Mock(success=True),
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview."
            "generate_explore_link",
            return_value="http://localhost/explore/?form_data_key=updated-key",
        ),
    ):
        updated_preview = update_chart_preview(
            request=UpdateChartPreviewRequest(
                form_data_key="cross-viz-key",
                dataset_id=7,
                config=_config(show_total=True),
                generate_preview=False,
            ),
            ctx=MagicMock(),
        )

    assert updated_preview["success"] is True
    assert updated_preview["chart"]["viz_type"] == "sunburst_v2"

    updated_chart = Mock(
        id=19,
        datasource_id=7,
        datasource_type="table",
        slice_name="Old pie",
        viz_type="sunburst_v2",
        uuid="chart-uuid",
    )
    update_command = Mock()
    update_command.run.return_value = updated_chart
    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=Mock(id=1, username="admin", roles=[], groups=[]),
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart.find_chart_by_identifier",
            return_value=chart,
        ),
        patch("superset.mcp_service.auth.check_chart_data_access", return_value=access),
        patch.object(DatasetValidator, "normalize_column_names", return_value=config),
        patch(
            "superset.mcp_service.chart.tool.update_chart."
            "_validate_update_against_dataset",
            return_value=None,
        ),
        patch(
            "superset.commands.chart.update.UpdateChartCommand",
            return_value=update_command,
        ),
    ):
        saved = await update_chart(
            request=UpdateChartRequest(
                identifier=19,
                config=config,
                generate_preview=False,
                preview_formats=[],
            ),
            ctx=context,
        )

    assert saved.success is True
    assert saved.chart is not None
    assert saved.chart.viz_type == "sunburst_v2"
    assert saved.form_data["viz_type"] == "sunburst_v2"
