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

"""Big number chart type plugin."""

from __future__ import annotations

from typing import Any

from superset.mcp_service.chart.plugin import BaseChartPlugin
from superset.mcp_service.chart.schemas import ColumnRef
from superset.mcp_service.common.error_schemas import ChartGenerationError


class BigNumberChartPlugin(BaseChartPlugin):
    """Plugin for big_number chart type."""

    chart_type = "big_number"
    display_name = "Big Number"
    native_viz_types = {
        "big_number": "Big Number with Trendline",
        "big_number_total": "Big Number",
    }

    def pre_validate(
        self,
        config: dict[str, Any],
    ) -> ChartGenerationError | None:
        if "metric" not in config:
            return ChartGenerationError(
                error_type="missing_metric",
                message="Big Number chart missing required field: metric",
                details=(
                    "Big Number charts require a 'metric' field "
                    "specifying the value to display"
                ),
                suggestions=[
                    "Add 'metric' with name and aggregate: "
                    "{'name': 'revenue', 'aggregate': 'SUM'}",
                    "The aggregate function is required (SUM, COUNT, AVG, MIN, MAX)",
                    "Example: {'chart_type': 'big_number', "
                    "'metric': {'name': 'sales', 'aggregate': 'SUM'}}",
                ],
                error_code="MISSING_BIG_NUMBER_METRIC",
            )

        metric = config.get("metric", {})
        if not isinstance(metric, dict):
            return ChartGenerationError(
                error_type="invalid_metric_type",
                message="Big Number metric must be a dict with 'name' and 'aggregate'",
                details=(
                    "The 'metric' field must be an object, got "
                    f"{type(metric).__name__}"
                ),
                suggestions=[
                    "Use a dict: {'name': 'col', 'aggregate': 'SUM'}",
                    "Valid aggregates: SUM, COUNT, AVG, MIN, MAX",
                ],
                error_code="INVALID_BIG_NUMBER_METRIC_TYPE",
            )
        if not metric.get("aggregate") and not metric.get("saved_metric"):
            return ChartGenerationError(
                error_type="missing_metric_aggregate",
                message=(
                    "Big Number metric must include an aggregate function "
                    "or reference a saved metric"
                ),
                details=(
                    "The metric must have an 'aggregate' field or 'saved_metric': true"
                ),
                suggestions=[
                    "Add 'aggregate': {'name': 'col', 'aggregate': 'SUM'}",
                    "Or use a saved metric: {'name': 'metric', 'saved_metric': true}",
                    "Valid aggregates: SUM, COUNT, AVG, MIN, MAX",
                ],
                error_code="MISSING_BIG_NUMBER_AGGREGATE",
            )

        show_trendline = config.get("show_trendline", False)
        temporal_column = config.get("temporal_column")
        if show_trendline and not temporal_column:
            return ChartGenerationError(
                error_type="missing_temporal_column",
                message="Trendline requires a temporal column",
                details=(
                    "When 'show_trendline' is True, "
                    "a 'temporal_column' must be specified"
                ),
                suggestions=[
                    "Add 'temporal_column': 'date_column_name'",
                    "Or set 'show_trendline': false for number only",
                    "Use get_dataset_info to find temporal columns",
                ],
                error_code="MISSING_TEMPORAL_COLUMN",
            )

        return None

    def extract_column_refs(self, config: Any) -> list[ColumnRef]:
        from superset.mcp_service.chart.schemas import BigNumberChartConfig

        if not isinstance(config, BigNumberChartConfig):
            return []
        refs: list[ColumnRef] = [config.metric]
        # temporal_column is a str field, not a ColumnRef — validate it exists
        if config.temporal_column:
            refs.append(ColumnRef(name=config.temporal_column))
        if config.filters:
            for f in config.filters:
                refs.append(ColumnRef(name=f.column))
        return refs

    def to_form_data(
        self, config: Any, dataset_id: int | str | None = None
    ) -> dict[str, Any]:
        from superset.mcp_service.chart.chart_utils import map_big_number_config

        return map_big_number_config(config)

    def post_map_validate(
        self,
        config: Any,
        form_data: dict[str, Any],
        dataset_id: int | str | None = None,
    ) -> ChartGenerationError | None:
        """Verify the trendline temporal column is a real temporal SQL type.

        This check was previously baked into map_config_to_form_data() in
        chart_utils.py as a special case. Moving it here keeps the dispatcher
        clean and makes the constraint explicit and discoverable.
        """
        from superset.mcp_service.chart.schemas import BigNumberChartConfig

        if not isinstance(config, BigNumberChartConfig):
            return None
        if not (config.show_trendline and config.temporal_column):
            return None

        from superset.mcp_service.chart.chart_utils import is_column_truly_temporal

        if not is_column_truly_temporal(config.temporal_column, dataset_id):
            return ChartGenerationError(
                error_type="non_temporal_trendline_column",
                message=(
                    f"Big Number trendline requires a temporal SQL column; "
                    f"'{config.temporal_column}' is not temporal."
                ),
                details=(
                    f"Column '{config.temporal_column}' does not have a temporal "
                    f"SQL type (DATE, DATETIME, TIMESTAMP). The trendline requires "
                    f"a true temporal column for DATE_TRUNC to work."
                ),
                suggestions=[
                    "Use get_dataset_info to find columns with temporal SQL types",
                    "Set 'show_trendline': false to use any column as the metric",
                    "If the column contains dates stored as integers, "
                    "consider casting it in a virtual dataset",
                ],
                error_code="NON_TEMPORAL_TRENDLINE_COLUMN",
            )

        return None

    def normalize_column_refs(self, config: Any, dataset_context: Any) -> Any:
        from superset.mcp_service.chart.schemas import BigNumberChartConfig
        from superset.mcp_service.chart.validation.dataset_validator import (
            DatasetValidator,
        )

        config_dict = config.model_dump()

        if config_dict.get("metric") and not config_dict["metric"].get("saved_metric"):
            config_dict["metric"]["name"] = DatasetValidator._get_canonical_column_name(
                config_dict["metric"]["name"], dataset_context
            )
        if config_dict.get("temporal_column"):
            config_dict["temporal_column"] = (
                DatasetValidator._get_canonical_column_name(
                    config_dict["temporal_column"], dataset_context
                )
            )
        DatasetValidator._normalize_filters(config_dict, dataset_context)
        return BigNumberChartConfig.model_validate(config_dict)
