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

"""Pivot table chart type plugin."""

from __future__ import annotations

from typing import Any

from superset.mcp_service.chart.plugin import BaseChartPlugin
from superset.mcp_service.chart.schemas import ColumnRef
from superset.mcp_service.common.error_schemas import ChartGenerationError


class PivotTableChartPlugin(BaseChartPlugin):
    """Plugin for pivot_table chart type."""

    chart_type = "pivot_table"
    display_name = "Pivot Table"
    native_viz_types = {
        "pivot_table_v2": "Pivot Table",
    }

    def pre_validate(
        self,
        config: dict[str, Any],
    ) -> ChartGenerationError | None:
        missing_fields = []

        if "rows" not in config:
            missing_fields.append("'rows' (row grouping columns)")
        if "metrics" not in config:
            missing_fields.append("'metrics' (aggregation metrics)")

        if missing_fields:
            return ChartGenerationError(
                error_type="missing_pivot_fields",
                message=(
                    f"Pivot table missing required fields: {', '.join(missing_fields)}"
                ),
                details="Pivot tables require row groupings and metrics",
                suggestions=[
                    "Add 'rows' field: [{'name': 'category'}]",
                    "Add 'metrics' field: [{'name': 'sales', 'aggregate': 'SUM'}]",
                    "Optional 'columns' for cross-tabulation: [{'name': 'region'}]",
                ],
                error_code="MISSING_PIVOT_FIELDS",
            )

        if not isinstance(config.get("rows", []), list):
            return ChartGenerationError(
                error_type="invalid_rows_format",
                message="Rows must be a list of columns",
                details="The 'rows' field must be an array of column specifications",
                suggestions=[
                    "Wrap row columns in array: 'rows': [{'name': 'category'}]",
                ],
                error_code="INVALID_ROWS_FORMAT",
            )

        if not isinstance(config.get("metrics", []), list):
            return ChartGenerationError(
                error_type="invalid_metrics_format",
                message="Metrics must be a list",
                details="The 'metrics' field must be an array of metric specifications",
                suggestions=[
                    "Wrap metrics in array: 'metrics': [{'name': 'sales', "
                    "'aggregate': 'SUM'}]",
                ],
                error_code="INVALID_METRICS_FORMAT",
            )

        return None

    def extract_column_refs(self, config: Any) -> list[ColumnRef]:
        from superset.mcp_service.chart.schemas import PivotTableChartConfig

        if not isinstance(config, PivotTableChartConfig):
            return []
        refs: list[ColumnRef] = list(config.rows)
        refs.extend(config.metrics)
        if config.columns:
            refs.extend(config.columns)
        if config.filters:
            for f in config.filters:
                refs.append(ColumnRef(name=f.column))
        return refs

    def to_form_data(
        self, config: Any, dataset_id: int | str | None = None
    ) -> dict[str, Any]:
        from superset.mcp_service.chart.chart_utils import map_pivot_table_config

        return map_pivot_table_config(config)

    def generate_name(self, config: Any, dataset_name: str | None = None) -> str:
        from superset.mcp_service.chart.chart_utils import (
            _pivot_table_what,
            _summarize_filters,
        )

        what = _pivot_table_what(config)
        context = _summarize_filters(config.filters)
        return f"{what} \u2013 {context}" if context else what

    def resolve_viz_type(self, config: Any) -> str:
        return "pivot_table_v2"

    def normalize_column_refs(self, config: Any, dataset_context: Any) -> Any:
        from superset.mcp_service.chart.schemas import PivotTableChartConfig
        from superset.mcp_service.chart.validation.dataset_validator import (
            DatasetValidator,
        )

        config_dict = config.model_dump()

        def _norm_col_list(key: str) -> None:
            if config_dict.get(key):
                for col in config_dict[key]:
                    col["name"] = DatasetValidator._get_canonical_column_name(
                        col["name"], dataset_context
                    )

        _norm_col_list("rows")
        _norm_col_list("metrics")
        _norm_col_list("columns")
        DatasetValidator._normalize_filters(config_dict, dataset_context)
        return PivotTableChartConfig.model_validate(config_dict)
