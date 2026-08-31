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

"""Bubble chart type plugin."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, ClassVar

from superset.mcp_service.chart.chart_utils import (
    _bubble_chart_what,
    _summarize_filters,
    map_bubble_config,
)
from superset.mcp_service.chart.plugin import BaseChartPlugin
from superset.mcp_service.chart.schemas import BubbleChartConfig, ColumnRef
from superset.mcp_service.chart.validation.dataset_validator import DatasetValidator
from superset.mcp_service.common.error_schemas import ChartGenerationError


class BubbleChartPlugin(BaseChartPlugin):
    """Plugin for bubble chart type."""

    chart_type = "bubble"
    display_name = "Bubble Chart"
    native_viz_types: ClassVar[Mapping[str, str]] = {
        "bubble_v2": "Bubble Chart",
    }

    def pre_validate(
        self,
        config: dict[str, Any],
    ) -> ChartGenerationError | None:
        missing_fields = []

        if "entity" not in config:
            missing_fields.append("'entity' (category column per bubble)")
        if "x" not in config:
            missing_fields.append("'x' (metric for horizontal position)")
        if "y" not in config:
            missing_fields.append("'y' (metric for vertical position)")
        if "size" not in config:
            missing_fields.append("'size' (metric for bubble area)")

        if missing_fields:
            return ChartGenerationError(
                error_type="missing_bubble_fields",
                message=(
                    f"Bubble chart missing required fields: {', '.join(missing_fields)}"
                ),
                details=(
                    "Bubble charts plot an entity by three metrics: x and y "
                    "position each bubble and size sets its area"
                ),
                suggestions=[
                    "Add 'entity': {'name': 'country'}",
                    "Add 'x': {'name': 'gdp', 'aggregate': 'AVG'}",
                    "Add 'y': {'name': 'life_expectancy', 'aggregate': 'AVG'}",
                    "Add 'size': {'name': 'population', 'aggregate': 'SUM'}",
                ],
                error_code="MISSING_BUBBLE_FIELDS",
            )

        return None

    def extract_column_refs(self, config: Any) -> list[ColumnRef]:
        if not isinstance(config, BubbleChartConfig):
            return []
        refs: list[ColumnRef] = [config.entity, config.x, config.y, config.size]
        if config.series:
            refs.append(config.series)
        if config.filters:
            for f in config.filters:
                refs.append(ColumnRef(name=f.column))
        return refs

    def to_form_data(
        self, config: Any, dataset_id: int | str | None = None
    ) -> dict[str, Any]:
        return map_bubble_config(config)

    def generate_name(self, config: Any, dataset_name: str | None = None) -> str:
        what = _bubble_chart_what(config)
        context = _summarize_filters(config.filters)
        return self._with_context(what, context)

    def resolve_viz_type(self, config: Any) -> str:
        return "bubble_v2"

    def normalize_column_refs(self, config: Any, dataset_context: Any) -> Any:
        config_dict = config.model_dump()

        for key in ("entity", "series"):
            col = config_dict.get(key)
            if col and not col.get("sql_expression") and not col.get("saved_metric"):
                col["name"] = DatasetValidator.get_canonical_column_name(
                    col["name"], dataset_context
                )
        for key in ("x", "y", "size"):
            metric = config_dict.get(key)
            if not metric:
                continue
            if metric.get("sql_expression"):
                continue
            if metric.get("saved_metric"):
                metric["name"] = DatasetValidator.get_canonical_metric_name(
                    metric["name"], dataset_context
                )
            else:
                metric["name"] = DatasetValidator.get_canonical_column_name(
                    metric["name"], dataset_context
                )
        DatasetValidator.normalize_filters(config_dict, dataset_context)
        return BubbleChartConfig.model_validate(config_dict)

    def schema_error_hint(self) -> ChartGenerationError | None:
        return ChartGenerationError(
            error_type="bubble_validation_error",
            message="Bubble chart configuration validation failed",
            details=(
                "The bubble chart configuration is missing required "
                "fields or has invalid structure"
            ),
            suggestions=[
                "Ensure 'entity' has a 'name'",
                "Ensure 'x', 'y', and 'size' each have 'name' and 'aggregate'",
                "Example: {'chart_type': 'bubble', "
                "'entity': {'name': 'country'}, "
                "'x': {'name': 'gdp', 'aggregate': 'AVG'}, "
                "'y': {'name': 'life_expectancy', 'aggregate': 'AVG'}, "
                "'size': {'name': 'population', 'aggregate': 'SUM'}}",
            ],
            error_code="BUBBLE_VALIDATION_ERROR",
        )
