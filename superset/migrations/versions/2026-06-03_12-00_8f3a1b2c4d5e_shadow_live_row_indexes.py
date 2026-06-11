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
"""shadow_live_row_indexes

Adds per-shadow-table indexes covering the canonical "current live row
of entity X" lookup that ``find_active_by_uuid`` / ``list_versions`` /
``get_version`` / restore validation / activity-view all funnel
through:

    SELECT ... FROM <entity>_version
    WHERE id = ? AND end_transaction_id IS NULL

The base migration (``56cd24c07170_add_versioning_tables``) created
single-column indexes on ``transaction_id``, ``end_transaction_id``,
and ``operation_type``, but nothing covering the predicate combination
that actually runs in hot paths.

Index choice is dialect-specific:

* **PostgreSQL / SQLite** — partial index over the entity ``id`` with
  ``WHERE end_transaction_id IS NULL``. Cuts the index size to one row
  per live entity (vs. one row per historical version) and turns the
  hot lookup into a single index probe.
* **MySQL** — partial indexes aren't supported; use a plain composite
  ``(id, end_transaction_id)``. MySQL's optimizer handles the
  ``IS NULL`` predicate against the composite efficiently.

Surfaced by sqlalchemy-review pass W-NEW-4.

Revision ID: 8f3a1b2c4d5e
Revises: 56cd24c07170
Create Date: 2026-06-03 12:00:00.000000

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "8f3a1b2c4d5e"
down_revision = "56cd24c07170"


# The parent + child shadow tables, all of which carry an ``id``
# column (mirroring the live entity's integer PK). ``dashboard_slices_version``
# is intentionally excluded: it's the M2M association shadow with a
# composite PK ``(dashboard_id, slice_id, transaction_id, operation_type)``
# and no ``id`` column. The canonical "live row" lookup doesn't apply to
# the M2M shadow — readers query it by ``transaction_id`` (already
# indexed by the base migration) when reconstructing per-tx changes.
SHADOW_TABLES: tuple[str, ...] = (
    "dashboards_version",
    "slices_version",
    "tables_version",
    "table_columns_version",
    "sql_metrics_version",
)


def _index_name(table: str) -> str:
    return f"ix_{table}_live_id"


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    where_clause = sa.text("end_transaction_id IS NULL")

    for table in SHADOW_TABLES:
        index_name = _index_name(table)
        if dialect == "postgresql":
            op.create_index(
                index_name,
                table,
                ["id"],
                unique=False,
                postgresql_where=where_clause,
            )
        elif dialect == "sqlite":
            op.create_index(
                index_name,
                table,
                ["id"],
                unique=False,
                sqlite_where=where_clause,
            )
        else:
            # MySQL (and any unknown dialect): partial indexes aren't
            # supported, so use a plain composite. MySQL's optimizer
            # handles ``id = ? AND end_transaction_id IS NULL`` against
            # the composite efficiently.
            op.create_index(
                index_name,
                table,
                ["id", "end_transaction_id"],
                unique=False,
            )


def downgrade() -> None:
    # Probe the inspector instead of emitting ``DROP INDEX IF EXISTS``:
    # stock MySQL (5.7/8.x) has no IF EXISTS grammar for DROP INDEX
    # (it's a MariaDB extension), so the clause is not dialect-portable.
    # The existence check keeps the downgrade robust against a
    # partial-application failure on upgrade (e.g. the first
    # ``op.create_index`` succeeded under Postgres' transactional DDL but
    # a later one failed and rolled back the rest — repeated downgrade
    # must not raise on the missing indexes).
    inspector = sa.inspect(op.get_bind())
    for table in SHADOW_TABLES:
        index_name = _index_name(table)
        if any(ix["name"] == index_name for ix in inspector.get_indexes(table)):
            op.drop_index(index_name, table_name=table)
