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

"""XY chart type plugin (line, bar, area, scatter)."""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any, ClassVar

from superset.mcp_service.chart.chart_utils import (
    _xy_chart_context,
    _xy_chart_what,
    create_metric_object,
    map_xy_config,
)
from superset.mcp_service.chart.plugin import BaseChartPlugin
from superset.mcp_service.chart.schemas import ColumnRef, SortByConfig, XYChartConfig
from superset.mcp_service.chart.validation.dataset_validator import DatasetValidator
from superset.mcp_service.chart.validation.runtime.cardinality_validator import (
    CardinalityValidator,
)
from superset.mcp_service.chart.validation.runtime.format_validator import (
    FormatTypeValidator,
)
from superset.mcp_service.common.error_schemas import ChartGenerationError

logger = logging.getLogger(__name__)


def _match_y_metric_name(
    raw_lower: str, y_configs: list[dict[str, Any]]
) -> str | None:
    for y_col in y_configs:
        if y_col.get("label") and y_col["label"].lower() == raw_lower:
            return y_col["label"]
        if y_col.get("name") and y_col["name"].lower() == raw_lower:
            return y_col["name"]
        agg = y_col.get("aggregate")
        name = y_col.get("name")
        if agg and name and f"{agg}({name})".lower() == raw_lower:
            return y_col.get("label") or f"{agg.upper()}({name})"
    return None


def _resolve_xy_sort_name(
    raw_name: str, config_dict: dict[str, Any], dataset_context: Any
) -> str:
    raw_lower = raw_name.lower()
    matched_y = _match_y_metric_name(raw_lower, config_dict.get("y") or [])
    if matched_y:
        return matched_y

    x_col = config_dict.get("x")
    if isinstance(x_col, dict):
        if x_col.get("label") and x_col["label"].lower() == raw_lower:
            return x_col["label"]
        if x_col.get("name") and x_col["name"].lower() == raw_lower:
            return DatasetValidator.get_canonical_column_name(
                x_col["name"], dataset_context
            )

    if dataset_context and getattr(dataset_context, "available_metrics", None):
        for m in dataset_context.available_metrics:
            if m.get("name") and m["name"].lower() == raw_lower:
                return DatasetValidator.get_canonical_metric_name(
                    raw_name, dataset_context
                )

    return DatasetValidator.get_canonical_column_name(raw_name, dataset_context)


def _update_sort_by_column(
    sort_item: Any,
    config_dict: dict[str, Any],
    dataset_context: Any,
) -> Any:
    if isinstance(sort_item, dict) and "column" in sort_item:
        sort_item["column"] = _resolve_xy_sort_name(
            sort_item["column"], config_dict, dataset_context
        )
        return sort_item
    if isinstance(sort_item, str):
        return _resolve_xy_sort_name(sort_item, config_dict, dataset_context)
    return sort_item


def _normalize_xy_sort_by(config_dict: dict[str, Any], dataset_context: Any) -> None:
    """Resolve canonical column or metric name for sort_by in XY charts."""
    sort_by = config_dict.get("sort_by")
    if not sort_by:
        return

    if isinstance(sort_by, list):
        if sort_by:
            sort_by[0] = _update_sort_by_column(
                sort_by[0], config_dict, dataset_context
            )
    else:
        config_dict["sort_by"] = _update_sort_by_column(
            sort_by, config_dict, dataset_context
        )


def _extract_sort_col_name(sort_entry: Any) -> str | None:
    if isinstance(sort_entry, list) and sort_entry:
        sort_entry = sort_entry[0]
    if isinstance(sort_entry, SortByConfig):
        return sort_entry.column
    if isinstance(sort_entry, str):
        return sort_entry
    if isinstance(sort_entry, dict):
        return sort_entry.get("column")
    return None


def _collect_y_metric_names(y_cols: list[ColumnRef]) -> set[str]:
    names: set[str] = set()
    for y_col in y_cols:
        if y_col.name:
            names.add(y_col.name.lower())
        if y_col.label:
            names.add(y_col.label.lower())
        if y_col.aggregate and y_col.name:
            names.add(f"{y_col.aggregate}({y_col.name})".lower())
        metric_obj = create_metric_object(y_col)
        label = (
            metric_obj
            if isinstance(metric_obj, str)
            else metric_obj.get("label")
        )
        if label:
            names.add(label.lower())
    return names


def _get_covered_xy_names(config: XYChartConfig) -> set[str]:
    """Collect lowercase names and labels already covered in x, y, and group_by."""
    covered = _collect_y_metric_names(config.y)
    if config.x:
        if config.x.name:
            covered.add(config.x.name.lower())
        if config.x.label:
            covered.add(config.x.label.lower())
    for gb in config.group_by or []:
        if gb.name:
            covered.add(gb.name.lower())
        if gb.label:
            covered.add(gb.label.lower())
    return covered


class XYChartPlugin(BaseChartPlugin):
    """Plugin for xy chart type (line, bar, area, scatter)."""

    chart_type = "xy"
    display_name = "Line / Bar / Area / Scatter Chart"
    native_viz_types: ClassVar[Mapping[str, str]] = {
        "echarts_timeseries_line": "Line Chart",
        "echarts_timeseries_bar": "Bar Chart",
        "echarts_area": "Area Chart",
        "echarts_timeseries_scatter": "Scatter Plot",
    }

    def pre_validate(
        self,
        config: dict[str, Any],
    ) -> ChartGenerationError | None:
        # x is optional — defaults to dataset's main_dttm_col in map_xy_config
        if not config.get("y") and not config.get("metrics"):
            return ChartGenerationError(
                error_type="missing_xy_fields",
                message="XY chart missing required field: 'y' (Y-axis metrics)",
                details=(
                    "XY charts require Y-axis (metrics) specifications. "
                    "X-axis is optional and defaults to the dataset's primary "
                    "datetime column when omitted."
                ),
                suggestions=[
                    "Add 'y' field: [{'name': 'metric_column', 'aggregate': 'SUM'}]",
                    "Example: {'chart_type': 'xy', 'x': {'name': 'date'}, "
                    "'y': [{'name': 'sales', 'aggregate': 'SUM'}]}",
                ],
                error_code="MISSING_XY_FIELDS",
            )

        if not isinstance(config.get("y", []), list):
            return ChartGenerationError(
                error_type="invalid_y_format",
                message="Y-axis must be a list of metrics",
                details="The 'y' field must be an array of metric specifications",
                suggestions=[
                    "Wrap Y-axis metric in array: 'y': [{'name': 'column', "
                    "'aggregate': 'SUM'}]",
                    "Multiple metrics supported: 'y': [metric1, metric2, ...]",
                ],
                error_code="INVALID_Y_FORMAT",
            )

        return None

    def extract_column_refs(self, config: Any) -> list[ColumnRef]:
        if not isinstance(config, XYChartConfig):
            return []
        refs: list[ColumnRef] = []
        if config.x is not None:
            refs.append(config.x)
        refs.extend(config.y)
        if config.group_by:
            refs.extend(config.group_by)
        if config.filters:
            for f in config.filters:
                refs.append(ColumnRef(name=f.column))
        if config.sort_by:
            sort_col = _extract_sort_col_name(config.sort_by)
            # Do not emit a separate column ref if sort_col refers to a
            # column or metric already represented in x, y, or group_by.
            # In particular, metric labels (e.g. "SUM(sales)") or custom labels
            # are not physical dataset columns and would fail validation.
            if sort_col and sort_col.lower() not in _get_covered_xy_names(config):
                refs.append(ColumnRef(name=sort_col))
        return refs

    def to_form_data(
        self, config: Any, dataset_id: int | str | None = None
    ) -> dict[str, Any]:
        return map_xy_config(config, dataset_id=dataset_id)

    def normalize_column_refs(self, config: Any, dataset_context: Any) -> Any:
        config_dict = config.model_dump()
        get_canonical = DatasetValidator.get_canonical_column_name
        get_canonical_metric = DatasetValidator.get_canonical_metric_name

        if config_dict.get("x"):
            config_dict["x"]["name"] = get_canonical(
                config_dict["x"]["name"], dataset_context
            )
        for y_col in config_dict.get("y") or []:
            if y_col.get("sql_expression"):
                continue  # sql_expression metrics have no underlying column
            if y_col.get("saved_metric"):
                y_col["name"] = get_canonical_metric(y_col["name"], dataset_context)
            else:
                y_col["name"] = get_canonical(y_col["name"], dataset_context)
        for gb_col in config_dict.get("group_by") or []:
            gb_col["name"] = get_canonical(gb_col["name"], dataset_context)

        _normalize_xy_sort_by(config_dict, dataset_context)

        DatasetValidator.normalize_filters(config_dict, dataset_context)
        return XYChartConfig.model_validate(config_dict)

    def generate_name(self, config: Any, dataset_name: str | None = None) -> str:
        what = _xy_chart_what(config)
        context = _xy_chart_context(config)
        return self._with_context(what, context)

    def resolve_viz_type(self, config: Any) -> str:
        kind = getattr(config, "kind", "line")
        return {
            "line": "echarts_timeseries_line",
            "bar": "echarts_timeseries_bar",
            "area": "echarts_area",
            "scatter": "echarts_timeseries_scatter",
        }.get(kind, "echarts_timeseries_line")

    def get_runtime_warnings(
        self, config: Any, dataset_id: int | str
    ) -> tuple[list[str], list[str]]:
        """Return format-compatibility and cardinality warnings for XY charts."""
        if not isinstance(config, XYChartConfig):
            return [], []

        warnings: list[str] = []
        suggestions: list[str] = []

        try:
            _valid, format_warnings = FormatTypeValidator.validate_format_compatibility(
                config
            )
            if format_warnings:
                warnings.extend(format_warnings)
        except Exception as exc:  # noqa: BLE001 — non-blocking warning path
            logger.warning("XY format validation failed: %s", exc)

        try:
            chart_kind = config.kind
            group_by_col = config.group_by[0].name if config.group_by else None
            if config.x is not None and config.x.name is not None:
                _ok, card_info = CardinalityValidator.check_cardinality(
                    dataset_id=dataset_id,
                    x_column=config.x.name,
                    chart_type=chart_kind,
                    group_by_column=group_by_col,
                )
                if not _ok and card_info:
                    warnings.extend(card_info.get("warnings", []))
                    suggestions.extend(card_info.get("suggestions", []))
        except Exception as exc:  # noqa: BLE001 — DB queries may raise infra errors
            logger.warning("XY cardinality validation failed: %s", exc)

        return warnings, suggestions

    def schema_error_hint(self) -> ChartGenerationError | None:
        return ChartGenerationError(
            error_type="xy_validation_error",
            message="XY chart configuration validation failed",
            details=(
                "The XY chart configuration is missing required "
                "fields or has invalid structure"
            ),
            suggestions=[
                "Note: 'x' is optional and defaults to the dataset's primary "
                "datetime column",
                "Ensure 'y' is an array: [{'name': 'metric', 'aggregate': 'SUM'}]",
                "Check that all column names are strings",
                "Verify aggregate functions are valid: SUM, COUNT, AVG, MIN, MAX",
            ],
            error_code="XY_VALIDATION_ERROR",
        )
