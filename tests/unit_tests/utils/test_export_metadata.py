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
from __future__ import annotations

import csv
import io
from collections.abc import Iterator
from datetime import datetime, timezone
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from freezegun import freeze_time

from superset.utils.core import FilterOperator
from superset.utils.export_metadata import (
    build_filter_rows,
    FilterRow,
    filters_csv,
    format_filter_value,
    format_time_range,
    MAX_LISTED_VALUES,
    merge_filter_rows,
    metadata_table,
)

EXPORTED_AT = datetime(2026, 11, 8, 12, 0, 0, tzinfo=timezone.utc)
RESOLVE_TIME_RANGE = (
    "superset.common.utils.time_range_utils.get_since_until_from_time_range"
)


def make_query(
    filters: list[dict[str, Any]] | None = None,
    time_range: str | None = None,
    granularity: str | None = None,
    extras: dict[str, Any] | None = None,
) -> MagicMock:
    query = MagicMock()
    query.filter = filters or []
    query.time_range = time_range
    query.time_shift = None
    query.granularity = granularity
    query.extras = extras or {}
    return query


def make_datasource(verbose_map: dict[str, str] | None = None) -> MagicMock:
    datasource = MagicMock()
    datasource.verbose_map = verbose_map or {}
    return datasource


def applied(*columns: str) -> list[dict[str, str]]:
    return [{"column": column} for column in columns]


def row(filter_: str, condition: str, value: str, source: str) -> FilterRow:
    return FilterRow(filter=filter_, condition=condition, value=value, source=source)


@pytest.fixture
def custom_sql_visible() -> Iterator[None]:
    """Run as a user who is not an embedded guest."""
    with patch(
        "superset.utils.error_sanitization.is_sanitization_required",
        return_value=False,
    ):
        yield


def test_lists_applied_filters_with_operator_words(app_context: None) -> None:
    query = make_query(
        [
            {"col": "country", "op": FilterOperator.IN, "val": ["France", "Spain"]},
            {"col": "age", "op": FilterOperator.GREATER_THAN_OR_EQUALS, "val": 20},
            {"col": "name", "op": FilterOperator.NOT_ILIKE, "val": "%test%"},
        ]
    )

    rows = build_filter_rows(
        query, make_datasource(), applied("country", "age", "name"), {}
    )

    assert rows == [
        row("country", "is one of", "France, Spain", "Chart filter"),
        row("age", "is greater than or equal to", "20", "Chart filter"),
        row("name", "is not like (case insensitive)", "%test%", "Chart filter"),
    ]


def test_drill_time_buckets_are_listed_as_dates(app_context: None) -> None:
    # Drill to detail sends a time bucket as epoch milliseconds with its grain.
    query = make_query(
        [
            {"col": "ds", "op": "==", "val": -31536000000, "grain": "P1Y"},
            {"col": "ds", "op": "==", "val": 1104541200000, "grain": "PT1H"},
            {"col": "num", "op": "==", "val": 1104537600000},
        ]
    )

    rows = build_filter_rows(query, make_datasource(), None, {})

    assert [r["value"] for r in rows] == [
        "1969-01-01 (Year)",
        "2005-01-01 01:00:00 (Hour)",
        "1104537600000",
    ]


def test_drill_time_bucket_out_of_range_is_listed_as_sent(app_context: None) -> None:
    query = make_query([{"col": "ds", "op": "==", "val": 10**20, "grain": "P1Y"}])

    rows = build_filter_rows(query, make_datasource(), None, {})

    assert rows[0]["value"] == str(10**20)


def test_null_and_boolean_values_are_written_as_words() -> None:
    assert format_filter_value([None, True, False]) == "NULL, true, false"


def test_filter_on_a_column_without_a_name_is_skipped(app_context: None) -> None:
    query = make_query(
        [
            {"col": {"expressionType": "SQL"}, "op": "==", "val": 1},
            {"col": "country", "op": "==", "val": "US"},
        ]
    )

    rows = build_filter_rows(query, make_datasource(), applied("country"), {})

    assert [r["filter"] for r in rows] == ["country"]


def test_every_operator_has_words(app_context: None) -> None:
    filters = [{"col": "c", "op": op, "val": "x"} for op in FilterOperator]
    filters = [f for f in filters if f["op"] != FilterOperator.TEMPORAL_RANGE]

    rows = build_filter_rows(make_query(filters), make_datasource(), None, {})

    operators = {str(op) for op in FilterOperator}
    assert not {r["condition"] for r in rows} & operators


def test_valueless_operators_leave_value_empty(app_context: None) -> None:
    query = make_query([{"col": "c", "op": FilterOperator.IS_NULL, "val": None}])

    rows = build_filter_rows(query, make_datasource(), applied("c"), {})

    assert rows == [row("c", "is null", "", "Chart filter")]


def test_drops_filters_that_were_not_applied(app_context: None) -> None:
    query = make_query(
        [
            {"col": "country", "op": "==", "val": "US"},
            {"col": "missing", "op": "==", "val": "x", "isExtra": True},
        ]
    )

    rows = build_filter_rows(query, make_datasource(), applied("country"), {})

    assert [r["filter"] for r in rows] == ["country"]


def test_lists_every_filter_when_status_is_unknown(app_context: None) -> None:
    query = make_query(
        [
            {"col": "country", "op": "==", "val": "US"},
            {"col": "state", "op": "==", "val": "CA"},
        ]
    )

    rows = build_filter_rows(query, make_datasource(), None, {})

    assert [r["filter"] for r in rows] == ["country", "state"]


def test_uses_dataset_display_names(app_context: None) -> None:
    query = make_query([{"col": "cntry", "op": "==", "val": "US"}])

    rows = build_filter_rows(
        query, make_datasource({"cntry": "Country"}), applied("cntry"), {}
    )

    assert rows[0]["filter"] == "Country"


def test_adhoc_column_is_listed_under_its_label(app_context: None) -> None:
    column = {"label": "Upper name", "sqlExpression": "UPPER(name)"}
    query = make_query([{"col": column, "op": "==", "val": "BOB"}])

    rows = build_filter_rows(query, make_datasource(), applied("Upper name"), {})

    assert rows == [row("Upper name", "equals", "BOB", "Chart filter")]


def test_dashboard_filters_are_marked(app_context: None) -> None:
    query = make_query([{"col": "region", "op": "IN", "val": ["N"], "isExtra": True}])

    rows = build_filter_rows(query, make_datasource(), applied("region"), {})

    assert rows[0]["source"] == "Dashboard filter"


def test_long_value_lists_are_cut(app_context: None) -> None:
    values = [str(i) for i in range(MAX_LISTED_VALUES + 5)]

    text = format_filter_value(values)

    assert text.endswith(f"{MAX_LISTED_VALUES - 1} and 5 more")
    assert f", {MAX_LISTED_VALUES}," not in text


def test_short_value_lists_stay_whole(app_context: None) -> None:
    values = ["France", "Germany", "Italy", "Spain", "Portugal", "Greece"]

    assert format_filter_value(values) == ", ".join(values)


@freeze_time("2026-10-19")
def test_time_range_lists_resolved_dates(app_context: None) -> None:
    query = make_query(
        [{"col": "ds", "op": "TEMPORAL_RANGE", "val": "Last week"}],
        time_range="Last week",
    )

    # A dashboard that sets no time range of its own.
    rows = build_filter_rows(
        query, make_datasource(), applied("ds"), {"extra_form_data": {}}
    )

    assert rows == [
        row("ds", "is within", "Last week (2026-10-12 to 2026-10-19)", "Chart filter")
    ]


@pytest.mark.parametrize(
    "since, until, expected",
    [
        (datetime(2026, 1, 1), None, "Since 2026 (from 2026-01-01)"),
        (None, datetime(2026, 1, 1), "Since 2026 (before 2026-01-01)"),
        (None, None, "Since 2026"),
        (
            datetime(2026, 1, 1, 6, 30),
            datetime(2026, 2, 1),
            "Since 2026 (2026-01-01 06:30:00 to 2026-02-01)",
        ),
    ],
)
def test_time_range_lists_open_and_partial_ranges(
    app_context: None,
    since: datetime | None,
    until: datetime | None,
    expected: str,
) -> None:
    with patch(
        RESOLVE_TIME_RANGE,
        return_value=(since, until),
    ):
        assert format_time_range("Since 2026") == expected


def test_time_range_already_showing_its_dates_is_not_repeated(
    app_context: None,
) -> None:
    with patch(
        RESOLVE_TIME_RANGE,
        return_value=(datetime(2026, 1, 1), datetime(2026, 2, 1)),
    ):
        assert format_time_range("2026-01-01 to 2026-02-01") == (
            "2026-01-01 to 2026-02-01"
        )


def test_unparseable_time_range_is_listed_as_written(app_context: None) -> None:
    with patch(
        RESOLVE_TIME_RANGE,
        side_effect=ValueError("bad range"),
    ):
        assert format_time_range("not a range") == "not a range"


@freeze_time("2026-11-06")
def test_dashboard_time_range_over_saved_range_is_a_dashboard_filter(
    app_context: None,
) -> None:
    # The factory replaced the saved "Last week" with the dashboard's range
    # but left isExtra unset, because the saved range was bounded.
    query = make_query(
        [{"col": "ds", "op": "TEMPORAL_RANGE", "val": "Last year"}],
        time_range="Last year",
    )
    form_data = {"extra_form_data": {"time_range": "Last year"}}

    rows = build_filter_rows(query, make_datasource(), applied("ds"), form_data)

    assert rows == [
        row(
            "ds",
            "is within",
            "Last year (2025-11-06 to 2026-11-06)",
            "Dashboard filter",
        )
    ]


def test_no_filter_time_range_is_skipped(app_context: None) -> None:
    query = make_query(
        [{"col": "ds", "op": "TEMPORAL_RANGE", "val": "No filter"}],
        time_range="No filter",
        granularity="ds",
    )

    assert build_filter_rows(query, make_datasource(), applied("ds"), {}) == []


@freeze_time("2026-10-19")
def test_legacy_time_column_range_is_listed(app_context: None) -> None:
    query = make_query(time_range="Last week", granularity="ds")

    rows = build_filter_rows(query, make_datasource(), [], {})

    assert rows == [
        row("ds", "is within", "Last week (2026-10-12 to 2026-10-19)", "Chart filter")
    ]


def test_custom_sql_is_listed(app_context: None, custom_sql_visible: None) -> None:
    query = make_query(
        extras={"where": "(revenue > 100)", "having": "(SUM(x) > 5)"},
    )

    rows = build_filter_rows(query, make_datasource(), [], {})

    assert rows == [
        row("Custom SQL", "WHERE", "(revenue > 100)", "Custom SQL"),
        row("Custom SQL", "HAVING", "(SUM(x) > 5)", "Custom SQL"),
    ]


def test_custom_sql_is_hidden_from_guests_without_query_access(
    app_context: None,
) -> None:
    query = make_query(extras={"where": "(tenant_id = 1)"})

    with (
        patch(
            "superset.utils.error_sanitization.is_sanitization_required",
            return_value=True,
        ),
        patch("superset.security_manager", new_callable=MagicMock) as security_manager,
    ):
        security_manager.can_access.return_value = False
        rows = build_filter_rows(query, make_datasource(), [], {})

    assert rows == []
    security_manager.can_access.assert_called_once_with("can_view_query", "Dashboard")


def test_custom_sql_is_shown_to_guests_with_query_access(app_context: None) -> None:
    query = make_query(extras={"where": "(tenant_id = 1)"})

    with (
        patch(
            "superset.utils.error_sanitization.is_sanitization_required",
            return_value=True,
        ),
        patch("superset.security_manager", new_callable=MagicMock) as security_manager,
    ):
        security_manager.can_access.return_value = True
        rows = build_filter_rows(query, make_datasource(), [], {})

    assert [r["value"] for r in rows] == ["(tenant_id = 1)"]


def test_merge_drops_repeated_rows() -> None:
    first = [row("a", "equals", "1", "Chart filter")]
    second = [
        row("a", "equals", "1", "Chart filter"),
        row("b", "equals", "2", "Chart filter"),
    ]

    assert merge_filter_rows([first, None, second]) == [first[0], second[1]]


def test_table_without_filters_says_so(app_context: None) -> None:
    table = metadata_table([], "My chart", EXPORTED_AT)

    assert table == [
        ["Exported from", "My chart"],
        ["Exported at", "2026-11-08T12:00:00+00:00"],
        [],
        ["Filter", "Condition", "Value", "Source"],
        ["No filters were applied"],
    ]


def test_formula_values_are_escaped(app_context: None) -> None:
    rows = [row("=HYPERLINK()", "equals", "=cmd|' /C calc'!A0", "Chart filter")]

    text = filters_csv(rows, "+chart", exported_at=EXPORTED_AT)

    parsed = list(csv.reader(io.StringIO(text)))
    assert parsed[0][1] == "'+chart"
    assert parsed[4][0] == "'=HYPERLINK()"
    assert parsed[4][2] == "'=cmd\\|' /C calc'!A0"


def test_table_cells_are_left_for_each_writer_to_escape(app_context: None) -> None:
    # Excel writers apply their own formula protection to the same table.
    rows = [row("=HYPERLINK()", "equals", "=A1|x", "Chart filter")]

    table = metadata_table(rows, "+chart", EXPORTED_AT)

    assert table[0][1] == "+chart"
    assert table[4] == ["=HYPERLINK()", "equals", "=A1|x", "Chart filter"]


def test_line_breaks_cannot_start_a_new_line(app_context: None) -> None:
    rows = [row("note", "equals", "first\n=second\r\nthird", "Chart filter")]

    text = filters_csv(rows, "chart", exported_at=EXPORTED_AT)

    assert text.splitlines()[-1] == "note,equals,first =second third,Chart filter"


def test_filters_csv_round_trips_values_with_separators(app_context: None) -> None:
    rows = [row("Région", "is one of", "Québec, Montréal", "Dashboard filter")]

    text = filters_csv(rows, "Ventes; Québec", sep=";", exported_at=EXPORTED_AT)

    parsed = list(csv.reader(io.StringIO(text), delimiter=";"))
    assert parsed[0] == ["Exported from", "Ventes; Québec"]
    assert parsed[-1] == ["Région", "is one of", "Québec, Montréal", "Dashboard filter"]
