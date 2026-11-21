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

"""Heatmap chart type plugin."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, cast, ClassVar

from superset.mcp_service.chart.chart_utils import (
    _heatmap_chart_what,
    _summarize_filters,
    map_heatmap_config,
)
from superset.mcp_service.chart.plugin import BaseChartPlugin
from superset.mcp_service.chart.schemas import ColumnRef, HeatmapChartConfig
from superset.mcp_service.chart.validation.dataset_validator import DatasetValidator
from superset.mcp_service.common.error_schemas import ChartGenerationError


class HeatmapChartPlugin(BaseChartPlugin):
    """Plugin for heatmap chart type."""

    chart_type = "heatmap_v2"
    display_name = "Heatmap"
    native_viz_types: ClassVar[Mapping[str, str]] = {
        "heatmap_v2": "Heatmap",
    }

    def pre_validate(
        self,
        config: dict[str, Any],
    ) -> ChartGenerationError | None:
        missing_fields = []

        if "x_axis" not in config:
            missing_fields.append("'x_axis' (column along the X axis)")
        if "y_axis" not in config and "groupby" not in config:
            missing_fields.append("'y_axis' (column along the Y axis)")
        if "metric" not in config:
            missing_fields.append("'metric' (value colouring each cell)")

        if missing_fields:
            return ChartGenerationError(
                error_type="missing_heatmap_fields",
                message=(
                    f"Heatmap chart missing required fields: "
                    f"{', '.join(missing_fields)}"
                ),
                details=(
                    "Heatmaps plot a metric across two dimensions — one on the "
                    "x_axis and one on the y_axis — colouring each cell by the "
                    "metric value"
                ),
                suggestions=[
                    "Add 'x_axis': {'name': 'day_of_week'}",
                    "Add 'y_axis': {'name': 'hour'}",
                    "Add 'metric': {'name': 'trips', 'aggregate': 'COUNT'}",
                    "Example: {'chart_type': 'heatmap_v2', "
                    "'x_axis': {'name': 'day_of_week'}, "
                    "'y_axis': {'name': 'hour'}, "
                    "'metric': {'name': 'trips', 'aggregate': 'COUNT'}}",
                ],
                error_code="MISSING_HEATMAP_FIELDS",
            )

        return None

    def extract_column_refs(self, config: Any) -> list[ColumnRef]:
        if not isinstance(config, HeatmapChartConfig):
            return []
        refs: list[ColumnRef] = [config.x_axis, config.y_axis, config.metric]
        if config.filters:
            for f in config.filters:
                refs.append(ColumnRef(name=f.column))
        return refs

    def to_form_data(
        self, config: Any, dataset_id: int | str | None = None
    ) -> dict[str, Any]:
        return map_heatmap_config(config)

    def generate_name(self, config: Any, dataset_name: str | None = None) -> str:
        what = _heatmap_chart_what(config)
        context = _summarize_filters(config.filters)
        return self._with_context(what, context)

    def resolve_viz_type(self, config: Any) -> str:
        return "heatmap_v2"

    def resolve_query_fields(
        self, form_data: Mapping[str, Any], viz_type: str
    ) -> tuple[list[Any], list[Any]] | None:
        """Resolve the single cell metric and the X-axis / Y-groupby columns.

        Heatmap has exactly these roles. The Y axis is a single-select
        ``groupby`` stored as a bare string, so it is normalized here rather
        than relying on the shared list-only aliases.
        """
        from superset.mcp_service.chart.chart_helpers import (
            normalize_groupby,
            resolve_shared_metrics,
        )

        x_axis = form_data.get("x_axis")
        columns = [*([x_axis] if x_axis else []), *normalize_groupby(form_data)]
        return list(resolve_shared_metrics(form_data)), columns

    def build_query_dicts(
        self,
        form_data: dict[str, Any],
        *,
        viz_type: str,
        engine: str,
        row_limit: int | None,
        order_desc: bool | None,
    ) -> list[dict[str, Any]] | None:
        """Build the Heatmap query, grouping by both axes.

        Mirrors the Heatmap ``buildQuery``: ``columns`` are the X axis followed
        by the Y ``groupby`` column, and ordering is only added when the
        ``sort_x_axis`` / ``sort_y_axis`` controls ask for it (by value, which
        is the metric, or alphabetically, which is the axis column).
        """
        from superset.common.form_data_query_context import normalize_time_column
        from superset.mcp_service.chart.chart_helpers import build_single_query_dict

        metrics, columns = cast(
            tuple[list[Any], list[Any]],
            self.resolve_query_fields(form_data, viz_type),
        )
        query = build_single_query_dict(
            form_data,
            columns,
            metrics,
            row_limit=row_limit,
            order_desc=order_desc,
        )
        orderby: list[list[Any]] = []
        for key, index in (("sort_x_axis", 0), ("sort_y_axis", 1)):
            sort = form_data.get(key)
            if not isinstance(sort, str) or not sort or index >= len(columns):
                continue
            target = metrics[0] if "value" in sort and metrics else columns[index]
            orderby.append([target, "asc" in sort])
        if orderby:
            query["orderby"] = orderby
        return [normalize_time_column(form_data, query)]

    def normalize_column_refs(self, config: Any, dataset_context: Any) -> Any:
        config_dict = config.model_dump(exclude_unset=True)

        for key in ("x_axis", "y_axis"):
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
        return HeatmapChartConfig.model_validate(config_dict)

    def schema_error_hint(self) -> ChartGenerationError | None:
        return ChartGenerationError(
            error_type="heatmap_validation_error",
            message="Heatmap chart configuration validation failed",
            details=(
                "The heatmap chart configuration is missing required "
                "fields or has invalid structure"
            ),
            suggestions=[
                "Ensure 'x_axis' and 'y_axis' each have a 'name'",
                "Ensure 'metric' field has 'name' and 'aggregate'",
                "Example: {'chart_type': 'heatmap_v2', "
                "'x_axis': {'name': 'day_of_week'}, "
                "'y_axis': {'name': 'hour'}, "
                "'metric': {'name': 'trips', 'aggregate': 'COUNT'}}",
            ],
            error_code="HEATMAP_VALIDATION_ERROR",
        )
