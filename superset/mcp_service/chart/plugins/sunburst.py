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

"""ECharts Sunburst chart type plugin."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, ClassVar

from superset.mcp_service.chart.chart_utils import (
    _summarize_filters,
    map_sunburst_config,
)
from superset.mcp_service.chart.plugin import BaseChartPlugin
from superset.mcp_service.chart.schemas import (
    ChartError,
    ColumnRef,
    SunburstChartConfig,
    TablePreview,
    VegaLitePreview,
)
from superset.mcp_service.chart.sunburst import unsupported_sunburst_preview
from superset.mcp_service.chart.validation.dataset_validator import DatasetValidator
from superset.mcp_service.common.error_schemas import (
    ChartGenerationError,
    DatasetContext,
)


class SunburstChartPlugin(BaseChartPlugin):
    """Plugin for the ECharts ``sunburst_v2`` visualization."""

    chart_type = "sunburst"
    display_name = "Sunburst Chart"
    native_viz_types: ClassVar[Mapping[str, str]] = {
        "sunburst_v2": "Sunburst Chart",
    }
    # get_chart_data and its exports validate hierarchy rows and metrics.
    normalize_data_results = True
    # Hierarchy input must never silently become an empty visualization.
    null_data_is_empty = False
    invalid_result_error_code = "INVALID_SUNBURST_RESULT"
    invalid_result_message = (
        "Sunburst query returned data that cannot render as a Sunburst."
    )
    invalid_result_suggestions = (
        "Use a metric that returns finite numeric values",
        "Verify saved and SQL metric result aliases",
        "Ensure every hierarchy column is present in the query result",
    )

    def pre_validate(
        self,
        config: dict[str, Any],
    ) -> ChartGenerationError | None:
        missing_fields = []
        if not any(key in config for key in ("hierarchy", "columns", "groupby")):
            missing_fields.append("'hierarchy' (one or more dimension columns)")
        if "metric" not in config:
            missing_fields.append("'metric' (primary arc-size metric)")
        if not missing_fields:
            return None

        return ChartGenerationError(
            error_type="missing_sunburst_fields",
            message=f"Sunburst missing required fields: {', '.join(missing_fields)}",
            details=(
                "Sunburst charts require an ordered hierarchy and one primary "
                "metric; when supplied, secondary_metric divided by the primary "
                "metric drives a sequential color scale; omitting it uses "
                "categorical colors"
            ),
            suggestions=[
                "Add 'hierarchy': [{'name': 'region'}, {'name': 'country'}]",
                "Add 'metric': {'name': 'revenue', 'aggregate': 'SUM'}",
                "Example: {'chart_type': 'sunburst', 'hierarchy': "
                "[{'name': 'region'}, {'name': 'country'}], 'metric': "
                "{'name': 'revenue', 'aggregate': 'SUM'}}",
            ],
            error_code="MISSING_SUNBURST_FIELDS",
        )

    def extract_column_refs(self, config: Any) -> list[ColumnRef]:
        if not isinstance(config, SunburstChartConfig):
            return []
        refs = [*config.hierarchy, config.metric]
        if config.secondary_metric is not None:
            refs.append(config.secondary_metric)
        return refs

    def to_form_data(
        self, config: Any, dataset_id: int | str | None = None
    ) -> dict[str, Any]:
        return map_sunburst_config(config)

    def generate_name(self, config: Any, dataset_name: str | None = None) -> str:
        hierarchy = " / ".join(
            dimension.label or dimension.name or "" for dimension in config.hierarchy
        )
        metric = (
            config.metric.label
            or config.metric.name
            or config.metric.sql_expression
            or "Value"
        )
        context = _summarize_filters(config.filters)
        return self._with_context(f"{metric} by {hierarchy}", context)

    def resolve_viz_type(self, config: Any) -> str:
        return "sunburst_v2"

    def resolve_query_fields(
        self, form_data: Mapping[str, Any], viz_type: str
    ) -> tuple[list[Any], list[Any]] | None:
        from superset.mcp_service.chart.chart_helpers import (
            resolve_groupby,
            resolve_shared_metrics,
        )

        # The standardized controls promote both singular metrics into the
        # query: transformProps colors nodes by the secondary/primary ratio.
        metrics = list(resolve_shared_metrics(form_data))
        if (secondary_metric := form_data.get("secondary_metric")) and (
            secondary_metric not in metrics
        ):
            metrics.append(secondary_metric)
        return metrics, resolve_groupby(dict(form_data))

    def normalize_query_result(self, result: Any, form_data: Mapping[str, Any]) -> Any:
        from superset.mcp_service.chart.sunburst import (
            normalize_sunburst_query_result,
        )

        return normalize_sunburst_query_result(result, form_data)

    def ascii_preview(
        self,
        data: list[Any],
        form_data: dict[str, Any],
        width: int,
        height: int = 20,
    ) -> str | ChartError | None:
        from superset.mcp_service.chart.preview_utils import (
            generate_sunburst_ascii_preview,
        )

        return generate_sunburst_ascii_preview(data, form_data, width, height)

    def table_preview(
        self, data: list[Any], form_data: dict[str, Any]
    ) -> TablePreview | ChartError | None:
        from superset.mcp_service.chart.preview_utils import (
            generate_sunburst_table_preview,
        )

        return generate_sunburst_table_preview(data, form_data)

    def vega_lite_preview(
        self, data: list[Any], form_data: dict[str, Any]
    ) -> VegaLitePreview | ChartError | None:
        return unsupported_sunburst_preview("Vega-Lite")

    def unsupported_preview(self, preview_format: str) -> ChartError | None:
        # A flat Vega-Lite mark cannot faithfully represent the hierarchy.
        if preview_format == "vega_lite":
            return unsupported_sunburst_preview("Vega-Lite")
        return None

    def validate_form_data_state(
        self,
        form_data: Mapping[str, Any],
        dataset_context: DatasetContext | None = None,
    ) -> ChartGenerationError | None:
        from superset.mcp_service.chart.sunburst import (
            validate_sunburst_temporal_state,
        )

        return validate_sunburst_temporal_state(form_data, dataset_context)

    def build_query_dicts(
        self,
        form_data: dict[str, Any],
        *,
        viz_type: str,
        engine: str,
        row_limit: int | None,
        order_desc: bool | None,
    ) -> list[dict[str, Any]] | None:
        from superset.common.form_data_query_context import (
            adhoc_filters_to_query_filters,
        )

        # The frontend query mapper ignores SIMPLE HAVING clauses, and a
        # QueryObject filter would turn one into WHERE. Reject such clauses in
        # the complete prepared state, then use the shared builder.
        adhoc_filters_to_query_filters(form_data.get("adhoc_filters", []))
        return None

    def normalize_column_refs(self, config: Any, dataset_context: Any) -> Any:
        # Preserve omission semantics for update merges. model_dump() without
        # exclude_unset would mark every defaulted field as explicitly supplied
        # when the normalized model is reconstructed.
        config_dict = config.model_dump(exclude_unset=True)

        for dimension in config_dict.get("hierarchy") or []:
            dimension["name"] = DatasetValidator.get_canonical_column_name(
                dimension["name"], dataset_context
            )
        for key in ("metric", "secondary_metric"):
            metric = config_dict.get(key)
            if not metric:
                continue
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
        DatasetValidator.normalize_filters(config_dict, dataset_context)
        return SunburstChartConfig.model_validate(config_dict)

    def schema_error_hint(self) -> ChartGenerationError | None:
        return ChartGenerationError(
            error_type="sunburst_validation_error",
            message="Sunburst configuration validation failed",
            details=(
                "Provide a unique ordered hierarchy plus a valid primary metric. "
                "Metric result labels must not collide with hierarchy columns."
            ),
            suggestions=[
                "Use physical columns in hierarchy; metrics cannot be dimensions",
                "Use aggregate, saved_metric=True, or sql_expression+label for metrics",
                "Use get_dataset_info to verify exact columns and saved metrics",
                "Example: {'chart_type': 'sunburst', 'hierarchy': "
                "[{'name': 'region'}, {'name': 'country'}], 'metric': "
                "{'name': 'revenue', 'aggregate': 'SUM'}}",
            ],
            error_code="SUNBURST_VALIDATION_ERROR",
        )
