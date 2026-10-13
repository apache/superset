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
new nullable columns are created and removed without touching existing rows.
"""

from __future__ import annotations

from importlib import import_module

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import (
    Column,
    create_engine,
    ForeignKey,
    inspect,
    Integer,
    LargeBinary,
    MetaData,
    select,
    String,
    Table,
)
from sqlalchemy.engine import Engine
from sqlalchemy_utils import UUIDType

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
        Column("report_format", String(50)),
        Column("chart_id", Integer),
        Column("dashboard_id", Integer),
    )
    Table(
        "key_value",
        md,
        Column("id", Integer, primary_key=True),
        Column("resource", String(32), nullable=False),
        Column("uuid", UUIDType(binary=True), unique=True),
        Column("value", LargeBinary, nullable=False),
    )
    for name in (
        "report_recipient",
        "report_execution_log",
    ):
        Table(
            name,
            md,
            Column("id", Integer, primary_key=True),
            Column("report_schedule_id", Integer, nullable=False),
        )
    Table(
        "report_schedule_editors",
        md,
        Column("id", Integer, primary_key=True),
        Column(
            "report_schedule_id",
            Integer,
            ForeignKey("report_schedule.id", ondelete="CASCADE"),
            nullable=False,
        ),
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


def test_upgrade_adds_executor_columns(engine: Engine) -> None:
    from superset.key_value.types import FIXED_RESOURCE_KEYS, KeyValueResource

    assert (
        migration.CONFIG_UUID
        == FIXED_RESOURCE_KEYS[KeyValueResource.ALERT_REPORT_CONFIG]
    )
    assert migration.CONFIG_RESOURCE == KeyValueResource.ALERT_REPORT_CONFIG.value
    _run(engine, migration.upgrade)

    columns = _columns(engine, migration.REPORT_SCHEDULE_TABLE)
    assert {
        "run_as_fk",
        "run_alert_query_as_fk",
        "run_as_type",
        "run_alert_query_as_type",
    } <= columns
    assert not inspect(engine).has_table("report_config")
    with engine.begin() as conn:
        rows = conn.execute(select(migration.KEY_VALUE_TABLE)).fetchall()
        assert len(rows) == 1
        assert rows[0].resource == migration.CONFIG_RESOURCE
        assert rows[0].uuid == migration.CONFIG_UUID
        assert rows[0].value == b'{"version": 1, "settings": {}}'

    # Existing schedules are untouched and keep NULL executors (legacy path).
    with engine.begin() as conn:
        table = Table(migration.REPORT_SCHEDULE_TABLE, MetaData(), autoload_with=conn)
        rows = conn.execute(select(table)).fetchall()
    assert len(rows) == 1
    assert rows[0].run_as_fk is None
    assert rows[0].run_alert_query_as_fk is None

    # Idempotent: a second run is a no-op.
    _run(engine, migration.upgrade)
    with engine.begin() as conn:
        assert len(conn.execute(select(migration.KEY_VALUE_TABLE)).fetchall()) == 1


def test_downgrade_reverts(engine: Engine) -> None:
    _run(engine, migration.upgrade)
    _run(engine, migration.downgrade)

    assert not inspect(engine).has_table("report_config")
    with engine.begin() as conn:
        assert conn.execute(select(migration.KEY_VALUE_TABLE)).fetchall() == []
    columns = _columns(engine, migration.REPORT_SCHEDULE_TABLE)
    assert "run_as_fk" not in columns
    assert "run_alert_query_as_fk" not in columns
    with engine.begin() as conn:
        table = Table(migration.REPORT_SCHEDULE_TABLE, MetaData(), autoload_with=conn)
        assert len(conn.execute(select(table)).fetchall()) == 1


@pytest.mark.parametrize("enforce_foreign_keys", [False, True])
def test_downgrade_converts_or_deletes_attachment_free_alerts(
    engine: Engine, enforce_foreign_keys: bool
) -> None:
    _run(engine, migration.upgrade)
    with engine.begin() as conn:
        conn.exec_driver_sql(
            f"PRAGMA foreign_keys={'ON' if enforce_foreign_keys else 'OFF'}"
        )
        assert conn.exec_driver_sql("PRAGMA foreign_keys").scalar_one() == int(
            enforce_foreign_keys
        )
        schedules = Table(
            migration.REPORT_SCHEDULE_TABLE, MetaData(), autoload_with=conn
        )
        conn.execute(
            schedules.insert(),
            [
                {
                    "id": 2,
                    "name": "chart alert",
                    "type": "Alert",
                    "report_format": "NONE",
                    "chart_id": 7,
                    "dashboard_id": None,
                },
                {
                    "id": 3,
                    "name": "dashboard alert",
                    "type": "Alert",
                    "report_format": "NONE",
                    "chart_id": None,
                    "dashboard_id": 8,
                },
                {
                    "id": 4,
                    "name": "asset-less alert",
                    "type": "Alert",
                    "report_format": "NONE",
                    "chart_id": None,
                    "dashboard_id": None,
                },
                {
                    "id": 5,
                    "name": "existing PNG",
                    "type": "Alert",
                    "report_format": "PNG",
                    "chart_id": None,
                    "dashboard_id": None,
                },
            ],
        )
        for name in (
            "report_recipient",
            "report_execution_log",
            "report_schedule_editors",
        ):
            dependent = Table(name, MetaData(), autoload_with=conn)
            conn.execute(dependent.insert().values(id=1, report_schedule_id=4))

    _run(engine, migration.downgrade)

    with engine.begin() as conn:
        schedules = Table(
            migration.REPORT_SCHEDULE_TABLE, MetaData(), autoload_with=conn
        )
        rows = {row.id: row.report_format for row in conn.execute(select(schedules))}
        assert rows == {1: None, 2: "PNG", 3: "PNG", 5: "PNG"}
        for name in (
            "report_recipient",
            "report_execution_log",
            "report_schedule_editors",
        ):
            dependent = Table(name, MetaData(), autoload_with=conn)
            assert conn.execute(select(dependent)).fetchall() == []


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
