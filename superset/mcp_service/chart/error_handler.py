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
Centralized error handling for chart generation with standardized response format.
"""

import logging
import time
from typing import Any, Dict, List, Optional, Tuple

from pydantic import ValidationError as PydanticValidationError

from superset.mcp_service.schemas.error_schemas import ChartGenerationError

logger = logging.getLogger(__name__)


class ChartErrorHandler:
    """Centralized error handling for chart generation operations."""

    @staticmethod
    def create_standardized_error_response(
        error: Exception,
        start_time: float,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Create a standardized error response for chart generation failures.

        Args:
            error: The exception that occurred
            start_time: When the operation started (for performance tracking)
            context: Additional context about the operation

        Returns:
            Standardized error response dictionary
        """
        execution_time = int((time.time() - start_time) * 1000)
        context = context or {}

        # Analyze the error type and create appropriate response
        if isinstance(error, PydanticValidationError):
            return ChartErrorHandler._handle_pydantic_validation_error(
                error, execution_time, context
            )
        elif isinstance(error, ValueError):
            return ChartErrorHandler._handle_value_error(error, execution_time, context)
        elif "permission" in str(error).lower() or "access" in str(error).lower():
            return ChartErrorHandler._handle_permission_error(
                error, execution_time, context
            )
        elif "sql" in str(error).lower() or "query" in str(error).lower():
            return ChartErrorHandler._handle_sql_error(error, execution_time, context)
        elif "timeout" in str(error).lower():
            return ChartErrorHandler._handle_timeout_error(
                error, execution_time, context
            )
        else:
            return ChartErrorHandler._handle_generic_error(
                error, execution_time, context
            )

    @staticmethod
    def _handle_pydantic_validation_error(
        error: PydanticValidationError,
        execution_time: int,
        context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Handle Pydantic validation errors with intelligent chart type detection."""
        validation_issues: List[str] = []
        user_friendly_suggestions: List[str] = []

        # First, check if we can determine the intended chart type from context
        intended_chart_type = ChartErrorHandler._detect_intended_chart_type(
            error, context
        )

        # Track different types of errors for intelligent processing
        missing_field_errors: List[Tuple[str, str, Any, Dict[str, Any]]] = []
        discriminated_union_errors: List[Tuple[str, str, Any, Dict[str, Any]]] = []

        # Check for the generic union validation errors that need special handling
        has_generic_union_error = False

        for err in error.errors():
            field_path = " -> ".join(str(loc) for loc in err["loc"])
            error_type = err.get("type", "")
            error_msg = err["msg"]
            input_value = err.get("input", "")

            # Check for generic "Input should be a valid dictionary" errors from
            # union validation
            if (
                "'table' was expected" in error_msg
                or "'xy' was expected" in error_msg
                or "Input should be a valid dictionary" in error_msg
            ):
                has_generic_union_error = True
                # Don't add these generic errors - we'll replace with specific ones
                continue

            # Prioritize discriminated union errors - these often mask the real issue
            if (
                "union_tag_invalid" in error_type
                or "discriminated_union" in error_type
                or (
                    "literal_error" in error_type
                    and "chart_type" in str(err.get("loc", []))
                )
            ):
                discriminated_union_errors.append(
                    (field_path, error_msg, input_value, err)
                )
            elif "missing" in error_type:
                missing_field_errors.append((field_path, error_msg, input_value, err))
            else:
                # Process other errors immediately
                ChartErrorHandler._process_single_error(
                    field_path,
                    error_type,
                    error_msg,
                    validation_issues,
                    user_friendly_suggestions,
                )

        # If we have generic union errors, provide specific guidance based on the input
        if has_generic_union_error and not validation_issues:
            ChartErrorHandler._handle_generic_union_validation_error(
                error, intended_chart_type, validation_issues, user_friendly_suggestions
            )

        # Handle discriminated union errors with smart interpretation
        if discriminated_union_errors:
            ChartErrorHandler._handle_discriminated_union_errors(
                discriminated_union_errors,
                missing_field_errors,
                intended_chart_type,
                validation_issues,
                user_friendly_suggestions,
            )
        elif missing_field_errors:
            # Handle missing field errors when no union issues
            if intended_chart_type:
                ChartErrorHandler._handle_chart_type_specific_errors(
                    intended_chart_type,
                    missing_field_errors,
                    validation_issues,
                    user_friendly_suggestions,
                )
            else:
                ChartErrorHandler._handle_ambiguous_chart_errors(
                    [],
                    missing_field_errors,
                    validation_issues,
                    user_friendly_suggestions,
                )

        # Add default suggestions if none were generated
        if not user_friendly_suggestions:
            user_friendly_suggestions = [
                "Check that all required fields are provided",
                "Ensure field types match the expected format",
                "Verify aggregation functions are valid (SUM, COUNT, AVG, etc.)",
                "Make sure arrays are not empty where data is required",
                "Validate that cache_timeout is non-negative if specified",
            ]

        chart_error = ChartGenerationError(
            error_type="validation_error",
            message="Input validation failed",
            details=f"Validation errors: {'; '.join(validation_issues)}",
            suggestions=user_friendly_suggestions,
            error_code="PYDANTIC_VALIDATION_FAILED",
        )

        return ChartErrorHandler._create_error_response(chart_error, execution_time)

    @staticmethod
    def _handle_value_error(
        error: ValueError,
        execution_time: int,
        context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Handle ValueError with context-aware suggestions."""
        error_msg = str(error)

        # Categorize the value error
        if "empty" in error_msg.lower():
            error_type = "empty_data_error"
            suggestions = [
                "Ensure at least one column is specified for table charts",
                "Include at least one Y-axis metric for XY charts",
                "Check that column names are not empty strings",
                "Verify arrays contain valid data elements",
            ]
        elif "aggregate" in error_msg.lower() or "function" in error_msg.lower():
            error_type = "invalid_aggregate_error"
            suggestions = [
                "Use only valid aggregation functions: SUM, COUNT, AVG, MIN, MAX, "
                "COUNT_DISTINCT",
                "Check column data types match aggregation functions",
                "Use COUNT for text columns, SUM/AVG for numeric columns",
            ]
        elif "cache" in error_msg.lower() or "timeout" in error_msg.lower():
            error_type = "cache_parameter_error"
            suggestions = [
                "Set cache_timeout to 0 or positive integer",
                "Use null/None to use default cache settings",
                "Check cache configuration parameters",
            ]
        else:
            error_type = "configuration_error"
            suggestions = [
                "Review chart configuration for invalid values",
                "Ensure all required parameters are provided correctly",
                "Check data types and formats of input fields",
            ]

        chart_error = ChartGenerationError(
            error_type=error_type,
            message="Chart configuration error",
            details=f"Configuration validation failed: {error_msg}",
            suggestions=suggestions,
            error_code="CONFIGURATION_ERROR",
        )

        return ChartErrorHandler._create_error_response(chart_error, execution_time)

    @staticmethod
    def _handle_permission_error(
        error: Exception,
        execution_time: int,
        context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Handle permission/access errors."""
        chart_error = ChartGenerationError(
            error_type="permission_error",
            message="Access denied",
            details=f"Permission error: {str(error)}",
            suggestions=[
                "Check that you have access to the dataset",
                "Verify your user permissions in Superset",
                "Contact your administrator for dataset access",
                "Ensure the dataset ID is correct and accessible",
            ],
            error_code="ACCESS_DENIED",
        )

        return ChartErrorHandler._create_error_response(chart_error, execution_time)

    @staticmethod
    def _handle_sql_error(
        error: Exception,
        execution_time: int,
        context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Handle SQL/query execution errors."""
        chart_error = ChartGenerationError(
            error_type="query_execution_error",
            message="Database query failed",
            details=f"SQL execution error: {str(error)}",
            suggestions=[
                "Check that column names exist in the dataset",
                "Verify filter values are valid for their column types",
                "Ensure aggregation functions are compatible with column data types",
                "Try a simpler query configuration first",
                "Check the dataset's underlying data source connectivity",
            ],
            error_code="SQL_EXECUTION_FAILED",
        )

        return ChartErrorHandler._create_error_response(chart_error, execution_time)

    @staticmethod
    def _handle_timeout_error(
        error: Exception,
        execution_time: int,
        context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Handle query timeout errors."""
        chart_error = ChartGenerationError(
            error_type="query_timeout_error",
            message="Query execution timeout",
            details=f"Query timed out: {str(error)}",
            suggestions=[
                "Try reducing the data range or adding filters",
                "Consider using a smaller sample of data",
                "Check if the database is responding slowly",
                "Contact your administrator about query performance",
                "Use more selective filters to reduce data volume",
            ],
            error_code="QUERY_TIMEOUT",
        )

        return ChartErrorHandler._create_error_response(chart_error, execution_time)

    @staticmethod
    def _handle_generic_error(
        error: Exception,
        execution_time: int,
        context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Handle generic/unexpected errors."""
        chart_error = ChartGenerationError(
            error_type="system_error",
            message="Unexpected error occurred",
            details=f"An unexpected error occurred: {str(error)}",
            suggestions=[
                "Try again with a simpler chart configuration",
                "Check that all input parameters are valid",
                "Verify the dataset is accessible and contains data",
                "Contact support if the issue persists",
            ],
            error_code="SYSTEM_ERROR",
        )

        return ChartErrorHandler._create_error_response(chart_error, execution_time)

    @staticmethod
    def _create_error_response(
        chart_error: ChartGenerationError,
        execution_time: int,
    ) -> Dict[str, Any]:
        """Create the final standardized error response."""
        return {
            "chart": None,
            "error": chart_error.model_dump(),
            "performance": {
                "query_duration_ms": execution_time,
                "cache_status": "error",
                "optimization_suggestions": [],
            },
            "success": False,
            "schema_version": "2.0",
            "api_version": "v1",
        }

    @staticmethod
    def _detect_intended_chart_type(
        error: PydanticValidationError,
        context: Dict[str, Any],
    ) -> Optional[str]:
        """Detect the intended chart type from error context and input data."""
        try:
            # Check context first
            if context and "chart_type" in context:
                return context["chart_type"]

            # Extract the most complete input data from errors
            largest_input = ChartErrorHandler._find_largest_input(error)

            # Try direct chart type detection from input
            if largest_input and "chart_type" in largest_input:
                chart_type = largest_input["chart_type"]
                if chart_type in ["xy", "table"]:
                    return chart_type

            # Infer chart type from field patterns
            return ChartErrorHandler._infer_chart_type_from_fields(largest_input)

        except Exception:
            return None

    @staticmethod
    def _find_largest_input(error: PydanticValidationError) -> Optional[Dict[str, Any]]:
        """Find the largest (most complete) input data from error details."""
        largest_input = None
        largest_size = 0

        for err in error.errors():
            if "input" in err and isinstance(err["input"], dict):
                input_data = err["input"]
                input_size = len(input_data)

                # Keep track of the largest input dict (most complete data)
                if input_size > largest_size:
                    largest_input = input_data
                    largest_size = input_size

        return largest_input

    @staticmethod
    def _infer_chart_type_from_fields(
        input_data: Optional[Dict[str, Any]],
    ) -> Optional[str]:
        """Infer chart type from field patterns in input data."""
        if not input_data:
            return None

        # Infer from presence of specific fields
        if "x" in input_data and "y" in input_data:
            return "xy"
        elif "columns" in input_data:
            return "table"
        elif "x" in input_data or "y" in input_data:
            return "xy"  # Partial XY chart data

        return None

    @staticmethod
    def _process_single_error(
        field_path: str,
        error_type: str,
        error_msg: str,
        validation_issues: List[str],
        user_friendly_suggestions: List[str],
    ) -> None:
        """Process individual non-union errors."""
        if "literal_error" in error_type:
            if "aggregate" in field_path:
                validation_issues.append(
                    f"Invalid aggregate function in {field_path}. Only SUM, COUNT, "
                    f"AVG, MIN, MAX, COUNT_DISTINCT, STDDEV, VAR, MEDIAN, PERCENTILE "
                    f"are allowed."
                )
                user_friendly_suggestions.append(
                    "Use valid aggregation functions - avoid custom SQL functions"
                )
            else:
                validation_issues.append(f"{field_path}: Invalid value - {error_msg}")
        elif "value_error" in error_type:
            if "script" in error_msg.lower() or "malicious" in error_msg.lower():
                validation_issues.append(
                    f"Security validation failed for {field_path}: {error_msg}"
                )
                user_friendly_suggestions.append(
                    "Remove HTML tags, script content, and special characters from "
                    "field values"
                )
            elif "empty" in error_msg.lower():
                validation_issues.append(
                    f"Empty value not allowed for {field_path}: {error_msg}"
                )
                user_friendly_suggestions.append(
                    "Provide non-empty values for all required fields"
                )
            else:
                validation_issues.append(f"{field_path}: {error_msg}")
        else:
            validation_issues.append(f"{field_path}: {error_msg}")

    @staticmethod
    def _handle_chart_type_specific_errors(
        chart_type: str,
        missing_field_errors: List[Tuple[str, str, Any, Dict[str, Any]]],
        validation_issues: List[str],
        user_friendly_suggestions: List[str],
    ) -> None:
        """Handle errors when we know the intended chart type."""
        if chart_type == "xy":
            xy_errors = []
            for field_path, _error_msg, _, _ in missing_field_errors:
                if "y" in field_path.lower():
                    xy_errors.append("y")
                    validation_issues.append(
                        "Missing required field 'y' for XY chart configuration. XY "
                        "charts need at least one Y-axis metric."
                    )
                    user_friendly_suggestions.append(
                        "Add Y-axis columns with aggregate functions like SUM, COUNT, "
                        "AVG"
                    )
                elif "x" in field_path.lower():
                    xy_errors.append("x")
                    validation_issues.append(
                        "Missing required field 'x' for XY chart configuration. XY "
                        "charts need an X-axis column."
                    )
                    user_friendly_suggestions.append(
                        "Specify the X-axis column in the 'x' field"
                    )
                else:
                    validation_issues.append(
                        f"Missing required field for XY chart: {field_path}"
                    )

            # Add comprehensive guidance if multiple fields missing
            if len(xy_errors) > 1:
                user_friendly_suggestions.append(
                    'Complete XY chart example: {"chart_type": "xy", "x": {"name": '
                    '"date"}, "y": [{"name": "sales", "aggregate": "SUM"}]}'
                )

        elif chart_type == "table":
            for field_path, _error_msg, _, _ in missing_field_errors:
                if "columns" in field_path.lower():
                    validation_issues.append(
                        "Missing required field 'columns' for table chart "
                        "configuration. Table charts need at least one column."
                    )
                    user_friendly_suggestions.extend(
                        [
                            "Add column specifications to the 'columns' array",
                            'Example: {"chart_type": "table", "columns": [{"name": '
                            '"product"}, {"name": "sales", "aggregate": "SUM"}]}',
                        ]
                    )
                else:
                    validation_issues.append(
                        f"Missing required field for table chart: {field_path}"
                    )

    @staticmethod
    def _handle_discriminated_union_errors(
        discriminated_union_errors: List[Tuple[str, str, Any, Dict[str, Any]]],
        missing_field_errors: List[Tuple[str, str, Any, Dict[str, Any]]],
        intended_chart_type: Optional[str],
        validation_issues: List[str],
        user_friendly_suggestions: List[str],
    ) -> None:
        """Handle discriminated union errors with intelligent interpretation."""
        # Check for invalid chart_type first
        for (
            _field_path,
            _error_msg,
            input_value,
            full_error,
        ) in discriminated_union_errors:
            if "literal_error" in full_error.get("type", "") and "chart_type" in str(
                full_error.get("loc", [])
            ):
                validation_issues.append(
                    f"Invalid chart_type '{input_value}'. Valid types are: 'xy', "
                    f"'table'"
                )
                user_friendly_suggestions.extend(
                    [
                        "Set chart_type to 'xy' for line, bar, area, or scatter charts",
                        "Set chart_type to 'table' for data tables",
                        "Check spelling and ensure chart_type field is correctly "
                        "specified",
                    ]
                )
                return  # Early return for chart type errors

        # Handle missing fields based on intended chart type
        if intended_chart_type and missing_field_errors:
            ChartErrorHandler._handle_chart_type_specific_errors(
                intended_chart_type,
                missing_field_errors,
                validation_issues,
                user_friendly_suggestions,
            )
        elif missing_field_errors:
            # Try to infer chart type from missing fields
            ChartErrorHandler._handle_ambiguous_chart_errors(
                [], missing_field_errors, validation_issues, user_friendly_suggestions
            )
        else:
            # Generic union validation error
            validation_issues.append(
                "Chart configuration validation failed. The provided configuration "
                "doesn't match expected format."
            )
            user_friendly_suggestions.extend(
                [
                    "Ensure chart_type is set to 'xy' or 'table'",
                    "For XY charts: provide 'x' and 'y' fields",
                    "For table charts: provide 'columns' array",
                    "Check that all field names and values are correct",
                ]
            )

    @staticmethod
    def _handle_ambiguous_chart_errors(
        union_errors: List[Tuple[str, str, Any, Dict[str, Any]]],
        missing_field_errors: List[Tuple[str, str, Any, Dict[str, Any]]],
        validation_issues: List[str],
        user_friendly_suggestions: List[str],
    ) -> None:
        """Handle errors when chart type cannot be determined."""
        # Check what fields are missing to infer intent
        missing_xy_fields = any(
            "x" in field or "y" in field for field, _, _, _ in missing_field_errors
        )
        missing_table_fields = any(
            "columns" in field for field, _, _, _ in missing_field_errors
        )

        if missing_xy_fields and not missing_table_fields:
            # Probably intended XY chart
            validation_issues.append(
                "XY chart configuration is incomplete. Missing required fields for "
                "line/bar/area charts."
            )
            user_friendly_suggestions.extend(
                [
                    "For XY charts: provide both 'x' (dimension) and 'y' (metrics) "
                    "fields",
                    "Set chart_type to 'xy' and specify x-axis column and at least "
                    "one y-axis metric",
                    'Example: {"chart_type": "xy", "x": {"name": "date"}, '
                    '"y": [{"name": "sales", "aggregate": "SUM"}]}',
                ]
            )
        elif missing_table_fields and not missing_xy_fields:
            # Probably intended table chart
            validation_issues.append(
                "Table chart configuration is incomplete. Missing required fields for "
                "data tables."
            )
            user_friendly_suggestions.extend(
                [
                    "For table charts: provide 'columns' array with at least one "
                    "column",
                    "Set chart_type to 'table' and specify columns to display",
                    'Example: {"chart_type": "table", "columns": [{"name": '
                    '"product"}, {"name": "sales", "aggregate": "SUM"}]}',
                ]
            )
        else:
            # Ambiguous - give general guidance
            validation_issues.append(
                "Chart configuration type cannot be determined. Please specify "
                "chart_type and required fields."
            )
            user_friendly_suggestions.extend(
                [
                    "Set chart_type to either 'xy' or 'table'",
                    "For XY charts: provide 'x' and 'y' fields",
                    "For table charts: provide 'columns' array",
                    "Check that all required fields for your chosen chart type are "
                    "present",
                ]
            )

    @staticmethod
    def _handle_generic_union_validation_error(
        error: PydanticValidationError,
        intended_chart_type: Optional[str],
        validation_issues: List[str],
        user_friendly_suggestions: List[str],
    ) -> None:
        """Handle generic union validation errors with specific guidance."""
        # Try to get the input data to provide better context

        if input_data := ChartErrorHandler._extract_input_data(error):
            ChartErrorHandler._validate_chart_type_fields(
                input_data, validation_issues, user_friendly_suggestions
            )
            ChartErrorHandler._validate_filter_operators(
                input_data, validation_issues, user_friendly_suggestions
            )
        else:
            ChartErrorHandler._provide_general_guidance(
                validation_issues, user_friendly_suggestions
            )

    @staticmethod
    def _extract_input_data(error: PydanticValidationError) -> Optional[Dict[str, Any]]:
        """Extract input data from validation error."""
        for err in error.errors():
            if "input" in err and isinstance(err["input"], dict):
                return err["input"]
        return None

    @staticmethod
    def _validate_chart_type_fields(
        input_data: Dict[str, Any],
        validation_issues: List[str],
        user_friendly_suggestions: List[str],
    ) -> None:
        """Validate chart type and required fields."""
        has_x = "x" in input_data
        has_y = "y" in input_data
        has_columns = "columns" in input_data
        has_chart_type = "chart_type" in input_data

        if not has_chart_type:
            validation_issues.append(
                "Missing required field 'chart_type'. Specify either 'xy' or "
                "'table' to indicate the chart type."
            )
            user_friendly_suggestions.append(
                'Add "chart_type": "xy" or "chart_type": "table" to your configuration'
            )
        elif has_chart_type:
            chart_type = input_data.get("chart_type")
            if chart_type == "xy":
                ChartErrorHandler._validate_xy_fields(
                    input_data,
                    has_x,
                    has_y,
                    validation_issues,
                    user_friendly_suggestions,
                )
            elif chart_type == "table":
                ChartErrorHandler._validate_table_fields(
                    input_data,
                    has_columns,
                    validation_issues,
                    user_friendly_suggestions,
                )

    @staticmethod
    def _validate_xy_fields(
        input_data: Dict[str, Any],
        has_x: bool,
        has_y: bool,
        validation_issues: List[str],
        user_friendly_suggestions: List[str],
    ) -> None:
        """Validate XY chart specific fields."""
        if not has_x:
            validation_issues.append(
                "Missing required field 'x' for XY chart configuration"
            )
            user_friendly_suggestions.append(
                'Add X-axis configuration: "x": {"name": "your_column"}'
            )
        elif has_x and input_data["x"] is None:
            validation_issues.append("Field 'x' cannot be null for XY charts")
            user_friendly_suggestions.append(
                "Provide a valid column reference for X-axis instead of null"
            )

        if not has_y:
            validation_issues.append(
                "Missing required field 'y' for XY chart configuration"
            )
            user_friendly_suggestions.append(
                'Add Y-axis metrics: "y": [{"name": "metric_column", '
                '"aggregate": "SUM"}]'
            )
        elif has_y and input_data["y"] is None:
            validation_issues.append("Field 'y' cannot be null for XY charts")
            user_friendly_suggestions.append(
                "Provide an array of metrics for Y-axis instead of null"
            )
        elif has_y and isinstance(input_data["y"], list) and len(input_data["y"]) == 0:
            validation_issues.append("Y-axis array is empty")
            user_friendly_suggestions.append(
                "Add at least one metric to the Y-axis array"
            )

    @staticmethod
    def _validate_table_fields(
        input_data: Dict[str, Any],
        has_columns: bool,
        validation_issues: List[str],
        user_friendly_suggestions: List[str],
    ) -> None:
        """Validate table chart specific fields."""
        if not has_columns:
            validation_issues.append(
                "Missing required field 'columns' for table chart configuration"
            )
            user_friendly_suggestions.append(
                'Add columns array: "columns": [{"name": "column1"}, '
                '{"name": "column2"}]'
            )
        elif input_data["columns"] is None:
            validation_issues.append("Field 'columns' cannot be null for table charts")
            user_friendly_suggestions.append(
                "Provide an array of columns instead of null"
            )
        elif (
            isinstance(input_data["columns"], list) and len(input_data["columns"]) == 0
        ):
            validation_issues.append("Columns array is empty")
            user_friendly_suggestions.append(
                "Add at least one column to display in the table"
            )

    @staticmethod
    def _validate_filter_operators(
        input_data: Dict[str, Any],
        validation_issues: List[str],
        user_friendly_suggestions: List[str],
    ) -> None:
        """Validate filter operators in input data."""
        if "filters" in input_data and isinstance(input_data["filters"], list):
            for i, filter_item in enumerate(input_data["filters"]):
                if isinstance(filter_item, dict) and "op" in filter_item:
                    op = filter_item["op"]
                    if op not in ["=", ">", "<", ">=", "<=", "!="]:
                        validation_issues.append(
                            f"Invalid filter operator '{op}' at position {i}"
                        )
                        user_friendly_suggestions.append(
                            "Use valid operators: =, >, <, >=, <=, !="
                        )

    @staticmethod
    def _provide_general_guidance(
        validation_issues: List[str],
        user_friendly_suggestions: List[str],
    ) -> None:
        """Provide general guidance when no input data is available."""
        validation_issues.append(
            "Chart configuration validation failed. Unable to determine specific "
            "issues."
        )
        user_friendly_suggestions.extend(
            [
                "Ensure chart_type is set to 'xy' or 'table'",
                "For XY charts: provide 'x' and 'y' fields with valid column "
                "references",
                "For table charts: provide 'columns' array with at least one column",
                "Check that no required fields are null or empty",
            ]
        )
