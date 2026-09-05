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
import re
from collections.abc import Mapping
from typing import Any, Callable, Dict, Iterable, List, Tuple, TypeVar

from superset.mcp_service.chart.schemas import (
    ChartConfig,
    ColumnRef,
    SunburstChartConfig,
)
from superset.mcp_service.common.error_schemas import (
    ChartGenerationError,
    ColumnSuggestion,
    DatasetContext,
)

_C = TypeVar("_C", bound=ChartConfig)
_T = TypeVar("_T")

logger = logging.getLogger(__name__)

_NUMERIC_TYPE_PATTERN = re.compile(
    r"\b(?:(?:TINY|SMALL|MEDIUM|BIG)?INT(?:EGER)?|INT[248]|FLOAT[48]?|"
    r"DOUBLE(?:\s+PRECISION)?|DECIMAL|NUMERIC|REAL|NUMBER|(?:SMALL)?MONEY)\b"
)


def resolve_exact_first_casefold(
    reference: str,
    candidates: Iterable[_T],
    name_getter: Callable[[_T], str],
) -> tuple[_T | None, list[str]]:
    """Resolve an exact name, or one and only one Unicode-casefold match.

    The exact pass makes resolution independent of metadata ordering when two
    distinct names differ only by case.  A non-exact folded reference resolves
    only when it identifies exactly one candidate; callers reject the returned
    ambiguity list rather than selecting whichever metadata row came first.
    """
    materialized = list(candidates)
    for candidate in materialized:
        if name_getter(candidate) == reference:
            return candidate, []

    folded_reference = reference.casefold()
    folded_matches = [
        candidate
        for candidate in materialized
        if name_getter(candidate).casefold() == folded_reference
    ]
    if len(folded_matches) == 1:
        return folded_matches[0], []
    return None, [name_getter(candidate) for candidate in folded_matches]


def metadata_entry_name(candidate: Mapping[str, Any] | None) -> str:
    """Return the canonical name from one dataset metadata mapping."""
    if candidate is None:
        raise ValueError("Dataset metadata candidates must not be null")
    return str(candidate["name"])


def is_numeric_column(column: Mapping[str, Any]) -> bool:
    """Return whether dataset metadata identifies a numeric SQL column."""
    if column.get("is_numeric", False):
        return True
    return bool(_NUMERIC_TYPE_PATTERN.search(str(column.get("type") or "").upper()))


def is_dataset_column_temporal(
    column: Any, column_name: str, db_engine_spec: Any
) -> bool:
    """Return whether a dataset column is safe for temporal operations."""
    from superset.utils.core import GenericDataType

    is_dttm = bool(getattr(column, "is_dttm", False))
    column_type = column.type
    if not column_type:
        return is_dttm

    column_spec = db_engine_spec.get_column_spec(column_type)
    generic_type = column_spec.generic_type if column_spec else None
    if generic_type == GenericDataType.TEMPORAL:
        return True
    if not is_dttm:
        return False
    if generic_type != GenericDataType.NUMERIC or getattr(
        column, "python_date_format", None
    ):
        return True

    logger.debug(
        "Column '%s' is marked is_dttm=True but has numeric type '%s' with "
        "no python_date_format; treating it as non-temporal",
        column_name,
        column_type,
    )
    return False


def build_dataset_context_from_orm(dataset: Any) -> DatasetContext | None:
    """Construct a :class:`DatasetContext` from an already-fetched ORM dataset.

    Callers that already have the ORM object (e.g. after permission checks)
    should use this to avoid a redundant ``DatasetDAO.find_by_id`` round trip.
    """
    if dataset is None:
        return None

    database = getattr(dataset, "database", None)
    db_engine_spec = getattr(database, "db_engine_spec", None)
    columns: List[Dict[str, Any]] = []
    for col in getattr(dataset, "columns", []) or []:
        columns.append(
            {
                "name": col.column_name,
                "type": str(col.type) if col.type else "UNKNOWN",
                "is_temporal": (
                    is_dataset_column_temporal(col, col.column_name, db_engine_spec)
                    if db_engine_spec
                    else getattr(col, "is_temporal", False)
                ),
                "is_numeric": getattr(col, "is_numeric", False),
            }
        )

    metrics: List[Dict[str, Any]] = []
    for metric in getattr(dataset, "metrics", []) or []:
        metrics.append(
            {
                "name": metric.metric_name,
                "expression": metric.expression,
                "description": metric.description,
            }
        )

    database_name = getattr(database, "database_name", None) or ""
    return DatasetContext(
        id=dataset.id,
        table_name=dataset.table_name,
        schema=dataset.schema,
        database_name=database_name,
        available_columns=columns,
        available_metrics=metrics,
    )


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
    def _resolve_metadata_entry(
        reference: str,
        candidates: List[Dict[str, Any]],
    ) -> tuple[Dict[str, Any] | None, list[str]]:
        """Resolve metadata through the shared exact-first resolver."""
        return resolve_exact_first_casefold(reference, candidates, metadata_entry_name)

    @staticmethod
    def _ambiguous_reference_error(
        reference: str, matches: list[str]
    ) -> ChartGenerationError:
        """Build the common actionable error for ambiguous metadata names."""
        joined = ", ".join(repr(name) for name in matches)
        return ChartGenerationError(
            error_type="ambiguous_dataset_reference",
            message=f"Dataset reference {reference!r} is ambiguous",
            details=(
                "The case-insensitive reference matches multiple candidates: "
                f"{joined}. Use the exact dataset spelling."
            ),
            suggestions=[f"Use the exact name {name!r}" for name in matches[:10]],
            error_code="AMBIGUOUS_DATASET_REFERENCE",
        )

    @staticmethod
    def validate_against_dataset(
        config: ChartConfig,
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

        ambiguity_error = DatasetValidator._validate_unambiguous_references(
            column_refs, dataset_context
        )
        if ambiguity_error:
            return False, ambiguity_error

        filter_error = DatasetValidator._validate_filter_references(
            config, dataset_context
        )
        if filter_error:
            return False, filter_error

        temporal_error = DatasetValidator._validate_temporal_column(
            config, dataset_context
        )
        if temporal_error:
            return False, temporal_error

        # Validate saved metrics exist in dataset metrics specifically
        invalid_saved = DatasetValidator._validate_saved_metrics(
            column_refs, dataset_context
        )
        if invalid_saved:
            return False, invalid_saved

        # Validate columns exist (skip saved metrics — already validated above)
        column_error = DatasetValidator._validate_columns_exist(
            column_refs, dataset_context
        )
        if column_error:
            return False, column_error

        # Validate aggregation compatibility for every config that produced
        # column refs. ``_validate_aggregations`` is config-agnostic — gating
        # it to Table/XY would let pie / pivot table / mixed timeseries /
        # handlebars / big number slip through ``SUM(non_numeric)`` patterns
        # for the fast-path tools that skip Tier 2.
        aggregation_errors = DatasetValidator._validate_aggregations(
            column_refs,
            dataset_context,
            require_numeric_metrics=isinstance(config, SunburstChartConfig),
        )
        if aggregation_errors:
            return False, aggregation_errors[0]

        return True, None

    @staticmethod
    def _validate_filter_references(
        config: ChartConfig, dataset_context: DatasetContext
    ) -> ChartGenerationError | None:
        """Validate typed WHERE subjects through the shared resolver."""
        for filter_ in getattr(config, "filters", None) or []:
            candidates = list(dataset_context.available_columns)
            match, ambiguous = resolve_exact_first_casefold(
                filter_.column,
                candidates,
                metadata_entry_name,
            )
            if ambiguous:
                return DatasetValidator._ambiguous_reference_error(
                    filter_.column, ambiguous
                )
            if match is None:
                return DatasetValidator._build_column_error(
                    [ColumnRef(name=filter_.column)],
                    {
                        filter_.column: DatasetValidator._get_column_suggestions(
                            filter_.column, dataset_context
                        )
                    },
                    dataset_context,
                )
        return None

    @staticmethod
    def _validate_temporal_column(
        config: ChartConfig, dataset_context: DatasetContext
    ) -> ChartGenerationError | None:
        """Require an explicitly selected dashboard time column to be temporal."""
        temporal_column = getattr(config, "temporal_column", None)
        if not temporal_column:
            return None

        matching_column, ambiguous_matches = DatasetValidator._resolve_metadata_entry(
            temporal_column, dataset_context.available_columns
        )
        if ambiguous_matches:
            return DatasetValidator._ambiguous_reference_error(
                temporal_column, ambiguous_matches
            )
        if matching_column is None:
            return ChartGenerationError(
                error_type="missing_temporal_column",
                message=f"Temporal column '{temporal_column}' does not exist",
                details="The temporal_column must reference a physical dataset column.",
                suggestions=[
                    "Choose a temporal column from the dataset",
                    "Remove temporal_column to use the dataset's default time column",
                ],
                error_code="MISSING_TEMPORAL_COLUMN",
            )
        if matching_column.get("is_temporal", False):
            return None

        return ChartGenerationError(
            error_type="invalid_temporal_column",
            message=f"Column '{temporal_column}' is not temporal",
            details=(
                "The temporal_column must reference a dataset column marked as "
                "temporal so dashboard time-range filters can bind to the chart."
            ),
            suggestions=[
                "Choose a temporal column from the dataset",
                "Remove temporal_column to use the dataset's default time column",
            ],
            error_code="NON_TEMPORAL_COLUMN",
        )

    @staticmethod
    def _validate_columns_exist(  # noqa: C901
        column_refs: List[ColumnRef], dataset_context: DatasetContext
    ) -> ChartGenerationError | None:
        """Validate that non-saved-metric column refs exist in the dataset.

        A ``ColumnRef`` with ``saved_metric=False`` must match an entry in
        ``available_columns``. Saved-metric *names* don't satisfy this check —
        otherwise ``{name: "sum_boys", aggregate: "SUM"}`` (no
        ``saved_metric=true``) would slip through and downstream code would
        emit ``SUM(sum_boys)`` as an ad-hoc SIMPLE metric, producing the
        broken-SQL pattern this validator is meant to prevent.
        """
        invalid_columns: List[ColumnRef] = []
        saved_metric_typo: List[ColumnRef] = []
        for col_ref in column_refs:
            if col_ref.saved_metric:
                continue
            if col_ref.sql_expression:
                # SQL metrics don't reference a dataset column.
                continue
            if col_ref.name is None:
                # Should be unreachable per validate_metric_shape; defensive.
                continue
            column, _column_ambiguity = DatasetValidator._resolve_metadata_entry(
                col_ref.name, dataset_context.available_columns
            )
            if column is not None:
                continue
            metric, _metric_ambiguity = DatasetValidator._resolve_metadata_entry(
                col_ref.name, dataset_context.available_metrics
            )
            if metric is not None:
                # Name matches a saved metric but the ref didn't opt into
                # saved-metric resolution. Surface a tailored hint so the
                # caller (typically an LLM) can flip ``saved_metric=true``.
                saved_metric_typo.append(col_ref)
            else:
                invalid_columns.append(col_ref)

        if saved_metric_typo:
            return DatasetValidator._build_saved_metric_hint_error(saved_metric_typo)

        if not invalid_columns:
            return None

        suggestions_map = {}
        for col_ref in invalid_columns:
            # Loop above filters out refs without a name; defensive guard.
            if col_ref.name is None:
                continue
            suggestions = DatasetValidator._get_column_suggestions(
                col_ref.name, dataset_context
            )
            suggestions_map[col_ref.name] = suggestions

        return DatasetValidator._build_column_error(
            invalid_columns, suggestions_map, dataset_context
        )

    @staticmethod
    def _build_saved_metric_hint_error(
        refs: List[ColumnRef],
    ) -> ChartGenerationError:
        """Error response when a non-saved-metric ref names a saved metric."""
        names = [r.name for r in refs]
        names_str = ", ".join(f"'{n}'" for n in names)
        first = names[0]
        return ChartGenerationError(
            error_type="saved_metric_not_marked",
            message=(
                f"{names_str} matches a saved metric but the ref doesn't "
                f"have saved_metric=true"
            ),
            details=(
                f"The dataset has a saved metric named {names_str}. To use "
                f"it, set 'saved_metric': true on the column ref instead of "
                f"providing an 'aggregate'. With the current shape, the "
                f"chart would emit ad-hoc SQL like SUM({first}) — which is "
                f"invalid because {first} is a metric expression, not a "
                f"column."
            ),
            suggestions=[
                f'Did you mean: {{"name": "{first}", "saved_metric": true}}?',
                "Use saved_metric=true to reference a saved dataset metric",
                "Or pick a real column name and apply an aggregate to it",
            ],
            error_code="SAVED_METRIC_NOT_MARKED",
        )

    @staticmethod
    def _get_dataset_context(dataset_id: int | str) -> DatasetContext | None:
        """Fetch the ORM dataset by ID/UUID and build a :class:`DatasetContext`."""
        try:
            from superset.daos.dataset import DatasetDAO

            if isinstance(dataset_id, int) or (
                isinstance(dataset_id, str) and dataset_id.isdigit()
            ):
                dataset = DatasetDAO.find_by_id(int(dataset_id))
            else:
                dataset = DatasetDAO.find_by_id(dataset_id, id_column="uuid")

            return build_dataset_context_from_orm(dataset)

        except Exception as e:
            logger.error("Error getting dataset context for %s: %s", dataset_id, e)
            return None

    @staticmethod
    def _extract_column_references(
        config: ChartConfig,
    ) -> List[ColumnRef]:
        """Extract all column references from configuration via the plugin registry.

        Previously only handled TableChartConfig and XYChartConfig, causing
        most chart types to silently skip column validation. Now delegates
        to the plugin for each registered chart type; a config whose type has
        no registered plugin yields no refs (rather than raising).
        """
        # Local import: plugins call DatasetValidator helpers from
        # normalize_column_refs().
        # A top-level import of registry in dataset_validator would make loading this
        # module implicitly trigger plugin registration, creating a circular dependency.
        from superset.mcp_service.chart.registry import get_registry

        chart_type = getattr(config, "chart_type", None)
        if chart_type is None:
            return []

        plugin = get_registry().get(chart_type)
        if plugin is None:
            logger.warning("No plugin registered for chart_type=%r", chart_type)
            return []

        refs = plugin.extract_column_refs(config)
        temporal_column = getattr(config, "temporal_column", None)
        if temporal_column and not any(
            not ref.saved_metric
            and ref.name
            and ref.name.casefold() == temporal_column.casefold()
            for ref in refs
        ):
            refs.append(ColumnRef(name=temporal_column))
        return refs

    @staticmethod
    def _column_exists(column_name: str, dataset_context: DatasetContext) -> bool:
        """Check for one exact-first physical-column or saved-metric match."""
        column, _ = DatasetValidator._resolve_metadata_entry(
            column_name, dataset_context.available_columns
        )
        if column is not None:
            return True
        metric, _ = DatasetValidator._resolve_metadata_entry(
            column_name, dataset_context.available_metrics
        )
        return metric is not None

    @staticmethod
    def _validate_unambiguous_references(
        column_refs: List[ColumnRef], dataset_context: DatasetContext
    ) -> ChartGenerationError | None:
        """Reject non-exact case-folded references with multiple candidates."""
        for ref in column_refs:
            if ref.sql_expression or not ref.name:
                continue
            candidates = (
                dataset_context.available_metrics
                if ref.saved_metric
                else dataset_context.available_columns
            )
            _entry, folded_matches = DatasetValidator._resolve_metadata_entry(
                ref.name, candidates
            )
            if len(folded_matches) <= 1:
                continue
            return DatasetValidator._ambiguous_reference_error(ref.name, folded_matches)
        return None

    @staticmethod
    def get_canonical_column_name(
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
        # Resolve each namespace independently. Combining columns and metrics
        # into one exact-first pass lets an exact saved-metric spelling steal a
        # physical role from a unique casefold column (for example physical
        # ``Sales`` plus saved metric ``sales``). Physical roles must finish
        # column resolution before the compatibility metric fallback begins.
        column, folded_matches = DatasetValidator._resolve_metadata_entry(
            column_name, dataset_context.available_columns
        )
        if column is not None:
            return str(column["name"])
        if folded_matches:
            raise ValueError(
                f"Ambiguous column reference {column_name!r}; exact candidates: "
                f"{', '.join(repr(name) for name in folded_matches)}"
            )

        # This helper predates explicit saved-metric roles, so retain its
        # column-then-metric compatibility fallback only when no physical
        # candidate exists. Callers with saved_metric=True must use the
        # metric-only helper below.
        metric, folded_matches = DatasetValidator._resolve_metadata_entry(
            column_name, dataset_context.available_metrics
        )
        if metric is not None:
            return str(metric["name"])
        if folded_matches:
            raise ValueError(
                f"Ambiguous saved metric reference {column_name!r}; exact "
                f"candidates: {', '.join(repr(name) for name in folded_matches)}"
            )

        # Return original if not found (validation should catch this case)
        return column_name

    @staticmethod
    def get_canonical_metric_name(
        metric_name: str, dataset_context: DatasetContext
    ) -> str:
        """Return the canonical saved-metric name from available_metrics.

        Unlike get_canonical_column_name, this only searches available_metrics
        so that a same-named column with different casing cannot shadow the
        metric's canonical name.  Use this whenever saved_metric=True.

        Returns the original name when no metric matches (validation catches
        the missing-metric case separately).
        """
        entry, folded_matches = DatasetValidator._resolve_metadata_entry(
            metric_name, dataset_context.available_metrics
        )
        if entry is not None:
            return str(entry["name"])
        if folded_matches:
            raise ValueError(
                f"Ambiguous saved metric reference {metric_name!r}; exact "
                f"candidates: {', '.join(repr(name) for name in folded_matches)}"
            )
        return metric_name

    @staticmethod
    def normalize_filters(
        config_dict: Dict[str, Any], dataset_context: DatasetContext
    ) -> None:
        """Normalize filter column names in a config dict in place."""
        if "filters" in config_dict and config_dict["filters"]:
            for filter_config in config_dict["filters"]:
                if filter_config and "column" in filter_config:
                    filter_config["column"] = (
                        DatasetValidator.get_canonical_column_name(
                            filter_config["column"], dataset_context
                        )
                    )

    @staticmethod
    def normalize_column_names(
        config: _C,
        dataset_id: int | str,
        dataset_context: DatasetContext | None = None,
    ) -> _C:
        """
        Normalize column names in config to match the canonical dataset column names.

        This fixes case sensitivity issues where user-provided column names
        (e.g., 'order_date') don't match exactly with the dataset column names
        (e.g., 'OrderDate'). The frontend performs case-sensitive comparisons,
        so we need to ensure column names match exactly.

        Previously only XYChartConfig and TableChartConfig were normalized; now
        all registered chart types are handled via the plugin registry.

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

        # Local import: plugins call DatasetValidator helpers from
        # normalize_column_refs().
        # A top-level import of registry in dataset_validator would make loading this
        # module implicitly trigger plugin registration, creating a circular dependency.
        from superset.mcp_service.chart.registry import get_registry

        chart_type = getattr(config, "chart_type", None)
        if chart_type is None:
            return config

        plugin = get_registry().get(chart_type)
        if plugin is None:
            logger.warning(
                "No plugin for chart_type=%r; skipping column normalization", chart_type
            )
            return config

        normalized_config = plugin.normalize_column_refs(config, dataset_context)
        if temporal_column := getattr(normalized_config, "temporal_column", None):
            canonical_temporal_column = DatasetValidator.get_canonical_column_name(
                temporal_column, dataset_context
            )
            if canonical_temporal_column != temporal_column:
                normalized_config = normalized_config.model_copy(
                    update={"temporal_column": canonical_temporal_column}
                )
        return normalized_config

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
        folded_column = column_name.casefold()
        candidate_lookup = [str(name[0]).casefold() for name in all_names]
        close_matches = difflib.get_close_matches(
            folded_column,
            candidate_lookup,
            n=max_suggestions,
            cutoff=0.6,
        )

        # Build suggestions with proper case and type info. ``ColumnSuggestion``
        # requires ``similarity_score`` and does not have a ``data_type`` field;
        # we score via difflib ratio and store the candidate kind in ``type``.
        suggestions = []
        for match in close_matches:
            for name, col_type, _data_type in all_names:
                if str(name).casefold() == match:
                    score = difflib.SequenceMatcher(None, folded_column, match).ratio()
                    suggestions.append(
                        ColumnSuggestion(
                            name=name,
                            type=col_type,
                            similarity_score=round(score, 3),
                        )
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

        if len(invalid_columns) == 1:
            col = invalid_columns[0]
            col_name = col.name or "<unknown column>"
            suggestions = suggestions_map.get(col_name, [])

            if suggestions:
                return ChartErrorBuilder.column_not_found_error(
                    col_name, [s.name for s in suggestions]
                )
            else:
                return ChartErrorBuilder.column_not_found_error(col_name)
        else:
            # Multiple invalid columns
            invalid_names: list[str] = [col.name for col in invalid_columns if col.name]
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
    def _validate_saved_metrics(
        column_refs: List[ColumnRef], dataset_context: DatasetContext
    ) -> ChartGenerationError | None:
        """Validate that saved_metric refs exist in dataset metrics.

        A ColumnRef with saved_metric=True must match an entry in
        available_metrics, not just available_columns.  Without this check
        a regular column name marked as saved_metric would pass
        _column_exists (which checks both lists) but fail at query time.
        """
        invalid: list[str] = []
        # ``saved_metric=True`` requires ``name`` per ColumnRef.validate_metric_shape.
        for col_ref in column_refs:
            if not col_ref.saved_metric or col_ref.name is None:
                continue
            metric, _ambiguity = DatasetValidator._resolve_metadata_entry(
                col_ref.name, dataset_context.available_metrics
            )
            if metric is None:
                invalid.append(col_ref.name)
        if not invalid:
            return None

        from superset.mcp_service.utils.error_builder import ChartErrorBuilder

        available = [m["name"] for m in dataset_context.available_metrics]
        return ChartErrorBuilder.build_error(
            error_type="invalid_saved_metric",
            template_key="column_not_found",
            template_vars={
                "column": ", ".join(invalid),
                "suggestions": (
                    f"Available saved metrics: {', '.join(available[:10])}"
                    if available
                    else "This dataset has no saved metrics"
                ),
            },
            custom_suggestions=[
                f"'{name}' is not a saved metric in this dataset. "
                "Remove saved_metric=True to use it as a column with an aggregate, "
                "or use get_dataset_info to see available saved metrics."
                for name in invalid
            ],
            error_code="INVALID_SAVED_METRIC",
        )

    @staticmethod
    def _validate_aggregations(  # noqa: C901
        column_refs: List[ColumnRef],
        dataset_context: DatasetContext,
        *,
        require_numeric_metrics: bool = False,
    ) -> List[ChartGenerationError]:
        """Validate that aggregations are appropriate for column types."""
        errors = []

        for col_ref in column_refs:
            if col_ref.saved_metric:
                continue  # Saved metrics have built-in aggregation
            if col_ref.sql_expression:
                # Custom SQL metrics bring their own aggregation expression.
                continue
            if not col_ref.aggregate:
                continue
            if col_ref.name is None:
                # Should be unreachable per validate_metric_shape; defensive.
                continue

            col_info, ambiguous_matches = DatasetValidator._resolve_metadata_entry(
                col_ref.name, dataset_context.available_columns
            )
            if ambiguous_matches:
                errors.append(
                    DatasetValidator._ambiguous_reference_error(
                        col_ref.name, ambiguous_matches
                    )
                )
                continue

            if col_info:
                # Check numeric aggregates on non-numeric columns.
                # MIN and MAX remain valid on dates/text for generic charts.
                # Sunburst metrics must size arcs numerically, so every physical
                # aggregate other than COUNT variants requires numeric metadata.
                numeric_aggs = {
                    "SUM",
                    "AVG",
                    "STDDEV_SAMP",
                    "VAR_SAMP",
                    "MEDIAN",
                    "STDDEV",
                    "VAR",
                }
                if require_numeric_metrics and col_ref.aggregate not in {
                    "COUNT",
                    "COUNT_DISTINCT",
                }:
                    numeric_aggs.add(col_ref.aggregate)
                type_name = str(col_info.get("type") or "").strip().upper()
                if (
                    col_ref.aggregate in numeric_aggs
                    and type_name not in {"", "UNKNOWN"}
                    and not is_numeric_column(col_info)
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
