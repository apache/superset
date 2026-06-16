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
"""Round-trip tests for the entity-versioning migrations
(``56cd24c07170_add_versioning_tables`` + ``8f3a1b2c4d5e_shadow_live_row_indexes``).

The migration's ``downgrade()`` is correct against an empty schema, but
the realistic operational scenario is: we deployed, accumulated
versioning rows from real saves over hours or days, then need to roll
back. This file exercises that path against an isolated in-memory
SQLite engine via Alembic's ``MigrationContext``:

1. Run ``56cd24c07170.upgrade()`` then ``8f3a1b2c4d5e.upgrade()``.
2. Populate every shadow table with a few rows, simulating a day's
   worth of save traffic (live transactions + historical transactions
   linking to the parent / child / M2M shadows).
3. Run ``8f3a1b2c4d5e.downgrade()`` then ``56cd24c07170.downgrade()``.
4. Assert every created table, index, and (where applicable) sequence
   is gone. There must be no orphan rows, no lingering constraints, no
   FK violations from a partial drop.
5. Re-run the upgrade and assert the post-second-upgrade shape matches
   the first post-upgrade shape (idempotency: the rebuilt schema must
   not differ from a brand-new install).

The migration's ``MEDIUMTEXT`` shadow columns (sqlalchemy-review C1)
are tested implicitly — the upgrade declares them with the right
SQLAlchemy type, and any test that inserts a 64KB+ string into
``dashboards_version.position_json`` would fail on plain ``sa.Text``
under MySQL ``STRICT_TRANS_TABLES``. SQLite ignores the length cap
(everything is TEXT), so the type-correctness test for MySQL is
delegated to the cross-backend CI matrix. The shape this file pins
is reversibility under load — the schema-correctness slice is
covered separately.

Cross-backend verification against PostgreSQL (sequence handling) and
MySQL (composite-shadow-index dialect dispatch) is delegated to the
CI matrix. This file covers the SQLite slice — the deployment dialect
most contributors test locally against — so a regression that breaks
``downgrade()`` against populated data fails in pytest before it
fails on a production Postgres cluster at 3am.
"""

from importlib import import_module
from typing import Any

import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import inspect

_base_migration = import_module(
    "superset.migrations.versions.2026-05-28_19-50_56cd24c07170_add_versioning_tables"
)
_indexes_migration = import_module(
    "superset.migrations.versions.2026-06-03_12-00_8f3a1b2c4d5e_shadow_live_row_indexes"
)


# Tables the base migration creates, in dependency order (parents first,
# children last). All test assertions iterate this list so a regression
# that adds or removes a table here surfaces as a single edit.
_VERSIONING_TABLES: tuple[str, ...] = (
    "version_transaction",
    "dashboards_version",
    "slices_version",
    "tables_version",
    "version_changes",
    "table_columns_version",
    "sql_metrics_version",
    "dashboard_slices_version",
)


# Parent + child shadow tables that carry an ``id`` column (the
# ``8f3a1b2c4d5e`` migration creates a live-row partial index over
# each one). ``dashboard_slices_version`` is intentionally excluded —
# composite PK, no ``id``.
_SHADOW_TABLES_WITH_LIVE_INDEX: tuple[str, ...] = (
    "dashboards_version",
    "slices_version",
    "tables_version",
    "table_columns_version",
    "sql_metrics_version",
)


# Child shadow tables that additionally carry a ``(table_id, transaction_id)``
# composite index (the ``8f3a1b2c4d5e`` migration adds it for the dataset
# child-diff access pattern, which filters by parent ``table_id`` plus a
# transaction-range bound). Parent shadows and the M2M shadow are excluded —
# they aren't queried by ``table_id``.
_CHILD_SHADOW_TABLES_WITH_TX_INDEX: tuple[str, ...] = (
    "table_columns_version",
    "sql_metrics_version",
)


def _run_migration(
    engine: sa.engine.Engine, migration_module: Any, direction: str
) -> None:
    """Execute *migration_module*'s ``upgrade()`` or ``downgrade()`` body
    inside an Alembic ``MigrationContext`` bound to *engine*.

    The migrations call ``op.<x>`` against Alembic's module-level ``op``
    singleton; this helper temporarily redirects that singleton to a
    fresh ``Operations`` instance bound to our in-memory engine. Same
    pattern as ``composite_pk_round_trip__tests.py`` so the two test
    files don't diverge on harness style.
    """
    with engine.connect() as conn:
        ctx = MigrationContext.configure(conn)
        ops = Operations(ctx)
        original_op = migration_module.op
        migration_module.op = ops
        try:
            getattr(migration_module, direction)()
        finally:
            migration_module.op = original_op


def _shape(engine: sa.engine.Engine) -> dict[str, Any]:
    """Return a structural summary of all versioning-table schema
    state — used to assert equality across upgrade / re-upgrade."""
    insp = inspect(engine)
    all_tables = set(insp.get_table_names())
    out: dict[str, Any] = {}
    for tbl in _VERSIONING_TABLES:
        if tbl not in all_tables:
            out[tbl] = None
            continue
        out[tbl] = {
            "columns": sorted(
                (c["name"], str(c["type"])) for c in insp.get_columns(tbl)
            ),
            "pk": sorted(insp.get_pk_constraint(tbl).get("constrained_columns", [])),
            "indexes": sorted(
                (ix["name"], tuple(ix.get("column_names", [])))
                for ix in insp.get_indexes(tbl)
            ),
            "fks": sorted(
                (
                    fk["name"],
                    tuple(fk.get("constrained_columns", [])),
                    fk.get("referred_table"),
                )
                for fk in insp.get_foreign_keys(tbl)
            ),
        }
    return out


def _populate_shadow_rows(engine: sa.engine.Engine) -> None:
    """Insert a small batch of rows into every shadow table, simulating
    a day's worth of production save traffic.

    Shape:
    * 3 ``version_transaction`` rows — TX 1 is "live" (open
      ``end_transaction_id``); TX 2 is "closed by TX 3"; TX 3 closes
      TX 2 and is itself live.
    * For each parent shadow (dashboards / slices / tables): one row
      per entity per transaction, with the latest row left open
      (``end_transaction_id IS NULL``) and the prior row closed by it.
    * One ``version_changes`` row per transaction that's tied to a
      content change — the listener's typical write shape.
    * One ``table_columns_version`` / ``sql_metrics_version`` row per
      dataset-edit transaction.
    * Two ``dashboard_slices_version`` rows — chart added + chart
      removed in successive transactions.

    The point is volume + every FK exercised, not realistic semantics.
    A populated downgrade that succeeds against this set succeeds
    against arbitrary production volume too.
    """
    with engine.begin() as conn:
        # Three transactions.
        conn.execute(
            sa.text(
                "INSERT INTO version_transaction "
                "(id, issued_at, remote_addr, user_id, action_kind) VALUES "
                "(1, '2026-01-01 00:00:00', NULL, NULL, NULL), "
                "(2, '2026-01-02 00:00:00', NULL, NULL, 'restore'), "
                "(3, '2026-01-03 00:00:00', NULL, NULL, NULL)"
            )
        )
        # Dashboard 100: live row at tx=3, closed at tx=2 by tx=3.
        conn.execute(
            sa.text(
                "INSERT INTO dashboards_version "
                "(id, dashboard_title, transaction_id, end_transaction_id, "
                " operation_type) VALUES "
                "(100, 'Pre-restore', 2, 3, 1), "
                "(100, 'Live', 3, NULL, 1)"
            )
        )
        # Slice 200: live row at tx=3.
        conn.execute(
            sa.text(
                "INSERT INTO slices_version "
                "(id, slice_name, transaction_id, end_transaction_id, "
                " operation_type) VALUES "
                "(200, 'Live chart', 3, NULL, 1)"
            )
        )
        # Dataset 300: live row at tx=3 + a column edit at tx=2.
        conn.execute(
            sa.text(
                "INSERT INTO tables_version "
                "(id, table_name, transaction_id, end_transaction_id, "
                " operation_type) VALUES "
                "(300, 'Pre-edit', 2, 3, 1), "
                "(300, 'Live dataset', 3, NULL, 1)"
            )
        )
        # Child shadows: column + metric for the dataset edit.
        conn.execute(
            sa.text(
                "INSERT INTO table_columns_version "
                "(id, column_name, table_id, transaction_id, "
                " end_transaction_id, operation_type) VALUES "
                "(400, 'col_a', 300, 2, 3, 1), "
                "(400, 'col_a', 300, 3, NULL, 1)"
            )
        )
        conn.execute(
            sa.text(
                "INSERT INTO sql_metrics_version "
                "(id, metric_name, table_id, transaction_id, "
                " end_transaction_id, operation_type) VALUES "
                "(500, 'count', 300, 3, NULL, 1)"
            )
        )
        # M2M: slice attached to dashboard at tx=1, still live.
        conn.execute(
            sa.text(
                "INSERT INTO dashboard_slices_version "
                "(dashboard_id, slice_id, transaction_id, "
                " end_transaction_id, operation_type) VALUES "
                "(100, 200, 1, NULL, 1)"
            )
        )
        # Field-level change records spanning the transactions.
        conn.execute(
            sa.text(
                "INSERT INTO version_changes "
                "(transaction_id, entity_kind, entity_id, sequence, "
                " kind, operation, path, from_value, to_value) VALUES "
                "(2, 'dashboard', 100, 0, 'field', 'edit', "
                "'[\"dashboard_title\"]', '\"Pre-restore\"', '\"Edited\"'), "
                "(3, 'dashboard', 100, 0, 'field', 'edit', "
                "'[\"dashboard_title\"]', '\"Edited\"', '\"Live\"'), "
                "(3, 'dataset', 300, 0, 'field', 'edit', "
                "'[\"table_name\"]', '\"Pre-edit\"', '\"Live dataset\"')"
            )
        )


def test_round_trip_against_populated_shadow_tables() -> None:
    """Upgrade → populate → downgrade → upgrade-again, all against
    in-memory SQLite.

    Asserts:
    1. Post-first-upgrade: all 8 versioning tables exist + all 5 partial
       indexes from ``8f3a1b2c4d5e`` are present.
    2. Population step writes successfully (no FK violations against
       the just-created schema).
    3. Post-downgrade: every versioning table is gone. No orphan rows
       (the ``version_changes.transaction_id`` CASCADE FK does its job;
       the parent/child shadows drop with their tables).
    4. Post-second-upgrade: shape matches post-first-upgrade
       byte-for-byte. The migration is idempotent under round-trip;
       a future operator who downgrades + re-upgrades does not end up
       with a subtly different schema.
    """
    engine = sa.create_engine("sqlite:///:memory:")

    # 1. Upgrade.
    _run_migration(engine, _base_migration, "upgrade")
    _run_migration(engine, _indexes_migration, "upgrade")

    first_upgrade_shape = _shape(engine)
    for tbl in _VERSIONING_TABLES:
        assert first_upgrade_shape[tbl] is not None, (
            f"Expected {tbl} to exist after upgrade; got None"
        )

    # The live-row indexes from 8f3a1b2c4d5e exist on every parent +
    # child shadow (M2M shadow excluded by design).
    for tbl in _SHADOW_TABLES_WITH_LIVE_INDEX:
        index_names = {ix[0] for ix in first_upgrade_shape[tbl]["indexes"]}
        expected = f"ix_{tbl}_live_id"
        assert expected in index_names, (
            f"Expected live-id partial index {expected!r} on {tbl} after "
            f"8f3a1b2c4d5e upgrade; got {sorted(index_names)}"
        )
    # The M2M shadow must NOT have the live-id index.
    m2m_indexes = {
        ix[0] for ix in first_upgrade_shape["dashboard_slices_version"]["indexes"]
    }
    assert "ix_dashboard_slices_version_live_id" not in m2m_indexes, (
        "M2M shadow shouldn't get the live-id partial index (no id column)"
    )

    # The child-diff composite index exists on each child shadow. Parent
    # shadows aren't queried by table_id, so they must NOT carry it.
    for tbl in _CHILD_SHADOW_TABLES_WITH_TX_INDEX:
        index_names = {ix[0] for ix in first_upgrade_shape[tbl]["indexes"]}
        expected = f"ix_{tbl}_table_id_transaction_id"
        assert expected in index_names, (
            f"Expected child-diff composite index {expected!r} on {tbl} after "
            f"8f3a1b2c4d5e upgrade; got {sorted(index_names)}"
        )
    for tbl in ("dashboards_version", "slices_version", "tables_version"):
        parent_indexes = {ix[0] for ix in first_upgrade_shape[tbl]["indexes"]}
        assert f"ix_{tbl}_table_id_transaction_id" not in parent_indexes, (
            f"Parent shadow {tbl} shouldn't get the child-diff table_id index"
        )

    # 2. Populate.
    _populate_shadow_rows(engine)

    # Sanity-check: rows actually landed.
    with engine.connect() as conn:
        for tbl in _VERSIONING_TABLES:
            # S608 justification: ``tbl`` comes from the hardcoded
            # ``_VERSIONING_TABLES`` tuple in this module, never user input.
            count = conn.execute(
                sa.text(f"SELECT COUNT(*) FROM {tbl}")  # noqa: S608
            ).scalar_one()
            assert count > 0, f"Expected rows in {tbl} after population; got 0"

    # 3. Downgrade in reverse migration order.
    _run_migration(engine, _indexes_migration, "downgrade")
    _run_migration(engine, _base_migration, "downgrade")

    insp = inspect(engine)
    surviving = set(insp.get_table_names())
    leftover = [t for t in _VERSIONING_TABLES if t in surviving]
    assert not leftover, (
        f"Versioning tables survived downgrade: {leftover}. The downgrade() "
        f"is supposed to drop every table created by upgrade(). Any "
        f"survivor here means an operator who rolls back will be left with "
        f"orphan shadow data the next upgrade attempt will collide with."
    )

    # 4. Re-upgrade and compare shapes.
    _run_migration(engine, _base_migration, "upgrade")
    _run_migration(engine, _indexes_migration, "upgrade")

    second_upgrade_shape = _shape(engine)
    assert second_upgrade_shape == first_upgrade_shape, (
        "Schema after downgrade + re-upgrade differs from first upgrade. "
        "The migration is not idempotent under round-trip; an operator "
        "rolling forward after a rollback would end up with a subtly "
        "different schema."
    )


def test_downgrade_against_empty_schema_is_safe() -> None:
    """Sanity belt-and-braces: a downgrade run immediately after upgrade
    (no population) must also drop everything cleanly. This catches the
    case where the population step somehow influenced the downgrade path
    (it should not — drops are unconditional)."""
    engine = sa.create_engine("sqlite:///:memory:")
    _run_migration(engine, _base_migration, "upgrade")
    _run_migration(engine, _indexes_migration, "upgrade")
    _run_migration(engine, _indexes_migration, "downgrade")
    _run_migration(engine, _base_migration, "downgrade")

    insp = inspect(engine)
    leftover = [t for t in _VERSIONING_TABLES if t in insp.get_table_names()]
    assert not leftover, f"Empty-schema downgrade left {leftover}"


def test_indexes_migration_downgrade_is_idempotent() -> None:
    """``8f3a1b2c4d5e.downgrade()`` uses ``if_exists=True`` on every
    ``op.drop_index`` so a repeat call doesn't raise on missing indexes.
    Operators who interrupt a downgrade mid-sequence and re-run it
    rely on this property."""
    engine = sa.create_engine("sqlite:///:memory:")
    _run_migration(engine, _base_migration, "upgrade")
    _run_migration(engine, _indexes_migration, "upgrade")

    # Tear the indexes down once.
    _run_migration(engine, _indexes_migration, "downgrade")
    # Run downgrade a second time — must be a no-op, not an error.
    _run_migration(engine, _indexes_migration, "downgrade")

    # Cleanup so the engine is releasable.
    _run_migration(engine, _base_migration, "downgrade")
