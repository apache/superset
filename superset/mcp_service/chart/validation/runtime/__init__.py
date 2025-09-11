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
Runtime validation module for chart configurations.
Validates performance, compatibility, and user experience issues.
"""

import logging
from typing import List, Optional, Tuple

from superset.mcp_service.chart.schemas import (
    ChartConfig,
    XYChartConfig,
)
from superset.mcp_service.common.error_schemas import ChartGenerationError

logger = logging.getLogger(__name__)


class RuntimeValidator:
    """Orchestrates runtime validations for chart configurations."""

    @staticmethod
    def validate_runtime_issues(
        config: ChartConfig, dataset_id: int | str
    ) -> Tuple[bool, Optional[ChartGenerationError]]:
        """
        Validate runtime issues that could affect chart rendering or performance.

        Args:
            config: Chart configuration to validate
            dataset_id: Dataset identifier

        Returns:
            Tuple of (is_valid, error)
        """
        warnings: List[str] = []
        suggestions: List[str] = []

        # Only check XY charts for format and cardinality issues
        if isinstance(config, XYChartConfig):
            # Format-type compatibility validation
            format_warnings = RuntimeValidator._validate_format_compatibility(config)
            if format_warnings:
                warnings.extend(format_warnings)

            # Cardinality validation
            cardinality_warnings, cardinality_suggestions = (
                RuntimeValidator._validate_cardinality(config, dataset_id)
            )
            if cardinality_warnings:
                warnings.extend(cardinality_warnings)
                suggestions.extend(cardinality_suggestions)

        # Chart type appropriateness validation (for all chart types)
        type_warnings, type_suggestions = RuntimeValidator._validate_chart_type(
            config, dataset_id
        )
        if type_warnings:
            warnings.extend(type_warnings)
            suggestions.extend(type_suggestions)

        # If we have warnings, return them as a validation error
        if warnings:
            from superset.mcp_service.chart.error_handling.error_builder import (
                ChartErrorBuilder,
            )

            return False, ChartErrorBuilder.build_error(
                error_type="runtime_semantic_warning",
                template_key="performance_warning",
                template_vars={
                    "reason": "; ".join(warnings[:3])
                    + ("..." if len(warnings) > 3 else "")
                },
                custom_suggestions=suggestions[:5],  # Limit suggestions
                error_code="RUNTIME_SEMANTIC_WARNING",
            )

        return True, None

    @staticmethod
    def _validate_format_compatibility(config: XYChartConfig) -> List[str]:
        """Validate format-type compatibility."""
        warnings: List[str] = []

        try:
            # Import here to avoid circular imports
            from .format_validator import FormatTypeValidator

            is_valid, format_warnings = (
                FormatTypeValidator.validate_format_compatibility(config)
            )
            if format_warnings:
                warnings.extend(format_warnings)
        except ImportError:
            logger.warning("Format validator not available")
        except Exception as e:
            logger.warning("Format validation failed: %s", e)

        return warnings

    @staticmethod
    def _validate_cardinality(
        config: XYChartConfig, dataset_id: int | str
    ) -> Tuple[List[str], List[str]]:
        """Validate cardinality issues."""
        warnings: List[str] = []
        suggestions: List[str] = []

        try:
            # Import here to avoid circular imports
            from .cardinality_validator import CardinalityValidator

            # Determine chart type for cardinality thresholds
            chart_type = config.kind if hasattr(config, "kind") else "default"

            # Check X-axis cardinality
            is_ok, cardinality_info = CardinalityValidator.check_cardinality(
                dataset_id=dataset_id,
                x_column=config.x.name,
                chart_type=chart_type,
                group_by_column=config.group_by.name if config.group_by else None,
            )

            if not is_ok and cardinality_info:
                warnings.extend(cardinality_info.get("warnings", []))
                suggestions.extend(cardinality_info.get("suggestions", []))

        except ImportError:
            logger.warning("Cardinality validator not available")
        except Exception as e:
            logger.warning("Cardinality validation failed: %s", e)

        return warnings, suggestions

    @staticmethod
    def _validate_chart_type(
        config: ChartConfig, dataset_id: int | str
    ) -> Tuple[List[str], List[str]]:
        """Validate chart type appropriateness."""
        warnings: List[str] = []
        suggestions: List[str] = []

        try:
            # Import here to avoid circular imports
            from .chart_type_suggester import ChartTypeSuggester

            is_appropriate, suggestion_info = ChartTypeSuggester.analyze_and_suggest(
                config, dataset_id
            )

            if not is_appropriate and suggestion_info:
                warnings.extend(suggestion_info.get("issues", []))
                suggestions.extend(suggestion_info.get("suggestions", []))

                # Add recommended chart types
                recommended = suggestion_info.get("recommended_types", [])
                if recommended:
                    recommendations = ", ".join(recommended)
                    suggestions.append(
                        f"Recommended chart types for this data: {recommendations}"
                    )

        except ImportError:
            logger.warning("Chart type suggester not available")
        except Exception as e:
            logger.warning("Chart type validation failed: %s", e)

        return warnings, suggestions
