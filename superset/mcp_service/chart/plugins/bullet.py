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

"""ECharts Bullet chart type plugin."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, ClassVar

from superset.mcp_service.chart.chart_utils import (
    _summarize_filters,
    map_bullet_config,
)
from superset.mcp_service.chart.plugin import BaseChartPlugin
from superset.mcp_service.chart.schemas import (
    BulletChartConfig,
    ColumnRef,
    resolve_bullet_order_target,
)
from superset.mcp_service.chart.validation.dataset_validator import (
    DatasetValidator,
    is_numeric_column,
    resolve_dataset_column,
)
from superset.mcp_service.common.error_schemas import (
    ChartGenerationError,
    DatasetContext,
)


def _canonical_reference(
    name: str,
    candidates: list[str],
    role: str,
) -> str:
    """Resolve exact/casefold matches without silently choosing ambiguity."""
    if name in candidates:
        return name
    matches = [
        candidate for candidate in candidates if candidate.casefold() == name.casefold()
    ]
    if len(matches) > 1:
        raise ValueError(
            f"Ambiguous Bullet {role} {name!r}; exact-case matches are: "
            f"{', '.join(matches)}"
        )
    return matches[0] if matches else name


class BulletChartPlugin(BaseChartPlugin):
    """Plugin matching ``plugin-chart-echarts/src/Bullet``."""

    chart_type = "bullet"
    display_name = "Bullet Chart"
    native_viz_types: ClassVar[Mapping[str, str]] = {
        "bullet": "Bullet Chart",
    }

    def pre_validate(self, config: dict[str, Any]) -> ChartGenerationError | None:
        if "metric" in config:
            return None
        return ChartGenerationError(
            error_type="missing_bullet_fields",
            message="Bullet chart missing required field: metric",
            details=(
                "A Bullet chart measures one numeric aggregate or saved/SQL metric; "
                "optional dimensions split it into one row per group."
            ),
            suggestions=[
                "Add metric: {'name': 'revenue', 'aggregate': 'SUM'}",
                "For a saved metric use {'name': 'revenue', 'saved_metric': true}",
                "Add dimensions: [{'name': 'region'}] for grouped bullet rows",
            ],
            error_code="MISSING_BULLET_FIELDS",
        )

    def extract_column_refs(self, config: Any) -> list[ColumnRef]:
        if not isinstance(config, BulletChartConfig):
            return []
        refs = [config.metric, *(config.dimensions or [])]
        refs.extend(ColumnRef(name=filter_.column) for filter_ in config.filters or [])
        # order_by is constrained to role outputs by the schema, so those names
        # are already represented by metric/dimension refs and must not be
        # reinterpreted as physical columns.
        return refs

    def to_form_data(
        self, config: Any, dataset_id: int | str | None = None
    ) -> dict[str, Any]:
        if not isinstance(config, BulletChartConfig):
            raise TypeError("BulletChartPlugin requires BulletChartConfig")
        return map_bullet_config(config)

    def post_map_validate(  # noqa: C901
        self,
        config: Any,
        form_data: dict[str, Any],
        dataset_id: int | str | None = None,
    ) -> ChartGenerationError | None:
        """Require an unambiguous numeric metric output for Number(...)."""
        if not isinstance(config, BulletChartConfig) or dataset_id is None:
            return None
        dataset_context = DatasetValidator._get_dataset_context(dataset_id)
        if dataset_context is None:
            return None

        columns = [column["name"] for column in dataset_context.available_columns]
        metrics = [metric["name"] for metric in dataset_context.available_metrics]
        requested: list[tuple[str, list[str], str]] = []
        if config.metric.name and not config.metric.sql_expression:
            requested.append(
                (
                    config.metric.name,
                    metrics if config.metric.saved_metric else columns,
                    "saved metric" if config.metric.saved_metric else "metric column",
                )
            )
        requested.extend(
            (dimension.name or "", columns, "dimension")
            for dimension in config.dimensions or []
            if dimension.name
        )
        requested.extend(
            (filter_.column, columns, "filter column")
            for filter_ in config.filters or []
        )
        if config.temporal_column:
            requested.append((config.temporal_column, columns, "temporal column"))

        for name, candidates, role in requested:
            if (
                name not in candidates
                and sum(
                    candidate.casefold() == name.casefold() for candidate in candidates
                )
                > 1
            ):
                return ChartGenerationError(
                    error_type="ambiguous_bullet_reference",
                    message=(
                        f"Bullet {role} {name!r} is ambiguous in dataset metadata"
                    ),
                    details=(
                        "Multiple dataset fields differ only by case. The query and "
                        "frontend require an exact canonical field name."
                    ),
                    suggestions=[
                        "Use get_dataset_info and copy the exact-case field name"
                    ],
                    error_code="AMBIGUOUS_BULLET_REFERENCE",
                )

        metric = config.metric
        if metric.saved_metric or metric.sql_expression:
            # Saved/SQL metric result types are determined by their expressions;
            # Tier-2 compile validation remains authoritative.
            return None
        if (metric.aggregate or "SUM") in {"COUNT", "COUNT_DISTINCT"}:
            return None
        try:
            column = resolve_dataset_column(metric.name or "", dataset_context)
        except ValueError as ex:
            return ChartGenerationError(
                error_type="ambiguous_bullet_reference",
                message=(
                    f"Bullet metric column {metric.name!r} is ambiguous in "
                    "dataset metadata"
                ),
                details=str(ex),
                suggestions=["Use get_dataset_info and copy the exact-case field name"],
                error_code="AMBIGUOUS_BULLET_REFERENCE",
            )
        if column is None or is_numeric_column(column):
            return None
        return ChartGenerationError(
            error_type="non_numeric_bullet_metric",
            message=(
                f"Bullet metric {metric.name!r} must produce a number; dataset "
                f"type is {column.get('type', 'UNKNOWN')}."
            ),
            details=(
                "Bullet/transformProps.ts converts the metric result with Number(). "
                "A non-numeric MIN/MAX or default SUM would render an invalid bar."
            ),
            suggestions=[
                "Use COUNT or COUNT_DISTINCT for a text column",
                "Choose a numeric dataset column",
                "Use a saved or SQL metric that returns a numeric value",
            ],
            error_code="NON_NUMERIC_BULLET_METRIC",
        )

    def normalize_column_refs(
        self, config: Any, dataset_context: DatasetContext
    ) -> Any:
        if not isinstance(config, BulletChartConfig):
            return config
        explicit_fields = set(config.model_fields_set)
        config_dict = config.model_dump(exclude_unset=True)
        columns = [column["name"] for column in dataset_context.available_columns]
        metrics = [metric["name"] for metric in dataset_context.available_metrics]

        metric = config_dict["metric"]
        if not metric.get("sql_expression"):
            metric["name"] = _canonical_reference(
                metric["name"],
                metrics if metric.get("saved_metric") else columns,
                "saved metric" if metric.get("saved_metric") else "metric column",
            )
        for dimension in config_dict.get("dimensions") or []:
            dimension["name"] = _canonical_reference(
                dimension["name"], columns, "dimension"
            )
        if temporal := config_dict.get("temporal_column"):
            config_dict["temporal_column"] = _canonical_reference(
                temporal, columns, "temporal column"
            )
        for filter_ in config_dict.get("filters") or []:
            filter_["column"] = _canonical_reference(
                filter_["column"], columns, "filter column"
            )

        # Sort targets may use ergonomic role names or labels. Canonicalize
        # physical-name targets and leave explicit display labels untouched.
        for order in config_dict.get("order_by") or []:
            role, index = resolve_bullet_order_target(
                order["column"], config.dimensions or [], config.metric
            )
            if role == "dimension" and index is not None:
                order["column"] = config_dict["dimensions"][index]["name"]
            elif not metric.get("sql_expression") and not metric.get("label"):
                order["column"] = metric["name"]

        normalized = BulletChartConfig.model_validate(config_dict)
        normalized.model_fields_set.clear()
        normalized.model_fields_set.update(explicit_fields)
        return normalized

    def generate_name(self, config: Any, dataset_name: str | None = None) -> str:
        metric = config.metric.label or config.metric.name or "Metric"
        what = f"{metric} bullet"
        if config.dimensions:
            what += " by " + ", ".join(
                dimension.label or dimension.name or "dimension"
                for dimension in config.dimensions
            )
        return self._with_context(what, _summarize_filters(config.filters))

    def resolve_viz_type(self, config: Any) -> str:
        return "bullet"

    def schema_error_hint(self) -> ChartGenerationError | None:
        return ChartGenerationError(
            error_type="bullet_validation_error",
            message="Bullet chart configuration validation failed",
            details=(
                "Bullet requires one numeric metric and optional unique physical "
                "dimensions. Threshold/marker labels must align with their values."
            ),
            suggestions=[
                "Use metric with aggregate, saved_metric, or sql_expression + label",
                "Use dimensions (alias: groupby) for row hierarchy",
                "Use ranges, markers, and marker_lines for comparison targets",
            ],
            error_code="BULLET_VALIDATION_ERROR",
        )
