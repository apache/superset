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
"""Archive transaction boundaries against disposable PostgreSQL and MySQL servers.

Run with pytest -m testcontainers tests/testcontainers/versioning/test_chart_archive.py.
The dedicated versioning-testcontainers workflow exercises both engines on PRs.
"""

from __future__ import annotations

import os
import sys
from collections.abc import Iterator
from importlib import import_module
from threading import Event, Thread
from time import perf_counter
from types import SimpleNamespace
from typing import Any
from uuid import uuid4

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy.engine import Connection, Engine
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy_continuum import versioning_manager
from sqlalchemy_utils import UUIDType

from superset.versioning import lifecycle
from superset.versioning.changes.table import version_changes_table
from superset.versioning.lifecycle_table import (
    version_chart_archive_scope_table as scope,
)

pytestmark = pytest.mark.testcontainers

# CI splits engines into independent jobs; a local invocation exercises both.
_selected_backend = os.environ.get("SUPERSET_VERSIONING_TEST_DIALECT")
if _selected_backend not in (None, "POSTGRES", "MYSQL"):
    raise ValueError("SUPERSET_VERSIONING_TEST_DIALECT must be POSTGRES or MYSQL")
_BACKENDS = [_selected_backend] if _selected_backend else ["POSTGRES", "MYSQL"]

migration = import_module(
    "superset.migrations.versions.2026-11-23_00-00_a7d29bc4e681_add_chart_archive_scope"
)


@pytest.fixture(scope="module", autouse=True)
def model_import_context() -> Iterator[None]:
    """Reuse pytest's app, or initialize SQLite for standalone execution."""
    # CI loads tests/conftest.py, which imports tests.integration_tests.test_app
    # and initializes models using its test configuration before this fixture.
    # The SQLite fallback supports standalone invocations with --noconftest.
    if "superset.models.dashboard" in sys.modules:
        yield
        return

    from superset.app import SupersetApp
    from superset.extensions import db
    from superset.initialization import SupersetAppInitializer

    app = SupersetApp(__name__)
    app.config.from_object("superset.config")
    app.config.update(
        SQLALCHEMY_DATABASE_URI="sqlite://",
        TESTING=True,
        WTF_CSRF_ENABLED=False,
        SECRET_KEY="isolated-archive-backend-tests",  # noqa: S106
        ENABLE_VERSIONING_CAPTURE=False,
    )
    SupersetAppInitializer(app).init_app()
    with app.app_context():
        yield
        db.session.remove()
        db.engine.dispose()


@pytest.fixture(scope="module", params=_BACKENDS)
def backend_uri(request: pytest.FixtureRequest) -> Iterator[str]:
    """Start a real disposable metadata server; absent drivers fail in CI."""
    from tests.testcontainers.db_engine_specs._driver import require_driver

    if request.param == "POSTGRES":
        require_driver("testcontainers.community.postgres")
        from testcontainers.community.postgres import PostgresContainer

        with PostgresContainer("postgres:17-alpine") as container:
            yield container.get_connection_url()
    else:
        require_driver("testcontainers.community.mysql")
        require_driver("pymysql")
        from testcontainers.community.mysql import MySqlContainer

        with MySqlContainer("mysql:8.0", dialect="pymysql") as container:
            yield container.get_connection_url()


@pytest.fixture
def backend(backend_uri: str, monkeypatch: pytest.MonkeyPatch) -> Iterator[Engine]:
    """Create minimal real metadata tables in the test-owned database."""
    engine = sa.create_engine(backend_uri)
    metadata = sa.MetaData()
    tx = sa.Table(
        "version_transaction",
        metadata,
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column("issued_at", sa.DateTime),
        sa.Column("user_id", sa.Integer),
        sa.Column("action_kind", sa.String(32)),
    )
    version_changes_table.to_metadata(metadata)
    sa.Table(
        "dashboards",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("uuid", UUIDType(binary=True)),
    )
    sa.Table(
        "dashboard_slices",
        metadata,
        sa.Column("dashboard_id", sa.Integer),
        sa.Column("slice_id", sa.Integer),
    )
    sa.Table(
        "archive_test_work",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("value", sa.Integer),
    )
    sa.Table(
        "archive_test_locks",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("value", sa.Integer),
    )
    # Refuse to overwrite a deployment or another concurrently running fixture.
    assert not set(metadata.tables).intersection(sa.inspect(engine).get_table_names())
    metadata.create_all(engine)
    with engine.begin() as connection:
        with Operations.context(MigrationContext.configure(connection)):
            started = perf_counter()
            migration.upgrade()
            print(
                f"{engine.dialect.name}: empty-table upgrade="
                f"{(perf_counter() - started) * 1000:.2f}ms"
            )
        connection.execute(
            metadata.tables["archive_test_work"].insert(), {"id": 1, "value": 0}
        )
        connection.execute(
            metadata.tables["archive_test_locks"].insert(),
            [{"id": i, "value": 0} for i in range(1, 103)],
        )
    monkeypatch.setattr(
        versioning_manager, "transaction_cls", SimpleNamespace(__table__=tx)
    )
    monkeypatch.setattr(lifecycle, "transaction_actor_args", lambda: {})
    try:
        yield engine
    finally:
        with engine.begin() as connection:
            with Operations.context(MigrationContext.configure(connection)):
                migration.downgrade()
        metadata.drop_all(engine)
        engine.dispose()


def _code(error: DBAPIError) -> str | int:
    """Return the driver's structured diagnostic without parsing SQL or messages."""
    return getattr(error.orig, "pgcode", None) or error.orig.args[0]


def _hold_conflicting_lock(
    backend: Engine,
    blocker_ready: Event,
    contender_ready: Event,
    blocker_errors: list[BaseException],
) -> None:
    """Hold row two and wait on row one, with a heavier MySQL transaction."""
    pg = backend.dialect.name == "postgresql"
    try:
        with backend.begin() as connection:
            if pg:
                connection.exec_driver_sql("SET LOCAL deadlock_timeout='10s'")
            connection.exec_driver_sql(
                "UPDATE archive_test_locks SET value=2 WHERE id=2"
            )
            if not pg:
                connection.exec_driver_sql(
                    "UPDATE archive_test_locks SET value=2 WHERE id>=3"
                )
            blocker_ready.set()
            assert contender_ready.wait(10)
            connection.exec_driver_sql(
                "UPDATE archive_test_locks SET value=2 WHERE id=1"
            )
    except BaseException as error:
        blocker_errors.append(error)


def test_lifecycle_real_contention(
    backend: Engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The capture loop recovers PG deadlocks and aborts MySQL transaction loss."""
    pg = backend.dialect.name == "postgresql"
    blocker_ready, contender_ready = Event(), Event()
    blocker_errors: list[BaseException] = []
    observed_codes: list[str | int] = []
    attempted_charts: list[int] = []
    sql_after_error: list[str] = []
    error_seen = False

    original_write = lifecycle._write_archive

    def contended_write(
        connection: Connection,
        transaction_id: int,
        archive: lifecycle.ChartArchive,
        memberships: list[tuple[int, Any]],
    ) -> int:
        """Force the first chart's optional metadata statement into a real deadlock."""
        nonlocal error_seen
        attempted_charts.append(archive.chart_id)
        if archive.chart_id == 1:
            contender_ready.set()
            try:
                connection.exec_driver_sql(
                    "UPDATE archive_test_locks SET value=1 WHERE id=2"
                )
            except DBAPIError as error:
                observed_codes.append(_code(error))
                error_seen = True
                raise
        return original_write(connection, transaction_id, archive, memberships)

    monkeypatch.setattr(lifecycle, "_write_archive", contended_write)
    thread = Thread(
        target=_hold_conflicting_lock,
        args=(backend, blocker_ready, contender_ready, blocker_errors),
        daemon=True,
    )
    thread.start()
    assert blocker_ready.wait(10)
    try:
        with Session(backend) as session:
            connection = session.connection()
            if pg:
                connection.exec_driver_sql("SET LOCAL deadlock_timeout='100ms'")
            connection.exec_driver_sql(
                "UPDATE archive_test_work SET value=1 WHERE id=1"
            )
            connection.exec_driver_sql(
                "UPDATE archive_test_locks SET value=1 WHERE id=1"
            )

            def record_sql(
                _connection: Connection,
                _cursor: Any,
                statement: str,
                _parameters: Any,
                _context: Any,
                _many: bool,
            ) -> None:
                """Record every SQL statement after the failed optional write."""
                if error_seen:
                    sql_after_error.append(statement)

            sa.event.listen(connection, "before_cursor_execute", record_sql)
            archives = [lifecycle.ChartArchive(i, uuid4(), str(i)) for i in (1, 2)]
            if pg:
                lifecycle.capture_chart_archives(session, archives)
                session.commit()
                assert observed_codes == ["40P01"]
                assert attempted_charts == [1, 2]
            else:
                with pytest.raises(lifecycle.LifecycleCaptureFatalError) as raised:
                    lifecycle.capture_chart_archives(session, archives)
                assert observed_codes == [1213]
                assert attempted_charts == [1]
                rollback_error = raised.value.__cause__
                assert isinstance(rollback_error, DBAPIError)
                assert _code(rollback_error) == 1305
                assert isinstance(rollback_error.__cause__, DBAPIError)
                assert _code(rollback_error.__cause__) == 1213
                assert len(sql_after_error) == 1
                assert sql_after_error[0].startswith("ROLLBACK TO SAVEPOINT")
                session.rollback()
    finally:
        contender_ready.set()
        thread.join(15)
    assert not thread.is_alive()
    assert blocker_errors == []
    with backend.connect() as fresh:
        assert fresh.exec_driver_sql(
            "SELECT value FROM archive_test_work WHERE id=1"
        ).scalar_one() == int(pg)
        assert fresh.execute(
            sa.select(version_changes_table.c.entity_id)
        ).scalars().all() == ([2] if pg else [])


def test_mysql_timeout_preserves_caller_and_other_chart(
    backend: Engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    """MySQL 1205 is optional only after the actual chart savepoint rolls back."""
    if backend.dialect.name != "mysql":
        pytest.skip("MySQL-specific timeout semantics")
    original_write = lifecycle._write_archive
    codes: list[str | int] = []

    def timeout_write(
        connection: Connection,
        transaction_id: int,
        archive: lifecycle.ChartArchive,
        memberships: list[tuple[int, Any]],
    ) -> int:
        """Timeout only the first chart's metadata statement."""
        if archive.chart_id == 1:
            try:
                connection.exec_driver_sql(
                    "UPDATE archive_test_locks SET value=1 WHERE id=2"
                )
            except DBAPIError as error:
                codes.append(_code(error))
                raise
        return original_write(connection, transaction_id, archive, memberships)

    monkeypatch.setattr(lifecycle, "_write_archive", timeout_write)
    with backend.connect() as blocker_connection:
        blocker_transaction = blocker_connection.begin()
        blocker_connection.exec_driver_sql(
            "UPDATE archive_test_locks SET value=2 WHERE id=2"
        )
        try:
            with Session(backend) as session:
                session.execute(sa.text("SET SESSION innodb_lock_wait_timeout=1"))
                assert (
                    session.execute(
                        sa.text("SELECT @@innodb_rollback_on_timeout")
                    ).scalar_one()
                    == 0
                )
                session.execute(
                    sa.text("UPDATE archive_test_work SET value=1 WHERE id=1")
                )
                lifecycle.capture_chart_archives(
                    session,
                    [lifecycle.ChartArchive(i, uuid4(), str(i)) for i in (1, 2)],
                )
                session.commit()
        finally:
            blocker_transaction.rollback()
    assert codes == [1205]
    with backend.connect() as fresh:
        assert (
            fresh.exec_driver_sql(
                "SELECT value FROM archive_test_work WHERE id=1"
            ).scalar_one()
            == 1
        )
        assert fresh.execute(
            sa.select(version_changes_table.c.entity_id)
        ).scalars().all() == [2]


def test_migration_rerun_uuid_cascade_and_downgrade(backend: Engine) -> None:
    """Exercise production DDL with interrupted indexes and repeated rollback."""
    with backend.begin() as connection:
        with Operations.context(MigrationContext.configure(connection)):
            sa.Index(
                "ix_chart_archive_scope_chart", scope.c.chart_id, scope.c.transaction_id
            ).drop(connection)
            start = perf_counter()
            migration.upgrade()
            upgrade_ms = (perf_counter() - start) * 1000
            migration.upgrade()
        index_names = {
            index["name"] for index in sa.inspect(connection).get_indexes(scope.name)
        }
        assert {
            "ix_chart_archive_scope_dashboard",
            "ix_chart_archive_scope_chart",
        } <= index_names
        assert (
            connection.execute(
                versioning_manager.transaction_cls.__table__.insert().values(
                    action_kind=None
                )
            ).inserted_primary_key[0]
            == 1
        )
        row = {
            "id": uuid4(),
            "transaction_id": 1,
            "chart_id": 1,
            "chart_uuid": uuid4(),
            "dashboard_id": 1,
            "dashboard_uuid": uuid4(),
        }
        connection.execute(scope.insert(), row)
        assert (
            connection.execute(sa.select(scope.c.chart_uuid)).scalar_one()
            == row["chart_uuid"]
        )
        with pytest.raises(IntegrityError), connection.begin_nested():
            connection.execute(scope.insert(), {**row, "id": uuid4()})
        connection.exec_driver_sql("DELETE FROM version_transaction WHERE id=1")
        assert connection.scalar(sa.select(sa.func.count()).select_from(scope)) == 0
        connection.exec_driver_sql("INSERT INTO version_transaction (id) VALUES (2)")
        for index, kind in enumerate(("field", lifecycle.CHART_ARCHIVE_KIND)):
            connection.execute(
                version_changes_table.insert(),
                {
                    "transaction_id": 2,
                    "entity_kind": "chart",
                    "entity_id": 1,
                    "sequence": index,
                    "kind": kind,
                    "operation": "announce",
                    "path": [],
                    "from_value": None,
                    "to_value": None,
                },
            )
        with Operations.context(MigrationContext.configure(connection)):
            start = perf_counter()
            migration.downgrade()
            downgrade_ms = (perf_counter() - start) * 1000
            migration.downgrade()
        assert connection.execute(
            sa.select(version_changes_table.c.kind)
        ).scalars().all() == ["field"]
        assert connection.exec_driver_sql(
            "SELECT id FROM version_transaction"
        ).scalars().all() == [2]
        assert not sa.inspect(connection).has_table(scope.name)
        print(
            f"{backend.dialect.name}: index-repair upgrade={upgrade_ms:.2f}ms "
            f"downgrade={downgrade_ms:.2f}ms"
        )


def test_missing_scope_read_and_write_keep_connection_usable(
    backend: Engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A rollout without scope storage preserves content reads and caller writes."""
    import superset
    from superset.versioning.activity import queries
    from superset.versioning.activity.kinds import Window

    # Project nullable actor fields without requiring the application's FAB tables.
    users = sa.Table(
        "archive_test_users",
        sa.MetaData(),
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("first_name", sa.String(30)),
        sa.Column("last_name", sa.String(30)),
    )
    users.create(backend)
    monkeypatch.setattr(
        superset,
        "security_manager",
        SimpleNamespace(user_model=SimpleNamespace(__table__=users)),
    )
    try:
        with backend.begin() as connection:
            scope.drop(connection)
            connection.exec_driver_sql(
                "INSERT INTO version_transaction (id, issued_at) "
                "VALUES (50, '2020-01-01')"
            )
            connection.execute(
                version_changes_table.insert(),
                {
                    "transaction_id": 50,
                    "entity_kind": "chart",
                    "entity_id": 1,
                    "sequence": 0,
                    "kind": "field",
                    "operation": "edit",
                    "path": [],
                    "from_value": None,
                    "to_value": None,
                },
            )
        with Session(backend) as session:
            monkeypatch.setattr(queries, "db", SimpleNamespace(session=session))
            rows, truncated, floor = queries._fetch_dashboard_archive_candidates(
                1, uuid4(), None, None, 100
            )
            assert (rows, truncated, floor) == ([], False, None)
            content, content_truncated = queries.fetch_change_records(
                [("Slice", 1, [Window(0, None)])],
                None,
                None,
                dashboard_id=1,
                dashboard_uuid=uuid4(),
            )
            assert [row["transaction_id"] for row in content] == [50]
            assert not content_truncated
            assert (
                session.execute(
                    sa.text("SELECT count(*) FROM version_changes")
                ).scalar_one()
                == 1
            )
            session.execute(sa.text("UPDATE archive_test_work SET value=1 WHERE id=1"))
            dashboard_uuid = uuid4()
            session.execute(sa.text("INSERT INTO dashboard_slices VALUES (1, 1)"))
            # Match the live UUID binding type, including MySQL binary UUIDs.
            dashboards = sa.Table(
                "dashboards",
                sa.MetaData(),
                sa.Column("id", sa.Integer),
                sa.Column("uuid", UUIDType(binary=True)),
            )
            session.execute(dashboards.insert().values(id=1, uuid=dashboard_uuid))
            lifecycle.capture_chart_archives(
                session, [lifecycle.ChartArchive(1, uuid4(), "chart")]
            )
            session.commit()
        with backend.connect() as fresh:
            assert (
                fresh.exec_driver_sql(
                    "SELECT value FROM archive_test_work WHERE id=1"
                ).scalar_one()
                == 1
            )
            assert fresh.execute(
                sa.select(version_changes_table.c.kind)
            ).scalars().all() == ["field"]
    finally:
        users.drop(backend)


@pytest.mark.parametrize("capture_step", ["stamp", "changes"])
def test_content_deadlock_cannot_commit_phantom_archive(
    backend: Engine,
    monkeypatch: pytest.MonkeyPatch,
    capture_step: str,
) -> None:
    """The real before-commit pipeline stops after MySQL loses caller content work."""
    from superset.versioning.changes import listener
    from superset.versioning.diff import ChangeRecord

    pg = backend.dialect.name == "postgresql"
    blocker_ready, contender_ready = Event(), Event()
    blocker_errors: list[BaseException] = []
    error_codes: list[str | int] = []
    after_error_sql: list[str] = []
    archive = lifecycle.ChartArchive(1, uuid4(), "renamed chart")
    change = ChangeRecord(
        kind="field",
        operation="edit",
        path=["slice_name"],
        from_value="old",
        to_value="renamed chart",
    )
    # Isolate the SQL transaction protocol from Continuum's model diff setup;
    # finalization, content savepoints, and subsequent lifecycle capture are real.
    monkeypatch.setattr(listener, "capture_for_write", lambda session: True)
    monkeypatch.setattr(listener, "_current_transaction_id", lambda session: 1)
    monkeypatch.setattr(
        listener, "_build_scalar_buffer", lambda states: {("chart", 1): [change]}
    )
    monkeypatch.setattr(
        lifecycle, "collect_chart_archives", lambda session, states: [archive]
    )
    monkeypatch.setitem(versioning_manager.options, "versioning", True)
    monkeypatch.setattr(
        listener, "_append_child_records_to_buffer", lambda session, tx, buffer: None
    )
    monkeypatch.setattr(
        listener, "reconcile_parent_snapshots", lambda session, tx: None
    )

    def contend(session: Session, *_args: Any) -> None:
        """Make the actual content savepoint encounter a database deadlock."""
        contender_ready.set()
        try:
            session.connection().exec_driver_sql(
                "UPDATE archive_test_locks SET value=1 WHERE id=2"
            )
        except DBAPIError as error:
            error_codes.append(_code(error))
            raise

    seam = "_write_action_kind" if capture_step == "stamp" else "bulk_insert_records"
    monkeypatch.setattr(listener, seam, contend)
    thread = Thread(
        target=_hold_conflicting_lock,
        args=(backend, blocker_ready, contender_ready, blocker_errors),
        daemon=True,
    )
    thread.start()
    assert blocker_ready.wait(10)
    try:
        with Session(backend) as session:
            connection = session.connection()
            if pg:
                connection.exec_driver_sql("SET LOCAL deadlock_timeout='100ms'")
            assert (
                connection.execute(
                    versioning_manager.transaction_cls.__table__.insert().values(
                        action_kind=None
                    )
                ).inserted_primary_key[0]
                == 1
            )
            connection.exec_driver_sql(
                "UPDATE archive_test_work SET value=1 WHERE id=1"
            )
            connection.exec_driver_sql(
                "UPDATE archive_test_locks SET value=1 WHERE id=1"
            )
            session.info[listener.ACTION_KIND_KEY] = "restore"

            def record_sql(
                _connection: Connection,
                _cursor: Any,
                statement: str,
                _parameters: Any,
                _context: Any,
                _many: bool,
            ) -> None:
                """Detect any SQL after content savepoint recovery fails."""
                if error_codes:
                    after_error_sql.append(statement)

            sa.event.listen(connection, "before_cursor_execute", record_sql)
            sa.event.listen(session, "before_commit", listener.finalize_change_records)
            if pg:
                session.commit()
                assert error_codes == ["40P01"]
            else:
                with pytest.raises(DBAPIError) as raised:
                    session.commit()
                assert _code(raised.value) == 1305
                assert error_codes == [1213]
                assert len(after_error_sql) == 1
                assert after_error_sql[0].startswith("ROLLBACK TO SAVEPOINT")
                session.rollback()
    finally:
        contender_ready.set()
        thread.join(15)
    assert not thread.is_alive()
    assert blocker_errors == []
    with backend.connect() as fresh:
        assert fresh.exec_driver_sql(
            "SELECT value FROM archive_test_work WHERE id=1"
        ).scalar_one() == int(pg)
        archived_ids = (
            fresh.execute(
                sa.select(version_changes_table.c.entity_id).where(
                    version_changes_table.c.kind == lifecycle.CHART_ARCHIVE_KIND
                )
            )
            .scalars()
            .all()
        )
        assert archived_ids == ([1] if pg else [])


def test_purge_reads_both_shadow_endpoints_in_one_statement(backend: Engine) -> None:
    """Endpoint collection has the same bounded SQL cost on both metadata engines."""
    from superset.commands.deletion_retention.purge_cascade import (
        _delete_history_targets,
    )

    shadow = sa.Table(
        "archive_test_shadow",
        sa.MetaData(),
        sa.Column("id", sa.Integer),
        sa.Column("transaction_id", sa.BigInteger),
        sa.Column("end_transaction_id", sa.BigInteger),
    )
    shadow.create(backend)
    try:
        with Session(backend) as session:
            session.execute(
                shadow.insert(),
                [
                    {"id": 1, "transaction_id": 10, "end_transaction_id": 11},
                    {"id": 1, "transaction_id": 11, "end_transaction_id": None},
                ],
            )
            statements: list[str] = []

            def track(
                _connection: Connection,
                _cursor: Any,
                statement: str,
                _parameters: Any,
                _context: Any,
                _many: bool,
            ) -> None:
                """Count only candidate collection and deletion SQL."""
                statements.append(statement)

            sa.event.listen(session.connection(), "before_cursor_execute", track)
            candidates: set[int] = set()
            assert (
                _delete_history_targets(
                    session, [(shadow, shadow.c.id == 1)], candidates
                )
                == 2
            )
            assert candidates == {10, 11}
            assert len(statements) == 2
            assert statements[0].startswith("SELECT DISTINCT")
            assert statements[1].startswith("DELETE")
            session.commit()
    finally:
        shadow.drop(backend)
