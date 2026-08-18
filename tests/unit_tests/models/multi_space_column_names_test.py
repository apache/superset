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
Regression tests for https://github.com/apache/superset/issues/32879.

Physical columns whose names contain multiple consecutive spaces
(e.g. ``Eladó  1``) used to be routed through the sqlparse-based
``validate_adhoc_subquery`` as raw, unquoted SQL, which misparsed the
name and rejected the query with "Custom SQL fields cannot contain
sub-queries.". The SIP-117 migration to the sqlglot-based parser and the
column-resolution logic in ``get_sqla_query`` (registered columns are
rendered as properly quoted SQLAlchemy columns instead of raw adhoc SQL)
fixed this; these tests pin the fixed behavior so it cannot regress.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

if TYPE_CHECKING:
    from superset.models.core import Database

MULTI_SPACE_COLUMN = "Eladó  1"


@pytest.fixture
def database(session: Session) -> Database:
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database

    SqlaTable.metadata.create_all(session.get_bind())
    return Database(database_name="db", sqlalchemy_uri="sqlite://")


def _compile(database: Database, sqla_query: object) -> str:
    with database.get_sqla_engine() as engine:
        return str(
            sqla_query.compile(  # type: ignore[attr-defined]
                dialect=engine.dialect,
                compile_kwargs={"literal_binds": True},
            )
        )


def test_get_sqla_query_groupby_column_with_multiple_spaces(
    database: Database,
) -> None:
    """
    A registered physical column with multiple consecutive spaces in its
    name can be used as a chart dimension (the exact scenario from
    issue #32879) without tripping the adhoc-subquery validation.
    """
    from superset.connectors.sqla.models import SqlaTable, TableColumn

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="t",
        columns=[
            TableColumn(column_name="id", type="INTEGER"),
            TableColumn(column_name=MULTI_SPACE_COLUMN, type="TEXT"),
        ],
    )

    # Must not raise SupersetSecurityException ("Custom SQL fields cannot
    # contain sub-queries.") as it did on 4.1.x.
    sqla_query = table.get_sqla_query(
        groupby=[MULTI_SPACE_COLUMN],
        metrics=[],
        is_timeseries=False,
        row_limit=100,
    )

    sql = _compile(database, sqla_query.sqla_query)
    # The column is emitted as a single quoted identifier with both spaces
    # preserved, so the database resolves the real column.
    assert f'"{MULTI_SPACE_COLUMN}"' in sql
    assert "GROUP BY" in sql.upper()


def test_get_sqla_query_select_column_with_multiple_spaces(
    database: Database,
) -> None:
    """
    The raw-columns path (drill to detail / samples) also handles a
    multi-space physical column without raising.
    """
    from superset.connectors.sqla.models import SqlaTable, TableColumn

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="t",
        columns=[
            TableColumn(column_name="id", type="INTEGER"),
            TableColumn(column_name=MULTI_SPACE_COLUMN, type="TEXT"),
        ],
    )

    sqla_query = table.get_sqla_query(
        columns=["id", MULTI_SPACE_COLUMN],
        metrics=None,
        is_timeseries=False,
        row_limit=100,
    )

    sql = _compile(database, sqla_query.sqla_query)
    assert f'"{MULTI_SPACE_COLUMN}"' in sql


@pytest.mark.parametrize(
    "engine,expression",
    [
        ("sqlite", f'"{MULTI_SPACE_COLUMN}"'),
        ("postgresql", f'"{MULTI_SPACE_COLUMN}"'),
        ("mssql", f"[{MULTI_SPACE_COLUMN}]"),
    ],
)
def test_validate_adhoc_subquery_accepts_quoted_multi_space_identifier(
    mocker: MockerFixture,
    engine: str,
    expression: str,
) -> None:
    """
    The sqlglot-based ``validate_adhoc_subquery`` accepts a quoted
    identifier containing multiple consecutive spaces: it is not a
    sub-query, so no SupersetSecurityException is raised and the SQL is
    returned unchanged.
    """
    from superset.models.helpers import validate_adhoc_subquery

    # Only consulted for RLS when a subquery is detected, which must not
    # happen here.
    database = mocker.MagicMock()

    assert (
        validate_adhoc_subquery(
            expression,
            database,
            None,
            "",
            engine,
        )
        == expression
    )
