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

This module rebuilds query contexts from form data — columns, metrics, filters,
ordering, temporal state, limits, query fan-out, and registered visualization
post-processing — mirroring the shared frontend extractor and explicit plugin
``buildQuery`` adapters. MCP compile, SQL, preview, and data fallback products
consume the same QueryObject contract as the legacy common fallback.

The mirrored logic lives on the frontend in
``superset-frontend/plugins/*/buildQuery.ts`` and
``superset-frontend/packages/superset-ui-core/src/query/`` (field extraction,
``processFilters``). The adapter tests pin the Python QueryObject dictionaries;
the per-helper pointers below must still be kept in sync when frontend contracts
change.
"""

from __future__ import annotations

from collections.abc import Mapping
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
        "series_columns",
        "timeseries_limit_metric",
    }
)


# Mixed Timeseries builds query B by stripping ``_b`` from every suffixed
# control before passing it through the same shared query builder as query A.
# This is the complete dataset/query vocabulary exposed by the frontend query
# and advanced-analytics sections.  Key presence is significant: an explicit
# ``[]``/``None`` on a suffixed control overrides the unsuffixed value rather
# than falling back to query A.
MIXED_TIMESERIES_SECONDARY_QUERY_KEYS = frozenset(
    {
        "adhoc_filters_b",
        "all_columns_b",
        "annotation_layers_b",
        "annotations_b",
        "columns_b",
        "comparison_type_b",
        "custom_params_b",
        "extra_filters_b",
        "extra_form_data_b",
        "filters_b",
        "granularity_b",
        "granularity_sqla_b",
        "group_others_when_limit_reached_b",
        "groupby_b",
        "having_b",
        "limit_b",
        "metrics_b",
        "min_periods_b",
        "order_by_cols_b",
        "order_desc_b",
        "orderby_b",
        "query_mode_b",
        "resample_method_b",
        "resample_rule_b",
        "rolling_periods_b",
        "rolling_type_b",
        "row_limit_b",
        "row_offset_b",
        "series_columns_b",
        "series_limit_b",
        "series_limit_metric_b",
        "temporal_columns_lookup_b",
        "time_compare_b",
        "time_grain_b",
        "time_grain_sqla_b",
        "time_range_b",
        "timeseries_limit_metric_b",
        "truncate_metric_b",
        "url_params_b",
        "where_b",
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


def _as_list(value: Any) -> list[Any]:
    """Return the frontend ``ensureIsArray`` representation of a value."""
    if value is None:
        return []
    return list(value) if isinstance(value, (list, tuple)) else [value]


def _label(value: Any, *, metric: bool = False) -> str:
    """Resolve a frontend-compatible query-field label."""
    try:
        return get_metric_name(value) if metric else get_column_name(value)
    except (AttributeError, KeyError, TypeError, ValueError):
        if isinstance(value, Mapping):
            return str(
                value.get("label")
                or value.get("column_name")
                or value.get("sqlExpression")
                or value
            )
        return str(value)


def _deduplicate_fields(values: list[Any], *, metric: bool = False) -> list[Any]:
    """Deduplicate query fields by their frontend-visible label."""
    result: list[Any] = []
    labels: set[str] = set()
    for value in values:
        if value is None or value == "":
            continue
        label = _label(value, metric=metric)
        if label in labels:
            continue
        labels.add(label)
        result.append(value)
    return result


def retain_mixed_timeseries_secondary_form_data(
    form_data: Mapping[str, Any],
) -> dict[str, Any]:
    """Mirror ``retainFormDataSuffix(formData, '_b')`` exactly.

    Suffixed values are installed first, including falsey values, and shared
    unsuffixed controls fill only keys that query B did not explicitly set.
    """
    secondary: dict[str, Any] = {}
    for key, value in form_data.items():
        if key.endswith("_b"):
            secondary[key[:-2]] = value
    for key, value in form_data.items():
        if not key.endswith("_b") and key not in secondary:
            secondary[key] = value
    secondary_filter_keys = {
        "adhoc_filters": "adhoc_filters_b",
        "extra_filters": "extra_filters_b",
        "filters": "filters_b",
        "having": "having_b",
        "where": "where_b",
    }
    if any(suffixed in form_data for suffixed in secondary_filter_keys.values()):
        # The frontend exposes adhoc_filters_b, while saved/server payloads can
        # carry equivalent legacy aliases. Treat the family atomically: an
        # explicit clear in any B alias must not be repopulated by query A's
        # differently named filter representation.
        for primary, suffixed in secondary_filter_keys.items():
            if suffixed not in form_data:
                secondary.pop(primary, None)
    return secondary


def _base_query_object(  # noqa: C901
    form_data: dict[str, Any],
    *,
    row_limit: int | None,
    order_desc: bool | None,
    filters_prepared: bool,
) -> dict[str, Any]:
    """Build the shared frontend-equivalent portion of a QueryObject."""
    columns, metrics, orderby = query_fields_from_form_data(form_data)
    query: dict[str, Any] = {
        "columns": columns,
        "metrics": metrics,
    }
    if orderby:
        query["orderby"] = orderby

    if filters_prepared:
        query["filters"] = list(form_data.get("filters") or [])
        for clause in ("where", "having"):
            if form_data.get(clause):
                query[clause] = form_data[clause]
        if form_data.get("extras"):
            query["extras"] = dict(form_data["extras"])
    else:
        filters = adhoc_filters_to_query_filters(
            form_data.get("adhoc_filters", []), where_only=True
        )
        filters.extend(
            filter_
            for filter_ in form_data.get("filters") or []
            if isinstance(filter_, dict) and filter_.get("col") is not None
        )
        query["filters"] = filters
        if extras := freeform_where_having(form_data):
            query["extras"] = extras

    extras = dict(query.get("extras") or {})
    if form_data.get("time_grain_sqla") is not None:
        extras["time_grain_sqla"] = form_data["time_grain_sqla"]
    if extras:
        query["extras"] = extras

    effective_limit = row_limit if row_limit is not None else form_data.get("row_limit")
    if effective_limit is not None:
        query["row_limit"] = effective_limit
    if form_data.get("row_offset") is not None:
        query["row_offset"] = form_data["row_offset"]
    if order_desc is not None:
        query["order_desc"] = order_desc
    elif "order_desc" in form_data and form_data["order_desc"] is not None:
        query["order_desc"] = form_data["order_desc"]

    time_range = form_data.get("time_range")
    if not time_range and (form_data.get("since") or form_data.get("until")):
        time_range = f"{form_data.get('since') or ''} : {form_data.get('until') or ''}"
    if time_range:
        query["time_range"] = time_range
    for key in ("since", "until", "annotation_layers", "url_params", "custom_params"):
        if form_data.get(key) is not None:
            query[key] = form_data[key]

    granularity = form_data.get("granularity") or form_data.get("granularity_sqla")
    if granularity:
        query["granularity"] = granularity
    series_limit = form_data.get("series_limit", form_data.get("limit"))
    if series_limit is not None:
        query["series_limit"] = series_limit
    series_limit_metric = form_data.get("series_limit_metric")
    if series_limit_metric is None:
        series_limit_metric = form_data.get("timeseries_limit_metric")
    if series_limit_metric is not None:
        query["series_limit_metric"] = series_limit_metric
    if form_data.get("group_others_when_limit_reached") is not None:
        query["group_others_when_limit_reached"] = form_data[
            "group_others_when_limit_reached"
        ]
    return query


def _temporalized_columns(form_data: dict[str, Any], columns: list[Any]) -> list[Any]:
    """Apply the table/pivot/box BASE_AXIS temporal-column contract."""
    time_grain = form_data.get("time_grain_sqla")
    temporal_lookup = form_data.get("temporal_columns_lookup") or {}
    result: list[Any] = []
    for column in columns:
        if (
            isinstance(column, str)
            and time_grain
            and (
                temporal_lookup.get(column)
                or form_data.get("granularity_sqla") == column
            )
        ):
            result.append(
                {
                    "timeGrain": time_grain,
                    "columnType": "BASE_AXIS",
                    "sqlExpression": column,
                    "label": column,
                    "expressionType": "SQL",
                }
            )
        else:
            result.append(column)
    return result


def _histogram_query(form_data: dict[str, Any], query: dict[str, Any]) -> None:
    groupby = _as_list(form_data.get("groupby"))
    column = form_data.get("column")
    query["columns"] = [*groupby, *([column] if column is not None else [])]
    query["post_processing"] = [
        {
            "operation": "histogram",
            "options": {
                "column": _label(column),
                "groupby": [_label(value) for value in groupby],
                "bins": int(form_data.get("bins", 5)),
                "cumulative": form_data.get("cumulative", False),
                "normalize": form_data.get("normalize", False),
            },
        }
    ]
    if any(
        isinstance(filter_, dict) and filter_.get("clause") == "HAVING"
        for filter_ in form_data.get("adhoc_filters") or []
    ):
        query["metrics"] = [
            {
                "expressionType": "SQL",
                "sqlExpression": "COUNT(*)",
                "label": "COUNT(*)",
            }
        ]
    else:
        query["metrics"] = []


def _box_plot_query(form_data: dict[str, Any], query: dict[str, Any]) -> None:
    distributed = _as_list(form_data.get("columns"))
    if not distributed and form_data.get("granularity_sqla"):
        distributed = [form_data["granularity_sqla"]]
    groupby = _as_list(form_data.get("groupby"))
    query["columns"] = [*_temporalized_columns(form_data, distributed), *groupby]
    query["series_columns"] = groupby
    whisker = form_data.get("whiskerOptions")
    if not whisker:
        query["post_processing"] = []
        return
    whisker_type = "tukey"
    percentiles: list[int] | None = None
    if whisker == "Min/max (no outliers)":
        whisker_type = "min/max"
    elif isinstance(whisker, str) and whisker.endswith(" percentiles"):
        low, high = whisker.removesuffix(" percentiles").split("/", 1)
        whisker_type = "percentile"
        percentiles = [int(low), int(high)]
    query["post_processing"] = [
        {
            "operation": "boxplot",
            "options": {
                "whisker_type": whisker_type,
                "percentiles": percentiles,
                "groupby": [_label(value) for value in groupby],
                "metrics": [_label(value, metric=True) for value in query["metrics"]],
            },
        }
    ]


_PIVOT_ADDITIVE_AGGREGATES = frozenset({"SUM", "COUNT", "MIN", "MAX"})


def _all_metrics_additive(metrics: list[Any]) -> bool:
    """Mirror Pivot's conservative additive-metric fast-path."""
    return bool(metrics) and all(
        isinstance(metric, Mapping)
        and metric.get("expressionType") == "SIMPLE"
        and metric.get("aggregate") in _PIVOT_ADDITIVE_AGGREGATES
        for metric in metrics
    )


def _pivot_grouping_sets(
    form_data: dict[str, Any], rows: list[Any], columns: list[Any]
) -> list[list[str]]:
    """Enumerate the rollup levels requested by Pivot's frontend builder."""
    row_prefixes = [[], *(rows[: index + 1] for index in range(len(rows)))]
    column_prefixes = [
        [],
        *(columns[: index + 1] for index in range(len(columns))),
    ]
    show_values_as = form_data.get("showValuesAs")
    needs_rows_collapsed = show_values_as in {"percent_col", "percent_total"}
    needs_columns_collapsed = show_values_as in {"percent_row", "percent_total"}

    def row_prefix_needed(prefix: list[Any]) -> bool:
        if len(prefix) == len(rows):
            return True
        if not prefix:
            return bool(form_data.get("colTotals")) or needs_rows_collapsed
        return bool(form_data.get("rowSubTotals"))

    def column_prefix_needed(prefix: list[Any]) -> bool:
        if len(prefix) == len(columns):
            return True
        if not prefix:
            return bool(form_data.get("rowTotals")) or needs_columns_collapsed
        return bool(form_data.get("colSubTotals"))

    levels = [
        (row_prefix, column_prefix)
        for row_prefix in row_prefixes
        if row_prefix_needed(row_prefix)
        for column_prefix in column_prefixes
        if column_prefix_needed(column_prefix)
    ]
    if form_data.get("combineMetric"):
        metrics_layout = form_data.get("metricsLayout")

        def forced_denominator(level: tuple[list[Any], list[Any]]) -> bool:
            row_prefix, column_prefix = level
            return (needs_rows_collapsed and not row_prefix) or (
                needs_columns_collapsed and not column_prefix
            )

        if metrics_layout == "ROWS":
            levels = [
                level
                for level in levels
                if len(level[0]) == len(rows) or forced_denominator(level)
            ]
        else:
            levels = [
                level
                for level in levels
                if len(level[1]) == len(columns) or forced_denominator(level)
            ]

    return [
        [_label(value) for value in _deduplicate_fields([*row_prefix, *column_prefix])]
        for row_prefix, column_prefix in levels
    ]


def _pivot_query(form_data: dict[str, Any], query: dict[str, Any]) -> None:
    rows = _as_list(form_data.get("groupbyRows"))
    columns = _as_list(form_data.get("groupbyColumns"))
    if form_data.get("transposePivot"):
        rows, columns = columns, rows
    query["columns"] = _temporalized_columns(
        form_data, _deduplicate_fields([*rows, *columns])
    )
    metric = query.get("series_limit_metric") or next(
        iter(query.get("metrics") or []), None
    )
    query["orderby"] = (
        [[metric, not bool(query.get("order_desc", True))]]
        if metric is not None
        else []
    )
    if not _all_metrics_additive(query.get("metrics") or []):
        query["grouping_sets"] = _pivot_grouping_sets(form_data, rows, columns)


def _waterfall_query(form_data: dict[str, Any], query: dict[str, Any]) -> None:
    x_axis = form_data.get("x_axis") or form_data.get("granularity_sqla")
    columns = [*_as_list(x_axis), *_as_list(form_data.get("groupby"))]
    query["columns"] = _deduplicate_fields(columns)
    query["orderby"] = [[column, True] for column in query["columns"]]


def _gantt_query(form_data: dict[str, Any], query: dict[str, Any]) -> None:
    groupby = _as_list(form_data.get("series"))
    orderby = query_fields_from_form_data(form_data)[2]
    columns = [
        form_data.get("start_time"),
        form_data.get("end_time"),
        form_data.get("y_axis"),
        *groupby,
        *_as_list(form_data.get("tooltip_columns")),
        *(entry[0] for entry in orderby if entry),
    ]
    query["columns"] = _deduplicate_fields(columns)
    query["metrics"] = _as_list(form_data.get("tooltip_metrics"))
    query["orderby"] = orderby
    query["series_columns"] = groupby


def _normalize_query_orderby(query: dict[str, Any]) -> None:
    """Mirror ``normalizeOrderBy`` while retaining limit-direction controls."""
    orderby = query.get("orderby")
    if (
        isinstance(orderby, list)
        and orderby
        and isinstance(orderby[0], (list, tuple))
        and len(orderby[0]) == 2
        and orderby[0][0]
        and isinstance(orderby[0][1], bool)
    ):
        return
    metric = (
        query.get("series_limit_metric")
        or query.get("legacy_order_by")
        or next(iter(query.get("metrics") or []), None)
    )
    if metric is None:
        query.pop("orderby", None)
        return
    query["orderby"] = [[metric, not bool(query.get("order_desc", True))]]


_TIME_COMPARISON_TYPES = frozenset({"values", "difference", "percentage", "ratio"})


def _metric_offset_map(
    form_data: dict[str, Any], metric_labels: list[str]
) -> dict[str, str]:
    """Return the frontend time-comparison metric label map."""
    if form_data.get("comparison_type") not in _TIME_COMPARISON_TYPES:
        return {}
    return {
        f"{metric}__{offset}": metric
        for metric in metric_labels
        for offset in _as_list(form_data.get("time_compare"))
    }


def _timeseries_post_processing(  # noqa: C901
    form_data: dict[str, Any],
    query: dict[str, Any],
    *,
    x_axis: Any,
    groupby: list[Any],
    mixed: bool,
) -> tuple[list[dict[str, Any]], list[Any]]:
    """Build the Timeseries/Mixed operator pipeline in frontend order."""
    metric_labels = [_label(value, metric=True) for value in query.get("metrics") or []]
    offset_map = _metric_offset_map(form_data, metric_labels)
    time_offsets = _as_list(form_data.get("time_compare")) if offset_map else []
    post_processing: list[dict[str, Any]] = []

    if x_axis and metric_labels:
        aggregate_labels = (
            [*offset_map.values(), *offset_map] if offset_map else metric_labels
        )
        post_processing.append(
            {
                "operation": "pivot",
                "options": {
                    "index": [_label(x_axis)],
                    "columns": [_label(value) for value in groupby],
                    "aggregates": {
                        label: {"operator": "mean"} for label in aggregate_labels
                    },
                    "drop_missing_columns": not form_data.get(
                        "show_empty_columns", False
                    ),
                },
            }
        )

    if form_data.get("resample_method") and form_data.get("resample_rule"):
        zero_fill = form_data["resample_method"] == "zerofill"
        post_processing.append(
            {
                "operation": "resample",
                "options": {
                    "method": "asfreq" if zero_fill else form_data["resample_method"],
                    "rule": form_data["resample_rule"],
                    "fill_value": 0 if zero_fill else None,
                },
            }
        )

    rolling_labels = (
        [*offset_map.values(), *offset_map] if offset_map else metric_labels
    )
    columns_map = {label: label for label in rolling_labels}
    rolling_type = form_data.get("rolling_type")
    if rolling_type == "cumsum":
        post_processing.append(
            {
                "operation": "cum",
                "options": {"operator": "sum", "columns": columns_map},
            }
        )
    elif rolling_type in {"sum", "mean", "std"}:
        post_processing.append(
            {
                "operation": "rolling",
                "options": {
                    "rolling_type": rolling_type,
                    "window": int(form_data.get("rolling_periods") or 1),
                    "min_periods": int(form_data.get("min_periods") or 0),
                    "columns": columns_map,
                },
            }
        )

    comparison_type = form_data.get("comparison_type")
    if offset_map and comparison_type != "values":
        post_processing.append(
            {
                "operation": "compare",
                "options": {
                    "source_columns": list(offset_map.values()),
                    "compare_columns": list(offset_map),
                    "compare_type": comparison_type,
                    "drop_original_columns": True,
                },
            }
        )

    if not mixed and form_data.get("contributionMode"):
        post_processing.append(
            {
                "operation": "contribution",
                "options": {
                    "orientation": form_data["contributionMode"],
                    "time_shifts": time_offsets,
                },
            }
        )

    if (
        len(metric_labels) == 1
        and groupby
        and x_axis
        and form_data.get("truncate_metric")
        and not (
            offset_map and comparison_type in {"difference", "ratio", "percentage"}
        )
    ):
        renamed: dict[str, Any] = {}
        if offset_map and comparison_type == "values":
            for offset_metric in offset_map:
                renamed[offset_metric] = next(
                    (offset for offset in time_offsets if str(offset) in offset_metric),
                    None,
                )
        renamed[metric_labels[0]] = None
        post_processing.append(
            {
                "operation": "rename",
                "options": {"columns": renamed, "level": 0, "inplace": True},
            }
        )

    if not mixed:
        sortable = {
            _label(x_axis) if x_axis else "",
            *metric_labels,
        }
        if (
            "x_axis_sort" in form_data
            and "x_axis_sort_asc" in form_data
            and form_data.get("x_axis_sort") in sortable
            and not groupby
        ):
            options: dict[str, Any] = {"ascending": form_data.get("x_axis_sort_asc")}
            if form_data.get("x_axis_sort") == _label(x_axis):
                options["is_sort_index"] = True
            else:
                options["by"] = form_data.get("x_axis_sort")
            post_processing.append({"operation": "sort", "options": options})

    post_processing.append({"operation": "flatten"})
    if not mixed and form_data.get("forecastEnabled") and x_axis:
        post_processing.append(
            {
                "operation": "prophet",
                "options": {
                    "time_grain": form_data.get("time_grain_sqla"),
                    "periods": int(form_data.get("forecastPeriods") or 0),
                    "confidence_interval": float(
                        form_data.get("forecastInterval") or 0
                    ),
                    "yearly_seasonality": form_data.get("forecastSeasonalityYearly"),
                    "weekly_seasonality": form_data.get("forecastSeasonalityWeekly"),
                    "daily_seasonality": form_data.get("forecastSeasonalityDaily"),
                    "index": _label(x_axis),
                },
            }
        )
    return post_processing, time_offsets


def _timeseries_query(form_data: dict[str, Any], query: dict[str, Any]) -> None:
    groupby = _as_list(form_data.get("groupby"))
    x_axis = form_data.get("x_axis")
    if isinstance(x_axis, Mapping) and x_axis.get("column_name"):
        x_axis = x_axis["column_name"]
    query["columns"] = _deduplicate_fields([*_as_list(x_axis), *groupby])
    query["series_columns"] = groupby
    if not x_axis:
        query["is_timeseries"] = True

    # Timeseries includes its sort-only metric in the SELECT when no series is
    # present. This lets the post-processing sort operator use a metric not
    # otherwise displayed.
    sort_metric = form_data.get("timeseries_limit_metric")
    if isinstance(sort_metric, list):
        sort_metric = next(iter(sort_metric), None)
    if (
        not groupby
        and sort_metric is not None
        and _label(sort_metric, metric=True) == form_data.get("x_axis_sort")
        and _label(sort_metric, metric=True)
        not in {_label(metric, metric=True) for metric in query.get("metrics") or []}
    ):
        query.setdefault("metrics", []).append(sort_metric)
    _normalize_query_orderby(query)
    post_processing, time_offsets = _timeseries_post_processing(
        form_data,
        query,
        x_axis=x_axis,
        groupby=groupby,
        mixed=form_data.get("viz_type") == "mixed_timeseries",
    )
    query["post_processing"] = post_processing
    query["time_offsets"] = time_offsets
    if form_data.get("viz_type") != "mixed_timeseries":
        query["time_compare_full_range"] = bool(
            time_offsets and form_data.get("time_compare_full_range")
        )


def _big_number_queries(
    form_data: dict[str, Any], query: dict[str, Any]
) -> list[dict[str, Any]]:
    """Mirror Big Number with Trendline's one/two-query contract."""
    time_column = _as_list(form_data.get("x_axis") or form_data.get("granularity_sqla"))
    query["columns"] = time_column
    if not time_column:
        query["is_timeseries"] = True
    metric_labels = [_label(value, metric=True) for value in query.get("metrics") or []]
    post_processing: list[dict[str, Any]] = []
    if time_column and metric_labels:
        post_processing.append(
            {
                "operation": "pivot",
                "options": {
                    "index": [_label(time_column[0])],
                    "columns": [],
                    "aggregates": {
                        label: {"operator": "mean"} for label in metric_labels
                    },
                    "drop_missing_columns": not form_data.get(
                        "show_empty_columns", False
                    ),
                },
            }
        )
    if form_data.get("resample_method") and form_data.get("resample_rule"):
        zero_fill = form_data["resample_method"] == "zerofill"
        post_processing.append(
            {
                "operation": "resample",
                "options": {
                    "method": "asfreq" if zero_fill else form_data["resample_method"],
                    "rule": form_data["resample_rule"],
                    "fill_value": 0 if zero_fill else None,
                },
            }
        )
    rolling_type = form_data.get("rolling_type")
    columns_map = {label: label for label in metric_labels}
    if rolling_type == "cumsum":
        post_processing.append(
            {"operation": "cum", "options": {"operator": "sum", "columns": columns_map}}
        )
    elif rolling_type in {"sum", "mean", "std"}:
        post_processing.append(
            {
                "operation": "rolling",
                "options": {
                    "rolling_type": rolling_type,
                    "window": int(form_data.get("rolling_periods") or 1),
                    "min_periods": int(form_data.get("min_periods") or 0),
                    "columns": columns_map,
                },
            }
        )
    post_processing.append({"operation": "flatten"})
    query["post_processing"] = post_processing
    queries = [query]
    if form_data.get("aggregation") == "raw":
        overall = dict(query)
        overall.update(
            {
                "columns": [],
                "is_timeseries": True,
                "post_processing": [],
            }
        )
        queries.append(overall)
    return queries


def _table_queries(  # noqa: C901
    form_data: dict[str, Any], query: dict[str, Any]
) -> list[dict[str, Any]]:
    if is_raw_query_mode(form_data):
        # The extractor already applies the raw-mode contract, including native
        # ``order_by_cols`` parsing. Do not synthesize metric ordering.
        query["columns"] = list(
            form_data.get("all_columns") or form_data.get("columns") or []
        )
        query["metrics"] = []
        if raw_orderby := orderby_from_form_data(form_data, [], "table"):
            query["orderby"] = raw_orderby
        else:
            query.pop("orderby", None)
        return [query]

    metrics = list(query.get("metrics") or [])
    percent_metrics = _as_list(form_data.get("percent_metrics"))
    for metric in percent_metrics:
        if _label(metric, metric=True) not in {
            _label(existing, metric=True) for existing in metrics
        }:
            metrics.append(metric)
    query["metrics"] = metrics
    query["orderby"] = orderby_from_form_data(form_data, metrics, "table")
    post_processing: list[dict[str, Any]] = []
    contribution: dict[str, Any] | None = None
    if percent_metrics:
        labels = [_label(metric, metric=True) for metric in percent_metrics]
        contribution = {
            "operation": "contribution",
            "options": {
                "columns": labels,
                "rename_columns": [f"%{label}" for label in labels],
            },
        }
        post_processing.append(contribution)

    metric_labels = [_label(metric, metric=True) for metric in metrics]
    offset_map = _metric_offset_map(form_data, metric_labels)
    time_offsets = _as_list(form_data.get("time_compare")) if offset_map else []
    if offset_map and form_data.get("comparison_type") != "values":
        post_processing.append(
            {
                "operation": "compare",
                "options": {
                    "source_columns": list(offset_map.values()),
                    "compare_columns": list(offset_map),
                    "compare_type": form_data.get("comparison_type"),
                    "drop_original_columns": True,
                },
            }
        )
    if post_processing:
        query["post_processing"] = post_processing
    else:
        query.pop("post_processing", None)
    query["time_offsets"] = time_offsets

    is_download = form_data.get("result_format") in {"csv", "xlsx"} or (
        form_data.get("result_format") == "json"
        and form_data.get("result_type") == "results"
    )
    if is_download:
        if form_data.get("row_limit") is not None:
            query["row_limit"] = int(form_data["row_limit"])
        query["row_offset"] = 0
    elif form_data.get("server_pagination"):
        page_size = int(form_data.get("server_page_length") or 0)
        configured_limit = int(form_data.get("row_limit") or 0)
        query["row_limit"] = (
            min(page_size, configured_limit) if configured_limit else page_size
        )
        query["row_offset"] = 0

    queries = [query]
    if form_data.get("percent_metric_calculation") == "all_records" and percent_metrics:
        all_records = dict(query)
        all_records.update(
            {
                "columns": [],
                "metrics": percent_metrics,
                "post_processing": [],
                "row_limit": 0,
                "row_offset": 0,
                "orderby": [],
                "is_timeseries": False,
            }
        )
        queries.append(all_records)
    if form_data.get("show_totals") and metrics:
        totals = dict(query)
        totals.update(
            {
                "columns": [],
                "metrics": metrics,
                "row_limit": 0,
                "row_offset": 0,
                "orderby": [],
                "post_processing": [contribution] if contribution else [],
            }
        )
        queries.append(totals)
    if form_data.get("server_pagination") and not is_download:
        rowcount = dict(query)
        rowcount.update(
            {
                "time_offsets": [],
                "row_limit": int(form_data.get("row_limit") or 0),
                "row_offset": 0,
                "post_processing": [],
                "is_rowcount": True,
            }
        )
        queries.insert(1, rowcount)
    return queries


def build_query_objects_from_form_data(  # noqa: C901
    form_data: dict[str, Any],
    *,
    viz_type: str | None = None,
    row_limit: int | None = None,
    order_desc: bool | None = None,
    filters_prepared: bool = False,
    secondary_form_data: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Build frontend-equivalent QueryObject dictionaries from form data.

    Every real MCP product path and the legacy common fallback share this
    extractor and the chart adapters below. This prevents compile/SQL/preview
    and saved/fallback data paths from silently selecting different fields.
    """
    effective_viz = viz_type or str(form_data.get("viz_type") or "")
    extraction_form_data = form_data
    if is_raw_query_mode(form_data):
        # ``extractQueryFields`` is strict, while the legacy server fallback has
        # always kept old saved tables executable by dropping malformed order
        # entries. Normalize that bounded raw-table input before invoking the
        # shared extractor; valid entries still use the centralized contract.
        extraction_form_data = {
            **form_data,
            "query_mode": "raw",
            "order_by_cols": orderby_from_form_data(form_data, [], effective_viz),
        }
    query = _base_query_object(
        extraction_form_data,
        row_limit=row_limit,
        order_desc=order_desc,
        filters_prepared=filters_prepared,
    )

    if effective_viz in {"table", "ag-grid-table"}:
        return _table_queries(form_data, query)
    if effective_viz == "histogram_v2":
        _histogram_query(form_data, query)
    elif effective_viz == "box_plot":
        _box_plot_query(form_data, query)
    elif effective_viz == "pivot_table_v2":
        _pivot_query(form_data, query)
    elif effective_viz == "waterfall":
        _waterfall_query(form_data, query)
    elif effective_viz in {"gantt", "gantt_chart"}:
        _gantt_query(form_data, query)
    elif effective_viz.startswith("echarts_timeseries") or effective_viz in {
        "echarts_area",
        "mixed_timeseries",
    }:
        _timeseries_query(form_data, query)
    elif effective_viz == "big_number":
        return _big_number_queries(form_data, query)
    elif effective_viz == "big_number_total":
        query["columns"] = []
    elif effective_viz == "handlebars":
        _normalize_query_orderby(query)
    elif effective_viz == "pie":
        if form_data.get("sort_by_metric") and form_data.get("metric") is not None:
            query["orderby"] = [[form_data["metric"], False]]
        query["post_processing"] = _pie_contribution_post_processing(
            list(query.get("metrics") or [])
        )
    elif effective_viz == "sunburst_v2":
        if not form_data.get("sort_by_metric"):
            query["orderby"] = []
        elif form_data.get("metric") is not None:
            query["orderby"] = [[form_data["metric"], False]]
    elif effective_viz == "ag-grid-pivot-table":
        query["columns"] = _temporalized_columns(
            form_data, _as_list(form_data.get("groupby"))
        )

    if not effective_viz and not query.get("orderby"):
        query["orderby"] = orderby_from_form_data(
            form_data, list(query.get("metrics") or []), effective_viz
        )

    if effective_viz != "mixed_timeseries":
        return [query]

    secondary = secondary_form_data or retain_mixed_timeseries_secondary_form_data(
        form_data
    )
    # MCP's established Mixed Timeseries contract treats an absent B metric or
    # group-by control as an empty secondary query. The frontend suffix helper
    # otherwise inherits the primary values, which would unexpectedly execute
    # query A twice for older saved charts that predate query B.
    if "metrics_b" not in form_data:
        secondary["metrics"] = []
    if "groupby_b" not in form_data:
        secondary["groupby"] = []
    query_b = _base_query_object(
        secondary,
        row_limit=row_limit,
        order_desc=order_desc,
        filters_prepared=filters_prepared,
    )
    # The shared x-axis is deliberately sourced from the complete form data;
    # Query B's suffixed vocabulary does not include an independent x-axis.
    secondary["x_axis"] = form_data.get("x_axis")
    _timeseries_query(secondary, query_b)
    return [query, query_b]


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
    :returns: A query-context dict with the frontend-equivalent query count.
    """
    if viz_type == "sunburst_v2":
        # Sunburst's typed/native contract rejects SIMPLE HAVING because the
        # frontend query mapper ignores it and a QueryObject filter would turn
        # it into WHERE. Validate before the export-compatible where-only pass.
        adhoc_filters_to_query_filters(form_data.get("adhoc_filters", []))

    queries = build_query_objects_from_form_data(form_data, viz_type=viz_type)
    # The legacy export fallback has always sent an explicit no-filter range.
    # Keep that stable while MCP's direct QueryObject path may omit the field,
    # matching JSON.stringify's handling of frontend ``undefined``.
    for query in queries:
        query.setdefault("time_range", "No filter")
        query.setdefault("orderby", [])

    return {
        "datasource": datasource,
        "queries": queries,
        "form_data": form_data,
    }
