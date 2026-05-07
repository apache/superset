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

"""Table chart type plugin."""

from __future__ import annotations

from typing import Any

from superset.mcp_service.chart.plugin import BaseChartPlugin
from superset.mcp_service.chart.schemas import ColumnRef
from superset.mcp_service.common.error_schemas import ChartGenerationError


class TableChartPlugin(BaseChartPlugin):
    """Plugin for table chart type."""

    chart_type = "table"
    display_name = "Table"
    native_viz_types = {
        "table": "Table",
        "ag-grid-table": "Interactive Table",
    }

    def pre_validate(
        self,
        config: dict[str, Any],
    ) -> ChartGenerationError | None:
        if "columns" not in config:
            return ChartGenerationError(
                error_type="missing_columns",
                message="Table chart missing required field: columns",
                details=(
                    "Table charts require a 'columns' array to specify which "
                    "columns to display"
                ),
                suggestions=[
                    "Add 'columns' field with array of column specifications",
                    "Example: 'columns': [{'name': 'product'}, {'name': 'sales', "
                    "'aggregate': 'SUM'}]",
                    "Each column can have optional 'aggregate' for metrics",
                ],
                error_code="MISSING_COLUMNS",
            )

        if not isinstance(config.get("columns", []), list):
            return ChartGenerationError(
                error_type="invalid_columns_format",
                message="Columns must be a list",
                details="The 'columns' field must be an array of column specifications",
                suggestions=[
                    "Ensure columns is an array: 'columns': [...]",
                    "Each column should be an object with 'name' field",
                ],
                error_code="INVALID_COLUMNS_FORMAT",
            )

        return None

    def extract_column_refs(self, config: Any) -> list[ColumnRef]:
        from superset.mcp_service.chart.schemas import TableChartConfig

        if not isinstance(config, TableChartConfig):
            return []
        refs: list[ColumnRef] = list(config.columns)
        if config.filters:
            for f in config.filters:
                refs.append(ColumnRef(name=f.column))
        return refs

    def to_form_data(
        self, config: Any, dataset_id: int | str | None = None
    ) -> dict[str, Any]:
        from superset.mcp_service.chart.chart_utils import map_table_config

        return map_table_config(config)

    def normalize_column_refs(self, config: Any, dataset_context: Any) -> Any:
        from superset.mcp_service.chart.schemas import TableChartConfig
        from superset.mcp_service.chart.validation.dataset_validator import (
            DatasetValidator,
        )

        config_dict = config.model_dump()
        DatasetValidator._normalize_table_config(config_dict, dataset_context)
        DatasetValidator._normalize_filters(config_dict, dataset_context)
        return TableChartConfig.model_validate(config_dict)
