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
Stop-versus-finish races run against a file-backed SQLite metadata database.

A second session plays the worker, so these tests exercise real transactions
and locks rather than mocked sessions.
"""

from collections.abc import Iterator
from pathlib import Path
from threading import Event
from typing import Any
from unittest.mock import MagicMock, Mock, patch

import pytest
from flask import Flask
from pytest_mock import MockerFixture
from sqlalchemy import create_engine, event, update
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from superset.common.db_query_status import QueryStatus
from superset.constants import QUERY_CANCEL_KEY, QUERY_EARLY_CANCEL_KEY
from superset.db_engine_specs.impala import ImpalaEngineSpec
from superset.models.core import Database
from superset.models.sql_lab import Query

CLIENT_ID = "foo"


@pytest.fixture
def session_engine(tmp_path: Path) -> Iterator[Engine]:
    # A short busy timeout turns a leaked write lock into a fast failure.
    engine = create_engine(
        f"sqlite:///{tmp_path / 'metadata.db'}", connect_args={"timeout": 1}
    )
    yield engine
    engine.dispose()


@pytest.fixture
def snapshot_engine(session_engine: Engine) -> Iterator[Engine]:
    """
    An engine whose transactions keep the snapshot of their first read until
    they end, as under REPEATABLE READ: WAL mode plus an explicit BEGIN.
    """
    engine = create_engine(session_engine.url, connect_args={"timeout": 1})

    @event.listens_for(engine, "connect")
    def connect(dbapi_connection: Any, _: Any) -> None:
        # Let SQLAlchemy own transaction boundaries, so SELECTs run inside them.
        dbapi_connection.isolation_level = None
        dbapi_connection.execute("PRAGMA journal_mode=WAL")

    @event.listens_for(engine, "begin")
    def begin(connection: Any) -> None:
        connection.exec_driver_sql("BEGIN")

    yield engine
    engine.dispose()


@pytest.fixture
def query_id(session: Session, session_engine: Engine) -> int:
    Query.metadata.create_all(session_engine)  # pylint: disable=no-member
    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    query = Query(
        client_id=CLIENT_ID,
        database=database,
        sql="select * from bar",
        status=QueryStatus.RUNNING,
        extra_json=f'{{"{QUERY_CANCEL_KEY}": "0123456789abcdef:0123456789abcdef"}}',
    )
    session.add_all([database, query])
    session.commit()
    return query.id


def _worker_commits(engine: Engine, query_id: int, **values: Any) -> None:
    """Commit a write from another connection, as the SQL Lab worker would."""
    with Session(engine) as worker:
        worker.execute(update(Query).where(Query.id == query_id).values(**values))
        worker.commit()


def _committed(engine: Engine, query_id: int) -> Query:
    with Session(engine, expire_on_commit=False) as reader:
        return reader.query(Query).filter_by(id=query_id).one()


def _use_impala(mocker: MockerFixture) -> None:
    mocker.patch.object(
        Database,
        "db_engine_spec",
        new_callable=mocker.PropertyMock,
        return_value=ImpalaEngineSpec,
    )


def test_stop_query_keeps_status_committed_after_its_check(
    mocker: MockerFixture,
    app: Any,
    session: Session,
    session_engine: Engine,
    query_id: int,
) -> None:
    """The STOPPED write is conditional, so a terminal commit is not overwritten."""
    from superset.daos.query import QueryDAO

    def cancel_then_finish(query: Query) -> bool:
        # The worker commits SUCCESS after stop_query read the query as running.
        _worker_commits(
            session_engine, query.id, status=QueryStatus.SUCCESS, end_time=2.0
        )
        return True

    mocker.patch("superset.sql_lab.cancel_query", side_effect=cancel_then_finish)

    QueryDAO.stop_query(CLIENT_ID)

    query = _committed(session_engine, query_id)
    assert query.status == QueryStatus.SUCCESS
    assert query.end_time == 2.0


def test_stop_query_replaces_failure_caused_by_its_cancel(
    mocker: MockerFixture,
    app: Any,
    session: Session,
    session_engine: Engine,
    query_id: int,
) -> None:
    """
    A FAILED committed during the cancel still ends STOPPED.

    Engines that kill the statement from outside the worker (Postgres, MySQL,
    Snowflake, ...) make the worker fail straight away, and its error handler
    can commit FAILED before stop_query writes STOPPED.
    """
    from superset.daos.query import QueryDAO

    def cancel_then_fail(query: Query) -> bool:
        # The cancel kills the statement, and the worker commits FAILED.
        _worker_commits(
            session_engine,
            query.id,
            status=QueryStatus.FAILED,
            error_message="terminating connection due to administrator command",
            end_time=2.0,
        )
        return True

    mocker.patch("superset.sql_lab.cancel_query", side_effect=cancel_then_fail)

    QueryDAO.stop_query(CLIENT_ID)

    query = _committed(session_engine, query_id)
    assert query.status == QueryStatus.STOPPED


@pytest.mark.parametrize("status", [QueryStatus.SUCCESS, QueryStatus.TIMED_OUT])
def test_stop_query_keeps_outcome_a_stop_cannot_cause(
    mocker: MockerFixture,
    app: Any,
    session: Session,
    session_engine: Engine,
    query_id: int,
    status: QueryStatus,
) -> None:
    """SUCCESS or TIMED_OUT committed during the cancel is not overwritten."""
    from superset.daos.query import QueryDAO

    def cancel_then_finish(query: Query) -> bool:
        _worker_commits(session_engine, query.id, status=status, end_time=2.0)
        return True

    mocker.patch("superset.sql_lab.cancel_query", side_effect=cancel_then_finish)

    QueryDAO.stop_query(CLIENT_ID)

    query = _committed(session_engine, query_id)
    assert query.status == status
    assert query.end_time == 2.0


def test_stop_query_does_not_rewrite_impala_claim(
    mocker: MockerFixture,
    app: Any,
    session: Session,
    session_engine: Engine,
    query_id: int,
) -> None:
    """Once Impala commits its claim, stop_query writes nothing further."""
    from superset.daos.query import QueryDAO

    _use_impala(mocker)
    http_cancel = mocker.patch.object(ImpalaEngineSpec, "cancel_query")
    prepare = ImpalaEngineSpec.prepare_cancel_query
    armed = False

    def prepare_then_arm(query: Query) -> None:
        nonlocal armed
        prepare(query)
        armed = True

    mocker.patch.object(
        ImpalaEngineSpec, "prepare_cancel_query", side_effect=prepare_then_arm
    )

    @event.listens_for(session, "before_commit")
    def worker_finishes(_: Session) -> None:
        # The worker commits a durable result after the claim, right before
        # stop_query's own transaction commits.
        if armed:
            _worker_commits(
                session_engine, query_id, status=QueryStatus.SUCCESS, end_time=2.0
            )

    QueryDAO.stop_query(CLIENT_ID)

    http_cancel.assert_not_called()
    query = _committed(session_engine, query_id)
    assert query.status == QueryStatus.SUCCESS
    assert query.end_time == 2.0


@pytest.mark.parametrize("use_executor", [False, True])
def test_declined_impala_claim_ends_transaction(
    mocker: MockerFixture,
    app: Any,
    session: Session,
    session_engine: Engine,
    query_id: int,
    use_executor: bool,
) -> None:
    """A stop that loses to a finished query does not hold the row lock."""
    from superset.sql.execution.executor import SQLExecutor
    from superset.sql_lab import cancel_query

    _use_impala(mocker)
    http_cancel = mocker.patch.object(ImpalaEngineSpec, "cancel_query")
    query = session.query(Query).filter_by(id=query_id).one()
    _worker_commits(session_engine, query_id, status=QueryStatus.SUCCESS)

    if use_executor:
        cancelled = SQLExecutor._cancel_query(query.database, query)
    else:
        cancelled = cancel_query(query)

    # Another writer is not blocked by the declined stop's locking read.
    _worker_commits(session_engine, query_id, progress=100)
    assert cancelled is False
    assert query.status == QueryStatus.SUCCESS
    assert not query.extra.get(QUERY_EARLY_CANCEL_KEY)
    http_cancel.assert_not_called()


def test_poll_sees_stop_committed_after_its_snapshot(
    mocker: MockerFixture,
    session_engine: Engine,
    snapshot_engine: Engine,
    query_id: int,
) -> None:
    """A poll sees a Stop committed after the worker's snapshot was taken."""
    app = Flask(__name__)
    app.config["DB_POLL_INTERVAL_SECONDS"] = {"impala": 0}
    worker = Session(snapshot_engine)
    mocker.patch("superset.db.session", worker)
    query = worker.query(Query).filter_by(id=query_id).one()
    # Another request commits the stop.
    _worker_commits(session_engine, query_id, status=QueryStatus.STOPPED)
    # The worker's open transaction still reads its earlier snapshot.
    worker.refresh(query)
    assert query.status == QueryStatus.RUNNING

    cursor = Mock()
    cursor.status.side_effect = ["RUNNING_STATE", "FINISHED_STATE"]
    cursor.get_log.return_value = ""
    with app.app_context():
        ImpalaEngineSpec.handle_cursor(cursor, query)

    cursor.cancel_operation.assert_called_once_with()
    cursor.close_operation.assert_called_once_with()
    worker.close()


def _use_trino(mocker: MockerFixture) -> None:
    from superset.db_engine_specs.trino import TrinoEngineSpec

    mocker.patch.object(
        Database,
        "db_engine_spec",
        new_callable=mocker.PropertyMock,
        return_value=TrinoEngineSpec,
    )
    mocker.patch.object(Database, "is_oauth2_enabled", return_value=False)
    mocker.patch.object(TrinoEngineSpec, "get_tracking_url", return_value=None)


def test_trino_early_cancel_that_kills_the_worker_ends_stopped(
    mocker: MockerFixture,
    app: Any,
    session: Session,
    session_engine: Engine,
    query_id: int,
) -> None:
    """
    A Trino stop with no published query ID still ends STOPPED when the
    early-cancel flag it commits makes the worker kill its statement.

    Trino's prepare_cancel_query() commits the flag, so the worker can see it,
    kill the statement and reach its error handler before stop_query() reads
    the row back. That failure is the stop's own doing.
    """
    from superset import db
    from superset.daos.query import QueryDAO
    from superset.db_engine_specs.trino import TrinoEngineSpec
    from superset.sql_lab import handle_query_error

    _use_trino(mocker)
    query = session.get(Query, query_id)
    query.extra_json = "{}"
    session.commit()

    killed = Event()
    cursor = MagicMock()
    cursor.query_id = "20261014_123456_00001_abcde"
    cursor.fetchall.return_value = []

    def driver_execute(sql: str) -> None:
        if "kill_query" in sql:
            killed.set()
            return
        # The statement runs until Trino kills it.
        if not killed.wait(5):
            raise RuntimeError("statement was never killed")
        raise RuntimeError("Query was killed: Query cancelled by Superset")

    cursor.execute.side_effect = driver_execute

    def run_worker() -> None:
        """The worker polls, sees the published flag and kills its statement."""
        with Session(session_engine) as worker:
            worker.remove = lambda: None
            with patch.object(db, "session", worker):
                worker_query = worker.get(Query, query_id)
                assert worker_query.extra[QUERY_EARLY_CANCEL_KEY] is True
                with app.test_request_context():
                    with pytest.raises(RuntimeError, match="killed") as caught:
                        TrinoEngineSpec.execute_with_cursor(
                            cursor, "SELECT 1", worker_query
                        )
                    handle_query_error(caught.value, worker_query)

    commit = session.commit
    armed = True

    def commit_then_worker_runs() -> None:
        nonlocal armed
        commit()
        if armed:
            # Right after the stop publishes the early-cancel flag.
            armed = False
            run_worker()

    mocker.patch.object(session, "commit", side_effect=commit_then_worker_runs)

    QueryDAO.stop_query(CLIENT_ID)

    assert killed.is_set()
    assert _committed(session_engine, query_id).status == QueryStatus.STOPPED


def test_trino_early_cancel_keeps_failure_that_predates_it(
    mocker: MockerFixture,
    app: Any,
    session: Session,
    session_engine: Engine,
    query_id: int,
) -> None:
    """A failure committed before the stop published its flag stays FAILED."""
    from superset.daos.query import QueryDAO

    _use_trino(mocker)
    query = session.get(Query, query_id)
    query.extra_json = "{}"
    session.commit()

    commit = session.commit
    armed = True

    def worker_fails_then_commit() -> None:
        nonlocal armed
        if armed:
            # The statement fails on its own, after stop_query's first check
            # but before the early-cancel flag is published.
            armed = False
            _worker_commits(
                session_engine,
                query_id,
                status=QueryStatus.FAILED,
                error_message="line 1:8: Column 'x' cannot be resolved",
                end_time=2.0,
            )
        commit()

    mocker.patch.object(session, "commit", side_effect=worker_fails_then_commit)

    QueryDAO.stop_query(CLIENT_ID)

    query = _committed(session_engine, query_id)
    assert query.status == QueryStatus.FAILED
    assert query.error_message == "line 1:8: Column 'x' cannot be resolved"
