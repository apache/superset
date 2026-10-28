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
from superset.constants import QUERY_CANCEL_KEY
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
