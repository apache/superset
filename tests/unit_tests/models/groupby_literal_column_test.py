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
A Custom SQL dimension holding a bare string literal (``'Other'``) must not
reach the ``GROUP BY`` clause as that bare constant.

PostgreSQL and its relatives reject a non-integer constant there
(``non-integer constant in GROUP BY``), so the chart query fails even though the
same literal is fine in the ``SELECT`` list.
"""

from __future__ import annotations

from typing import Any

import pytest
import sqlglot
from sqlalchemy import create_engine
from sqlalchemy.orm.session import Session
from sqlglot import expressions as exp

from superset.connectors.sqla.models import SqlaTable

METRICS = [{"expressionType": "SQL", "sqlExpression": "SUM(amount)", "label": "total"}]


def _adhoc(sql_expression: str, label: str = "bucket") -> dict[str, str]:
    return {"label": label, "sqlExpression": sql_expression, "expressionType": "SQL"}


def _make_table(session: Session, uri: str) -> SqlaTable:
    from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
    from superset.models.core import Database

    SqlaTable.metadata.create_all(session.get_bind())
    return SqlaTable(
        database=Database(database_name="db", sqlalchemy_uri=uri),
        schema=None,
        table_name="orders",
        columns=[
            TableColumn(column_name="region", type="TEXT"),
            TableColumn(column_name="amount", type="FLOAT"),
            TableColumn(column_name="constant_col", type="TEXT", expression="'Other'"),
        ],
        metrics=[SqlMetric(metric_name="constant_metric", expression="42")],
    )


@pytest.fixture
def table(session: Session) -> SqlaTable:
    return _make_table(session, "postgresql://user:pass@host/db")


def _compile_sql(table: SqlaTable, **overrides: Any) -> str:
    query_obj: dict[str, Any] = {
        "metrics": METRICS,
        "is_timeseries": False,
        "row_limit": 100,
        "filter": [],
        "extras": {},
        "orderby": [],
    }
    query_obj.update(overrides)
    sqla_query = table.get_sqla_query(**query_obj).sqla_query
    with table.database.get_sqla_engine() as engine:
        return str(
            sqla_query.compile(
                dialect=engine.dialect, compile_kwargs={"literal_binds": True}
            )
        )


def _compile(table: SqlaTable, **overrides: Any) -> tuple[exp.Select, str]:
    sql = _compile_sql(table, **overrides)
    select = sqlglot.parse_one(sql, dialect="postgres")
    assert isinstance(select, exp.Select)
    return select, sql


def _group_keys(select: exp.Select) -> list[str]:
    group = select.args.get("group")
    return [key.sql(dialect="postgres") for key in group.expressions] if group else []


def _constant_keys(select: exp.Select) -> list[str]:
    """GROUP BY keys that are a bare constant (an integer is a select ordinal)."""
    group = select.args.get("group")
    return [
        key.sql(dialect="postgres")
        for key in (group.expressions if group else [])
        if isinstance(key.unnest(), (exp.Literal, exp.Null, exp.Boolean))
    ]


def test_literal_custom_sql_dimension_is_not_a_bare_constant_in_group_by(
    table: SqlaTable,
) -> None:
    select, sql = _compile(table, columns=[_adhoc("'Other'"), "region"])

    # The literal dimension is still selected under its label ...
    assert "bucket" in select.named_selects, sql

    # ... but it must not be a GROUP BY key on its own: only the real dimension
    # groups the rows.
    group = select.args.get("group")
    group_keys = group.expressions if group else []
    bare_constants = [
        key.sql(dialect="postgres")
        for key in group_keys
        if isinstance(key.unnest(), (exp.Literal, exp.Null, exp.Boolean))
        and not key.unnest().is_int
    ]
    assert not bare_constants, f"bare constant in GROUP BY: {bare_constants}\n{sql}"
    assert any(
        isinstance(key, exp.Column) and key.name == "region" for key in group_keys
    ), sql


@pytest.mark.parametrize(
    "expression",
    ["'Other'", "('Other')", "3", "1.5", "-1", "(-1.5)", "NULL", "TRUE"],
)
def test_constant_custom_sql_dimension_is_omitted_from_group_by(
    table: SqlaTable, expression: str
) -> None:
    select, sql = _compile(table, columns=[_adhoc(expression), "region"])
    assert select.named_selects == ["bucket", "region", "total"], sql
    assert _group_keys(select) == ["region"], sql


def test_constant_calculated_column_is_omitted_from_group_by(
    table: SqlaTable,
) -> None:
    select, sql = _compile(table, columns=["constant_col", "region"])
    assert "constant_col" in select.named_selects, sql
    assert _group_keys(select) == ["region"], sql


def test_constant_raw_string_dimension_is_omitted_from_group_by(
    table: SqlaTable,
) -> None:
    select, sql = _compile(table, columns=["'Other'", "region"])
    assert _group_keys(select) == ["region"], sql


@pytest.mark.parametrize(
    "expression",
    [
        "CASE WHEN 1=1 THEN 'x' END",
        "CAST('x' AS VARCHAR)",
        "'a' || region",
        "UPPER('x')",
    ],
)
def test_expression_containing_a_constant_stays_a_group_by_key(
    table: SqlaTable, expression: str
) -> None:
    select, sql = _compile(table, columns=[_adhoc(expression), "region"])
    keys = _group_keys(select)
    assert len(keys) == 2, sql
    assert keys[-1] == "region", sql


def test_group_by_is_unchanged_without_constant_keys(table: SqlaTable) -> None:
    select, sql = _compile(table, columns=["region"])
    assert _group_keys(select) == ["region"], sql


def test_all_constant_keys_with_a_metric_keep_group_by(table: SqlaTable) -> None:
    select, sql = _compile(table, columns=[_adhoc("'Other'")])
    assert _group_keys(select) == ["'Other'"], sql


@pytest.mark.parametrize("expression", ["1", "'Other'"])
def test_all_constant_keys_with_a_non_aggregate_metric_keep_group_by(
    table: SqlaTable, expression: str
) -> None:
    select, sql = _compile(
        table, metrics=["constant_metric"], columns=[_adhoc(expression)]
    )
    assert _group_keys(select) == [expression], sql


def test_all_constant_keys_without_a_metric_keep_group_by(table: SqlaTable) -> None:
    select, sql = _compile(table, metrics=[], columns=[_adhoc("'Other'")])
    assert _group_keys(select) == ["'Other'"], sql


@pytest.mark.parametrize("group_others", [False, True])
def test_constant_dimension_is_omitted_from_series_limit_group_by(
    table: SqlaTable, group_others: bool
) -> None:
    dimensions = [_adhoc("'Other'"), "region"]
    select, sql = _compile(
        table,
        columns=dimensions,
        groupby=dimensions,
        series_columns=["bucket", "region"],
        series_limit=3,
        group_others_when_limit_reached=group_others,
    )
    subquery = next(
        sub for sub in select.find_all(exp.Subquery) if sub.alias == "series_limit"
    )
    inner = subquery.this
    assert isinstance(inner, exp.Select)
    assert _constant_keys(inner) == [], sql
    assert _group_keys(inner) == ["region"], sql
    assert _constant_keys(select) == [], sql


def test_series_limit_with_non_aggregate_metric_keeps_a_real_key(
    table: SqlaTable,
) -> None:
    dimensions = [_adhoc("'Other'"), "region"]
    select, sql = _compile(
        table,
        metrics=["constant_metric", *METRICS],
        columns=dimensions,
        groupby=dimensions,
        series_columns=["bucket", "region"],
        series_limit=3,
    )
    inner = next(
        sub for sub in select.find_all(exp.Subquery) if sub.alias == "series_limit"
    ).this
    assert isinstance(inner, exp.Select)
    assert _group_keys(inner) == ["region"], sql


def test_series_limit_keeps_keys_when_every_dimension_is_constant(
    table: SqlaTable,
) -> None:
    dimensions = [_adhoc("'Other'")]
    select, sql = _compile(
        table,
        columns=dimensions,
        groupby=dimensions,
        series_columns=["bucket"],
        series_limit=3,
    )
    inner = next(
        sub for sub in select.find_all(exp.Subquery) if sub.alias == "series_limit"
    ).this
    assert isinstance(inner, exp.Select)
    assert _group_keys(inner) == ["'Other'"], sql
    assert _group_keys(select) == ["'Other'"], sql


def test_sqlite_boolean_keyword_dimension_resolves_to_the_column(
    session: Session,
) -> None:
    """
    SQLite has no boolean literals: ``TRUE`` is an identifier that resolves to a
    same-named column, so ``(TRUE)`` is a real grouping key there, not a constant.
    """
    table = _make_table(session, "sqlite://")
    sql = _compile_sql(table, columns=[_adhoc("(TRUE)", "flag"), "region"])

    with create_engine("sqlite://").begin() as connection:
        connection.exec_driver_sql(
            'CREATE TABLE orders (region TEXT, "TRUE" TEXT, amount FLOAT)'
        )
        connection.exec_driver_sql(
            "INSERT INTO orders VALUES ('west', 'A', 2), ('west', 'B', 3), "
            "('west', 'A', 4)"
        )
        rows = connection.exec_driver_sql(sql).fetchall()

    assert sorted((flag, total) for flag, _region, total in rows) == [
        ("A", 6),
        ("B", 3),
    ], sql
