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
"""Tests that 'No filter' temporal range produces no WHERE 1 = 1 clause."""

from __future__ import annotations

from datetime import datetime, timezone

from flask import Flask
from pytest_mock import MockerFixture

from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
from superset.models.core import Database
from superset.superset_typing import QueryObjectDict


def _make_dataset(mocker: MockerFixture) -> SqlaTable:
    database = Database(
        id=1,
        database_name="test_db",
        sqlalchemy_uri="sqlite://",
    )
    columns = [
        TableColumn(column_name="time_start", is_dttm=1, type="TIMESTAMP"),
        TableColumn(column_name="value", type="INTEGER"),
    ]
    dataset = SqlaTable(
        table_name="test_table",
        columns=columns,
        main_dttm_col="time_start",
        database=database,
        metrics=[SqlMetric(metric_name="count", expression="COUNT(*)")],
    )
    mocker.patch(
        "superset.connectors.sqla.models.security_manager.get_guest_rls_filters",
        return_value=[],
    )
    mocker.patch(
        "superset.connectors.sqla.models.security_manager.is_guest_user",
        return_value=False,
    )
    return dataset


def test_get_time_filter_returns_none_when_no_bounds(
    mocker: MockerFixture,
    app: Flask,
) -> None:
    """get_time_filter returns None when both start_dttm and end_dttm are None."""
    dataset = _make_dataset(mocker)
    time_col = dataset.columns[0]

    with app.test_request_context():
        result = dataset.get_time_filter(
            time_col=time_col,
            start_dttm=None,
            end_dttm=None,
        )

    assert result is None


def test_get_time_filter_returns_clause_with_partial_bounds(
    mocker: MockerFixture,
    app: Flask,
) -> None:
    """get_time_filter returns a clause when at least one bound is set."""
    dataset = _make_dataset(mocker)
    time_col = dataset.columns[0]

    with app.test_request_context():
        result_start_only = dataset.get_time_filter(
            time_col=time_col,
            start_dttm=datetime(2024, 1, 1, tzinfo=timezone.utc),
            end_dttm=None,
        )
        result_end_only = dataset.get_time_filter(
            time_col=time_col,
            start_dttm=None,
            end_dttm=datetime(2024, 1, 31, tzinfo=timezone.utc),
        )
        result_both = dataset.get_time_filter(
            time_col=time_col,
            start_dttm=datetime(2024, 1, 1, tzinfo=timezone.utc),
            end_dttm=datetime(2024, 1, 31, tzinfo=timezone.utc),
        )

    assert result_start_only is not None
    assert result_end_only is not None
    assert result_both is not None


def test_no_filter_temporal_range_omits_where_1_equals_1(
    mocker: MockerFixture,
    app: Flask,
) -> None:
    """Generating SQL with 'No filter' time range must not produce WHERE 1 = 1."""
    dataset = _make_dataset(mocker)

    # "No filter" is represented as None/None for from_dttm/to_dttm
    query_obj: QueryObjectDict = {
        "granularity": "time_start",
        "from_dttm": None,
        "to_dttm": None,
        "is_timeseries": False,
        "filter": [
            {
                "col": "time_start",
                "op": "TEMPORAL_RANGE",
                "val": "No filter",
            }
        ],
        "metrics": ["count"],
        "columns": [],
    }

    with app.test_request_context():
        sqla_query = dataset.get_query_str_extended(query_obj, mutate=False)
        generated_sql = sqla_query.sql

    assert "1 = 1" not in generated_sql, (
        f"Expected no '1 = 1' in generated SQL when 'No filter' is selected, "
        f"but got: {generated_sql}"
    )


def test_no_filter_with_other_filters_preserved(
    mocker: MockerFixture,
    app: Flask,
) -> None:
    """'No filter' time range + regular filter => WHERE has only the regular filter."""
    dataset = _make_dataset(mocker)

    query_obj: QueryObjectDict = {
        "granularity": "time_start",
        "from_dttm": None,
        "to_dttm": None,
        "is_timeseries": False,
        "filter": [
            {
                "col": "time_start",
                "op": "TEMPORAL_RANGE",
                "val": "No filter",
            },
            {
                "col": "value",
                "op": "==",
                "val": "42",
            },
        ],
        "metrics": ["count"],
        "columns": [],
    }

    with app.test_request_context():
        sqla_query = dataset.get_query_str_extended(query_obj, mutate=False)
        generated_sql = sqla_query.sql

    assert "1 = 1" not in generated_sql, (
        f"Expected no '1 = 1' with 'No filter' + regular filter, got: {generated_sql}"
    )
    # Regular filter should still be present
    assert "value" in generated_sql.lower(), (
        f"Regular filter on 'value' should still appear in SQL, got: {generated_sql}"
    )


def test_actual_from_to_dttm_produces_time_filter(
    mocker: MockerFixture,
    app: Flask,
) -> None:
    """Generating SQL with actual from/to dates applies a WHERE time filter."""
    dataset = _make_dataset(mocker)

    query_obj: QueryObjectDict = {
        "granularity": "time_start",
        "from_dttm": datetime(2024, 1, 1, tzinfo=timezone.utc),
        "to_dttm": datetime(2024, 1, 31, tzinfo=timezone.utc),
        "is_timeseries": False,
        "filter": [],
        "metrics": ["count"],
        "columns": [],
    }

    with app.test_request_context():
        sqla_query = dataset.get_query_str_extended(query_obj, mutate=False)
        generated_sql = sqla_query.sql

    assert "1 = 1" not in generated_sql, (
        f"Expected no '1 = 1' in SQL with actual date bounds, got: {generated_sql}"
    )
    assert "time_start" in generated_sql.lower(), (
        f"Expected time_start column in WHERE clause, got: {generated_sql}"
    )


def test_temporal_range_filter_with_actual_dates_produces_time_filter(
    mocker: MockerFixture,
    app: Flask,
) -> None:
    """TEMPORAL_RANGE filter with actual dates applies a WHERE time filter."""
    dataset = _make_dataset(mocker)

    query_obj: QueryObjectDict = {
        "granularity": None,
        "from_dttm": None,
        "to_dttm": None,
        "is_timeseries": False,
        "filter": [
            {
                "col": "time_start",
                "op": "TEMPORAL_RANGE",
                "val": "2024-01-01T00:00:00 : 2024-01-31T00:00:00",
            }
        ],
        "metrics": ["count"],
        "columns": [],
    }

    with app.test_request_context():
        sqla_query = dataset.get_query_str_extended(query_obj, mutate=False)
        generated_sql = sqla_query.sql

    assert "time_start" in generated_sql.lower(), (
        f"Expected time_start in WHERE clause for TEMPORAL_RANGE with dates, "
        f"got: {generated_sql}"
    )
    assert "1 = 1" not in generated_sql, (
        f"Expected no '1 = 1' for TEMPORAL_RANGE with actual dates, "
        f"got: {generated_sql}"
    )
