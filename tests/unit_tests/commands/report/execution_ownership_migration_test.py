# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements. See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership. The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License. You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied. See the License for the
# specific language governing permissions and limitations
# under the License.

"""Round-trip coverage for report execution ownership columns."""

import importlib.util
from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations
from alembic.script import ScriptDirectory


def test_execution_ownership_migration_is_in_single_resolvable_chain() -> None:
    """Resolve actual migration files so a phantom parent cannot pass CI."""
    directory = Path(__file__).resolve().parents[4] / "superset/migrations"
    scripts = ScriptDirectory(str(directory))
    revisions = {revision.revision for revision in scripts.walk_revisions()}
    assert "93d1b4a76c02" in revisions
    assert len(scripts.get_heads()) == 1


@pytest.mark.parametrize("partial_upgrade", [False, True])
def test_execution_ownership_migration_round_trip(
    partial_upgrade: bool, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Preserve schedules and resume an interrupted add-column migration."""
    path = Path(__file__).resolve().parents[4] / (
        "superset/migrations/versions/"
        "2026-09-16_00-00_93d1b4a76c02_add_report_execution_ownership.py"
    )
    spec = importlib.util.spec_from_file_location("execution_ownership_migration", path)
    assert spec is not None
    assert spec.loader is not None
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = sa.create_engine("sqlite://")
    with engine.begin() as connection:
        connection.exec_driver_sql(
            "CREATE TABLE report_schedule (id INTEGER PRIMARY KEY, name VARCHAR(50))"
        )
        connection.exec_driver_sql(
            "INSERT INTO report_schedule (id, name) VALUES (1, 'preserved')"
        )
        if partial_upgrade:
            connection.exec_driver_sql(
                "ALTER TABLE report_schedule ADD COLUMN execution_owner VARCHAR(36)"
            )
        monkeypatch.setattr(
            migration, "op", Operations(MigrationContext.configure(connection))
        )
        migration.upgrade()
        columns = {
            c["name"]: c for c in sa.inspect(connection).get_columns("report_schedule")
        }
        assert columns["execution_owner"]["nullable"]
        assert columns["execution_window"]["nullable"]
        assert (
            connection.exec_driver_sql("SELECT name FROM report_schedule").scalar()
            == "preserved"
        )
        migration.downgrade()
        assert {
            c["name"] for c in sa.inspect(connection).get_columns("report_schedule")
        } == {"id", "name"}
        migration.upgrade()
        assert (
            connection.exec_driver_sql("SELECT COUNT(*) FROM report_schedule").scalar()
            == 1
        )
    engine.dispose()
