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
"""Plan and size dashboard Excel exports served in the HTTP response."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from celery.exceptions import SoftTimeLimitExceeded
from flask import current_app

from superset.dashboards.excel_export.layout import get_charts_in_layout_order
from superset.dashboards.excel_export.workbook import (
    resolve_query_context,
    ResolvedQueryContexts,
)
from superset.sql.parse import has_aggregate
from superset.utils.core import AdhocMetricExpressionType

logger = logging.getLogger(__name__)

# Post-processing operations that return at most as many rows as they receive.
# Any other step is unbounded for planning: ``resample`` fills every period in
# the range, ``prophet`` appends forecast periods, and operations registered
# through ``EXTRA_PANDAS_POSTPROCESSING_OPS`` are unknown.
_ROW_PRESERVING_OPERATIONS = frozenset(
    {
        "aggregate",
        "boxplot",
        "compare",
        "contribution",
        "cum",
        "diff",
        "flatten",
        "geodetic_parse",
        "geohash_decode",
        "geohash_encode",
        "histogram",
        "pivot",
        "rank",
        "rename",
        "rolling",
        "select",
        "sort",
    }
)


@dataclass(frozen=True)
class InlineExportPlan:
    """Queries planned for a direct download and their row budget."""

    #: Resolved query contexts by chart id. ``None`` marks a skipped chart.
    query_contexts: ResolvedQueryContexts
    #: Combined row limit, or ``None`` when any query has no finite limit.
    requested_rows: int | None
    #: Configured limit for direct downloads.
    max_rows: int

    @property
    def fits_row_budget(self) -> bool:
        """Return whether the export can run during the request."""
        return self.requested_rows is not None and self.requested_rows <= self.max_rows


@dataclass(frozen=True)
class _Dataset:
    """What a chart's dataset contributes to sizing its queries."""

    #: SQL of every saved metric, by metric name.
    metric_expressions: dict[str, str]
    #: Database backend, so metric SQL is parsed in its own dialect.
    engine: str


def _dataset_of(chart: Any) -> _Dataset:
    """Describe the chart's dataset, falling back to an empty one."""
    try:
        datasource = chart.datasource
        metrics = getattr(datasource, "metrics", None) or []
        database = getattr(datasource, "database", None)
        return _Dataset(
            metric_expressions={
                metric.metric_name: metric.expression
                for metric in metrics
                if metric.expression
            },
            engine=getattr(database, "backend", None) or "base",
        )
    except Exception:  # pylint: disable=broad-except
        # Without the dataset no metric can be proven to aggregate, which only
        # costs the query its row limit instead of a single row.
        logger.warning(
            "Could not read the dataset of chart %s while planning Excel export",
            getattr(chart, "id", None),
            exc_info=True,
        )
        return _Dataset(metric_expressions={}, engine="base")


def _aggregates(metric: Any, dataset: _Dataset) -> bool:
    """Return whether a metric provably collapses the rows it reads."""
    if isinstance(metric, str):
        expression = dataset.metric_expressions.get(metric)
    elif not isinstance(metric, dict):
        return False
    elif metric.get("expressionType") == AdhocMetricExpressionType.SIMPLE:
        # A simple metric is the column wrapped in the requested aggregation.
        return bool(metric.get("aggregate"))
    else:
        expression = metric.get("sqlExpression")
    if not isinstance(expression, str):
        return False
    # Custom SQL need not aggregate: `amount` is a valid metric expression and
    # returns one row per source row, so an unprovable expression is not one.
    return has_aggregate(expression, dataset.engine, fail_open=False)


def _returns_single_row(query: dict[str, Any], chart: Any) -> bool:
    """Return whether the query provably returns exactly one aggregate row."""
    if (
        query.get("columns") != []
        # ``QueryObject`` promotes the deprecated ``groupby`` into ``columns``.
        or query.get("groupby")
        or query.get("is_timeseries")
    ):
        # Anything grouped returns one row per group, bounded by the row limit.
        return False
    metrics = query.get("metrics")
    if not isinstance(metrics, list) or not metrics:
        return False
    dataset = _dataset_of(chart)
    return all(_aggregates(metric, dataset) for metric in metrics)


def _schema_row_limit(value: Any) -> int | None:
    """Coerce a row limit the way ``ChartDataQueryContextSchema`` does.

    Its ``row_limit`` is a non-strict ``fields.Integer``, so the execution path
    accepts every value ``int()`` converts -- ``"1000"`` and ``1000.0`` included.
    Planning has to read those the same way or it rejects an export that would
    have run. ``None`` marks a limit the schema would refuse, which leaves the
    query unbounded as far as planning can tell.
    """
    try:
        row_limit = int(value)
    except (TypeError, ValueError):
        return None
    # ``Range(min=0)`` rejects a negative limit.
    return row_limit if row_limit >= 0 else None


def _post_processing_adds_no_rows(query: dict[str, Any]) -> bool:
    """Return whether every post-processing step keeps the query's row bound."""
    steps = query.get("post_processing") or []
    if not isinstance(steps, list):
        return False
    # ``QueryObject`` drops empty steps before running the rest.
    return all(
        isinstance(step, dict) and step.get("operation") in _ROW_PRESERVING_OPERATIONS
        for step in steps
        if step
    )


def _finite_row_limit(query: Any, chart: Any) -> int | None:
    """Return a safe upper bound for one query's result rows."""
    if not isinstance(query, dict):
        return None
    # Grouping sets do not apply row_limit and may fan out into several queries.
    if query.get("grouping_sets"):
        return None
    # Checked before the single-row case: resampling one row can still fill
    # every period of the time range.
    if not _post_processing_adds_no_rows(query):
        return None
    if _returns_single_row(query, chart):
        return 1
    # An omitted, null or zero limit runs under the configured default.
    default_row_limit: int = current_app.config["ROW_LIMIT"]
    if (raw_row_limit := query.get("row_limit")) is None:
        return default_row_limit
    row_limit = _schema_row_limit(raw_row_limit)
    if row_limit is None:
        return None
    return row_limit or default_row_limit


def _row_total(
    query_contexts: ResolvedQueryContexts, charts: dict[int, Any]
) -> int | None:
    """Rows every resolved query may return, or ``None`` if any is unbounded."""
    total = 0
    for chart_id, query_context in query_contexts.items():
        if query_context is None:
            # Skipped charts do not add to the row budget.
            continue
        for query in query_context["queries"]:
            row_limit = _finite_row_limit(query, charts[chart_id])
            if row_limit is None:
                return None
            total += row_limit
    return total


def plan_inline_export(dashboard: Any) -> InlineExportPlan:
    """Resolve a dashboard's queries and calculate its direct-download size."""
    query_contexts: ResolvedQueryContexts = {}
    charts: dict[int, Any] = {}
    for chart in get_charts_in_layout_order(dashboard):
        charts[chart.id] = chart
        try:
            query_contexts[chart.id] = resolve_query_context(chart)
        except SoftTimeLimitExceeded:
            raise
        except Exception:  # pylint: disable=broad-except
            logger.exception("Skipping chart %s while planning Excel export", chart.id)
            query_contexts[chart.id] = None
    return InlineExportPlan(
        query_contexts=query_contexts,
        requested_rows=_row_total(query_contexts, charts),
        max_rows=current_app.config["EXCEL_EXPORT_SYNC_MAX_ROWS"],
    )
