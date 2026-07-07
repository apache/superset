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
"""Uniqueness contract for the owner (M2M) association tables.

The ``dashboard_user``, ``slice_user``, and ``sqlatable_user`` tables must
reject duplicate ``(user_id, <resource>_id)`` rows: duplicate owner rows break
owner removal through the DAO relationship diff (see issue #41623). The
contract is enforced by the composite primary key introduced in the
composite-PK association-tables migration (revision 2bee73611e32).

Unlike ``tests/unit_tests/migrations/composite_pk_association_tables_test.py``,
which rebuilds the post-migration shape synthetically, these tests assert
against the *live ORM* ``Table`` objects, so a regression in the model
definitions themselves is caught directly.
"""

import pytest
import sqlalchemy as sa
from sqlalchemy.exc import IntegrityError

from superset.connectors.sqla.models import sqlatable_user
from superset.models.dashboard import dashboard_user
from superset.models.slice import slice_user

# (association table, resource FK column name)
OWNER_TABLES: list[tuple[sa.Table, str]] = [
    (dashboard_user, "dashboard_id"),
    (slice_user, "slice_id"),
    (sqlatable_user, "table_id"),
]

_TABLE_IDS = [table.name for table, _ in OWNER_TABLES]


def _create_standalone(table: sa.Table) -> sa.engine.Engine:
    """Create just the association table on in-memory SQLite.

    SQLite does not enforce foreign keys unless explicitly enabled, so the
    real ``Table`` object can be created without its parent tables while its
    primary-key constraint remains fully enforced.
    """
    engine = sa.create_engine("sqlite:///:memory:")
    table.create(engine)
    return engine


@pytest.mark.parametrize("table,resource_col", OWNER_TABLES, ids=_TABLE_IDS)
def test_owner_table_declares_composite_pk(table: sa.Table, resource_col: str) -> None:
    """The pair uniqueness is declared in the model metadata itself.

    The primary key must cover exactly ``(user_id, <resource>_id)`` — a PK
    over both columns makes duplicate owner rows impossible at the database
    level, which is the guarantee issue #41623 asked for (a surrogate ``id``
    PK with no unique constraint allowed duplicates to accumulate).
    """
    pk_columns = {column.name for column in table.primary_key.columns}
    assert pk_columns == {"user_id", resource_col}


@pytest.mark.parametrize("table,resource_col", OWNER_TABLES, ids=_TABLE_IDS)
def test_owner_table_rejects_duplicate_owner_row(
    table: sa.Table, resource_col: str
) -> None:
    """Inserting the same (user, resource) owner pair twice fails."""
    engine = _create_standalone(table)
    with engine.begin() as conn:
        conn.execute(table.insert().values(user_id=1, **{resource_col: 1}))
        with pytest.raises(IntegrityError):
            conn.execute(table.insert().values(user_id=1, **{resource_col: 1}))


@pytest.mark.parametrize("table,resource_col", OWNER_TABLES, ids=_TABLE_IDS)
def test_owner_table_accepts_distinct_owner_rows(
    table: sa.Table, resource_col: str
) -> None:
    """Distinct pairs still insert fine — uniqueness is over the pair, not a
    single column: the same user may own several resources and a resource may
    have several owners."""
    engine = _create_standalone(table)
    with engine.begin() as conn:
        conn.execute(table.insert().values(user_id=1, **{resource_col: 1}))
        conn.execute(table.insert().values(user_id=1, **{resource_col: 2}))
        conn.execute(table.insert().values(user_id=2, **{resource_col: 1}))
        count = conn.execute(sa.select(sa.func.count()).select_from(table)).scalar_one()
        assert count == 3
