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
Custom validators for better chart configuration error messages.
"""

from typing import Any, Dict, List, Union

from pydantic import ValidationError as PydanticValidationError
from pydantic_core import ValidationError as CoreValidationError


class ChartConfigValidator:
    """Custom validator for chart configurations with improved error messages."""

    @staticmethod
    def validate_chart_config(v: Any, info: Any) -> Any:
        """
        Custom validation for ChartConfig that provides better error messages.

        This validator intercepts the default union validation errors and replaces
        them with user-friendly messages based on the actual validation issues.
        """
        if not isinstance(v, dict):
            raise ValueError("Chart configuration must be a dictionary/object")

        # Extract chart type if present
        chart_type = v.get("chart_type")

        # If no chart type, provide clear guidance
        if not chart_type:
            raise ValueError(
                "Missing required field 'chart_type'. Specify either 'xy' or 'table' "
                "to indicate the type of visualization you want to create."
            )

        # Validate chart type value
        if chart_type not in ["xy", "table"]:
            raise ValueError(
                f"Invalid chart_type '{chart_type}'. Valid types are: 'xy' (for line, "
                f"bar, area, scatter charts) or 'table' (for data tables)"
            )

        # Type-specific validation with clear messages
        if chart_type == "xy":
            return ChartConfigValidator._validate_xy_config(v)
        elif chart_type == "table":
            return ChartConfigValidator._validate_table_config(v)

        # This shouldn't happen but provide fallback
        raise ValueError(f"Unknown chart_type '{chart_type}'")

    @staticmethod
    def _validate_xy_config(config: Dict[str, Any]) -> Dict[str, Any]:
        """Validate XY chart configuration with specific error messages."""
        errors = []

        # Validate X field
        errors.extend(ChartConfigValidator._validate_x_field(config))

        # Validate Y field
        errors.extend(ChartConfigValidator._validate_y_field(config))

        # Validate filters
        errors.extend(ChartConfigValidator._validate_filters(config))

        if errors:
            raise ValueError("; ".join(errors))

        return config

    @staticmethod
    def _validate_x_field(config: Dict[str, Any]) -> List[str]:
        """Validate X field for XY charts."""
        errors = []
        if "x" not in config:
            errors.append(
                "Missing required field 'x' for XY chart. The 'x' field specifies "
                'the X-axis column (e.g., {"name": "date"})'
            )
        elif config["x"] is None:
            errors.append(
                "Field 'x' cannot be null. Provide a valid column reference for the "
                "X-axis"
            )
        elif isinstance(config["x"], dict) and not config["x"].get("name"):
            errors.append(
                "X-axis configuration missing 'name' field. Specify the column name "
                "for X-axis"
            )
        return errors

    @staticmethod
    def _validate_y_field(config: Dict[str, Any]) -> List[str]:
        """Validate Y field for XY charts."""
        errors = []
        if "y" not in config:
            errors.append(
                "Missing required field 'y' for XY chart. The 'y' field should be an "
                "array "
                'of Y-axis metrics (e.g., [{"name": "sales", "aggregate": "SUM"}])'
            )
        elif config["y"] is None:
            errors.append(
                "Field 'y' cannot be null. Provide at least one metric for the Y-axis"
            )
        elif isinstance(config["y"], list) and len(config["y"]) == 0:
            errors.append(
                "Y-axis array is empty. Add at least one metric "
                '(e.g., [{"name": "revenue", "aggregate": "SUM"}])'
            )
        return errors

    @staticmethod
    def _validate_filters(config: Dict[str, Any]) -> List[str]:
        """Validate filters field for any chart type."""
        errors = []
        if "filters" in config and isinstance(config["filters"], list):
            for i, filter_item in enumerate(config["filters"]):
                if isinstance(filter_item, dict):
                    if "op" in filter_item and filter_item["op"] not in [
                        "=",
                        ">",
                        "<",
                        ">=",
                        "<=",
                        "!=",
                    ]:
                        errors.append(
                            f"Invalid filter operator '{filter_item['op']}' at "
                            f"position {i}. "
                            f"Valid operators are: =, >, <, >=, <=, !="
                        )
        return errors

    @staticmethod
    def _validate_table_config(config: Dict[str, Any]) -> Dict[str, Any]:
        """Validate table chart configuration with specific error messages."""
        errors = []

        # Check for required fields
        if "columns" not in config:
            errors.append(
                "Missing required field 'columns' for table chart. The 'columns' field "
                'should be an array of columns to display (e.g., [{"name": "product"}, '
                '{"name": "sales", "aggregate": "SUM"}])'
            )
        elif config["columns"] is None:
            errors.append(
                "Field 'columns' cannot be null. Provide at least one column to display"
            )
        elif isinstance(config["columns"], list) and len(config["columns"]) == 0:
            errors.append(
                "Columns array is empty. Add at least one column to display in the "
                "table "
                '(e.g., [{"name": "customer_name"}])'
            )

        # Check filters if present
        if "filters" in config and isinstance(config["filters"], list):
            for i, filter_item in enumerate(config["filters"]):
                if isinstance(filter_item, dict):
                    if "op" in filter_item and filter_item["op"] not in [
                        "=",
                        ">",
                        "<",
                        ">=",
                        "<=",
                        "!=",
                    ]:
                        errors.append(
                            f"Invalid filter operator '{filter_item['op']}' at "
                            f"position {i}. "
                            f"Valid operators are: =, >, <, >=, <=, !="
                        )

        if errors:
            raise ValueError("; ".join(errors))

        return config

    @staticmethod
    def extract_user_friendly_errors(
        validation_error: Union[PydanticValidationError, CoreValidationError],
    ) -> List[str]:
        """
        Extract user-friendly error messages from Pydantic validation errors.

        This method analyzes the error structure and provides context-aware messages
        instead of the generic union validation errors.
        """
        user_errors = []

        # Analyze all errors to understand the validation context
        has_union_error, field_errors = ChartConfigValidator._analyze_errors(
            validation_error
        )

        # Handle union errors
        if has_union_error:
            user_errors.extend(
                ChartConfigValidator._handle_union_errors(validation_error)
            )

        # Add field-specific errors
        user_errors.extend(ChartConfigValidator._handle_field_errors(field_errors))

        return user_errors if user_errors else ["Chart configuration validation failed"]

    @staticmethod
    def _analyze_errors(
        validation_error: Union[PydanticValidationError, CoreValidationError],
    ) -> tuple[bool, Dict[str, Any]]:
        """Analyze validation errors to categorize them."""
        has_union_error = False
        field_errors = {}

        for error in validation_error.errors():
            error_type = error.get("type", "")
            field_path = ".".join(str(loc) for loc in error.get("loc", []))

            if "union" in error_type or "discriminated" in error_type:
                has_union_error = True
            else:
                field_errors[field_path] = error

        return has_union_error, field_errors

    @staticmethod
    def _handle_union_errors(
        validation_error: Union[PydanticValidationError, CoreValidationError],
    ) -> List[str]:
        """Handle union validation errors."""
        user_errors = []

        # Check if chart_type is missing or invalid
        if any(
            "chart_type" in str(e.get("loc", [])) for e in validation_error.errors()
        ):
            user_errors.append(
                "Invalid or missing chart_type. Set chart_type to 'xy' for "
                "line/bar/area/scatter charts or 'table' for data tables"
            )
        else:
            # Try to infer the intended chart type from the data
            user_errors.append(
                "Chart configuration doesn't match the expected format. Ensure "
                "you have:\n"
                "- For XY charts: chart_type='xy', x field, and y array\n"
                "- For table charts: chart_type='table' and columns array"
            )

        return user_errors

    @staticmethod
    def _handle_field_errors(field_errors: Dict[str, Any]) -> List[str]:
        """Handle field-specific validation errors."""
        user_errors = []

        for field_path, error in field_errors.items():
            error_msg = error.get("msg", "")
            error_type = error.get("type", "")

            if "missing" in error_type:
                user_errors.extend(
                    ChartConfigValidator._handle_missing_field(field_path)
                )
            elif "null" in error_type or "none_not_allowed" in error_type:
                user_errors.append(f"Field '{field_path}' cannot be null or empty")
            else:
                user_errors.append(f"{field_path}: {error_msg}")

        return user_errors

    @staticmethod
    def _handle_missing_field(field_path: str) -> List[str]:
        """Handle missing field errors."""
        if "x" in field_path:
            return ["Missing X-axis configuration. Add 'x' field with column reference"]
        elif "y" in field_path:
            return ["Missing Y-axis configuration. Add 'y' array with metric columns"]
        elif "columns" in field_path:
            return [
                "Missing columns configuration. Add 'columns' array for table display"
            ]
        else:
            return [f"Missing required field: {field_path}"]
