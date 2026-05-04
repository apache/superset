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
"""composite_pk_association_tables

Replace the unused synthetic ``id INTEGER PRIMARY KEY`` on eight many-to-many
association tables with a composite primary key on the two FK columns. Drops
the now-redundant ``UniqueConstraint(fk1, fk2)`` on the two tables that
already carry one. Pre-flight: deletes rows with NULL FK values (six tables
allow them today) and any duplicate ``(fk1, fk2)`` rows.

Motivated by SQLAlchemy-Continuum issue #129 (M2M restore against junction
tables with surrogate PKs); also closes the data-integrity hole where six
of the eight tables lacked DB-level uniqueness.

Revision ID: 2bee73611e32
Revises: ce6bd21901ab
Create Date: 2026-05-01 23:36:34.050058

"""

import logging
from typing import NamedTuple

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect
from sqlalchemy.engine import Connection

# revision identifiers, used by Alembic.
revision = "2bee73611e32"
down_revision = "ce6bd21901ab"

logger = logging.getLogger("alembic.env")


class AssociationTable(NamedTuple):
    """A junction table being converted from surrogate-id PK to composite-FK PK."""

    name: str
    fk1: str
    fk2: str


# Order is alphabetical by table name; deterministic for review and bisection.
AFFECTED_TABLES: list[AssociationTable] = [
    AssociationTable("dashboard_roles", "dashboard_id", "role_id"),
    AssociationTable("dashboard_slices", "dashboard_id", "slice_id"),
    AssociationTable("dashboard_user", "user_id", "dashboard_id"),
    AssociationTable("report_schedule_user", "user_id", "report_schedule_id"),
    AssociationTable("rls_filter_roles", "role_id", "rls_filter_id"),
    AssociationTable("rls_filter_tables", "table_id", "rls_filter_id"),
    AssociationTable("slice_user", "user_id", "slice_id"),
    AssociationTable("sqlatable_user", "user_id", "table_id"),
]

# These two tables already declare ``UniqueConstraint(fk1, fk2)`` in the model;
# the composite PK subsumes it, so the migration drops the redundant constraint.
TABLES_WITH_PRE_EXISTING_UNIQUE: set[str] = {
    "dashboard_slices",
    "report_schedule_user",
}

# Six tables whose FK columns are nullable today. Promoting an FK to a primary
# key column makes it NOT NULL, so any existing NULL-FK rows would block the
# PK-add. We delete them in pre-flight (a junction-table row with a NULL FK
# is meaningless under SQLAlchemy ``secondary=`` semantics anyway).
TABLES_WITH_NULLABLE_FKS: set[str] = {
    "dashboard_slices",
    "dashboard_user",
    "rls_filter_roles",
    "rls_filter_tables",
    "slice_user",
    "sqlatable_user",
}


def _check_no_external_fks_to_id(conn: Connection) -> None:
    """Raise ``RuntimeError`` if any foreign key in the database references one
    of the eight junction-table ``id`` columns. Uses SQLAlchemy's ``Inspector``
    for dialect-agnostic introspection across PostgreSQL, MySQL, and SQLite."""
    affected = {t.name for t in AFFECTED_TABLES}
    insp = inspect(conn)
    for table_name in insp.get_table_names():
        if table_name in affected:
            continue
        for fk in insp.get_foreign_keys(table_name):
            if fk["referred_table"] in affected and "id" in fk["referred_columns"]:
                raise RuntimeError(
                    f"Cannot drop synthetic id from {fk['referred_table']}: "
                    f"external FK {fk.get('name', '<unnamed>')} on {table_name} "
                    f"references {fk['referred_table']}({fk['referred_columns']}). "
                    f"Drop or migrate the referencing FK before applying this "
                    f"migration."
                )


def _delete_null_fk_rows(conn: Connection, t: AssociationTable) -> int:
    """Delete rows where ``t.fk1`` or ``t.fk2`` is NULL on ``t.name``.

    Returns the deletion count. Called only on tables in
    ``TABLES_WITH_NULLABLE_FKS``. Required because primary-key columns must be
    NOT NULL; the PK-add downstream would fail with a cryptic constraint
    violation if any NULL-FK rows survived.
    """
    # Identifiers come from the AFFECTED_TABLES whitelist, not user input.
    sql = sa.text(
        f"DELETE FROM {t.name} WHERE {t.fk1} IS NULL OR {t.fk2} IS NULL"  # noqa: S608
    )
    result = conn.execute(sql)
    n = result.rowcount or 0
    if n:
        logger.warning(
            "Deleted %d row(s) with NULL FK from %s before composite-PK promotion",
            n,
            t.name,
        )
    return n


def _dedupe_by_min_id(conn: Connection, t: AssociationTable) -> int:
    """Delete duplicate ``(t.fk1, t.fk2)`` rows from ``t.name`` keeping ``MIN(id)``.

    Returns the deletion count. Uses the wrapped-subquery form for MySQL
    portability — MySQL rejects ``DELETE FROM t WHERE id NOT IN (SELECT MIN(id)
    FROM t GROUP BY ...)`` with ERROR 1093 unless the inner SELECT is wrapped
    to force materialization.
    """
    # Identifiers come from the AFFECTED_TABLES whitelist, not user input.
    sql = sa.text(
        f"DELETE FROM {t.name} WHERE id NOT IN ("  # noqa: S608
        f" SELECT keep_id FROM ("
        f"  SELECT MIN(id) AS keep_id FROM {t.name} "
        f"GROUP BY {t.fk1}, {t.fk2}"
        f" ) AS s"
        f")"
    )
    result = conn.execute(sql)
    n = result.rowcount or 0
    if n:
        logger.warning("Deduped %d duplicate row(s) from %s", n, t.name)
    return n


def _assert_no_duplicates(conn: Connection, t: AssociationTable) -> None:
    """Raise ``RuntimeError`` if any ``(t.fk1, t.fk2)`` duplicate group remains.

    Called after ``_dedupe_by_min_id`` to surface silent dialect-dependent
    dedupe failures (e.g., a MySQL syntax issue) as an actionable error
    before the PK-add fires with a less-helpful constraint-violation message.
    """
    # Identifiers come from the AFFECTED_TABLES whitelist, not user input.
    sql = sa.text(
        f"SELECT COUNT(*) FROM ("  # noqa: S608
        f" SELECT 1 FROM {t.name} GROUP BY {t.fk1}, {t.fk2} HAVING COUNT(*) > 1"
        f") AS s"
    )
    if remaining := conn.scalar(sql) or 0:
        raise RuntimeError(
            f"Dedupe failed for {t.name}: {remaining} duplicate "
            f"({t.fk1}, {t.fk2}) groups remain after _dedupe_by_min_id. "
            f"Check the dedupe SQL for dialect {conn.dialect.name}."
        )


def _build_pre_upgrade_table(
    insp: sa.engine.reflection.Inspector, t: AssociationTable
) -> sa.Table:
    """Build a ``Table`` object representing the pre-upgrade schema of ``t``,
    explicitly *without* any redundant ``UniqueConstraint(t.fk1, t.fk2)``.
    Used as ``copy_from`` to ``batch_alter_table`` so the rebuilt table
    omits the unnamed UNIQUE constraint deterministically across dialects
    (SQLite reflects unnamed UNIQUEs with ``name=None``, defeating the
    standard ``batch_op.drop_constraint(name)`` path).

    Reflects column types and FK targets (with original FK constraint names
    preserved) from the live database; only the redundant UNIQUE is omitted.
    """
    md = sa.MetaData()
    fks_for_col: dict[str, list[dict]] = {}
    for fk in insp.get_foreign_keys(t.name):
        for col_name in fk["constrained_columns"]:
            fks_for_col.setdefault(col_name, []).append(fk)

    cols: list[sa.Column] = []
    for c in insp.get_columns(t.name):
        col_kwargs = {"nullable": c.get("nullable", True)}
        if c["name"] == "id":
            col_kwargs["primary_key"] = True
            col_kwargs["autoincrement"] = True
        fk_args = []
        for fk in fks_for_col.get(c["name"], []):
            idx = fk["constrained_columns"].index(c["name"])
            target = f"{fk['referred_table']}.{fk['referred_columns'][idx]}"
            options = {}
            if fk.get("options", {}).get("ondelete"):
                options["ondelete"] = fk["options"]["ondelete"]
            if fk.get("name"):
                options["name"] = fk["name"]
            fk_args.append(sa.ForeignKey(target, **options))
        cols.append(sa.Column(c["name"], c["type"], *fk_args, **col_kwargs))
    return sa.Table(t.name, md, *cols)


def upgrade() -> None:
    conn = op.get_bind()
    _check_no_external_fks_to_id(conn)
    insp = inspect(conn)

    for t in AFFECTED_TABLES:
        if t.name in TABLES_WITH_NULLABLE_FKS:
            _delete_null_fk_rows(conn, t)
        _dedupe_by_min_id(conn, t)
        _assert_no_duplicates(conn, t)

        # For the two tables with a pre-existing redundant UNIQUE
        # (``dashboard_slices``, ``report_schedule_user``) build an explicit
        # ``copy_from`` Table that omits the UNIQUE; this deterministically
        # drops it across all dialects, including SQLite where unnamed
        # constraints reflect with ``name=None`` and can't be dropped by
        # name. For the other six tables, reflection-based default
        # ``batch_alter_table`` (auto-detect) is fine since there's no
        # UNIQUE to drop. On PostgreSQL/MySQL, direct ALTER avoids the
        # temp-table index-name collision; on SQLite, the auto-detect picks
        # ``recreate=True`` because PK changes need it.
        if t.name in TABLES_WITH_PRE_EXISTING_UNIQUE:
            with op.batch_alter_table(
                t.name,
                recreate="always",
                copy_from=_build_pre_upgrade_table(insp, t),
            ) as batch_op:
                batch_op.drop_column("id")
                batch_op.create_primary_key(f"pk_{t.name}", [t.fk1, t.fk2])
        else:
            with op.batch_alter_table(t.name) as batch_op:
                batch_op.drop_column("id")
                batch_op.create_primary_key(f"pk_{t.name}", [t.fk1, t.fk2])


def downgrade() -> None:
    # Inverse order: undo upgrade transformations from last-applied to
    # first-applied. Within each table, drop the composite PK, restore the
    # surrogate ``id`` column, and re-add the original ``UNIQUE`` constraint
    # on the two tables that previously carried one.
    #
    # Note: FK columns remain NOT NULL after downgrade (intentional asymmetry
    # — see UPDATING.md). Restoring the original nullable state would require
    # an explicit ``alter_column`` per FK per table for no operator value;
    # junction-table NULL FKs were always meaningless under ``secondary=``
    # semantics.
    # The downgrade names the restored PK ``<table>_pkey`` (matching Postgres'
    # default constraint-naming convention, which was the original constraint
    # name before this migration ran) so a downgrade-then-upgrade round-trip
    # doesn't collide on the upgrade's ``pk_<table>`` name.
    #
    # Adding a NOT NULL ``id`` column to a table with existing rows requires
    # a default that fires on the existing rows. ``sa.Identity()`` (Postgres
    # 10+ / MySQL 8+) and ``sa.Sequence`` (with explicit nextval) both
    # backfill existing rows during ALTER TABLE; bare ``autoincrement=True``
    # does not. ``Identity`` is the modern portable choice.
    for t in reversed(AFFECTED_TABLES):
        with op.batch_alter_table(t.name) as batch_op:
            batch_op.drop_constraint(f"pk_{t.name}", type_="primary")
            batch_op.add_column(
                sa.Column(
                    "id",
                    sa.Integer,
                    sa.Identity(always=False),
                    nullable=False,
                )
            )
            batch_op.create_primary_key(f"{t.name}_pkey", ["id"])
            if t.name in TABLES_WITH_PRE_EXISTING_UNIQUE:
                batch_op.create_unique_constraint(
                    f"uq_{t.name}_{t.fk1}_{t.fk2}", [t.fk1, t.fk2]
                )
