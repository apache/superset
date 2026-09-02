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
grain — mirroring the shared parts of the viz plugins' ``buildQuery``. Beyond
that shared core it reproduces exactly one piece of plugin post-processing, Pie's
unconditional ``contribution`` operator (see
:func:`_pie_contribution_post_processing`). It does **not** reproduce any other
post-processing (pivot, percent-metric transforms, rolling/forecast) or
multi-query fan-out, so callers must restrict it to viz types whose data maps
faithfully to a single query.

The mirrored logic lives on the frontend in
``superset-frontend/plugins/plugin-chart-table/src/buildQuery.ts`` (query mode,
ordering), ``superset-frontend/packages/superset-ui-core/src/query/`` (field
extraction, ``processFilters``). There is no automated tripwire tying the two
across the language boundary; the per-helper pointers below must be kept in sync
when that frontend logic changes.
"""

from __future__ import annotations

from typing import Any

from superset.utils import json
from superset.utils.core import as_list, get_column_name, get_metric_name

# Keep this mapping identical to ``queryFieldAliases`` in
# ``superset-ui-core/src/query/extractQueryFields.ts``.  It is the shared
# frontend contract for every form-data key that can contribute a metric,
# column, or ordering expression to a QueryObject.  Server-side consumers and
# MCP replacement cleanup import this contract rather than maintaining partial
# chart-specific copies.
FORM_DATA_QUERY_FIELD_ALIASES: dict[str, str] = {
    "metric": "metrics",
    "metric_2": "metrics",
    "secondary_metric": "metrics",
    "left_metric": "metrics",
    "right_metric": "metrics",
    "x": "metrics",
    "y": "metrics",
    "size": "metrics",
    "all_columns": "columns",
    "series": "groupby",
    "order_by_cols": "orderby",
}

# ``query_mode`` changes which roles the shared extractor honors.  The two
# series-limit names are consumed directly by buildQueryObject (the latter is
# the legacy spelling), so they belong to the same authoritative vocabulary
# even though they do not pass through extractQueryFields.
SHARED_FORM_DATA_QUERY_ROLE_KEYS = frozenset(
    {
        *FORM_DATA_QUERY_FIELD_ALIASES,
        *FORM_DATA_QUERY_FIELD_ALIASES.values(),
        "query_mode",
        "series_limit_metric",
        "timeseries_limit_metric",
    }
)


def query_fields_from_form_data(  # noqa: C901
    form_data: dict[str, Any],
    aliases: dict[str, str] | None = None,
) -> tuple[list[Any], list[Any], list[list[Any]]]:
    """Extract columns, metrics, and ordering using the frontend contract.

    This is the Python equivalent of ``extractQueryFields.ts``.  Registered
    chart builders may add or replace fields afterward, but the shared alias,
    query-mode, concatenation, de-duplication, and JSON-ordering behavior stays
    consistent across frontend and backend query construction.
    """
    query_aliases = {**FORM_DATA_QUERY_FIELD_ALIASES, **(aliases or {})}
    query_mode = form_data.get("query_mode")
    columns: list[Any] = []
    metrics: list[Any] = []
    orderby: list[Any] = []

    def append_values(target: list[Any], value: Any) -> None:
        target.extend(value if isinstance(value, list) else [value])

    for key, value in form_data.items():
        if key == "query_mode" or value is None:
            continue
        normalized = query_aliases.get(key, key)
        if query_mode == "aggregate" and normalized == "columns":
            continue
        if query_mode == "raw" and normalized in {"groupby", "metrics"}:
            continue
        if normalized == "groupby":
            normalized = "columns"
        if normalized == "metrics":
            append_values(metrics, value)
        elif normalized == "columns":
            append_values(columns, value)
        elif normalized == "orderby":
            append_values(orderby, value)

    def deduplicate(values: list[Any], labeler: Any) -> list[Any]:
        result: list[Any] = []
        labels: list[Any] = []
        for value in values:
            if value == "":
                continue
            try:
                label = labeler(value)
            except (AttributeError, KeyError, TypeError, ValueError):
                label = value
            if label in labels:
                continue
            labels.append(label)
            result.append(value)
        return result

    parsed_orderby: list[list[Any]] = []
    for value in orderby:
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except (TypeError, ValueError) as ex:
                raise ValueError("Found invalid orderby options") from ex
        if isinstance(value, (list, tuple)):
            parsed_orderby.append(list(value))

    return (
        deduplicate(columns, get_column_name),
        deduplicate(metrics, get_metric_name),
        parsed_orderby,
    )


# Suffix Pie's contribution operator appends when renaming the metric column,
# mirroring ``CONTRIBUTION_SUFFIX`` in
# ``superset-frontend/plugins/plugin-chart-echarts/src/Pie/constants.ts``.
PIE_CONTRIBUTION_SUFFIX = "__contribution"


def adhoc_filters_to_query_filters(
    adhoc_filters: list[dict[str, Any]],
    where_only: bool = False,
) -> list[dict[str, Any]]:
    """
    Convert ``SIMPLE`` adhoc filters into QueryObject filter clauses.

    Adhoc filters use ``{subject, operator, comparator}`` while a query object
    expects ``{col, op, val}``; free-form ``SQL`` filters have no ``{col, op,
    val}`` equivalent and are handled separately (see
    :func:`freeform_where_having`).

    By default ``SIMPLE HAVING`` is rejected because a QueryObject filter would
    silently change it to ``WHERE`` semantics. Pass ``where_only=True`` for the
    legacy export behavior that converts only ``WHERE`` filters, matching the
    frontend's ``processFilters`` (``superset-ui-core/src/query/processFilters.ts``).
    """
    result: list[dict[str, Any]] = []
    for flt in adhoc_filters or []:
        if flt.get("expressionType") != "SIMPLE":
            continue
        clause = flt.get("clause", "WHERE")
        if not isinstance(clause, str) or clause not in {"WHERE", "HAVING"}:
            raise ValueError("SIMPLE filter clause must be 'WHERE' or 'HAVING'")
        if clause == "HAVING" and not where_only:
            raise ValueError(
                "SIMPLE HAVING filters are unsupported; they cannot be mapped "
                "to a query filter without changing HAVING semantics"
            )
        if where_only and clause != "WHERE":
            continue
        result.append(
            {
                "col": flt.get("subject"),
                "op": flt.get("operator"),
                "val": flt.get("comparator"),
            }
        )
    return result


def _sanitize_clause(clause: str) -> str:
    """
    Parenthesize a free-form SQL clause, terminating a trailing line comment.

    Mirrors ``sanitizeClause`` (``superset-ui-core/src/query/processFilters.ts``):
    a clause containing ``--`` gets a newline appended *inside* the parentheses,
    so a predicate ending in a comment (``sales > 0 -- note``) does not comment
    out the closing paren and everything joined after it.
    """
    if "--" in clause:
        clause = f"{clause}\n"
    return f"({clause})"


def freeform_where_having(form_data: dict[str, Any]) -> dict[str, str]:
    """
    Collect free-form SQL predicates into a query ``extras`` mapping.

    Mirrors ``processFilters`` on the frontend
    (``superset-ui-core/src/query/processFilters.ts``): ``SQL`` adhoc filters (and
    a legacy top-level ``where``) join into ``extras.where`` / ``extras.having`` by
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
        extras["where"] = " AND ".join(_sanitize_clause(clause) for clause in where)
    if having:
        extras["having"] = " AND ".join(_sanitize_clause(clause) for clause in having)
    return extras


def columns_from_form_data(form_data: dict[str, Any]) -> list[Any]:
    """
    Derive the query's grouping/raw columns from form data.

    Handles raw-mode tables (``all_columns``/``columns``), an ``x_axis`` (string
    or adhoc column), and ``groupby`` dimensions, de-duplicating while preserving
    order.
    """
    columns, _, _ = query_fields_from_form_data(form_data)

    x_axis = form_data.get("x_axis")
    if isinstance(x_axis, str) and x_axis and x_axis not in columns:
        columns.insert(0, x_axis)
    elif isinstance(x_axis, dict):
        col_name = x_axis.get("column_name")
        if col_name and col_name not in columns:
            columns.insert(0, col_name)
    return columns


def is_raw_query_mode(form_data: dict[str, Any]) -> bool:
    """
    Whether the chart runs in raw (non-aggregated) mode, mirroring the frontend's
    ``getQueryMode`` (``plugin-chart-table/src/buildQuery.ts``): an explicit
    ``query_mode`` wins, otherwise the presence of ``all_columns`` implies raw mode.
    """
    if mode := form_data.get("query_mode"):
        return mode == "raw"
    return bool(form_data.get("all_columns"))


def orderby_from_form_data(
    form_data: dict[str, Any], metrics: list[Any], viz_type: str | None = None
) -> list[list[Any]]:
    """
    Derive ordering so a ``row_limit`` returns the chart's top-N, not an
    arbitrary N.

    Raw-mode tables order by ``order_by_cols`` (stored as JSON ``[col, asc]``
    pairs). Aggregate charts order by the configured sort metric
    (``timeseries_limit_metric``, or the first metric when ``sort_by_metric`` is
    set), otherwise fall back to the first metric descending — matching the
    table/pie ``buildQuery`` defaults.

    ``order_by_cols`` is a raw-mode-only control (``resetOnHide: false`` in the
    plugin control panels), so an aggregate chart can carry a stale value from a
    previous raw-mode configuration. Aggregate mode must ignore it, mirroring the
    frontend, where ``plugin-chart-table/src/buildQuery.ts:136-145`` overrides
    ``orderby`` with the sort metric (``order_by_cols`` reaches ``orderby`` only
    via the alias in ``extractQueryFields.ts``, then gets overwritten in aggregate
    mode).
    """
    if is_raw_query_mode(form_data):
        parsed: list[list[Any]] = []
        for entry in form_data.get("order_by_cols") or []:
            if isinstance(entry, str):
                try:
                    entry = json.loads(entry)
                except (TypeError, ValueError):
                    continue
            # The frontend rejects malformed ordering JSON.  The best-effort
            # server fallback instead drops only the malformed entry so an old
            # saved chart remains executable.
            if isinstance(entry, (list, tuple)) and len(entry) == 2:
                parsed.append(list(entry))
        return parsed

    if not metrics:
        return []

    # Sunburst's frontend adds ordering only when sort_by_metric is enabled.
    # Do not apply the generic aggregate-chart fallback when it is explicitly
    # false, or compile/preview selects different rows from Explore.
    if viz_type == "sunburst_v2" and not form_data.get("sort_by_metric"):
        return []

    # The drag-and-drop "sort by" control persists a list; the frontend unwraps it
    # with ``ensureIsArray(...)[0]`` (``plugin-chart-table/src/buildQuery.ts:67``).
    # Read raw, a list would nest inside ``orderby`` and fail the query.
    raw_sort_metric = form_data.get("series_limit_metric") or form_data.get(
        "timeseries_limit_metric"
    )
    sort_metric = (
        next(iter(as_list(raw_sort_metric)), None) if raw_sort_metric else None
    ) or (metrics[0] if form_data.get("sort_by_metric") else None)
    if sort_metric is not None:
        # The Table plugin defaults ``order_desc`` to False (ascending); Pie and
        # others sort by metric descending. Match that so a row limit keeps the
        # chart's top/bottom-N rather than flipping it.
        default_desc = viz_type != "table"
        order_desc = form_data.get("order_desc", default_desc)
        return [[sort_metric, not order_desc]]
    # No explicit sort metric: default to the first metric, descending.
    return [[metrics[0], False]]


def _columns_and_metrics(
    form_data: dict[str, Any], viz_type: str | None
) -> tuple[list[Any], list[Any]]:
    """
    Resolve the query's ``(columns, metrics)`` from form data, honoring raw vs.
    aggregate mode and the Big Number trendline promotion.
    """
    if is_raw_query_mode(form_data):
        # Raw mode returns individual rows: use only the selected columns and
        # ignore ``metrics``/``groupby``, which stay in form data as stale values
        # (the controls aren't reset when hidden) but are ignored by the chart.
        columns = list(form_data.get("all_columns") or form_data.get("columns") or [])
        return columns, []

    columns, metrics, _ = query_fields_from_form_data(form_data)
    # Sunburst's frontend standardized controls promote both singular metric
    # controls into the query. The secondary metric is not presentation-only:
    # transformProps reads it to color nodes by secondary/primary ratio.
    if viz_type == "sunburst_v2" and form_data.get("secondary_metric"):
        secondary_metric = form_data["secondary_metric"]
        if secondary_metric not in metrics:
            metrics.append(secondary_metric)
    # Plugin builders add x_axis outside the shared extractor.
    x_axis = form_data.get("x_axis")
    if isinstance(x_axis, str) and x_axis and x_axis not in columns:
        columns.insert(0, x_axis)
    elif isinstance(x_axis, dict):
        col_name = x_axis.get("column_name")
        if col_name and col_name not in columns:
            columns.insert(0, col_name)
    # Only a Big Number *with a trendline* (viz_type ``big_number``) groups by its
    # time column; ``big_number_total`` is a single aggregate and must not be
    # grouped, or it would return one row per timestamp instead of a total.
    if not columns and viz_type == "big_number" and form_data.get("granularity_sqla"):
        return [form_data["granularity_sqla"]], metrics
    return columns, metrics


def _pie_contribution_post_processing(metrics: list[Any]) -> list[dict[str, Any]]:
    """
    Pie's ``contribution`` post-processing operator, or ``[]`` when it can't apply.

    ``plugins/plugin-chart-echarts/src/Pie/buildQuery.ts`` attaches this operator
    unconditionally — it is not gated on ``percent_metrics`` or a contribution
    mode — and ``Pie/transformProps.ts`` reads the renamed column. Rebuilding a
    pie without it drops the percentage column that a saved-context pie carries,
    so two pies on one dashboard would export different columns based only on
    whether they had been re-saved in Explore.
    """
    if not metrics:
        return []
    try:
        label = get_metric_name(metrics[0])
    except ValueError:
        # A metric this malformed will fail the query anyway; leave the operator
        # off rather than turning a rebuild into an error before it runs.
        return []
    return [
        {
            "operation": "contribution",
            "options": {
                "columns": [label],
                "rename_columns": [f"{label}{PIE_CONTRIBUTION_SUFFIX}"],
            },
        }
    ]


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
    columns, metrics = _columns_and_metrics(form_data, viz_type)

    if viz_type == "sunburst_v2":
        # Sunburst's typed/native contract rejects SIMPLE HAVING because the
        # frontend query mapper ignores it and a QueryObject filter would turn
        # it into WHERE. Validate before the export-compatible where-only pass.
        adhoc_filters_to_query_filters(form_data.get("adhoc_filters", []))

    # SIMPLE adhoc filters (+ legacy top-level ``filters``) become query filters;
    # free-form SQL predicates go into ``extras``. Only ``WHERE``-clause SIMPLE
    # filters are applied (matching the chart), so the export never filters on a
    # ``HAVING`` clause the chart itself ignores.
    filters = adhoc_filters_to_query_filters(
        form_data.get("adhoc_filters", []), where_only=True
    )
    for flt in form_data.get("filters") or []:
        if isinstance(flt, dict) and flt.get("col") is not None:
            filters.append(flt)

    extras = freeform_where_having(form_data)
    if form_data.get("time_grain_sqla"):
        extras["time_grain_sqla"] = form_data["time_grain_sqla"]

    # Prefer the modern ``time_range``; fall back to the legacy ``since``/``until``
    # pair (older charts store the range that way) before defaulting to no filter.
    time_range = form_data.get("time_range")
    if not time_range and (form_data.get("since") or form_data.get("until")):
        time_range = f"{form_data.get('since') or ''} : {form_data.get('until') or ''}"
    time_range = time_range or "No filter"
    query: dict[str, Any] = {
        "columns": columns,
        "metrics": metrics,
        "orderby": orderby_from_form_data(form_data, metrics, viz_type),
        "filters": filters,
        "time_range": time_range,
    }
    if extras:
        query["extras"] = extras
    if viz_type == "pie" and (
        post_processing := _pie_contribution_post_processing(metrics)
    ):
        query["post_processing"] = post_processing
    # ``granularity`` does two jobs downstream: it names the temporal column the
    # time range filters on, and it is the column ``time_grain_sqla`` buckets
    # (``models/helpers.py`` swaps a selected column for its timestamp expression
    # when that column equals ``granularity``). Only the first job depends on
    # there being an active range, so set it whenever form data carries one —
    # matching ``extractExtras.ts``, which sets it unconditionally. Gating it on
    # ``time_range`` dropped the bucketing, so an ordinary "all-time totals by
    # month" chart exported one row per raw timestamp instead of one per month.
    if granularity := form_data.get("granularity") or form_data.get("granularity_sqla"):
        query["granularity"] = granularity
    if form_data.get("row_limit"):
        query["row_limit"] = form_data["row_limit"]

    return {
        "datasource": datasource,
        "queries": [query],
        "form_data": form_data,
    }
