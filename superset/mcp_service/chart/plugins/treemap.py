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

"""Treemap chart type plugin."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, ClassVar

from superset.mcp_service.chart.chart_utils import (
    _summarize_filters,
    _treemap_chart_what,
    map_treemap_config,
)
from superset.mcp_service.chart.plugin import BaseChartPlugin
from superset.mcp_service.chart.schemas import ColumnRef, TreemapChartConfig
from superset.mcp_service.chart.validation.dataset_validator import DatasetValidator
from superset.mcp_service.common.error_schemas import ChartGenerationError


class TreemapChartPlugin(BaseChartPlugin):
    """Plugin for treemap chart type."""

    chart_type = "treemap_v2"
    display_name = "Treemap"
    native_viz_types: ClassVar[Mapping[str, str]] = {
        "treemap_v2": "Treemap",
    }

    def pre_validate(
        self,
        config: dict[str, Any],
    ) -> ChartGenerationError | None:
        missing_fields = []

        if not config.get("groupby"):
            missing_fields.append("'groupby' (ordered hierarchy columns)")
        if "metric" not in config:
            missing_fields.append("'metric' (value metric sizing the tiles)")

        if missing_fields:
            return ChartGenerationError(
                error_type="missing_treemap_fields",
                message=(
                    f"Treemap chart missing required fields: "
                    f"{', '.join(missing_fields)}"
                ),
                details=(
                    "Treemaps size tiles by a metric and nest them by an "
                    "ordered groupby hierarchy (first column is the outermost "
                    "level)"
                ),
                suggestions=[
                    "Add 'groupby': [{'name': 'region'}, {'name': 'product'}]",
                    "Add 'metric': {'name': 'revenue', 'aggregate': 'SUM'}",
                    "Example: {'chart_type': 'treemap_v2', "
                    "'groupby': [{'name': 'region'}], "
                    "'metric': {'name': 'revenue', 'aggregate': 'SUM'}}",
                ],
                error_code="MISSING_TREEMAP_FIELDS",
            )

        return None

    def extract_column_refs(self, config: Any) -> list[ColumnRef]:
        if not isinstance(config, TreemapChartConfig):
            return []
        refs: list[ColumnRef] = [*config.groupby, config.metric]
        if config.filters:
            for f in config.filters:
                refs.append(ColumnRef(name=f.column))
        return refs

    def to_form_data(
        self, config: Any, dataset_id: int | str | None = None
    ) -> dict[str, Any]:
        return map_treemap_config(config)

    def generate_name(self, config: Any, dataset_name: str | None = None) -> str:
        what = _treemap_chart_what(config)
        context = _summarize_filters(config.filters)
        return self._with_context(what, context)

    def resolve_viz_type(self, config: Any) -> str:
        return "treemap_v2"

    def normalize_column_refs(self, config: Any, dataset_context: Any) -> Any:
        config_dict = config.model_dump()

        for col in config_dict.get("groupby") or []:
            if not col.get("sql_expression") and not col.get("saved_metric"):
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
        return TreemapChartConfig.model_validate(config_dict)

    def schema_error_hint(self) -> ChartGenerationError | None:
        return ChartGenerationError(
            error_type="treemap_validation_error",
            message="Treemap chart configuration validation failed",
            details=(
                "The treemap chart configuration is missing required "
                "fields or has invalid structure"
            ),
            suggestions=[
                "Ensure 'groupby' has at least one column for the hierarchy",
                "Ensure 'metric' field has 'name' and 'aggregate'",
                "Example: {'chart_type': 'treemap_v2', "
                "'groupby': [{'name': 'region'}], "
                "'metric': {'name': 'revenue', 'aggregate': 'SUM'}}",
            ],
            error_code="TREEMAP_VALIDATION_ERROR",
        )
