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

"""Handlebars chart type plugin."""

from __future__ import annotations

from typing import Any

from superset.mcp_service.chart.plugin import BaseChartPlugin
from superset.mcp_service.chart.schemas import ColumnRef
from superset.mcp_service.common.error_schemas import ChartGenerationError


class HandlebarsChartPlugin(BaseChartPlugin):
    """Plugin for handlebars chart type (custom HTML template charts)."""

    chart_type = "handlebars"
    display_name = "Handlebars (Custom Template)"
    native_viz_types = {
        "handlebars": "Custom Template Chart",
    }

    def pre_validate(
        self,
        config: dict[str, Any],
    ) -> ChartGenerationError | None:
        if "handlebars_template" not in config:
            return ChartGenerationError(
                error_type="missing_handlebars_template",
                message="Handlebars chart missing required field: handlebars_template",
                details=(
                    "Handlebars charts require a 'handlebars_template' string "
                    "containing Handlebars HTML template markup"
                ),
                suggestions=[
                    "Add 'handlebars_template' with a Handlebars HTML template",
                    "Data is available as {{data}} array in the template",
                    "Example: '<ul>{{#each data}}<li>{{this.name}}: "
                    "{{this.value}}</li>{{/each}}</ul>'",
                ],
                error_code="MISSING_HANDLEBARS_TEMPLATE",
            )

        template = config.get("handlebars_template")
        if not isinstance(template, str) or not template.strip():
            return ChartGenerationError(
                error_type="invalid_handlebars_template",
                message="Handlebars template must be a non-empty string",
                details=(
                    "The 'handlebars_template' field must be a non-empty string "
                    "containing valid Handlebars HTML template markup"
                ),
                suggestions=[
                    "Ensure handlebars_template is a non-empty string",
                    "Example: '<ul>{{#each data}}<li>{{this.name}}</li>"
                    "{{/each}}</ul>'",
                ],
                error_code="INVALID_HANDLEBARS_TEMPLATE",
            )

        query_mode = config.get("query_mode", "aggregate")
        if query_mode not in ("aggregate", "raw"):
            return ChartGenerationError(
                error_type="invalid_query_mode",
                message="Invalid query_mode for handlebars chart",
                details="query_mode must be either 'aggregate' or 'raw'",
                suggestions=[
                    "Use 'aggregate' for aggregated data (default)",
                    "Use 'raw' for individual rows",
                ],
                error_code="INVALID_QUERY_MODE",
            )

        if query_mode == "raw" and not config.get("columns"):
            return ChartGenerationError(
                error_type="missing_raw_columns",
                message="Handlebars chart in 'raw' mode requires 'columns'",
                details=(
                    "When query_mode is 'raw', you must specify which columns "
                    "to include in the query results"
                ),
                suggestions=[
                    "Add 'columns': [{'name': 'column_name'}] for raw mode",
                    "Or use query_mode='aggregate' with 'metrics' and optional 'groupby'",  # noqa: E501
                ],
                error_code="MISSING_RAW_COLUMNS",
            )

        if query_mode == "aggregate" and not config.get("metrics"):
            return ChartGenerationError(
                error_type="missing_aggregate_metrics",
                message="Handlebars chart in 'aggregate' mode requires 'metrics'",
                details=(
                    "When query_mode is 'aggregate' (default), you must specify "
                    "at least one metric with an aggregate function"
                ),
                suggestions=[
                    "Add 'metrics': [{'name': 'column', 'aggregate': 'SUM'}]",
                    "Or use query_mode='raw' with 'columns' for individual rows",
                ],
                error_code="MISSING_AGGREGATE_METRICS",
            )

        return None

    def extract_column_refs(self, config: Any) -> list[ColumnRef]:
        from superset.mcp_service.chart.schemas import HandlebarsChartConfig

        if not isinstance(config, HandlebarsChartConfig):
            return []
        refs: list[ColumnRef] = []
        if config.columns:
            refs.extend(config.columns)
        if config.metrics:
            refs.extend(config.metrics)
        if config.groupby:
            refs.extend(config.groupby)
        if config.filters:
            for f in config.filters:
                refs.append(ColumnRef(name=f.column))
        return refs

    def to_form_data(
        self, config: Any, dataset_id: int | str | None = None
    ) -> dict[str, Any]:
        from superset.mcp_service.chart.chart_utils import map_handlebars_config

        return map_handlebars_config(config)

    def normalize_column_refs(self, config: Any, dataset_context: Any) -> Any:
        from superset.mcp_service.chart.schemas import HandlebarsChartConfig
        from superset.mcp_service.chart.validation.dataset_validator import (
            DatasetValidator,
        )

        config_dict = config.model_dump()

        def _norm_list(key: str) -> None:
            if config_dict.get(key):
                for col in config_dict[key]:
                    if not col.get("saved_metric"):
                        col["name"] = DatasetValidator._get_canonical_column_name(
                            col["name"], dataset_context
                        )

        _norm_list("columns")
        _norm_list("metrics")
        _norm_list("groupby")
        DatasetValidator._normalize_filters(config_dict, dataset_context)
        return HandlebarsChartConfig.model_validate(config_dict)
