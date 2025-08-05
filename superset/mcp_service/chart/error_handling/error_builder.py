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
Unified error builder for chart operations.
Consolidates error handling logic from multiple files.
"""

import logging
from typing import Any, Dict, List, Optional

from superset.mcp_service.common.error_schemas import (
    ChartGenerationError,
    ValidationError,
)

logger = logging.getLogger(__name__)


class ChartErrorBuilder:
    """Unified error builder for consistent error messages across chart operations."""

    # Error templates organized by category
    TEMPLATES = {
        # Validation errors
        "missing_field": {
            "message": "Missing required field: {field}",
            "details": "{field_description}",
            "suggestions": [
                "Add the '{field}' field to your configuration",
                "Check the API documentation for required fields",
                "{specific_suggestion}",
            ],
        },
        "invalid_type": {
            "message": "Invalid type for field '{field}'",
            "details": "Expected {expected_type}, got {actual_type}",
            "suggestions": [
                "Change '{field}' to be a {expected_type}",
                "Example: {example}",
            ],
        },
        "invalid_value": {
            "message": "Invalid value for '{field}'",
            "details": "Value '{value}' is not allowed. {reason}",
            "suggestions": [
                "Use one of the allowed values: {allowed_values}",
                "{specific_suggestion}",
            ],
        },
        # Dataset errors
        "dataset_not_found": {
            "message": "Dataset not found: {dataset_id}",
            "details": "No dataset found with identifier '{dataset_id}'. Please "
            "verify the dataset ID or UUID is correct.",
            "suggestions": [
                "Check that the dataset ID is correct",
                "Verify you have access to this dataset",
                "Use the list_datasets tool to find available datasets",
            ],
        },
        "column_not_found": {
            "message": "Column '{column}' not found in dataset",
            "details": "The column '{column}' does not exist in the dataset schema",
            "suggestions": [
                "Check column name spelling and case sensitivity",
                "Use get_dataset_info to see available columns",
                "Did you mean: {suggestions}?",
            ],
        },
        # Runtime errors
        "empty_result": {
            "message": "Query would return no data",
            "details": "{reason}",
            "suggestions": [
                "Check your filter conditions",
                "Verify the data exists for your criteria",
                "Try broader filter values or remove some filters",
            ],
        },
        "performance_warning": {
            "message": "Configuration may cause performance issues",
            "details": "{reason}",
            "suggestions": [
                "Consider adding filters to limit data",
                "Use aggregations to reduce data volume",
                "{specific_suggestion}",
            ],
        },
        # Chart-specific errors
        "invalid_chart_type": {
            "message": "Invalid chart type: '{chart_type}'",
            "details": "Chart type must be either 'xy' or 'table'",
            "suggestions": [
                "Use 'chart_type': 'xy' for line, bar, area, or scatter charts",
                "Use 'chart_type': 'table' for tabular data display",
            ],
        },
        "incompatible_configuration": {
            "message": "Chart configuration incompatible with data",
            "details": "{reason}",
            "suggestions": [
                "{primary_suggestion}",
                "Consider using a different chart type",
                "Modify your data selection or aggregation",
            ],
        },
    }

    @classmethod
    def build_error(
        cls,
        error_type: str,
        template_key: str,
        template_vars: Optional[Dict[str, Any]] = None,
        custom_suggestions: Optional[List[str]] = None,
        error_code: Optional[str] = None,
        validation_errors: Optional[List[ValidationError]] = None,
    ) -> ChartGenerationError:
        """
        Build a standardized error using templates.

        Args:
            error_type: Type of error for categorization
            template_key: Key to error template
            template_vars: Variables to format into template
            custom_suggestions: Additional suggestions to append
            error_code: Optional error code
            validation_errors: Optional list of validation errors

        Returns:
            ChartGenerationError with formatted message
        """
        template = cls.TEMPLATES.get(template_key, {})
        vars_dict = template_vars or {}

        # Format message
        message_raw = template.get("message", "An error occurred")
        message: str = (
            " ".join(message_raw) if isinstance(message_raw, list) else str(message_raw)
        )
        if template_vars:
            try:
                message = message.format(**vars_dict)
            except KeyError as e:
                logger.warning(f"Missing template variable: {e}")

        # Format details
        details_raw = template.get("details", "")
        details: str = (
            " ".join(details_raw) if isinstance(details_raw, list) else str(details_raw)
        )
        if template_vars and details:
            try:
                details = details.format(**vars_dict)
            except KeyError as e:
                logger.warning(f"Missing template variable: {e}")

        message = cls._format_message(template, vars_dict)
        details = cls._format_details(template, vars_dict)
        suggestions = cls._format_suggestions(template, vars_dict, custom_suggestions)
        error_code = cls._generate_error_code(error_code, template_key)

        return ChartGenerationError(
            error_type=error_type,
            message=message,
            details=details,
            suggestions=suggestions,
            error_code=error_code,
            validation_errors=validation_errors or [],
        )

    @classmethod
    def _format_message(
        cls, template: Dict[str, Any], vars_dict: Dict[str, Any]
    ) -> str:
        """Format the error message from template."""
        message_raw = template.get("message", "An error occurred")
        message: str = (
            " ".join(message_raw) if isinstance(message_raw, list) else str(message_raw)
        )
        if vars_dict:
            try:
                message = message.format(**vars_dict)
            except KeyError as e:
                logger.warning(f"Missing template variable: {e}")
        return message

    @classmethod
    def _format_details(
        cls, template: Dict[str, Any], vars_dict: Dict[str, Any]
    ) -> str:
        """Format the error details from template."""
        details_raw = template.get("details", "")
        details: str = (
            " ".join(details_raw) if isinstance(details_raw, list) else str(details_raw)
        )
        if vars_dict and details:
            try:
                details = details.format(**vars_dict)
            except KeyError as e:
                logger.warning(f"Missing template variable: {e}")
        return details

    @classmethod
    def _format_suggestions(
        cls,
        template: Dict[str, Any],
        vars_dict: Dict[str, Any],
        custom_suggestions: Optional[List[str]],
    ) -> List[str]:
        """Format suggestions from template and add custom ones."""
        suggestions = []
        for suggestion in template.get("suggestions", []):
            if vars_dict and "{" in suggestion:
                try:
                    suggestion = suggestion.format(**vars_dict)
                    if suggestion and suggestion != "None":
                        suggestions.append(suggestion)
                except KeyError:
                    continue
            else:
                suggestions.append(suggestion)

        if custom_suggestions:
            suggestions.extend(custom_suggestions)

        return suggestions

    @classmethod
    def _generate_error_code(cls, error_code: Optional[str], template_key: str) -> str:
        """Generate error code if not provided."""
        if error_code:
            return error_code
        return f"CHART_{template_key.upper()}"

    @classmethod
    def missing_field_error(
        cls,
        field: str,
        field_description: str,
        specific_suggestion: Optional[str] = None,
    ) -> ChartGenerationError:
        """Build a missing field error."""
        return cls.build_error(
            error_type="missing_field",
            template_key="missing_field",
            template_vars={
                "field": field,
                "field_description": field_description,
                "specific_suggestion": specific_suggestion
                or f"Add '{field}' to your request",
            },
        )

    @classmethod
    def invalid_type_error(
        cls,
        field: str,
        expected_type: str,
        actual_type: str,
        example: Optional[str] = None,
    ) -> ChartGenerationError:
        """Build an invalid type error."""
        return cls.build_error(
            error_type="invalid_type",
            template_key="invalid_type",
            template_vars={
                "field": field,
                "expected_type": expected_type,
                "actual_type": actual_type,
                "example": example or f"'{field}': <{expected_type}>",
            },
        )

    @classmethod
    def column_not_found_error(
        cls, column: str, suggestions: Optional[List[str]] = None
    ) -> ChartGenerationError:
        """Build a column not found error."""
        suggestion_text = (
            ", ".join(suggestions[:3]) if suggestions else "Check available columns"
        )
        return cls.build_error(
            error_type="column_not_found",
            template_key="column_not_found",
            template_vars={"column": column, "suggestions": suggestion_text},
        )

    @classmethod
    def dataset_not_found_error(cls, dataset_id: Any) -> ChartGenerationError:
        """Build a dataset not found error."""
        return cls.build_error(
            error_type="dataset_not_found",
            template_key="dataset_not_found",
            template_vars={"dataset_id": str(dataset_id)},
        )
