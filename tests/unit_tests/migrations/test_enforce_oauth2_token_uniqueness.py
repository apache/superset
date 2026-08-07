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
"""Tests for migration ``da0e3f0081bf_enforce_oauth2_token_uniqueness``.

Runs the migration's ``upgrade()`` and ``downgrade()`` against an
in-memory SQLite engine seeded with pre-existing duplicate
(user_id, database_id) rows -- the state a deployment could be in today,
since the prior plain index never stopped them from accumulating.
"""

from __future__ import annotations

from importlib import import_module

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import (
    Column,
    create_engine,
    inspect,
    Integer,
    MetaData,
    select,
    Table,
)
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError

migration = import_module(
    "superset.migrations.versions."
    "2026-08-07_09-00_da0e3f0081bf_enforce_oauth2_token_uniqueness"
)

TABLE_NAME: str = migration.TABLE_NAME  # "database_user_oauth2_tokens"
INDEX_NAME: str = migration.INDEX_NAME  # "idx_user_id_database_id"


@pytest.fixture
def engine() -> Engine:
    """In-memory SQLite seeded with a minimal pre-migration token table,
    including duplicate (user_id, database_id) rows -- id 2 and id 3 both
    belong to user 1 + database 10, which the plain index never prevented.
    """
    engine = create_engine("sqlite:///:memory:", future=True)
    md = MetaData()
    table = Table(
        TABLE_NAME,
        md,
        Column("id", Integer, primary_key=True),
        Column("user_id", Integer, nullable=False),
        Column("database_id", Integer, nullable=False),
    )
    md.create_all(engine)

    with engine.begin() as conn:
        conn.execute(
            table.insert(),
            [
                {"id": 1, "user_id": 1, "database_id": 20},
                {"id": 2, "user_id": 1, "database_id": 10},
                {"id": 3, "user_id": 1, "database_id": 10},
                {"id": 4, "user_id": 2, "database_id": 10},
            ],
        )

    return engine


def _indexes(engine: Engine) -> dict[str, bool]:
    """Map of index name -> ``unique`` flag on the target table."""
    return {ix["name"]: ix["unique"] for ix in inspect(engine).get_indexes(TABLE_NAME)}


def _rows(engine: Engine) -> list[tuple[int, int, int]]:
    with engine.begin() as conn:
        table = Table(TABLE_NAME, MetaData(), autoload_with=conn)
        return sorted(
            (r.id, r.user_id, r.database_id)
            for r in conn.execute(select(table)).fetchall()
        )


def test_upgrade_deletes_duplicates_keeping_highest_id(engine: Engine) -> None:
    """Only the highest-id row survives per (user_id, database_id) pair;
    unrelated pairs are untouched.
    """
    with engine.begin() as conn:
        ctx = MigrationContext.configure(conn)
        with Operations.context(ctx):
            migration.upgrade()

    assert _rows(engine) == [
        (1, 1, 20),
        (3, 1, 10),
        (4, 2, 10),
    ], "upgrade() must keep only the highest-id row per duplicate pair"


def test_upgrade_makes_the_index_unique(engine: Engine) -> None:
    """upgrade() replaces the plain lookup index with a unique one."""
    with engine.begin() as conn:
        ctx = MigrationContext.configure(conn)
        with Operations.context(ctx):
            migration.upgrade()

    assert _indexes(engine) == {INDEX_NAME: True}


def test_upgrade_index_rejects_new_duplicates(engine: Engine) -> None:
    """After upgrade(), inserting a second row for an existing
    (user_id, database_id) pair is rejected at the DB level.
    """
    with engine.begin() as conn:
        ctx = MigrationContext.configure(conn)
        with Operations.context(ctx):
            migration.upgrade()

    table = Table(TABLE_NAME, MetaData(), autoload_with=engine)
    with pytest.raises(IntegrityError):
        with engine.begin() as conn:
            conn.execute(table.insert().values(id=99, user_id=1, database_id=20))


def test_downgrade_restores_a_plain_non_unique_index(engine: Engine) -> None:
    """downgrade() drops the unique index and recreates a plain one --
    the dedupe deletions from upgrade() are not reversed, since those rows
    already violated the single-token-per-pair invariant the application
    assumed.
    """
    with engine.begin() as conn:
        ctx = MigrationContext.configure(conn)
        with Operations.context(ctx):
            migration.upgrade()
            migration.downgrade()

    assert _indexes(engine) == {INDEX_NAME: False}
    assert _rows(engine) == [
        (1, 1, 20),
        (3, 1, 10),
        (4, 2, 10),
    ]

    # Now that the index is plain again, duplicates are allowed once more.
    table = Table(TABLE_NAME, MetaData(), autoload_with=engine)
    with engine.begin() as conn:
        conn.execute(table.insert().values(id=99, user_id=1, database_id=20))
    assert (99, 1, 20) in _rows(engine)


def test_upgrade_is_idempotent(engine: Engine) -> None:
    """``create_index``/``drop_index`` are skip-if-exists; running
    ``upgrade()`` twice must not raise.
    """
    with engine.begin() as conn:
        ctx = MigrationContext.configure(conn)
        with Operations.context(ctx):
            migration.upgrade()
            migration.upgrade()
