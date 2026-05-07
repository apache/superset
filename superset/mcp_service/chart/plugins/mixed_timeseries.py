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

"""Mixed timeseries chart type plugin."""

from __future__ import annotations

from typing import Any

from superset.mcp_service.chart.plugin import BaseChartPlugin
from superset.mcp_service.chart.schemas import ColumnRef
from superset.mcp_service.common.error_schemas import ChartGenerationError


class MixedTimeseriesChartPlugin(BaseChartPlugin):
    """Plugin for mixed_timeseries chart type."""

    chart_type = "mixed_timeseries"
    display_name = "Mixed Timeseries"
    native_viz_types = {
        "mixed_timeseries": "Mixed Timeseries Chart",
    }

    def pre_validate(
        self,
        config: dict[str, Any],
    ) -> ChartGenerationError | None:
        missing_fields = []

        if "x" not in config:
            missing_fields.append("'x' (X-axis temporal column)")
        if "y" not in config:
            missing_fields.append("'y' (primary Y-axis metrics)")
        if "y_secondary" not in config:
            missing_fields.append("'y_secondary' (secondary Y-axis metrics)")

        if missing_fields:
            return ChartGenerationError(
                error_type="missing_mixed_timeseries_fields",
                message=(
                    f"Mixed timeseries chart missing required fields: "
                    f"{', '.join(missing_fields)}"
                ),
                details=(
                    "Mixed timeseries charts require an x-axis, primary metrics, "
                    "and secondary metrics"
                ),
                suggestions=[
                    "Add 'x' field: {'name': 'date_column'}",
                    "Add 'y' field: [{'name': 'revenue', 'aggregate': 'SUM'}]",
                    "Add 'y_secondary': [{'name': 'orders', 'aggregate': 'COUNT'}]",
                    "Optional: 'primary_kind' and 'secondary_kind' for chart types",
                ],
                error_code="MISSING_MIXED_TIMESERIES_FIELDS",
            )

        for field_name in ["y", "y_secondary"]:
            if not isinstance(config.get(field_name, []), list):
                return ChartGenerationError(
                    error_type=f"invalid_{field_name}_format",
                    message=f"'{field_name}' must be a list of metrics",
                    details=(
                        f"The '{field_name}' field must be an array of metric "
                        "specifications"
                    ),
                    suggestions=[
                        f"Wrap in array: '{field_name}': "
                        "[{'name': 'col', 'aggregate': 'SUM'}]",
                    ],
                    error_code=f"INVALID_{field_name.upper()}_FORMAT",
                )

        return None

    def extract_column_refs(self, config: Any) -> list[ColumnRef]:
        from superset.mcp_service.chart.schemas import MixedTimeseriesChartConfig

        if not isinstance(config, MixedTimeseriesChartConfig):
            return []
        refs: list[ColumnRef] = [config.x]
        refs.extend(config.y)
        refs.extend(config.y_secondary)
        if config.group_by:
            refs.extend(config.group_by)
        if config.group_by_secondary:
            refs.extend(config.group_by_secondary)
        if config.filters:
            for f in config.filters:
                refs.append(ColumnRef(name=f.column))
        return refs

    def to_form_data(
        self, config: Any, dataset_id: int | str | None = None
    ) -> dict[str, Any]:
        from superset.mcp_service.chart.chart_utils import map_mixed_timeseries_config

        return map_mixed_timeseries_config(config, dataset_id=dataset_id)

    def generate_name(self, config: Any, dataset_name: str | None = None) -> str:
        from superset.mcp_service.chart.chart_utils import (
            _mixed_timeseries_what,
            _summarize_filters,
        )

        what = _mixed_timeseries_what(config)
        context = _summarize_filters(config.filters)
        return self._with_context(what, context)

    def resolve_viz_type(self, config: Any) -> str:
        return "mixed_timeseries"

    def normalize_column_refs(self, config: Any, dataset_context: Any) -> Any:
        from superset.mcp_service.chart.schemas import MixedTimeseriesChartConfig
        from superset.mcp_service.chart.validation.dataset_validator import (
            DatasetValidator,
        )

        config_dict = config.model_dump()

        def _norm_single(key: str) -> None:
            if config_dict.get(key):
                config_dict[key]["name"] = DatasetValidator._get_canonical_column_name(
                    config_dict[key]["name"], dataset_context
                )

        def _norm_list(key: str) -> None:
            if config_dict.get(key):
                for col in config_dict[key]:
                    col["name"] = DatasetValidator._get_canonical_column_name(
                        col["name"], dataset_context
                    )

        _norm_single("x")
        _norm_list("y")
        _norm_list("y_secondary")
        _norm_list("group_by")
        _norm_list("group_by_secondary")
        DatasetValidator._normalize_filters(config_dict, dataset_context)
        return MixedTimeseriesChartConfig.model_validate(config_dict)
