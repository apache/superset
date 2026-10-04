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
"""Tests for migration ``e4a7c2b9d1f3_add_run_as_and_report_config`` (SIP-209).

Runs ``upgrade()`` and ``downgrade()`` against an in-memory SQLite engine
seeded with minimal ``ab_user`` and ``report_schedule`` tables and asserts the
new nullable columns and the ``report_config`` table are created and removed
without touching existing rows.
"""

from __future__ import annotations

from importlib import import_module
from pathlib import Path

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from alembic.script import ScriptDirectory
from sqlalchemy import (
    Column,
    create_engine,
    inspect,
    Integer,
    MetaData,
    select,
    String,
    Table,
)
from sqlalchemy.engine import Engine

migration = import_module(
    "superset.migrations.versions."
    "2026-10-05_12-00_e4a7c2b9d1f3_add_run_as_and_report_config"
)


@pytest.fixture
def engine() -> Engine:
    engine = create_engine("sqlite:///:memory:")
    md = MetaData()
    Table(
        "ab_user",
        md,
        Column("id", Integer, primary_key=True),
        Column("username", String(64)),
    )
    report_schedule = Table(
        migration.REPORT_SCHEDULE_TABLE,
        md,
        Column("id", Integer, primary_key=True),
        Column("name", String(150), nullable=False),
        Column("type", String(50), nullable=False),
    )
    md.create_all(engine)
    with engine.begin() as conn:
        conn.execute(
            report_schedule.insert(),
            [{"id": 1, "name": "daily", "type": "Report"}],
        )
    return engine


def _columns(engine: Engine, table: str) -> set[str]:
    return {col["name"] for col in inspect(engine).get_columns(table)}


def _run(engine: Engine, fn) -> None:
    with engine.begin() as conn:
        ctx = MigrationContext.configure(conn)
        with Operations.context(ctx):
            fn()


def test_upgrade_adds_columns_and_config_table(engine: Engine) -> None:
    _run(engine, migration.upgrade)

    columns = _columns(engine, migration.REPORT_SCHEDULE_TABLE)
    assert {
        "run_as_fk",
        "run_alert_query_as_fk",
        "run_as_type",
        "run_alert_query_as_type",
    } <= columns
    assert inspect(engine).has_table(migration.REPORT_CONFIG_TABLE)
    assert {"id", "key", "value", "created_on", "changed_on"} <= _columns(
        engine, migration.REPORT_CONFIG_TABLE
    )

    # Existing schedules are untouched and keep NULL executors (legacy path).
    with engine.begin() as conn:
        table = Table(migration.REPORT_SCHEDULE_TABLE, MetaData(), autoload_with=conn)
        rows = conn.execute(select(table)).fetchall()
    assert len(rows) == 1
    assert rows[0].run_as_fk is None
    assert rows[0].run_alert_query_as_fk is None

    # Idempotent: a second run is a no-op.
    _run(engine, migration.upgrade)


def test_downgrade_reverts(engine: Engine) -> None:
    _run(engine, migration.upgrade)
    _run(engine, migration.downgrade)

    assert not inspect(engine).has_table(migration.REPORT_CONFIG_TABLE)
    columns = _columns(engine, migration.REPORT_SCHEDULE_TABLE)
    assert "run_as_fk" not in columns
    assert "run_alert_query_as_fk" not in columns
    with engine.begin() as conn:
        table = Table(migration.REPORT_SCHEDULE_TABLE, MetaData(), autoload_with=conn)
        assert len(conn.execute(select(table)).fetchall()) == 1


def test_sip_migration_is_the_single_head() -> None:
    directory = Path(__file__).resolve().parents[3] / "superset" / "migrations"
    script = ScriptDirectory(str(directory))
    assert script.get_heads() == [migration.revision]


def test_deleted_user_keeps_specific_executor_type(engine: Engine) -> None:
    from sqlalchemy import text

    _run(engine, migration.upgrade)
    with engine.begin() as conn:
        conn.execute(text("PRAGMA foreign_keys=ON"))
        conn.execute(text("INSERT INTO ab_user (id, username) VALUES (1, 'executor')"))
        conn.execute(
            text(
                "UPDATE report_schedule SET run_as_fk=1, run_as_type='fixed_user', "
                "run_alert_query_as_fk=1, run_alert_query_as_type='fixed_user'"
            )
        )
        conn.execute(text("DELETE FROM ab_user WHERE id=1"))
        row = conn.execute(
            text(
                "SELECT run_as_fk, run_as_type, run_alert_query_as_fk, "
                "run_alert_query_as_type FROM report_schedule"
            )
        ).one()
        assert tuple(row) == (None, "fixed_user", None, "fixed_user")
    _run(engine, migration.downgrade)
    _run(engine, migration.upgrade)


def test_migrated_config_table_accepts_model_generated_uuids(engine: Engine) -> None:
    from uuid import UUID

    from superset.reports.models import ReportConfig

    _run(engine, migration.upgrade)
    table = ReportConfig.__table__
    with engine.begin() as conn:
        conn.execute(
            table.insert(),
            [
                {"key": "alerts_attach_reports", "value": "true"},
                {"key": "allowed_email_domains", "value": "[]"},
            ],
        )
        ids = conn.execute(select(table.c.id)).scalars().all()
        assert len(set(ids)) == 2
        assert all(isinstance(value, UUID) for value in ids)
    assert inspect(engine).get_pk_constraint(migration.REPORT_CONFIG_TABLE)[
        "constrained_columns"
    ] == ["id"]
    _run(engine, migration.downgrade)
