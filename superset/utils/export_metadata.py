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
Describe the filters applied to a chart query, for inclusion in data exports.

The rows are built on the backend from the query that actually ran, so they
reflect dashboard overrides and leave out filters the datasource rejected.
"""

from __future__ import annotations

import csv
import io
import logging
from datetime import datetime, timezone
from typing import Any, Iterable, TYPE_CHECKING, TypedDict

from flask_babel import gettext as _

from superset.utils.core import FilterOperator, get_column_name
from superset.utils.csv import escape_value
from superset.utils.date_parser import is_no_time_range

if TYPE_CHECKING:
    from superset.common.query_object import QueryObject
    from superset.explorables.base import Explorable

logger = logging.getLogger(__name__)

# A filter listing more values than this shows the first ones and a count.
MAX_LISTED_VALUES = 100


class FilterRow(TypedDict):
    """One applied filter, as listed in an export's filter table."""

    filter: str
    condition: str
    value: str
    source: str


def _operator_words() -> dict[str, str]:
    """Return the words used for each operator, translated for the request."""
    return {
        FilterOperator.EQUALS: _("equals"),
        FilterOperator.NOT_EQUALS: _("does not equal"),
        FilterOperator.GREATER_THAN: _("is greater than"),
        FilterOperator.LESS_THAN: _("is less than"),
        FilterOperator.GREATER_THAN_OR_EQUALS: _("is greater than or equal to"),
        FilterOperator.LESS_THAN_OR_EQUALS: _("is less than or equal to"),
        FilterOperator.LIKE: _("is like"),
        FilterOperator.NOT_LIKE: _("is not like"),
        FilterOperator.ILIKE: _("is like (case insensitive)"),
        FilterOperator.NOT_ILIKE: _("is not like (case insensitive)"),
        FilterOperator.IS_NULL: _("is null"),
        FilterOperator.IS_NOT_NULL: _("is not null"),
        FilterOperator.IN: _("is one of"),
        FilterOperator.NOT_IN: _("is not one of"),
        FilterOperator.IS_TRUE: _("is true"),
        FilterOperator.IS_FALSE: _("is false"),
        FilterOperator.TEMPORAL_RANGE: _("is within"),
        FilterOperator.CONTAINS_ANY: _("contains any of"),
        FilterOperator.CONTAINS_ALL: _("contains all of"),
        FilterOperator.IS_EMPTY: _("is empty"),
        FilterOperator.IS_NOT_EMPTY: _("is not empty"),
        FilterOperator.LENGTH_EQUALS: _("has a length equal to"),
        FilterOperator.LENGTH_GREATER_THAN: _("has a length greater than"),
        FilterOperator.LENGTH_LESS_THAN: _("has a length less than"),
        FilterOperator.LENGTH_GREATER_THAN_OR_EQUALS: _(
            "has a length greater than or equal to"
        ),
        FilterOperator.LENGTH_LESS_THAN_OR_EQUALS: _(
            "has a length less than or equal to"
        ),
    }


# Operators whose condition says everything, so the value cell stays empty.
_VALUELESS_OPERATORS = frozenset(
    {
        FilterOperator.IS_NULL,
        FilterOperator.IS_NOT_NULL,
        FilterOperator.IS_TRUE,
        FilterOperator.IS_FALSE,
        FilterOperator.IS_EMPTY,
        FilterOperator.IS_NOT_EMPTY,
    }
)


def _format_scalar(value: Any) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def format_filter_value(value: Any) -> str:
    """
    Turn a filter value into text, listing at most ``MAX_LISTED_VALUES`` values.

    :param value: a scalar or a list of values
    :return: the values separated by commas
    """
    if not isinstance(value, (list, tuple, set)):
        return _format_scalar(value)
    values = [_format_scalar(item) for item in value]
    if len(values) <= MAX_LISTED_VALUES:
        return ", ".join(values)
    remaining = len(values) - MAX_LISTED_VALUES
    return _(
        "%(values)s and %(count)s more",
        values=", ".join(values[:MAX_LISTED_VALUES]),
        count=remaining,
    )


def _format_datetime(value: datetime) -> str:
    if value.time() == datetime.min.time():
        return value.date().isoformat()
    return value.isoformat(sep=" ")


def format_time_range(
    time_range: str,
    time_shift: str | None = None,
    extras: dict[str, Any] | None = None,
) -> str:
    """
    Describe a time range with the dates it resolved to.

    :param time_range: a time range expression such as "Last week"
    :param time_shift: the query's time shift, if any
    :param extras: the query's extras, which may hold relative start and end
    :return: text such as "Last week (2026-10-12 to 2026-10-19)"
    """
    # pylint: disable=import-outside-toplevel
    from superset.common.utils.time_range_utils import (
        get_since_until_from_time_range,
    )

    try:
        since, until = get_since_until_from_time_range(
            time_range=time_range, time_shift=time_shift, extras=extras
        )
    except Exception:  # pylint: disable=broad-except
        # An unparseable range still ran through the query's own handling;
        # listing the expression is better than failing the export.
        logger.warning("Could not resolve time range %s", time_range, exc_info=True)
        return time_range

    if since and until:
        resolved = _(
            "%(since)s to %(until)s",
            since=_format_datetime(since),
            until=_format_datetime(until),
        )
    elif since:
        resolved = _("from %(since)s", since=_format_datetime(since))
    elif until:
        resolved = _("before %(until)s", until=_format_datetime(until))
    else:
        return time_range
    if resolved == time_range:
        return time_range
    return f"{time_range} ({resolved})"


def _dashboard_time_range(form_data: dict[str, Any] | None) -> str | None:
    extra_form_data = (form_data or {}).get("extra_form_data")
    if isinstance(extra_form_data, dict):
        time_range = extra_form_data.get("time_range")
        if isinstance(time_range, str):
            return time_range
    return None


def _can_view_custom_sql() -> bool:
    """
    Whether the export may list the chart's custom SQL.

    Follows ``redact_sensitive_query_fields``: embedded guests only see the
    chart's SQL when their role can view the query.
    """
    # pylint: disable=import-outside-toplevel
    from superset import security_manager
    from superset.utils.error_sanitization import is_sanitization_required

    if not is_sanitization_required():
        return True
    return security_manager.can_access("can_view_query", "Dashboard")


def _is_applied(column: Any, applied_columns: set[Any] | None) -> bool:
    """Whether a filter on ``column`` reached the query, when that is known."""
    try:
        column_name = get_column_name(column)
    except ValueError:
        return False
    return applied_columns is None or column_name in applied_columns


def _custom_sql_rows(query_obj: QueryObject) -> list[FilterRow]:
    """List the query's custom WHERE and HAVING SQL, if the user may see it."""
    extras = query_obj.extras or {}
    clauses = [
        (clause.upper(), sql.strip())
        for clause in ("where", "having")
        if isinstance(sql := extras.get(clause), str) and sql.strip()
    ]
    if not clauses or not _can_view_custom_sql():
        return []
    label = _("Custom SQL")
    return [
        FilterRow(filter=label, condition=clause, value=sql, source=label)
        for clause, sql in clauses
    ]


def build_filter_rows(
    query_obj: QueryObject,
    datasource: Explorable | None,
    applied_filters: list[dict[str, Any]] | None,
    form_data: dict[str, Any] | None,
) -> list[FilterRow]:
    """
    List the filters applied to one query, one row per filter.

    :param query_obj: the query that ran
    :param datasource: the query's datasource, used for column display names
    :param applied_filters: the ``applied_filters`` status of the query, or
        ``None`` when it is not known, in which case every filter is listed
    :param form_data: the chart's form data, used to recognise a dashboard
        time range that replaced the chart's saved one
    :return: the rows, in the order the filters appear in the query
    """
    verbose_map: dict[str, Any] = getattr(datasource, "verbose_map", None) or {}
    applied_columns = (
        {item.get("column") for item in applied_filters if isinstance(item, dict)}
        if applied_filters is not None
        else None
    )
    dashboard_time_range = _dashboard_time_range(form_data)
    operator_words = _operator_words()
    chart_source = _("Chart filter")
    dashboard_source = _("Dashboard filter")

    def time_row(column: Any, time_range: str, is_extra: bool) -> FilterRow:
        # Superset only marks a replaced time range as a dashboard filter when
        # the saved range was unbounded, so also compare with the dashboard's.
        from_dashboard = is_extra or time_range == dashboard_time_range
        return FilterRow(
            filter=get_column_name(column, verbose_map),
            condition=operator_words[FilterOperator.TEMPORAL_RANGE],
            value=format_time_range(time_range, query_obj.time_shift, query_obj.extras),
            source=dashboard_source if from_dashboard else chart_source,
        )

    rows: list[FilterRow] = []
    has_time_row = False
    for filter_ in query_obj.filter:
        column = filter_.get("col")
        if column is None or not _is_applied(column, applied_columns):
            continue
        operator = filter_.get("op")
        value = filter_.get("val")
        is_extra = bool(filter_.get("isExtra"))
        if operator == FilterOperator.TEMPORAL_RANGE:
            if isinstance(value, str) and not is_no_time_range(value):
                rows.append(time_row(column, value, is_extra))
                has_time_row = True
            continue
        rows.append(
            FilterRow(
                filter=get_column_name(column, verbose_map),
                condition=operator_words.get(str(operator), str(operator)),
                value=(
                    ""
                    if operator in _VALUELESS_OPERATORS
                    else format_filter_value(value)
                ),
                source=dashboard_source if is_extra else chart_source,
            )
        )

    # Charts saved with a legacy time column carry the range on the query
    # rather than as a temporal filter.
    if (
        not has_time_row
        and query_obj.granularity
        and query_obj.time_range
        and not is_no_time_range(query_obj.time_range)
    ):
        rows.append(time_row(query_obj.granularity, query_obj.time_range, False))

    rows.extend(_custom_sql_rows(query_obj))
    return rows


def merge_filter_rows(row_lists: Iterable[list[FilterRow] | None]) -> list[FilterRow]:
    """
    Combine the rows of several queries, dropping repeated rows.

    :param row_lists: the rows of each query, in query order
    :return: each distinct row once, in the order first seen
    """
    seen: set[tuple[str, str, str, str]] = set()
    merged: list[FilterRow] = []
    for rows in row_lists:
        for row in rows or []:
            key = (row["filter"], row["condition"], row["value"], row["source"])
            if key not in seen:
                seen.add(key)
                merged.append(row)
    return merged


def _clean_cell(value: str) -> str:
    """Keep a cell on one line and stop spreadsheets reading it as a formula."""
    one_line = " ".join(value.splitlines())
    return escape_value(one_line)


def metadata_table(
    rows: list[FilterRow],
    chart_name: str,
    exported_at: datetime | None = None,
) -> list[list[str]]:
    """
    Lay out the filter rows as a table with a short header.

    :param rows: the filter rows
    :param chart_name: the name of the exported chart
    :param exported_at: when the export was made, defaulting to now
    :return: the table's rows, every cell protected against formula injection
    """
    exported_at = exported_at or datetime.now(timezone.utc)
    table: list[list[str]] = [
        [_("Exported from"), chart_name],
        [_("Exported at"), exported_at.isoformat(timespec="seconds")],
        [],
        [_("Filter"), _("Condition"), _("Value"), _("Source")],
    ]
    if rows:
        table.extend(
            [row["filter"], row["condition"], row["value"], row["source"]]
            for row in rows
        )
    else:
        table.append([_("No filters were applied")])
    return [[_clean_cell(str(cell)) for cell in row] for row in table]


def filters_csv(
    rows: list[FilterRow],
    chart_name: str,
    sep: str = ",",
    exported_at: datetime | None = None,
) -> str:
    """
    Write the filter table as CSV text.

    :param rows: the filter rows
    :param chart_name: the name of the exported chart
    :param sep: the field separator, matching the exported data file
    :param exported_at: when the export was made, defaulting to now
    :return: the CSV text
    """
    output = io.StringIO()
    writer = csv.writer(output, delimiter=sep, lineterminator="\n")
    writer.writerows(metadata_table(rows, chart_name, exported_at))
    return output.getvalue()
