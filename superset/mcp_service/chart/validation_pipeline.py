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
Comprehensive validation pipeline for chart generation with multiple validation layers.
"""

import logging
from typing import Any, List, Optional, Tuple, Union

from superset.mcp_service.schemas.chart_schemas import (
    ChartConfig,
    GenerateChartRequest,
    TableChartConfig,
    XYChartConfig,
)
from superset.mcp_service.schemas.error_schemas import ChartGenerationError

logger = logging.getLogger(__name__)


class ChartValidationPipeline:
    """Multi-layer validation pipeline for comprehensive chart validation."""

    @staticmethod
    def validate_request(
        request: GenerateChartRequest,
    ) -> Tuple[bool, Optional[ChartGenerationError]]:
        """
        Run comprehensive validation pipeline on chart generation request.

        Args:
            request: The chart generation request to validate

        Returns:
            Tuple of (is_valid, error_details)
        """
        try:
            # Layer 1: Pydantic validation (already done by FastAPI/MCP)
            # Layer 2: Business logic validation
            is_valid, error = ChartValidationPipeline._validate_business_logic(request)
            if not is_valid:
                return False, error

            # Layer 3: Dataset-specific validation
            is_valid, error = ChartValidationPipeline._validate_against_dataset(
                request.config, request.dataset_id
            )
            if not is_valid:
                return False, error

            # Layer 4: Superset compatibility validation
            is_valid, error = ChartValidationPipeline._validate_superset_compatibility(
                request.config
            )
            if not is_valid:
                return False, error

            # Layer 5: Runtime preview validation (optional quick check)
            is_valid, error = ChartValidationPipeline._validate_runtime_preview(
                request.config, request.dataset_id
            )
            if not is_valid:
                return False, error

            return True, None

        except Exception as e:
            logger.exception("Validation pipeline error")
            return False, ChartGenerationError(
                error_type="validation_system_error",
                message="Validation pipeline failed",
                details=f"Internal validation error: {str(e)}",
                suggestions=[
                    "Try again with a simpler configuration",
                    "Contact support if the issue persists",
                ],
                error_code="VALIDATION_PIPELINE_ERROR",
            )

    @staticmethod
    def _validate_business_logic(
        request: GenerateChartRequest,
    ) -> Tuple[bool, Optional[ChartGenerationError]]:
        """Validate business logic rules."""
        errors = []

        # Validate cache parameters
        if hasattr(request, "cache_timeout") and request.cache_timeout is not None:
            if request.cache_timeout < 0:
                errors.append("cache_timeout must be non-negative")

        # Validate preview formats
        if request.preview_formats:
            invalid_formats = set(request.preview_formats) - {
                "url",
                "interactive",
                "ascii",
                "vega_lite",
                "table",
                "base64",
            }
            if invalid_formats:
                errors.append(f"Invalid preview formats: {', '.join(invalid_formats)}")

        # Validate chart configuration structure
        config_errors = ChartValidationPipeline._validate_chart_config_structure(
            request.config
        )
        errors.extend(config_errors)

        if errors:
            return False, ChartGenerationError(
                error_type="business_logic_error",
                message="Business logic validation failed",
                details=f"Validation errors: {'; '.join(errors)}",
                suggestions=[
                    "Check cache_timeout is 0 or positive",
                    "Use valid preview formats only",
                    "Ensure chart configuration is complete",
                ],
                error_code="BUSINESS_LOGIC_VALIDATION_FAILED",
            )

        return True, None

    @staticmethod
    def _validate_chart_config_structure(config: ChartConfig) -> List[str]:
        """Validate chart configuration structure with enhanced error messages."""
        errors = []

        # First, check for fundamental structure issues
        if not hasattr(config, "chart_type"):
            errors.append(
                "Chart configuration missing 'chart_type' field. Specify 'xy' or "
                "'table'."
            )
            return errors  # Cannot continue without chart_type

        if isinstance(config, TableChartConfig):
            errors.extend(ChartValidationPipeline._validate_table_structure(config))
        elif isinstance(config, XYChartConfig):
            errors.extend(ChartValidationPipeline._validate_xy_structure(config))
        else:
            # Unknown chart type - this should be caught by Pydantic but add failsafe
            errors.append(
                f"Unknown chart configuration type. Expected TableChartConfig or "
                f"XYChartConfig, "
                f"got {type(config).__name__}. Set chart_type to 'table' or 'xy'."
            )

        # Validate filters if present
        errors.extend(ChartValidationPipeline._validate_filters_structure(config))

        return errors

    @staticmethod
    def _validate_table_structure(config: TableChartConfig) -> List[str]:
        """Validate table chart configuration structure."""
        errors = []

        # Table-specific validation with clear error messages
        if not hasattr(config, "columns") or not config.columns:
            errors.append(
                "Table chart configuration missing required 'columns' field. "
                "Table charts need at least one column to display data."
            )
        else:
            # Check for empty column names with specific guidance
            errors.extend(
                ChartValidationPipeline._validate_table_columns(config.columns)
            )

        return errors

    @staticmethod
    def _validate_table_columns(columns: List[Any]) -> List[str]:
        """Validate table columns structure."""
        errors = []

        for i, col in enumerate(columns):
            if not col.name or not col.name.strip():
                errors.append(
                    f"Column {i} has empty or missing 'name' field. "
                    f"Each column must have a valid column name from your "
                    f"dataset."
                )

            # Validate aggregate functions with enhanced context
            if col.aggregate:
                errors.extend(
                    ChartValidationPipeline._validate_aggregate_function(
                        col.aggregate, f"column {i}"
                    )
                )

        return errors

    @staticmethod
    def _validate_xy_structure(config: XYChartConfig) -> List[str]:
        """Validate XY chart configuration structure."""
        errors = []
        missing_fields = []

        # Check for missing X field
        if not hasattr(config, "x") or not config.x:
            missing_fields.append("'x' (X-axis column)")
        elif not config.x.name or not config.x.name.strip():
            errors.append(
                "X-axis column has empty or missing 'name' field. "
                "Specify a valid column name from your dataset for the X-axis."
            )

        # Check for missing Y field
        if not hasattr(config, "y") or not config.y:
            missing_fields.append("'y' (Y-axis metrics)")
        else:
            errors.extend(ChartValidationPipeline._validate_y_axis_columns(config.y))

        # Report missing fields with helpful context
        if missing_fields:
            errors.append(
                f"XY chart configuration missing required fields: "
                f"{', '.join(missing_fields)}. "
                f"XY charts need both X-axis (dimension) and Y-axis (metrics) to "
                f"create visualizations."
            )

        # Check group_by if specified
        if (
            hasattr(config, "group_by")
            and config.group_by
            and (not config.group_by.name or not config.group_by.name.strip())
        ):
            errors.append(
                "Group by column has empty or missing 'name' field. "
                "Specify a valid column name from your dataset for grouping."
            )

        return errors

    @staticmethod
    def _validate_y_axis_columns(y_columns: List[Any]) -> List[str]:
        """Validate Y-axis columns structure."""
        errors = []

        # Check Y-axis columns in detail
        for i, col in enumerate(y_columns):
            if not col.name or not col.name.strip():
                errors.append(
                    f"Y-axis column {i} has empty or missing 'name' field. "
                    f"Each Y-axis column must have a valid column name from "
                    f"your dataset."
                )

            # Enhanced aggregate validation for Y-axis
            if col.aggregate:
                errors.extend(
                    ChartValidationPipeline._validate_aggregate_function(
                        col.aggregate, f"Y-axis column {i}"
                    )
                )
            else:
                logger.info(
                    f"Y-axis column '{col.name}' has no aggregate function - "
                    f"will display raw values"
                )

        return errors

    @staticmethod
    def _validate_aggregate_function(aggregate: str, field_context: str) -> List[str]:
        """Validate aggregate function."""
        errors = []

        valid_aggregates = {
            "SUM",
            "COUNT",
            "AVG",
            "MIN",
            "MAX",
            "COUNT_DISTINCT",
            "STDDEV",
            "VAR",
            "MEDIAN",
            "PERCENTILE",
        }

        if aggregate.upper() not in valid_aggregates:
            errors.append(
                f"Invalid aggregate function '{aggregate}' in "
                f"{field_context}. "
                f"Only these functions are allowed: "
                f"{', '.join(sorted(valid_aggregates))}"
            )

        return errors

    @staticmethod
    def _validate_filters_structure(config: ChartConfig) -> List[str]:
        """Validate filters structure."""
        errors = []

        # Validate filters if present
        if hasattr(config, "filters") and config.filters:
            for i, filter_config in enumerate(config.filters):
                if not filter_config.column.strip():
                    errors.append(f"Filter {i} has empty column name")
                if filter_config.value is None or (
                    isinstance(filter_config.value, str)
                    and not filter_config.value.strip()
                ):
                    errors.append(f"Filter {i} has empty or null value")

        return errors

    @staticmethod
    def _validate_against_dataset(
        config: ChartConfig,
        dataset_id: Union[int, str],
    ) -> Tuple[bool, Optional[ChartGenerationError]]:
        """Validate configuration against actual dataset schema."""
        try:
            # Import here to avoid circular imports
            from superset.mcp_service.chart.validation_utils import (
                validate_chart_config,
            )

            return validate_chart_config(config, dataset_id)

        except ImportError as e:
            logger.warning(f"Could not import validation utils: {e}")
            return True, None  # Skip dataset validation if utils not available

    @staticmethod
    def _validate_superset_compatibility(
        config: ChartConfig,
    ) -> Tuple[bool, Optional[ChartGenerationError]]:
        """Validate compatibility with Superset's chart engine."""
        errors = []

        # Check for known Superset limitations and incompatibilities
        if isinstance(config, XYChartConfig):
            # Check for potential groupby conflicts
            if config.group_by and config.group_by.name == config.x.name:
                errors.append(
                    "Group by column cannot be the same as X-axis column "
                    "(causes duplicate label errors in Superset)"
                )

            # Check for Y-axis label conflicts
            x_label = config.x.label or config.x.name
            for i, y_col in enumerate(config.y):
                y_label = y_col.label or (
                    f"{y_col.aggregate}({y_col.name})"
                    if y_col.aggregate
                    else y_col.name
                )
                if y_label == x_label:
                    errors.append(
                        f"Y-axis column {i} label '{y_label}' conflicts with X-axis "
                        f"label"
                    )

        elif isinstance(config, TableChartConfig):
            # Check for label conflicts in table columns
            labels_seen = set()
            for i, col in enumerate(config.columns):
                label = col.label or (
                    f"{col.aggregate}({col.name})" if col.aggregate else col.name
                )
                if label in labels_seen:
                    errors.append(
                        f"Duplicate column label '{label}' at position {i} "
                        "(causes Superset errors)"
                    )
                labels_seen.add(label)

        if errors:
            return False, ChartGenerationError(
                error_type="superset_compatibility_error",
                message="Superset compatibility validation failed",
                details=f"Compatibility issues: {'; '.join(errors)}",
                suggestions=[
                    "Ensure all column labels are unique",
                    "Don't use same column for X-axis and group by",
                    "Use 'label' field to resolve naming conflicts",
                ],
                error_code="SUPERSET_COMPATIBILITY_FAILED",
            )

        return True, None

    @staticmethod
    def _validate_runtime_preview(
        config: ChartConfig,
        dataset_id: Union[int, str],
    ) -> Tuple[bool, Optional[ChartGenerationError]]:
        """Optional runtime validation by attempting to generate form_data and test
        query."""
        try:
            # Import form data mapping utilities
            from superset.mcp_service.chart.chart_utils import map_config_to_form_data

            # Test form_data generation - this catches many runtime issues early
            form_data = map_config_to_form_data(config)

            # Basic form_data validation
            if not form_data or not isinstance(form_data, dict):
                return False, ChartGenerationError(
                    error_type="form_data_generation_error",
                    message="Failed to generate valid chart configuration",
                    details="Could not convert chart configuration to Superset's "
                    "internal format",
                    suggestions=[
                        "Check that chart configuration is complete and valid",
                        "Ensure all required fields are provided",
                        "Verify column names and aggregate functions are correct",
                    ],
                    error_code="FORM_DATA_GENERATION_FAILED",
                )

            # Check for empty metrics (common runtime failure)
            metrics = form_data.get("metrics", [])
            if isinstance(config, XYChartConfig) and not metrics:
                return False, ChartGenerationError(
                    error_type="empty_metrics_error",
                    message="Chart would have no data to display",
                    details="Y-axis configuration resulted in no valid metrics for "
                    "visualization",
                    suggestions=[
                        "Ensure Y-axis columns have valid aggregate functions",
                        "Check that column names exist in the dataset",
                        "Use get_dataset_info to verify available columns and metrics",
                    ],
                    error_code="EMPTY_METRICS_ERROR",
                )

            # Check for empty columns (table charts)
            columns = form_data.get("all_columns", []) + form_data.get("groupby", [])
            if isinstance(config, TableChartConfig) and not columns and not metrics:
                return False, ChartGenerationError(
                    error_type="empty_columns_error",
                    message="Table chart would have no columns to display",
                    details="Table configuration resulted in no valid columns or "
                    "metrics",
                    suggestions=[
                        "Add at least one column to the columns array",
                        "Verify column names exist in the dataset",
                        "Use get_dataset_info to see available columns",
                    ],
                    error_code="EMPTY_COLUMNS_ERROR",
                )

            return True, None

        except ImportError:
            # Skip runtime validation if dependencies not available
            logger.warning("Runtime validation skipped - chart_utils not available")
            return True, None
        except Exception as e:
            # Log warning but don't fail validation for runtime preview issues
            logger.warning(f"Runtime preview validation failed: {e}")
            return True, None  # Allow request to proceed
