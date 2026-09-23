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
"""The Length array filter operators: length(col) compared to a number."""

from __future__ import annotations

from typing import Any

import pytest
from flask import Flask
from pytest_mock import MockerFixture

from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
from superset.exceptions import QueryObjectValidationError
from superset.models.core import Database
from superset.superset_typing import QueryObjectDict
from superset.utils.core import FilterOperator


def _make_dataset(mocker: MockerFixture) -> SqlaTable:
    database = Database(id=1, database_name="test_db", sqlalchemy_uri="sqlite://")
    columns = [
        TableColumn(column_name="skills", type="Array(String)"),
        TableColumn(column_name="city", type="VARCHAR(100)"),
    ]
    dataset = SqlaTable(
        table_name="jobs",
        columns=columns,
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


def _clickhouse(mocker: MockerFixture, dataset: SqlaTable) -> None:
    from superset.db_engine_specs.clickhouse import ClickHouseEngineSpec

    mocker.patch.object(
        SqlaTable, "db_engine_spec", new=property(lambda self: ClickHouseEngineSpec)
    )


def _sql(dataset: SqlaTable, op: str, val: Any, col: str = "skills") -> str:
    query: QueryObjectDict = {
        "granularity": None,
        "from_dttm": None,
        "to_dttm": None,
        "is_timeseries": False,
        "groupby": ["city"],
        "metrics": ["count"],
        "filter": [{"col": col, "op": op, "val": val}],
        "columns": [],
    }
    return dataset.get_query_str_extended(query, mutate=False).sql.lower()


@pytest.mark.parametrize(
    "op,expected",
    [
        (FilterOperator.LENGTH_EQUALS, "length(skills) = 3"),
        (FilterOperator.LENGTH_GREATER_THAN, "length(skills) > 3"),
        (FilterOperator.LENGTH_LESS_THAN, "length(skills) < 3"),
        (FilterOperator.LENGTH_GREATER_THAN_OR_EQUALS, "length(skills) >= 3"),
        (FilterOperator.LENGTH_LESS_THAN_OR_EQUALS, "length(skills) <= 3"),
    ],
)
def test_length_operators_generate_length_comparison(
    mocker: MockerFixture, app: Flask, op: FilterOperator, expected: str
) -> None:
    dataset = _make_dataset(mocker)
    _clickhouse(mocker, dataset)
    with app.test_request_context():
        sql = _sql(dataset, op.value, 3)
    assert expected in sql


def test_length_accepts_string_number(mocker: MockerFixture, app: Flask) -> None:
    """A numeric string value is coerced (e.g. '2' -> length(col) > 2)."""
    dataset = _make_dataset(mocker)
    _clickhouse(mocker, dataset)
    with app.test_request_context():
        sql = _sql(dataset, FilterOperator.LENGTH_GREATER_THAN.value, "2")
    assert "length(skills) > 2" in sql


def test_length_non_numeric_value_raises(mocker: MockerFixture, app: Flask) -> None:
    dataset = _make_dataset(mocker)
    _clickhouse(mocker, dataset)
    with app.test_request_context():  # noqa: SIM117
        with pytest.raises(QueryObjectValidationError):
            _sql(dataset, FilterOperator.LENGTH_EQUALS.value, "abc")


def test_length_on_scalar_column_raises(mocker: MockerFixture, app: Flask) -> None:
    """Length on a scalar column is rejected even on an array-capable engine."""
    dataset = _make_dataset(mocker)
    _clickhouse(mocker, dataset)
    with app.test_request_context():  # noqa: SIM117
        with pytest.raises(QueryObjectValidationError):
            _sql(dataset, FilterOperator.LENGTH_GREATER_THAN.value, 1, col="city")


def test_length_unsupported_engine_raises(mocker: MockerFixture, app: Flask) -> None:
    """On an engine without array support (sqlite) the length op is rejected."""
    dataset = _make_dataset(mocker)
    with app.test_request_context():  # noqa: SIM117
        with pytest.raises(QueryObjectValidationError):
            _sql(dataset, FilterOperator.LENGTH_GREATER_THAN.value, 1)
