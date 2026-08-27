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

"""Box plot chart type plugin."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, ClassVar

from superset.mcp_service.chart.chart_utils import (
    _summarize_filters,
    map_box_plot_config,
)
from superset.mcp_service.chart.plugin import BaseChartPlugin
from superset.mcp_service.chart.schemas import BoxPlotChartConfig, ColumnRef
from superset.mcp_service.chart.validation.dataset_validator import DatasetValidator
from superset.mcp_service.common.error_schemas import ChartGenerationError


class BoxPlotChartPlugin(BaseChartPlugin):
    """Plugin for box plot chart type."""

    chart_type = "box_plot"
    display_name = "Box Plot"
    native_viz_types: ClassVar[Mapping[str, str]] = {
        "box_plot": "Box Plot",
    }

    def pre_validate(
        self,
        config: dict[str, Any],
    ) -> ChartGenerationError | None:
        missing_fields = []
        if "metrics" not in config:
            missing_fields.append("'metrics' (values whose spread is plotted)")
        if "distribute_across" not in config and "columns" not in config:
            missing_fields.append(
                "'distribute_across' (columns whose values form the samples "
                "inside each box, e.g. a temporal column)"
            )

        if missing_fields:
            return ChartGenerationError(
                error_type="missing_box_plot_fields",
                message=(
                    f"Box plot missing required fields: {', '.join(missing_fields)}"
                ),
                details=(
                    "Box plots compute each metric's distribution across the "
                    "distribute_across values; add 'dimensions' to split the "
                    "chart into one box per dimension value"
                ),
                suggestions=[
                    "Add 'metrics': [{'name': 'value_column', 'aggregate': 'AVG'}] "
                    "(or {'name': 'saved', 'saved_metric': True})",
                    "Add 'distribute_across': [{'name': 'category_column'}]",
                    "Example: {'chart_type': 'box_plot', 'metrics': "
                    "[{'name': 'fare', 'aggregate': 'AVG'}], "
                    "'distribute_across': [{'name': 'month'}], "
                    "'dimensions': [{'name': 'day_of_week'}]}",
                ],
                error_code="MISSING_BOX_PLOT_FIELDS",
            )
        return None

    def extract_column_refs(self, config: Any) -> list[ColumnRef]:
        if not isinstance(config, BoxPlotChartConfig):
            return []
        refs: list[ColumnRef] = []
        refs.extend(config.metrics)
        refs.extend(config.distribute_across)
        refs.extend(config.dimensions or [])
        if config.filters:
            for f in config.filters:
                refs.append(ColumnRef(name=f.column))
        return refs

    def to_form_data(
        self, config: Any, dataset_id: int | str | None = None
    ) -> dict[str, Any]:
        return map_box_plot_config(config)

    def generate_name(self, config: Any, dataset_name: str | None = None) -> str:
        metric_names = ", ".join(m.label or m.name for m in config.metrics)
        if config.dimensions:
            split = ", ".join(d.label or d.name for d in config.dimensions)
            what = f"{metric_names} distribution by {split}"
        else:
            what = f"{metric_names} distribution"
        context = _summarize_filters(config.filters)
        return self._with_context(what, context)

    def resolve_viz_type(self, config: Any) -> str:
        return "box_plot"

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
        for key in ("distribute_across", "dimensions"):
            for col in config_dict.get(key) or []:
                if not col.get("sql_expression") and not col.get("saved_metric"):
                    col["name"] = DatasetValidator.get_canonical_column_name(
                        col["name"], dataset_context
                    )
        DatasetValidator.normalize_filters(config_dict, dataset_context)
        return BoxPlotChartConfig.model_validate(config_dict)

    def schema_error_hint(self) -> ChartGenerationError | None:
        return ChartGenerationError(
            error_type="box_plot_validation_error",
            message="Box plot configuration validation failed",
            details=(
                "The box plot configuration is missing required fields or "
                "has invalid structure"
            ),
            suggestions=[
                "Ensure 'metrics' is a non-empty list; each entry needs 'name' "
                "plus 'aggregate' (or saved_metric=True for a saved metric)",
                "'distribute_across' = sample axis (e.g. a temporal column); "
                "'dimensions' = one box per value",
                "whisker_type='percentile' requires percentile_low < percentile_high",
                "Example: {'chart_type': 'box_plot', 'metrics': "
                "[{'name': 'fare', 'aggregate': 'AVG'}], "
                "'distribute_across': [{'name': 'month'}], "
                "'dimensions': [{'name': 'day_of_week'}], "
                "'whisker_type': 'tukey'}",
            ],
            error_code="BOX_PLOT_VALIDATION_ERROR",
        )
