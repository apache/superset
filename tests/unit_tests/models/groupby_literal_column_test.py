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

import sqlglot
from sqlalchemy.orm.session import Session
from sqlglot import expressions as exp


def test_literal_custom_sql_dimension_is_not_a_bare_constant_in_group_by(
    session: Session,
) -> None:
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.models.core import Database

    SqlaTable.metadata.create_all(session.get_bind())
    table = SqlaTable(
        database=Database(
            database_name="db", sqlalchemy_uri="postgresql://user:pass@host/db"
        ),
        schema=None,
        table_name="orders",
        columns=[
            TableColumn(column_name="region", type="TEXT"),
            TableColumn(column_name="amount", type="FLOAT"),
        ],
    )

    sqla_query = table.get_sqla_query(
        columns=[
            {"label": "bucket", "sqlExpression": "'Other'", "expressionType": "SQL"},
            "region",
        ],
        metrics=[
            {"expressionType": "SQL", "sqlExpression": "SUM(amount)", "label": "total"}
        ],
        is_timeseries=False,
        row_limit=100,
        filter=[],
        extras={},
        orderby=[],
    ).sqla_query
    with table.database.get_sqla_engine() as engine:
        sql = str(
            sqla_query.compile(
                dialect=engine.dialect, compile_kwargs={"literal_binds": True}
            )
        )

    select = sqlglot.parse_one(sql, dialect="postgres")
    assert isinstance(select, exp.Select)

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
