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

"""Histogram chart type plugin."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, ClassVar

from superset.mcp_service.chart.chart_utils import (
    _summarize_filters,
    map_histogram_config,
)
from superset.mcp_service.chart.plugin import BaseChartPlugin
from superset.mcp_service.chart.schemas import ColumnRef, HistogramChartConfig
from superset.mcp_service.chart.validation.dataset_validator import DatasetValidator
from superset.mcp_service.common.error_schemas import ChartGenerationError


class HistogramChartPlugin(BaseChartPlugin):
    """Plugin for histogram chart type."""

    chart_type = "histogram"
    display_name = "Histogram"
    native_viz_types: ClassVar[Mapping[str, str]] = {
        "histogram_v2": "Histogram",
    }

    def pre_validate(
        self,
        config: dict[str, Any],
    ) -> ChartGenerationError | None:
        if "column" not in config:
            return ChartGenerationError(
                error_type="missing_histogram_fields",
                message="Histogram missing required field: 'column'",
                details=(
                    "Histograms bin the values of a single numeric column "
                    "into frequency buckets"
                ),
                suggestions=[
                    "Add 'column' field: {'name': 'numeric_column'}",
                    "Example: {'chart_type': 'histogram', "
                    "'column': {'name': 'trip_duration'}, 'bins': 10}",
                ],
                error_code="MISSING_HISTOGRAM_FIELDS",
            )
        return None

    def extract_column_refs(self, config: Any) -> list[ColumnRef]:
        if not isinstance(config, HistogramChartConfig):
            return []
        refs: list[ColumnRef] = [config.column]
        refs.extend(config.groupby or [])
        if config.filters:
            for f in config.filters:
                refs.append(ColumnRef(name=f.column))
        return refs

    def to_form_data(
        self, config: Any, dataset_id: int | str | None = None
    ) -> dict[str, Any]:
        return map_histogram_config(config)

    def generate_name(self, config: Any, dataset_name: str | None = None) -> str:
        what = f"Distribution of {config.column.label or config.column.name}"
        if config.groupby:
            what += " by " + ", ".join(g.label or g.name for g in config.groupby)
        context = _summarize_filters(config.filters)
        return self._with_context(what, context)

    def resolve_viz_type(self, config: Any) -> str:
        return "histogram_v2"

    def normalize_column_refs(self, config: Any, dataset_context: Any) -> Any:
        config_dict = config.model_dump()

        column = config_dict.get("column")
        if column and not column.get("sql_expression"):
            column["name"] = DatasetValidator.get_canonical_column_name(
                column["name"], dataset_context
            )
        for col in config_dict.get("groupby") or []:
            if not col.get("sql_expression") and not col.get("saved_metric"):
                col["name"] = DatasetValidator.get_canonical_column_name(
                    col["name"], dataset_context
                )
        DatasetValidator.normalize_filters(config_dict, dataset_context)
        return HistogramChartConfig.model_validate(config_dict)

    def schema_error_hint(self) -> ChartGenerationError | None:
        return ChartGenerationError(
            error_type="histogram_validation_error",
            message="Histogram configuration validation failed",
            details=(
                "The histogram configuration is missing required fields or "
                "has invalid structure"
            ),
            suggestions=[
                "Ensure 'column' has 'name' pointing at a numeric column",
                "'bins' must be between 1 and 1000 (default 5)",
                "Example: {'chart_type': 'histogram', "
                "'column': {'name': 'fare_amount'}, 'bins': 20, "
                "'groupby': [{'name': 'payment_type'}]}",
            ],
            error_code="HISTOGRAM_VALIDATION_ERROR",
        )
