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
Synthesize a query context from a chart's saved form data (``params``).

A chart's ``query_context`` is normally generated client-side by each viz
plugin's ``buildQuery`` and only persisted when the chart is (re-)saved in
Explore. Charts that predate that behavior keep their ``params`` (form data) but
carry no ``query_context``, so server-side consumers that need to run the query
(e.g. the dashboard Excel export) have nothing to execute.

This module rebuilds a best-effort query context from the form data — columns,
metrics, filters (including free-form SQL and the time range), ordering and time
grain — mirroring the shared parts of the viz plugins' ``buildQuery``. It does
**not** reproduce plugin post-processing (pivot, contribution/percent
transforms, rolling/forecast) or multi-query fan-out, so callers must restrict it
to viz types whose data maps faithfully to a single plain query.
"""

from __future__ import annotations

from typing import Any

from superset.utils import json


def adhoc_filters_to_query_filters(
    adhoc_filters: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Convert ``SIMPLE`` adhoc filters into QueryObject filter clauses.

    Adhoc filters use ``{subject, operator, comparator}`` while a query object
    expects ``{col, op, val}``. Only ``SIMPLE`` WHERE-clause filters are
    convertible here; free-form ``SQL`` filters have no ``{col, op, val}``
    equivalent and are handled separately (see :func:`freeform_where_having`).
    """
    result: list[dict[str, Any]] = []
    for flt in adhoc_filters or []:
        if (
            flt.get("expressionType") == "SIMPLE"
            and (flt.get("clause") or "WHERE").upper() == "WHERE"
        ):
            result.append(
                {
                    "col": flt.get("subject"),
                    "op": flt.get("operator"),
                    "val": flt.get("comparator"),
                }
            )
    return result


def freeform_where_having(form_data: dict[str, Any]) -> dict[str, str]:
    """
    Collect free-form SQL predicates into a query ``extras`` mapping.

    Mirrors ``processFilters`` on the frontend: ``SQL`` adhoc filters (and a
    legacy top-level ``where``) join into ``extras.where`` / ``extras.having`` by
    clause, so a chart restricted by a custom SQL predicate exports the same rows
    it displays instead of the full, unrestricted result.
    """
    where: list[str] = []
    having: list[str] = []
    if form_data.get("where"):
        where.append(form_data["where"])
    for flt in form_data.get("adhoc_filters") or []:
        if flt.get("expressionType") == "SQL" and flt.get("sqlExpression"):
            clause = (flt.get("clause") or "WHERE").upper()
            (having if clause == "HAVING" else where).append(flt["sqlExpression"])

    extras: dict[str, str] = {}
    if where:
        extras["where"] = " AND ".join(f"({clause})" for clause in where)
    if having:
        extras["having"] = " AND ".join(f"({clause})" for clause in having)
    return extras


def columns_from_form_data(form_data: dict[str, Any]) -> list[Any]:
    """
    Derive the query's grouping/raw columns from form data.

    Handles raw-mode tables (``all_columns``/``columns``), an ``x_axis`` (string
    or adhoc column), and ``groupby`` dimensions, de-duplicating while preserving
    order.
    """
    if form_data.get("query_mode") == "raw" and (
        form_data.get("all_columns") or form_data.get("columns")
    ):
        return list(form_data.get("all_columns") or form_data.get("columns") or [])

    groupby_columns: list[Any] = form_data.get("groupby") or []
    raw_columns: list[Any] = form_data.get("columns") or []
    # Prefer explicit raw columns only when they are actually present; a stale
    # empty ``columns: []`` key must not shadow the group-by dimensions (which
    # would silently drop the grouping and change the aggregation).
    columns = raw_columns.copy() if raw_columns else groupby_columns.copy()

    x_axis = form_data.get("x_axis")
    if isinstance(x_axis, str) and x_axis and x_axis not in columns:
        columns.insert(0, x_axis)
    elif isinstance(x_axis, dict):
        col_name = x_axis.get("column_name")
        if col_name and col_name not in columns:
            columns.insert(0, col_name)
    return columns


def orderby_from_form_data(
    form_data: dict[str, Any], metrics: list[Any]
) -> list[list[Any]]:
    """
    Derive ordering so a ``row_limit`` returns the chart's top-N, not an
    arbitrary N.

    Raw-mode tables order by ``order_by_cols`` (stored as JSON ``[col, asc]``
    pairs). Aggregate charts order by the configured sort metric
    (``timeseries_limit_metric``, or the first metric when ``sort_by_metric`` is
    set), otherwise fall back to the first metric descending — matching the
    table/pie ``buildQuery`` defaults.
    """
    if order_by_cols := form_data.get("order_by_cols") or []:
        parsed: list[list[Any]] = []
        for col in order_by_cols:
            if isinstance(col, str):
                try:
                    col = json.loads(col)
                except (TypeError, ValueError):
                    continue
            parsed.append(col)
        return parsed

    if not metrics:
        return []

    order_desc = form_data.get("order_desc", True)
    sort_metric = form_data.get("timeseries_limit_metric") or (
        metrics[0] if form_data.get("sort_by_metric") else None
    )
    if sort_metric is not None:
        return [[sort_metric, not order_desc]]
    # No explicit sort metric: default to the first metric, descending.
    return [[metrics[0], False]]


def build_query_context_from_form_data(
    form_data: dict[str, Any],
    datasource: dict[str, Any],
    viz_type: str | None = None,
) -> dict[str, Any]:
    """
    Build a query-context payload (the JSON shape ``ChartDataQueryContextSchema``
    loads) from a chart's form data and datasource reference.

    :param form_data: The chart's saved ``params`` parsed to a dict.
    :param datasource: ``{"id": <int>, "type": "table"}`` datasource reference.
    :param viz_type: The chart's viz type, used for viz-specific handling.
    :returns: A single-query query-context dict.
    """
    metrics = list(form_data.get("metrics") or [])
    # Single-metric charts (e.g. Big Number) store ``metric`` rather than
    # ``metrics``.
    if not metrics and form_data.get("metric"):
        metrics = [form_data["metric"]]
    # Table percent metrics are computed as additional query metrics.
    if viz_type == "table" and form_data.get("percent_metrics"):
        metrics = [*metrics, *form_data["percent_metrics"]]

    columns = columns_from_form_data(form_data)
    # Only a Big Number *with a trendline* (viz_type ``big_number``) groups by its
    # time column; ``big_number_total`` is a single aggregate and must not be
    # grouped, or it would return one row per timestamp instead of a total.
    if not columns and viz_type == "big_number" and form_data.get("granularity_sqla"):
        columns = [form_data["granularity_sqla"]]

    # SIMPLE adhoc filters (+ legacy top-level ``filters``) become query filters;
    # free-form SQL predicates go into ``extras``.
    filters = adhoc_filters_to_query_filters(form_data.get("adhoc_filters", []))
    for flt in form_data.get("filters") or []:
        if isinstance(flt, dict) and flt.get("col") is not None:
            filters.append(flt)

    extras = freeform_where_having(form_data)
    if form_data.get("time_grain_sqla"):
        extras["time_grain_sqla"] = form_data["time_grain_sqla"]

    time_range = form_data.get("time_range") or "No filter"
    query: dict[str, Any] = {
        "columns": columns,
        "metrics": metrics,
        "orderby": orderby_from_form_data(form_data, metrics),
        "filters": filters,
        "time_range": time_range,
    }
    if extras:
        query["extras"] = extras
    # ``granularity`` names the temporal column that actually applies the time
    # range; without it, ``time_range`` is inert and the export returns the entire
    # history. Only set it when there is a real range to apply — otherwise a
    # numeric column saved as ``granularity_sqla`` (with no active range) would be
    # forced through date bucketing and fail.
    granularity = form_data.get("granularity") or form_data.get("granularity_sqla")
    if granularity and time_range != "No filter":
        query["granularity"] = granularity
    if form_data.get("row_limit"):
        query["row_limit"] = form_data["row_limit"]

    return {
        "datasource": datasource,
        "queries": [query],
        "form_data": form_data,
    }
