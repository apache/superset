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

"""AG Grid interactive pivot chart plugin."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, ClassVar

from superset.extensions import feature_flag_manager
from superset.mcp_service.chart.chart_utils import (
    _add_adhoc_filters,
    _summarize_filters,
    add_currency_format,
    create_metric_object,
)
from superset.mcp_service.chart.plugin import BaseChartPlugin
from superset.mcp_service.chart.schemas import ColumnRef, InteractivePivotChartConfig
from superset.mcp_service.chart.validation.dataset_validator import DatasetValidator
from superset.mcp_service.common.error_schemas import ChartGenerationError

INTERACTIVE_PIVOT_FEATURE_FLAG = "AG_GRID_PIVOT_TABLE_ENABLED"
_AG_GRID_AGGREGATION = {
    "AVG": "avg",
    "MIN": "min",
    "MAX": "max",
}


def _metric_label(metric: dict[str, Any] | str) -> str:
    """Return the label AG Grid uses as a metric column identifier."""
    return metric if isinstance(metric, str) else str(metric["label"])


def _grid_aggregation(metric: ColumnRef) -> str:
    """Map a Superset metric aggregate to AG Grid's group rollup function."""
    return _AG_GRID_AGGREGATION.get((metric.aggregate or "SUM").upper(), "sum")


def map_interactive_pivot_config(
    config: InteractivePivotChartConfig,
) -> dict[str, Any]:
    """Map the MCP config to ``ag-grid-pivot-table`` form data."""
    metrics = [create_metric_object(metric) for metric in config.metrics]
    rows = [column.name for column in config.rows]
    columns = [column.name for column in config.columns]

    form_data: dict[str, Any] = {
        "viz_type": "ag-grid-pivot-table",
        # The control panel stores every dimension in groupby. AG Grid's
        # persisted state assigns each one to the Rows or Column Labels bucket.
        "groupby": [*rows, *columns],
        "metrics": metrics,
        "row_limit": config.row_limit,
        "order_desc": config.sort_descending,
        "rowGroupCounts": config.show_row_group_counts,
        "rowTotals": config.show_row_totals,
        "colTotals": config.show_column_totals,
        "colSubTotals": config.show_column_subtotals,
        "valueFormat": config.value_format,
        "allow_render_html": config.allow_render_html,
        "expand_pivot_groups": config.expand_pivot_groups,
        "pivot_table_state": {
            "rowGroup": {"groupColIds": rows},
            "pivot": {"pivotMode": True, "pivotColIds": columns},
            "aggregation": {
                "aggregationModel": [
                    {
                        "colId": _metric_label(mapped_metric),
                        "aggFunc": _grid_aggregation(metric),
                    }
                    for metric, mapped_metric in zip(
                        config.metrics, metrics, strict=True
                    )
                ]
            },
        },
    }

    if config.temporal_column:
        form_data["granularity_sqla"] = config.temporal_column
        form_data["temporal_columns_lookup"] = {config.temporal_column: True}
    if config.time_grain:
        # buildQuery consults temporal_columns_lookup before applying this grain
        # to a grouped dimension.
        form_data["time_grain_sqla"] = config.time_grain.value
    if config.series_limit is not None:
        form_data["series_limit"] = config.series_limit
    if config.series_limit_metric is not None:
        form_data["series_limit_metric"] = create_metric_object(
            config.series_limit_metric
        )
    if config.date_format:
        form_data["date_format"] = config.date_format
    if config.column_sort:
        form_data["colOrder"] = config.column_sort
    if config.comparison_period and config.comparison_type:
        form_data["time_compare"] = [config.comparison_period]
        form_data["comparison_type"] = config.comparison_type
    add_currency_format(form_data, config.currency_format)
    _add_adhoc_filters(form_data, config.filters)
    return form_data


class InteractivePivotChartPlugin(BaseChartPlugin):
    """Plugin for a feature-gated AG Grid interactive pivot extension."""

    chart_type = "interactive_pivot"
    display_name = "Interactive Pivot Table"
    native_viz_types: ClassVar[Mapping[str, str]] = {
        "ag-grid-pivot-table": "Interactive Pivot Table",
    }

    def is_available(self) -> bool:
        """Hide the adapter unless the host ships and enables the visualization."""
        return feature_flag_manager.is_feature_enabled(INTERACTIVE_PIVOT_FEATURE_FLAG)

    def pre_validate(
        self,
        config: dict[str, Any],
    ) -> ChartGenerationError | None:
        missing_fields = []
        if not config.get("rows"):
            missing_fields.append("'rows' (AG Grid row groups)")
        if not config.get("metrics"):
            missing_fields.append("'metrics' (value columns)")
        if not missing_fields:
            return None
        return ChartGenerationError(
            error_type="missing_interactive_pivot_fields",
            message=(
                "Interactive pivot missing required fields: "
                + ", ".join(missing_fields)
            ),
            details="Interactive pivots require at least one row and one metric",
            suggestions=[
                "Add 'rows': [{'name': 'region'}]",
                "Add 'metrics': [{'name': 'revenue', 'aggregate': 'SUM'}]",
                "Use 'columns' to populate the AG Grid Column Labels bucket",
            ],
            error_code="MISSING_INTERACTIVE_PIVOT_FIELDS",
        )

    def extract_column_refs(self, config: Any) -> list[ColumnRef]:
        if not isinstance(config, InteractivePivotChartConfig):
            return []
        refs = [*config.rows, *config.columns, *config.metrics]
        if config.series_limit_metric:
            refs.append(config.series_limit_metric)
        if config.filters:
            refs.extend(ColumnRef(name=item.column) for item in config.filters)
        return refs

    def to_form_data(
        self, config: Any, dataset_id: int | str | None = None
    ) -> dict[str, Any]:
        if not isinstance(config, InteractivePivotChartConfig):
            raise TypeError("Expected InteractivePivotChartConfig")
        return map_interactive_pivot_config(config)

    def generate_name(self, config: Any, dataset_name: str | None = None) -> str:
        if not isinstance(config, InteractivePivotChartConfig):
            return "Interactive Pivot Table"
        row_names = ", ".join(row.name or "" for row in config.rows)
        context = _summarize_filters(config.filters)
        return self._with_context(f"Interactive Pivot Table – {row_names}", context)

    def resolve_viz_type(self, config: Any) -> str:
        return "ag-grid-pivot-table"

    def normalize_column_refs(self, config: Any, dataset_context: Any) -> Any:
        if not isinstance(config, InteractivePivotChartConfig):
            return config
        config_dict = config.model_dump()

        if temporal_column := config_dict.get("temporal_column"):
            config_dict["temporal_column"] = DatasetValidator.get_canonical_column_name(
                temporal_column, dataset_context
            )

        for key in ("rows", "columns", "metrics"):
            for column in config_dict.get(key) or []:
                if column.get("sql_expression"):
                    continue
                if column.get("saved_metric"):
                    column["name"] = DatasetValidator.get_canonical_metric_name(
                        column["name"], dataset_context
                    )
                else:
                    column["name"] = DatasetValidator.get_canonical_column_name(
                        column["name"], dataset_context
                    )

        series_metric = config_dict.get("series_limit_metric")
        if series_metric and not series_metric.get("sql_expression"):
            normalizer = (
                DatasetValidator.get_canonical_metric_name
                if series_metric.get("saved_metric")
                else DatasetValidator.get_canonical_column_name
            )
            series_metric["name"] = normalizer(series_metric["name"], dataset_context)

        DatasetValidator.normalize_filters(config_dict, dataset_context)
        return InteractivePivotChartConfig.model_validate(config_dict)

    def schema_error_hint(self) -> ChartGenerationError | None:
        return ChartGenerationError(
            error_type="interactive_pivot_validation_error",
            message="Interactive pivot configuration validation failed",
            details=(
                "Use the dedicated interactive_pivot schema; pivot_table targets "
                "the different OSS pivot_table_v2 visualization"
            ),
            suggestions=[
                "Provide non-empty 'rows' and 'metrics' arrays",
                "Put AG Grid column labels in the optional 'columns' array",
                "Pair comparison_period with comparison_type",
            ],
            error_code="INTERACTIVE_PIVOT_VALIDATION_ERROR",
        )
