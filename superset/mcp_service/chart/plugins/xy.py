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
from typing import Any

from superset.mcp_service.chart.plugin import BaseChartPlugin
from superset.mcp_service.chart.schemas import ColumnRef
from superset.mcp_service.common.error_schemas import ChartGenerationError

logger = logging.getLogger(__name__)


class XYChartPlugin(BaseChartPlugin):
    """Plugin for xy chart type (line, bar, area, scatter)."""

    chart_type = "xy"
    display_name = "Line / Bar / Area / Scatter Chart"
    native_viz_types = {
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
        if "y" not in config:
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
        from superset.mcp_service.chart.schemas import XYChartConfig

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
        return refs

    def to_form_data(
        self, config: Any, dataset_id: int | str | None = None
    ) -> dict[str, Any]:
        from superset.mcp_service.chart.chart_utils import map_xy_config

        return map_xy_config(config, dataset_id=dataset_id)

    def normalize_column_refs(self, config: Any, dataset_context: Any) -> Any:
        from superset.mcp_service.chart.schemas import XYChartConfig
        from superset.mcp_service.chart.validation.dataset_validator import (
            DatasetValidator,
        )

        config_dict = config.model_dump()
        get_canonical = DatasetValidator._get_canonical_column_name

        if config_dict.get("x"):
            config_dict["x"]["name"] = get_canonical(
                config_dict["x"]["name"], dataset_context
            )
        for y_col in config_dict.get("y") or []:
            y_col["name"] = get_canonical(y_col["name"], dataset_context)
        for gb_col in config_dict.get("group_by") or []:
            gb_col["name"] = get_canonical(gb_col["name"], dataset_context)

        DatasetValidator._normalize_filters(config_dict, dataset_context)
        return XYChartConfig.model_validate(config_dict)

    def generate_name(self, config: Any, dataset_name: str | None = None) -> str:
        from superset.mcp_service.chart.chart_utils import (
            _xy_chart_context,
            _xy_chart_what,
        )

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

    def get_runtime_warnings(self, config: Any, dataset_id: int | str) -> list[str]:
        """Return format-compatibility and cardinality warnings for XY charts."""
        from superset.mcp_service.chart.schemas import XYChartConfig

        if not isinstance(config, XYChartConfig):
            return []

        warnings: list[str] = []

        try:
            from superset.mcp_service.chart.validation.runtime.format_validator import (
                FormatTypeValidator,
            )

            _valid, format_warnings = FormatTypeValidator.validate_format_compatibility(
                config
            )
            if format_warnings:
                warnings.extend(format_warnings)
        except Exception as exc:
            logger.warning("XY format validation failed: %s", exc)

        try:
            from superset.mcp_service.chart.validation.runtime.cardinality_validator import (  # noqa: E501
                CardinalityValidator,
            )

            chart_kind = config.kind
            group_by_col = config.group_by[0].name if config.group_by else None
            if config.x is not None:
                _ok, card_info = CardinalityValidator.check_cardinality(
                    dataset_id=dataset_id,
                    x_column=config.x.name,
                    chart_type=chart_kind,
                    group_by_column=group_by_col,
                )
                if not _ok and card_info:
                    warnings.extend(card_info.get("warnings", []))
                    warnings.extend(card_info.get("suggestions", []))
        except Exception as exc:
            logger.warning("XY cardinality validation failed: %s", exc)

        return warnings
