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

"""ECharts Gantt chart type plugin."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, ClassVar

from pydantic import ValidationError

from superset.mcp_service.chart.chart_utils import _summarize_filters, map_gantt_config
from superset.mcp_service.chart.plugin import BaseChartPlugin
from superset.mcp_service.chart.schemas import ColumnRef, GanttChartConfig
from superset.mcp_service.chart.validation.dataset_validator import (
    DatasetValidator,
    GanttSemanticNormalizationError,
)
from superset.mcp_service.common.error_schemas import ChartGenerationError


def _canonical_gantt_reference(name: str, names: list[str], reference_kind: str) -> str:
    """Resolve one case-insensitive reference without guessing on ambiguity."""
    matches = [
        candidate for candidate in names if candidate.casefold() == name.casefold()
    ]
    if name in matches:
        return name
    if len(matches) > 1:
        choices = ", ".join(repr(match) for match in matches)
        raise GanttSemanticNormalizationError(
            f"Gantt {reference_kind} reference {name!r} is ambiguous because the "
            f"dataset contains {reference_kind}s that differ only by case: {choices}. "
            f"Use the exact {reference_kind} name."
        )
    return matches[0] if matches else name


class GanttChartPlugin(BaseChartPlugin):
    """Plugin matching ``plugin-chart-echarts/src/Gantt``."""

    chart_type = "gantt"
    display_name = "Gantt Chart"
    native_viz_types: ClassVar[Mapping[str, str]] = {
        "gantt_chart": "Gantt Chart",
    }

    def pre_validate(self, config: dict[str, Any]) -> ChartGenerationError | None:
        aliases = {
            "start_time": ("start_time", "startTime", "start"),
            "end_time": ("end_time", "endTime", "end"),
            "category": ("category", "task", "y_axis", "yAxis"),
        }
        missing = [
            name
            for name, keys in aliases.items()
            if not any(key in config for key in keys)
        ]
        if not missing:
            return None
        return ChartGenerationError(
            error_type="missing_gantt_fields",
            message=f"Gantt chart missing required fields: {', '.join(missing)}",
            details=(
                "A Gantt task needs temporal start/end columns and one task/category "
                "dimension (the frontend's y_axis control)."
            ),
            suggestions=[
                "Add start_time: {'name': 'start_time'}",
                "Add end_time: {'name': 'end_time'}",
                "Add category: {'name': 'task_name'}",
            ],
            error_code="MISSING_GANTT_FIELDS",
        )

    def extract_column_refs(self, config: Any) -> list[ColumnRef]:
        if not isinstance(config, GanttChartConfig):
            return []
        refs = [config.start_time, config.end_time, config.category]
        if config.series:
            refs.append(config.series)
        refs.extend(config.tooltip_columns)
        refs.extend(config.tooltip_metrics)
        refs.extend(ColumnRef(name=order.column) for order in config.order_by)
        refs.extend(ColumnRef(name=filter_.column) for filter_ in config.filters or [])
        return refs

    def to_form_data(
        self, config: Any, dataset_id: int | str | None = None
    ) -> dict[str, Any]:
        return map_gantt_config(config)

    def post_map_validate(
        self,
        config: Any,
        form_data: dict[str, Any],
        dataset_id: int | str | None = None,
    ) -> ChartGenerationError | None:
        """Enforce the temporal controls declared by the frontend contract."""
        if not isinstance(config, GanttChartConfig) or dataset_id is None:
            return None
        dataset_context = DatasetValidator._get_dataset_context(dataset_id)
        if dataset_context is None:
            return None

        non_temporal: list[str] = []
        for ref in (config.start_time, config.end_time):
            column = next(
                (
                    column
                    for column in dataset_context.available_columns
                    if column["name"].casefold() == (ref.name or "").casefold()
                ),
                None,
            )
            # Existence validation owns missing columns; avoid double-reporting.
            if column is not None and not column.get("is_temporal", False):
                non_temporal.append(ref.name or "")

        if not non_temporal:
            return None
        temporal_columns = sorted(
            column["name"]
            for column in dataset_context.available_columns
            if column.get("is_temporal", False)
        )
        return ChartGenerationError(
            error_type="non_temporal_gantt_time_column",
            message=(
                "Gantt start_time and end_time must be temporal columns; "
                f"non-temporal: {', '.join(non_temporal)}"
            ),
            details=(
                "The Explore control panel restricts both fields to Temporal. "
                "Using strings or numeric IDs would produce invalid task intervals."
            ),
            suggestions=(
                [f"Temporal columns in this dataset: {', '.join(temporal_columns)}"]
                if temporal_columns
                else ["Use get_dataset_info to inspect temporal dataset columns"]
            ),
            error_code="NON_TEMPORAL_GANTT_TIME_COLUMN",
        )

    def normalize_column_refs(  # noqa: C901
        self, config: Any, dataset_context: Any
    ) -> Any:
        explicit_fields = set(config.model_fields_set)
        config_dict = config.model_dump()
        column_names = [column["name"] for column in dataset_context.available_columns]
        metric_names = [metric["name"] for metric in dataset_context.available_metrics]

        def canonical_column(name: str, _context: Any) -> str:
            return _canonical_gantt_reference(name, column_names, "physical column")

        def canonical_metric(name: str, _context: Any) -> str:
            return _canonical_gantt_reference(name, metric_names, "saved metric")

        if temporal_column := config_dict.get("temporal_column"):
            config_dict["temporal_column"] = canonical_column(
                temporal_column, dataset_context
            )
        for key in ("start_time", "end_time", "category", "series"):
            if ref := config_dict.get(key):
                ref["name"] = canonical_column(ref["name"], dataset_context)
        for ref in config_dict.get("tooltip_columns") or []:
            ref["name"] = canonical_column(ref["name"], dataset_context)
        for ref in config_dict.get("tooltip_metrics") or []:
            if ref.get("sql_expression"):
                continue
            resolver = canonical_metric if ref.get("saved_metric") else canonical_column
            ref["name"] = resolver(ref["name"], dataset_context)
        for order in config_dict.get("order_by") or []:
            order["column"] = canonical_column(order["column"], dataset_context)
        DatasetValidator.normalize_filters(config_dict, dataset_context)
        try:
            normalized = GanttChartConfig.model_validate(config_dict)
        except ValidationError as ex:
            reasons = "; ".join(error["msg"] for error in ex.errors()[:3])
            raise GanttSemanticNormalizationError(
                "Gantt column normalization produced an invalid semantic "
                f"configuration: {reasons}"
            ) from ex
        # ``model_dump()`` necessarily contains defaults, but mapping relies on
        # ``model_fields_set`` to distinguish omitted presentation controls from
        # explicitly supplied default values. Keep that request-level intent
        # after canonicalizing column names.
        normalized.model_fields_set.clear()
        normalized.model_fields_set.update(explicit_fields)
        return normalized

    def generate_name(self, config: Any, dataset_name: str | None = None) -> str:
        category = config.category.label or config.category.name
        what = f"{category} schedule"
        if config.series:
            what += f" by {config.series.label or config.series.name}"
        return self._with_context(what, _summarize_filters(config.filters))

    def resolve_viz_type(self, config: Any) -> str:
        return "gantt_chart"

    def schema_error_hint(self) -> ChartGenerationError | None:
        return ChartGenerationError(
            error_type="gantt_validation_error",
            message="Gantt chart configuration validation failed",
            details=(
                "Gantt requires distinct temporal start/end columns and one "
                "task/category dimension."
            ),
            suggestions=[
                "Use start_time and end_time ColumnRefs for temporal columns",
                "Use category (aliases: task, y_axis) for the task row dimension",
                "tooltip_metrics must be aggregate or saved metrics",
                "Use series to color tasks; subcategories=True requires series",
            ],
            error_code="GANTT_VALIDATION_ERROR",
        )
