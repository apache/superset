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
"""index_ab_user_lower_username

Adds a functional index on ``lower(username)`` for the ``ab_user`` table to
support Flask-AppBuilder's case-insensitive DB authentication lookup.

With ``AUTH_USERNAME_CI`` enabled (the Flask-AppBuilder default),
``SecurityManager.find_user()`` -- and Superset's
``security/manager.py`` ``find_user_with_relationships`` -- resolves a login
by folding case on both sides of the comparison, i.e. on essentially every
authenticated request it runs:

    SELECT ab_user.* FROM ab_user WHERE lower(ab_user.username) = lower(?)

``ab_user`` ships with a plain, case-sensitive unique btree on ``username``.
That index is keyed on the raw column value, so it cannot satisfy a
``lower(username)`` predicate: the expression must be evaluated per row and
the planner falls back to a sequential scan of ``ab_user``. On deployments
with a large user table and a high volume of authenticated requests this is a
recurring, avoidable cost on the metadata database. A functional index keyed
on ``lower(username)`` lets the same lookup become an index probe.

Only ``username`` is indexed. The email-based lookup path uses an exact
match (Flask-AppBuilder's ``filter_by(email=email)`` / Superset's
``email == email``) with no ``lower()`` wrapping, so the existing plain index
on ``email`` already serves it and a ``lower(email)`` index would be dead
weight.

Index creation is dialect-specific:

* **PostgreSQL (online)** -- ``CREATE INDEX CONCURRENTLY IF NOT EXISTS``
  inside an ``autocommit_block()``. Because ``ab_user`` is read on nearly
  every request, a plain ``CREATE INDEX`` would hold an exclusive lock on
  the live table for the duration of the build; ``CONCURRENTLY`` avoids that
  at the cost of not being runnable inside a transaction, hence the
  autocommit block. ``IF NOT EXISTS`` keeps re-runs idempotent.
* **PostgreSQL (offline / ``--sql``)** -- ``CONCURRENTLY`` and
  ``autocommit_block()`` cannot be used when Alembic only emits SQL, so a
  plain ``CREATE INDEX IF NOT EXISTS`` is generated instead. Operators
  applying the generated script against a live database can switch to
  ``CONCURRENTLY`` by hand if the exclusive lock is a concern.
* **SQLite** -- ``CREATE INDEX IF NOT EXISTS`` over ``lower(username)``;
  no ``CONCURRENTLY`` concept.
* **MySQL / other** -- a functional key part requires the doubled
  parentheses ``((lower(username)))``, and stock MySQL has no
  ``IF NOT EXISTS`` grammar for ``CREATE INDEX``, so the inspector is probed
  first and creation is skipped when the index already exists.

Revision ID: 88a01c781622
Revises: 7e2c9a4f1b83
Create Date: 2026-09-05 00:00:00.000000

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "88a01c781622"
down_revision = "7e2c9a4f1b83"


INDEX_NAME = "ix_ab_user_lower_username"
TABLE_NAME = "ab_user"


def _index_exists(bind: sa.engine.Connection) -> bool:
    inspector = sa.inspect(bind)
    return any(ix["name"] == INDEX_NAME for ix in inspector.get_indexes(TABLE_NAME))


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    ctx = op.get_context()

    if dialect == "postgresql":
        if ctx.as_sql:
            # Offline (--sql) mode: CONCURRENTLY / autocommit_block cannot be
            # used when Alembic only emits SQL, so fall back to a plain
            # CREATE INDEX. The generated statement is still valid; operators
            # applying it online can switch to CONCURRENTLY by hand.
            op.execute(
                f"CREATE INDEX IF NOT EXISTS {INDEX_NAME} "
                f"ON {TABLE_NAME} (lower(username))"
            )
        else:
            # Online mode: build the index CONCURRENTLY so we do not take an
            # exclusive lock on ab_user, which is read on essentially every
            # authenticated request. CONCURRENTLY cannot run inside a
            # transaction, so it must live in an autocommit block. IF NOT
            # EXISTS keeps the migration idempotent across re-runs.
            with ctx.autocommit_block():
                op.execute(
                    f"CREATE INDEX CONCURRENTLY IF NOT EXISTS {INDEX_NAME} "
                    f"ON {TABLE_NAME} (lower(username))"
                )
    elif dialect == "sqlite":
        op.execute(
            f"CREATE INDEX IF NOT EXISTS {INDEX_NAME} ON {TABLE_NAME} (lower(username))"
        )
    else:
        # MySQL and any other dialect: no portable IF NOT EXISTS for
        # CREATE INDEX, so probe the inspector and skip if the index is
        # already present. A functional key part requires the doubled
        # parentheses: ((lower(username))).
        if not _index_exists(bind):
            op.execute(f"CREATE INDEX {INDEX_NAME} ON {TABLE_NAME} ((lower(username)))")


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    ctx = op.get_context()

    if dialect == "postgresql":
        if ctx.as_sql:
            op.execute(f"DROP INDEX IF EXISTS {INDEX_NAME}")
        else:
            with ctx.autocommit_block():
                op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {INDEX_NAME}")
    elif dialect == "sqlite":
        op.execute(f"DROP INDEX IF EXISTS {INDEX_NAME}")
    else:
        # Probe the inspector rather than emit DROP INDEX IF EXISTS: stock
        # MySQL has no IF EXISTS grammar for DROP INDEX. The check also keeps
        # the downgrade robust if the upgrade only partially applied.
        if _index_exists(bind):
            op.drop_index(INDEX_NAME, table_name=TABLE_NAME)
