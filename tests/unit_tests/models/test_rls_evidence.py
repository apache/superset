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
"""Tests for the append-only ``rls_enforcement_evidence`` table and model.

The table is exercised against a real SQLite database (same engine family
Superset supports for its metadata store) via the model's own metadata:
the table is created, a row is inserted and read back, and the schema shape
(columns, types, nullability, indices) is asserted. A second test runs the
Alembic migration's ``upgrade``/``downgrade`` against a throwaway on-disk
SQLite database to prove the table is created and cleanly dropped.
"""

from __future__ import annotations

from datetime import datetime, timezone

import sqlalchemy as sa
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import Session, sessionmaker


def _create_table(engine: sa.engine.Engine) -> None:
    from superset.models.rls_evidence import RlsEnforcementEvidence

    RlsEnforcementEvidence.__table__.create(bind=engine)


def test_evidence_table_columns_and_nullability() -> None:
    """@AC-FR10-01: the evidence table has the required columns with the
    correct types and nullability."""
    from superset.models.rls_evidence import RlsEnforcementEvidence

    engine = create_engine("sqlite://", future=True)
    _create_table(engine)

    inspector = inspect(engine)
    columns = {c["name"]: c for c in inspector.get_columns("rls_enforcement_evidence")}

    expected_nullability = {
        "id": False,
        "ts": False,
        "path": False,
        "identity_handle": False,
        "datasource_kind": False,
        "datasource_id": True,
        "outcome": False,
        "applied_filter_count": False,
        "denial_class": True,
        "integrity_prev_hash": True,
        "integrity_hash": True,
    }
    assert set(columns) == set(expected_nullability)
    for name, nullable in expected_nullability.items():
        assert columns[name]["nullable"] is nullable, name

    # Primary key is id.
    pk = inspector.get_pk_constraint("rls_enforcement_evidence")
    assert pk["constrained_columns"] == ["id"]

    # No foreign keys — evidence must outlive rule deletion.
    assert inspector.get_foreign_keys("rls_enforcement_evidence") == []

    # Tablename constant on the model.
    assert RlsEnforcementEvidence.__tablename__ == "rls_enforcement_evidence"


def test_evidence_table_indices() -> None:
    """@AC-FR10-02: the three query indices are present."""
    engine = create_engine("sqlite://", future=True)
    _create_table(engine)

    inspector = inspect(engine)
    index_names = {
        ix["name"] for ix in inspector.get_indexes("rls_enforcement_evidence")
    }
    assert {
        "ix_rls_evidence_ts",
        "ix_rls_evidence_identity_ts",
        "ix_rls_evidence_outcome_ts",
    } <= index_names


def test_evidence_row_round_trips() -> None:
    """@AC-FR10-03: an evidence row inserts and reads back against a real DB."""
    from superset.models.rls_evidence import RlsEnforcementEvidence

    engine = create_engine("sqlite://", future=True)
    _create_table(engine)
    factory = sessionmaker(bind=engine, future=True)
    session: Session = factory()

    ts = datetime(2026, 8, 7, 12, 0, 0, tzinfo=timezone.utc).replace(tzinfo=None)
    row = RlsEnforcementEvidence(
        ts=ts,
        path="embedded_guest",
        identity_handle="opaque-handle",
        datasource_kind="query",
        datasource_id=42,
        outcome="applied",
        applied_filter_count=2,
    )
    session.add(row)
    session.commit()

    fetched = session.query(RlsEnforcementEvidence).one()
    assert fetched.id is not None
    assert fetched.ts == ts
    assert fetched.path == "embedded_guest"
    assert fetched.identity_handle == "opaque-handle"
    assert fetched.datasource_kind == "query"
    assert fetched.datasource_id == 42
    assert fetched.outcome == "applied"
    assert fetched.applied_filter_count == 2
    # Optional columns default to NULL / their column default.
    assert fetched.denial_class is None
    assert fetched.integrity_prev_hash is None
    assert fetched.integrity_hash is None
    session.close()


def test_applied_filter_count_defaults_to_zero() -> None:
    """@AC-FR10-04: applied_filter_count defaults to 0 when omitted."""
    from superset.models.rls_evidence import RlsEnforcementEvidence

    engine = create_engine("sqlite://", future=True)
    _create_table(engine)
    factory = sessionmaker(bind=engine, future=True)
    session: Session = factory()

    row = RlsEnforcementEvidence(
        ts=datetime(2026, 8, 7, 12, 0, 0),
        path="explore",
        identity_handle="handle",
        datasource_kind="sqla_table",
        outcome="denied",
        denial_class="parse_failure",
    )
    session.add(row)
    session.commit()

    fetched = session.query(RlsEnforcementEvidence).one()
    assert fetched.applied_filter_count == 0
    assert fetched.denial_class == "parse_failure"
    session.close()


def test_migration_upgrade_and_downgrade_round_trip(tmp_path) -> None:
    """@AC-FR10-05: the migration creates the table and its indices on
    upgrade and cleanly drops them on downgrade, against a real SQLite DB."""
    import importlib.util

    from alembic.migration import MigrationContext
    from alembic.operations import Operations

    module_path = (
        "superset/migrations/versions/"
        "2026-08-07_12-00_f5a1b2c3d4e6_add_rls_enforcement_evidence.py"
    )
    spec = importlib.util.spec_from_file_location("rls_evidence_migration", module_path)
    assert spec is not None
    assert spec.loader is not None
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)

    db_file = tmp_path / "evidence.db"
    engine = create_engine(f"sqlite:///{db_file}", future=True)

    with engine.connect() as connection:
        ctx = MigrationContext.configure(connection)
        ops = Operations(ctx)
        import superset.migrations.shared.utils as migration_utils

        # The shared helpers operate on the module-level ``op`` proxy.
        original_op = migration_utils.op
        migration_utils.op = ops
        try:
            migration.upgrade()
            inspector = inspect(connection)
            assert "rls_enforcement_evidence" in inspector.get_table_names()
            index_names = {
                ix["name"]
                for ix in inspector.get_indexes("rls_enforcement_evidence")
            }
            assert {
                "ix_rls_evidence_ts",
                "ix_rls_evidence_identity_ts",
                "ix_rls_evidence_outcome_ts",
            } <= index_names

            migration.downgrade()
            inspector = inspect(connection)
            assert "rls_enforcement_evidence" not in inspector.get_table_names()
        finally:
            migration_utils.op = original_op


def test_migration_chains_to_current_head() -> None:
    """@AC-FR10-06: the migration is additive and chains onto the prior head."""
    import importlib.util

    module_path = (
        "superset/migrations/versions/"
        "2026-08-07_12-00_f5a1b2c3d4e6_add_rls_enforcement_evidence.py"
    )
    spec = importlib.util.spec_from_file_location(
        "rls_evidence_migration2", module_path
    )
    assert spec is not None
    assert spec.loader is not None
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)

    assert migration.revision == "f5a1b2c3d4e6"
    assert migration.down_revision == "e7d93a524ff6"
