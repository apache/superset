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

"""Radar chart type plugin."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, ClassVar

from superset.mcp_service.chart.chart_utils import (
    _radar_chart_what,
    _summarize_filters,
    map_radar_config,
)
from superset.mcp_service.chart.plugin import BaseChartPlugin
from superset.mcp_service.chart.schemas import ColumnRef, RadarChartConfig
from superset.mcp_service.chart.validation.dataset_validator import DatasetValidator
from superset.mcp_service.common.error_schemas import ChartGenerationError


class RadarChartPlugin(BaseChartPlugin):
    """Plugin for radar chart type."""

    chart_type = "radar"
    display_name = "Radar Chart"
    native_viz_types: ClassVar[Mapping[str, str]] = {
        "radar": "Radar Chart",
    }

    def pre_validate(
        self,
        config: dict[str, Any],
    ) -> ChartGenerationError | None:
        if not config.get("metrics"):
            return ChartGenerationError(
                error_type="missing_radar_fields",
                message="Radar chart missing required field: 'metrics'",
                details=(
                    "Radar charts plot one axis per metric. Add two or more "
                    "'metrics'; an optional 'groupby' draws one polygon per "
                    "category."
                ),
                suggestions=[
                    "Add 'metrics': [{'name': 'speed', 'aggregate': 'AVG'}, "
                    "{'name': 'power', 'aggregate': 'AVG'}]",
                    "Example: {'chart_type': 'radar', 'metrics': "
                    "[{'name': 'speed', 'aggregate': 'AVG'}, "
                    "{'name': 'power', 'aggregate': 'AVG'}]}",
                ],
                error_code="MISSING_RADAR_FIELDS",
            )
        return None

    def extract_column_refs(self, config: Any) -> list[ColumnRef]:
        if not isinstance(config, RadarChartConfig):
            return []
        refs: list[ColumnRef] = [*config.metrics]
        if config.groupby:
            refs.extend(config.groupby)
        if config.filters:
            for f in config.filters:
                refs.append(ColumnRef(name=f.column))
        return refs

    def to_form_data(
        self, config: Any, dataset_id: int | str | None = None
    ) -> dict[str, Any]:
        return map_radar_config(config)

    def generate_name(self, config: Any, dataset_name: str | None = None) -> str:
        what = _radar_chart_what(config)
        context = _summarize_filters(config.filters)
        return self._with_context(what, context)

    def resolve_viz_type(self, config: Any) -> str:
        return "radar"

    def normalize_column_refs(self, config: Any, dataset_context: Any) -> Any:
        config_dict = config.model_dump()

        for metric in config_dict.get("metrics") or []:
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
        for col in config_dict.get("groupby") or []:
            if not col.get("sql_expression") and not col.get("saved_metric"):
                col["name"] = DatasetValidator.get_canonical_column_name(
                    col["name"], dataset_context
                )
        DatasetValidator.normalize_filters(config_dict, dataset_context)
        return RadarChartConfig.model_validate(config_dict)

    def schema_error_hint(self) -> ChartGenerationError | None:
        return ChartGenerationError(
            error_type="radar_validation_error",
            message="Radar chart configuration validation failed",
            details=(
                "The radar chart configuration is missing required "
                "fields or has invalid structure"
            ),
            suggestions=[
                "Ensure 'metrics' has at least one metric with 'name' and 'aggregate'",
                "Example: {'chart_type': 'radar', 'metrics': "
                "[{'name': 'speed', 'aggregate': 'AVG'}, "
                "{'name': 'power', 'aggregate': 'AVG'}]}",
            ],
            error_code="RADAR_VALIDATION_ERROR",
        )
