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
"""Exercise archive scope DDL, interrupted upgrades, and content-safe rollback."""

from importlib import import_module
from uuid import uuid4

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy.exc import IntegrityError

migration = import_module(
    "superset.migrations.versions.2026-11-23_00-00_a7d29bc4e681_add_chart_archive_scope"
)


def test_archive_scope_upgrade_constraints_and_cascade() -> None:
    """Rerun upgrade repairs indexes and UUID scopes cascade with their transaction."""
    engine = sa.create_engine("sqlite://")
    with engine.begin() as connection:
        connection.exec_driver_sql("PRAGMA foreign_keys=ON")
        connection.exec_driver_sql(
            "CREATE TABLE version_transaction (id BIGINT PRIMARY KEY)"
        )
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            connection.exec_driver_sql("DROP INDEX ix_chart_archive_scope_chart")
            migration.upgrade()
        inspector = sa.inspect(connection)
        assert {
            index["name"]
            for index in inspector.get_indexes("version_chart_archive_scope")
        } == {"ix_chart_archive_scope_dashboard", "ix_chart_archive_scope_chart"}
        assert (
            inspector.get_foreign_keys("version_chart_archive_scope")[0]["options"][
                "ondelete"
            ]
            == "CASCADE"
        )
        from superset.versioning.lifecycle_table import (
            version_chart_archive_scope_table as scope,
        )

        connection.exec_driver_sql("INSERT INTO version_transaction VALUES (1)")
        row = {
            "id": uuid4(),
            "transaction_id": 1,
            "chart_id": 2,
            "chart_uuid": uuid4(),
            "dashboard_id": 3,
            "dashboard_uuid": uuid4(),
        }
        connection.execute(scope.insert().values(**row))
        assert (
            connection.execute(sa.select(scope.c.chart_uuid)).scalar_one()
            == row["chart_uuid"]
        )
        with pytest.raises(IntegrityError):
            connection.execute(scope.insert().values(**{**row, "id": uuid4()}))
        connection.exec_driver_sql("DELETE FROM version_transaction WHERE id=1")
        assert connection.scalar(sa.select(sa.func.count()).select_from(scope)) == 0
    engine.dispose()


def test_archive_scope_downgrade_preserves_content_and_transactions() -> None:
    """Repeated downgrade deletes only archive events without sweeping transactions."""
    engine = sa.create_engine("sqlite://")
    with engine.begin() as connection:
        connection.exec_driver_sql(
            "CREATE TABLE version_transaction (id BIGINT PRIMARY KEY)"
        )
        connection.exec_driver_sql("INSERT INTO version_transaction VALUES (1)")
        connection.exec_driver_sql("CREATE TABLE version_changes (kind VARCHAR(32))")
        connection.exec_driver_sql(
            "INSERT INTO version_changes VALUES ('field'), ('__archive__')"
        )
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            migration.downgrade()
            migration.downgrade()
        assert not sa.inspect(connection).has_table("version_chart_archive_scope")
        assert connection.exec_driver_sql(
            "SELECT kind FROM version_changes"
        ).scalars().all() == ["field"]
        assert connection.exec_driver_sql(
            "SELECT id FROM version_transaction"
        ).scalars().all() == [1]
    engine.dispose()
