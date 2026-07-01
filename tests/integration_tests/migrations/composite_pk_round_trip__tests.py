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

Cross-backend (Postgres/MySQL) verification is handled by CI's
test-postgres / test-mysql shards running ``superset db upgrade``. This
file covers the SQLite slice.
"""

from importlib import import_module
from typing import Any

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
TABLES_WITH_NULLABLE_FKS = _migration.TABLES_WITH_NULLABLE_FKS


def _build_pre_migration_schema(engine: sa.engine.Engine) -> None:
    """Recreate the eight tables in their pre-migration shape (surrogate
    ``id INTEGER PRIMARY KEY`` plus an optional ``UNIQUE(fk1, fk2)`` on the
    two tables that previously carried one). FK columns are NULLABLE on
    the six tables that historically allowed NULLs — fidelity matters:
    with ``nullable=False`` here, the post-upgrade NOT NULL assertions
    pass trivially rather than because the migration promoted anything,
    and the NULL-row cleanup path can't be exercised. FKs to parent
    tables are omitted to keep the test self-contained — we're testing
    schema transformations, not FK enforcement."""
    md = sa.MetaData()
    for t in AFFECTED_TABLES:
        nullable = t.name in TABLES_WITH_NULLABLE_FKS
        cols: list[sa.Column] = [
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column(t.fk1, sa.Integer, nullable=nullable),
            sa.Column(t.fk2, sa.Integer, nullable=nullable),
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
    # Compare with `!=` on the (unhashable) per-table shapes rather than
    # set-differencing `.items()` — the latter raises TypeError while
    # formatting this message and would hide the real regression.
    shape_diff = {
        name: (re_upgrade_shape[name], post_upgrade_shape.get(name))
        for name in re_upgrade_shape
        if re_upgrade_shape[name] != post_upgrade_shape.get(name)
    }
    assert not shape_diff, (
        "Re-upgrade shape differs from initial upgrade shape — "
        f"migration is not idempotent. Per-table diffs (re-upgrade, initial): "
        f"{shape_diff}"
    )


def test_upgrade_scrubs_null_fks_and_duplicates() -> None:
    """The pre-flight data surgery is the migration's riskiest half — and
    it must be deletable-detectable: this test fails if
    ``_delete_null_fk_rows`` or ``_dedupe_by_min_id`` is removed from
    ``upgrade()``.

    Seeds a nullable-FK junction (``slice_user``) with NULL-FK rows and
    duplicate ``(fk1, fk2)`` pairs in the true pre-migration shape, runs
    the upgrade, and asserts exactly the distinct non-NULL pairs survive
    (the composite PK could not even be created otherwise).
    """
    engine = sa.create_engine("sqlite:///:memory:")
    _build_pre_migration_schema(engine)

    md = sa.MetaData()
    slice_user = sa.Table("slice_user", md, autoload_with=engine)
    with engine.begin() as conn:
        conn.execute(
            slice_user.insert(),
            [
                {"id": 1, "user_id": 1, "slice_id": 1},  # keeper (MIN id)
                {"id": 2, "user_id": 1, "slice_id": 1},  # duplicate pair
                {"id": 3, "user_id": 1, "slice_id": 1},  # duplicate pair
                {"id": 4, "user_id": 2, "slice_id": 2},  # distinct keeper
                {"id": 5, "user_id": None, "slice_id": 3},  # NULL fk1
                {"id": 6, "user_id": 3, "slice_id": None},  # NULL fk2
            ],
        )

    _run_with_alembic_context(engine, _migration.upgrade)

    with engine.connect() as conn:
        survivors = sorted(
            conn.execute(sa.text("SELECT user_id, slice_id FROM slice_user")).fetchall()
        )
    assert survivors == [(1, 1), (2, 2)], (
        f"expected the two distinct non-NULL pairs to survive, got {survivors}"
    )


def test_migration_module_constants_are_consistent() -> None:
    """Sanity-check the migration module's exported constants. Catches
    accidental edits that misalign AFFECTED_TABLES with the auxiliary sets."""
    affected_names = {t.name for t in AFFECTED_TABLES}
    assert _migration.TABLES_WITH_PRE_EXISTING_UNIQUE.issubset(affected_names)
    assert _migration.TABLES_WITH_NULLABLE_FKS.issubset(affected_names)
    # Order is alphabetical (deterministic for review/bisection).
    assert [t.name for t in AFFECTED_TABLES] == sorted(affected_names)
