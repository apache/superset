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

"""Product-path coverage for typed ECharts Bullet MCP support."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import TypeAdapter, ValidationError

from superset.mcp_service.chart.chart_helpers import (
    build_query_dicts_from_form_data,
)
from superset.mcp_service.chart.chart_utils import (
    map_bullet_config,
    map_config_to_form_data,
)
from superset.mcp_service.chart.compile import _compile_chart
from superset.mcp_service.chart.preview_utils import (
    _generate_vega_lite_preview_from_data,
    generate_preview_from_form_data,
)
from superset.mcp_service.chart.schemas import (
    BulletChartConfig,
    ChartConfig,
    ChartError,
    DataColumn,
    GenerateChartRequest,
    GetChartPreviewRequest,
    UpdateChartPreviewRequest,
    UpdateChartRequest,
)
from superset.mcp_service.chart.tool.generate_chart import generate_chart
from superset.mcp_service.chart.tool.get_chart_data import (
    _candidates_single_numeric,
    _VIZ_CATEGORY,
)
from superset.mcp_service.chart.tool.get_chart_preview import VegaLitePreviewStrategy
from superset.mcp_service.chart.tool.get_chart_type_schema import (
    _get_chart_type_schema_impl,
    VALID_CHART_TYPES,
)
from superset.mcp_service.chart.tool.update_chart import (
    _build_preview_form_data,
    _build_update_payload,
    update_chart,
)
from superset.mcp_service.chart.tool.update_chart_preview import update_chart_preview
from superset.mcp_service.chart.validation.dataset_validator import DatasetValidator
from superset.mcp_service.common.error_schemas import DatasetContext


def _simple_metric(name: str = "revenue") -> dict[str, str]:
    return {"name": name, "aggregate": "SUM"}


def _tool_user() -> SimpleNamespace:
    return SimpleNamespace(id=1, username="admin", roles=[], groups=[])


def test_bullet_discriminated_union_uses_exact_tag() -> None:
    config = TypeAdapter(ChartConfig).validate_python(
        {"chart_type": "bullet", "metric": _simple_metric()}
    )
    assert isinstance(config, BulletChartConfig)
    with pytest.raises(ValidationError):
        TypeAdapter(ChartConfig).validate_python(
            {"chart_type": "bullet_chart", "metric": _simple_metric()}
        )


@pytest.mark.parametrize(
    "metric",
    [
        {"name": "revenue", "aggregate": "SUM", "label": "Revenue"},
        {"name": "saved_revenue", "saved_metric": True},
        {"sql_expression": "SUM(revenue) / COUNT(*)", "label": "Average"},
    ],
)
def test_bullet_accepts_simple_saved_and_sql_metrics(metric: dict[str, object]) -> None:
    config = BulletChartConfig(metric=metric)
    form_data = map_bullet_config(config)
    assert form_data["viz_type"] == "bullet"
    assert form_data["metric"]


def test_bullet_native_form_data_round_trip_is_semantically_stable() -> None:
    native = {
        "viz_type": "bullet",
        "datasource": "7__table",
        "metric": {
            "aggregate": "SUM",
            "column": {"column_name": "Revenue"},
            "expressionType": "SIMPLE",
            "label": "Total Revenue",
        },
        "groupby": ["Region", "Team"],
        "ranges": "100,250,500",
        "range_labels": "Minimum,Target,Stretch",
        "markers": "300",
        "marker_labels": "Plan",
        "marker_lines": "400",
        "marker_line_labels": "Forecast",
        "y_axis_format": "$,.0f",
        "show_labels": False,
        "show_legend": True,
        "row_limit": 250,
        "orderby": [["Region", True], ["Total Revenue", False]],
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "expressionType": "SIMPLE",
                "subject": "Status",
                "operator": "==",
                "comparator": "Active",
            }
        ],
    }
    config = BulletChartConfig.model_validate(native)
    mapped = map_bullet_config(config)

    assert mapped["metric"]["label"] == "Total Revenue"
    assert mapped["groupby"] == ["Region", "Team"]
    assert mapped["ranges"] == "100,250,500"
    assert mapped["range_labels"] == "Minimum,Target,Stretch"
    assert mapped["markers"] == "300"
    assert mapped["marker_lines"] == "400"
    assert mapped["show_labels"] is False
    assert mapped["show_legend"] is True
    assert mapped["orderby"][0] == ["Region", True]
    assert mapped["orderby"][1][0]["label"] == "Total Revenue"
    assert mapped["adhoc_filters"][0]["subject"] == "Status"


def test_bullet_native_saved_metric_and_legacy_metric_aliases() -> None:
    saved = BulletChartConfig.model_validate(
        {"viz_type": "bullet", "metric": "saved_revenue"}
    )
    legacy = BulletChartConfig.model_validate(
        {"viz_type": "bullet", "metric": "sum__revenue"}
    )
    assert saved.metric.saved_metric is True
    assert saved.metric.name == "saved_revenue"
    assert legacy.metric.name == "revenue"
    assert legacy.metric.aggregate == "SUM"


def test_bullet_rejects_invalid_roles_and_output_collisions() -> None:
    with pytest.raises(ValidationError, match="physical dimension"):
        BulletChartConfig(
            metric=_simple_metric(),
            dimensions=[{"name": "region", "aggregate": "COUNT"}],
        )
    with pytest.raises(ValidationError, match="Duplicate Bullet dimension"):
        BulletChartConfig(
            metric=_simple_metric(),
            dimensions=[{"name": "Region"}, {"name": "region"}],
        )
    with pytest.raises(ValidationError, match="conflicts with a dimension"):
        BulletChartConfig(
            metric={"name": "revenue", "aggregate": "SUM", "label": "Region"},
            dimensions=[{"name": "region", "label": "Region"}],
        )


def test_bullet_rejects_misaligned_labels_and_bad_order_target() -> None:
    with pytest.raises(ValidationError, match="one label per ranges"):
        BulletChartConfig(
            metric=_simple_metric(), ranges=[1, 2], range_labels=["Only one"]
        )
    with pytest.raises(ValidationError, match="unknown: not_a_role"):
        BulletChartConfig(metric=_simple_metric(), order_by=[{"column": "not_a_role"}])


def test_bullet_mapper_preserves_omission_and_honors_explicit_values() -> None:
    omitted = map_bullet_config(BulletChartConfig(metric=_simple_metric()))
    explicit = map_bullet_config(
        BulletChartConfig(
            metric=_simple_metric(),
            dimensions=[],
            filters=[],
            ranges=[],
            show_labels=False,
            show_legend=False,
            row_limit=42,
            time_range=None,
        )
    )
    for key in (
        "groupby",
        "adhoc_filters",
        "ranges",
        "show_labels",
        "show_legend",
        "row_limit",
        "time_range",
    ):
        assert key not in omitted
    assert explicit["groupby"] == []
    assert explicit["adhoc_filters"] == []
    assert explicit["ranges"] == ""
    assert explicit["show_labels"] is False
    assert explicit["show_legend"] is False
    assert explicit["row_limit"] == 42
    assert explicit["time_range"] is None


def test_bullet_registry_schema_and_recommendation_metadata() -> None:
    from superset.mcp_service.chart.registry import display_name_for_viz_type, get

    plugin = get("bullet")
    assert plugin is not None
    assert plugin.resolve_viz_type(None) == "bullet"
    assert display_name_for_viz_type("bullet") == "Bullet Chart"
    assert "bullet" in VALID_CHART_TYPES
    discovered = _get_chart_type_schema_impl("bullet")
    assert discovered["chart_type"] == "bullet"
    assert discovered["examples"][0]["ranges"] == [100000, 250000, 500000]
    assert _VIZ_CATEGORY["bullet"] == "bullet"
    candidates = _candidates_single_numeric(
        DataColumn(
            name="Revenue",
            display_name="Revenue",
            data_type="numeric",
            sample_values=[1],
            null_count=0,
            unique_count=1,
        ),
        row_count=1,
    )
    assert "bullet chart" in candidates


def test_bullet_dataset_normalization_canonicalizes_every_reference() -> None:
    from superset.mcp_service.chart.registry import get

    context = DatasetContext(
        id=7,
        table_name="sales",
        schema=None,
        database_name="main",
        available_columns=[
            {"name": "Revenue", "type": "NUMERIC", "is_numeric": True},
            {"name": "Region", "type": "VARCHAR"},
            {"name": "OrderDate", "type": "TIMESTAMP", "is_temporal": True},
            {"name": "Status", "type": "VARCHAR"},
        ],
        available_metrics=[],
    )
    config = BulletChartConfig(
        metric={"name": "revenue", "aggregate": "SUM"},
        dimensions=[{"name": "region"}],
        temporal_column="orderdate",
        filters=[{"column": "status", "op": "=", "value": "active"}],
        order_by=[{"column": "region", "ascending": True}],
    )
    plugin = get("bullet")
    assert plugin is not None
    normalized = plugin.normalize_column_refs(config, context)
    assert normalized.metric.name == "Revenue"
    assert normalized.dimensions[0].name == "Region"
    assert normalized.temporal_column == "OrderDate"
    assert normalized.filters[0].column == "Status"
    assert normalized.order_by[0].column == "Region"
    assert normalized.model_fields_set == config.model_fields_set


def test_bullet_numeric_output_constraint_rejects_text_min() -> None:
    from superset.mcp_service.chart.registry import get

    context = DatasetContext(
        id=7,
        table_name="sales",
        schema=None,
        database_name="main",
        available_columns=[{"name": "status", "type": "VARCHAR"}],
        available_metrics=[],
    )
    plugin = get("bullet")
    assert plugin is not None
    config = BulletChartConfig(metric={"name": "status", "aggregate": "MIN"})
    with patch.object(DatasetValidator, "_get_dataset_context", return_value=context):
        error = plugin.post_map_validate(config, {}, dataset_id=7)
    assert error is not None
    assert error.error_type == "non_numeric_bullet_metric"


def test_bullet_shared_query_builder_matches_frontend_build_query() -> None:
    metric = map_bullet_config(
        BulletChartConfig(
            metric={"name": "Revenue", "aggregate": "SUM", "label": "Revenue"},
            dimensions=[{"name": "Region"}],
            row_limit=25,
            order_by=[{"column": "Revenue", "ascending": False}],
        )
    )
    with patch(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        return_value="base",
    ):
        queries = build_query_dicts_from_form_data(metric, 7, "table")
    assert len(queries) == 1
    assert queries[0]["columns"] == ["Region"]
    assert queries[0]["metrics"] == [metric["metric"]]
    assert queries[0]["orderby"] == metric["orderby"]
    assert queries[0]["row_limit"] == 25


def test_bullet_compile_path_uses_groupby_metric_orderby_and_empty_results() -> None:
    form_data = map_bullet_config(
        BulletChartConfig(
            metric={"name": "Revenue", "aggregate": "SUM", "label": "Revenue"},
            dimensions=[{"name": "Region"}],
            order_by=[{"column": "Revenue", "ascending": False}],
        )
    )
    context = MagicMock()
    factory = MagicMock()
    factory.create.return_value = context
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
    query = factory.create.call_args.kwargs["queries"][0]
    assert query["columns"] == ["Region"]
    assert query["metrics"] == [form_data["metric"]]
    assert query["orderby"] == form_data["orderby"]
    assert result.success is True
    assert result.row_count == 0


def test_bullet_unsaved_preview_path_returns_faithful_vega_spec() -> None:
    form_data = map_bullet_config(
        BulletChartConfig(
            metric={
                "name": "revenue_amount",
                "aggregate": "SUM",
                "label": "Total Revenue",
            },
            dimensions=[{"name": "Region"}, {"name": "Team"}],
            ranges=[100, 200],
            markers=[150],
            marker_lines=[175],
        )
    )
    preview = _generate_vega_lite_preview_from_data(
        [{"Region": "North", "Team": "Blue", "Total Revenue": 123}], form_data
    )
    specification = preview.specification
    assert specification["data"]["values"][0]["__mcp_bullet_category"] == (
        "North, Blue"
    )
    bar_layer = next(
        layer for layer in specification["layer"] if layer["mark"]["type"] == "bar"
    )
    assert bar_layer["encoding"]["x"]["field"] == "Total Revenue"
    assert bar_layer["encoding"]["y"]["field"] == "__mcp_bullet_category"
    assert [item["field"] for item in bar_layer["encoding"]["tooltip"]] == [
        "Region",
        "Team",
        "Total Revenue",
    ]
    assert {layer["mark"]["type"] for layer in specification["layer"]} == {
        "rect",
        "bar",
        "point",
        "rule",
    }


def test_bullet_unsaved_preview_handles_empty_and_error_results() -> None:
    dataset = SimpleNamespace(id=7)
    factory = MagicMock()
    factory.create.return_value = MagicMock()
    command = MagicMock()
    command.run.return_value = {"queries": []}
    with (
        patch("superset.extensions.db.session.get", return_value=dataset),
        patch(
            "superset.common.query_context_factory.QueryContextFactory",
            return_value=factory,
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand",
            return_value=command,
        ),
    ):
        result = generate_preview_from_form_data(
            {"viz_type": "bullet", "metric": "count"}, 7, "table"
        )
    assert isinstance(result, ChartError)
    assert result.error_type == "EmptyResult"


def test_bullet_saved_preview_uses_native_roles_aliases_and_overlays() -> None:
    form_data = {
        "viz_type": "bullet",
        "metric": {
            "aggregate": "SUM",
            "column": {"column_name": "revenue_amount"},
            "expressionType": "SIMPLE",
            "label": "Total Revenue",
        },
        "groupby": ["Region", "Team"],
        "ranges": "100,250",
        "markers": "200",
        "marker_lines": "225",
    }
    chart = SimpleNamespace(
        id=9,
        params=__import__("json").dumps(form_data),
        viz_type="bullet",
        slice_name="Saved Bullet",
    )
    strategy = VegaLitePreviewStrategy(
        chart,
        GetChartPreviewRequest(identifier=9, format="vega_lite"),
    )
    specification = strategy._create_vega_lite_spec(
        [{"Region": "North", "Team": "Blue", "Total Revenue": 123}]
    )

    assert "Region" in specification["transform"][0]["calculate"]
    assert "Team" in specification["transform"][0]["calculate"]
    bar_layer = next(
        layer for layer in specification["layer"] if layer["mark"]["type"] == "bar"
    )
    assert bar_layer["encoding"]["x"]["field"] == "Total Revenue"
    assert bar_layer["encoding"]["y"]["field"] == "__mcp_bullet_category"
    assert {layer["mark"]["type"] for layer in specification["layer"]} == {
        "rect",
        "bar",
        "point",
        "rule",
    }


def test_bullet_update_paths_preserve_omitted_native_state() -> None:
    existing = {
        "viz_type": "bullet",
        "metric": "old_metric",
        "groupby": ["Region"],
        "ranges": "10,20",
        "markers": "15",
        "show_labels": True,
        "show_legend": True,
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "expressionType": "SIMPLE",
                "subject": "Status",
                "operator": "==",
                "comparator": "Active",
            }
        ],
    }
    chart = SimpleNamespace(
        id=9,
        datasource_id=7,
        slice_name="Saved Bullet",
        params=__import__("json").dumps(existing),
    )
    request = UpdateChartRequest(
        identifier=9,
        config=BulletChartConfig(metric=_simple_metric("NewRevenue")),
        generate_preview=False,
    )
    payload = _build_update_payload(request, chart, request.config)
    assert isinstance(payload, dict)
    persisted = __import__("json").loads(payload["params"])
    assert persisted["metric"]["column"]["column_name"] == "NewRevenue"
    assert persisted["groupby"] == ["Region"]
    assert persisted["ranges"] == "10,20"
    assert persisted["markers"] == "15"
    assert persisted["show_labels"] is True
    assert persisted["adhoc_filters"] == existing["adhoc_filters"]

    preview = _build_preview_form_data(request, chart, request.config)
    assert isinstance(preview, dict)
    assert preview["ranges"] == "10,20"
    assert preview["show_legend"] is True


def test_bullet_update_paths_honor_explicit_clear_and_false() -> None:
    existing = {
        "viz_type": "bullet",
        "metric": "old_metric",
        "groupby": ["Region"],
        "ranges": "10,20",
        "show_labels": True,
        "adhoc_filters": [{"subject": "Status"}],
    }
    chart = SimpleNamespace(
        id=9,
        datasource_id=7,
        slice_name="Saved Bullet",
        params=__import__("json").dumps(existing),
    )
    config = BulletChartConfig(
        metric=_simple_metric(),
        dimensions=[],
        filters=[],
        ranges=[],
        show_labels=False,
    )
    request = UpdateChartRequest(identifier=9, config=config, generate_preview=False)
    payload = _build_update_payload(request, chart, config)
    assert isinstance(payload, dict)
    persisted = __import__("json").loads(payload["params"])
    assert persisted["groupby"] == []
    assert persisted["ranges"] == ""
    assert persisted["show_labels"] is False
    assert persisted["adhoc_filters"] == []


def test_mapping_other_registered_chart_type_is_unchanged() -> None:
    from superset.mcp_service.chart.schemas import PieChartConfig

    form_data = map_config_to_form_data(
        PieChartConfig(dimension={"name": "region"}, metric=_simple_metric("revenue"))
    )
    assert form_data["viz_type"] == "pie"
    assert form_data["groupby"] == ["region"]


@pytest.mark.asyncio
async def test_generate_chart_tool_emits_native_bullet_form_data() -> None:
    request = GenerateChartRequest(
        dataset_id=7,
        config=BulletChartConfig(
            metric={"name": "Revenue", "aggregate": "SUM", "label": "Revenue"},
            dimensions=[{"name": "Region"}],
            ranges=[100, 250],
            markers=[200],
        ),
        preview_formats=["url"],
    )
    validation_result = SimpleNamespace(
        is_valid=True,
        request=request,
        warnings={},
        error=None,
    )
    ctx = MagicMock()
    ctx.info = AsyncMock()
    ctx.debug = AsyncMock()
    ctx.warning = AsyncMock()
    ctx.error = AsyncMock()
    ctx.report_progress = AsyncMock()
    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=_tool_user(),
        ),
        patch(
            "superset.mcp_service.chart.validation.ValidationPipeline."
            "validate_request_with_warnings",
            return_value=validation_result,
        ),
        patch(
            "superset.mcp_service.chart.chart_utils.generate_explore_link",
            return_value=(
                "http://localhost:8088/explore/?form_data_key=bullet_preview_key"
            ),
        ),
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=None),
    ):
        result = await generate_chart(request, ctx=ctx)

    assert result.success is True
    assert result.form_data["viz_type"] == "bullet"
    assert result.form_data["groupby"] == ["Region"]
    assert result.form_data["ranges"] == "100,250"
    assert result.form_data["markers"] == "200"


def test_update_chart_preview_tool_preserves_omitted_bullet_state() -> None:
    request = UpdateChartPreviewRequest(
        form_data_key="previous_bullet_key",
        dataset_id=7,
        config=BulletChartConfig(metric=_simple_metric("NewRevenue")),
        generate_preview=False,
    )
    dataset = SimpleNamespace(id=7)
    previous = {
        "viz_type": "bullet",
        "metric": "old_metric",
        "groupby": ["Region", "Team"],
        "ranges": "100,250",
        "show_labels": True,
    }
    link = MagicMock(
        return_value="http://localhost:8088/explore/?form_data_key=new_bullet_key"
    )
    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=_tool_user(),
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview._find_dataset",
            return_value=dataset,
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview."
            "_get_previous_form_data",
            return_value=previous,
        ),
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview.has_dataset_access",
            return_value=True,
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview.validate_and_compile",
            return_value=SimpleNamespace(success=True),
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview."
            "generate_explore_link",
            link,
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview."
            "analyze_chart_capabilities",
            return_value=None,
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart_preview."
            "analyze_chart_semantics",
            return_value=None,
        ),
    ):
        result = update_chart_preview(request, ctx=MagicMock())

    assert result["success"] is True
    preview_form_data = link.call_args.args[1]
    assert preview_form_data["metric"]["column"]["column_name"] == "NewRevenue"
    assert preview_form_data["groupby"] == ["Region", "Team"]
    assert preview_form_data["ranges"] == "100,250"
    assert preview_form_data["show_labels"] is True


@pytest.mark.asyncio
async def test_update_chart_tool_persists_native_bullet_round_trip() -> None:
    existing = {
        "viz_type": "bullet",
        "metric": "old_metric",
        "groupby": ["Region"],
        "ranges": "100,250",
        "show_legend": True,
    }
    chart = SimpleNamespace(
        id=9,
        datasource_id=7,
        slice_name="Saved Bullet",
        params=__import__("json").dumps(existing),
        viz_type="bullet",
        uuid="bullet-uuid",
    )
    updated_chart = SimpleNamespace(
        id=9,
        datasource_id=7,
        slice_name="Saved Bullet",
        viz_type="bullet",
        uuid="bullet-uuid",
    )
    command = MagicMock()
    command.return_value.run.return_value = updated_chart
    request = UpdateChartRequest(
        identifier=9,
        config=BulletChartConfig(metric=_simple_metric("NewRevenue")),
        generate_preview=False,
        preview_formats=[],
    )
    ctx = MagicMock()
    ctx.warning = AsyncMock()
    ctx.error = AsyncMock()
    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=_tool_user(),
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart.find_chart_by_identifier",
            return_value=chart,
        ),
        patch(
            "superset.mcp_service.auth.check_chart_data_access",
            return_value=SimpleNamespace(is_valid=True, error=None),
        ),
        patch.object(
            DatasetValidator,
            "normalize_column_names",
            side_effect=lambda config, dataset_id: config,
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart."
            "_validate_update_against_dataset",
            return_value=None,
        ),
        patch("superset.commands.chart.update.UpdateChartCommand", command),
        patch(
            "superset.mcp_service.chart.tool.update_chart.analyze_chart_capabilities",
            return_value=None,
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart.analyze_chart_semantics",
            return_value=None,
        ),
    ):
        result = await update_chart(request, ctx=ctx)

    assert result.success is True
    payload = command.call_args.args[1]
    persisted = __import__("json").loads(payload["params"])
    assert persisted["metric"]["column"]["column_name"] == "NewRevenue"
    assert persisted["groupby"] == ["Region"]
    assert persisted["ranges"] == "100,250"
    assert persisted["show_legend"] is True
