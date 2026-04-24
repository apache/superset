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
"""clean_up_duplicate_version_rows

Remove orphan and duplicate active rows from table_columns_version and
sql_metrics_version left by bulk ORM operations that bypassed Continuum
before the ORM refactor.

Two classes of bad rows are removed:

1. Orphan active rows — end_transaction_id IS NULL and operation_type != 2
   but the live entity row no longer exists.  Continuum missed the delete
   because it was issued via bulk_insert_mappings / query().delete().

2. Duplicate active rows — multiple rows with end_transaction_id IS NULL
   and operation_type != 2 sharing the same natural key
   (table_id, column_name) or (table_id, metric_name).  The row with the
   highest transaction_id per natural key is kept; the rest are deleted.

Revision ID: 04ea0c58fcb9
Revises: 56cd24c07170
Create Date: 2026-04-20 00:00:00.000000

"""

from __future__ import annotations

import logging

import sqlalchemy as sa
from alembic import op

revision = "04ea0c58fcb9"
down_revision = "56cd24c07170"

logger = logging.getLogger(__name__)


def _clean_version_table(
    conn: sa.engine.Connection,
    version_table: str,
    live_table: str,
    natural_key_col: str,
    parent_fk_col: str,
) -> None:
    """Remove orphan and duplicate active rows from a Continuum version table.

    Args:
        version_table: Name of the Continuum version table.
        live_table: Name of the corresponding live entity table.
        natural_key_col: Column name used as the natural key within a parent
            (e.g. ``column_name`` or ``metric_name``).
        parent_fk_col: FK column in the version table that points to the
            parent entity (e.g. ``table_id``).
    """
    vt = sa.table(
        version_table,
        sa.column("id"),
        sa.column("transaction_id"),
        sa.column("end_transaction_id"),
        sa.column("operation_type"),
        sa.column(natural_key_col),
        sa.column(parent_fk_col),
    )
    lt = sa.table(live_table, sa.column("id"))

    # ----------------------------------------------------------------
    # Step 1: delete orphan active rows — rows Continuum thinks are
    # still active but whose live entity row no longer exists.
    # ----------------------------------------------------------------
    # NOTE: materialize the subquery into a Python list before the DELETE.
    # MySQL raises error 1093 ("You can't specify target table X for
    # update in FROM clause") if the DELETE's WHERE references a
    # subquery that selects from the same table. A two-step fetch-then-
    # delete sidesteps this and is cross-database compatible.
    orphan_ids = [
        row._mapping["id"]
        for row in conn.execute(
            sa.select(vt.c.id)
            .where(vt.c.end_transaction_id.is_(None))
            .where(vt.c.operation_type != 2)
            .where(~sa.exists(sa.select(lt.c.id).where(lt.c.id == vt.c.id)))
        )
    ]
    if orphan_ids:
        result = conn.execute(sa.delete(vt).where(vt.c.id.in_(orphan_ids)))
        logger.info(
            "Deleted %d orphan active rows from %s",
            result.rowcount,
            version_table,
        )

    # ----------------------------------------------------------------
    # Step 2: deduplicate — for each (parent_fk, natural_key) group
    # with more than one active non-delete row, keep only the row with
    # the highest transaction_id; delete the rest.
    # ----------------------------------------------------------------

    # Fetch all active non-delete rows, ordered so we can deduplicate
    # in Python for cross-database compatibility.
    rows = conn.execute(
        sa.select(
            vt.c.id,
            vt.c.transaction_id,
            getattr(vt.c, parent_fk_col),
            getattr(vt.c, natural_key_col),
        )
        .where(vt.c.end_transaction_id.is_(None))
        .where(vt.c.operation_type != 2)
        .order_by(vt.c.transaction_id.asc())
    ).fetchall()

    # For each (parent_fk, natural_key) group, collect all row IDs.
    # The last entry (highest transaction_id) is the keeper.
    from collections import defaultdict

    groups: dict[tuple, list[int]] = defaultdict(list)
    for row in rows:
        key = (row._mapping[parent_fk_col], row._mapping[natural_key_col])
        groups[key].append(row._mapping["id"])

    to_delete: list[int] = []
    for ids in groups.values():
        if len(ids) > 1:
            # Keep the last (highest transaction_id due to ORDER BY asc);
            # mark all earlier entries for deletion.
            to_delete.extend(ids[:-1])

    if to_delete:
        result = conn.execute(sa.delete(vt).where(vt.c.id.in_(to_delete)))
        logger.info(
            "Deleted %d duplicate active rows from %s",
            result.rowcount,
            version_table,
        )


def upgrade() -> None:
    bind = op.get_bind()
    _clean_version_table(
        bind,
        version_table="table_columns_version",
        live_table="table_columns",
        natural_key_col="column_name",
        parent_fk_col="table_id",
    )
    _clean_version_table(
        bind,
        version_table="sql_metrics_version",
        live_table="sql_metrics",
        natural_key_col="metric_name",
        parent_fk_col="table_id",
    )


def downgrade() -> None:
    # Deleted version rows cannot be recovered — downgrade is a no-op.
    pass
