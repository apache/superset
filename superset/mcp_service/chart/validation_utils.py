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
Chart generation validation utilities with enhanced error context
"""

import difflib
import logging
from typing import Any, Dict, List, Optional, Tuple, Union

from superset.mcp_service.schemas.chart_schemas import (
    ColumnRef,
    FilterConfig,
    TableChartConfig,
    XYChartConfig,
)
from superset.mcp_service.schemas.error_schemas import (
    ChartGenerationError,
    ColumnSuggestion,
    DatasetContext,
    ValidationError,
)

logger = logging.getLogger(__name__)


def validate_chart_config(
    config: Union[TableChartConfig, XYChartConfig], dataset_id: Union[int, str]
) -> Tuple[bool, Optional[ChartGenerationError]]:
    """
    Validate chart configuration against dataset schema with enhanced error reporting.

    Args:
        config: Chart configuration to validate
        dataset_id: Dataset ID to validate against

    Returns:
        Tuple of (is_valid, error_details)
    """
    try:
        # Get dataset context
        dataset_context = get_dataset_context(dataset_id)
        if not dataset_context:
            return False, ChartGenerationError(
                error_type="dataset_not_found",
                message=f"Dataset not found: {dataset_id}",
                details=(
                    f"No dataset found with identifier '{dataset_id}'. "
                    f"Please verify the dataset ID or UUID is correct."
                ),
                suggestions=[
                    "Check that the dataset ID is correct",
                    "Verify you have access to this dataset",
                    "Use the list_datasets tool to find available datasets",
                ],
                error_code="DATASET_NOT_FOUND",
            )

        # Validate columns
        validation_errors = []

        if isinstance(config, TableChartConfig):
            validation_errors.extend(
                validate_table_columns(config.columns, dataset_context)
            )
            if config.filters:
                validation_errors.extend(
                    validate_filter_columns(config.filters, dataset_context)
                )
        elif isinstance(config, XYChartConfig):
            # Validate X-axis column
            validation_errors.extend(
                validate_single_column(config.x, dataset_context, "x_axis")
            )
            # Validate Y-axis columns
            for i, y_col in enumerate(config.y):
                validation_errors.extend(
                    validate_single_column(y_col, dataset_context, f"y_axis[{i}]")
                )
            # Validate group by column if specified
            if config.group_by:
                validation_errors.extend(
                    validate_single_column(config.group_by, dataset_context, "group_by")
                )
            # Validate filter columns if specified
            if config.filters:
                validation_errors.extend(
                    validate_filter_columns(config.filters, dataset_context)
                )

        # If there are validation errors, return detailed error
        if validation_errors:
            return False, ChartGenerationError(
                error_type="validation_error",
                message="Chart configuration validation failed",
                details=(
                    "One or more fields in the chart configuration are invalid. "
                    "See validation_errors for specific issues."
                ),
                validation_errors=validation_errors,
                dataset_context=dataset_context,
                suggestions=generate_overall_suggestions(
                    validation_errors, dataset_context
                ),
                error_code="VALIDATION_FAILED",
            )

        return True, None

    except Exception as e:
        logger.exception(f"Validation error for dataset {dataset_id}")
        return False, ChartGenerationError(
            error_type="validation_system_error",
            message="Chart validation system error",
            details=f"An internal error occurred during validation: {str(e)}",
            suggestions=[
                "Try again with a simpler configuration",
                "Check that all required fields are provided",
                "Contact support if the issue persists",
            ],
            error_code="VALIDATION_SYSTEM_ERROR",
        )


def get_dataset_context(dataset_id: Union[int, str]) -> Optional[DatasetContext]:
    """Get dataset context information for validation."""
    try:
        from superset.daos.dataset import DatasetDAO

        # Find dataset
        dataset = None
        if isinstance(dataset_id, int) or (
            isinstance(dataset_id, str) and dataset_id.isdigit()
        ):
            numeric_id = int(dataset_id) if isinstance(dataset_id, str) else dataset_id
            dataset = DatasetDAO.find_by_id(numeric_id)
        else:
            # Try UUID lookup
            dataset = DatasetDAO.find_by_id(dataset_id, id_column="uuid")

        if not dataset:
            return None

        # Get columns with metadata
        available_columns = []
        if hasattr(dataset, "columns") and dataset.columns:
            for col in dataset.columns:
                available_columns.append(
                    {
                        "name": col.column_name,
                        "type": col.type or "unknown",
                        "description": col.description,
                        "is_dttm": getattr(col, "is_dttm", False),
                        "python_date_format": getattr(col, "python_date_format", None),
                        "verbose_name": getattr(col, "verbose_name", None),
                    }
                )

        # Get metrics
        available_metrics = []
        if hasattr(dataset, "metrics") and dataset.metrics:
            for metric in dataset.metrics:
                available_metrics.append(
                    {
                        "name": metric.metric_name,
                        "expression": metric.expression,
                        "description": metric.description,
                        "verbose_name": getattr(metric, "verbose_name", None),
                        "metric_type": getattr(metric, "metric_type", None),
                    }
                )

        return DatasetContext(
            id=dataset.id,
            table_name=dataset.table_name,
            schema=getattr(dataset, "schema", None),
            database_name=dataset.database.database_name
            if dataset.database
            else "unknown",
            available_columns=available_columns,
            available_metrics=available_metrics,
        )

    except Exception:
        logger.exception(f"Error getting dataset context for {dataset_id}")
        return None


def validate_table_columns(
    columns: List[ColumnRef], dataset_context: DatasetContext
) -> List[ValidationError]:
    """Validate table chart columns."""
    errors = []
    for i, col in enumerate(columns):
        errors.extend(validate_single_column(col, dataset_context, f"columns[{i}]"))
    return errors


def validate_single_column(
    column: ColumnRef, dataset_context: DatasetContext, field_name: str
) -> List[ValidationError]:
    """Validate a single column reference."""
    errors = []

    # Check if column exists
    available_column_names = [col["name"] for col in dataset_context.available_columns]
    available_metric_names = [
        metric["name"] for metric in dataset_context.available_metrics
    ]
    all_available = available_column_names + available_metric_names

    if column.name not in all_available:
        # Generate suggestions using fuzzy matching
        suggestions = get_column_suggestions(column.name, dataset_context)

        errors.append(
            ValidationError(
                field=field_name,
                provided_value=column.name,
                error_type="column_not_found",
                message=(
                    f"Column '{column.name}' not found in dataset "
                    f"'{dataset_context.table_name}'"
                ),
                suggestions=suggestions,
            )
        )
    else:
        # Validate column type compatibility with aggregate function
        if column.aggregate:
            column_info = next(
                (
                    col
                    for col in dataset_context.available_columns
                    if col["name"] == column.name
                ),
                None,
            )
            if column_info:
                errors.extend(
                    validate_aggregate_compatibility(column, column_info, field_name)
                )

    return errors


def validate_filter_columns(
    filters: List[FilterConfig], dataset_context: DatasetContext
) -> List[ValidationError]:
    """Validate filter column references."""
    errors = []
    available_column_names = [col["name"] for col in dataset_context.available_columns]

    for i, filter_config in enumerate(filters):
        if filter_config.column not in available_column_names:
            suggestions = get_column_suggestions(filter_config.column, dataset_context)
            errors.append(
                ValidationError(
                    field=f"filters[{i}].column",
                    provided_value=filter_config.column,
                    error_type="filter_column_not_found",
                    message=(
                        f"Filter column '{filter_config.column}' not found in dataset"
                    ),
                    suggestions=suggestions,
                )
            )

    return errors


def validate_aggregate_compatibility(
    column: ColumnRef, column_info: Dict[str, Any], field_name: str
) -> List[ValidationError]:
    """Validate that aggregate function is compatible with column type."""
    errors = []

    # Define aggregates that work with different types
    numeric_aggregates = {"SUM", "AVG", "MIN", "MAX", "STDDEV", "VAR"}
    # text_aggregates = {"COUNT", "COUNT_DISTINCT"}  # Not used
    # datetime_aggregates = {"MIN", "MAX", "COUNT", "COUNT_DISTINCT"}  # Not used

    column_type = column_info.get("type", "").lower()
    aggregate = column.aggregate.upper() if column.aggregate else "COUNT"

    # Check compatibility - expanded numeric type detection
    numeric_indicators = [
        "int",
        "float",
        "decimal",
        "number",
        "numeric",
        "double",
        "precision",
        "bigint",
        "smallint",
        "real",
        "money",
        "serial",
        "auto_increment",
    ]
    datetime_indicators = ["date", "time", "timestamp", "datetime", "interval"]

    is_numeric = any(indicator in column_type for indicator in numeric_indicators)
    is_datetime = any(indicator in column_type for indicator in datetime_indicators)
    is_text = not is_numeric and not is_datetime

    incompatible = False
    suggestions = []

    if is_text and aggregate in numeric_aggregates:
        incompatible = True
        suggestions = [
            "Use COUNT or COUNT_DISTINCT for text columns",
            "SUM/AVG only work with numeric data types",
        ]
    elif is_datetime and aggregate in numeric_aggregates - {"MIN", "MAX"}:
        incompatible = True
        suggestions = [
            "Use MIN, MAX, COUNT, or COUNT_DISTINCT for datetime columns",
            "SUM/AVG are not meaningful for dates and times",
        ]
    elif is_numeric and aggregate in numeric_aggregates:
        # This is valid - numeric column with numeric aggregate
        incompatible = False

    if incompatible:
        errors.append(
            ValidationError(
                field=field_name,
                provided_value=aggregate,
                error_type="aggregate_type_mismatch",
                message=(
                    f"Aggregate '{aggregate}' is not compatible with column type "
                    f"'{column_type}'"
                ),
                suggestions=[
                    ColumnSuggestion(
                        name=suggestion,
                        type="aggregate_function",
                        similarity_score=1.0,
                        description=f"Compatible aggregate for {column_type} columns",
                    )
                    for suggestion in suggestions
                ],
            )
        )

    return errors


def get_column_suggestions(
    invalid_column: str, dataset_context: DatasetContext, max_suggestions: int = 5
) -> List[ColumnSuggestion]:
    """Generate column suggestions using fuzzy matching."""
    suggestions = []

    # Combine columns and metrics for suggestions
    all_items = []

    # Add columns
    for col in dataset_context.available_columns:
        all_items.append(
            {
                "name": col["name"],
                "type": col["type"],
                "description": col.get("description")
                or f"Column of type {col['type']}",
                "category": "column",
            }
        )

    # Add metrics
    for metric in dataset_context.available_metrics:
        all_items.append(
            {
                "name": metric["name"],
                "type": "metric",
                "description": metric.get("description")
                or f"Calculated metric: {metric.get('expression', 'N/A')}",
                "category": "metric",
            }
        )

    # Use difflib to find close matches
    names = [item["name"] for item in all_items]
    close_matches = difflib.get_close_matches(
        invalid_column, names, n=max_suggestions, cutoff=0.3
    )

    # Create suggestions with metadata
    for match in close_matches:
        item = next(item for item in all_items if item["name"] == match)
        similarity = difflib.SequenceMatcher(
            None, invalid_column.lower(), match.lower()
        ).ratio()

        suggestions.append(
            ColumnSuggestion(
                name=match,
                type=item["type"],
                similarity_score=similarity,
                description=item["description"],
            )
        )

    # Sort by similarity score
    suggestions.sort(key=lambda x: x.similarity_score, reverse=True)

    return suggestions


def generate_overall_suggestions(
    validation_errors: List[ValidationError], dataset_context: DatasetContext
) -> List[str]:
    """Generate overall suggestions based on validation errors."""
    suggestions = []

    # Count error types
    error_types = [error.error_type for error in validation_errors]

    if "column_not_found" in error_types or "filter_column_not_found" in error_types:
        columns_list = [col["name"] for col in dataset_context.available_columns[:10]]
        suggestions.append(
            f"Available columns in '{dataset_context.table_name}': "
            f"{', '.join(columns_list)}"
        )
        if len(dataset_context.available_columns) > 10:
            suggestions.append("Use get_dataset_info tool to see all available columns")

    if "aggregate_type_mismatch" in error_types:
        suggestions.append(
            "Check that aggregate functions match column data types "
            "(SUM/AVG for numbers, COUNT for text)"
        )

    if dataset_context.available_metrics:
        metrics_list = [
            metric["name"] for metric in dataset_context.available_metrics[:5]
        ]
        suggestions.append(f"Available metrics: {', '.join(metrics_list)}")

    suggestions.append(
        "Use get_dataset_available_filters tool to see valid filter operators "
        "for each column"
    )

    return suggestions
