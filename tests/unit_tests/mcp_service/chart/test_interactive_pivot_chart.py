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

"""Tests for the feature-gated AG Grid interactive pivot MCP adapter."""

from unittest.mock import Mock, patch

import pytest
from pydantic import ValidationError

from superset.extensions import feature_flag_manager
from superset.mcp_service.chart.chart_utils import (
    analyze_chart_capabilities,
    analyze_chart_semantics,
    generate_chart_name,
    map_config_to_form_data,
)
from superset.mcp_service.chart.plugins.interactive_pivot import (
    INTERACTIVE_PIVOT_FEATURE_FLAG,
    InteractivePivotChartPlugin,
    map_interactive_pivot_config,
)
from superset.mcp_service.chart.registry import get_registry
from superset.mcp_service.chart.schemas import (
    GenerateChartRequest,
    InteractivePivotChartConfig,
    UpdateChartRequest,
)
from superset.mcp_service.chart.tool.get_chart_type_schema import (
    _get_chart_type_schema_impl,
)
from superset.mcp_service.chart.tool.update_chart import (
    _build_preview_form_data,
    _build_update_payload,
)
from superset.mcp_service.chart.validation.schema_validator import SchemaValidator
from superset.mcp_service.common.error_schemas import DatasetContext
from superset.utils import json


@pytest.fixture
def config() -> InteractivePivotChartConfig:
    """Return a representative Explore-compatible interactive pivot config."""
    return InteractivePivotChartConfig.model_validate(
        {
            "chart_type": "interactive_pivot",
            "rows": [{"name": "region"}, {"name": "country"}],
            "columns": [{"name": "order_date"}],
            "metrics": [
                {"name": "revenue", "aggregate": "SUM", "label": "Revenue"},
                {"name": "margin", "aggregate": "AVG", "label": "Avg Margin"},
            ],
            "temporal_column": "order_date",
            "time_grain": "P1M",
            "filters": [{"column": "status", "op": "=", "value": "active"}],
            "series_limit": 25,
            "series_limit_metric": {
                "name": "revenue",
                "aggregate": "SUM",
                "label": "Revenue",
            },
            "sort_descending": True,
            "row_limit": 12000,
            "show_row_group_counts": False,
            "show_row_totals": True,
            "show_column_totals": True,
            "show_column_subtotals": True,
            "value_format": "$,.2f",
            "date_format": "%Y-%m",
            "currency_format": {"symbol": "USD", "symbol_position": "prefix"},
            "column_sort": "key_a_to_z",
            "allow_render_html": False,
            "expand_pivot_groups": True,
            "comparison_period": "1 year ago",
            "comparison_type": "percentage",
        }
    )


def test_maps_true_ag_grid_pivot_form_data(
    config: InteractivePivotChartConfig,
) -> None:
    form_data = map_interactive_pivot_config(config)

    assert form_data["viz_type"] == "ag-grid-pivot-table"
    assert form_data["groupby"] == ["region", "country", "order_date"]
    assert [metric["label"] for metric in form_data["metrics"]] == [
        "Revenue",
        "Avg Margin",
    ]
    assert form_data["pivot_table_state"] == {
        "rowGroup": {"groupColIds": ["region", "country"]},
        "pivot": {"pivotMode": True, "pivotColIds": ["order_date"]},
        "aggregation": {
            "aggregationModel": [
                {"colId": "Revenue", "aggFunc": "sum"},
                {"colId": "Avg Margin", "aggFunc": "avg"},
            ]
        },
    }
    assert form_data["rowGroupCounts"] is False
    assert form_data["rowTotals"] is True
    assert form_data["colTotals"] is True
    assert form_data["colSubTotals"] is True
    assert form_data["time_compare"] == ["1 year ago"]
    assert form_data["comparison_type"] == "percentage"
    assert form_data["granularity_sqla"] == "order_date"
    assert form_data["temporal_columns_lookup"] == {"order_date": True}
    assert form_data["time_grain_sqla"] == "P1M"


def test_time_grain_requires_grouped_temporal_column() -> None:
    base_config = {
        "chart_type": "interactive_pivot",
        "rows": [{"name": "region"}],
        "metrics": [{"name": "revenue", "aggregate": "SUM"}],
        "time_grain": "P1M",
    }

    with pytest.raises(ValidationError, match="time_grain requires temporal_column"):
        InteractivePivotChartConfig.model_validate(base_config)

    with pytest.raises(ValidationError, match="must appear in rows or columns"):
        InteractivePivotChartConfig.model_validate(
            {**base_config, "temporal_column": "order_date"}
        )


def test_series_limit_metric_requires_metric_shape() -> None:
    with pytest.raises(ValidationError, match="series_limit_metric must define"):
        InteractivePivotChartConfig.model_validate(
            {
                "chart_type": "interactive_pivot",
                "rows": [{"name": "region"}],
                "metrics": [{"name": "revenue", "aggregate": "SUM"}],
                "series_limit_metric": {"name": "region"},
            }
        )


def test_comparison_controls_are_paired() -> None:
    with pytest.raises(ValidationError, match="must be provided together"):
        InteractivePivotChartConfig.model_validate(
            {
                "chart_type": "interactive_pivot",
                "rows": [{"name": "region"}],
                "metrics": [{"name": "revenue", "aggregate": "SUM"}],
                "comparison_period": "1 year ago",
            }
        )


def test_native_comparison_array_round_trips() -> None:
    config = InteractivePivotChartConfig.model_validate(
        {
            "chart_type": "interactive_pivot",
            "rows": [{"name": "region"}],
            "metrics": [{"name": "revenue", "aggregate": "SUM"}],
            "time_compare": ["4 weeks ago"],
            "comparison_type": "difference",
        }
    )

    assert config.comparison_period == "4 weeks ago"
    assert config.comparison_type == "difference"
    assert map_interactive_pivot_config(config)["time_compare"] == ["4 weeks ago"]


@pytest.mark.parametrize(
    "comparison_type", ["values", "difference", "percentage", "ratio"]
)
def test_maps_supported_comparison_types(comparison_type: str) -> None:
    config = InteractivePivotChartConfig.model_validate(
        {
            "chart_type": "interactive_pivot",
            "rows": [{"name": "region"}],
            "metrics": [{"name": "revenue", "aggregate": "SUM"}],
            "comparison_period": "1 year ago",
            "comparison_type": comparison_type,
        }
    )

    form_data = map_interactive_pivot_config(config)

    assert form_data["time_compare"] == ["1 year ago"]
    assert form_data["comparison_type"] == comparison_type


def test_multiple_native_comparison_periods_are_rejected() -> None:
    with pytest.raises(ValidationError, match="supports one comparison period"):
        InteractivePivotChartConfig.model_validate(
            {
                "chart_type": "interactive_pivot",
                "rows": [{"name": "region"}],
                "metrics": [{"name": "revenue", "aggregate": "SUM"}],
                "time_compare": ["1 year ago", "2 years ago"],
                "comparison_type": "values",
            }
        )


def test_comparison_period_rejects_arrays() -> None:
    with pytest.raises(ValidationError, match="must be a single string"):
        InteractivePivotChartConfig.model_validate(
            {
                "chart_type": "interactive_pivot",
                "rows": [{"name": "region"}],
                "metrics": [{"name": "revenue", "aggregate": "SUM"}],
                "comparison_period": ["1 year ago"],
                "comparison_type": "values",
            }
        )


def test_comparison_period_rejects_whitespace() -> None:
    with pytest.raises(ValidationError, match="Comparison period cannot be empty"):
        InteractivePivotChartConfig.model_validate(
            {
                "chart_type": "interactive_pivot",
                "rows": [{"name": "region"}],
                "metrics": [{"name": "revenue", "aggregate": "SUM"}],
                "comparison_period": " ",
                "comparison_type": "values",
            }
        )


def test_normalization_canonicalizes_temporal_lookup_key() -> None:
    plugin = InteractivePivotChartPlugin()
    config = InteractivePivotChartConfig.model_validate(
        {
            "chart_type": "interactive_pivot",
            "rows": [{"name": "REGION"}],
            "columns": [{"name": "Order_Date"}],
            "metrics": [{"name": "REVENUE", "aggregate": "SUM"}],
            "temporal_column": "ORDER_DATE",
            "time_grain": "P1M",
        }
    )
    dataset_context = DatasetContext(
        id=7,
        table_name="orders",
        database_name="analytics",
        available_columns=[
            {"name": "region", "is_temporal": False},
            {"name": "order_date", "is_temporal": True},
            {"name": "revenue", "is_temporal": False},
        ],
    )

    normalized = plugin.normalize_column_refs(config, dataset_context)
    form_data = map_interactive_pivot_config(normalized)

    assert normalized.temporal_column == "order_date"
    assert form_data["groupby"] == ["region", "order_date"]
    assert form_data["granularity_sqla"] == "order_date"
    assert form_data["temporal_columns_lookup"] == {"order_date": True}


def test_registry_mapping_keeps_interactive_pivot_distinct(
    config: InteractivePivotChartConfig,
) -> None:
    with patch.object(feature_flag_manager, "is_feature_enabled", return_value=True):
        form_data = map_config_to_form_data(config, dataset_id=7)

    assert form_data["viz_type"] == "ag-grid-pivot-table"
    assert form_data["viz_type"] != "pivot_table_v2"


def test_native_viz_type_alias_parses_as_interactive_pivot() -> None:
    request = GenerateChartRequest.model_validate(
        {
            "dataset_id": 7,
            "config": {
                "viz_type": "ag-grid-pivot-table",
                "rows": [{"name": "region"}],
                "columns": [{"name": "quarter"}],
                "metrics": [{"name": "revenue", "aggregate": "SUM"}],
            },
        }
    )

    assert isinstance(request.config, InteractivePivotChartConfig)
    assert request.config.chart_type == "interactive_pivot"


def test_dimension_cannot_be_both_row_and_column() -> None:
    with pytest.raises(ValidationError, match="both rows and columns"):
        InteractivePivotChartConfig.model_validate(
            {
                "chart_type": "interactive_pivot",
                "rows": [{"name": "region"}],
                "columns": [{"name": "region"}],
                "metrics": [{"name": "revenue", "aggregate": "SUM"}],
            }
        )


def test_oss_deployment_hides_schema_and_rejects_generation(
    config: InteractivePivotChartConfig,
) -> None:
    with patch.object(feature_flag_manager, "is_feature_enabled", return_value=False):
        assert get_registry().get("interactive_pivot") is None
        result = _get_chart_type_schema_impl("interactive_pivot")
        is_valid, _, error = SchemaValidator.validate_request(
            {"dataset_id": 7, "config": config.model_dump(mode="json")}
        )

    assert result["error"]["error_code"] == "DISABLED_CHART_TYPE"
    assert "interactive_pivot" not in result["valid_chart_types"]
    assert is_valid is False
    assert error is not None
    assert error.error_code == "DISABLED_CHART_TYPE"
    assert "not available on this instance" in error.details
    assert "disabled by the operator" not in error.details


def test_feature_flag_exposes_schema_and_generation(
    config: InteractivePivotChartConfig,
) -> None:
    with patch.object(feature_flag_manager, "is_feature_enabled", return_value=True):
        assert get_registry().get("interactive_pivot") is not None
        result = _get_chart_type_schema_impl("interactive_pivot")
        is_valid, parsed, error = SchemaValidator.validate_request(
            {"dataset_id": 7, "config": config.model_dump(mode="json")}
        )

    assert result["chart_type"] == "interactive_pivot"
    assert result["examples"]
    assert "comparison_period" in result["schema"]["properties"]
    assert "comparison_type" in result["schema"]["properties"]
    assert is_valid is True
    assert parsed is not None
    assert isinstance(parsed.config, InteractivePivotChartConfig)
    assert error is None


def test_plugin_checks_feature_flag() -> None:
    plugin = InteractivePivotChartPlugin()
    with patch.object(
        feature_flag_manager, "is_feature_enabled", return_value=True
    ) as is_enabled:
        assert plugin.is_available() is True
    is_enabled.assert_called_once_with(INTERACTIVE_PIVOT_FEATURE_FLAG)


def test_update_preserves_viz_type_and_ui_grid_state(
    config: InteractivePivotChartConfig,
) -> None:
    chart = Mock(
        datasource_id=7,
        slice_name="Revenue pivot",
        params=json.dumps(
            {
                "viz_type": "ag-grid-pivot-table",
                "column_config": {"Revenue": {"d3NumberFormat": "$,.2f"}},
                "conditional_formatting": [
                    {"column": "Revenue", "operator": ">", "targetValue": 1000}
                ],
                "pivot_table_state": {
                    "columnSizing": {
                        "columnSizingModel": [{"colId": "region", "width": 180}]
                    },
                    "filter": {"filterModel": {"region": {"values": ["EMEA"]}}},
                    "rowGroup": {"groupColIds": ["old_row"]},
                },
            }
        ),
    )
    request = UpdateChartRequest(identifier=9, config=config)

    with patch.object(feature_flag_manager, "is_feature_enabled", return_value=True):
        payload = _build_update_payload(request, chart, parsed_config=config)

    assert isinstance(payload, dict)
    assert payload["viz_type"] == "ag-grid-pivot-table"
    params = json.loads(payload["params"])
    assert params["time_compare"] == ["1 year ago"]
    assert params["comparison_type"] == "percentage"
    assert params["column_config"] == {"Revenue": {"d3NumberFormat": "$,.2f"}}
    assert params["conditional_formatting"] == [
        {"column": "Revenue", "operator": ">", "targetValue": 1000}
    ]
    state = params["pivot_table_state"]
    assert state["columnSizing"]["columnSizingModel"][0]["width"] == 180
    assert state["filter"]["filterModel"]["region"]["values"] == ["EMEA"]
    assert state["rowGroup"]["groupColIds"] == ["region", "country"]
    assert state["pivot"]["pivotColIds"] == ["order_date"]


def test_preview_update_preserves_viz_type_and_ui_grid_state(
    config: InteractivePivotChartConfig,
) -> None:
    chart = Mock(
        id=9,
        datasource_id=7,
        slice_name="Revenue pivot",
        params=json.dumps(
            {
                "viz_type": "ag-grid-pivot-table",
                "column_config": {"Revenue": {"columnWidth": 160}},
                "pivot_table_state": {"sort": {"sortModel": []}},
            }
        ),
    )
    request = UpdateChartRequest(identifier=9, config=config)

    with patch.object(feature_flag_manager, "is_feature_enabled", return_value=True):
        form_data = _build_preview_form_data(request, chart, parsed_config=config)

    assert isinstance(form_data, dict)
    assert form_data["viz_type"] == "ag-grid-pivot-table"
    assert form_data["time_compare"] == ["1 year ago"]
    assert form_data["comparison_type"] == "percentage"
    assert form_data["column_config"] == {"Revenue": {"columnWidth": 160}}
    assert form_data["pivot_table_state"]["sort"] == {"sortModel": []}


def test_capability_analysis_marks_ag_grid_pivot_interactive(
    config: InteractivePivotChartConfig,
) -> None:
    capabilities = analyze_chart_capabilities("ag-grid-pivot-table", config)
    semantics = analyze_chart_semantics("ag-grid-pivot-table", config)

    assert capabilities.supports_interaction is True
    assert capabilities.supports_drill_down is True
    assert "side-panel" in semantics.primary_insight


def test_chart_name_identifies_interactive_pivot(
    config: InteractivePivotChartConfig,
) -> None:
    with patch.object(feature_flag_manager, "is_feature_enabled", return_value=True):
        name = generate_chart_name(config)
    assert name == "Interactive Pivot Table – region, country – Status active"
