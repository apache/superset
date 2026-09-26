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
Engines that resolve an identifier to a SELECT alias before a same-named source
column (``select_alias_shadows_source_column``, e.g. ClickHouse) must not get a
chart query whose alias shadows a column: Explore labels a time-grain x-axis
after its column, so ``DATETIME(ts, 'start of day') AS ts`` would make the
time-range ``WHERE ts >= ...`` filter on the bucket and the GROUP BY truncate
the alias again.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any, TYPE_CHECKING

import pandas as pd
import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database

ALIAS_TS = re.compile(r"\bAS\s+\"?ts\"?(?!\w)")


@pytest.fixture
def database(session: Session) -> Database:
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database

    SqlaTable.metadata.create_all(session.get_bind())
    return Database(database_name="db", sqlalchemy_uri="sqlite://")


@pytest.fixture
def table(database: Database) -> SqlaTable:
    from superset.connectors.sqla.models import SqlaTable, TableColumn

    return SqlaTable(
        database=database,
        schema=None,
        table_name="t",
        columns=[
            TableColumn(column_name="ts", type="DATETIME", is_dttm=True),
            TableColumn(column_name="amount", type="FLOAT"),
            TableColumn(column_name="label", type="TEXT"),
        ],
    )


@pytest.fixture
def shadowing(mocker: MockerFixture) -> None:
    from superset.db_engine_specs.sqlite import SqliteEngineSpec

    mocker.patch.object(
        SqliteEngineSpec, "select_alias_shadows_source_column", True, create=True
    )


def _query_obj(orderby: bool = True) -> dict[str, Any]:
    # What Explore sends for an x-axis on a dataset column: the label is the
    # column name.
    return {
        "columns": [
            {
                "timeGrain": "P1D",
                "columnType": "BASE_AXIS",
                "sqlExpression": "ts",
                "label": "ts",
                "expressionType": "SQL",
            }
        ],
        "metrics": [
            {"expressionType": "SQL", "sqlExpression": "COUNT(*)", "label": "n"}
        ],
        "orderby": [("ts", True)] if orderby else [],
        "granularity": "ts",
        "from_dttm": datetime(2024, 1, 1, 12),
        "to_dttm": datetime(2024, 1, 3),
        "is_timeseries": False,
        "row_limit": 100,
        "filter": [],
        "extras": {},
    }


def _compile(table: SqlaTable, query_obj: dict[str, Any]) -> tuple[Any, str]:
    sqlaq = table.get_sqla_query(**query_obj)
    with table.database.get_sqla_engine() as engine:
        sql = str(
            sqlaq.sqla_query.compile(
                dialect=engine.dialect, compile_kwargs={"literal_binds": True}
            )
        )
    return sqlaq, sql


def test_clickhouse_specs_declare_alias_shadowing() -> None:
    from superset.db_engine_specs.base import BaseEngineSpec
    from superset.db_engine_specs.clickhouse import (
        ClickHouseConnectEngineSpec,
        ClickHouseEngineSpec,
    )

    assert BaseEngineSpec.select_alias_shadows_source_column is False
    assert ClickHouseEngineSpec.select_alias_shadows_source_column is True
    assert ClickHouseConnectEngineSpec.select_alias_shadows_source_column is True


def test_alias_is_kept_by_default(table: SqlaTable) -> None:
    _, sql = _compile(table, _query_obj())
    assert ALIAS_TS.search(sql), sql


@pytest.mark.parametrize("orderby", [True, False])
def test_shadowing_alias_is_renamed(
    table: SqlaTable, shadowing: None, orderby: bool
) -> None:
    sqlaq, sql = _compile(table, _query_obj(orderby))
    assert not ALIAS_TS.search(sql), sql
    assert "AS ts__" in sql
    # The time filter and the GROUP BY read the column, not the alias.
    where = sql[sql.index("WHERE") : sql.index("GROUP BY")]
    assert re.search(r"\bts >=", where), sql
    assert sqlaq.labels_expected == ["ts", "n"]


def test_alias_of_the_column_itself_is_kept(table: SqlaTable, shadowing: None) -> None:
    query_obj = _query_obj()
    query_obj["columns"] = ["label"]
    query_obj["orderby"] = []
    _, sql = _compile(table, query_obj)
    assert re.search(r"\bAS\s+\"?label\"?(?!\w)", sql), sql
    assert "label__" not in sql


def test_metric_named_after_a_column_is_renamed(
    table: SqlaTable, shadowing: None
) -> None:
    query_obj = _query_obj()
    query_obj["metrics"] = [
        {"expressionType": "SQL", "sqlExpression": "SUM(amount)", "label": "label"}
    ]
    query_obj["orderby"] = []
    sqlaq, sql = _compile(table, query_obj)
    assert "AS label__" in sql, sql
    assert sqlaq.labels_expected == ["ts", "label"]


@pytest.mark.parametrize("rows", [[[datetime(2024, 1, 1), 1]], []])
def test_results_carry_the_expected_labels(
    table: SqlaTable, shadowing: None, mocker: MockerFixture, rows: list[Any]
) -> None:
    from superset.models.core import Database

    def get_df(sql: str, catalog: Any, schema: Any, mutator: Any = None) -> Any:
        # Name the columns after the SELECT aliases, as the engine would.
        names = re.findall(r"\bAS\s+\"?(\w+)\"?", sql)
        df = pd.DataFrame(rows, columns=names)
        return mutator(df) if mutator else df

    mocker.patch.object(Database, "get_df", side_effect=get_df)
    result = table.query(_query_obj())
    assert list(result.df.columns) == ["ts", "n"]
