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

"""Gauge chart type plugin."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, ClassVar

from superset.mcp_service.chart.chart_utils import (
    _gauge_chart_what,
    _summarize_filters,
    map_gauge_config,
)
from superset.mcp_service.chart.plugin import BaseChartPlugin
from superset.mcp_service.chart.schemas import ColumnRef, GaugeChartConfig
from superset.mcp_service.chart.validation.dataset_validator import DatasetValidator
from superset.mcp_service.common.error_schemas import ChartGenerationError


class GaugeChartPlugin(BaseChartPlugin):
    """Plugin for gauge chart type."""

    chart_type = "gauge_chart"
    display_name = "Gauge Chart"
    native_viz_types: ClassVar[Mapping[str, str]] = {
        "gauge_chart": "Gauge Chart",
    }

    def pre_validate(
        self,
        config: dict[str, Any],
    ) -> ChartGenerationError | None:
        if "metric" not in config:
            return ChartGenerationError(
                error_type="missing_gauge_fields",
                message="Gauge chart missing required field: 'metric'",
                details=(
                    "Gauge charts display one metric on a dial. Add a 'metric'; "
                    "an optional 'groupby' renders one dial per category."
                ),
                suggestions=[
                    "Add 'metric' field: {'name': 'progress', 'aggregate': 'AVG'}",
                    "Example: {'chart_type': 'gauge_chart', "
                    "'metric': {'name': 'progress', 'aggregate': 'AVG'}}",
                ],
                error_code="MISSING_GAUGE_FIELDS",
            )
        return None

    def extract_column_refs(self, config: Any) -> list[ColumnRef]:
        if not isinstance(config, GaugeChartConfig):
            return []
        refs: list[ColumnRef] = [config.metric]
        if config.groupby:
            refs.extend(config.groupby)
        if config.filters:
            for f in config.filters:
                refs.append(ColumnRef(name=f.column))
        return refs

    def to_form_data(
        self, config: Any, dataset_id: int | str | None = None
    ) -> dict[str, Any]:
        return map_gauge_config(config)

    def generate_name(self, config: Any, dataset_name: str | None = None) -> str:
        what = _gauge_chart_what(config)
        context = _summarize_filters(config.filters)
        return self._with_context(what, context)

    def resolve_viz_type(self, config: Any) -> str:
        return "gauge_chart"

    def normalize_column_refs(self, config: Any, dataset_context: Any) -> Any:
        config_dict = config.model_dump()

        if config_dict.get("metric"):
            if config_dict["metric"].get("sql_expression"):
                pass
            elif config_dict["metric"].get("saved_metric"):
                config_dict["metric"]["name"] = (
                    DatasetValidator.get_canonical_metric_name(
                        config_dict["metric"]["name"], dataset_context
                    )
                )
            else:
                config_dict["metric"]["name"] = (
                    DatasetValidator.get_canonical_column_name(
                        config_dict["metric"]["name"], dataset_context
                    )
                )
        for col in config_dict.get("groupby") or []:
            if not col.get("sql_expression") and not col.get("saved_metric"):
                col["name"] = DatasetValidator.get_canonical_column_name(
                    col["name"], dataset_context
                )
        DatasetValidator.normalize_filters(config_dict, dataset_context)
        return GaugeChartConfig.model_validate(config_dict)

    def schema_error_hint(self) -> ChartGenerationError | None:
        return ChartGenerationError(
            error_type="gauge_validation_error",
            message="Gauge chart configuration validation failed",
            details=(
                "The gauge chart configuration is missing required "
                "fields or has invalid structure"
            ),
            suggestions=[
                "Ensure 'metric' field has 'name' and 'aggregate'",
                "Example: {'chart_type': 'gauge_chart', "
                "'metric': {'name': 'progress', 'aggregate': 'AVG'}}",
            ],
            error_code="GAUGE_VALIDATION_ERROR",
        )
