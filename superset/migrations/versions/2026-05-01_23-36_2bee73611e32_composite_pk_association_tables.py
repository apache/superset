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
Revises: a7d3f1b9c2e4
Create Date: 2026-05-01 23:36:34.050058

"""

import logging
from typing import Any, NamedTuple

import sqlalchemy as sa
from alembic import op
from alembic.operations.base import BatchOperations
from sqlalchemy import inspect
from sqlalchemy.engine import Connection

# revision identifiers, used by Alembic.
revision = "2bee73611e32"
down_revision = "a7d3f1b9c2e4"

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

# Documentation set: tables whose FK columns are nullable in their original
# create_table migrations (``dashboard_roles.dashboard_id`` from revision
# e11ccdd12658 is the most recent addition). ``report_schedule_user`` is the
# only affected table created with both FK columns ``NOT NULL`` and is
# intentionally absent here. This set is no longer consulted at runtime — the
# upgrade now runs the NULL-FK cleanup on every affected table because the
# DELETE is a cheap no-op when the columns are already NOT NULL, and that
# eliminates the risk of bugs from this set going stale (the
# ``dashboard_roles`` omission caught in PR review was exactly that bug).
TABLES_WITH_NULLABLE_FKS: set[str] = {
    "dashboard_roles",
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
    for dialect-agnostic introspection across PostgreSQL, MySQL, and SQLite.

    Scope limitation: ``Inspector.get_table_names()`` returns tables in the
    connection's default schema only. On PostgreSQL deployments where Superset
    metadata lives in a non-default schema, or on multi-schema deployments
    that allow cross-schema FKs, an external FK in another schema would not
    be detected. This is acceptable for the standard single-schema
    deployment that Superset documents; operators with multi-schema
    metadata should run the equivalent inventory query against
    ``information_schema.referential_constraints`` themselves before
    applying.
    """
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
                    "Drop or migrate the referencing FK before applying this "
                    "migration."
                )


def _table_clause(t: AssociationTable) -> sa.sql.expression.TableClause:
    """Build a lightweight SQLAlchemy ``TableClause`` for ``t`` exposing the
    columns the helper queries reference (``id``, ``fk1``, ``fk2``). Used so
    that the dedupe / cleanup / assert SQL can be expressed via SQLAlchemy
    core constructs rather than via string interpolation."""
    return sa.table(t.name, sa.column("id"), sa.column(t.fk1), sa.column(t.fk2))


def _delete_null_fk_rows(conn: Connection, t: AssociationTable) -> int:
    """Delete rows where ``t.fk1`` or ``t.fk2`` is NULL on ``t.name``.

    Returns the deletion count. Required because primary-key columns must be
    NOT NULL; the PK-add downstream would fail with a cryptic constraint
    violation if any NULL-FK rows survived. Run unconditionally on every
    affected table — see ``TABLES_WITH_NULLABLE_FKS`` above for the rationale.
    """
    tbl = _table_clause(t)
    stmt = sa.delete(tbl).where(sa.or_(tbl.c[t.fk1].is_(None), tbl.c[t.fk2].is_(None)))
    result = conn.execute(stmt)
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

    Returns the deletion count. The ``NOT IN`` argument is wrapped in an
    extra ``SELECT keep_id FROM (...) AS s`` derived table because MySQL
    rejects ``DELETE FROM t WHERE id NOT IN (SELECT MIN(id) FROM t GROUP BY
    ...)`` with ERROR 1093 unless the inner SELECT is materialized through
    a derived table. SQLAlchemy's ``.subquery()`` produces that wrap.

    Logs a sample (up to 10) of the discarded ``(fk1, fk2, id)`` tuples at
    WARN before deletion, so operators can audit which rows are dropped —
    the "keep ``MIN(id)``" policy preserves the original row, which is
    correct in practice but discards any later, semantically-identical
    re-grants.
    """
    tbl = _table_clause(t)

    keep_min = (
        sa.select(sa.func.min(tbl.c.id).label("keep_id"))
        .group_by(tbl.c[t.fk1], tbl.c[t.fk2])
        .subquery("keep_min")
    )
    keep_ids = sa.select(keep_min.c.keep_id)
    discarded = tbl.c.id.notin_(keep_ids)

    sample_stmt = (
        sa.select(tbl.c[t.fk1], tbl.c[t.fk2], tbl.c.id).where(discarded).limit(10)
    )
    sample = list(conn.execute(sample_stmt))

    delete_stmt = sa.delete(tbl).where(discarded)
    result = conn.execute(delete_stmt)
    n = result.rowcount or 0
    if n:
        logger.warning(
            "Deduped %d duplicate row(s) from %s; sample of discarded "
            "(%s, %s, id) tuples (up to 10): %s",
            n,
            t.name,
            t.fk1,
            t.fk2,
            sample,
        )
    return n


def _assert_no_duplicates(conn: Connection, t: AssociationTable) -> None:
    """Raise ``RuntimeError`` if any ``(t.fk1, t.fk2)`` duplicate group remains.

    Called after ``_dedupe_by_min_id`` to surface silent dialect-dependent
    dedupe failures (e.g., a MySQL syntax issue) as an actionable error
    before the PK-add fires with a less-helpful constraint-violation message.
    """
    tbl = _table_clause(t)
    duplicate_groups = (
        sa.select(sa.literal(1))
        .select_from(tbl)
        .group_by(tbl.c[t.fk1], tbl.c[t.fk2])
        .having(sa.func.count() > 1)
        .subquery("duplicate_groups")
    )
    count_stmt = sa.select(sa.func.count()).select_from(duplicate_groups)
    if remaining := conn.scalar(count_stmt) or 0:
        raise RuntimeError(
            f"Dedupe failed for {t.name}: {remaining} duplicate "
            f"({t.fk1}, {t.fk2}) groups remain after _dedupe_by_min_id. "
            f"Check the dedupe SQL for dialect {conn.dialect.name}."
        )


def _build_pre_upgrade_table(
    insp: sa.engine.reflection.Inspector,
    t: AssociationTable,
    fks: list[dict] | None = None,
) -> sa.Table:
    """Build a ``Table`` object representing the pre-upgrade schema of ``t``,
    explicitly *without* any redundant ``UniqueConstraint(t.fk1, t.fk2)``.
    Used as ``copy_from`` to ``batch_alter_table`` so the rebuilt table
    omits the unnamed UNIQUE constraint deterministically across dialects
    (SQLite reflects unnamed UNIQUEs with ``name=None``, defeating the
    standard ``batch_op.drop_constraint(name)`` path).

    Reflects column types and FK targets (with original FK constraint names
    preserved) from the live database; only the redundant UNIQUE is omitted.

    *fks* lets a caller pass a pre-captured ``get_foreign_keys`` result.
    The MySQL upgrade path drops the live FK constraints before building
    this table, so re-reflecting here would only see them via the
    Inspector's per-instance ``info_cache`` — an implementation detail,
    not a contract. Passing the pre-drop list makes the dependency
    explicit instead of relying on reflection caching.
    """
    md = sa.MetaData()
    if fks is None:
        fks = insp.get_foreign_keys(t.name)
    fks_for_col: dict[str, list[dict]] = {}
    for fk in fks:
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


def _drop_redundant_unique_by_name(
    conn: Connection, insp: sa.engine.reflection.Inspector, t: AssociationTable
) -> None:
    """Drop the redundant ``UNIQUE(fk1, fk2)`` constraint by its reflected
    name on PostgreSQL / MySQL.

    The two tables in ``TABLES_WITH_PRE_EXISTING_UNIQUE`` carry a UNIQUE
    constraint that the composite primary key subsumes. PostgreSQL and
    MySQL both auto-name UNIQUE constraints (``<table>_<cols>_key`` on
    Postgres, ``<table>_<col>_<n>`` or the explicit ``uq_*`` we may have
    given it on MySQL), so they're reflectable by name. SQLite is
    handled separately via ``recreate="always"`` + ``copy_from`` because
    it reflects unnamed UNIQUEs with ``name=None``.

    No-op if no matching UNIQUE is found (defensive — re-runs after a
    partial application should not error).
    """
    for uc in insp.get_unique_constraints(t.name):
        if set(uc.get("column_names", [])) == {t.fk1, t.fk2} and uc.get("name"):
            op.drop_constraint(uc["name"], t.name, type_="unique")
            return


# MySQL ON DELETE actions that the downgrade re-create loop is allowed
# to interpolate into raw SQL. The reflected value comes from MySQL's
# information_schema (so not user input), but a whitelist eliminates
# the "what if an unexpected value appears" question entirely. The
# four entries are the SQL-standard set; SET DEFAULT is intentionally
# excluded because InnoDB silently downgrades it to NO ACTION.
_VALID_ONDELETE_ACTIONS: frozenset[str] = frozenset(
    {"CASCADE", "SET NULL", "RESTRICT", "NO ACTION"}
)


def _enforce_not_null_for_sqlite(
    batch_op: BatchOperations, t: AssociationTable, conn: Connection
) -> None:
    """Force ``NOT NULL`` on the FK columns post-PK-promotion on SQLite only.

    SQLite has a long-standing quirk: composite ``PRIMARY KEY`` does not
    promote constituent columns to ``NOT NULL`` (only ``INTEGER PRIMARY KEY``
    does). PostgreSQL and MySQL implicitly promote the PK columns to
    ``NOT NULL`` when the constraint is added, making the explicit
    ``alter_column`` redundant there.

    Skipping the ``alter_column`` on MySQL is also functionally required:
    MySQL 8 rejects ``ALTER COLUMN`` on a column that participates in a
    foreign key constraint with ``ERROR 1832 (HY000): Cannot change column
    'X': used in a foreign key constraint 'Y'`` whenever the table has
    data — even when the only change is ``NULL`` → ``NOT NULL`` and the
    column is already part of a freshly-added composite primary key (which
    InnoDB has just made implicitly ``NOT NULL`` anyway). The error fires
    on populated tables but not on empty ones, which is why CI's
    ``test-mysql`` shard (fresh schema) didn't catch this and a real
    production-shaped install does.

    Only SQLite still needs the explicit step, and SQLite has no FK
    enforcement objection.
    """
    if conn.dialect.name == "sqlite":
        batch_op.alter_column(t.fk1, existing_type=sa.Integer, nullable=False)
        batch_op.alter_column(t.fk2, existing_type=sa.Integer, nullable=False)


def _assert_fks_present(fks: list[dict[str, Any]], table_name: str, phase: str) -> None:
    """Abort loudly if a junction table has already lost its foreign keys.

    On MySQL every DDL statement auto-commits (no transactional rollback),
    so a run interrupted after the FK-drop loop but before the (slower)
    table recreate that re-adds them leaves the table FK-less. Both the
    upgrade and downgrade capture the FK set by *reflecting the live table*,
    so a naive retry would rebuild with the empty reflected set and silently
    strip the foreign keys. A junction table always carries FK constraints,
    so an empty reflection here signals that interrupted state — fail with a
    recovery message instead of proceeding. (PostgreSQL/SQLite wrap the
    migration in a transaction, so they roll back and never reach this.)
    """
    if not fks:
        raise RuntimeError(
            f"{table_name}: no foreign keys reflected before the composite-PK "
            f"{phase}, but a junction table should always have them. A prior "
            "attempt was likely interrupted after dropping the FKs on MySQL "
            "(non-transactional DDL). Restore the metadata database from a "
            "backup and re-run — continuing would rebuild the table without "
            "its foreign keys."
        )


def upgrade() -> None:
    conn = op.get_bind()
    _check_no_external_fks_to_id(conn)
    insp = inspect(conn)

    for t in AFFECTED_TABLES:
        # Resumability guard: on MySQL every DDL statement auto-commits, so
        # a failure at table N of 8 leaves tables 1..N-1 already converted
        # while ``alembic_version`` is still un-stamped. Without this guard
        # a re-run would fail at table 1 (``drop_column("id")`` on a table
        # that no longer has ``id``), and ``downgrade`` can't run either
        # (the revision was never stamped) — recovery would need manual
        # surgery. A converted table is identified by the absent ``id``
        # column; skipping it makes re-running the upgrade safe on every
        # dialect (Postgres/SQLite wrap the migration in a transaction, so
        # the guard is simply never hit there).
        if "id" not in {c["name"] for c in insp.get_columns(t.name)}:
            logger.info(
                "%s: already converted (no surrogate id column); skipping",
                t.name,
            )
            continue

        # Run NULL-FK cleanup unconditionally: it is a no-op DELETE on tables
        # whose FK columns are already NOT NULL (cheap), and skipping it on a
        # table whose FK was nullable would leave the PK-add to fail with a
        # cryptic constraint violation. Cf. ``TABLES_WITH_NULLABLE_FKS`` above
        # for documentation of which tables are known to have nullable FKs.
        _delete_null_fk_rows(conn, t)
        _dedupe_by_min_id(conn, t)
        _assert_no_duplicates(conn, t)

        # Two tables (``dashboard_slices``, ``report_schedule_user``)
        # carry a redundant ``UNIQUE(fk1, fk2)`` that the composite PK
        # subsumes. Three dialect-specific paths:
        #
        # * **PostgreSQL** — the UNIQUE constraint has a stable
        #   reflected name (Postgres default convention), so we
        #   ``DROP CONSTRAINT`` by name and then run the structural
        #   change as direct ALTER. This avoids the full-table copy
        #   that ``recreate="always"`` would trigger
        #   (``CREATE TABLE AS SELECT → DROP → RENAME``), holding
        #   ``ACCESS EXCLUSIVE`` only for the (much shorter) PK
        #   index build instead of the full copy duration.
        #
        # * **MySQL** — InnoDB binds the FK constraints to the
        #   redundant UNIQUE's underlying index for back-reference,
        #   so a direct ``DROP CONSTRAINT`` of the UNIQUE raises
        #   ``ERROR 1553``. Use ``recreate="always"`` to rebuild the
        #   table without the UNIQUE; drop the FKs first to dodge
        #   the ``ERROR 1826`` (duplicate FK constraint name) that
        #   the temp-table phase would otherwise provoke. The FKs
        #   are re-created automatically as part of ``copy_from``.
        #
        # * **SQLite** — unnamed UNIQUE constraints reflect with
        #   ``name=None`` and can't be dropped by name. Use
        #   ``recreate="always"`` + ``copy_from`` (omits UNIQUE).
        #   SQLite always rebuilds for PK changes anyway, so the
        #   recreate isn't extra cost there.
        if t.name in TABLES_WITH_PRE_EXISTING_UNIQUE:
            if conn.dialect.name == "postgresql":
                _drop_redundant_unique_by_name(conn, insp, t)
                with op.batch_alter_table(t.name) as batch_op:
                    batch_op.drop_column("id")
                    batch_op.create_primary_key(f"pk_{t.name}", [t.fk1, t.fk2])
                    _enforce_not_null_for_sqlite(batch_op, t, conn)
            else:
                # Capture the FK list BEFORE dropping: the copy_from table
                # below must embed these constraints, and re-reflecting
                # after the drop only works via the Inspector's
                # per-instance info_cache (see _build_pre_upgrade_table).
                pre_drop_fks = insp.get_foreign_keys(t.name)
                if conn.dialect.name == "mysql":
                    _assert_fks_present(pre_drop_fks, t.name, "upgrade")
                    for fk in pre_drop_fks:
                        if fk_name := fk.get("name"):
                            op.drop_constraint(fk_name, t.name, type_="foreignkey")
                with op.batch_alter_table(
                    t.name,
                    recreate="always",
                    copy_from=_build_pre_upgrade_table(insp, t, fks=pre_drop_fks),
                ) as batch_op:
                    batch_op.drop_column("id")
                    batch_op.create_primary_key(f"pk_{t.name}", [t.fk1, t.fk2])
                    _enforce_not_null_for_sqlite(batch_op, t, conn)
        else:
            with op.batch_alter_table(t.name) as batch_op:
                batch_op.drop_column("id")
                batch_op.create_primary_key(f"pk_{t.name}", [t.fk1, t.fk2])
                _enforce_not_null_for_sqlite(batch_op, t, conn)


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
    conn = op.get_bind()
    insp = inspect(conn)
    is_mysql = conn.dialect.name == "mysql"
    for t in reversed(AFFECTED_TABLES):
        if is_mysql:
            _downgrade_mysql_table(insp, t)
        else:
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


def _downgrade_mysql_table(
    insp: sa.engine.reflection.Inspector, t: AssociationTable
) -> None:
    """MySQL-specific downgrade for one table.

    Two MySQL quirks force a dialect-specific path here:

    1. **ERROR 1553 — ``Cannot drop index 'PRIMARY': needed in a foreign
       key constraint``**. InnoDB uses the composite PK index to back the
       FK on the leftmost column. Dropping the PK before the FKs orphans
       that backing index. PostgreSQL and SQLite create separate indexes
       for FK columns and don't need this dance. We drop the FKs first
       and re-add them after the structural change.

    2. **``Identity(always=False)`` on a non-PK column add does not emit
       ``AUTO_INCREMENT`` on MySQL.** SQLAlchemy 1.4 only emits
       ``AUTO_INCREMENT`` when the column has both ``Identity()`` and
       ``primary_key=True`` at create time. Our portable path adds the
       column first, then creates the PK separately — which works on
       Postgres (the column gets ``GENERATED BY DEFAULT AS IDENTITY``)
       and SQLite (``INTEGER PRIMARY KEY`` becomes a rowid alias) but
       leaves MySQL without auto-generation, so existing rows can't be
       backfilled and future ``INSERT`` statements fail with
       ``Field 'id' doesn't have a default value``. The combined
       ``DROP PRIMARY KEY, ADD COLUMN AUTO_INCREMENT, ADD PRIMARY KEY``
       in a single ALTER statement is the canonical MySQL idiom: MySQL
       backfills existing rows with sequential values and the column
       remains auto-incrementing for future inserts.

    Raw SQL is unavoidable here — there is no SQLAlchemy core equivalent
    for the combined-ALTER form, and the constitution allows raw SQL for
    dialect-specific DDL with no programmatic equivalent (preferring
    triple-quoted strings for legibility).

    Belt-and-braces guard: ``t.name`` is interpolated as a backtick-quoted
    identifier in the ALTER statements below. The value comes from
    ``AFFECTED_TABLES`` (a module-level literal), so SQL injection is
    structurally precluded. The explicit ``allowed`` check here makes
    that invariant load-bearing rather than implicit, so a future
    refactor that loosens the call-site can't slip past review.
    """
    allowed = {a.name for a in AFFECTED_TABLES}
    if t.name not in allowed:
        raise RuntimeError(
            f"Refusing to ALTER unknown table {t.name!r}: "
            f"only AFFECTED_TABLES entries may flow through this path."
        )

    fks = insp.get_foreign_keys(t.name)
    _assert_fks_present(fks, t.name, "downgrade")

    for fk in fks:
        if fk_name := fk.get("name"):
            op.execute(f"ALTER TABLE `{t.name}` DROP FOREIGN KEY `{fk_name}`")

    op.execute(
        f"""
        ALTER TABLE `{t.name}`
            DROP PRIMARY KEY,
            ADD COLUMN id INT NOT NULL AUTO_INCREMENT,
            ADD PRIMARY KEY (id)
        """
    )

    if t.name in TABLES_WITH_PRE_EXISTING_UNIQUE:
        op.execute(
            f"""
            ALTER TABLE `{t.name}`
                ADD UNIQUE INDEX `uq_{t.name}_{t.fk1}_{t.fk2}`
                    (`{t.fk1}`, `{t.fk2}`)
            """
        )

    for fk in fks:
        # Guard the FK name for symmetry with the drop loop above.
        # MySQL/InnoDB always reflects a name for FK constraints
        # (auto-assigning ``<table>_ibfk_<n>`` if none was specified),
        # so this branch is defensive rather than reachable in practice.
        fk_name = fk.get("name")
        if not fk_name:
            continue
        ondelete = fk.get("options", {}).get("ondelete")
        # Defensive whitelist: ``ondelete`` is reflected from MySQL's
        # information_schema (not user input), but interpolating it
        # into raw SQL without a check leaves a "what if an
        # unexpected value appears" footgun. The SQL standard defines
        # exactly four actions; reject anything else loudly.
        if ondelete and ondelete.upper() not in _VALID_ONDELETE_ACTIONS:
            raise RuntimeError(
                f"Unexpected ON DELETE action {ondelete!r} reflected from "
                f"{t.name}.{fk_name}; refusing to interpolate into raw SQL."
            )
        ondelete_clause = f" ON DELETE {ondelete}" if ondelete else ""
        local_cols = ", ".join(f"`{c}`" for c in fk["constrained_columns"])
        ref_cols = ", ".join(f"`{c}`" for c in fk["referred_columns"])
        op.execute(
            f"""
            ALTER TABLE `{t.name}`
                ADD CONSTRAINT `{fk_name}`
                    FOREIGN KEY ({local_cols})
                    REFERENCES `{fk["referred_table"]}` ({ref_cols})
                    {ondelete_clause}
            """
        )
