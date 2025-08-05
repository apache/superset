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
Enhanced validation wrapper to catch Pydantic errors early and provide better user
experience.
"""

import logging
from typing import Any, Dict, List, Optional, Tuple

from pydantic import ValidationError as PydanticValidationError

from superset.mcp_service.schemas.chart_schemas import GenerateChartRequest
from superset.mcp_service.schemas.error_schemas import ChartGenerationError

logger = logging.getLogger(__name__)


class EnhancedChartValidator:
    """Enhanced validation wrapper that provides better error messages for common
    issues."""

    @staticmethod
    def validate_generate_chart_request(
        raw_data: Dict[str, Any],
    ) -> Tuple[bool, Optional[GenerateChartRequest], Optional[ChartGenerationError]]:
        """
        Validate GenerateChartRequest with enhanced error handling.

        Args:
            raw_data: Raw request data to validate

        Returns:
            Tuple of (is_valid, validated_request, error_details)
        """
        try:
            # First attempt normal Pydantic validation
            validated_request = GenerateChartRequest.model_validate(raw_data)
            return True, validated_request, None

        except PydanticValidationError as e:
            # Handle Pydantic validation errors with intelligent interpretation
            error = EnhancedChartValidator._create_enhanced_error(e, raw_data)
            return False, None, error
        except Exception as e:
            # Handle unexpected validation errors
            error = ChartGenerationError(
                error_type="validation_system_error",
                message="Unexpected validation error",
                details=f"An unexpected error occurred during validation: {str(e)}",
                suggestions=[
                    "Check that all required fields are provided",
                    "Ensure data types are correct",
                    "Contact support if this error persists",
                ],
                error_code="VALIDATION_SYSTEM_ERROR",
            )
            return False, None, error

    @staticmethod
    def _create_enhanced_error(
        validation_error: PydanticValidationError, raw_data: Dict[str, Any]
    ) -> ChartGenerationError:
        """Create an enhanced error with better context and suggestions."""

        # Extract chart configuration for context
        config_data = raw_data.get("config", {})
        chart_type = config_data.get("chart_type", "unknown")

        # Analyze validation errors for patterns
        error_analysis = EnhancedChartValidator._analyze_validation_errors(
            validation_error, config_data, chart_type
        )

        # Generate user-friendly error message
        main_message = error_analysis["main_message"]
        details = error_analysis["details"]
        suggestions = error_analysis["suggestions"]
        error_code = error_analysis["error_code"]

        return ChartGenerationError(
            error_type="enhanced_validation_error",
            message=main_message,
            details=details,
            suggestions=suggestions,
            error_code=error_code,
        )

    @staticmethod
    def _analyze_validation_errors(
        validation_error: PydanticValidationError,
        config_data: Dict[str, Any],
        chart_type: str,
    ) -> Dict[str, Any]:
        """Analyze validation errors and generate contextual responses."""

        errors = validation_error.errors()

        # Check for specific error patterns in priority order
        if EnhancedChartValidator._is_invalid_chart_type_error(errors):
            return EnhancedChartValidator._handle_invalid_chart_type(config_data)

        if EnhancedChartValidator._is_discriminated_union_error(errors):
            # Handle discriminated union errors which often mask the real issue
            return EnhancedChartValidator._handle_discriminated_union_error(
                errors, config_data
            )

        if EnhancedChartValidator._is_missing_required_field_error(errors, chart_type):
            return EnhancedChartValidator._handle_missing_required_fields(
                errors, chart_type
            )

        # Default error handling
        return {
            "main_message": "Chart configuration validation failed",
            "details": f"Multiple validation errors occurred: "
            f"{'; '.join([err['msg'] for err in errors[:3]])}",
            "suggestions": [
                "Check that chart_type is set to 'xy' or 'table'",
                "Ensure all required fields are provided for your chart type",
                "Verify field names and data types are correct",
            ],
            "error_code": "GENERAL_VALIDATION_ERROR",
        }

    @staticmethod
    def _is_invalid_chart_type_error(errors: List[Dict[str, Any]]) -> bool:
        """Check if errors indicate an invalid chart_type."""
        for error in errors:
            if "literal_error" in error.get("type", "") and "chart_type" in str(
                error.get("loc", [])
            ):
                return True
        return False

    @staticmethod
    def _is_missing_required_field_error(
        errors: List[Dict[str, Any]], chart_type: str
    ) -> bool:
        """Check if errors indicate missing required fields."""
        missing_field_indicators = ["missing", "required"]
        for error in errors:
            error_type = error.get("type", "")
            if any(indicator in error_type for indicator in missing_field_indicators):
                return True
        return False

    @staticmethod
    def _is_discriminated_union_error(errors: List[Dict[str, Any]]) -> bool:
        """Check if errors are related to discriminated union validation."""
        union_indicators = ["union_tag_invalid", "discriminated_union"]
        for error in errors:
            error_type = error.get("type", "")
            if any(indicator in error_type for indicator in union_indicators):
                return True
        return False

    @staticmethod
    def _handle_invalid_chart_type(config_data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle invalid chart_type errors."""
        provided_type = config_data.get("chart_type", "not specified")

        return {
            "main_message": f"Invalid chart_type '{provided_type}'",
            "details": (
                f"The chart_type '{provided_type}' is not supported. "
                f"Valid chart types are 'xy' for charts with X/Y axes (line, bar, "
                f"area, scatter) "
                f"and 'table' for data tables."
            ),
            "suggestions": [
                "Set chart_type to 'xy' for line, bar, area, or scatter charts",
                "Set chart_type to 'table' for data tables",
                "Check spelling and ensure chart_type field is correctly specified",
            ],
            "error_code": "INVALID_CHART_TYPE",
        }

    @staticmethod
    def _handle_missing_required_fields(
        errors: List[Dict[str, Any]], chart_type: str
    ) -> Dict[str, Any]:
        """Handle missing required field errors."""
        missing_xy_fields, missing_table_fields = (
            EnhancedChartValidator._analyze_missing_fields(errors)
        )

        if chart_type == "xy" or missing_xy_fields:
            return EnhancedChartValidator._handle_xy_missing_fields(missing_xy_fields)
        elif chart_type == "table" or missing_table_fields:
            return EnhancedChartValidator._handle_table_missing_fields()
        else:
            return EnhancedChartValidator._handle_generic_missing_fields()

    @staticmethod
    def _analyze_missing_fields(
        errors: List[Dict[str, Any]],
    ) -> Tuple[List[str], List[str]]:
        """Analyze errors to find missing XY and table fields."""
        missing_xy_fields = []
        missing_table_fields = []

        for error in errors:
            field_path = " -> ".join(str(loc) for loc in error.get("loc", []))
            loc_parts = [str(part) for part in error.get("loc", [])]

            # Check exact field names in location path
            if "x" in loc_parts or "x" == field_path.lower():
                missing_xy_fields.append("x")
            elif "y" in loc_parts or "y" == field_path.lower():
                missing_xy_fields.append("y")
            elif "columns" in loc_parts or "columns" == field_path.lower():
                missing_table_fields.append("columns")

        return list(set(missing_xy_fields)), list(set(missing_table_fields))

    @staticmethod
    def _handle_xy_missing_fields(missing_fields: List[str]) -> Dict[str, Any]:
        """Handle missing XY chart fields."""
        if "y" in missing_fields:
            return {
                "main_message": "Missing required field 'y' for XY chart configuration",
                "details": (
                    "XY charts require a 'y' field containing at least one Y-axis "
                    "metric. Y-axis metrics define what values to plot on the "
                    "vertical axis."
                ),
                "suggestions": [
                    "Add a 'y' field with at least one column specification",
                    "Include aggregate functions like SUM, COUNT, or AVG for "
                    "Y-axis metrics",
                    'Example: "y": [{"name": "sales", "aggregate": "SUM"}]',
                ],
                "error_code": "MISSING_Y_FIELD",
            }
        elif "x" in missing_fields:
            return {
                "main_message": "Missing required field 'x' for XY chart configuration",
                "details": (
                    "XY charts require an 'x' field specifying the X-axis column. "
                    "This defines what values appear on the horizontal axis."
                ),
                "suggestions": [
                    "Add an 'x' field with a column specification",
                    'Example: "x": {"name": "date"}',
                    "The X-axis typically represents time, categories, or dimensions",
                ],
                "error_code": "MISSING_X_FIELD",
            }
        return EnhancedChartValidator._handle_generic_missing_fields()

    @staticmethod
    def _handle_table_missing_fields() -> Dict[str, Any]:
        """Handle missing table chart fields."""
        return {
            "main_message": (
                "Missing required field 'columns' for table chart configuration"
            ),
            "details": (
                "Table charts require a 'columns' field containing at least one "
                "column specification. This defines what data columns to display "
                "in the table."
            ),
            "suggestions": [
                "Add a 'columns' field with at least one column specification",
                'Example: "columns": [{"name": "product"}, {"name": "sales", '
                '"aggregate": "SUM"}]',
                "Include aggregate functions for calculated columns if needed",
            ],
            "error_code": "MISSING_COLUMNS_FIELD",
        }

    @staticmethod
    def _handle_generic_missing_fields() -> Dict[str, Any]:
        """Handle generic missing field cases."""
        return {
            "main_message": "Missing required fields in chart configuration",
            "details": (
                "Chart configuration is missing required fields based on the "
                "chart type."
            ),
            "suggestions": [
                "For XY charts: provide both 'x' and 'y' fields",
                "For table charts: provide 'columns' field",
                "Ensure chart_type is set to 'xy' or 'table'",
            ],
            "error_code": "MISSING_REQUIRED_FIELDS",
        }

    @staticmethod
    def _handle_discriminated_union_error(
        errors: List[Dict[str, Any]], config_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle discriminated union validation errors."""
        chart_type = config_data.get("chart_type", "not specified")

        # Check if this is specifically a union_tag_invalid error (invalid chart_type)
        for error in errors:
            if error.get("type") == "union_tag_invalid":
                # Extract the invalid tag from the error message
                error_msg = error.get("msg", "")
                if (
                    "Input tag" in error_msg
                    and "does not match any of the expected tags" in error_msg
                ):
                    return EnhancedChartValidator._handle_invalid_chart_type(
                        config_data
                    )

        # Check if chart_type is present but configuration doesn't match
        if chart_type in ["xy", "table"]:
            return {
                "main_message": f"Chart configuration doesn't match {chart_type} "
                f"chart requirements",
                "details": (
                    f"The chart_type is set to '{chart_type}' but the configuration "
                    f"structure "
                    f"doesn't match the requirements for this chart type."
                ),
                "suggestions": [
                    f"For '{chart_type}' charts, ensure all required fields are "
                    f"present",
                    "Check field names and structure against the chart type "
                    "requirements",
                    "Verify that field values are not empty or null",
                ],
                "error_code": "CHART_CONFIG_MISMATCH",
            }

        # Chart type not specified or invalid
        return {
            "main_message": "Chart configuration validation failed",
            "details": (
                "Unable to determine chart type or configuration doesn't match any "
                "supported format. "
                "Please specify a valid chart_type and provide the corresponding "
                "required fields."
            ),
            "suggestions": [
                "Set chart_type to 'xy' or 'table'",
                "For XY charts: provide 'x' and 'y' fields",
                "For table charts: provide 'columns' field",
                "Check that all field names are spelled correctly",
            ],
            "error_code": "DISCRIMINATED_UNION_ERROR",
        }
