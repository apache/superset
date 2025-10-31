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
from superset.mcp_service.common.error_schemas import ChartGenerationError

logger = logging.getLogger(__name__)


def _redact_sql_select(error_str: str, error_str_upper: str) -> str:
    """Redact SELECT...FROM clause content to prevent data disclosure."""
    if "SELECT" in error_str_upper and "FROM" in error_str_upper:
        select_idx = error_str_upper.find("SELECT")
        from_idx = error_str_upper.find("FROM", select_idx)
        if select_idx != -1 and from_idx != -1:
            return error_str[: select_idx + 7] + " [REDACTED] " + error_str[from_idx:]
    return error_str


def _redact_sql_where(error_str: str, error_str_upper: str) -> str:
    """Redact WHERE clause content to prevent data disclosure."""
    if "WHERE" not in error_str_upper:
        return error_str

    where_idx = error_str_upper.find("WHERE")
    terminators = ["ORDER", "GROUP", "LIMIT", "UNION", "EXCEPT", "INTERSECT"]
    term_idx = len(error_str)
    for term in terminators:
        idx = error_str_upper.find(term, where_idx)
        if idx != -1 and idx < term_idx:
            term_idx = idx
    return error_str[: where_idx + 6] + " [REDACTED]" + error_str[term_idx:]


def _get_generic_error_message(error_str: str) -> str | None:
    """Return generic message for common error types, or None."""
    error_lower = error_str.lower()
    if "permission" in error_lower or "access" in error_lower:
        return "Validation failed due to access restrictions"
    if "database" in error_lower or "connection" in error_lower:
        return "Validation failed due to database connectivity"
    if "timeout" in error_lower:
        return "Validation timed out"
    return None


def _sanitize_validation_error(error: Exception) -> str:
    """SECURITY FIX: Sanitize validation errors to prevent disclosure."""
    error_str = str(error)

    # SECURITY FIX: Limit length FIRST to prevent ReDoS attacks
    if len(error_str) > 200:
        error_str = error_str[:200] + "...[truncated]"

    # Remove potentially sensitive schema information
    import re

    sensitive_patterns = [
        (r'\btable\s+[\'"`]?(\w+)[\'"`]?', "table [REDACTED]"),
        (r'\bcolumn\s+[\'"`]?(\w+)[\'"`]?', "column [REDACTED]"),
        (r'\bdatabase\s+[\'"`]?(\w+)[\'"`]?', "database [REDACTED]"),
        (r'\bschema\s+[\'"`]?(\w+)[\'"`]?', "schema [REDACTED]"),
    ]
    for pattern, replacement in sensitive_patterns:
        error_str = re.sub(pattern, replacement, error_str, flags=re.IGNORECASE)

    # SECURITY FIX: SQL sanitization without ReDoS-vulnerable patterns
    error_str_upper = error_str.upper()
    error_str = _redact_sql_select(error_str, error_str_upper)
    error_str = _redact_sql_where(error_str, error_str_upper)

    # Return generic message for common error types
    if generic := _get_generic_error_message(error_str):
        return generic

    return error_str


class ValidationPipeline:
    """
    Main validation orchestrator that runs validations in sequence:
    1. Schema validation (structure and types)
    2. Dataset validation (columns exist)
    3. Runtime validation (performance, compatibility)
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
        """
        try:
            # Layer 1: Schema validation
            from .schema_validator import SchemaValidator

            is_valid, request, error = SchemaValidator.validate_request(request_data)
            if not is_valid:
                return False, None, error

            # Ensure request is not None
            if request is None:
                return False, None, error

            # Layer 2: Dataset validation
            is_valid, error = ValidationPipeline._validate_dataset(
                request.config, request.dataset_id
            )
            if not is_valid:
                return False, request, error

            # Layer 3: Runtime validation
            is_valid, error = ValidationPipeline._validate_runtime(
                request.config, request.dataset_id
            )
            if not is_valid:
                return False, request, error

            return True, request, None

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
            return False, None, error

    @staticmethod
    def _validate_dataset(
        config: ChartConfig, dataset_id: int | str
    ) -> Tuple[bool, ChartGenerationError | None]:
        """Validate configuration against dataset schema."""
        try:
            from .dataset_validator import DatasetValidator

            return DatasetValidator.validate_against_dataset(config, dataset_id)
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
    ) -> Tuple[bool, ChartGenerationError | None]:
        """Validate runtime issues (performance, compatibility)."""
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
