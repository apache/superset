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

"""
Unified schema validation for chart configurations.
Consolidates pre-validation, schema validation, and error enhancement.
"""

import logging
from typing import Any, Dict, Tuple

from pydantic import ValidationError as PydanticValidationError

from superset.mcp_service.chart.schemas import (
    GenerateChartRequest,
)
from superset.mcp_service.common.error_schemas import ChartGenerationError

logger = logging.getLogger(__name__)


class SchemaValidator:
    """Unified schema validator with pre-validation and enhanced error messages."""

    @staticmethod
    def validate_request(
        request_data: Dict[str, Any],
    ) -> Tuple[bool, GenerateChartRequest | None, ChartGenerationError | None]:
        """
        Validate request data with pre-validation and enhanced error handling.

        Returns:
            Tuple of (is_valid, parsed_request, error)
        """
        # Pre-validate to catch common issues early
        is_valid, error = SchemaValidator._pre_validate(request_data)
        if not is_valid:
            return False, None, error

        # Try Pydantic validation
        try:
            request = GenerateChartRequest(**request_data)
            return True, request, None
        except PydanticValidationError as e:
            # Enhance the error message
            error = SchemaValidator._enhance_validation_error(e, request_data)
            return False, None, error

    @staticmethod
    def _pre_validate(
        data: Dict[str, Any],
    ) -> Tuple[bool, ChartGenerationError | None]:
        """Pre-validate request data before Pydantic processing."""
        if not isinstance(data, dict):
            return False, ChartGenerationError(
                error_type="invalid_request_format",
                message="Request must be a JSON object",
                details="The request body must be a valid JSON object, not a string "
                "or array",
                suggestions=[
                    "Ensure you're sending a JSON object with 'dataset_id' and "
                    "'config' fields",
                    "Check that Content-Type header is set to 'application/json'",
                ],
                error_code="INVALID_REQUEST_FORMAT",
            )

        # Check for required top-level fields
        if "dataset_id" not in data:
            return False, ChartGenerationError(
                error_type="missing_dataset_id",
                message="Missing required field: dataset_id",
                details="The 'dataset_id' field is required to identify which dataset "
                "to use",
                suggestions=[
                    "Add 'dataset_id' field with the ID of your dataset",
                    "Use list_datasets tool to find available dataset IDs",
                    "Example: {'dataset_id': 1, 'config': {...}}",
                ],
                error_code="MISSING_DATASET_ID",
            )

        if "config" not in data:
            return False, ChartGenerationError(
                error_type="missing_config",
                message="Missing required field: config",
                details="The 'config' field is required to specify chart configuration",
                suggestions=[
                    "Add 'config' field with chart type and settings",
                    "Example: {'dataset_id': 1, 'config': {'chart_type': 'xy', ...}}",
                ],
                error_code="MISSING_CONFIG",
            )

        config = data.get("config", {})
        if not isinstance(config, dict):
            return False, ChartGenerationError(
                error_type="invalid_config_format",
                message="Config must be a JSON object",
                details="The 'config' field must be a valid JSON object with chart "
                "settings",
                suggestions=[
                    "Ensure config is an object, not a string or array",
                    "Example: 'config': {'chart_type': 'xy', 'x': {...}, 'y': [...]}",
                ],
                error_code="INVALID_CONFIG_FORMAT",
            )

        # Check chart_type early
        chart_type = config.get("chart_type")
        if not chart_type:
            return False, ChartGenerationError(
                error_type="missing_chart_type",
                message="Missing required field: chart_type",
                details="Chart configuration must specify 'chart_type'",
                suggestions=[
                    "Add 'chart_type': 'xy' for line/bar/area/scatter charts",
                    "Add 'chart_type': 'table' for table visualizations",
                    "Add 'chart_type': 'pie' for pie or donut charts",
                    "Add 'chart_type': 'pivot_table' for interactive pivot tables",
                    "Add 'chart_type': 'mixed_timeseries' for dual-series time charts",
                    "Add 'chart_type': 'handlebars' for custom HTML template charts",
                    "Add 'chart_type': 'big_number' for big number display",
                    "Example: 'config': {'chart_type': 'xy', ...}",
                ],
                error_code="MISSING_CHART_TYPE",
            )

        return SchemaValidator._pre_validate_chart_type(chart_type, config)

    @staticmethod
    def _pre_validate_chart_type(
        chart_type: str,
        config: Dict[str, Any],
    ) -> Tuple[bool, ChartGenerationError | None]:
        """Validate chart type and dispatch to plugin pre-validation."""
        from superset.mcp_service.chart.registry import get_registry

        registry = get_registry()

        if not isinstance(chart_type, str) or not registry.is_registered(chart_type):
            valid_types = ", ".join(registry.all_types())
            return False, ChartGenerationError(
                error_type="invalid_chart_type",
                message=f"Invalid chart_type: '{chart_type}'",
                details=f"Chart type '{chart_type}' is not supported. "
                f"Must be one of: {valid_types}",
                suggestions=[
                    "Use 'chart_type': 'xy' for line, bar, area, or scatter charts",
                    "Use 'chart_type': 'table' for tabular data display",
                    "Use 'chart_type': 'pie' for pie or donut charts",
                    "Use 'chart_type': 'pivot_table' for interactive pivot tables",
                    "Use 'chart_type': 'mixed_timeseries' for dual-series time charts",
                    "Use 'chart_type': 'handlebars' for custom HTML template charts",
                    "Use 'chart_type': 'big_number' for big number display",
                    "Check spelling and ensure lowercase",
                ],
                error_code="INVALID_CHART_TYPE",
            )

        plugin = registry.get(chart_type)
        if plugin is None:
            return False, ChartGenerationError(
                error_type="invalid_chart_type",
                message=f"Chart type '{chart_type}' has no registered plugin",
                details="Internal error: chart type is listed but has no plugin",
                suggestions=["Use a supported chart_type"],
                error_code="INVALID_CHART_TYPE",
            )

        if (error := plugin.pre_validate(config)) is not None:
            return False, error
        return True, None

    # Per-chart-type error details used by _enhance_validation_error.
    # Keyed by chart_type discriminator value.
    # NOTE: Keep this dict in sync with the plugin registry in
    # superset/mcp_service/chart/plugins/ — each registered chart_type must
    # have a corresponding entry here so Pydantic parse errors produce
    # helpful, type-specific messages.
    _CHART_TYPE_ERROR_HINTS: Dict[str, Dict[str, Any]] = {
        "xy": {
            "error_type": "xy_validation_error",
            "message": "XY chart configuration validation failed",
            "details": "The XY chart configuration is missing required "
            "fields or has invalid structure",
            "suggestions": [
                "Note: 'x' is optional and defaults to the dataset's primary datetime column",
                "Ensure 'y' is an array: [{'name': 'metric', 'aggregate': 'SUM'}]",
                "Check that all column names are strings",
                "Verify aggregate functions are valid: SUM, COUNT, AVG, MIN, MAX",
            ],
            "error_code": "XY_VALIDATION_ERROR",
        },
        "table": {
            "error_type": "table_validation_error",
            "message": "Table chart configuration validation failed",
            "details": "The table chart configuration is missing required "
            "fields or has invalid structure",
            "suggestions": [
                "Ensure 'columns' field is an array of column specifications",
                "Each column needs {'name': 'column_name'}",
                "Optional: add 'aggregate' for metrics",
                "Example: 'columns': [{'name': 'product'}, "
                "{'name': 'sales', 'aggregate': 'SUM'}]",
            ],
            "error_code": "TABLE_VALIDATION_ERROR",
        },
        "pie": {
            "error_type": "pie_validation_error",
            "message": "Pie chart configuration validation failed",
            "details": "The pie chart configuration is missing required "
            "fields or has invalid structure",
            "suggestions": [
                "Ensure 'dimension' field has 'name' for the slice label",
                "Ensure 'metric' field has 'name' and 'aggregate'",
                "Example: {'chart_type': 'pie', 'dimension': {'name': 'category'}, "
                "'metric': {'name': 'revenue', 'aggregate': 'SUM'}}",
            ],
            "error_code": "PIE_VALIDATION_ERROR",
        },
        "pivot_table": {
            "error_type": "pivot_table_validation_error",
            "message": "Pivot table configuration validation failed",
            "details": "The pivot table configuration is missing required "
            "fields or has invalid structure",
            "suggestions": [
                "Ensure 'rows' field is an array of column specs",
                "Ensure 'metrics' field is an array with aggregate funcs",
                "Optional: add 'columns' for column grouping",
                "Example: {'chart_type': 'pivot_table', 'rows': [{'name': 'region'}], "
                "'metrics': [{'name': 'revenue', 'aggregate': 'SUM'}]}",
            ],
            "error_code": "PIVOT_TABLE_VALIDATION_ERROR",
        },
        "mixed_timeseries": {
            "error_type": "mixed_timeseries_validation_error",
            "message": "Mixed timeseries chart configuration validation failed",
            "details": "The mixed timeseries configuration is missing "
            "required fields or has invalid structure",
            "suggestions": [
                "Ensure 'x' field has 'name' for the time axis column",
                "Ensure 'y' is an array of primary-axis metrics",
                "Ensure 'y_secondary' is an array of secondary-axis metrics",
                "Example: {'chart_type': 'mixed_timeseries', "
                "'x': {'name': 'order_date'}, "
                "'y': [{'name': 'revenue', 'aggregate': 'SUM'}], "
                "'y_secondary': [{'name': 'orders', 'aggregate': 'COUNT'}]}",
            ],
            "error_code": "MIXED_TIMESERIES_VALIDATION_ERROR",
        },
        "handlebars": {
            "error_type": "handlebars_validation_error",
            "message": "Handlebars chart configuration validation failed",
            "details": "The handlebars chart configuration is missing "
            "required fields or has invalid structure",
            "suggestions": [
                "Ensure 'handlebars_template' is a non-empty string",
                "For aggregate mode: add 'metrics' with aggregate functions",
                "For raw mode: set 'query_mode': 'raw' and add 'columns'",
                "Example: {'chart_type': 'handlebars', "
                "'handlebars_template': '<ul>{{#each data}}<li>"
                "{{this.name}}</li>{{/each}}</ul>', "
                "'metrics': [{'name': 'sales', 'aggregate': 'SUM'}]}",
            ],
            "error_code": "HANDLEBARS_VALIDATION_ERROR",
        },
        "big_number": {
            "error_type": "big_number_validation_error",
            "message": "Big Number chart configuration validation failed",
            "details": "The Big Number chart configuration is missing required "
            "fields or has invalid structure",
            "suggestions": [
                "Ensure 'metric' field has 'name' and 'aggregate'",
                "Example: 'metric': {'name': 'revenue', 'aggregate': 'SUM'}",
                "For trendline: add show_trendline=true and temporal_column='col'",
                "Without trendline: just provide the metric",
            ],
            "error_code": "BIG_NUMBER_VALIDATION_ERROR",
        },
    }

    @staticmethod
    def _enhance_validation_error(
        error: PydanticValidationError, request_data: Dict[str, Any]
    ) -> ChartGenerationError:
        """Convert Pydantic validation errors to user-friendly messages."""
        errors = error.errors()

        # Check for discriminated union errors (generic "'table' was expected")
        for err in errors:
            if err.get("type") == "union_tag_invalid" or "discriminator" in str(
                err.get("ctx", {})
            ):
                chart_type = request_data.get("config", {}).get("chart_type", "")
                hint = SchemaValidator._CHART_TYPE_ERROR_HINTS.get(chart_type)
                if hint:
                    return ChartGenerationError(**hint)

        # Default enhanced error
        error_details = []
        for err in errors[:3]:  # Show first 3 errors
            loc = " -> ".join(str(location) for location in err.get("loc", []))
            msg = err.get("msg", "Validation failed")
            error_details.append(f"{loc}: {msg}" if loc else msg)

        return ChartGenerationError(
            error_type="validation_error",
            message="Chart configuration validation failed",
            details="; ".join(error_details) or "Invalid chart configuration structure",
            suggestions=[
                "Check that all required fields are present",
                "Ensure field types match the schema",
                "Use get_dataset_info to verify column names",
                "Refer to the API documentation for field requirements",
            ],
            error_code="VALIDATION_ERROR",
        )
