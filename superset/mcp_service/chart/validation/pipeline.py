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
Unified validation pipeline for chart operations.
Orchestrates schema, dataset, and runtime validations.
"""

import logging
from typing import Any, Dict, List, Tuple

from superset.mcp_service.chart.schemas import (
    ChartConfig,
    GenerateChartRequest,
)
from superset.mcp_service.common.error_schemas import (
    ChartGenerationError,
    DatasetContext,
)

logger = logging.getLogger(__name__)

# Re-export from shared utility so existing ``from pipeline import ...``
# callers continue to work without changes.
from superset.mcp_service.utils.error_sanitization import (  # noqa: E402, F401
    _get_generic_error_message,
    _redact_sql_select,
    _redact_sql_where,
    _sanitize_validation_error,
)


class ValidationResult:
    """Result of validation pipeline including optional warnings."""

    def __init__(
        self,
        is_valid: bool,
        request: GenerateChartRequest | None = None,
        error: ChartGenerationError | None = None,
        warnings: Dict[str, Any] | None = None,
    ):
        self.is_valid = is_valid
        self.request = request
        self.error = error
        self.warnings = warnings  # Runtime warnings (informational, not blocking)


class ValidationPipeline:
    """
    Main validation orchestrator that runs validations in sequence:
    1. Schema validation (structure and types)
    2. Dataset validation (columns exist)
    3. Runtime validation (performance, compatibility) - returns warnings, not errors
    """

    @staticmethod
    def validate_request(
        request_data: Dict[str, Any],
    ) -> Tuple[bool, GenerateChartRequest | None, ChartGenerationError | None]:
        """
        Validate a chart generation request through all validation layers.

        Args:
            request_data: Raw request data dictionary

        Returns:
            Tuple of (is_valid, parsed_request, error)

        Note: Use validate_request_with_warnings() to also get runtime warnings.
        """
        result = ValidationPipeline.validate_request_with_warnings(request_data)
        return result.is_valid, result.request, result.error

    @staticmethod
    def validate_request_with_warnings(
        request_data: Dict[str, Any],
    ) -> ValidationResult:
        """
        Validate a chart generation request and return warnings as metadata.

        Args:
            request_data: Raw request data dictionary

        Returns:
            ValidationResult with is_valid, request, error, and optional warnings
        """
        try:
            # Layer 1: Schema validation
            from .schema_validator import SchemaValidator

            is_valid, request, error = SchemaValidator.validate_request(request_data)
            if not is_valid:
                return ValidationResult(is_valid=False, error=error)

            # Ensure request is not None
            if request is None:
                return ValidationResult(is_valid=False, error=error)

            # config is already a typed ChartConfig (validated by Pydantic)
            typed_config = request.config

            # Fetch dataset context once and reuse across validation layers
            dataset_context = ValidationPipeline._get_dataset_context(
                request.dataset_id
            )

            # Layer 2: Dataset validation (reuses context)
            is_valid, error = ValidationPipeline._validate_dataset(
                typed_config, request.dataset_id, dataset_context
            )
            if not is_valid:
                return ValidationResult(is_valid=False, request=request, error=error)

            # Layer 3: Runtime validation - returns warnings as metadata, not errors
            _is_valid, warnings_metadata = ValidationPipeline._validate_runtime(
                typed_config, request.dataset_id
            )
            # Runtime validation always returns True now, warnings are informational

            # Layer 4: Column name normalization (reuses context)
            normalized_request = ValidationPipeline._normalize_column_names(
                request, dataset_context, typed_config=typed_config
            )

            return ValidationResult(
                is_valid=True,
                request=normalized_request,
                warnings=warnings_metadata,
            )

        except Exception as e:
            logger.exception("Validation pipeline error")
            from superset.mcp_service.utils.error_builder import (
                ChartErrorBuilder,
            )

            # SECURITY FIX: Sanitize validation error to prevent information disclosure
            sanitized_reason = _sanitize_validation_error(e)
            error = ChartErrorBuilder.build_error(
                error_type="validation_system_error",
                template_key="validation_error",
                template_vars={"reason": sanitized_reason},
                error_code="VALIDATION_PIPELINE_ERROR",
            )
            return ValidationResult(is_valid=False, error=error)

    @staticmethod
    def _get_dataset_context(
        dataset_id: int | str,
    ) -> DatasetContext | None:
        """Fetch dataset context once to reuse across validation layers."""
        try:
            from .dataset_validator import DatasetValidator

            return DatasetValidator._get_dataset_context(dataset_id)
        except ImportError:
            logger.warning("Dataset validator not available, skipping context fetch")
            return None

    @staticmethod
    def _validate_dataset(
        config: ChartConfig,
        dataset_id: int | str,
        dataset_context: DatasetContext | None = None,
    ) -> Tuple[bool, ChartGenerationError | None]:
        """Validate configuration against dataset schema."""
        try:
            from .dataset_validator import DatasetValidator

            return DatasetValidator.validate_against_dataset(
                config, dataset_id, dataset_context=dataset_context
            )
        except ImportError:
            # Skip if dataset validator not available
            logger.warning(
                "Dataset validator not available, skipping dataset validation"
            )
            return True, None
        except Exception as e:
            logger.warning("Dataset validation failed: %s", e)
            # Don't fail on dataset validation errors
            return True, None

    @staticmethod
    def _validate_runtime(
        config: ChartConfig, dataset_id: int | str
    ) -> Tuple[bool, Dict[str, Any] | None]:
        """
        Validate runtime issues (performance, compatibility).

        Returns:
            Tuple of (is_valid, warnings_metadata)
            - is_valid: Always True (runtime warnings don't block generation)
            - warnings_metadata: Dict with warnings/suggestions, or None
        """
        try:
            from .runtime import RuntimeValidator

            return RuntimeValidator.validate_runtime_issues(config, dataset_id)
        except ImportError:
            # Skip if runtime validator not available
            logger.warning(
                "Runtime validator not available, skipping runtime validation"
            )
            return True, None
        except Exception as e:
            logger.warning("Runtime validation failed: %s", e)
            # Don't fail on runtime validation errors
            return True, None

    @staticmethod
    def _normalize_column_names(
        request: GenerateChartRequest,
        dataset_context: DatasetContext | None = None,
        typed_config: ChartConfig | None = None,
    ) -> GenerateChartRequest:
        """
        Normalize column names in the request to match canonical dataset names.

        This fixes case sensitivity issues where user-provided column names
        don't match exactly with the dataset column names. For example,
        if a user provides 'order_date' but the dataset has 'OrderDate',
        this method will normalize it to 'OrderDate'.

        Args:
            request: The validated chart generation request
            dataset_context: Pre-fetched dataset context to avoid duplicate
                DB queries. If None, fetches from the database.
            typed_config: Pre-parsed typed ChartConfig. If None, parses from
                request.config dict.

        Returns:
            A new request with normalized column names
        """
        try:
            from .dataset_validator import DatasetValidator

            config = typed_config or request.config
            normalized_config = DatasetValidator.normalize_column_names(
                config,
                request.dataset_id,
                dataset_context=dataset_context,
            )

            # Create a new request with the normalized config
            request_dict = request.model_dump()
            request_dict["config"] = normalized_config.model_dump()

            return GenerateChartRequest.model_validate(request_dict)

        except (ImportError, AttributeError, KeyError, ValueError, TypeError) as e:
            # If normalization fails, return the original request
            # Validation has already passed, so this is a non-critical failure
            logger.warning("Column name normalization failed: %s", e)
            return request

    @staticmethod
    def validate_filters(
        filters: List[Any],
    ) -> Tuple[bool, ChartGenerationError | None]:
        """
        Validate filter logic for contradictions and empty results.

        Args:
            filters: List of filter configurations

        Returns:
            Tuple of (is_valid, error)
        """
        if not filters:
            return True, None

        # Check for contradictory filters
        if ValidationPipeline._has_contradictory_filters(filters):
            from superset.mcp_service.utils.error_builder import (
                ChartErrorBuilder,
            )

            return False, ChartErrorBuilder.build_error(
                error_type="contradictory_filters",
                template_key="invalid_value",
                template_vars={
                    "field": "filters",
                    "value": "contradictory conditions",
                    "reason": "Filter conditions are logically impossible",
                    "allowed_values": "non-contradictory conditions",
                    "specific_suggestion": "Remove conflicting filters",
                },
                error_code="CONTRADICTORY_FILTERS",
            )

        # Check for filters likely to return empty
        if empty_warnings := ValidationPipeline._check_empty_result_filters(filters):
            from superset.mcp_service.utils.error_builder import (
                ChartErrorBuilder,
            )

            return False, ChartErrorBuilder.build_error(
                error_type="empty_result_warning",
                template_key="empty_result",
                template_vars={"reason": "; ".join(empty_warnings)},
                custom_suggestions=[
                    "Verify filter values exist in your dataset",
                    "Check for typos in filter values",
                    "Use broader filter criteria",
                ],
                error_code="EMPTY_RESULT_WARNING",
            )

        return True, None

    @staticmethod
    def _has_contradictory_filters(filters: List[Any]) -> bool:
        """Check if filters contain logical contradictions."""
        # Group filters by column
        column_filters: Dict[str, List[Any]] = {}
        for f in filters:
            col = f.column
            if col not in column_filters:
                column_filters[col] = []
            column_filters[col].append(f)

        # Check for contradictions within same column
        for _col, col_filters in column_filters.items():
            # Check for > X AND < Y where X >= Y
            gt_values = [f.value for f in col_filters if f.op == ">"]
            lt_values = [f.value for f in col_filters if f.op == "<"]

            for gt in gt_values:
                for lt in lt_values:
                    try:
                        if float(gt) >= float(lt):
                            return True
                    except (ValueError, TypeError):
                        pass

            # Check for = X AND = Y where X != Y
            eq_values = [f.value for f in col_filters if f.op == "="]
            if len(eq_values) > 1 and len(set(eq_values)) > 1:
                return True

        return False

    @staticmethod
    def _check_empty_result_filters(filters: List[Any]) -> List[str]:
        """Check for filter patterns that commonly result in empty results."""
        warnings = []

        for f in filters:
            col_lower = f.column.lower()
            val_str = str(f.value).lower() if f.value is not None else ""

            # Check for common empty result patterns
            if f.op == "=" and any(
                pattern in val_str
                for pattern in ["deleted", "archived", "inactive", "disabled"]
            ):
                warnings.append(
                    f"Filter '{f.column} = {f.value}' may return few or no results"
                )

            # Check for future dates
            if "date" in col_lower and f.op in [">", ">="]:
                try:
                    if "20" in val_str and int(val_str[:4]) > 2025:
                        warnings.append(
                            f"Filter '{f.column} {f.op} {f.value}' uses future date"
                        )
                except (ValueError, IndexError):
                    # Ignore invalid date formats
                    pass

        return warnings
