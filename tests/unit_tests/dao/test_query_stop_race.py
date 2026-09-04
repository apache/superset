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
Regression tests: a query used to get stuck in RUNNING forever if
QueryDAO.stop_query() was called before sql_lab.execute_sql_statements() had a
chance to acquire and persist a cancel handle (QUERY_CANCEL_KEY) on
query.extra -- superset.sql_lab.cancel_query() would return False without
recording anything, so stop_query() raised SupersetCancelQueryException and
left query.status untouched.

The fix distinguishes two cases that both look like "no cancel_query_id yet":

1. Execution hasn't reached the engine at all (hasn't opened a DB connection
   or called get_cancel_query_id()). Here, generalizing the
   QUERY_EARLY_CANCEL_KEY mechanism Trino's own prepare_cancel_query() already
   uses for its harder case is safe: record the early-cancel intent and
   report success, so the stopped-check at the top of the statement-block
   loop honors it before the statement is ever sent to the database.

2. Execution HAS reached the engine (a connection is open and
   get_cancel_query_id() has been called) and the engine spec still returned
   no cancel ID -- this engine genuinely has no way to cancel a running
   query. This must continue to fail honestly (raise
   SupersetCancelQueryException, leave status alone) rather than fabricate a
   stop the engine can't actually back; case 1's success path must not apply
   here. A new QUERY_DISPATCHED_KEY, set unconditionally once execution opens
   the connection, is what distinguishes the two cases.

Also covered: the success-path status finalizer at the end of
execute_sql_statements() must not clobber a STOPPED status a concurrent stop
request commits after the last per-block check; and QueryDAO.stop_query()
commits the early-cancel flag and status=STOPPED together in one transaction,
so no other request can ever observe the flag set with status still RUNNING.

Round 3 additions (further review findings):

- Finding 1: execute_sql_statements() used to unconditionally overwrite
  query.status to RUNNING at startup even if a stop request had already
  landed before the worker started, then dispatch the statement anyway.
  Fixed with a pre-start stopped-check mirroring the per-block one.
- Finding 3: the success-path payload/results-backend write, and the general
  failure catch-all (handle_query_error()), could each independently report/
  commit an outcome (SUCCESS or FAILED) that disagreed with a STOPPED status
  a concurrent stop request had already committed. Both now re-check status
  first and preserve STOPPED.
- Finding 2 (the TOCTOU race between cancel_query()'s read of
  QUERY_DISPATCHED_KEY and execute_sql_statements()'s own commit of that
  flag) is a known, disclosed, NOT-fixed limitation -- see the comment in
  cancel_query() itself. Closing it needs real DB-level row locking or
  optimistic-concurrency versioning, neither of which is meaningfully
  verifiable against sqlite. No test here claims that window is closed.

See superset/daos/query.py::QueryDAO.stop_query and
superset/sql_lab.py::cancel_query/execute_sql_statements/handle_query_error.
"""

import threading
from typing import Any

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session


def test_stop_before_worker_starts_marks_stopped_without_dispatch(
    app: Any, session: Session
) -> None:
    """
    Case 1, simplest form: stop arrives before execution has started at all.
    Exercises the real (unmocked) superset.sql_lab.cancel_query(), on a plain
    sqlite Database whose db_engine_spec has has_implicit_cancel() == False
    and never overrides get_cancel_query_id()/prepare_cancel_query(), so
    nothing short-circuits cancel_query() before the fixed branch.
    """
    from superset import db
    from superset.common.db_query_status import QueryStatus
    from superset.constants import QUERY_DISPATCHED_KEY, QUERY_EARLY_CANCEL_KEY
    from superset.daos.query import QueryDAO
    from superset.models.core import Database
    from superset.models.sql_lab import Query

    engine = db.session.get_bind()
    Query.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    query_obj = Query(
        client_id="never-dispatched",
        database=database,
        tab_name="test_tab",
        sql_editor_id="test_editor_id",
        sql="select * from bar",
        select_sql="select * from bar",
        executed_sql="select * from bar",
        limit=100,
        select_as_cta=False,
        status=QueryStatus.RUNNING,
    )
    db.session.add(database)
    db.session.add(query_obj)
    db.session.commit()

    assert database.db_engine_spec.has_implicit_cancel() is False
    assert "cancel_query" not in query_obj.extra
    assert QUERY_DISPATCHED_KEY not in query_obj.extra

    QueryDAO.stop_query(query_obj.client_id)

    db.session.flush()
    db.session.expire_all()
    refreshed = db.session.query(Query).filter_by(client_id="never-dispatched").one()
    assert refreshed.status == QueryStatus.STOPPED
    assert refreshed.extra.get(QUERY_EARLY_CANCEL_KEY) is True
    # Never dispatched -- the "engine has no cancel support" branch must not
    # have been the one that fired.
    assert QUERY_DISPATCHED_KEY not in refreshed.extra


class _RaceHarness:
    """
    Shared setup for tests that run superset.sql_lab.execute_sql_statements()
    in a background thread and call QueryDAO.stop_query() from the main
    thread while it's paused at a controlled point.

    Uses a real scoped_session (thread-local, keyed off the thread id) rather
    than a single shared Session -- this is what db.session actually is in
    production (Flask-SQLAlchemy), and it matters here: it gives the worker
    thread and the "stop request" a genuinely separate Session/identity map
    each, bound to the same underlying sqlite engine, so a commit in one is
    only visible to the other via a fresh read -- not for free through a
    shared in-memory object.
    """

    def __init__(self, mocker: MockerFixture) -> None:
        from sqlalchemy import create_engine
        from sqlalchemy.orm import scoped_session, sessionmaker
        from sqlalchemy.pool import StaticPool

        from superset.models.sql_lab import Query

        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.Session = scoped_session(
            sessionmaker(bind=self.engine), scopefunc=threading.get_ident
        )
        mocker.patch("superset.db.session", self.Session)
        mocker.patch("superset.security.SupersetSecurityManager.session", self.Session)

        Query.metadata.create_all(self.engine)  # pylint: disable=no-member

    def make_query(self, client_id: str) -> tuple[int, str]:
        from superset.models.core import Database
        from superset.models.sql_lab import Query

        database = Database(database_name="race_db", sqlalchemy_uri="sqlite://")
        query_obj = Query(
            client_id=client_id,
            database=database,
            tab_name="test_tab",
            sql_editor_id="test_editor_id",
            sql="select 1",
            select_sql="select 1",
            executed_sql="select 1",
            limit=100,
            select_as_cta=False,
        )
        self.Session.add(database)
        self.Session.add(query_obj)
        self.Session.commit()
        return query_obj.id, query_obj.client_id

    def fresh_query(self, query_id: int) -> Any:
        """Read the query back via a brand new session, like a separate
        request would -- proves persistence rather than reading local,
        possibly-unflushed object state."""
        from superset.models.sql_lab import Query

        self.Session.remove()
        return self.Session.query(Query).filter_by(id=query_id).one()

    def run_execution(
        self,
        app: Any,
        query_id: int,
        result: dict[str, Any],
        store_results: bool = False,
        return_results: bool = True,
    ) -> threading.Thread:
        from superset import sql_lab

        def _run() -> None:
            # Flask's app context is thread-local; execute_sql_statements
            # reads app.config from it, so the worker needs its own push.
            # scoped_session's scopefunc (thread id) also means this thread
            # transparently gets its own Session the first time db.session
            # is touched inside it.
            with app.app_context():
                try:
                    result["payload"] = sql_lab.execute_sql_statements(
                        query_id=query_id,
                        rendered_query="select 1",
                        return_results=return_results,
                        store_results=store_results,
                        start_time=None,
                        expand_data=False,
                        log_params=None,
                    )
                finally:
                    self.Session.remove()

        thread = threading.Thread(target=_run)
        thread.start()
        return thread


def test_stop_during_pre_dispatch_pause_marks_stopped_without_dispatch(
    mocker: MockerFixture, app: Any
) -> None:
    """
    Case 1, concurrency-shaped: pause execute_sql_statements() right before
    it opens the DB connection (i.e. before QUERY_DISPATCHED_KEY/
    QUERY_CANCEL_KEY can be set). A stop request landing in this gap must
    succeed immediately and prevent the statement from ever being dispatched.
    """
    from superset import sql_lab
    from superset.common.db_query_status import QueryStatus
    from superset.constants import QUERY_CANCEL_KEY, QUERY_DISPATCHED_KEY
    from superset.daos.query import QueryDAO

    harness = _RaceHarness(mocker)
    query_id, client_id = harness.make_query("pre-dispatch-race")

    reached_pause = threading.Event()
    release_execution = threading.Event()

    real_apply_limit = sql_lab.apply_limit

    def paused_apply_limit(query: Any, parsed_statement: Any) -> None:
        # Fires after query.status has been set to RUNNING and committed,
        # but well before the DB connection is opened -- squarely inside the
        # race window from the RCA.
        reached_pause.set()
        assert release_execution.wait(timeout=5), "test deadlocked waiting for release"
        return real_apply_limit(query, parsed_statement)

    mocker.patch("superset.sql_lab.apply_limit", side_effect=paused_apply_limit)

    execute_query_spy = mocker.patch(
        "superset.sql_lab.execute_query", side_effect=sql_lab.execute_query
    )

    execution_result: dict[str, Any] = {}
    worker = harness.run_execution(app, query_id, execution_result)

    try:
        assert reached_pause.wait(timeout=5), "execution never reached the pause point"

        query = harness.fresh_query(query_id)
        assert query.status == QueryStatus.RUNNING
        assert QUERY_DISPATCHED_KEY not in query.extra
        assert QUERY_CANCEL_KEY not in query.extra

        # No longer raises: the stop request is honored immediately, without
        # waiting for execution to reach the engine.
        QueryDAO.stop_query(client_id)

        stopped_query = harness.fresh_query(query_id)
        assert stopped_query.status == QueryStatus.STOPPED
    finally:
        release_execution.set()

    worker.join(timeout=10)
    assert not worker.is_alive(), "execute_sql_statements did not finish in time"

    # The statement itself was never sent to the database -- this is the
    # guarantee that actually matters. Execution still opens a connection and
    # records QUERY_DISPATCHED_KEY on its way to the per-block stopped-check
    # (that part isn't conditioned on query.status), so asserting its absence
    # here would be asserting something the code was never designed to do.
    execute_query_spy.assert_not_called()

    final_query = harness.fresh_query(query_id)
    assert final_query.status == QueryStatus.STOPPED, (
        f"expected the query to remain STOPPED without ever running, got "
        f"status={final_query.status!r}"
    )
    assert execution_result["payload"]["status"] == QueryStatus.STOPPED


def test_stop_after_dispatch_with_no_cancel_support_raises_honestly(
    mocker: MockerFixture, app: Any
) -> None:
    """
    Case 2, the finding-1 regression guard: once execute_sql_statements() has
    opened the connection and asked the (sqlite) engine spec for a cancel
    handle -- and gotten nothing back, since sqlite doesn't override
    get_cancel_query_id() -- a stop request must fail honestly
    (SupersetCancelQueryException, status left alone) instead of fabricating
    a STOPPED status for a query that is, in fact, still running against the
    real database.

    get_cancel_query_id() is deliberately left unmocked: the real, permanent
    "this engine has no cancel support" behavior is exactly the case that
    must not be confused with the pre-dispatch race window.
    """
    from superset import sql_lab
    from superset.common.db_query_status import QueryStatus
    from superset.constants import QUERY_DISPATCHED_KEY
    from superset.daos.query import QueryDAO
    from superset.exceptions import SupersetCancelQueryException

    harness = _RaceHarness(mocker)
    query_id, client_id = harness.make_query("post-dispatch-no-cancel-support")

    reached_pause = threading.Event()
    release_execution = threading.Event()

    real_execute_query = sql_lab.execute_query

    def paused_execute_query(query: Any, cursor: Any, log_params: Any) -> Any:
        # Fires once the connection is open and get_cancel_query_id() has
        # already run (and returned None, since sqlite doesn't override it)
        # -- i.e. after QUERY_DISPATCHED_KEY is committed, right as the
        # statement is about to be (or already is being) sent to the engine.
        reached_pause.set()
        assert release_execution.wait(timeout=5), "test deadlocked waiting for release"
        return real_execute_query(query, cursor, log_params)

    execute_query_spy = mocker.patch(
        "superset.sql_lab.execute_query", side_effect=paused_execute_query
    )

    execution_result: dict[str, Any] = {}
    worker = harness.run_execution(app, query_id, execution_result)

    try:
        assert reached_pause.wait(timeout=5), "execution never reached the pause point"

        query = harness.fresh_query(query_id)
        assert query.status == QueryStatus.RUNNING
        assert query.extra.get(QUERY_DISPATCHED_KEY) is True, (
            "expected execution to have already recorded the dispatched "
            "signal before reaching the statement-execution call"
        )
        assert "cancel_query" not in query.extra

        # Must raise now: the engine has already been asked for a cancel
        # handle and had none to give, which is a real "can't cancel"
        # failure, not the early race window.
        with pytest.raises(SupersetCancelQueryException):
            QueryDAO.stop_query(client_id)

        # Nothing was fabricated: still RUNNING.
        unstopped_query = harness.fresh_query(query_id)
        assert unstopped_query.status == QueryStatus.RUNNING
    finally:
        release_execution.set()

    worker.join(timeout=10)
    assert not worker.is_alive(), "execute_sql_statements did not finish in time"

    # The statement genuinely ran (real execute_query was called through).
    execute_query_spy.assert_called_once()

    # Since the stop attempt failed, execution proceeds to real completion --
    # this also confirms the success-path finalizer's new STOPPED-guard
    # doesn't misfire and swallow a legitimate SUCCESS.
    final_query = harness.fresh_query(query_id)
    assert final_query.status == QueryStatus.SUCCESS, (
        f"expected the query to run to real completion since the stop "
        f"attempt correctly failed, got status={final_query.status!r}"
    )
    assert execution_result["payload"]["status"] == QueryStatus.SUCCESS


def test_stop_with_existing_cancel_id_unaffected_by_dispatched_key(
    mocker: MockerFixture, app: Any, session: Session
) -> None:
    """
    Normal/existing path, unaffected: once a real QUERY_CANCEL_KEY is on
    record, cancel_query() must go straight to the engine spec's real
    cancel_query(cursor, query, cancel_query_id) implementation regardless of
    QUERY_DISPATCHED_KEY -- this path is untouched by the fix.
    """
    from superset import db
    from superset.common.db_query_status import QueryStatus
    from superset.constants import QUERY_CANCEL_KEY, QUERY_DISPATCHED_KEY
    from superset.daos.query import QueryDAO
    from superset.db_engine_specs.sqlite import SqliteEngineSpec
    from superset.models.core import Database
    from superset.models.sql_lab import Query

    engine = db.session.get_bind()
    Query.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    query_obj = Query(
        client_id="already-has-cancel-id",
        database=database,
        tab_name="test_tab",
        sql_editor_id="test_editor_id",
        sql="select * from bar",
        select_sql="select * from bar",
        executed_sql="select * from bar",
        limit=100,
        select_as_cta=False,
        status=QueryStatus.RUNNING,
    )
    db.session.add(database)
    db.session.add(query_obj)
    db.session.commit()
    query_obj.set_extra_json_key(QUERY_CANCEL_KEY, "real-cancel-id")
    query_obj.set_extra_json_key(QUERY_DISPATCHED_KEY, True)
    db.session.commit()

    mock_cancel = mocker.patch.object(
        SqliteEngineSpec, "cancel_query", return_value=True
    )

    QueryDAO.stop_query(query_obj.client_id)

    mock_cancel.assert_called_once()
    assert mock_cancel.call_args.args[-1] == "real-cancel-id"

    db.session.flush()
    db.session.expire_all()
    refreshed = (
        db.session.query(Query).filter_by(client_id="already-has-cancel-id").one()
    )
    assert refreshed.status == QueryStatus.STOPPED


def test_trino_early_cancel_key_behavior_is_unchanged(
    mocker: MockerFixture, app: Any, session: Session
) -> None:
    """
    Regression guard for Trino's existing (harder) case: the cancel ID is
    only obtainable *after* execution starts, so Trino's own
    prepare_cancel_query() records QUERY_EARLY_CANCEL_KEY itself. That
    already short-circuits cancel_query() at the
    `if query.extra.get(QUERY_EARLY_CANCEL_KEY): return True` check, before
    the (fixed) `cancel_query_id is None` branch is ever reached -- so the
    fix must not change Trino's behavior or double-set anything.

    Strengthened over a plain outcome check: spies on Query.set_extra_json_key
    and asserts it fires exactly once. If the fixed branch were also (wrongly)
    reached, it would make its own redundant call recording the exact same
    key, which a plain "final state looks right" assertion can't tell apart
    from Trino's own call -- call-count can.
    """
    from superset import db, sql_lab
    from superset.common.db_query_status import QueryStatus
    from superset.constants import QUERY_CANCEL_KEY, QUERY_EARLY_CANCEL_KEY
    from superset.models.core import Database
    from superset.models.sql_lab import Query

    engine = db.session.get_bind()
    Query.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(
        database_name="trino_db",
        sqlalchemy_uri="trino://user@localhost:8080/catalog",
    )
    assert database.db_engine_spec.engine == "trino"
    assert database.db_engine_spec.has_implicit_cancel() is False

    query_obj = Query(
        client_id="trino-early-cancel",
        database=database,
        tab_name="test_tab",
        sql_editor_id="test_editor_id",
        sql="select * from bar",
        select_sql="select * from bar",
        executed_sql="select * from bar",
        limit=100,
        select_as_cta=False,
        status=QueryStatus.RUNNING,
    )
    db.session.add(database)
    db.session.add(query_obj)
    db.session.commit()

    assert QUERY_CANCEL_KEY not in query_obj.extra
    assert QUERY_EARLY_CANCEL_KEY not in query_obj.extra

    set_extra_spy = mocker.spy(Query, "set_extra_json_key")

    assert sql_lab.cancel_query(query_obj) is True

    # Exactly one call: if the fixed `cancel_query_id is None` branch were
    # (wrongly) also reached, it would make its own additional call with the
    # exact same args, since QUERY_CANCEL_KEY is still absent -- so call
    # count is what actually distinguishes "only Trino's own path ran" from
    # "the fixed branch ran too and happened to agree."
    set_extra_spy.assert_called_once_with(query_obj, QUERY_EARLY_CANCEL_KEY, True)
    assert query_obj.extra.get(QUERY_EARLY_CANCEL_KEY) is True
    assert QUERY_CANCEL_KEY not in query_obj.extra

    # Calling it again (e.g. a duplicate stop click): Trino's own
    # prepare_cancel_query() doesn't check "is the flag already set" before
    # re-setting it, so it makes one more (harmless, pre-existing, unrelated
    # to this fix) call of its own -- bringing the total to 2, not 3. A third
    # call would mean the fixed branch fired in addition to Trino's own path.
    assert sql_lab.cancel_query(query_obj) is True
    assert set_extra_spy.call_count == 2
    for call in set_extra_spy.call_args_list:
        assert call.args == (query_obj, QUERY_EARLY_CANCEL_KEY, True)


def test_stopped_before_worker_start_never_dispatches(
    mocker: MockerFixture, app: Any
) -> None:
    """
    Finding 1 (round-3 review): reproduces the reviewer's scratch repro --
    mark a query STOPPED via stop_query() before execute_sql_statements()
    ever runs, then call execute_sql_statements() directly. Before the fix,
    it unconditionally overwrote status back to RUNNING at startup and
    dispatched the statement anyway (the reviewer confirmed the SQLite
    statement genuinely executed). The statement must never be dispatched
    and the row must stay STOPPED.
    """
    from superset import sql_lab
    from superset.common.db_query_status import QueryStatus
    from superset.daos.query import QueryDAO

    harness = _RaceHarness(mocker)
    query_id, client_id = harness.make_query("stopped-before-worker-start")

    # Stopped before any worker has touched this query -- status is still
    # the model default (PENDING), which stop_query() happily cancels.
    QueryDAO.stop_query(client_id)
    assert harness.fresh_query(query_id).status == QueryStatus.STOPPED

    execute_query_spy = mocker.patch(
        "superset.sql_lab.execute_query", side_effect=sql_lab.execute_query
    )

    with app.app_context():
        payload = sql_lab.execute_sql_statements(
            query_id=query_id,
            rendered_query="select 1",
            return_results=True,
            store_results=False,
            start_time=None,
            expand_data=False,
            log_params=None,
        )

    # The statement itself was never sent to the database.
    execute_query_spy.assert_not_called()
    assert payload is not None
    assert payload["status"] == QueryStatus.STOPPED

    final_query = harness.fresh_query(query_id)
    assert final_query.status == QueryStatus.STOPPED, (
        f"expected a pre-start stop to survive execute_sql_statements() "
        f"untouched, got status={final_query.status!r}"
    )


def test_stop_racing_normal_completion_keeps_payload_and_results_write_consistent(
    mocker: MockerFixture, app: Any
) -> None:
    """
    Finding 3.1 (round-3 review): a stop that lands after the final
    statement has finished executing but before the SUCCESS payload and
    results-backend write are built must not leave those artifacts claiming
    SUCCESS while the row is (correctly) STOPPED.

    Uses an engine spec that CAN really cancel (mocked get_cancel_query_id +
    cancel_query returning True), since a plain sqlite engine spec can't
    cancel post-dispatch at all (see the case-2 test above) -- this test is
    specifically about payload/results-write consistency once a stop DOES
    succeed, not about whether it succeeds.
    """
    from superset import sql_lab
    from superset.common.db_query_status import QueryStatus
    from superset.constants import QUERY_CANCEL_KEY
    from superset.daos.query import QueryDAO
    from superset.db_engine_specs.sqlite import SqliteEngineSpec

    harness = _RaceHarness(mocker)
    query_id, client_id = harness.make_query("stop-races-normal-completion")

    mocker.patch.object(
        SqliteEngineSpec, "get_cancel_query_id", return_value="fake-cancel-id"
    )
    real_cancel_spy = mocker.patch.object(
        SqliteEngineSpec, "cancel_query", return_value=True
    )

    results_backend_mock = mocker.MagicMock()
    results_backend_mock.set.return_value = True
    mocker.patch("superset.sql_lab.results_backend", results_backend_mock)

    reached_pause = threading.Event()
    release_execution = threading.Event()
    real_execute_query = sql_lab.execute_query

    def paused_execute_query(query: Any, cursor: Any, log_params: Any) -> Any:
        # Runs the real statement to completion FIRST, then pauses -- this
        # targets the window between "statement finished" and "success
        # payload/results-write built", which is what this test is about.
        result = real_execute_query(query, cursor, log_params)
        reached_pause.set()
        assert release_execution.wait(timeout=5), "test deadlocked waiting for release"
        return result

    mocker.patch("superset.sql_lab.execute_query", side_effect=paused_execute_query)

    execution_result: dict[str, Any] = {}
    worker = harness.run_execution(app, query_id, execution_result, store_results=True)

    try:
        assert reached_pause.wait(timeout=5), "execution never reached the pause point"

        query = harness.fresh_query(query_id)
        assert query.status == QueryStatus.RUNNING
        assert query.extra.get(QUERY_CANCEL_KEY) == "fake-cancel-id"

        # Succeeds: a real cancel ID is on record and the (mocked) real
        # cancel attempt succeeds -- the normal/existing path, unaffected by
        # this fix.
        QueryDAO.stop_query(client_id)

        stopped_query = harness.fresh_query(query_id)
        assert stopped_query.status == QueryStatus.STOPPED
    finally:
        release_execution.set()

    worker.join(timeout=10)
    assert not worker.is_alive(), "execute_sql_statements did not finish in time"

    real_cancel_spy.assert_called_once()

    # The row stays STOPPED...
    final_query = harness.fresh_query(query_id)
    assert final_query.status == QueryStatus.STOPPED

    # ...and the payload/results-write agree with it: no SUCCESS payload, no
    # results written to the backend, no results_key recorded on the row.
    assert execution_result["payload"]["status"] == QueryStatus.STOPPED
    assert "data" not in execution_result["payload"]
    results_backend_mock.set.assert_not_called()
    assert final_query.results_key is None


def test_stop_racing_exception_path_keeps_stopped_not_failed(
    mocker: MockerFixture, app: Any
) -> None:
    """
    Finding 3.2 (round-3 review), concurrency-shaped: the per-block loop's
    exception handler feeds into handle_query_error(), the same general
    catch-all shared with get_sql_results()'s outer try/except. An unrelated
    failure (not the stop itself) landing around the same time as a
    successful stop must not resurrect FAILED over the already-committed
    STOPPED status.
    """
    from superset.common.db_query_status import QueryStatus
    from superset.daos.query import QueryDAO
    from superset.db_engine_specs.sqlite import SqliteEngineSpec

    harness = _RaceHarness(mocker)
    query_id, client_id = harness.make_query("stop-races-exception-path")

    mocker.patch.object(
        SqliteEngineSpec, "get_cancel_query_id", return_value="fake-cancel-id"
    )
    mocker.patch.object(SqliteEngineSpec, "cancel_query", return_value=True)

    reached_pause = threading.Event()
    release_execution = threading.Event()

    def paused_failing_execute_query(query: Any, cursor: Any, log_params: Any) -> Any:
        reached_pause.set()
        assert release_execution.wait(timeout=5), "test deadlocked waiting for release"
        raise RuntimeError("simulated unrelated failure")

    mocker.patch(
        "superset.sql_lab.execute_query", side_effect=paused_failing_execute_query
    )

    execution_result: dict[str, Any] = {}
    worker = harness.run_execution(app, query_id, execution_result)

    try:
        assert reached_pause.wait(timeout=5), "execution never reached the pause point"

        QueryDAO.stop_query(client_id)
        stopped_query = harness.fresh_query(query_id)
        assert stopped_query.status == QueryStatus.STOPPED
    finally:
        release_execution.set()

    worker.join(timeout=10)
    assert not worker.is_alive(), "execute_sql_statements did not finish in time"

    final_query = harness.fresh_query(query_id)
    assert final_query.status == QueryStatus.STOPPED, (
        f"expected the unrelated exception to not resurrect FAILED over an "
        f"already-committed STOPPED, got status={final_query.status!r}"
    )
    assert final_query.error_message is None
    assert execution_result["payload"]["status"] == QueryStatus.STOPPED


def test_handle_query_error_preserves_already_stopped_status(
    app: Any, session: Session
) -> None:
    """
    Finding 3.2, direct/unit form: handle_query_error() is the shared
    catch-all for both the per-block loop's exception handler and the outer
    get_sql_results() try/except -- if the row is already STOPPED by the
    time it's called, for any reason, it must not overwrite that with
    FAILED.
    """
    from superset import db
    from superset.common.db_query_status import QueryStatus
    from superset.models.core import Database
    from superset.models.sql_lab import Query
    from superset.sql_lab import handle_query_error

    engine = db.session.get_bind()
    Query.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    query_obj = Query(
        client_id="already-stopped-error-path",
        database=database,
        tab_name="test_tab",
        sql_editor_id="test_editor_id",
        sql="select 1",
        select_sql="select 1",
        executed_sql="select 1",
        limit=100,
        select_as_cta=False,
        status=QueryStatus.STOPPED,
    )
    db.session.add(database)
    db.session.add(query_obj)
    db.session.commit()

    payload = handle_query_error(RuntimeError("unrelated failure"), query_obj)

    assert payload["status"] == QueryStatus.STOPPED
    assert "error" not in payload

    db.session.flush()
    db.session.expire_all()
    refreshed = (
        db.session.query(Query).filter_by(client_id="already-stopped-error-path").one()
    )
    assert refreshed.status == QueryStatus.STOPPED
    assert refreshed.error_message is None


def test_stop_racing_results_backend_write_failure_keeps_stopped_not_failed(
    mocker: MockerFixture, app: Any
) -> None:
    """
    Finding 3 gap (round-4 review): the results-backend-write-failure branch
    (async queries, return_results=False) used to unconditionally mark
    FAILED without checking for a concurrently-committed STOPPED first.

    Deterministic repro matching the reviewer's exact scenario: execute a
    real statement to completion, pause inside results_backend.set() (the
    write itself, not statement execution), commit a stop from a separate
    session while paused, then resume with the write returning False (write
    failure). Final status must be STOPPED, not FAILED, and no exception
    should propagate just because the row was already terminal.
    """
    from superset import sql_lab
    from superset.common.db_query_status import QueryStatus
    from superset.daos.query import QueryDAO
    from superset.db_engine_specs.sqlite import SqliteEngineSpec

    harness = _RaceHarness(mocker)
    query_id, client_id = harness.make_query("stop-races-results-backend-write-failure")

    # Give this engine real cancel support so the stop below actually
    # succeeds (the normal/existing path) -- this test is about what happens
    # to the payload/row *after* a stop has already succeeded, not about
    # whether it succeeds (that's the finding-1/round-3 territory).
    mocker.patch.object(
        SqliteEngineSpec, "get_cancel_query_id", return_value="fake-cancel-id"
    )
    mocker.patch.object(SqliteEngineSpec, "cancel_query", return_value=True)

    reached_pause = threading.Event()
    release_execution = threading.Event()

    results_backend_mock = mocker.MagicMock()

    def paused_failing_set(key: Any, value: Any, timeout: Any) -> bool:
        # Pauses inside the results-backend write itself (after the real
        # statement has already finished executing), then reports failure --
        # the exact window the reviewer's repro targets.
        reached_pause.set()
        assert release_execution.wait(timeout=5), "test deadlocked waiting for release"
        return False

    results_backend_mock.set.side_effect = paused_failing_set
    mocker.patch("superset.sql_lab.results_backend", results_backend_mock)

    execution_result: dict[str, Any] = {}
    execution_error: dict[str, BaseException] = {}

    def _run() -> None:
        with app.app_context():
            try:
                execution_result["payload"] = sql_lab.execute_sql_statements(
                    query_id=query_id,
                    rendered_query="select 1",
                    return_results=False,
                    store_results=True,
                    start_time=None,
                    expand_data=False,
                    log_params=None,
                )
            except BaseException as ex:  # pylint: disable=broad-except
                execution_error["error"] = ex
            finally:
                harness.Session.remove()

    worker = threading.Thread(target=_run)
    worker.start()

    try:
        assert reached_pause.wait(timeout=5), "execution never reached the pause point"

        query = harness.fresh_query(query_id)
        assert query.status == QueryStatus.RUNNING

        QueryDAO.stop_query(client_id)
        stopped_query = harness.fresh_query(query_id)
        assert stopped_query.status == QueryStatus.STOPPED
    finally:
        release_execution.set()

    worker.join(timeout=10)
    assert not worker.is_alive(), "execute_sql_statements did not finish in time"

    assert "error" not in execution_error, (
        f"expected no exception once the row was already STOPPED, got "
        f"{execution_error.get('error')!r} instead of a clean STOPPED payload"
    )

    final_query = harness.fresh_query(query_id)
    assert final_query.status == QueryStatus.STOPPED, (
        f"expected the results-backend write failure to not resurrect "
        f"FAILED over an already-committed STOPPED, got "
        f"status={final_query.status!r}"
    )
    assert final_query.error_message is None

    # The payload itself must be a genuinely minimal STOPPED payload, not
    # the pre-built SUCCESS payload (full result data, a nested
    # query["state"] == SUCCESS, and a resultsKey for a write that just
    # failed) with only the top-level "status" key patched over -- that
    # would be internally contradictory: claiming STOPPED while still
    # carrying SUCCESS data and a resultsKey pointing at nothing actually
    # stored.
    payload = execution_result["payload"]
    assert payload["status"] == QueryStatus.STOPPED
    assert "data" not in payload, (
        f"STOPPED payload must not carry result data, got keys: {list(payload.keys())}"
    )
    assert "query" not in payload or "resultsKey" not in payload.get("query", {}), (
        "STOPPED payload must not carry a resultsKey for a results-backend "
        "write that just failed"
    )
    assert (
        "query" not in payload or payload.get("query", {}).get("state") != "success"
    ), "STOPPED payload must not carry a nested SUCCESS state"
    assert payload == {"query_id": query_id, "status": QueryStatus.STOPPED}, (
        f"expected a fresh, minimal STOPPED payload, got: {payload}"
    )


def test_execute_sql_statements_success_path_persists_result_metadata(
    mocker: MockerFixture, app: Any
) -> None:
    """
    Regression test for a real CI failure (round 6): db.session.refresh()
    does NOT autoflush pending changes (verified empirically against actual
    SQLAlchemy 2.0 behavior, not assumed) -- every refresh() this fix added
    silently discarded whatever result metadata had been set, but not yet
    committed, earlier in execute_sql_statements()'s success path
    (query.rows, progress, extra "columns", select_sql for CTAS, end_time,
    results_key), reverting them to their stale pre-execution values
    (typically None) right before the function's own final commit persisted
    that stale state instead.

    This broke ordinary, never-stopped, non-mocked query execution across
    sqlite/mysql/postgres in real CI
    (tests/integration_tests/celery_tests.py's CTAS tests and
    tests/integration_tests/sql_lab/test_execute_sql_statements.py::
    test_results_backend_write_success) -- none of which this sandbox can
    run (its Docker/Celery stack is documented broken independent of this
    fix). This is the best available substitute, not a replacement: a real
    (unmocked) execute_sql_statements() call against a real SQLite-backed
    Query/Database, covering a CTAS query (to exercise query.select_sql,
    the same field the CI failures were about) with a results-backend write
    that succeeds (to exercise query.results_key), asserting the DB row and
    the response payload both end up with the correct values instead of the
    stale ones the unconditional final refresh() used to silently restore.

    Uses _RaceHarness purely for its real scoped_session setup (no threading
    here -- this is a plain, synchronous call): execute_query() calls
    warm_and_release_connection(), which calls db.session() as Flask-
    SQLAlchemy's real scoped_session proxy would; the stock `session`
    fixture is a plain Session, not a scoped_session, so it isn't callable
    and breaks that call.
    """
    from superset import sql_lab
    from superset.common.db_query_status import QueryStatus
    from superset.models.core import Database
    from superset.models.sql_lab import Query
    from superset.sql.parse import CTASMethod
    from superset.utils.dates import now_as_float

    harness = _RaceHarness(mocker)

    database = Database(database_name="ctas_db", sqlalchemy_uri="sqlite://")
    query_obj = Query(
        client_id="ctas-success-path",
        database=database,
        tab_name="test_tab",
        sql_editor_id="test_editor_id",
        sql="select 1",
        select_sql="select 1",
        limit=100,
        select_as_cta=True,
        ctas_method=CTASMethod.TABLE.name,
        tmp_table_name="ctas_tmp_table",
        start_time=now_as_float(),
        user_id=1,
    )
    harness.Session.add(database)
    harness.Session.add(query_obj)
    harness.Session.commit()
    query_id = query_obj.id

    results_backend_mock = mocker.MagicMock()
    results_backend_mock.set.return_value = True
    mocker.patch("superset.sql_lab.results_backend", results_backend_mock)

    with app.app_context():
        payload = sql_lab.execute_sql_statements(
            query_id=query_id,
            rendered_query="select 1",
            return_results=True,
            store_results=True,
            start_time=None,
            expand_data=False,
            log_params=None,
        )

    assert payload is not None
    assert "status" in payload, f"payload missing 'status' key entirely: {payload}"
    assert payload["status"] == QueryStatus.SUCCESS

    final_query = harness.fresh_query(query_id)

    assert final_query.status == QueryStatus.SUCCESS
    assert final_query.select_sql is not None, (
        "select_sql (set for CTAS queries) must survive to the persisted "
        "row, not be silently discarded by a refresh() that ran after it "
        "was set but before it was ever flushed"
    )
    assert "select" in final_query.select_sql.lower()
    assert final_query.rows is not None
    assert final_query.progress == 100
    assert final_query.extra.get("columns") is not None
    assert final_query.end_time is not None
    assert final_query.results_key is not None, (
        "results_key must survive to the persisted row when the "
        "results-backend write succeeds, not be silently discarded"
    )
    results_backend_mock.set.assert_called_once()
