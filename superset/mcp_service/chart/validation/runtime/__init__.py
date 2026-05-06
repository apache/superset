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
from typing import Any, Dict, List, Tuple

from superset.mcp_service.chart.schemas import ChartConfig

logger = logging.getLogger(__name__)


class RuntimeValidator:
    """Orchestrates runtime validations for chart configurations."""

    @staticmethod
    def validate_runtime_issues(
        config: ChartConfig, dataset_id: int | str
    ) -> Tuple[bool, Dict[str, Any] | None]:
        """
        Validate runtime issues that could affect chart rendering or performance.

        Warnings are returned as informational metadata, NOT as errors.
        Chart generation proceeds regardless of warnings.

        Args:
            config: Chart configuration to validate
            dataset_id: Dataset identifier

        Returns:
            Tuple of (is_valid, warnings_metadata)
            - is_valid: Always True (warnings don't block generation)
            - warnings_metadata: Dict with warnings and suggestions, or None
        """
        warnings: List[str] = []
        suggestions: List[str] = []

        # Per-plugin runtime warnings (format, cardinality, etc.)
        plugin_warnings = RuntimeValidator._validate_plugin_runtime(config, dataset_id)
        if plugin_warnings:
            warnings.extend(plugin_warnings)

        # Chart type appropriateness validation (for all chart types)
        type_warnings, type_suggestions = RuntimeValidator._validate_chart_type(
            config, dataset_id
        )
        if type_warnings:
            warnings.extend(type_warnings)
            suggestions.extend(type_suggestions)

        # Return warnings as metadata, NOT as errors
        # Warnings should inform, not block chart generation
        if warnings:
            logger.info(
                "Runtime validation warnings for dataset %s: %s",
                dataset_id,
                warnings[:3],
            )
            return (
                True,
                {
                    "warnings": warnings[:5],  # Limit to 5 warnings
                    "suggestions": suggestions[:5],  # Limit to 5 suggestions
                },
            )

        return True, None

    @staticmethod
    def _validate_plugin_runtime(
        config: ChartConfig, dataset_id: int | str
    ) -> List[str]:
        """Delegate per-chart-type runtime warnings to the plugin registry.

        Each plugin's get_runtime_warnings() method returns chart-type-specific
        warnings (e.g. format/cardinality for XY). The registry dispatch removes
        the previous isinstance(config, XYChartConfig) hardcoding.
        """
        try:
            from superset.mcp_service.chart.registry import get_registry

            chart_type = getattr(config, "chart_type", None)
            if chart_type is None:
                return []
            plugin = get_registry().get(chart_type)
            if plugin is None:
                return []
            return plugin.get_runtime_warnings(config, dataset_id)
        except Exception as exc:
            logger.warning("Plugin runtime validation failed: %s", exc)
            return []

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
