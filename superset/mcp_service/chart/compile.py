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
Shared compile/validation helpers for MCP chart-generating tools.

Two tiers are exposed:

* **Tier 1 — schema validation** (``DatasetValidator.validate_against_dataset``):
  cheap, no SQL execution, catches references to columns or metrics that do
  not exist in the dataset and returns fuzzy-match suggestions.
* **Tier 2 — compile check** (``_compile_chart``): runs a small (``row_limit=2``)
  ``ChartDataCommand`` against the underlying database to surface anything Tier
  1 cannot catch (incompatible aggregates, virtual-dataset SQL bugs, etc.).

``validate_and_compile`` glues both together so each MCP tool can opt into the
tier(s) appropriate for its SLA.
"""

from __future__ import annotations

import logging
from copy import deepcopy
from dataclasses import dataclass, field
from typing import Any, Dict, List, Literal

from sqlalchemy.exc import SQLAlchemyError

from superset.commands.exceptions import CommandException
from superset.mcp_service.chart.chart_helpers import canonicalize_operation_form_data
from superset.mcp_service.chart.query_result import (
    first_query_data,
    normalize_chart_query_result,
    query_result_failure,
    temporal_json_numbers,
)
from superset.mcp_service.chart.schemas import ChartError
from superset.mcp_service.chart.validation.dataset_validator import (
    AmbiguousDatasetReferenceError,
    build_dataset_context_from_orm,
    DatasetValidator,
    resolve_dataset_column,
    resolve_dataset_reference,
)
from superset.mcp_service.common.error_schemas import (
    ChartGenerationError,
    ColumnSuggestion,
    DatasetContext,
)
from superset.mcp_service.constants import CONNECTION_ERROR_TYPES

logger = logging.getLogger(__name__)


@dataclass
class CompileResult:
    """Result of a chart validate-and-compile check.

    ``error_obj`` carries the structured ``ChartGenerationError`` (with
    suggestions, dataset context, etc.) that callers should embed in their
    response envelope so LLM clients can self-correct. ``error`` retains the
    plain-string form for backwards compatibility with existing call sites.
    """

    success: bool
    error: str | None = None
    error_code: str | None = None
    tier: Literal["validation", "compile"] | None = None
    error_obj: ChartGenerationError | None = None
    warnings: List[str] = field(default_factory=list)
    row_count: int | None = None


def _compile_chart(  # noqa: C901
    form_data: Dict[str, Any],
    dataset_id: int,
) -> CompileResult:
    """Execute a bounded chart query to verify its base query and result contract.

    Builds a ``QueryContext`` from *form_data* and runs it through
    ``ChartDataCommand``.  A small ``row_limit`` is used so the check is
    fast — we only need to know the query compiles and returns data, not
    fetch the full result set. Rolling windows and forecasts are skipped because
    their history requirements cannot be met by this sample; full data and
    preview queries retain those analytics.

    Returns a :class:`CompileResult` with ``success=True`` when the
    query executes cleanly.
    """
    from superset.mcp_service.chart.registry import plugin_for_viz_type

    plugin = plugin_for_viz_type(form_data.get("viz_type"))
    temporal_state_error = (
        plugin.validate_form_data_state(form_data) if plugin is not None else None
    )
    if temporal_state_error is not None:
        return CompileResult(
            success=False,
            error=temporal_state_error.details or temporal_state_error.message,
            error_code="CHART_VALIDATION_FAILED",
            tier="validation",
            error_obj=temporal_state_error,
        )

    from superset.charts.data.form_data import set_query_context_form_data
    from superset.commands.chart.data.get_data_command import ChartDataCommand
    from superset.commands.chart.exceptions import (
        ChartDataCacheLoadError,
        ChartDataQueryFailedError,
    )
    from superset.mcp_service.chart.chart_helpers import (
        build_query_context_from_form_data,
    )
    from superset.mcp_service.chart.plugin import BaseChartPlugin

    try:
        query_form_data = canonicalize_operation_form_data(
            deepcopy(form_data),
            datasource_id=dataset_id,
        )
        query_form_data["datasource"] = f"{dataset_id}__table"
        # Rolling windows and forecasts require history the bounded compile
        # sample cannot supply. Keep the saved controls intact for full queries.
        for key in ("rolling_type", "rolling_type_b", "forecastEnabled"):
            query_form_data.pop(key, None)
        query_context = build_query_context_from_form_data(
            query_form_data,
            row_limit=plugin.compile_row_limit(form_data) if plugin else 2,
            force=False,
        )
        try:
            set_query_context_form_data(query_context, dataset_id, "table")
        except TypeError:
            logger.debug("Query-context form data could not be serialized")

        command = ChartDataCommand(query_context)
        command.validate()
        result = command.run()

        if query_failure := query_result_failure(
            result,
            temporal_json_numbers=temporal_json_numbers(form_data.get("viz_type")),
        ):
            error_str = query_failure.error
            return CompileResult(
                success=False,
                error=error_str,
                error_code="CHART_COMPILE_FAILED",
                tier="compile",
                error_obj=_build_compile_error(error_str),
            )
        result = normalize_chart_query_result(result, form_data)
        if isinstance(result, ChartError):
            result_contract = plugin or BaseChartPlugin
            error_code = result_contract.invalid_result_error_code
            message = result_contract.invalid_result_message
            return CompileResult(
                success=False,
                error=result.error,
                error_code=error_code,
                tier="compile",
                error_obj=ChartGenerationError(
                    error_type=result.error_type,
                    message=message,
                    details=result.error,
                    suggestions=list(
                        plugin.invalid_result_suggestions
                        if plugin
                        else BaseChartPlugin.invalid_result_suggestions
                    ),
                    error_code=error_code,
                ),
            )

        data, result_error = first_query_data(result)
        if result_error is not None:
            return CompileResult(
                success=False,
                error=result_error.error,
                error_code="CHART_COMPILE_FAILED",
                tier="compile",
                error_obj=_build_compile_error(result_error.error),
            )
        assert data is not None

        warnings: List[str] = []
        row_count = 0
        for query in result["queries"]:
            query_data = query.get("data")
            if not isinstance(query_data, list):
                error_str = "Chart query result data is not an array of rows."
                return CompileResult(
                    success=False,
                    error=error_str,
                    error_code="CHART_COMPILE_FAILED",
                    tier="compile",
                    error_obj=_build_compile_error(error_str),
                )
            row_count += len(query_data)

        return CompileResult(success=True, warnings=warnings, row_count=row_count)
    except (ChartDataQueryFailedError, ChartDataCacheLoadError) as exc:
        if _classify_as_database_error(exc, dataset_id):
            logger.warning(
                "Database connection error during chart compile check: %s: %s",
                type(exc).__name__,
                str(exc),
            )
            return CompileResult(
                success=False,
                error=f"Database connection error: {exc}",
                error_code="CHART_COMPILE_FAILED",
                tier="compile",
                error_obj=_build_database_error(str(exc)),
            )
        return CompileResult(
            success=False,
            error=str(exc),
            error_code="CHART_COMPILE_FAILED",
            tier="compile",
            error_obj=_build_compile_error(str(exc)),
        )
    except (CommandException, ValueError, KeyError) as exc:
        return CompileResult(
            success=False,
            error=str(exc),
            error_code="CHART_COMPILE_FAILED",
            tier="compile",
            error_obj=_build_compile_error(str(exc)),
        )
    except SQLAlchemyError as exc:
        logger.warning(
            "Database connection error during chart compile check: %s: %s",
            type(exc).__name__,
            str(exc),
        )
        return CompileResult(
            success=False,
            error=f"Database connection error: {exc}",
            error_code="CHART_COMPILE_FAILED",
            tier="compile",
            error_obj=_build_database_error(str(exc)),
        )


def _adhoc_filter_column_valid(
    column: str, clause: str, dataset_context: DatasetContext
) -> bool:
    """Return True if *column* is a valid reference for this filter clause.

    WHERE filters must reference a physical column; HAVING filters may also
    reference a saved metric because Superset resolves metric names there.
    """
    if clause == "HAVING":
        return DatasetValidator._column_exists(column, dataset_context)
    return (
        resolve_dataset_reference(
            column,
            (col["name"] for col in dataset_context.available_columns),
            "physical column",
        )
        is not None
    )


def _validate_adhoc_filter_columns(  # noqa: C901
    form_data: Dict[str, Any], dataset_context: DatasetContext
) -> ChartGenerationError | None:
    """Tier-1 check for adhoc-filter column references stored in ``form_data``.

    ``DatasetValidator._extract_column_references`` walks the typed
    ``ChartConfig`` and only sees ``config.filters``. Tools like
    ``update_chart_preview`` and ``update_chart`` (preview path) also merge
    *previously cached* ``adhoc_filters`` into ``form_data`` that aren't
    represented on the new config. Secondary-query filters receive the same
    check — otherwise these filters would bypass validation
    and surface only when Explore tries to run the query.
    """
    from superset.mcp_service.chart.registry import plugin_for_viz_type

    adhoc_filters = _active_adhoc_filters(form_data.get("adhoc_filters") or [])
    plugin = plugin_for_viz_type(form_data.get("viz_type"))
    secondary = plugin.secondary_query_form_data(form_data) if plugin else None
    if secondary is not None:
        adhoc_filters.extend(
            _active_adhoc_filters(secondary.get("adhoc_filters") or [])
        )
    # Keep the clause for reference validation; SIMPLE HAVING is unsupported,
    # so saved metrics must not be offered as corrective suggestions.
    invalid: list[tuple[str, str]] = []
    has_simple_having = False
    for f in adhoc_filters:
        # SIMPLE filters expose the column via "subject"; SQL-expression
        # filters carry a free-form ``sqlExpression`` we can't safely parse,
        # so skip those.
        if f.get("expressionType") and f.get("expressionType") != "SIMPLE":
            continue
        clause = f.get("clause", "WHERE")
        if not isinstance(clause, str) or clause not in {"WHERE", "HAVING"}:
            return ChartGenerationError(
                error_type="invalid_filter_clause",
                message="SIMPLE filter clause must be 'WHERE' or 'HAVING'",
                details=(
                    f"A SIMPLE filter has malformed clause {clause!r}; the clause "
                    "is never coerced or defaulted when explicitly set."
                ),
                suggestions=["Use clause='WHERE'"],
                error_code="INVALID_FILTER_CLAUSE",
            )
        has_simple_having = has_simple_having or clause == "HAVING"
        column = f.get("subject") or f.get("col")
        if not column or not isinstance(column, str):
            continue
        try:
            if not _adhoc_filter_column_valid(column, clause, dataset_context):
                invalid.append((column, clause))
        except AmbiguousDatasetReferenceError as ex:
            return DatasetValidator._build_ambiguous_reference_error(ex)

    if not invalid:
        if has_simple_having:
            return ChartGenerationError(
                error_type="unsupported_filter_clause",
                message="SIMPLE HAVING filters are unsupported",
                details=(
                    "The shared query mapper cannot preserve SIMPLE HAVING "
                    "semantics and will not coerce the filter to WHERE."
                ),
                suggestions=["Use a supported WHERE filter"],
                error_code="UNSUPPORTED_FILTER_CLAUSE",
            )
        return None

    suggestions: List[str] = []
    for column, _ in invalid:
        for suggestion in DatasetValidator._get_column_suggestions(
            column, dataset_context, include_metrics=False
        ):
            name = (
                suggestion.name
                if isinstance(suggestion, ColumnSuggestion)
                else str(suggestion)
            )
            if name and name not in suggestions:
                suggestions.append(name)

    bad = ", ".join(sorted({column for column, _ in invalid}))
    return ChartGenerationError(
        error_type="invalid_column",
        message=(f"Filter references column(s) not in dataset: {bad}"),
        details=(
            "Adhoc filter columns must exist on the dataset. "
            "If these filters were preserved from a previous chart preview, "
            "pass an explicit 'filters' list on the new config; use "
            "'filters': [] to clear them."
        ),
        suggestions=suggestions,
        error_code="CHART_VALIDATION_FAILED",
    )


def _is_inert_adhoc_filter(filter_: dict[str, Any]) -> bool:
    """Whether a saved filter is Superset's non-filtering placeholder."""
    operator = filter_.get("operator", filter_.get("op"))
    comparator = filter_.get("comparator", filter_.get("val"))
    return (
        isinstance(operator, str)
        and operator.casefold() == "temporal_range"
        and isinstance(comparator, str)
        and comparator.casefold() == "no filter"
    )


def _active_adhoc_filters(filters: list[Any]) -> list[dict[str, Any]]:
    """Return structurally valid filters that can produce a predicate."""
    return [
        filter_
        for filter_ in filters
        if isinstance(filter_, dict) and not _is_inert_adhoc_filter(filter_)
    ]


def _classify_as_database_error(exc: BaseException, dataset_id: int) -> bool:
    """Use the dataset's DB engine spec to classify the error.

    Walks the ``__cause__`` chain for direct ``SQLAlchemyError`` instances,
    then falls back to the engine spec's ``extract_errors`` regex patterns —
    the same classification the Superset UI uses.
    """
    # Direct SQLAlchemy errors (unwrapped or in cause chain)
    current: BaseException | None = exc
    while current is not None:
        if isinstance(current, SQLAlchemyError):
            return True
        current = current.__cause__

    # Use the dataset's engine spec to classify (same as the UI)
    try:
        from superset.daos.dataset import DatasetDAO

        dataset = DatasetDAO.find_by_id(dataset_id)
        if dataset and dataset.database and isinstance(exc, Exception):
            errors = dataset.database.db_engine_spec.extract_errors(exc)
            return any(e.error_type in CONNECTION_ERROR_TYPES for e in errors)
    except Exception:  # pylint: disable=broad-except
        logger.debug(
            "Failed to classify error via engine spec for dataset %s: %s",
            dataset_id,
            exc,
        )

    return False


def _build_database_error(message: str) -> ChartGenerationError:
    """Wrap a database connection failure in the structured response envelope."""
    return ChartGenerationError(
        error_type="database_connection_error",
        message="Unable to connect to the database.",
        details=message or "",
        suggestions=[
            "Check that the database is online and reachable",
            "Verify database credentials and connection settings",
            "Contact your administrator if the issue persists",
        ],
        error_code="DATABASE_CONNECTION_ERROR",
    )


def _build_compile_error(message: str) -> ChartGenerationError:
    """Wrap a raw compile-failure string in the structured response envelope."""
    return ChartGenerationError(
        error_type="compile_error",
        message="Chart query failed to execute. The chart was not saved.",
        details=message or "",
        suggestions=[
            "Check that all columns exist in the dataset",
            "Verify aggregate functions are compatible with column types",
            "Ensure filters reference valid columns",
            "Try simplifying the chart configuration",
        ],
        error_code="CHART_COMPILE_FAILED",
    )


def _native_validation_error(role: str, reference: str) -> ChartGenerationError:
    """Build a fail-closed error for an incompatible native chart reference."""
    return ChartGenerationError(
        error_type="invalid_native_chart_reference",
        message=f"Native chart {role} {reference!r} is incompatible with the dataset",
        details=(
            "The rebound form data must retain its exact query roles on the target "
            "dataset; no column or saved-metric reference may be guessed or dropped."
        ),
        suggestions=[
            "Choose a target dataset with a compatible schema",
            "Provide a complete typed chart config using target-dataset fields",
        ],
        error_code="CHART_VALIDATION_FAILED",
    )


def _native_column_name(value: Any) -> str | None:
    """Extract a physical QueryFormColumn reference, or None for SQL columns."""
    if isinstance(value, str):
        return value
    if not isinstance(value, dict):
        return None
    if value.get("expressionType") == "SQL":
        reference = value.get("sqlExpression")
        if value.get("isColumnReference") is True and isinstance(reference, str):
            return reference or None
        return None
    name = value.get("column_name") or value.get("columnName")
    return name if isinstance(name, str) and name else None


def _native_column_label(value: Any) -> str | None:
    """Return the frontend label for a native column without custom hooks."""
    if isinstance(value, str):
        return value
    if not isinstance(value, dict):
        return None
    for key in ("label", "sqlExpression", "column_name", "columnName"):
        candidate = value.get(key)
        if isinstance(candidate, str) and candidate:
            return candidate
    return None


def _native_metric_ref(value: Any) -> tuple[str, str] | None:
    """Return ``(saved_metric|column, name)`` for a native query metric."""
    if isinstance(value, str):
        return "saved_metric", value
    if not isinstance(value, dict):
        return None
    if value.get("expressionType") == "SQL":
        return None
    if value.get("expressionType") != "SIMPLE":
        # Match QueryObject's guarded legacy saved-metric normalization.
        if not ({"sqlExpression", "aggregate", "column"} & value.keys()):
            label = value.get("label")
            if isinstance(label, str) and label:
                return "saved_metric", label
        return None
    column = value.get("column")
    name = (
        column.get("column_name") or column.get("columnName")
        if isinstance(column, dict)
        else None
    )
    return ("column", name) if isinstance(name, str) and name else None


def _native_reference_error(  # noqa: C901
    form_data: Dict[str, Any],
    dataset_context: DatasetContext,
    dataset_id: int,
    *,
    strict_all_form_refs: bool,
) -> ChartGenerationError | None:
    """Validate the canonical native QueryObjects against a rebound dataset."""
    from superset.mcp_service.chart.chart_helpers import (
        build_query_dicts_from_form_data,
    )
    from superset.mcp_service.chart.response_preflight import (
        bounded_exception_message,
    )

    try:
        queries = build_query_dicts_from_form_data(
            deepcopy(form_data), dataset_id, "table"
        )
    except (KeyError, TypeError, ValueError) as ex:
        return _native_validation_error("query contract", bounded_exception_message(ex))

    saved_metrics = [item["name"] for item in dataset_context.available_metrics]

    def column_error(value: Any, role: str) -> ChartGenerationError | None:
        name = _native_column_name(value)
        if name is None:
            if isinstance(value, dict) and value.get("expressionType") == "SQL":
                return None
            return _native_validation_error(role, repr(value)[:200])
        try:
            if resolve_dataset_column(name, dataset_context) is not None:
                return None
        except ValueError:
            pass
        return _native_validation_error(role, name)

    def metric_error(value: Any, role: str) -> ChartGenerationError | None:
        """Validate one raw or generated metric reference against the target."""
        ref = _native_metric_ref(value)
        if ref is None:
            if isinstance(value, dict) and value.get("expressionType") == "SQL":
                return None
            return _native_validation_error(role, repr(value)[:200])
        kind, name = ref
        if kind == "saved_metric":
            # Native lookup selects an exact name unambiguously; only a
            # case-folded reference has to be unique.
            matches = (
                [name]
                if name in saved_metrics
                else [
                    item for item in saved_metrics if item.casefold() == name.casefold()
                ]
            )
            if len(set(matches)) != 1:
                saved_role = f"{role.removesuffix(' metric')} saved metric"
                return _native_validation_error(saved_role, name)
            return None
        return column_error(name, f"{role} column")

    for filter_ in form_data.get("adhoc_filters") or []:
        if not isinstance(filter_, dict) or filter_.get("expressionType") != "SIMPLE":
            continue
        if not strict_all_form_refs and _is_inert_adhoc_filter(filter_):
            continue
        subject = filter_.get("subject")
        clause = str(filter_.get("clause") or "WHERE").upper()
        if clause == "HAVING" and isinstance(subject, str):
            metric_matches = (
                [subject]
                if subject in saved_metrics
                else [
                    name
                    for name in saved_metrics
                    if name.casefold() == subject.casefold()
                ]
            )
            if len(metric_matches) == 1:
                continue
        if subject is not None and (
            error := column_error(subject, "form-data filter column")
        ):
            return error
        if filter_.get("operator") == "TEMPORAL_RANGE" and isinstance(subject, str):
            try:
                temporal = resolve_dataset_column(subject, dataset_context)
            except ValueError:
                temporal = None
            if temporal is not None and not temporal.get("is_temporal", False):
                return _native_validation_error("temporal filter column", subject)

    # temporal_columns_lookup describes the entire datasource, not selected
    # roles. The physical form/query column checks validate selected references.

    for query_index, query in enumerate(queries, 1):
        metric_labels: set[str] = set()
        for column in query.get("columns") or []:
            if error := column_error(column, f"query {query_index} column"):
                return error
        for column in query.get("series_columns") or []:
            if error := column_error(column, f"query {query_index} series column"):
                return error
        for column in query.get("groupby") or []:
            if error := column_error(column, f"query {query_index} groupby column"):
                return error
        selected_column_labels = {
            label
            for column in query.get("columns") or []
            if (label := _native_column_label(column)) is not None
        }
        adhoc_column_labels = {
            label
            for column in query.get("columns") or []
            if isinstance(column, dict)
            and isinstance(label := column.get("label"), str)
            and label
        }
        for level in query.get("grouping_sets") or []:
            for column in level:
                # Grouping sets reference selected logical outputs, including
                # Custom SQL labels. Their source columns were checked above.
                if isinstance(column, str) and column in selected_column_labels:
                    continue
                if error := column_error(
                    column, f"query {query_index} grouping-set column"
                ):
                    return error

        metrics = query.get("metrics") or []
        for metric in metrics:
            if label := _metric_label_for_validation(metric):
                metric_labels.add(label)
            if error := metric_error(metric, f"query {query_index} metric"):
                return error

        granularity = query.get("granularity")
        if granularity:
            if error := column_error(granularity, "temporal column"):
                return error
            try:
                temporal = resolve_dataset_column(granularity, dataset_context)
            except ValueError:
                temporal = None
            if (
                (query.get("extras") or {}).get("time_grain_sqla")
                and temporal is not None
                and not temporal.get("is_temporal", False)
            ):
                return _native_validation_error("temporal column", granularity)

        for filter_ in query.get("filters") or []:
            if not isinstance(filter_, dict):
                return _native_validation_error("filter", repr(filter_)[:200])
            column = filter_.get("col")
            if isinstance(column, str) and column in metric_labels:
                continue
            if isinstance(column, str) and any(
                name.casefold() == column.casefold() for name in saved_metrics
            ):
                continue
            if column is not None and (
                error := column_error(column, f"query {query_index} filter column")
            ):
                return error

        for order in query.get("orderby") or []:
            if not isinstance(order, (list, tuple)) or len(order) != 2:
                return _native_validation_error("ordering", repr(order)[:200])
            target = order[0]
            target_label = _metric_label_for_validation(target)
            if target in metrics or (target_label and target_label in metric_labels):
                continue
            if isinstance(target, str) and target in metric_labels:
                continue
            # get_sqla_query resolves a string sort against labelled adhoc
            # (Custom SQL) query columns before physical columns.
            if isinstance(target, str) and target in adhoc_column_labels:
                continue
            # Native ordering can use a metric that is not displayed. Resolve
            # saved names with the same exact/case-folded rules as other metrics,
            # and validate adhoc metric columns rather than their output labels.
            if (
                isinstance(target, str)
                and any(name.casefold() == target.casefold() for name in saved_metrics)
            ) or (isinstance(target, dict) and _native_metric_ref(target) is not None):
                if error := metric_error(
                    target, f"query {query_index} ordering metric"
                ):
                    return error
            elif error := column_error(target, f"query {query_index} ordering column"):
                return error
    return None


def _metric_label_for_validation(metric: Any) -> str | None:
    """Resolve a native metric output label without executing custom code."""
    if isinstance(metric, str):
        return metric
    if not isinstance(metric, dict):
        return None
    if isinstance(metric.get("label"), str) and metric["label"]:
        return metric["label"]
    ref = _native_metric_ref(metric)
    if ref and ref[0] == "column" and isinstance(metric.get("aggregate"), str):
        return f"{metric['aggregate']}({ref[1]})"
    expression = metric.get("sqlExpression")
    return expression if isinstance(expression, str) and expression else None


def validate_and_compile(  # noqa: C901
    config: Any,
    form_data: Dict[str, Any],
    dataset: Any,
    *,
    run_compile_check: bool = True,
) -> CompileResult:
    """Run schema validation (Tier 1) and optionally a compile check (Tier 2).

    ``dataset`` must be an already-fetched ORM dataset; this avoids a second
    ``DatasetDAO.find_by_id`` round trip inside the validator.

    ``run_compile_check`` lets fast-path tools (``generate_explore_link``,
    ``update_chart_preview``) skip the live DB query while still rejecting
    obviously bad column references with fuzzy-match suggestions.

    Returns a :class:`CompileResult`. On failure, ``error_obj`` carries the
    structured :class:`ChartGenerationError` (with ``suggestions``) that the
    caller should embed in its response envelope so LLM clients can
    self-correct.
    """
    if dataset is None:
        return CompileResult(
            success=False,
            error="Dataset not provided to validate_and_compile",
            error_code="DATASET_NOT_FOUND",
            tier="validation",
        )

    dataset_context = build_dataset_context_from_orm(dataset)

    is_valid, error = DatasetValidator.validate_against_dataset(
        config, dataset.id, dataset_context=dataset_context
    )
    if not is_valid:
        details = ""
        if error is not None:
            details = error.details or error.message
            if error.error_code is None:
                error.error_code = "CHART_VALIDATION_FAILED"
        return CompileResult(
            success=False,
            error=details,
            error_code="CHART_VALIDATION_FAILED",
            tier="validation",
            error_obj=error,
        )

    # Validate adhoc-filter columns living only in form_data (e.g. filters
    # preserved from a previously cached preview). The typed config-level
    # validator above doesn't see those.
    if dataset_context is not None:
        filter_error = _validate_adhoc_filter_columns(form_data, dataset_context)
        if filter_error is not None:
            return CompileResult(
                success=False,
                error=filter_error.details or filter_error.message,
                error_code="CHART_VALIDATION_FAILED",
                tier="validation",
                error_obj=filter_error,
            )
        from superset.mcp_service.chart.registry import plugin_for_viz_type

        state_plugin = plugin_for_viz_type(form_data.get("viz_type"))
        temporal_state_error = (
            state_plugin.validate_form_data_state(form_data, dataset_context)
            if state_plugin is not None
            else None
        )
        if temporal_state_error is not None:
            return CompileResult(
                success=False,
                error=temporal_state_error.details or temporal_state_error.message,
                error_code="CHART_VALIDATION_FAILED",
                tier="validation",
                error_obj=temporal_state_error,
            )
        if state_plugin is not None and state_plugin.validates_native_references:
            native_error = _native_reference_error(
                form_data,
                dataset_context,
                dataset.id,
                strict_all_form_refs=config is None,
            )
            if native_error is not None:
                return CompileResult(
                    success=False,
                    error=native_error.details or native_error.message,
                    error_code="CHART_VALIDATION_FAILED",
                    tier="validation",
                    error_obj=native_error,
                )

    if not run_compile_check:
        return CompileResult(success=True)

    return _compile_chart(form_data, dataset.id)
