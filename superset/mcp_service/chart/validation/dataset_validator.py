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
Dataset-specific validation for chart configurations.
Validates that referenced columns exist in the dataset schema.
"""

import difflib
import logging
from typing import Dict, List, Optional, Tuple

from superset.mcp_service.chart.schemas import (
    ColumnRef,
    TableChartConfig,
    XYChartConfig,
)
from superset.mcp_service.common.error_schemas import (
    ChartGenerationError,
    ColumnSuggestion,
    DatasetContext,
)

logger = logging.getLogger(__name__)


class DatasetValidator:
    """Validates chart configuration against dataset schema."""

    @staticmethod
    def validate_against_dataset(
        config: TableChartConfig | XYChartConfig, dataset_id: int | str
    ) -> Tuple[bool, Optional[ChartGenerationError]]:
        """
        Validate chart configuration against dataset schema.

        Args:
            config: Chart configuration to validate
            dataset_id: Dataset ID to validate against

        Returns:
            Tuple of (is_valid, error)
        """
        # Get dataset context
        dataset_context = DatasetValidator._get_dataset_context(dataset_id)
        if not dataset_context:
            from superset.mcp_service.utils.error_builder import (
                ChartErrorBuilder,
            )

            return False, ChartErrorBuilder.dataset_not_found_error(dataset_id)

        # Collect all column references
        column_refs = DatasetValidator._extract_column_references(config)

        # Validate each column exists
        invalid_columns = []
        for col_ref in column_refs:
            if not DatasetValidator._column_exists(col_ref.name, dataset_context):
                invalid_columns.append(col_ref)

        if invalid_columns:
            # Generate suggestions for invalid columns
            suggestions_map = {}
            for col_ref in invalid_columns:
                suggestions = DatasetValidator._get_column_suggestions(
                    col_ref.name, dataset_context
                )
                suggestions_map[col_ref.name] = suggestions

            # Build error with suggestions
            return False, DatasetValidator._build_column_error(
                invalid_columns, suggestions_map, dataset_context
            )

        # Validate aggregation compatibility
        if isinstance(config, (TableChartConfig, XYChartConfig)):
            aggregation_errors = DatasetValidator._validate_aggregations(
                column_refs, dataset_context
            )
            if aggregation_errors:
                return False, aggregation_errors[0]

        return True, None

    @staticmethod
    def _get_dataset_context(dataset_id: int | str) -> Optional[DatasetContext]:
        """Get dataset context with column information."""
        try:
            from superset.daos.dataset import DatasetDAO

            # Find dataset
            if isinstance(dataset_id, int) or (
                isinstance(dataset_id, str) and dataset_id.isdigit()
            ):
                dataset = DatasetDAO.find_by_id(int(dataset_id))
            else:
                # Try UUID lookup
                dataset = DatasetDAO.find_by_id(dataset_id, id_column="uuid")

            if not dataset:
                return None

            # Build context
            columns = []
            metrics = []

            # Add table columns
            for col in dataset.columns:
                columns.append(
                    {
                        "name": col.column_name,
                        "type": str(col.type) if col.type else "UNKNOWN",
                        "is_temporal": col.is_temporal
                        if hasattr(col, "is_temporal")
                        else False,
                        "is_numeric": col.is_numeric
                        if hasattr(col, "is_numeric")
                        else False,
                    }
                )

            # Add metrics
            for metric in dataset.metrics:
                metrics.append(
                    {
                        "name": metric.metric_name,
                        "expression": metric.expression,
                        "description": metric.description,
                    }
                )

            return DatasetContext(
                id=dataset.id,
                table_name=dataset.table_name,
                schema=dataset.schema,
                database_name=dataset.database.database_name
                if dataset.database
                else None,
                available_columns=columns,
                available_metrics=metrics,
            )

        except Exception as e:
            logger.error("Error getting dataset context for %s: %s", dataset_id, e)
            return None

    @staticmethod
    def _extract_column_references(
        config: TableChartConfig | XYChartConfig,
    ) -> List[ColumnRef]:
        """Extract all column references from configuration."""
        refs = []

        if isinstance(config, TableChartConfig):
            refs.extend(config.columns)
        elif isinstance(config, XYChartConfig):
            refs.append(config.x)
            refs.extend(config.y)
            if config.group_by:
                refs.append(config.group_by)

        # Add filter columns
        if hasattr(config, "filters") and config.filters:
            for filter_config in config.filters:
                refs.append(ColumnRef(name=filter_config.column))

        return refs

    @staticmethod
    def _column_exists(column_name: str, dataset_context: DatasetContext) -> bool:
        """Check if column exists in dataset (case-insensitive)."""
        column_lower = column_name.lower()

        # Check regular columns
        for col in dataset_context.available_columns:
            if col["name"].lower() == column_lower:
                return True

        # Check metrics
        for metric in dataset_context.available_metrics:
            if metric["name"].lower() == column_lower:
                return True

        return False

    @staticmethod
    def _get_column_suggestions(
        column_name: str, dataset_context: DatasetContext, max_suggestions: int = 3
    ) -> List[ColumnSuggestion]:
        """Get column name suggestions using fuzzy matching."""
        all_names = []

        # Collect all column names
        for col in dataset_context.available_columns:
            all_names.append((col["name"], "column", col.get("type", "UNKNOWN")))

        for metric in dataset_context.available_metrics:
            all_names.append((metric["name"], "metric", "METRIC"))

        # Find close matches
        column_lower = column_name.lower()
        close_matches = difflib.get_close_matches(
            column_lower,
            [name[0].lower() for name in all_names],
            n=max_suggestions,
            cutoff=0.6,
        )

        # Build suggestions with proper case and type info
        suggestions = []
        for match in close_matches:
            for name, col_type, data_type in all_names:
                if name.lower() == match:
                    suggestions.append(
                        ColumnSuggestion(name=name, type=col_type, data_type=data_type)
                    )
                    break

        return suggestions

    @staticmethod
    def _build_column_error(
        invalid_columns: List[ColumnRef],
        suggestions_map: Dict[str, List[ColumnSuggestion]],
        dataset_context: DatasetContext,
    ) -> ChartGenerationError:
        """Build error for invalid columns."""
        from superset.mcp_service.utils.error_builder import (
            ChartErrorBuilder,
        )

        # Format error message
        if len(invalid_columns) == 1:
            col = invalid_columns[0]
            suggestions = suggestions_map.get(col.name, [])

            if suggestions:
                return ChartErrorBuilder.column_not_found_error(
                    col.name, [s.name for s in suggestions]
                )
            else:
                return ChartErrorBuilder.column_not_found_error(col.name)
        else:
            # Multiple invalid columns
            invalid_names = [col.name for col in invalid_columns]
            return ChartErrorBuilder.build_error(
                error_type="multiple_invalid_columns",
                template_key="column_not_found",
                template_vars={
                    "column": ", ".join(invalid_names[:3])
                    + ("..." if len(invalid_names) > 3 else ""),
                    "suggestions": "Use get_dataset_info to see all available columns",
                },
                custom_suggestions=[
                    f"Invalid columns: {', '.join(invalid_names)}",
                    "Check spelling and case sensitivity",
                    "Use get_dataset_info to list available columns",
                ],
                error_code="MULTIPLE_INVALID_COLUMNS",
            )

    @staticmethod
    def _validate_aggregations(
        column_refs: List[ColumnRef], dataset_context: DatasetContext
    ) -> List[ChartGenerationError]:
        """Validate that aggregations are appropriate for column types."""
        errors = []

        for col_ref in column_refs:
            if not col_ref.aggregate:
                continue

            # Find column info
            col_info = None
            for col in dataset_context.available_columns:
                if col["name"].lower() == col_ref.name.lower():
                    col_info = col
                    break

            if col_info:
                # Check numeric aggregates on non-numeric columns
                numeric_aggs = ["SUM", "AVG", "MIN", "MAX", "STDDEV", "VAR", "MEDIAN"]
                if (
                    col_ref.aggregate in numeric_aggs
                    and not col_info.get("is_numeric", False)
                    and col_info.get("type", "").upper()
                    not in ["INTEGER", "FLOAT", "DOUBLE", "DECIMAL", "NUMERIC"]
                ):
                    from superset.mcp_service.utils.error_builder import (  # noqa: E501
                        ChartErrorBuilder,
                    )

                    errors.append(
                        ChartErrorBuilder.build_error(
                            error_type="invalid_aggregation",
                            template_key="incompatible_configuration",
                            template_vars={
                                "reason": f"Cannot apply {col_ref.aggregate} to "
                                f"non-numeric column "
                                f"'{col_ref.name}' (type:"
                                f" {col_info.get('type', 'UNKNOWN')})",
                                "primary_suggestion": "Use COUNT or COUNT_DISTINCT "
                                "for text columns",
                            },
                            custom_suggestions=[
                                "Remove the aggregate function for raw values",
                                "Use COUNT to count occurrences",
                                "Use COUNT_DISTINCT to count unique values",
                            ],
                            error_code="INVALID_AGGREGATION",
                        )
                    )

        return errors
