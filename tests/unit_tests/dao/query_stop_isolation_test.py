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
from typing import Any
from unittest.mock import Mock

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
