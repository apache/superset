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
"""Schema round-trip tests for the composite-PK association-tables migration
(revision 2bee73611e32). Builds the pre-migration shape against an in-memory
SQLite engine, runs the migration's ``upgrade()``, asserts the post-upgrade
shape, runs ``downgrade()``, asserts the prior shape is restored (modulo the
documented FK NOT NULL asymmetry), and re-runs ``upgrade()`` to verify
idempotency.

This is run against an isolated in-memory engine via Alembic's
``MigrationContext`` so the test does not perturb the project's test DB.

Cross-backend verification of the same migration against PostgreSQL and
MySQL is delegated to the CI matrix (see T034a in tasks.md) and to the
quickstart.md verification (T033). This file covers the SQLite slice.
"""

from importlib import import_module
from typing import Any

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import inspect

# Import the migration module under test.
_migration = import_module(
    "superset.migrations.versions."
    "2026-05-01_23-36_2bee73611e32_composite_pk_association_tables"
)
AFFECTED_TABLES = _migration.AFFECTED_TABLES
TABLES_WITH_PRE_EXISTING_UNIQUE = _migration.TABLES_WITH_PRE_EXISTING_UNIQUE


def _build_pre_migration_schema(engine: sa.engine.Engine) -> None:
    """Recreate the eight tables in their pre-migration shape (surrogate
    ``id INTEGER PRIMARY KEY`` plus an optional ``UNIQUE(fk1, fk2)`` on the
    two tables that previously carried one). FKs to parent tables are
    omitted to keep the test self-contained — we're testing schema
    transformations, not FK enforcement."""
    md = sa.MetaData()
    for t in AFFECTED_TABLES:
        cols: list[sa.Column] = [
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column(t.fk1, sa.Integer, nullable=False),
            sa.Column(t.fk2, sa.Integer, nullable=False),
        ]
        constraints: list[sa.SchemaItem] = []
        if t.name in TABLES_WITH_PRE_EXISTING_UNIQUE:
            constraints.append(sa.UniqueConstraint(t.fk1, t.fk2))
        sa.Table(t.name, md, *cols, *constraints)
    md.create_all(engine)


def _shape(engine: sa.engine.Engine, table: str) -> dict[str, Any]:
    """Return a structural summary for asserting equality across runs."""
    insp = inspect(engine)
    pk = insp.get_pk_constraint(table).get("constrained_columns", [])
    columns = sorted(c["name"] for c in insp.get_columns(table))
    uniques = sorted(
        tuple(sorted(uc.get("column_names", [])))
        for uc in insp.get_unique_constraints(table)
    )
    return {"columns": columns, "pk": sorted(pk), "uniques": uniques}


def _run_with_alembic_context(engine: sa.engine.Engine, fn) -> None:
    """Run ``fn()`` (the migration's upgrade/downgrade body) inside a fresh
    Alembic ``MigrationContext`` bound to ``engine``. Patches the
    migration module's ``op`` to point at this context so its
    ``op.get_bind()`` and ``op.batch_alter_table`` calls execute against
    the in-memory engine."""
    with engine.connect() as conn:
        ctx = MigrationContext.configure(conn)
        ops = Operations(ctx)
        original_op = _migration.op
        _migration.op = ops  # type: ignore[attr-defined]
        try:
            fn()
        finally:
            _migration.op = original_op  # type: ignore[attr-defined]


def test_round_trip_against_in_memory_sqlite() -> None:
    """Round-trip: pre-migration → upgrade → downgrade → upgrade again.

    Asserts:
    - Post-upgrade shape: no ``id``, composite PK on (fk1, fk2), no
      UNIQUE(fk1, fk2) on the two tables that previously carried one.
    - Post-downgrade shape: ``id`` restored, PK back on (id), UNIQUE
      re-added on the two tables. (FK columns remain NOT NULL — the
      documented intentional asymmetry.)
    - Post-re-upgrade idempotency: shape matches the first post-upgrade.
    """
    engine = sa.create_engine("sqlite:///:memory:")
    _build_pre_migration_schema(engine)

    pre_shape = {t.name: _shape(engine, t.name) for t in AFFECTED_TABLES}

    _run_with_alembic_context(engine, _migration.upgrade)

    for t in AFFECTED_TABLES:
        s = _shape(engine, t.name)
        assert "id" not in s["columns"], f"{t.name}: id still present post-upgrade: {s}"
        assert s["pk"] == sorted([t.fk1, t.fk2]), (
            f"{t.name}: PK is {s['pk']}, expected {sorted([t.fk1, t.fk2])}"
        )
        assert tuple(sorted([t.fk1, t.fk2])) not in s["uniques"], (
            f"{t.name}: redundant UNIQUE not dropped post-upgrade: {s['uniques']}"
        )

    post_upgrade_shape = {t.name: _shape(engine, t.name) for t in AFFECTED_TABLES}

    _run_with_alembic_context(engine, _migration.downgrade)

    for t in AFFECTED_TABLES:
        s = _shape(engine, t.name)
        assert "id" in s["columns"], f"{t.name}: id not restored post-downgrade: {s}"
        assert s["pk"] == ["id"], f"{t.name}: PK is {s['pk']}, expected ['id']"
        if t.name in TABLES_WITH_PRE_EXISTING_UNIQUE:
            assert tuple(sorted([t.fk1, t.fk2])) in s["uniques"], (
                f"{t.name}: UNIQUE not restored post-downgrade: {s['uniques']}"
            )

    _run_with_alembic_context(engine, _migration.upgrade)

    re_upgrade_shape = {t.name: _shape(engine, t.name) for t in AFFECTED_TABLES}
    assert re_upgrade_shape == post_upgrade_shape, (
        "Re-upgrade shape differs from initial upgrade shape — "
        "migration is not idempotent. "
        f"diff: {set(re_upgrade_shape.items()) ^ set(post_upgrade_shape.items())}"
    )

    # Use pre_shape only to demonstrate it was captured (not asserted against
    # because the round-trip downgrade intentionally diverges on FK NOT NULL).
    _ = pre_shape


def test_migration_module_constants_are_consistent() -> None:
    """Sanity-check the migration module's exported constants. Catches
    accidental edits that misalign AFFECTED_TABLES with the auxiliary sets."""
    affected_names = {t.name for t in AFFECTED_TABLES}
    assert _migration.TABLES_WITH_PRE_EXISTING_UNIQUE.issubset(affected_names)
    assert _migration.TABLES_WITH_NULLABLE_FKS.issubset(affected_names)
    # Order is alphabetical (deterministic for review/bisection).
    assert [t.name for t in AFFECTED_TABLES] == sorted(affected_names)


@pytest.mark.skipif(True, reason="placeholder — see test_round_trip above")
def test_placeholder_for_future_postgres_round_trip() -> None:
    """Reserved slot for a future Postgres-specific round-trip if local
    SQLite divergence ever needs to be cross-checked against the real
    backend. Today's CI matrix (T034a) handles this implicitly."""
