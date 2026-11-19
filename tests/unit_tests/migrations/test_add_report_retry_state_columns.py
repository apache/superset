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
"""Tests for migration ``f3a8c1d2e9b7_add_report_retry_state_columns``.

A database can already hold these columns before this revision runs, for
example when the retry feature was backported to an older release under a
different revision ID and the database is later stamped back onto this chain.
The migration must then skip the existing columns and keep their values.
"""

from __future__ import annotations

from importlib import import_module

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import (
    Boolean,
    Column,
    create_engine,
    DateTime,
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
    "2026-07-31_00-00_f3a8c1d2e9b7_add_report_retry_state_columns"
)

RETRY_COLUMNS = {
    "retry_on_failure",
    "retry_max_attempts",
    "send_failed_reports",
    "retry_notify_owners",
    "retry_notify_recipients",
    "retry_attempt",
    "retry_scheduled_dttm",
}


def _report_schedule(md: MetaData, *extra: Column) -> Table:
    return Table(
        "report_schedule",
        md,
        Column("id", Integer, primary_key=True),
        Column("name", String(150), nullable=False),
        *extra,
    )


@pytest.fixture
def engine() -> Engine:
    engine = create_engine("sqlite:///:memory:")
    md = MetaData()
    report_schedule = _report_schedule(md)
    md.create_all(engine)
    with engine.begin() as conn:
        conn.execute(report_schedule.insert(), [{"id": 1, "name": "daily"}])
    return engine


@pytest.fixture
def engine_with_retry_columns() -> Engine:
    """A database that already has the retry columns, with non-default values."""
    engine = create_engine("sqlite:///:memory:")
    md = MetaData()
    report_schedule = _report_schedule(
        md,
        Column("retry_on_failure", Boolean, nullable=False, server_default="0"),
        Column("retry_max_attempts", Integer, nullable=False, server_default="3"),
        Column("send_failed_reports", Boolean, nullable=False, server_default="0"),
        Column("retry_notify_owners", Boolean, nullable=False, server_default="1"),
        Column("retry_notify_recipients", Boolean, nullable=False, server_default="0"),
        Column("retry_attempt", Integer, nullable=False, server_default="0"),
        Column("retry_scheduled_dttm", DateTime, nullable=True),
    )
    md.create_all(engine)
    with engine.begin() as conn:
        conn.execute(
            report_schedule.insert(),
            [
                {
                    "id": 1,
                    "name": "daily",
                    "retry_on_failure": True,
                    "retry_max_attempts": 7,
                    "send_failed_reports": True,
                    "retry_notify_owners": False,
                    "retry_notify_recipients": True,
                    "retry_attempt": 2,
                }
            ],
        )
    return engine


def _columns(engine: Engine) -> set[str]:
    return {col["name"] for col in inspect(engine).get_columns("report_schedule")}


def _run(engine: Engine, fn) -> None:
    with engine.begin() as conn:
        ctx = MigrationContext.configure(conn)
        with Operations.context(ctx):
            fn()


def test_upgrade_adds_columns_with_defaults(engine: Engine) -> None:
    _run(engine, migration.upgrade)

    assert RETRY_COLUMNS <= _columns(engine)
    table = Table("report_schedule", MetaData(), autoload_with=engine)
    with engine.connect() as conn:
        row = conn.execute(select(table)).mappings().one()
    assert row["retry_max_attempts"] == 3
    assert row["retry_attempt"] == 0
    assert row["retry_scheduled_dttm"] is None


def test_upgrade_skips_existing_columns_and_keeps_values(
    engine_with_retry_columns: Engine,
) -> None:
    _run(engine_with_retry_columns, migration.upgrade)

    assert RETRY_COLUMNS <= _columns(engine_with_retry_columns)
    table = Table(
        "report_schedule", MetaData(), autoload_with=engine_with_retry_columns
    )
    with engine_with_retry_columns.connect() as conn:
        row = conn.execute(select(table)).mappings().one()
    assert bool(row["retry_on_failure"]) is True
    assert row["retry_max_attempts"] == 7
    assert bool(row["send_failed_reports"]) is True
    assert bool(row["retry_notify_owners"]) is False
    assert bool(row["retry_notify_recipients"]) is True
    assert row["retry_attempt"] == 2


def test_upgrade_adds_only_missing_columns(engine: Engine) -> None:
    with engine.begin() as conn:
        ctx = MigrationContext.configure(conn)
        with Operations.context(ctx) as op:
            op.add_column(
                "report_schedule",
                Column(
                    "retry_max_attempts", Integer, nullable=False, server_default="5"
                ),
            )

    _run(engine, migration.upgrade)

    assert RETRY_COLUMNS <= _columns(engine)
    table = Table("report_schedule", MetaData(), autoload_with=engine)
    with engine.connect() as conn:
        row = conn.execute(select(table)).mappings().one()
    assert row["retry_max_attempts"] == 5


def test_downgrade_drops_columns(engine: Engine) -> None:
    _run(engine, migration.upgrade)
    _run(engine, migration.downgrade)

    assert not RETRY_COLUMNS & _columns(engine)
    assert {"id", "name"} <= _columns(engine)


def test_downgrade_tolerates_missing_columns(engine: Engine) -> None:
    _run(engine, migration.downgrade)

    assert _columns(engine) == {"id", "name"}
