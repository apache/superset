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
"""Exercise async cancellation outcomes against committed metadata rows."""

from collections.abc import Iterator
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from superset.common.db_query_status import QueryStatus
from superset.constants import QUERY_CANCEL_KEY, QUERY_EARLY_CANCEL_KEY
from superset.db_engine_specs.base import BaseEngineSpec
from superset.models.core import Database
from superset.models.sql_lab import Query
from superset.sql.execution.executor import SQLExecutor


@pytest.fixture
def session_engine(tmp_path: Path) -> Iterator[Engine]:
    """Keep verification reads independent of the cancellation transaction."""
    engine = create_engine(f"sqlite:///{tmp_path / 'metadata.db'}")
    Query.metadata.create_all(engine)  # pylint: disable=no-member
    yield engine
    engine.dispose()


@pytest.fixture
def running_query(session: Session, mocker: MockerFixture, app_context: None) -> Query:
    """Persist a running query with an external cancellation handle."""
    mocker.patch.object(
        Database,
        "db_engine_spec",
        new_callable=mocker.PropertyMock,
        return_value=BaseEngineSpec,
    )
    query = Query(
        client_id="async_cancel",
        database=Database(database_name="cancel_test", sqlalchemy_uri="sqlite://"),
        sql="SELECT 1",
        status=QueryStatus.RUNNING,
        extra_json=f'{{"{QUERY_CANCEL_KEY}": "cancel_123"}}',
    )
    session.add(query)
    session.commit()
    return query


def _committed(engine: Engine, query_id: int) -> Query:
    """Read only the state visible to a separate metadata session."""
    with Session(engine, expire_on_commit=False) as reader:
        return reader.query(Query).filter_by(id=query_id).one()


@pytest.mark.parametrize(
    "status", [QueryStatus.SUCCESS, QueryStatus.FAILED, QueryStatus.TIMED_OUT]
)
def test_async_cancel_does_not_rewrite_finished_query(
    mocker: MockerFixture,
    session: Session,
    session_engine: Engine,
    running_query: Query,
    status: QueryStatus,
) -> None:
    """A terminal query is rejected before any engine cancellation or write."""
    running_query.status = status
    running_query.end_time = 2.0
    session.commit()
    query_id = running_query.id
    implicit_cancel = mocker.spy(BaseEngineSpec, "has_implicit_cancel")
    commit = mocker.spy(session, "commit")

    assert (
        not SQLExecutor(running_query.database)._create_async_handle(query_id).cancel()
    )

    committed = _committed(session_engine, query_id)
    assert committed.status == status
    assert committed.end_time == 2.0
    implicit_cancel.assert_not_called()
    commit.assert_not_called()


@pytest.mark.parametrize("cancelled", [True, False])
def test_async_cancel_persists_stop_only_after_successful_cancel(
    mocker: MockerFixture,
    session: Session,
    session_engine: Engine,
    running_query: Query,
    cancelled: bool,
) -> None:
    """An external cancel failure leaves the running query and end time intact."""
    query_id = running_query.id
    mocker.patch.object(BaseEngineSpec, "has_implicit_cancel", return_value=False)
    mocker.patch.object(BaseEngineSpec, "prepare_cancel_query")
    cancel = mocker.patch.object(BaseEngineSpec, "cancel_query", return_value=cancelled)
    engine = MagicMock()
    mocker.patch.object(Database, "get_sqla_engine", return_value=engine)
    cursor = (
        engine.__enter__.return_value.raw_connection.return_value.cursor.return_value
    )
    commit = mocker.spy(session, "commit")

    result = SQLExecutor(running_query.database)._create_async_handle(query_id).cancel()

    assert result is cancelled
    cancel.assert_called_once_with(cursor, running_query, "cancel_123")
    cursor.close.assert_called_once()
    committed = _committed(session_engine, query_id)
    if cancelled:
        assert committed.status == QueryStatus.STOPPED
        assert committed.end_time is not None
        commit.assert_called_once_with()
    else:
        assert committed.status == QueryStatus.RUNNING
        assert committed.end_time is None
        commit.assert_not_called()


def test_async_cancel_preserves_stop_committed_while_preparing(
    mocker: MockerFixture,
    session: Session,
    session_engine: Engine,
    running_query: Query,
) -> None:
    """An engine's committed early stop succeeds without a second status write."""
    from superset.db_engine_specs.impala import ImpalaEngineSpec

    query_id = running_query.id
    mocker.patch.object(
        Database,
        "db_engine_spec",
        new_callable=mocker.PropertyMock,
        return_value=ImpalaEngineSpec,
    )
    mocker.patch("superset.db_engine_specs.impala.now_as_float", return_value=2.0)
    prepare = mocker.spy(ImpalaEngineSpec, "prepare_cancel_query")
    get_engine = mocker.patch.object(Database, "get_sqla_engine")
    commit = mocker.spy(session, "commit")

    assert SQLExecutor(running_query.database)._create_async_handle(query_id).cancel()

    committed = _committed(session_engine, query_id)
    assert committed.status == QueryStatus.STOPPED
    assert committed.end_time == 2.0
    assert committed.extra[QUERY_EARLY_CANCEL_KEY]
    prepare.assert_called_once_with(running_query)
    commit.assert_called_once_with()
    get_engine.assert_not_called()


def _commit_stop_from_another_session(engine: Engine, query_id: int) -> None:
    """Commit the stop the way a web process's successful cancel does."""
    with Session(engine) as stopper:
        stopper.query(Query).filter_by(id=query_id).update(
            {Query.status: QueryStatus.STOPPED, Query.end_time: 2.0}
        )
        stopper.commit()


@pytest.mark.parametrize("stopper", ["executor_cancel", "other_session", "none"])
@pytest.mark.parametrize("timed_out", [False, True])
def test_worker_error_after_committed_stop_keeps_stopped(
    mocker: MockerFixture,
    session: Session,
    session_engine: Engine,
    running_query: Query,
    stopper: str,
    timed_out: bool,
) -> None:
    """
    A statement killed by a successful cancel raises in the Celery worker after
    STOPPED is committed. The worker's error path keeps STOPPED; a timeout and
    an error with no stop are still recorded as TIMED_OUT and FAILED.
    """
    from celery.exceptions import SoftTimeLimitExceeded

    from superset.sql.execution import celery_task

    query_id = running_query.id
    mocker.patch.object(BaseEngineSpec, "has_implicit_cancel", return_value=False)
    mocker.patch.object(BaseEngineSpec, "prepare_cancel_query")
    mocker.patch.object(BaseEngineSpec, "cancel_query", return_value=True)
    mocker.patch.object(Database, "get_sqla_engine")
    mocker.patch.object(Database, "get_raw_connection")
    mocker.patch.object(celery_task, "security_manager")
    mocker.patch.object(celery_task, "now_as_float", return_value=3.0)

    def kill_running_statement(**kwargs: object) -> None:
        """Stop the query, then fail the way the killed statement does."""
        if stopper == "executor_cancel":
            handle = SQLExecutor(running_query.database)._create_async_handle(query_id)
            assert handle.cancel()
        elif stopper == "other_session":
            _commit_stop_from_another_session(session_engine, query_id)
        if timed_out:
            raise SoftTimeLimitExceeded()
        raise RuntimeError("Query was killed")

    mocker.patch.object(
        celery_task, "execute_sql_with_cursor", side_effect=kill_running_statement
    )

    payload = celery_task.execute_sql_task(query_id, "SELECT 1")

    committed = _committed(session_engine, query_id)
    if timed_out:
        expected = QueryStatus.TIMED_OUT
    elif stopper == "none":
        expected = QueryStatus.FAILED
    else:
        expected = QueryStatus.STOPPED
    assert payload is not None
    assert payload["status"] == expected.value
    assert committed.status == expected
    if expected == QueryStatus.STOPPED:
        assert committed.error_message is None
        assert committed.end_time is not None
    else:
        assert committed.error_message
