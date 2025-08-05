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
from typing import Any, Dict, Optional, Tuple

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
    ) -> Tuple[bool, Optional[GenerateChartRequest], Optional[ChartGenerationError]]:
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
    ) -> Tuple[bool, Optional[ChartGenerationError]]:
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
                details="Chart configuration must specify 'chart_type' as either 'xy' "
                "or 'table'",
                suggestions=[
                    "Add 'chart_type': 'xy' for line/bar/area/scatter charts",
                    "Add 'chart_type': 'table' for table visualizations",
                    "Example: 'config': {'chart_type': 'xy', ...}",
                ],
                error_code="MISSING_CHART_TYPE",
            )

        if chart_type not in ["xy", "table"]:
            return False, ChartGenerationError(
                error_type="invalid_chart_type",
                message=f"Invalid chart_type: '{chart_type}'",
                details=f"Chart type '{chart_type}' is not supported. Must be 'xy' or "
                f"'table'",
                suggestions=[
                    "Use 'chart_type': 'xy' for line, bar, area, or scatter charts",
                    "Use 'chart_type': 'table' for tabular data display",
                    "Check spelling and ensure lowercase",
                ],
                error_code="INVALID_CHART_TYPE",
            )

        # Pre-validate structure based on chart type
        if chart_type == "xy":
            return SchemaValidator._pre_validate_xy_config(config)
        elif chart_type == "table":
            return SchemaValidator._pre_validate_table_config(config)

        return True, None

    @staticmethod
    def _pre_validate_xy_config(
        config: Dict[str, Any],
    ) -> Tuple[bool, Optional[ChartGenerationError]]:
        """Pre-validate XY chart configuration."""
        missing_fields = []

        if "x" not in config:
            missing_fields.append("'x' (X-axis column)")
        if "y" not in config:
            missing_fields.append("'y' (Y-axis metrics)")

        if missing_fields:
            return False, ChartGenerationError(
                error_type="missing_xy_fields",
                message=f"XY chart missing required "
                f"fields: {', '.join(missing_fields)}",
                details="XY charts require both X-axis (dimension) and Y-axis ("
                "metrics) specifications",
                suggestions=[
                    "Add 'x' field: {'name': 'column_name'} for X-axis",
                    "Add 'y' field: [{'name': 'metric_column', 'aggregate': 'SUM'}] "
                    "for Y-axis",
                    "Example: {'chart_type': 'xy', 'x': {'name': 'date'}, "
                    "'y': [{'name': 'sales', 'aggregate': 'SUM'}]}",
                ],
                error_code="MISSING_XY_FIELDS",
            )

        # Validate Y is a list
        if not isinstance(config.get("y", []), list):
            return False, ChartGenerationError(
                error_type="invalid_y_format",
                message="Y-axis must be a list of metrics",
                details="The 'y' field must be an array of metric specifications",
                suggestions=[
                    "Wrap Y-axis metric in array: 'y': [{'name': 'column', "
                    "'aggregate': 'SUM'}]",
                    "Multiple metrics supported: 'y': [metric1, metric2, ...]",
                ],
                error_code="INVALID_Y_FORMAT",
            )

        return True, None

    @staticmethod
    def _pre_validate_table_config(
        config: Dict[str, Any],
    ) -> Tuple[bool, Optional[ChartGenerationError]]:
        """Pre-validate table chart configuration."""
        if "columns" not in config:
            return False, ChartGenerationError(
                error_type="missing_columns",
                message="Table chart missing required field: columns",
                details="Table charts require a 'columns' array to specify which "
                "columns to display",
                suggestions=[
                    "Add 'columns' field with array of column specifications",
                    "Example: 'columns': [{'name': 'product'}, {'name': 'sales', "
                    "'aggregate': 'SUM'}]",
                    "Each column can have optional 'aggregate' for metrics",
                ],
                error_code="MISSING_COLUMNS",
            )

        if not isinstance(config.get("columns", []), list):
            return False, ChartGenerationError(
                error_type="invalid_columns_format",
                message="Columns must be a list",
                details="The 'columns' field must be an array of column specifications",
                suggestions=[
                    "Ensure columns is an array: 'columns': [...]",
                    "Each column should be an object with 'name' field",
                ],
                error_code="INVALID_COLUMNS_FORMAT",
            )

        return True, None

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
                # This is the generic union error - provide better message
                config = request_data.get("config", {})
                chart_type = config.get("chart_type", "unknown")

                if chart_type == "xy":
                    return ChartGenerationError(
                        error_type="xy_validation_error",
                        message="XY chart configuration validation failed",
                        details="The XY chart configuration is missing required "
                        "fields or has invalid structure",
                        suggestions=[
                            "Ensure 'x' field exists with {'name': 'column_name'}",
                            "Ensure 'y' field is an array: [{'name': 'metric', "
                            "'aggregate': 'SUM'}]",
                            "Check that all column names are strings",
                            "Verify aggregate functions are valid: SUM, COUNT, AVG, "
                            "MIN, MAX",
                        ],
                        error_code="XY_VALIDATION_ERROR",
                    )
                elif chart_type == "table":
                    return ChartGenerationError(
                        error_type="table_validation_error",
                        message="Table chart configuration validation failed",
                        details="The table chart configuration is missing required "
                        "fields or has invalid structure",
                        suggestions=[
                            "Ensure 'columns' field is an array of column "
                            "specifications",
                            "Each column needs {'name': 'column_name'}",
                            "Optional: add 'aggregate' for metrics",
                            "Example: 'columns': [{'name': 'product'}, {'name': "
                            "'sales', 'aggregate': 'SUM'}]",
                        ],
                        error_code="TABLE_VALIDATION_ERROR",
                    )

        # Default enhanced error
        error_details = []
        for err in errors[:3]:  # Show first 3 errors
            loc = " -> ".join(str(location) for location in err.get("loc", []))
            msg = err.get("msg", "Validation failed")
            error_details.append(f"{loc}: {msg}")

        return ChartGenerationError(
            error_type="validation_error",
            message="Chart configuration validation failed",
            details="; ".join(error_details),
            suggestions=[
                "Check that all required fields are present",
                "Ensure field types match the schema",
                "Use get_dataset_info to verify column names",
                "Refer to the API documentation for field requirements",
            ],
            error_code="VALIDATION_ERROR",
        )
