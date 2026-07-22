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

This module rebuilds a best-effort query context from the form data. The same
approach is used by the MCP chart compile/preview path
(``superset.mcp_service.chart.compile``); it is a *generic single-query*
mapping (columns, metrics, filters, time range) and intentionally does **not**
reproduce plugin-specific ``buildQuery`` logic — post-processing pipelines
(pivot, rolling, contribution, forecast) or multi-query fan-out (e.g. mixed
time-series). Callers must therefore restrict it to viz types whose data maps
faithfully to a single plain query; anything else risks silently wrong or
incomplete results.
"""

from __future__ import annotations

from typing import Any


def adhoc_filters_to_query_filters(
    adhoc_filters: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Convert saved adhoc filters into QueryObject filter clauses.

    Adhoc filters use ``{subject, operator, comparator}`` while a query object
    expects ``{col, op, val}``. Only ``SIMPLE`` filters are convertible; custom
    SQL filters have no equivalent here and are dropped.
    """
    result: list[dict[str, Any]] = []
    for flt in adhoc_filters or []:
        if flt.get("expressionType") == "SIMPLE":
            result.append(
                {
                    "col": flt.get("subject"),
                    "op": flt.get("operator"),
                    "val": flt.get("comparator"),
                }
            )
    return result


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


def build_query_context_from_form_data(
    form_data: dict[str, Any],
    datasource: dict[str, Any],
) -> dict[str, Any]:
    """
    Build a query-context payload (the JSON shape ``ChartDataQueryContextSchema``
    loads) from a chart's form data and datasource reference.

    :param form_data: The chart's saved ``params`` parsed to a dict.
    :param datasource: ``{"id": <int>, "type": "table"}`` datasource reference.
    :returns: A single-query query-context dict.
    """
    metrics = form_data.get("metrics") or []
    # Single-metric charts (e.g. Big Number) store ``metric`` rather than
    # ``metrics``.
    if not metrics and form_data.get("metric"):
        metrics = [form_data["metric"]]

    columns = columns_from_form_data(form_data)
    # Big Number with a trendline uses ``granularity_sqla`` as its time column.
    if not columns and form_data.get("granularity_sqla"):
        columns = [form_data["granularity_sqla"]]

    filters = adhoc_filters_to_query_filters(form_data.get("adhoc_filters", []))
    # Legacy charts may also carry simple filters directly under ``filters``,
    # already in the QueryObject ``{col, op, val}`` shape; keep them so the export
    # applies the same filtering the chart does.
    for flt in form_data.get("filters") or []:
        if isinstance(flt, dict) and flt.get("col") is not None:
            filters.append(flt)

    query: dict[str, Any] = {
        "columns": columns,
        "metrics": metrics,
        "orderby": form_data.get("orderby") or [],
        "filters": filters,
        "time_range": form_data.get("time_range", "No filter"),
    }
    if form_data.get("row_limit"):
        query["row_limit"] = form_data["row_limit"]

    return {
        "datasource": datasource,
        "queries": [query],
        "form_data": form_data,
    }
