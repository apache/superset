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

"""Treemap chart type plugin."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, cast, ClassVar

from superset.mcp_service.chart.chart_utils import (
    _summarize_filters,
    _treemap_chart_what,
    map_treemap_config,
)
from superset.mcp_service.chart.plugin import BaseChartPlugin, capped_compile_row_limit
from superset.mcp_service.chart.schemas import (
    ChartError,
    ColumnRef,
    TreemapChartConfig,
    VegaLitePreview,
)
from superset.mcp_service.chart.validation.dataset_validator import DatasetValidator
from superset.mcp_service.common.error_schemas import ChartGenerationError


class TreemapChartPlugin(BaseChartPlugin):
    """Plugin for treemap chart type."""

    chart_type = "treemap_v2"
    allows_empty_result = True
    display_name = "Treemap"
    native_viz_types: ClassVar[Mapping[str, str]] = {
        "treemap_v2": "Treemap",
    }
    requires_compile_check = True
    strict_dataset_rebind = True
    requires_config_for_dataset_rebind = True
    unbound_form_data_is_rebind = True
    normalize_data_results = True
    invalid_result_error_code = "INVALID_TREEMAP_RESULT"
    invalid_result_message = "Treemap metric query returned invalid values"

    def pre_validate(
        self,
        config: dict[str, Any],
    ) -> ChartGenerationError | None:
        missing_fields = []

        if not config.get("groupby"):
            missing_fields.append("'groupby' (ordered hierarchy columns)")
        if "metric" not in config:
            missing_fields.append("'metric' (value metric sizing the tiles)")

        if missing_fields:
            return ChartGenerationError(
                error_type="missing_treemap_fields",
                message=(
                    f"Treemap chart missing required fields: "
                    f"{', '.join(missing_fields)}"
                ),
                details=(
                    "Treemaps size tiles by a metric and nest them by an "
                    "ordered groupby hierarchy (first column is the outermost "
                    "level)"
                ),
                suggestions=[
                    "Add 'groupby': [{'name': 'region'}, {'name': 'product'}]",
                    "Add 'metric': {'name': 'revenue', 'aggregate': 'SUM'}",
                    "Example: {'chart_type': 'treemap_v2', "
                    "'groupby': [{'name': 'region'}], "
                    "'metric': {'name': 'revenue', 'aggregate': 'SUM'}}",
                ],
                error_code="MISSING_TREEMAP_FIELDS",
            )

        return None

    def extract_column_refs(self, config: Any) -> list[ColumnRef]:
        if not isinstance(config, TreemapChartConfig):
            return []
        refs: list[ColumnRef] = [*config.groupby, config.metric]
        if config.granularity_sqla:
            refs.append(ColumnRef(name=config.granularity_sqla))
        if config.filters:
            for f in config.filters:
                refs.append(ColumnRef(name=f.column))
        return refs

    def to_form_data(
        self, config: Any, dataset_id: int | str | None = None
    ) -> dict[str, Any]:
        return map_treemap_config(config)

    def generate_name(self, config: Any, dataset_name: str | None = None) -> str:
        what = _treemap_chart_what(config)
        context = _summarize_filters(config.filters)
        return self._with_context(what, context)

    def resolve_viz_type(self, config: Any) -> str:
        return "treemap_v2"

    def normalize_column_refs(self, config: Any, dataset_context: Any) -> Any:
        config_dict = config.model_dump(exclude_unset=True)

        for col in config_dict.get("groupby") or []:
            if not col.get("sql_expression") and not col.get("saved_metric"):
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
        if granularity := config_dict.get("granularity_sqla"):
            config_dict["granularity_sqla"] = (
                DatasetValidator.get_canonical_column_name(granularity, dataset_context)
            )
        DatasetValidator.normalize_filters(config_dict, dataset_context)
        normalized = TreemapChartConfig.model_validate(config_dict)
        normalized.__pydantic_fields_set__ = set(config.model_fields_set)
        return normalized

    def schema_error_hint(self) -> ChartGenerationError | None:
        return ChartGenerationError(
            error_type="treemap_validation_error",
            message="Treemap chart configuration validation failed",
            details=(
                "The treemap chart configuration is missing required "
                "fields or has invalid structure"
            ),
            suggestions=[
                "Ensure 'groupby' has at least one column for the hierarchy",
                "Ensure 'metric' field has 'name' and 'aggregate'",
                "Example: {'chart_type': 'treemap_v2', "
                "'groupby': [{'name': 'region'}], "
                "'metric': {'name': 'revenue', 'aggregate': 'SUM'}}",
            ],
            error_code="TREEMAP_VALIDATION_ERROR",
        )

    def resolve_query_fields(
        self, form_data: Mapping[str, Any], viz_type: str
    ) -> tuple[list[Any], list[Any]] | None:
        # Treemap has exactly these roles; stale controls from another plugin
        # must not override its singular metric or ordered hierarchy.
        """Resolve the singular metric and ordered hierarchy."""
        metric = form_data.get("metric")
        hierarchy = form_data.get("groupby") or []
        return ([metric] if metric else []), (
            [hierarchy] if isinstance(hierarchy, str) else list(hierarchy)
        )

    def build_query_dicts(
        self,
        form_data: dict[str, Any],
        *,
        viz_type: str,
        engine: str,
        row_limit: int | None,
        order_desc: bool | None,
    ) -> list[dict[str, Any]] | None:
        """Build the Treemap query with its hierarchy-specific fields."""
        # Defer service helper imports to avoid plugin-loading cycles.
        from superset.mcp_service.chart.chart_helpers import (
            apply_treemap_query_fields,
            build_single_query_dict,
        )

        metrics, hierarchy = cast(
            tuple[list[Any], list[Any]],
            self.resolve_query_fields(form_data, viz_type),
        )
        query = build_single_query_dict(
            form_data,
            hierarchy,
            metrics,
            row_limit=row_limit,
            order_desc=order_desc,
        )
        apply_treemap_query_fields(
            query,
            form_data,
            hierarchy,
            row_limit if row_limit is not None else form_data.get("row_limit"),
        )
        return [query]

    def normalize_query_result(self, result: Any, form_data: Mapping[str, Any]) -> Any:
        """Validate and normalize Treemap query results."""
        # Defer service helper imports to avoid plugin-loading cycles.
        from superset.mcp_service.chart.query_result import (
            normalize_treemap_query_result,
        )

        return normalize_treemap_query_result(result, form_data)

    def compile_row_limit(self, form_data: Mapping[str, Any]) -> int:
        """Bound the compile check to a small valid row limit."""
        return capped_compile_row_limit(form_data)

    def preview_row_limit(self, form_data: Mapping[str, Any], fallback: int) -> int:
        """Resolve the persisted preview row limit within its accepted range."""
        value = form_data.get("row_limit", 100)
        try:
            limit = int(value)
        except (TypeError, ValueError, OverflowError):
            limit = 100
        return limit if 1 <= limit <= 10000 else 100

    def ascii_preview(
        self, data: list[Any], form_data: dict[str, Any], width: int
    ) -> str | ChartError | None:
        """Render the hierarchy as an ASCII preview."""
        # Defer service helper imports to avoid plugin-loading cycles.
        from superset.mcp_service.chart.treemap_preview import treemap_ascii

        return treemap_ascii(data, form_data, width)

    def vega_lite_preview(
        self, data: list[Any], form_data: dict[str, Any]
    ) -> VegaLitePreview | ChartError | None:
        """Render the hierarchy as a Vega-Lite preview."""
        # Defer service helper imports to avoid plugin-loading cycles.
        from superset.mcp_service.chart.treemap_preview import treemap_vega_lite

        return treemap_vega_lite(data, form_data)

    def resolve_update_config(
        self,
        config: Any,
        existing_form_data: dict[str, Any],
        *,
        dataset_rebind: bool,
    ) -> Any:
        """Complete omitted roles from the saved configuration."""
        # Defer service helper imports to avoid plugin-loading cycles.
        from superset.mcp_service.chart.chart_utils import (
            resolve_treemap_update_config,
        )

        return resolve_treemap_update_config(
            config, existing_form_data, dataset_rebind=dataset_rebind
        )

    def merge_update_form_data(
        self,
        existing_form_data: dict[str, Any],
        new_form_data: dict[str, Any],
        config: Any,
        *,
        dataset_rebind: bool,
    ) -> dict[str, Any] | None:
        """Merge Treemap controls while respecting dataset rebinds."""
        # Defer service helper imports to avoid plugin-loading cycles.
        from superset.mcp_service.chart.chart_utils import _merge_treemap_form_data

        if not isinstance(config, TreemapChartConfig):
            return None
        return _merge_treemap_form_data(
            existing_form_data, new_form_data, config, dataset_rebind
        )
