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
from typing import Any, Dict, List, Tuple

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

# Exceptions that can occur during column name normalization.
# Shared by the validation pipeline and tool-level normalization calls.
NORMALIZATION_EXCEPTIONS = (
    ImportError,
    AttributeError,
    KeyError,
    ValueError,
    TypeError,
)


class DatasetValidator:
    """Validates chart configuration against dataset schema."""

    @staticmethod
    def validate_against_dataset(
        config: TableChartConfig | XYChartConfig,
        dataset_id: int | str,
        dataset_context: DatasetContext | None = None,
    ) -> Tuple[bool, ChartGenerationError | None]:
        """
        Validate chart configuration against dataset schema.

        Args:
            config: Chart configuration to validate
            dataset_id: Dataset ID to validate against
            dataset_context: Pre-fetched dataset context to avoid duplicate
                DB queries. If None, fetches from the database.

        Returns:
            Tuple of (is_valid, error)
        """
        # Get dataset context (reuse if provided)
        if dataset_context is None:
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
    def _get_dataset_context(dataset_id: int | str) -> DatasetContext | None:
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
    def _get_canonical_column_name(
        column_name: str, dataset_context: DatasetContext
    ) -> str:
        """
        Get the canonical column name from the dataset.

        Performs case-insensitive matching and returns the actual column name
        as stored in the dataset. This ensures column names in form_data match
        exactly with what the frontend expects.

        Args:
            column_name: The column name to normalize
            dataset_context: Dataset context with column information

        Returns:
            The canonical column name from the dataset, or the original name
            if no match is found.
        """
        column_lower = column_name.lower()

        # Check regular columns first
        for col in dataset_context.available_columns:
            if col["name"].lower() == column_lower:
                return col["name"]

        # Check metrics
        for metric in dataset_context.available_metrics:
            if metric["name"].lower() == column_lower:
                return metric["name"]

        # Return original if not found (validation should catch this case)
        return column_name

    @staticmethod
    def _normalize_xy_config(
        config_dict: Dict[str, Any], dataset_context: DatasetContext
    ) -> None:
        """Normalize column names in an XY chart config dict in place."""
        # Normalize x-axis column
        if "x" in config_dict and config_dict["x"]:
            config_dict["x"]["name"] = DatasetValidator._get_canonical_column_name(
                config_dict["x"]["name"], dataset_context
            )

        # Normalize y-axis columns
        if "y" in config_dict and config_dict["y"]:
            for y_col in config_dict["y"]:
                y_col["name"] = DatasetValidator._get_canonical_column_name(
                    y_col["name"], dataset_context
                )

        # Normalize group_by column
        if "group_by" in config_dict and config_dict["group_by"]:
            config_dict["group_by"]["name"] = (
                DatasetValidator._get_canonical_column_name(
                    config_dict["group_by"]["name"], dataset_context
                )
            )

    @staticmethod
    def _normalize_table_config(
        config_dict: Dict[str, Any], dataset_context: DatasetContext
    ) -> None:
        """Normalize column names in a table chart config dict in place."""
        if "columns" in config_dict and config_dict["columns"]:
            for col in config_dict["columns"]:
                col["name"] = DatasetValidator._get_canonical_column_name(
                    col["name"], dataset_context
                )

    @staticmethod
    def _normalize_filters(
        config_dict: Dict[str, Any], dataset_context: DatasetContext
    ) -> None:
        """Normalize filter column names in a config dict in place."""
        if "filters" in config_dict and config_dict["filters"]:
            for filter_config in config_dict["filters"]:
                if filter_config and "column" in filter_config:
                    filter_config["column"] = (
                        DatasetValidator._get_canonical_column_name(
                            filter_config["column"], dataset_context
                        )
                    )

    @staticmethod
    def normalize_column_names(
        config: TableChartConfig | XYChartConfig,
        dataset_id: int | str,
        dataset_context: DatasetContext | None = None,
    ) -> TableChartConfig | XYChartConfig:
        """
        Normalize column names in config to match the canonical dataset column names.

        This fixes case sensitivity issues where user-provided column names
        (e.g., 'order_date') don't match exactly with the dataset column names
        (e.g., 'OrderDate'). The frontend performs case-sensitive comparisons,
        so we need to ensure column names match exactly.

        Args:
            config: Chart configuration with column references
            dataset_id: Dataset ID to get canonical column names from
            dataset_context: Pre-fetched dataset context to avoid duplicate
                DB queries. If None, fetches from the database.

        Returns:
            A new config with normalized column names
        """
        if dataset_context is None:
            dataset_context = DatasetValidator._get_dataset_context(dataset_id)
        if not dataset_context:
            return config

        # Create a mutable copy of the config
        config_dict = config.model_dump()

        # Normalize based on config type
        if isinstance(config, XYChartConfig):
            DatasetValidator._normalize_xy_config(config_dict, dataset_context)
        elif isinstance(config, TableChartConfig):
            DatasetValidator._normalize_table_config(config_dict, dataset_context)

        # Normalize filter columns (common to both config types)
        DatasetValidator._normalize_filters(config_dict, dataset_context)

        # Reconstruct the config with normalized names
        if isinstance(config, XYChartConfig):
            return XYChartConfig.model_validate(config_dict)
        return TableChartConfig.model_validate(config_dict)

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
