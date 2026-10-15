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
"""
Tests db_engine_specs.postgres against a real PostgreSQL instance, spun up
on demand via testcontainers. Run via .github/workflows/testcontainers.yml
-- these exercise real SQL execution and dialect introspection, which
mocked unit tests structurally cannot.

Plain Postgres itself was never covered by this suite: CockroachDB,
TimescaleDB and YugabyteDB all speak the Postgres wire protocol and already
exercise `PostgresContainer`/the "postgresql" dialect, but none of them
stand in for vanilla PostgreSQL's own dialect quirks.
"""

from collections.abc import Iterator

import pytest
from sqlalchemy import (
    Column,
    create_engine,
    inspect,
    Integer,
    MetaData,
    Table as SATable,
)
from sqlalchemy.engine import Engine

from superset.db_engine_specs.postgres import PostgresEngineSpec
from superset.sql.parse import Table
from superset.utils.core import GenericDataType

pytestmark = pytest.mark.testcontainers

from ._driver import require_driver  # noqa: E402

require_driver("testcontainers.community.postgres")

from testcontainers.community.postgres import PostgresContainer  # noqa: E402

from ._pagination import (  # noqa: E402
    assert_paginated_query_returns_correct_rows_in_order,
)


@pytest.fixture(scope="module")
def engine() -> Iterator[Engine]:
    with PostgresContainer("postgres:17-alpine") as container:
        yield create_engine(container.get_connection_url())


def test_paginated_query_returns_correct_rows_in_order(engine: Engine) -> None:
    """
    A plain SQLAlchemy Core LIMIT/OFFSET query, compiled and executed against
    a real instance. Mocked tests cannot catch a dialect compiling this
    incorrectly (see apache/superset#42899, where Trino emitted OFFSET
    before LIMIT) -- only real execution can.
    """
    assert_paginated_query_returns_correct_rows_in_order(engine)


def test_get_columns_maps_native_types(engine: Engine) -> None:
    """
    PostgresEngineSpec.get_columns wraps a real SQLAlchemy Inspector; this
    exercises that against actual server-reported column metadata rather
    than a mocked Inspector.
    """
    metadata = MetaData()
    SATable(
        "pilot_types",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("amount", Integer),
    )
    metadata.create_all(engine)

    inspector = inspect(engine)
    columns = PostgresEngineSpec.get_columns(inspector, Table("pilot_types"))

    by_name = {col["column_name"]: col for col in columns}
    assert set(by_name) == {"id", "amount"}
    for col in by_name.values():
        spec = PostgresEngineSpec.get_column_spec(str(col["type"]))
        assert spec is not None
        assert spec.generic_type == GenericDataType.NUMERIC
        assert isinstance(spec.sqla_type, Integer)


@pytest.mark.parametrize("return_results", [False, True], ids=["async", "sync"])
@pytest.mark.parametrize("terminate", [False, True], ids=["cancel", "terminate"])
@pytest.mark.parametrize("stop_timing", ["cursor", "error_handler"])
def test_legacy_cancel_error_preserves_committed_stop(
    engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
    return_results: bool,
    terminate: bool,
    stop_timing: str,
) -> None:
    """A real cancelled Postgres cursor cannot publish FAILED over a Stop."""
    import time
    from concurrent.futures import ThreadPoolExecutor
    from contextlib import contextmanager
    from typing import Any
    from unittest.mock import MagicMock, PropertyMock

    from psycopg2 import OperationalError
    from sqlalchemy import text
    from sqlalchemy.orm import Session

    from superset import sql_lab
    from superset.models.sql_lab import Query
    from tests.integration_tests.test_app import app

    # Minimal FK targets keep this reproduction independent of app migrations.
    with engine.begin() as connection:
        connection.execute(
            text("CREATE TABLE IF NOT EXISTS dbs (id INTEGER PRIMARY KEY)")
        )
        connection.execute(
            text("CREATE TABLE IF NOT EXISTS ab_user (id INTEGER PRIMARY KEY)")
        )
        connection.execute(text("INSERT INTO dbs VALUES (1) ON CONFLICT DO NOTHING"))
    Query.__table__.create(engine, checkfirst=True)

    def stop(*args: object, **kwargs: object) -> list[object]:
        """Commit after the legacy handler has read RUNNING, before its write."""
        with Session(engine) as stop_session:
            stopped = stop_session.get(Query, 123)
            assert stopped is not None
            stopped.status = "stopped"
            stopped.end_time = 1234.5
            stop_session.commit()
        return []

    cursor_cancelled = False

    def execute(cursor: Any, sql: str, query: Query) -> None:
        """Cancel a statement observed running on an independent connection."""
        nonlocal cursor_cancelled
        pid = cursor.connection.get_backend_pid()
        with ThreadPoolExecutor(max_workers=1) as pool:
            running = pool.submit(cursor.execute, sql)
            with engine.connect().execution_options(
                isolation_level="AUTOCOMMIT"
            ) as canceller:
                deadline = time.monotonic() + 10
                while time.monotonic() < deadline:
                    if canceller.execute(
                        text(
                            "SELECT wait_event = 'PgSleep' FROM pg_stat_activity "
                            "WHERE pid = :pid"
                        ),
                        {"pid": pid},
                    ).scalar():
                        break
                    time.sleep(0.01)
                else:
                    pytest.fail("Postgres statement did not start")
                function = "pg_terminate_backend" if terminate else "pg_cancel_backend"
                assert canceller.execute(
                    text(f"SELECT {function}(:pid)"), {"pid": pid}
                ).scalar()
            with pytest.raises(OperationalError) as error:
                running.result(timeout=10)
            cursor_cancelled = True
            raise error.value

    @contextmanager
    def raw_connection(**kwargs: Any) -> Iterator[Any]:
        """Use a real DBAPI connection for the complete legacy execution path."""
        connection = engine.raw_connection()
        try:
            yield connection
        finally:
            connection.close()

    database = MagicMock()
    database.db_engine_spec = PostgresEngineSpec
    database.allow_run_async = False
    database.get_default_schema_for_query.return_value = "public"
    database.mutate_sql_based_on_config.side_effect = lambda sql, is_split=False: sql
    database.get_raw_connection = raw_connection
    monkeypatch.setattr(Query, "database", PropertyMock(return_value=database))
    monkeypatch.setattr(PostgresEngineSpec, "execute_with_cursor", execute)
    monkeypatch.setattr(sql_lab, "warm_and_release_connection", lambda *args: None)
    monkeypatch.setattr(
        sql_lab,
        "_extract_errors",
        lambda *args, **kwargs: stop() if stop_timing == "error_handler" else [],
    )
    monkeypatch.setattr(sql_lab.security_manager, "find_user", lambda _: None)
    with app.test_request_context(), Session(engine) as worker_session:
        monkeypatch.setattr(worker_session, "remove", lambda: None, raising=False)
        monkeypatch.setattr(sql_lab.db, "session", worker_session)
        refresh = worker_session.refresh

        def refresh_then_stop(*args: Any, **kwargs: Any) -> None:
            """Commit after the cancelled cursor's handler reads its status."""
            refresh(*args, **kwargs)
            if (
                stop_timing == "cursor"
                and cursor_cancelled
                and kwargs.get("attribute_names") == ["status"]
            ):
                stop()

        monkeypatch.setattr(worker_session, "refresh", refresh_then_stop)
        monkeypatch.setitem(app.config, "STATS_LOGGER", MagicMock())
        monkeypatch.setitem(app.config, "DISALLOWED_SQL_FUNCTIONS", {})
        worker_session.add(
            Query(
                id=123,
                client_id="pg-cancel",
                database_id=1,
                sql="SELECT pg_sleep(30)",
                status="pending",
            )
        )
        worker_session.commit()
        try:
            payload = sql_lab.get_sql_results(
                123, "SELECT pg_sleep(30)", return_results
            )
            with Session(engine) as observer:
                persisted = observer.get(Query, 123)
                assert persisted is not None
                assert persisted.status == "stopped"
                assert persisted.end_time == 1234.5
                assert persisted.error_message is None
            assert payload is not None
            assert payload["status"] == "stopped"
            assert "error" not in payload
        finally:
            worker_session.rollback()
            worker_session.query(Query).filter_by(id=123).delete()
            worker_session.commit()


@pytest.mark.parametrize("delay_ms", [0, 20, 100])
@pytest.mark.parametrize("terminate", [False, True], ids=["cancel", "terminate"])
@pytest.mark.parametrize("caller", ["dao", "async_handle"])
def test_stop_request_precedes_postgres_cancellation_failure(
    engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
    delay_ms: int,
    terminate: bool,
    caller: str,
) -> None:
    """The production Stop entry points must publish intent before cancellation."""
    import time
    from concurrent.futures import ThreadPoolExecutor
    from contextlib import contextmanager
    from threading import Event
    from typing import Any
    from unittest.mock import MagicMock, PropertyMock

    from sqlalchemy import text
    from sqlalchemy.orm import scoped_session, Session, sessionmaker

    from superset import sql_lab
    from superset.daos.query import QueryDAO
    from superset.models.sql_lab import Query
    from superset.sql.execution.executor import SQLExecutor
    from tests.integration_tests.test_app import app

    with engine.begin() as connection:
        connection.execute(
            text("CREATE TABLE IF NOT EXISTS dbs (id INTEGER PRIMARY KEY)")
        )
        connection.execute(
            text("CREATE TABLE IF NOT EXISTS ab_user (id INTEGER PRIMARY KEY)")
        )
        connection.execute(text("INSERT INTO dbs VALUES (1) ON CONFLICT DO NOTHING"))
        connection.execute(
            text("INSERT INTO ab_user VALUES (7) ON CONFLICT DO NOTHING")
        )
    Query.__table__.create(engine, checkfirst=True)
    sessions = scoped_session(sessionmaker(bind=engine))
    executing = Event()
    finished = Event()
    backend_pid: list[int] = []

    @contextmanager
    def raw_connection(**kwargs: Any) -> Iterator[Any]:
        """Open a real target connection, distinct from metadata sessions."""
        connection = engine.raw_connection()
        try:
            yield connection
        finally:
            connection.close()

    def execute(cursor: Any, sql: str, query: Query) -> None:
        """Expose the executing backend to the independent Stop request."""
        backend_pid.append(cursor.connection.get_backend_pid())
        executing.set()
        cursor.execute(sql)

    def cancel(cursor: Any, query: Query, cancel_query_id: str) -> bool:
        """Let the worker finish before the Stop request resumes after cancel."""
        function = "pg_terminate_backend" if terminate else "pg_cancel_backend"
        cursor.execute(f"SELECT {function}(%s)", (int(cancel_query_id),))
        assert cursor.fetchone()[0]
        time.sleep(delay_ms / 1000)
        # Include the schedule where even a zero-delay request is descheduled
        # after cancel. This makes the race reproducible, not scheduler-dependent.
        assert finished.wait(10)
        return True

    database = MagicMock()
    database.db_engine_spec = PostgresEngineSpec
    database.allow_run_async = False
    database.get_default_schema_for_query.return_value = "public"
    database.mutate_sql_based_on_config.side_effect = lambda sql, is_split=False: sql
    database.get_raw_connection = raw_connection
    database.get_sqla_engine.return_value.__enter__.return_value = engine
    monkeypatch.setattr(Query, "database", PropertyMock(return_value=database))
    monkeypatch.setattr(PostgresEngineSpec, "execute_with_cursor", execute)
    monkeypatch.setattr(PostgresEngineSpec, "cancel_query", cancel)
    monkeypatch.setattr(sql_lab, "warm_and_release_connection", lambda *args: None)
    monkeypatch.setattr(sql_lab.security_manager, "find_user", lambda _: None)
    monkeypatch.setattr(sql_lab.db, "session", sessions)
    monkeypatch.setattr("superset.daos.query.get_user_id", lambda: 7)
    monkeypatch.setitem(app.config, "STATS_LOGGER", MagicMock())
    monkeypatch.setitem(app.config, "DISALLOWED_SQL_FUNCTIONS", {})

    def work() -> dict[str, Any] | None:
        """Run the legacy worker with a thread-local metadata session."""
        try:
            with app.test_request_context():
                return sql_lab.get_sql_results(124, "SELECT pg_sleep(30)", True)
        finally:
            sessions.remove()
            finished.set()

    with app.test_request_context():
        sessions.add(
            Query(
                id=124,
                client_id="prod-stop",
                user_id=7,
                database_id=1,
                sql="SELECT pg_sleep(30)",
                status="pending",
            )
        )
        sessions.commit()
        try:
            with ThreadPoolExecutor(max_workers=1) as pool:
                worker = pool.submit(work)
                assert executing.wait(10)
                with engine.connect().execution_options(
                    isolation_level="AUTOCOMMIT"
                ) as observer:
                    deadline = time.monotonic() + 10
                    while time.monotonic() < deadline:
                        if observer.execute(
                            text(
                                "SELECT wait_event = 'PgSleep' FROM pg_stat_activity "
                                "WHERE pid = :pid"
                            ),
                            {"pid": backend_pid[0]},
                        ).scalar():
                            break
                        time.sleep(0.01)
                    else:
                        pytest.fail("Postgres statement did not start")
                if caller == "dao":
                    stopped = QueryDAO.stop_query("prod-stop")
                    assert stopped.status == "stopped"
                else:
                    assert SQLExecutor._cancel_async_query(124, database)
                payload = worker.result(timeout=10)
            with Session(engine) as observer_session:
                persisted = observer_session.get(Query, 124)
                assert persisted is not None
                assert persisted.status == "stopped"
                assert persisted.error_message is None
                assert persisted.end_time is not None
            assert payload is not None
            assert payload["status"] == "stopped"
        finally:
            sessions.rollback()
            sessions.query(Query).filter_by(id=124).delete()
            sessions.commit()
            sessions.remove()
