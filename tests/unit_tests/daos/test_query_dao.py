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
"""Tests for SQL Lab stop requests racing with worker finalization."""

from pathlib import Path

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from superset.common.db_query_status import QueryStatus
from superset.constants import QUERY_EARLY_CANCEL_KEY
from superset.daos.query import QueryDAO
from superset.models.sql_lab import Query


@pytest.mark.parametrize(
    "terminal_status", [QueryStatus.SUCCESS, QueryStatus.FAILED, QueryStatus.TIMED_OUT]
)
@pytest.mark.parametrize("early_cancel", [False, True])
def test_stop_query_preserves_concurrently_committed_terminal_result(
    mocker: MockerFixture,
    app_context: None,
    tmp_path: Path,
    terminal_status: QueryStatus,
    early_cancel: bool,
) -> None:
    """A worker commits while engine cancellation is in flight in another session."""
    engine = create_engine(f"sqlite:///{tmp_path / 'stop.db'}")
    Query.__table__.create(engine)
    with Session(engine) as stop_session:
        query = Query(
            id=123,
            client_id="stop-race",
            user_id=7,
            database_id=1,
            status=QueryStatus.RUNNING,
            extra_json='{"initial": true}',
        )
        stop_session.add(query)
        stop_session.commit()
        mocker.patch("superset.daos.query.db.session", stop_session)
        mocker.patch("superset.daos.query.get_user_id", return_value=7)

        def cancel(loaded_query: Query) -> bool:
            """Publish a terminal result after the stop read, before its commit."""
            assert loaded_query.status == QueryStatus.RUNNING
            if early_cancel:
                loaded_query.set_extra_json_key(QUERY_EARLY_CANCEL_KEY, True)
            with Session(engine) as worker_session:
                completed = worker_session.get(Query, query.id)
                assert completed is not None
                completed.status = terminal_status
                completed.results_key = "published-results"
                completed.end_time = 1234.5
                completed.extra_json = '{"worker": true}'
                worker_session.commit()
            return True

        cancel_query = mocker.patch(
            "superset.daos.query.sql_lab.cancel_query", side_effect=cancel
        )
        QueryDAO.stop_query("stop-race")
        cancel_query.assert_called_once_with(query)

    with Session(engine) as verify_session:
        completed = verify_session.get(Query, 123)
        assert completed is not None
        assert completed.status == terminal_status
        assert completed.results_key == "published-results"
        assert completed.end_time == 1234.5
        assert completed.extra == {"worker": True}
    engine.dispose()


@pytest.mark.parametrize(
    "terminal_status", [QueryStatus.SUCCESS, QueryStatus.FAILED, QueryStatus.TIMED_OUT]
)
def test_stopped_payload_preserves_concurrently_committed_terminal_result(
    mocker: MockerFixture,
    app_context: None,
    tmp_path: Path,
    terminal_status: QueryStatus,
) -> None:
    """A late worker stop payload must not overwrite a published terminal row."""
    from superset.sql.execution.celery_task import _stopped_query_payload

    engine = create_engine(f"sqlite:///{tmp_path / 'payload.db'}")
    Query.__table__.create(engine)
    with Session(engine) as stop_session:
        query = Query(
            id=123,
            client_id="payload-race",
            database_id=1,
            status=QueryStatus.STOPPED,
            end_time=100,
        )
        stop_session.add(query)
        stop_session.commit()
        assert query.status == QueryStatus.STOPPED
        with Session(engine) as worker_session:
            completed = worker_session.get(Query, 123)
            assert completed is not None
            completed.status = terminal_status
            completed.results_key = "published-results"
            completed.end_time = 1234.5
            worker_session.commit()

        mocker.patch("superset.sql.execution.celery_task.db.session", stop_session)
        payload = _stopped_query_payload(query)
        assert payload["status"] == terminal_status

    with Session(engine) as verify_session:
        completed = verify_session.get(Query, 123)
        assert completed is not None
        assert completed.status == terminal_status
        assert completed.results_key == "published-results"
        assert completed.end_time == 1234.5
    engine.dispose()


@pytest.mark.parametrize(
    "status",
    [
        QueryStatus.PENDING,
        QueryStatus.RUNNING,
        QueryStatus.SCHEDULED,
        QueryStatus.FETCHING,
        QueryStatus.STOPPED,
    ],
)
def test_stop_query_commits_stop_with_early_cancel(
    mocker: MockerFixture, app_context: None, session: Session, status: QueryStatus
) -> None:
    """A winning stop persists its staged early-cancel flag and end time."""
    Query.__table__.create(session.get_bind())
    query = Query(client_id="early-stop", user_id=7, database_id=1, status=status)
    session.add(query)
    session.commit()
    mocker.patch("superset.daos.query.get_user_id", return_value=7)
    mocker.patch("superset.daos.query.now_as_float", return_value=1234.5)

    def cancel(loaded_query: Query) -> bool:
        """Stage stop intent without exposing it separately from STOPPED."""
        loaded_query.set_extra_json_key(QUERY_EARLY_CANCEL_KEY, True)
        stored_extra = (
            session.query(Query.extra_json).filter(Query.id == query.id).scalar()
        )
        assert stored_extra == "{}"
        return True

    mocker.patch("superset.daos.query.sql_lab.cancel_query", side_effect=cancel)
    QueryDAO.stop_query("early-stop")

    session.expire_all()
    assert query.status == QueryStatus.STOPPED
    assert query.extra[QUERY_EARLY_CANCEL_KEY] is True
    assert query.end_time == 1234.5
