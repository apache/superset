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
"""Swap a Table V2 chart in Tree mode to its flat CSV/Excel export query.

``form_data.tree_export`` is an object with two keys:

* ``query``: a chart-data query object for all projected level columns, with
  ``metrics: []`` for grouping, deterministic ``orderby``, chart ``filters``,
  and a ``tree_rows`` post-processing operation. Its options contain
  ``levels`` (each level's ``id_column``, owned ``columns``, and optional
  ``time_column``) and symbolic ``time_ranges`` strings. The client sets
  ``row_offset: 0`` and ``row_limit: 0``; the server replaces the limit with
  ``SQL_MAX_ROW`` and resolves time ranges into ``bounds`` for the fold.
* ``child_filters``: temporal chart-data filter clauses for child levels that
  apply the date filter. The streaming path moves these into SQL in place of
  the fold.

This object is saved in the chart's query context. When non-date constraints
select parents, a second query resolves their IDs before the rows query runs.
Both queries go through the chart-data schema and authorization path.
"""

from __future__ import annotations

import copy
from typing import Any, Callable, TYPE_CHECKING

from flask import current_app
from flask_babel import gettext as _
from pandas import isna

from superset.charts.data.dashboard_filter_context import apply_dashboard_filter_context
from superset.charts.query_mode import is_tree_query_mode
from superset.common.chart_data import ChartDataResultFormat
from superset.common.db_query_status import QueryStatus
from superset.common.utils.time_range_utils import get_since_until_from_time_range
from superset.exceptions import QueryObjectValidationError
from superset.models.helpers import ExploreMixin
from superset.utils.date_parser import is_no_time_range

if TYPE_CHECKING:
    from superset.common.query_context import QueryContext

TREE_ROWS = "tree_rows"
EXPORT_FORMATS = {ChartDataResultFormat.CSV.value, ChartDataResultFormat.XLSX.value}


def _as_int(value: Any) -> int:
    """Coerce the configured parent limit, treating invalid limits as zero."""
    try:
        return int(value or 0)
    except (OverflowError, TypeError, ValueError):
        return 0


def _tree_export_spec(form_data: dict[str, Any] | None) -> dict[str, Any] | None:
    """Return the flat export specification for a Tree chart."""
    if not isinstance(form_data, dict) or not is_tree_query_mode(form_data):
        return None
    export = form_data.get("tree_export")
    if isinstance(export, dict) and isinstance(export.get("query"), dict):
        return export
    return None


def tree_export_uses_streaming(
    form_data: dict[str, Any] | None, expected_rows: int | None = None
) -> bool:
    """Apply the Tree CSV streaming threshold to the configured parent limit."""
    if form_data is None or _tree_export_spec(form_data) is None:
        return False
    threshold = current_app.config.get("CSV_STREAMING_ROW_THRESHOLD", 100000)
    return _as_int(form_data.get("row_limit")) >= threshold or (
        expected_rows is not None and expected_rows >= threshold
    )


def _is_range(value: Any) -> bool:
    """Check whether a value supplies an active time range."""
    return isinstance(value, str) and bool(value) and not is_no_time_range(value)


def _bounds(query: dict[str, Any], time_ranges: list[Any]) -> list[list[str | None]]:
    """Resolve symbolic time ranges into ISO bounds for the fold."""
    present = [value for value in time_ranges if isinstance(value, str) and value]
    values = [value for value in present if _is_range(value)]
    if not present and _is_range(query.get("time_range")):
        values = [query["time_range"]]
    bounds: list[list[str | None]] = []
    for value in values:
        since, until = get_since_until_from_time_range(
            time_range=value, extras=query.get("extras")
        )
        bounds.append(
            [
                since.isoformat() if since else None,
                until.isoformat() if until else None,
            ]
        )
    return bounds


def _move_child_filters_into_sql(
    query: dict[str, Any], child_filters: list[dict[str, Any]]
) -> None:
    """Apply child filters to the streamed SQL in place of the fold."""
    filters = query.get("filters") or []
    query["filters"] = filters
    for child_filter in copy.deepcopy(child_filters):
        if not any(
            existing.get("col") == child_filter.get("col")
            and existing.get("op") == child_filter.get("op")
            and existing.get("val") == child_filter.get("val")
            for existing in filters
        ):
            filters.append(child_filter)
    query["post_processing"] = [
        step
        for step in query.get("post_processing") or []
        if step.get("operation") != TREE_ROWS
    ]


def _fill_bounds(query: dict[str, Any]) -> None:
    """Keep child time columns only when the fold has active bounds."""
    for step in query.get("post_processing") or []:
        if step.get("operation") != TREE_ROWS:
            continue
        options = step.setdefault("options", {})
        bounds = _bounds(query, options.pop("time_ranges", None) or [])
        if bounds:
            options["bounds"] = bounds
        else:
            for level in options.get("levels", []):
                level.pop("time_column", None)


def _refresh_child_time_filters(
    query: dict[str, Any],
    levels: list[Any],
    child_filters: list[dict[str, Any]],
    dashboard_range: str,
) -> list[dict[str, Any]]:
    """Rebuild child predicates and fold bounds from the effective root range."""
    if not levels or not isinstance(levels[0], dict):
        return child_filters
    root_column = levels[0].get("time_column")
    if not isinstance(root_column, str) or not root_column:
        return child_filters

    filters = [flt for flt in query.get("filters") or [] if flt not in child_filters]
    query["filters"] = filters
    has_root_filter = any(
        flt.get("op") == "TEMPORAL_RANGE" and flt.get("col") == root_column
        for flt in filters
    )
    if not has_root_filter:
        filters.append(
            {
                "col": root_column,
                "op": "TEMPORAL_RANGE",
                "val": dashboard_range,
                "isExtra": True,
            }
        )

    child_filters = []
    for step in query.get("post_processing") or []:
        if step.get("operation") == TREE_ROWS:
            options = step.setdefault("options", {})
            options["time_ranges"] = [dashboard_range]
            child_filters.extend(
                _set_child_time_columns(query, levels, options, dashboard_range)
            )
    return child_filters


def _set_child_time_columns(
    query: dict[str, Any],
    levels: list[Any],
    options: dict[str, Any],
    dashboard_range: str,
) -> list[dict[str, Any]]:
    """Assign child time columns to the fold or to SQL when unprojected."""
    filters = query["filters"]
    child_filters: list[dict[str, Any]] = []
    for level, exported in zip(levels[1:], options.get("levels", [])[1:], strict=False):
        if not isinstance(level, dict) or not level.get("apply_date_filter"):
            continue
        column = level.get("time_column")
        if not isinstance(column, str) or not column:
            continue
        flt = {"col": column, "op": "TEMPORAL_RANGE", "val": dashboard_range}
        if flt not in child_filters:
            child_filters.append(flt)
        if column in (query.get("columns") or []):
            exported["time_column"] = column
        elif flt not in filters:
            filters.append(flt)
    return child_filters


def _export_levels(query: dict[str, Any]) -> list[dict[str, Any]]:
    """Read the linked levels from the export fold options."""
    for step in query.get("post_processing") or []:
        if step.get("operation") == TREE_ROWS:
            return (step.get("options") or {}).get("levels") or []
    return []


def _has_non_date_constraint(query: dict[str, Any]) -> bool:
    """Check whether the export applies a non-date filter or SQL WHERE."""
    return bool((query.get("extras") or {}).get("where")) or any(
        flt.get("op") != "TEMPORAL_RANGE" for flt in query.get("filters") or []
    )


def resolve_tree_export_parents(query_context: QueryContext) -> None:
    """Resolve authorized parent IDs and constrain the export rows query."""
    export = _tree_export_spec(query_context.form_data)
    if (
        export is None
        or query_context.result_format not in EXPORT_FORMATS
        or len(query_context.queries) != 2
    ):
        return
    rows, parents = query_context.queries
    levels = _export_levels(export["query"])
    id_column = levels[0].get("id_column") if levels else None
    if not isinstance(id_column, str) or id_column not in parents.columns:
        raise QueryObjectValidationError(_("Invalid Tree export parent ID column"))

    datasource = query_context.datasource
    if isinstance(datasource, ExploreMixin):
        result = datasource.query(parents.to_dict())
    else:
        result = datasource.get_query_result(parents)
    if result.status == QueryStatus.FAILED:
        raise QueryObjectValidationError(
            result.error_message or _("Tree export parent query failed")
        )

    values = [] if result.df.empty else result.df[id_column].tolist()
    ids = list(dict.fromkeys(None if isna(value) else value for value in values))
    if ids:
        rows.filter.append({"col": id_column, "op": "IN", "val": ids})
    else:
        rows.filter.extend(
            [
                {"col": id_column, "op": "IS NULL"},
                {"col": id_column, "op": "IS NOT NULL"},
            ]
        )
    query_context.queries = [rows]
    query_context.cache_values["queries"] = query_context.cache_values["queries"][:1]


def apply_tree_export(
    form: dict[str, Any],
    read_expected_rows: Callable[[], int | None] | None = None,
    *,
    dashboard_extra_form_data: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Replace a Tree table's queries with its export query for CSV and Excel.

    The chart's ``buildQuery`` puts the export query under
    ``form_data.tree_export``. For any other chart, format or request
    without that query, the form comes back unchanged (the same object).

    :param form: The chart data request body
    :param read_expected_rows: Returns the request's ``expected_rows``; called
        only for a Tree table CSV export
    :param dashboard_extra_form_data: Dashboard defaults for the export query
    :returns: The form, or a copy with the rows query and optional parent query
    """
    form_data = form.get("form_data")
    if form.get("result_format") not in EXPORT_FORMATS:
        return form
    export = _tree_export_spec(form_data)
    if form_data is None or export is None:
        return form

    query: dict[str, Any] = copy.deepcopy(export["query"])
    query["row_limit"] = current_app.config["SQL_MAX_ROW"]
    query["row_offset"] = 0
    prepared = {**form, "queries": [query]}
    child_filters = export.get("child_filters") or []
    if dashboard_extra_form_data:
        dashboard_extra_form_data = dashboard_extra_form_data.copy()
        dashboard_range = dashboard_extra_form_data.get("time_range")
        if not _is_range(dashboard_range):
            dashboard_extra_form_data.pop("time_range", None)
            dashboard_range = None
        apply_dashboard_filter_context(prepared, dashboard_extra_form_data)
        if isinstance(dashboard_range, str):
            child_filters = _refresh_child_time_filters(
                query, form_data.get("levels") or [], child_filters, dashboard_range
            )
    levels = _export_levels(query)
    if len(levels) >= 2 and _has_non_date_constraint(query):
        columns = levels[0]["columns"]
        filters = query.get("filters") or []
        parent_limit = _as_int(form_data.get("row_limit"))
        prepared["queries"].append(
            {
                **query,
                "columns": columns,
                "orderby": [
                    order for order in query.get("orderby") or [] if order[0] in columns
                ],
                "filters": [flt for flt in filters if flt not in child_filters],
                "row_limit": min(parent_limit, query["row_limit"])
                if parent_limit > 0
                else query["row_limit"],
                "post_processing": [],
            }
        )
        query["filters"] = [flt for flt in filters if flt.get("op") == "TEMPORAL_RANGE"]
        query["extras"] = {**(query.get("extras") or {}), "where": "", "having": ""}

    if form["result_format"] == ChartDataResultFormat.CSV.value and (
        tree_export_uses_streaming(form_data)
        or (
            read_expected_rows
            and tree_export_uses_streaming(form_data, read_expected_rows())
        )
    ):
        _move_child_filters_into_sql(query, child_filters)
    else:
        _fill_bounds(query)

    return prepared
