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

"""Pie chart type plugin."""

from __future__ import annotations

from typing import Any

from superset.mcp_service.chart.plugin import BaseChartPlugin
from superset.mcp_service.chart.schemas import ColumnRef
from superset.mcp_service.common.error_schemas import ChartGenerationError


class PieChartPlugin(BaseChartPlugin):
    """Plugin for pie chart type."""

    chart_type = "pie"
    display_name = "Pie / Donut Chart"
    native_viz_types = {
        "pie": "Pie Chart",
    }

    def pre_validate(
        self,
        config: dict[str, Any],
    ) -> ChartGenerationError | None:
        missing_fields = []

        if "dimension" not in config:
            missing_fields.append("'dimension' (category column for slices)")
        if "metric" not in config:
            missing_fields.append("'metric' (value metric for slice sizes)")

        if missing_fields:
            return ChartGenerationError(
                error_type="missing_pie_fields",
                message=(
                    f"Pie chart missing required fields: {', '.join(missing_fields)}"
                ),
                details=(
                    "Pie charts require a dimension (categories) and a metric (values)"
                ),
                suggestions=[
                    "Add 'dimension' field: {'name': 'category_column'}",
                    "Add 'metric' field: {'name': 'value_column', 'aggregate': 'SUM'}",
                    "Example: {'chart_type': 'pie', 'dimension': {'name': 'product'}, "
                    "'metric': {'name': 'revenue', 'aggregate': 'SUM'}}",
                ],
                error_code="MISSING_PIE_FIELDS",
            )

        return None

    def extract_column_refs(self, config: Any) -> list[ColumnRef]:
        from superset.mcp_service.chart.schemas import PieChartConfig

        if not isinstance(config, PieChartConfig):
            return []
        refs: list[ColumnRef] = [config.dimension, config.metric]
        if config.filters:
            for f in config.filters:
                refs.append(ColumnRef(name=f.column))
        return refs

    def to_form_data(
        self, config: Any, dataset_id: int | str | None = None
    ) -> dict[str, Any]:
        from superset.mcp_service.chart.chart_utils import map_pie_config

        return map_pie_config(config)

    def generate_name(self, config: Any, dataset_name: str | None = None) -> str:
        from superset.mcp_service.chart.chart_utils import (
            _pie_chart_what,
            _summarize_filters,
        )

        what = _pie_chart_what(config)
        context = _summarize_filters(config.filters)
        return f"{what} \u2013 {context}" if context else what

    def resolve_viz_type(self, config: Any) -> str:
        return "pie"

    def normalize_column_refs(self, config: Any, dataset_context: Any) -> Any:
        from superset.mcp_service.chart.schemas import PieChartConfig
        from superset.mcp_service.chart.validation.dataset_validator import (
            DatasetValidator,
        )

        config_dict = config.model_dump()

        if config_dict.get("dimension"):
            config_dict["dimension"]["name"] = (
                DatasetValidator._get_canonical_column_name(
                    config_dict["dimension"]["name"], dataset_context
                )
            )
        if config_dict.get("metric") and not config_dict["metric"].get("saved_metric"):
            config_dict["metric"]["name"] = DatasetValidator._get_canonical_column_name(
                config_dict["metric"]["name"], dataset_context
            )
        DatasetValidator._normalize_filters(config_dict, dataset_context)
        return PieChartConfig.model_validate(config_dict)
