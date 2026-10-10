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
from superset.mcp_service.chart.schemas import (
    ChartError,
    ColumnRef,
    SortByConfig,
    VegaLitePreview,
    XYChartConfig,
)
from superset.mcp_service.chart.validation.dataset_validator import DatasetValidator
from superset.mcp_service.chart.validation.runtime.cardinality_validator import (
    CardinalityValidator,
)
from superset.mcp_service.chart.validation.runtime.format_validator import (
    FormatTypeValidator,
)
from superset.mcp_service.common.error_schemas import ChartGenerationError

logger = logging.getLogger(__name__)


def _match_y_metric_name(raw_lower: str, y_configs: list[dict[str, Any]]) -> str | None:
    for y_col in y_configs:
        if y_col.get("label") and y_col["label"].lower() == raw_lower:
            return y_col["label"]
        if y_col.get("name") and y_col["name"].lower() == raw_lower:
            return y_col.get("label") or y_col["name"]
        if y_col.get("sql_expression") and y_col["sql_expression"].lower() == raw_lower:
            return y_col.get("label") or y_col["sql_expression"]
        agg = y_col.get("aggregate")
        name = y_col.get("name")
        if agg and name and f"{agg}({name})".lower() == raw_lower:
            return y_col.get("label") or f"{agg.upper()}({name})"
    return None


def _resolve_xy_sort_name_and_metric_status(
    raw_name: str, config_dict: dict[str, Any], dataset_context: Any
) -> tuple[str, bool]:
    raw_lower = raw_name.lower()
    if matched_y := _match_y_metric_name(raw_lower, config_dict.get("y") or []):
        return matched_y, False

    x_col = config_dict.get("x")
    if isinstance(x_col, dict):
        if x_col.get("label") and x_col["label"].lower() == raw_lower:
            return x_col["label"], False
        if x_col.get("name") and x_col["name"].lower() == raw_lower:
            return (
                DatasetValidator.get_canonical_column_name(
                    x_col["name"], dataset_context
                ),
                False,
            )

    if dataset_context and getattr(dataset_context, "available_metrics", None):
        for m in dataset_context.available_metrics:
            if m.get("name") and m["name"].lower() == raw_lower:
                return (
                    DatasetValidator.get_canonical_metric_name(
                        raw_name, dataset_context
                    ),
                    True,
                )

    return DatasetValidator.get_canonical_column_name(raw_name, dataset_context), False


def _update_sort_by_column(
    sort_item: Any,
    config_dict: dict[str, Any],
    dataset_context: Any,
) -> Any:
    if isinstance(sort_item, dict) and "column" in sort_item:
        canonical_name, is_saved = _resolve_xy_sort_name_and_metric_status(
            sort_item["column"], config_dict, dataset_context
        )
        sort_item["column"] = canonical_name
        if is_saved:
            sort_item["saved_metric"] = True
        return sort_item
    if isinstance(sort_item, str):
        canonical_name, is_saved = _resolve_xy_sort_name_and_metric_status(
            sort_item, config_dict, dataset_context
        )
        return {
            "column": canonical_name,
            "ascending": False,
            "saved_metric": is_saved or None,
        }
    if isinstance(sort_item, SortByConfig):
        canonical_name, is_saved = _resolve_xy_sort_name_and_metric_status(
            sort_item.column, config_dict, dataset_context
        )
        return SortByConfig(
            column=canonical_name,
            ascending=sort_item.ascending,
            saved_metric=sort_item.saved_metric or (True if is_saved else None),
        )
    return sort_item


def _normalize_xy_sort_by(config_dict: dict[str, Any], dataset_context: Any) -> None:
    """Resolve canonical column or metric name for sort_by in XY charts."""
    if not (sort_by := config_dict.get("sort_by")):
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


def _extract_sort_col_info(sort_entry: Any) -> tuple[str | None, bool]:
    if isinstance(sort_entry, (list, tuple)) and sort_entry:
        sort_entry = sort_entry[0]
    if isinstance(sort_entry, SortByConfig):
        return sort_entry.column, bool(sort_entry.saved_metric)
    if isinstance(sort_entry, str):
        return sort_entry, False
    if isinstance(sort_entry, dict):
        return sort_entry.get("column"), bool(sort_entry.get("saved_metric"))
    return None, False


def _add_column_ref_names(ref: ColumnRef | None, names: set[str]) -> None:
    """Add lowercase name, label, and sql_expression of a column ref to names."""
    if not ref:
        return
    if ref.name:
        names.add(ref.name.lower())
    if ref.label:
        names.add(ref.label.lower())
    if ref.sql_expression:
        names.add(ref.sql_expression.lower())


def _collect_y_metric_names(y_cols: list[ColumnRef] | None) -> set[str]:
    names: set[str] = set()
    for y_col in y_cols or []:
        _add_column_ref_names(y_col, names)
        if y_col.aggregate and y_col.name:
            names.add(f"{y_col.aggregate}({y_col.name})".lower())
        metric_obj = create_metric_object(y_col)
        label = metric_obj if isinstance(metric_obj, str) else metric_obj.get("label")
        if label:
            names.add(label.lower())
    return names


def _get_covered_xy_names(config: XYChartConfig) -> set[str]:
    """Collect lowercase names and labels already covered in x, y, and group_by."""
    covered = _collect_y_metric_names(config.y)
    _add_column_ref_names(config.x, covered)
    for gb in config.group_by or []:
        _add_column_ref_names(gb, covered)
    return covered


class XYChartPlugin(BaseChartPlugin):
    """Plugin for xy chart type (line, bar, area, scatter)."""

    chart_type = "xy"
    display_name = "Line / Bar / Area / Scatter Chart"
    resizes_saved_preview = True
    native_viz_types: ClassVar[Mapping[str, str]] = {
        "echarts_timeseries_line": "Line Chart",
        "echarts_timeseries_bar": "Bar Chart",
        "echarts_area": "Area Chart",
        "echarts_timeseries_scatter": "Scatter Plot",
    }
    query_role_keys = BaseChartPlugin.query_role_keys | {"x_axis"}

    def vega_lite_preview(
        self, data: list[Any], form_data: dict[str, Any]
    ) -> VegaLitePreview | ChartError | None:
        """Adapt flattened timeseries series into the XY preview encoding."""
        from superset.mcp_service.chart.preview_utils import (
            generate_xy_vega_lite_preview,
        )

        return generate_xy_vega_lite_preview(data, form_data)

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
        for metric in (config.series_limit_metric, config.timeseries_limit_metric):
            if metric is not None:
                refs.append(metric)
        if config.group_by:
            refs.extend(config.group_by)
        if config.filters:
            for f in config.filters:
                refs.append(ColumnRef(name=f.column))
        if config.sort_by:
            sort_col, is_saved = _extract_sort_col_info(config.sort_by)
            # Do not emit a separate column ref if sort_col refers to a
            # column or metric already represented in x, y, or group_by.
            # In particular, metric labels (e.g. "SUM(sales)") or custom labels
            # are not physical dataset columns and would fail validation.
            if sort_col and sort_col.lower() not in _get_covered_xy_names(config):
                refs.append(ColumnRef(name=sort_col, saved_metric=is_saved))
        return refs

    def to_form_data(
        self, config: Any, dataset_id: int | str | None = None
    ) -> dict[str, Any]:
        return map_xy_config(config, dataset_id=dataset_id)

    def normalize_column_refs(self, config: Any, dataset_context: Any) -> Any:
        config_dict = config.model_dump(exclude_unset=True)
        get_canonical = DatasetValidator.get_canonical_column_name
        get_canonical_metric = DatasetValidator.get_canonical_metric_name

        if config_dict.get("x"):
            config_dict["x"]["name"] = get_canonical(
                config_dict["x"]["name"], dataset_context
            )
        metrics = list(config_dict.get("y") or [])
        metrics.extend(
            config_dict[key]
            for key in ("series_limit_metric", "timeseries_limit_metric")
            if config_dict.get(key)
        )
        for y_col in metrics:
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
