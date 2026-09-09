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

"""Sankey chart type plugin."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, ClassVar

from superset.mcp_service.chart.chart_utils import (
    _sankey_chart_what,
    _summarize_filters,
    map_sankey_config,
)
from superset.mcp_service.chart.plugin import BaseChartPlugin
from superset.mcp_service.chart.schemas import ColumnRef, SankeyChartConfig
from superset.mcp_service.chart.validation.dataset_validator import DatasetValidator
from superset.mcp_service.common.error_schemas import ChartGenerationError


class SankeyChartPlugin(BaseChartPlugin):
    """Plugin for sankey chart type."""

    chart_type = "sankey_v2"
    display_name = "Sankey Diagram"
    native_viz_types: ClassVar[Mapping[str, str]] = {
        "sankey_v2": "Sankey Diagram",
    }

    def pre_validate(
        self,
        config: dict[str, Any],
    ) -> ChartGenerationError | None:
        missing_fields = []

        if "source" not in config:
            missing_fields.append("'source' (origin node column)")
        if "target" not in config:
            missing_fields.append("'target' (destination node column)")
        if "metric" not in config:
            missing_fields.append("'metric' (edge weight)")

        if missing_fields:
            return ChartGenerationError(
                error_type="missing_sankey_fields",
                message=(
                    f"Sankey chart missing required fields: {', '.join(missing_fields)}"
                ),
                details=(
                    "Sankey diagrams draw weighted flows from a source node to "
                    "a target node; the metric sets each edge's width"
                ),
                suggestions=[
                    "Add 'source': {'name': 'from_stage'}",
                    "Add 'target': {'name': 'to_stage'}",
                    "Add 'metric': {'name': 'users', 'aggregate': 'SUM'}",
                    "Example: {'chart_type': 'sankey_v2', "
                    "'source': {'name': 'from_stage'}, "
                    "'target': {'name': 'to_stage'}, "
                    "'metric': {'name': 'users', 'aggregate': 'SUM'}}",
                ],
                error_code="MISSING_SANKEY_FIELDS",
            )

        return None

    def extract_column_refs(self, config: Any) -> list[ColumnRef]:
        if not isinstance(config, SankeyChartConfig):
            return []
        refs: list[ColumnRef] = [config.source, config.target, config.metric]
        if config.filters:
            for f in config.filters:
                refs.append(ColumnRef(name=f.column))
        return refs

    def to_form_data(
        self, config: Any, dataset_id: int | str | None = None
    ) -> dict[str, Any]:
        return map_sankey_config(config)

    def generate_name(self, config: Any, dataset_name: str | None = None) -> str:
        what = _sankey_chart_what(config)
        context = _summarize_filters(config.filters)
        return self._with_context(what, context)

    def resolve_viz_type(self, config: Any) -> str:
        return "sankey_v2"

    def normalize_column_refs(self, config: Any, dataset_context: Any) -> Any:
        config_dict = config.model_dump()

        for key in ("source", "target"):
            col = config_dict.get(key)
            if col and not col.get("sql_expression") and not col.get("saved_metric"):
                col["name"] = DatasetValidator.get_canonical_column_name(
                    col["name"], dataset_context
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
        return SankeyChartConfig.model_validate(config_dict)

    def schema_error_hint(self) -> ChartGenerationError | None:
        return ChartGenerationError(
            error_type="sankey_validation_error",
            message="Sankey chart configuration validation failed",
            details=(
                "The sankey chart configuration is missing required "
                "fields or has invalid structure"
            ),
            suggestions=[
                "Ensure 'source' and 'target' each have a 'name'",
                "Ensure 'metric' field has 'name' and 'aggregate'",
                "Example: {'chart_type': 'sankey_v2', "
                "'source': {'name': 'from_stage'}, "
                "'target': {'name': 'to_stage'}, "
                "'metric': {'name': 'users', 'aggregate': 'SUM'}}",
            ],
            error_code="SANKEY_VALIDATION_ERROR",
        )
