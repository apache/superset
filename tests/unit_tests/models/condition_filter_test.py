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
The dashboard Condition filter (``filter_condition``) sends a single
``{col, op, val}`` clause in ``extra_form_data.filters``. These tests check
that every operator it offers is merged into the chart's form data and
produces the expected rows, without any backend changes.
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Any, TYPE_CHECKING

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import create_engine
from sqlalchemy.orm.session import Session
from sqlalchemy.pool import StaticPool

from superset.utils.core import merge_extra_form_data, QueryObjectFilterClause

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlaTable


@pytest.fixture
def table(mocker: MockerFixture, session: Session) -> SqlaTable:
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.models.core import Database

    SqlaTable.metadata.create_all(session.get_bind())

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    connection = engine.raw_connection()
    connection.execute(
        "CREATE TABLE sales (id INTEGER, country TEXT, price INTEGER, active BOOLEAN)"
    )
    connection.executemany(
        "INSERT INTO sales VALUES (?, ?, ?, ?)",
        [
            (1, "CA", 50, 1),
            (2, "US", 150, 0),
            (3, None, 200, 1),
            (4, "CN", None, 0),
        ],
    )
    connection.commit()

    database = Database(database_name="db", sqlalchemy_uri="sqlite://")

    @contextmanager
    def mock_get_sqla_engine(catalog=None, schema=None, **kwargs):
        yield engine

    mocker.patch.object(database, "get_sqla_engine", new=mock_get_sqla_engine)

    return SqlaTable(
        database=database,
        schema=None,
        table_name="sales",
        columns=[
            TableColumn(column_name="id", type="INTEGER"),
            TableColumn(column_name="country", type="TEXT"),
            TableColumn(column_name="price", type="INTEGER"),
            TableColumn(column_name="active", type="BOOLEAN"),
        ],
    )


def _matching_ids(table: SqlaTable, clause: QueryObjectFilterClause) -> list[int]:
    query = table.get_sqla_query(
        columns=["id"],
        filter=[clause],
        is_timeseries=False,
        row_limit=100,
    )
    with table.database.get_sqla_engine() as engine:
        with engine.connect() as connection:
            rows = connection.execute(query.sqla_query).fetchall()
    return sorted(row[0] for row in rows)


@pytest.mark.parametrize(
    "clause,expected",
    [
        ({"col": "price", "op": "==", "val": 150}, [2]),
        ({"col": "price", "op": ">", "val": 100}, [2, 3]),
        # values typed into the filter can arrive as strings
        ({"col": "price", "op": ">", "val": "100"}, [2, 3]),
        ({"col": "price", "op": "<", "val": 150}, [1]),
        ({"col": "price", "op": ">=", "val": 150}, [2, 3]),
        ({"col": "price", "op": "<=", "val": 150}, [1, 2]),
        # != keeps NULL rows on purpose
        ({"col": "country", "op": "!=", "val": "US"}, [1, 3, 4]),
        ({"col": "country", "op": "LIKE", "val": "C%"}, [1, 4]),
        ({"col": "country", "op": "IN", "val": ["CA", "US"]}, [1, 2]),
        # like !=, NOT IN keeps NULL rows
        ({"col": "country", "op": "NOT IN", "val": ["CA", "US"]}, [3, 4]),
        ({"col": "country", "op": "IS NULL"}, [3]),
        ({"col": "price", "op": "IS NOT NULL"}, [1, 2, 3]),
        ({"col": "active", "op": "==", "val": True}, [1, 3]),
        ({"col": "active", "op": "==", "val": "false"}, [2, 4]),
    ],
)
def test_condition_filter_clause(
    table: SqlaTable,
    clause: QueryObjectFilterClause,
    expected: list[int],
) -> None:
    assert _matching_ids(table, clause) == expected


def test_condition_filter_is_merged_into_chart_filters() -> None:
    form_data: dict[str, Any] = {
        "adhoc_filters": [],
        "extra_form_data": {
            "filters": [{"col": "country", "op": "IS NULL"}],
        },
    }

    merge_extra_form_data(form_data)

    assert form_data["adhoc_filters"] == [
        {
            "clause": "WHERE",
            "comparator": None,
            "expressionType": "SIMPLE",
            "isExtra": True,
            "operator": "IS NULL",
            "subject": "country",
            "filterOptionName": form_data["adhoc_filters"][0]["filterOptionName"],
        }
    ]
