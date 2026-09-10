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

"""Funnel chart type plugin."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, ClassVar

from superset.mcp_service.chart.chart_utils import (
    _funnel_chart_what,
    _summarize_filters,
    map_funnel_config,
)
from superset.mcp_service.chart.plugin import BaseChartPlugin
from superset.mcp_service.chart.schemas import ColumnRef, FunnelChartConfig
from superset.mcp_service.chart.validation.dataset_validator import DatasetValidator
from superset.mcp_service.common.error_schemas import ChartGenerationError


class FunnelChartPlugin(BaseChartPlugin):
    """Plugin for funnel chart type."""

    chart_type = "funnel"
    display_name = "Funnel Chart"
    native_viz_types: ClassVar[Mapping[str, str]] = {
        "funnel": "Funnel Chart",
    }

    def pre_validate(
        self,
        config: dict[str, Any],
    ) -> ChartGenerationError | None:
        missing_fields = []

        if "dimension" not in config and "groupby" not in config:
            missing_fields.append("'dimension' (category column for funnel stages)")
        if "metric" not in config:
            missing_fields.append("'metric' (value metric sizing each stage)")

        if missing_fields:
            return ChartGenerationError(
                error_type="missing_funnel_fields",
                message=(
                    f"Funnel chart missing required fields: {', '.join(missing_fields)}"
                ),
                details=(
                    "Funnel charts require a dimension (the stages) and a "
                    "metric (the value that shrinks from stage to stage)"
                ),
                suggestions=[
                    "Add 'dimension' field: {'name': 'stage'}",
                    "Add 'metric' field: {'name': 'leads', 'aggregate': 'SUM'}",
                    "Example: {'chart_type': 'funnel', 'dimension': {'name': 'stage'}, "
                    "'metric': {'name': 'leads', 'aggregate': 'SUM'}}",
                ],
                error_code="MISSING_FUNNEL_FIELDS",
            )

        return None

    def extract_column_refs(self, config: Any) -> list[ColumnRef]:
        if not isinstance(config, FunnelChartConfig):
            return []
        refs: list[ColumnRef] = [config.dimension, config.metric]
        if config.filters:
            for f in config.filters:
                refs.append(ColumnRef(name=f.column))
        return refs

    def to_form_data(
        self, config: Any, dataset_id: int | str | None = None
    ) -> dict[str, Any]:
        return map_funnel_config(config)

    def generate_name(self, config: Any, dataset_name: str | None = None) -> str:
        what = _funnel_chart_what(config)
        context = _summarize_filters(config.filters)
        return self._with_context(what, context)

    def resolve_viz_type(self, config: Any) -> str:
        return "funnel"

    def normalize_column_refs(self, config: Any, dataset_context: Any) -> Any:
        config_dict = config.model_dump()

        if config_dict.get("dimension"):
            dim = config_dict["dimension"]
            if not dim.get("sql_expression") and not dim.get("saved_metric"):
                dim["name"] = DatasetValidator.get_canonical_column_name(
                    dim["name"], dataset_context
                )
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
        DatasetValidator.normalize_filters(config_dict, dataset_context)
        return FunnelChartConfig.model_validate(config_dict)

    def schema_error_hint(self) -> ChartGenerationError | None:
        return ChartGenerationError(
            error_type="funnel_validation_error",
            message="Funnel chart configuration validation failed",
            details=(
                "The funnel chart configuration is missing required "
                "fields or has invalid structure"
            ),
            suggestions=[
                "Ensure 'dimension' field has 'name' for the stage label",
                "Ensure 'metric' field has 'name' and 'aggregate'",
                "Example: {'chart_type': 'funnel', 'dimension': {'name': 'stage'}, "
                "'metric': {'name': 'leads', 'aggregate': 'SUM'}}",
            ],
            error_code="FUNNEL_VALIDATION_ERROR",
        )
