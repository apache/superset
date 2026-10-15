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

    def execute(cursor: Any, sql: str, query: Query) -> None:
        """Cancel a statement observed running on an independent connection."""
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
                if stop_timing == "cursor":
                    stop()
                function = "pg_terminate_backend" if terminate else "pg_cancel_backend"
                assert canceller.execute(
                    text(f"SELECT {function}(:pid)"), {"pid": pid}
                ).scalar()
            with pytest.raises(OperationalError) as error:
                running.result(timeout=10)
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
    monkeypatch.setattr(sql_lab, "_extract_errors", stop)
    monkeypatch.setattr(sql_lab.security_manager, "find_user", lambda _: None)
    with app.test_request_context(), Session(engine) as worker_session:
        monkeypatch.setattr(worker_session, "remove", lambda: None, raising=False)
        monkeypatch.setattr(sql_lab.db, "session", worker_session)
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
