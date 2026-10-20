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

import inspect
from pathlib import Path

import pytest
from flask import current_app
from pytest_mock import MockerFixture
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from superset.common.db_query_status import QueryStatus
from superset.constants import QUERY_CANCEL_KEY, QUERY_EARLY_CANCEL_KEY
from superset.daos.query import QueryDAO
from superset.models.core import Database
from superset.models.sql_lab import Query
from superset.sql.execution.utils import set_query_stopped


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
    """A worker completes after the stop read but before its guarded write."""
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

        def stop_after_completion(loaded_query: Query, end_time: float) -> bool:
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
            return set_query_stopped(loaded_query, end_time)

        mocker.patch(
            "superset.daos.query.set_query_stopped", side_effect=stop_after_completion
        )
        cancel_query = mocker.patch("superset.daos.query.sql_lab.cancel_query")
        QueryDAO.stop_query("stop-race")
        cancel_query.assert_not_called()

    with Session(engine) as verify_session:
        completed = verify_session.get(Query, 123)
        assert completed is not None
        assert completed.status == terminal_status
        assert completed.results_key == "published-results"
        assert completed.end_time == 1234.5
        assert completed.extra == {"worker": True}
    engine.dispose()


@pytest.mark.parametrize("completion_timing", ["before_stop", "during_preparation"])
@pytest.mark.parametrize("engine_name", ["trino", "impala"])
@pytest.mark.parametrize("caller", ["dao", "async_handle"])
@pytest.mark.parametrize(
    "terminal_status", [QueryStatus.SUCCESS, QueryStatus.FAILED, QueryStatus.TIMED_OUT]
)
def test_engine_early_cancel_preserves_concurrently_committed_terminal_metadata(
    mocker: MockerFixture,
    app_context: None,
    tmp_path: Path,
    engine_name: str,
    caller: str,
    terminal_status: QueryStatus,
    completion_timing: str,
) -> None:
    """Real engine preparation must not flush stale extra over a worker's result."""
    from superset.db_engine_specs.impala import ImpalaEngineSpec
    from superset.db_engine_specs.trino import TrinoEngineSpec
    from superset.sql.execution.executor import SQLExecutor

    engine_spec = TrinoEngineSpec if engine_name == "trino" else ImpalaEngineSpec
    prepare_cancel = engine_spec.prepare_cancel_query
    mocker.patch.object(Database, "db_engine_spec", engine_spec)
    engine = create_engine(f"sqlite:///{tmp_path / 'engine-stop.db'}")
    Database.__table__.create(engine)
    Database.metadata.tables["ssh_tunnels"].create(engine)
    Query.__table__.create(engine)
    with Session(engine) as stop_session:
        # Core inserts avoid unrelated permission-creation ORM event handlers.
        stop_session.execute(
            Database.__table__.insert().values(
                id=1, database_name="cancel-race", sqlalchemy_uri="sqlite://"
            )
        )
        query = Query(
            id=123,
            client_id="engine-stop-race",
            user_id=7,
            database_id=1,
            status=QueryStatus.RUNNING,
            extra_json='{"initial": true}',
        )
        stop_session.add(query)
        stop_session.commit()
        mocker.patch("superset.daos.query.db.session", stop_session)
        mocker.patch("superset.daos.query.get_user_id", return_value=7)

        def complete() -> None:
            """Publish an outcome whose target effects finished independently."""
            with Session(engine) as worker_session:
                completed = worker_session.get(Query, 123)
                assert completed is not None
                completed.status = terminal_status
                completed.results_key = "published-results"
                completed.end_time = 1234.5
                completed.extra_json = '{"columns": [{"name": "worker"}], "errors": []}'
                worker_session.commit()

        def stop_after_worker_commit(loaded_query: Query, end_time: float) -> bool:
            """Complete after the stop read, before its initial guarded write."""
            assert loaded_query.status == QueryStatus.RUNNING
            complete()
            return set_query_stopped(loaded_query, end_time)

        def prepare_after_stop(loaded_query: Query) -> None:
            """A durable result wins while early cancellation is being prepared."""
            assert loaded_query.status == QueryStatus.STOPPED
            complete()
            prepare_cancel(loaded_query)

        prepare = mocker.patch.object(
            engine_spec, "prepare_cancel_query", side_effect=prepare_after_stop
        )
        if completion_timing == "before_stop":
            mocker.patch(
                "superset.daos.query.set_query_stopped",
                side_effect=stop_after_worker_commit,
            )
            mocker.patch(
                "superset.sql.execution.utils.set_query_stopped",
                side_effect=stop_after_worker_commit,
            )
        if caller == "dao":
            QueryDAO.stop_query("engine-stop-race")
        else:
            assert SQLExecutor._cancel_async_query(123, query.database) is False
        assert prepare.call_count == int(completion_timing == "during_preparation")

    with Session(engine) as verify_session:
        completed = verify_session.get(Query, 123)
        assert completed is not None
        assert completed.status == terminal_status
        assert completed.results_key == "published-results"
        assert completed.end_time == 1234.5
        assert completed.extra == {"columns": [{"name": "worker"}], "errors": []}
    engine.dispose()


@pytest.mark.parametrize(
    ("engine_name", "published_handle"),
    [("trino", False), ("impala", False), ("impala", True)],
)
@pytest.mark.parametrize("caller", ["dao", "async_handle"])
def test_engine_early_cancel_commits_with_guarded_stop(
    mocker: MockerFixture,
    app_context: None,
    tmp_path: Path,
    engine_name: str,
    caller: str,
    published_handle: bool,
) -> None:
    """Both cancellation callers publish early intent together with STOPPED."""
    from superset.db_engine_specs.impala import ImpalaEngineSpec
    from superset.db_engine_specs.trino import TrinoEngineSpec
    from superset.sql.execution.executor import SQLExecutor

    engine_spec = TrinoEngineSpec if engine_name == "trino" else ImpalaEngineSpec
    prepare_cancel = engine_spec.prepare_cancel_query
    mocker.patch.object(Database, "db_engine_spec", engine_spec)
    engine = create_engine(f"sqlite:///{tmp_path / 'early-stop.db'}")
    Database.__table__.create(engine)
    Database.metadata.tables["ssh_tunnels"].create(engine)
    Query.__table__.create(engine)
    initial_extra: dict[str, bool | str] = {"initial": True}
    if published_handle:
        initial_extra[QUERY_CANCEL_KEY] = "0123456789abcdef:fedcba9876543210"
    http_cancel = mocker.patch.object(engine_spec, "cancel_query", return_value=True)
    with Session(engine) as stop_session:
        # Core inserts avoid unrelated permission-creation ORM event handlers.
        stop_session.execute(
            Database.__table__.insert().values(
                id=1, database_name="early-cancel", sqlalchemy_uri="sqlite://"
            )
        )
        query = Query(
            id=123,
            client_id="early-engine-stop",
            user_id=7,
            database_id=1,
            status=QueryStatus.RUNNING,
        )
        from superset.utils import json

        query.extra_json = json.dumps(initial_extra)
        stop_session.add(query)
        stop_session.commit()
        mocker.patch("superset.daos.query.db.session", stop_session)
        mocker.patch("superset.daos.query.get_user_id", return_value=7)

        def prepare_without_commit(loaded_query: Query) -> None:
            """Preparation stages early intent after the stop becomes visible."""
            prepare_cancel(loaded_query)
            with Session(engine) as observer:
                stored = observer.get(Query, 123)
                assert stored is not None
                assert stored.status == QueryStatus.STOPPED
                assert stored.extra == initial_extra

        mocker.patch.object(
            engine_spec, "prepare_cancel_query", side_effect=prepare_without_commit
        )
        if caller == "dao":
            QueryDAO.stop_query("early-engine-stop")
        else:
            assert SQLExecutor._cancel_async_query(123, query.database) is True

    with Session(engine) as verify_session:
        stopped = verify_session.get(Query, 123)
        assert stopped is not None
        assert stopped.status == QueryStatus.STOPPED
        assert stopped.extra == {**initial_extra, QUERY_EARLY_CANCEL_KEY: True}
        assert stopped.end_time is not None
    http_cancel.assert_not_called()
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
    """Only the first Stop stages the early-cancel flag; STOPPED suffices after it."""
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
    assert bool(query.extra.get(QUERY_EARLY_CANCEL_KEY)) is (
        status != QueryStatus.STOPPED
    )
    assert query.end_time == 1234.5


@pytest.mark.parametrize("caller", ["api", "async_handle"])
@pytest.mark.parametrize("finish_before_stop", [False, True])
@pytest.mark.parametrize(
    "terminal_status", [QueryStatus.SUCCESS, QueryStatus.FAILED, QueryStatus.TIMED_OUT]
)
def test_stop_reports_concurrently_finished_query(
    mocker: MockerFixture,
    app_context: None,
    tmp_path: Path,
    caller: str,
    finish_before_stop: bool,
    terminal_status: QueryStatus,
) -> None:
    """A finished query is not reported as cancelled, including a lost stop race."""
    from superset.queries.api import QueryRestApi
    from superset.sql.execution.executor import SQLExecutor

    engine = create_engine(f"sqlite:///{tmp_path / 'stop-outcome.db'}")
    Query.__table__.create(engine)
    with Session(engine) as stop_session:
        query = Query(
            id=123,
            client_id="finished-stop",
            user_id=7,
            database_id=1,
            status=QueryStatus.RUNNING if finish_before_stop else terminal_status,
        )
        stop_session.add(query)
        stop_session.commit()
        mocker.patch("superset.daos.query.db.session", stop_session)
        mocker.patch("superset.daos.query.get_user_id", return_value=7)
        payload = {"id": "finished-stop", "state": terminal_status.lower()}
        mocker.patch.object(Query, "to_dict", return_value=payload)

        def stop_after_completion(loaded_query: Query, end_time: float) -> bool:
            """Commit the terminal outcome before the guarded stop write."""
            assert finish_before_stop
            with Session(engine) as worker_session:
                completed = worker_session.get(Query, 123)
                assert completed is not None
                completed.status = terminal_status
                worker_session.commit()
            return set_query_stopped(loaded_query, end_time)

        mocker.patch(
            "superset.daos.query.set_query_stopped", side_effect=stop_after_completion
        )
        mocker.patch(
            "superset.sql.execution.utils.set_query_stopped",
            side_effect=stop_after_completion,
        )
        cancel_query = mocker.patch("superset.daos.query.sql_lab.cancel_query")
        cancel_async = mocker.patch.object(SQLExecutor, "_cancel_query")
        if caller == "api":
            with current_app.test_request_context(json={"client_id": "finished-stop"}):
                response = inspect.unwrap(QueryRestApi.stop_query)(QueryRestApi())
            assert response.status_code == 422
            assert response.get_json() == {
                "message": "Could not cancel query",
                "query": payload,
            }
        else:
            assert SQLExecutor._cancel_async_query(123, mocker.Mock()) is False
        cancel_query.assert_not_called()
        cancel_async.assert_not_called()
        assert stop_session.get(Query, 123).status == terminal_status
    engine.dispose()


@pytest.mark.parametrize("caller", ["dao", "async_handle"])
@pytest.mark.parametrize("early_cancel", [False, True])
def test_winning_stop_preserves_concurrently_committed_extra(
    mocker: MockerFixture,
    app_context: None,
    tmp_path: Path,
    caller: str,
    early_cancel: bool,
) -> None:
    """Only stop-owned metadata changes when a worker updates a running query."""
    from superset.constants import QUERY_CANCEL_KEY
    from superset.sql.execution.executor import SQLExecutor

    engine = create_engine(f"sqlite:///{tmp_path / 'stop-extra.db'}")
    Query.__table__.create(engine)
    worker_extra = {QUERY_CANCEL_KEY: "worker-handle", "progress": "worker progress"}
    with Session(engine) as stop_session:
        query = Query(
            id=123,
            client_id="extra-stop",
            user_id=7,
            database_id=1,
            status=QueryStatus.RUNNING,
            extra_json='{"initial": true}',
        )
        stop_session.add(query)
        stop_session.commit()
        mocker.patch("superset.daos.query.db.session", stop_session)
        mocker.patch("superset.daos.query.get_user_id", return_value=7)

        def cancel(*args: object) -> bool:
            """Stage early intent while a second session publishes worker metadata."""
            assert query.extra == {"initial": True}
            if early_cancel:
                query.set_extra_json_key(QUERY_EARLY_CANCEL_KEY, True)
            with Session(engine) as worker_session:
                running = worker_session.get(Query, 123)
                assert running is not None
                for key, value in worker_extra.items():
                    running.set_extra_json_key(key, value)
                worker_session.commit()
            return True

        mocker.patch("superset.daos.query.sql_lab.cancel_query", side_effect=cancel)
        mocker.patch.object(SQLExecutor, "_cancel_query", side_effect=cancel)
        if caller == "dao":
            QueryDAO.stop_query("extra-stop")
        else:
            assert SQLExecutor._cancel_async_query(123, mocker.Mock()) is True

    with Session(engine) as verify_session:
        stopped = verify_session.get(Query, 123)
        assert stopped is not None
        assert stopped.status == QueryStatus.STOPPED
        assert stopped.end_time is not None
        assert stopped.extra == {
            "initial": True,
            **worker_extra,
            **({QUERY_EARLY_CANCEL_KEY: True} if early_cancel else {}),
        }
    engine.dispose()


@pytest.mark.parametrize("caller", ["api", "async_handle"])
@pytest.mark.parametrize("cancel_outcome", ["unsupported", "unreachable"])
@pytest.mark.parametrize("status", [QueryStatus.PENDING, QueryStatus.RUNNING])
def test_accepted_stop_reports_success_when_engine_cancel_fails(
    mocker: MockerFixture,
    app_context: None,
    session: Session,
    caller: str,
    cancel_outcome: str,
    status: QueryStatus,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """A committed stop is accepted even if engine cancellation is unavailable."""
    from superset.queries.api import QueryRestApi
    from superset.sql.execution.executor import SQLExecutor

    Query.__table__.create(session.get_bind())
    query = Query(
        id=123,
        client_id="accept-stop",
        user_id=7,
        database_id=1,
        status=status,
    )
    session.add(query)
    session.commit()
    mocker.patch("superset.daos.query.get_user_id", return_value=7)
    cancel = mocker.Mock(return_value=False)
    if cancel_outcome == "unreachable":
        cancel.side_effect = RuntimeError("Engine unavailable")
    mocker.patch("superset.daos.query.sql_lab.cancel_query", cancel)
    mocker.patch.object(SQLExecutor, "_cancel_query", cancel)

    if caller == "api":
        with current_app.test_request_context(json={"client_id": "accept-stop"}):
            response = inspect.unwrap(QueryRestApi.stop_query)(QueryRestApi())
        assert response.status_code == 200
        assert response.get_json() == {"result": "OK"}
    else:
        handle = SQLExecutor(mocker.Mock())._create_async_handle(123)
        assert handle.cancel() is True
    cancel.assert_called_once()
    warning = next(
        record
        for record in caplog.records
        if "engine cancellation not confirmed" in record.message
    )
    assert bool(warning.exc_info) is (cancel_outcome == "unreachable")
    session.expire_all()
    assert query.status == QueryStatus.STOPPED
    assert query.end_time is not None


@pytest.mark.parametrize("caller", ["api", "async_handle"])
@pytest.mark.parametrize("failure", ["none", "final_stop", "final_commit"])
def test_stop_acceptance_survives_post_commit_failure(
    mocker: MockerFixture,
    app_context: None,
    session: Session,
    caller: str,
    failure: str,
) -> None:
    """A durable stop remains accepted, and repeating it preserves its timestamp."""
    from superset.queries.api import QueryRestApi
    from superset.sql.execution.executor import SQLExecutor

    Query.__table__.create(session.get_bind())
    query = Query(
        id=123,
        client_id="durable-stop",
        user_id=7,
        database_id=1,
        status=QueryStatus.RUNNING,
    )
    session.add(query)
    session.commit()
    mocker.patch("superset.daos.query.get_user_id", return_value=7)
    cancel_api = mocker.patch(
        "superset.daos.query.sql_lab.cancel_query", return_value=False
    )
    cancel_handle = mocker.patch.object(
        SQLExecutor, "_cancel_query", return_value=False
    )
    commit = session.commit
    stop = set_query_stopped
    commits = 0
    stops = 0

    def fail_commit() -> None:
        """Fail only the second commit, after acceptance is durable."""
        nonlocal commits
        commits += 1
        if failure == "final_commit" and commits == 2:
            raise RuntimeError("post-stop commit failed")
        commit()

    def fail_stop(query: Query, end_time: float) -> bool:
        """Fail the post-cancellation metadata merge."""
        nonlocal stops
        stops += 1
        if failure == "final_stop" and stops == 2:
            raise RuntimeError("post-stop merge failed")
        return stop(query, end_time)

    mocker.patch.object(session, "commit", side_effect=fail_commit)
    mocker.patch("superset.daos.query.set_query_stopped", side_effect=fail_stop)
    mocker.patch(
        "superset.sql.execution.utils.set_query_stopped", side_effect=fail_stop
    )

    def request_stop() -> None:
        """Exercise the public response rather than only the staged row."""
        if caller == "api":
            with current_app.test_request_context(json={"client_id": "durable-stop"}):
                response = inspect.unwrap(QueryRestApi.stop_query)(QueryRestApi())
            assert response.status_code == 200
        else:
            assert SQLExecutor(mocker.Mock())._create_async_handle(123).cancel() is True

    request_stop()
    session.expire_all()
    original_end_time = query.end_time
    assert query.status == QueryStatus.STOPPED
    request_stop()
    session.expire_all()
    assert query.status == QueryStatus.STOPPED
    assert query.end_time == original_end_time
    # Stored cancellation handles may identify an unrelated session after reuse.
    (cancel_api if caller == "api" else cancel_handle).assert_called_once()
