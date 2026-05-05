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
from dataclasses import dataclass, field
from typing import Any, Dict, List, Literal

from superset.commands.exceptions import CommandException
from superset.mcp_service.chart.validation.dataset_validator import DatasetValidator
from superset.mcp_service.common.error_schemas import (
    ChartGenerationError,
    ColumnSuggestion,
    DatasetContext,
)

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


def build_dataset_context_from_orm(dataset: Any) -> DatasetContext | None:
    """Construct a ``DatasetContext`` from an already-fetched ORM dataset.

    Mirrors :py:meth:`DatasetValidator._get_dataset_context` but skips the
    ``DatasetDAO.find_by_id`` round trip. Callers that have already loaded
    the dataset (for permission checks, etc.) should use this instead.
    """
    if dataset is None:
        return None

    columns: List[Dict[str, Any]] = []
    for col in getattr(dataset, "columns", []) or []:
        columns.append(
            {
                "name": col.column_name,
                "type": str(col.type) if col.type else "UNKNOWN",
                "is_temporal": getattr(col, "is_temporal", False),
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

    database = getattr(dataset, "database", None)
    # ``DatasetContext.database_name`` is typed as required ``str``; default to
    # an empty string when the relationship isn't loaded so we don't blow up
    # Pydantic validation. The field is purely informational in error messages.
    database_name = getattr(database, "database_name", None) or ""
    return DatasetContext(
        id=dataset.id,
        table_name=dataset.table_name,
        schema=dataset.schema,
        database_name=database_name,
        available_columns=columns,
        available_metrics=metrics,
    )


def _compile_chart(
    form_data: Dict[str, Any],
    dataset_id: int,
) -> CompileResult:
    """Execute the chart's query to verify it renders without errors.

    Builds a ``QueryContext`` from *form_data* and runs it through
    ``ChartDataCommand``.  A small ``row_limit`` is used so the check is
    fast — we only need to know the query compiles and returns data, not
    fetch the full result set.

    Returns a :class:`CompileResult` with ``success=True`` when the
    query executes cleanly.
    """
    from superset.commands.chart.data.get_data_command import ChartDataCommand
    from superset.commands.chart.exceptions import (
        ChartDataCacheLoadError,
        ChartDataQueryFailedError,
    )
    from superset.common.query_context_factory import QueryContextFactory
    from superset.mcp_service.chart.chart_utils import adhoc_filters_to_query_filters
    from superset.mcp_service.chart.preview_utils import _build_query_columns

    try:
        columns = _build_query_columns(form_data)
        query_filters = adhoc_filters_to_query_filters(
            form_data.get("adhoc_filters", [])
        )

        # Big Number charts use singular "metric" instead of "metrics"
        metrics = form_data.get("metrics", [])
        if not metrics and form_data.get("metric"):
            metrics = [form_data["metric"]]

        # Big Number with trendline uses granularity_sqla as the time column
        if not columns and form_data.get("granularity_sqla"):
            columns = [form_data["granularity_sqla"]]

        factory = QueryContextFactory()
        query_context = factory.create(
            datasource={"id": dataset_id, "type": "table"},
            queries=[
                {
                    "columns": columns,
                    "metrics": metrics,
                    "orderby": form_data.get("orderby", []),
                    "row_limit": 2,
                    "filters": query_filters,
                    "time_range": form_data.get("time_range", "No filter"),
                }
            ],
            form_data=form_data,
        )

        command = ChartDataCommand(query_context)
        command.validate()
        result = command.run()

        warnings: List[str] = []
        row_count = 0
        for query in result.get("queries", []):
            if query.get("error"):
                error_str = str(query["error"])
                return CompileResult(
                    success=False,
                    error=error_str,
                    error_code="CHART_COMPILE_FAILED",
                    tier="compile",
                    error_obj=_build_compile_error(error_str),
                )
            row_count += len(query.get("data", []))

        return CompileResult(success=True, warnings=warnings, row_count=row_count)
    except (ChartDataQueryFailedError, ChartDataCacheLoadError) as exc:
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


def _adhoc_filter_column_valid(
    column: str, clause: str, dataset_context: DatasetContext
) -> bool:
    """Return True if *column* is a valid reference for this filter clause.

    WHERE filters must reference a physical column; HAVING filters may also
    reference a saved metric because Superset resolves metric names there.
    """
    if clause == "HAVING":
        return DatasetValidator._column_exists(column, dataset_context)
    return any(
        col["name"].lower() == column.lower()
        for col in dataset_context.available_columns
    )


def _validate_adhoc_filter_columns(
    form_data: Dict[str, Any], dataset_context: DatasetContext
) -> ChartGenerationError | None:
    """Tier-1 check for adhoc-filter column references stored in ``form_data``.

    ``DatasetValidator._extract_column_references`` walks the typed
    ``ChartConfig`` and only sees ``config.filters``. Tools like
    ``update_chart_preview`` and ``update_chart`` (preview path) also merge
    *previously cached* ``adhoc_filters`` into ``form_data`` that aren't
    represented on the new config — those would otherwise bypass validation
    and surface only when Explore tries to run the query.
    """
    adhoc_filters = form_data.get("adhoc_filters") or []
    invalid: List[str] = []
    for f in adhoc_filters:
        if not isinstance(f, dict):
            continue
        # SIMPLE filters expose the column via "subject"; SQL-expression
        # filters carry a free-form ``sqlExpression`` we can't safely parse,
        # so skip those.
        if f.get("expressionType") and f.get("expressionType") != "SIMPLE":
            continue
        column = f.get("subject") or f.get("col")
        if not column or not isinstance(column, str):
            continue
        clause = f.get("clause", "WHERE").upper()
        if not _adhoc_filter_column_valid(column, clause, dataset_context):
            invalid.append(column)

    if not invalid:
        return None

    suggestions: List[str] = []
    for column in invalid:
        for suggestion in DatasetValidator._get_column_suggestions(
            column, dataset_context
        ):
            name = (
                suggestion.name
                if isinstance(suggestion, ColumnSuggestion)
                else str(suggestion)
            )
            if name and name not in suggestions:
                suggestions.append(name)

    bad = ", ".join(sorted(set(invalid)))
    return ChartGenerationError(
        error_type="invalid_column",
        message=(f"Filter references column(s) not in dataset: {bad}"),
        details=(
            "Adhoc filter columns must exist on the dataset. "
            "If these filters were preserved from a previous chart preview, "
            "remove them or pass an explicit ``filters`` list on the new config."
        ),
        suggestions=suggestions,
        error_code="CHART_VALIDATION_FAILED",
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


def validate_and_compile(
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

    if not run_compile_check:
        return CompileResult(success=True)

    return _compile_chart(form_data, dataset.id)
