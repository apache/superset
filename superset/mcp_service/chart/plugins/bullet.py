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

from collections.abc import Callable, Mapping
from copy import deepcopy
from typing import Any, ClassVar

from superset.mcp_service.chart.chart_utils import (
    _summarize_filters,
    map_bullet_config,
)
from superset.mcp_service.chart.plugin import BaseChartPlugin
from superset.mcp_service.chart.schemas import (
    BulletChartConfig,
    ChartError,
    ColumnRef,
    resolve_bullet_order_target,
    VegaLitePreview,
)
from superset.mcp_service.chart.validation.dataset_validator import (
    AmbiguousDatasetReferenceError,
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
        # AmbiguousDatasetReferenceError subclasses ValueError, so existing
        # ValueError handlers keep working, while the validation pipeline
        # re-raises it instead of downgrading it to a warning and proceeding
        # with the unresolved reference.
        raise AmbiguousDatasetReferenceError(name, matches, f"Bullet {role}")
    return matches[0] if matches else name


def _render_model_error(rows: Any, form_data: Mapping[str, Any]) -> ChartError | None:
    """Validate Bullet result rows without requiring a backend preview formatter."""
    from superset.mcp_service.chart.preview_utils import (
        BulletOutputError,
        resolve_bullet_render_model,
    )
    from superset.mcp_service.chart.query_result import safe_exception_message

    try:
        resolve_bullet_render_model(rows, dict(form_data), validate_format=False)
    except BulletOutputError as ex:
        return ChartError(error=safe_exception_message(ex), error_type=ex.error_type)
    return None


class BulletChartPlugin(BaseChartPlugin):
    """Plugin matching ``plugin-chart-echarts/src/Bullet``."""

    chart_type = "bullet"
    display_name = "Bullet Chart"
    native_viz_types: ClassVar[Mapping[str, str]] = {
        "bullet": "Bullet Chart",
    }
    # Bullet/transformProps.ts converts temporal values with Number().
    temporal_json_numbers = True
    # The frontend renders an empty result (a zero measure when ungrouped).
    allows_empty_result = True
    allows_empty_data_result = True
    # Updates merge filter provenance plus Bullet's bounded native controls;
    # no other saved control is carried into the typed Bullet state.
    owns_update_merge = True
    binds_time_range_to_temporal_filter = True
    table_preview_unsupported_reason: ClassVar[str | None] = (
        "Table previews cannot represent Bullet ranges, markers, "
        "labels, and legend semantics"
    )
    invalid_result_error_code = "MALFORMED_BULLET_OUTPUT"
    invalid_result_message = (
        "Bullet query output does not contain a usable sizing measure."
    )

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
        # A merged validation copy omits native dimensions; its native sorts
        # belong to query-contract validation, not physical-column resolution.
        orders = (
            config_dict.get("order_by") or []
            if config.dimensions is not None or config._inherited_groupby is not None
            else []
        )
        for order in orders:
            role, index = resolve_bullet_order_target(
                order["column"], config.order_dimensions, config.metric
            )
            if role == "dimension" and index is not None:
                if config.dimensions is not None:
                    order["column"] = config_dict["dimensions"][index]["name"]
            elif not metric.get("sql_expression") and not metric.get("label"):
                order["column"] = metric["name"]

        normalized = BulletChartConfig.model_validate(config_dict)
        normalized._inherited_groupby = deepcopy(config._inherited_groupby)
        normalized.validate_roles_and_outputs()
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
                "dimensions. Threshold/marker labels are optional; missing marker "
                "labels fall back to formatted values."
            ),
            suggestions=[
                "Use metric with aggregate, saved_metric, or sql_expression + label",
                "Use dimensions (alias: groupby) for row hierarchy",
                "Use ranges, markers, and marker_lines for comparison targets",
            ],
            error_code="BULLET_VALIDATION_ERROR",
        )

    def normalize_query_result(self, result: Any, form_data: Mapping[str, Any]) -> Any:
        """Reject results that cannot size a Bullet chart without guessing."""
        from superset.mcp_service.chart.query_result import query_result_data

        data, failure = query_result_data(result, temporal_json_numbers=True)
        if failure is not None:
            return failure
        rows = data[0] if data else []
        if (error := _render_model_error(rows, form_data)) is not None:
            return error
        return result

    def sanitize_data_rows(
        self, data: list[Any], form_data: Mapping[str, Any]
    ) -> tuple[list[Any], ChartError | None]:
        """Expose validated rows independently of backend preview formatter support."""
        from superset.mcp_service.chart.preview_utils import (
            _safe_enum_backing,
            BulletOutputError,
            resolve_bullet_render_model,
        )
        from superset.mcp_service.chart.query_result import safe_exception_message

        try:
            model = resolve_bullet_render_model(
                data, dict(form_data), validate_format=False
            )
        except BulletOutputError as ex:
            return [], ChartError(
                error=safe_exception_message(ex), error_type=ex.error_type
            )
        if not data:
            # The strict model's zero-valued ungrouped row is a render-only
            # frontend fallback, not source query data, so an empty query
            # exposes no rows to get-data and exports.
            return [], None
        # The strict model retains exact result keys while replacing unselected
        # values with None and normalizing the dimensions. Its float measure is
        # render-only: exported rows keep the validated source metric so exact
        # BIGINT/Decimal values are not rounded to binary64.
        rows: list[Any] = []
        for source, row in zip(data, model.rows, strict=False):
            exposed = dict(row)
            if model.metric_field in source:
                exposed[model.metric_field] = _safe_enum_backing(
                    source[model.metric_field]
                )
            rows.append(exposed)
        return rows, None

    def ascii_preview(
        self, data: list[Any], form_data: dict[str, Any], width: int
    ) -> str | ChartError | None:
        from superset.mcp_service.chart.preview_utils import (
            _generate_ascii_bullet_chart,
            BulletOutputError,
        )
        from superset.mcp_service.chart.query_result import safe_exception_message

        try:
            return _generate_ascii_bullet_chart(data, form_data)
        except BulletOutputError as ex:
            return ChartError(
                error=safe_exception_message(ex), error_type=ex.error_type
            )

    def vega_lite_preview(
        self, data: list[Any], form_data: dict[str, Any]
    ) -> VegaLitePreview | ChartError | None:
        from superset.mcp_service.chart.preview_utils import (
            _generate_bullet_vega_lite_preview,
            BulletOutputError,
        )
        from superset.mcp_service.chart.query_result import safe_exception_message

        try:
            return _generate_bullet_vega_lite_preview(data, form_data)
        except BulletOutputError as ex:
            return ChartError(
                error=safe_exception_message(ex), error_type=ex.error_type
            )

    def resolve_update_config(
        self,
        config: Any,
        existing_form_data: dict[str, Any],
        *,
        dataset_rebind: bool,
    ) -> Any:
        """Resolve sort targets against the saved hierarchy before mapping."""
        if not isinstance(config, BulletChartConfig) or config.dimensions is not None:
            return config
        if not config.order_by:
            return config
        dimensions = (
            existing_form_data.get("groupby") or []
            if not dataset_rebind and existing_form_data.get("viz_type") == "bullet"
            else []
        )
        resolved = config.model_copy(deep=True)
        resolved._inherited_groupby = deepcopy(dimensions)
        return resolved.validate_roles_and_outputs()

    def merge_update_form_data(
        self,
        existing_form_data: dict[str, Any],
        new_form_data: dict[str, Any],
        config: Any,
        *,
        dataset_rebind: bool,
    ) -> dict[str, Any] | None:
        """Merge filter provenance and preserve omitted native Bullet controls."""
        if not isinstance(config, BulletChartConfig) or dataset_rebind:
            return None
        from superset.mcp_service.chart.chart_utils import (
            _normalize_bullet_query_aliases,
            merge_bullet_form_data,
            merge_update_form_data,
        )

        if existing_form_data.get("viz_type") == "bullet":
            existing_form_data = _normalize_bullet_query_aliases(existing_form_data)
        merged = dict(new_form_data)
        merge_update_form_data(existing_form_data, merged, config)
        merge_bullet_form_data(existing_form_data, merged)
        return merged

    def validate_merged_form_data(
        self,
        form_data: Mapping[str, Any],
        dataset_id: int | str | None,
        dataset_context: Callable[[], Any] | None = None,
        update_config: Any = None,
    ) -> Any | None:
        """Validate the merged state; canonicalize it when dataset metadata exists."""
        from superset.mcp_service.chart.chart_utils import (
            validate_merged_bullet_form_data,
        )

        merged = validate_merged_bullet_form_data(form_data, update_config)
        if merged is None or dataset_context is None or dataset_id is None:
            return merged
        return DatasetValidator.normalize_column_names(
            merged, dataset_id, dataset_context=dataset_context()
        )
