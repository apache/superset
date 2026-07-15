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

"""Waterfall chart type plugin."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, ClassVar

from superset.mcp_service.chart.chart_utils import (
    _summarize_filters,
    map_waterfall_config,
)
from superset.mcp_service.chart.plugin import BaseChartPlugin
from superset.mcp_service.chart.schemas import ColumnRef, WaterfallChartConfig
from superset.mcp_service.chart.validation.dataset_validator import DatasetValidator
from superset.mcp_service.common.error_schemas import ChartGenerationError


class WaterfallChartPlugin(BaseChartPlugin):
    """Plugin for waterfall chart type."""

    chart_type = "waterfall"
    display_name = "Waterfall Chart"
    native_viz_types: ClassVar[Mapping[str, str]] = {
        "waterfall": "Waterfall Chart",
    }

    def pre_validate(
        self,
        config: dict[str, Any],
    ) -> ChartGenerationError | None:
        missing_fields = []
        if "x_axis" not in config:
            missing_fields.append(
                "'x_axis' (period/category column, one step per value)"
            )
        if "metric" not in config:
            missing_fields.append("'metric' (value whose per-step change is plotted)")

        if missing_fields:
            return ChartGenerationError(
                error_type="missing_waterfall_fields",
                message=(
                    f"Waterfall missing required fields: {', '.join(missing_fields)}"
                ),
                details=(
                    "Waterfall charts show how sequential increases and "
                    "decreases across the x_axis values accumulate into a total"
                ),
                suggestions=[
                    "Add 'x_axis': {'name': 'month'}",
                    "Add 'metric': {'name': 'revenue_delta', 'aggregate': 'SUM'}",
                    "Example: {'chart_type': 'waterfall', "
                    "'x_axis': {'name': 'month'}, "
                    "'metric': {'name': 'revenue_delta', 'aggregate': 'SUM'}}",
                ],
                error_code="MISSING_WATERFALL_FIELDS",
            )
        return None

    def extract_column_refs(self, config: Any) -> list[ColumnRef]:
        if not isinstance(config, WaterfallChartConfig):
            return []
        refs: list[ColumnRef] = [config.x_axis, config.metric]
        if config.breakdown:
            refs.append(config.breakdown)
        if config.filters:
            for f in config.filters:
                refs.append(ColumnRef(name=f.column))
        return refs

    def to_form_data(
        self, config: Any, dataset_id: int | str | None = None
    ) -> dict[str, Any]:
        return map_waterfall_config(config)

    def generate_name(self, config: Any, dataset_name: str | None = None) -> str:
        metric_name = config.metric.label or config.metric.name
        axis = config.x_axis.label or config.x_axis.name
        what = f"{metric_name} waterfall by {axis}"
        if config.breakdown:
            what += f" ({config.breakdown.label or config.breakdown.name})"
        context = _summarize_filters(config.filters)
        return self._with_context(what, context)

    def resolve_viz_type(self, config: Any) -> str:
        return "waterfall"

    def normalize_column_refs(self, config: Any, dataset_context: Any) -> Any:
        config_dict = config.model_dump()

        for key in ("x_axis", "breakdown"):
            col = config_dict.get(key)
            if col and not col.get("sql_expression") and not col.get("saved_metric"):
                col["name"] = DatasetValidator.get_canonical_column_name(
                    col["name"], dataset_context
                )
        if metric := config_dict.get("metric"):
            if metric.get("sql_expression"):
                pass
            elif metric.get("saved_metric"):
                metric["name"] = DatasetValidator.get_canonical_metric_name(
                    metric["name"], dataset_context
                )
            else:
                metric["name"] = DatasetValidator.get_canonical_column_name(
                    metric["name"], dataset_context
                )
        DatasetValidator.normalize_filters(config_dict, dataset_context)
        return WaterfallChartConfig.model_validate(config_dict)

    def schema_error_hint(self) -> ChartGenerationError | None:
        return ChartGenerationError(
            error_type="waterfall_validation_error",
            message="Waterfall configuration validation failed",
            details=(
                "The waterfall configuration is missing required fields or "
                "has invalid structure"
            ),
            suggestions=[
                "Ensure 'x_axis' has 'name' pointing at a period/category "
                "column (often temporal)",
                "Ensure 'metric' has 'name' and 'aggregate' (or saved_metric=True)",
                "'breakdown' (alias: groupby) is a single optional category column",
                "Example: {'chart_type': 'waterfall', "
                "'x_axis': {'name': 'month'}, "
                "'metric': {'name': 'revenue_delta', 'aggregate': 'SUM'}, "
                "'breakdown': {'name': 'region'}}",
            ],
            error_code="WATERFALL_VALIDATION_ERROR",
        )
