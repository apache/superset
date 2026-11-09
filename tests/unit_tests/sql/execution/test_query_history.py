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

"""Persisted history outcomes for the shared synchronous SQL executor."""

from contextlib import nullcontext
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest
from pytest_mock import MockerFixture
from sqlalchemy import create_engine
from sqlalchemy.engine import Connection, Engine, ExecutionContext
from sqlalchemy.orm import Session
from superset_core.queries.types import (
    QueryResult,
    QueryStatus,
    StatementResult,
)

from superset import db
from superset.daos.query import QueryDAO
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    OAuth2Error,
    OAuth2RedirectError,
    SupersetTimeoutException,
)
from superset.mcp_service.worker import WorkerDeadlineExceeded
from superset.models.core import Database
from superset.models.sql_lab import Query
from superset.sql.execution.cancellation import cursor_scope, query_recorded
from superset.sql.execution.executor import SQLExecutor
from superset.sql.parse import SQLScript

from .conftest import mock_query_execution


@pytest.fixture
def session_engine(tmp_path: Path) -> Engine:
    """Use separate connections to model a Stop committed by another request."""
    return create_engine(f"sqlite:///{tmp_path / 'metadata.db'}")


@pytest.fixture(autouse=True)
def mock_db_session(session: Session) -> Session:
    """Override the directory's mock with actual metadata persistence."""
    Query.metadata.create_all(session.get_bind())
    return session


@pytest.fixture(autouse=True)
def history_execution(
    mocker: MockerFixture, database: Database, default_sql_config: None
) -> None:
    """Keep warehouse I/O and access policy independent of history assertions."""
    mocker.patch.object(SQLExecutor, "_check_security")
    mocker.patch.object(SQLExecutor, "_get_from_cache", return_value=None)
    mocker.patch.object(SQLExecutor, "_store_in_cache")
    mock_query_execution(mocker, database, return_data=[(1,)], column_names=["one"])


def test_run_history_fields(session: Session, database: Database) -> None:
    """A real run records its start, completion, SQL and non-CTAS intent."""
    result = database.execute("SELECT 1 AS one")
    query = session.get(Query, result.query_id)
    assert result.status == QueryStatus.SUCCESS
    assert query.status == "success"
    assert query.start_time <= query.start_running_time <= query.end_time
    assert query.select_as_cta is False
    assert " ".join(query.executed_sql.split()) == "SELECT 1 AS one"
    assert query.rows == 1
    assert query.progress == 100


def test_run_reports_its_history_id_to_the_execution_owner(
    session: Session, database: Database
) -> None:
    """The owner learns the row's ID as soon as the run is recorded."""
    reported: list[int] = []
    token = query_recorded.set(reported.append)
    try:
        result = database.execute("SELECT 1 AS one")
    finally:
        query_recorded.reset(token)
    assert reported == [result.query_id]


def test_worker_deadline_finishes_history(
    mocker: MockerFixture, session: Session, database: Database
) -> None:
    """The MCP deadline propagates after finishing the row, even without SIGALRM."""
    check = mocker.patch(
        "superset.sql.execution.cancellation.check_query_deadline",
        side_effect=[None, WorkerDeadlineExceeded()],
    )
    token = cursor_scope.set(lambda *args: nullcontext())
    try:
        with pytest.raises(WorkerDeadlineExceeded):
            database.execute("SELECT 1 AS one")
    finally:
        cursor_scope.reset(token)
    assert check.call_count == 2
    query = session.query(Query).one()
    assert query.status == "timed_out"
    assert query.error_message == "Query exceeded the timeout limit"
    assert query.start_running_time is not None
    assert query.start_time <= query.start_running_time <= query.end_time


@pytest.mark.parametrize(
    "outcome", ["success", "failure", "oauth", "timeout", "deadline"]
)
def test_concurrent_stop_wins(
    mocker: MockerFixture, session: Session, database: Database, outcome: str
) -> None:
    """A committed Stop beats both successful execution and a warehouse error."""
    execute_statements = SQLExecutor._execute_statements

    def stop(
        executor: SQLExecutor,
        original_script: SQLScript,
        transformed_script: SQLScript,
        catalog: str | None,
        schema: str | None,
        query: Query,
    ) -> list[StatementResult]:
        """Stop after warehouse execution but before publishing the outcome."""
        results = execute_statements(
            executor, original_script, transformed_script, catalog, schema, query
        )
        with Session(session.get_bind()) as other:
            with (
                patch.object(db, "session", other),
                patch("superset.daos.query.get_user_id", return_value=None),
                patch("superset.sql_lab.cancel_query", return_value=True),
            ):
                stopped = QueryDAO.stop_query(other.query(Query).one().client_id)
                assert stopped.status == "stopped"
        if outcome == "failure":
            raise RuntimeError("warehouse failed after stop")
        if outcome == "oauth":
            raise OAuth2Error("missing configuration")
        if outcome == "timeout":
            raise SupersetTimeoutException(
                error_type=SupersetErrorType.GENERIC_BACKEND_ERROR,
                message="Query timed out",
                level=ErrorLevel.ERROR,
            )
        if outcome == "deadline":
            raise WorkerDeadlineExceeded()
        return results

    mocker.patch.object(SQLExecutor, "_execute_statements", stop)
    if outcome == "deadline":
        with pytest.raises(WorkerDeadlineExceeded):
            database.execute("SELECT 1 AS one")
    else:
        result = database.execute("SELECT 1 AS one")
        assert result.status == QueryStatus.STOPPED
        assert result.error_message is None
        assert result.statements == []
        assert result.query_id is not None
    # A false guard refreshes with FOR UPDATE; callers must end that transaction.
    assert not session.in_transaction()
    session.expire_all()
    query = session.query(Query).one()
    assert query.status == "stopped"
    assert query.end_time >= query.start_time
    assert query.error_message is None


def stop_from_other_session(session: Session) -> Query:
    """Commit a Stop from an independent session, as a separate request would."""
    with Session(session.get_bind()) as other:
        with (
            patch.object(db, "session", other),
            patch("superset.daos.query.get_user_id", return_value=None),
            patch("superset.sql_lab.cancel_query", return_value=True),
        ):
            stopped = QueryDAO.stop_query(other.query(Query).one().client_id)
            assert stopped.status == "stopped"
            return stopped


def test_stop_mid_statement_does_not_wait_for_execution(
    mocker: MockerFixture, session: Session, database: Database
) -> None:
    """A Stop issued while the warehouse runs commits at once and wins.

    No metadata write may be staged while the statement executes: a staged
    write holds the row lock, so the Stop would wait for the whole run (on
    SQLite, it fails with "database is locked").
    """
    stops: list[str] = []

    def execute(cursor: Any, sql: str, db_: Database) -> None:
        # Any metadata read here (token lookups, expired relationships)
        # autoflushes whatever the run staged and holds its row lock.
        assert session.query(Query).count() == 1
        stops.append(stop_from_other_session(session).status)

    mocker.patch.object(database.db_engine_spec, "execute", side_effect=execute)
    result = database.execute("SELECT 1 AS one")
    assert stops == ["stopped"]
    assert result.status == QueryStatus.STOPPED
    assert result.query_id is not None
    assert not session.in_transaction()
    session.expire_all()
    query = session.query(Query).one()
    assert query.status == "stopped"
    assert query.start_running_time is not None
    assert " ".join(query.executed_sql.split()) == "SELECT 1 AS one"


def test_stop_before_running_time_is_published(
    mocker: MockerFixture, session: Session, database: Database
) -> None:
    """A Stop that lands before the run starts is kept and nothing executes."""
    create_query_record = SQLExecutor._create_query_record

    def create_then_stop(*args: Any, **kwargs: Any) -> Query:
        query = create_query_record(*args, **kwargs)
        stop_from_other_session(session)
        return query

    mocker.patch.object(SQLExecutor, "_create_query_record", create_then_stop)
    execute_statements = mocker.spy(SQLExecutor, "_execute_statements")
    result = database.execute("SELECT 1 AS one")
    assert result.status == QueryStatus.STOPPED
    assert result.statements == []
    assert result.error_message is None
    assert result.query_id is not None
    execute_statements.assert_not_called()
    assert not session.in_transaction()
    session.expire_all()
    query = session.query(Query).one()
    assert query.status == "stopped"
    assert query.start_running_time is None


@pytest.mark.parametrize("stop_in_statement", [1, 2])
def test_stop_between_statements_discards_results(
    mocker: MockerFixture,
    session: Session,
    database: Database,
    stop_in_statement: int,
) -> None:
    """A Stop landed during one statement is seen before the next one starts."""
    calls: list[str] = []

    def execute(cursor: Any, sql: str, db_: Database) -> None:
        calls.append(sql)
        if len(calls) == stop_in_statement:
            stop_from_other_session(session)

    mocker.patch.object(database.db_engine_spec, "execute", side_effect=execute)
    result = database.execute("SELECT 1 AS one; SELECT 2 AS two")
    assert result.status == QueryStatus.STOPPED
    assert result.statements == []
    assert len(calls) == stop_in_statement
    assert not session.in_transaction()
    session.expire_all()
    assert session.query(Query).one().status == "stopped"


def test_stop_before_later_statement_is_not_a_failure(
    mocker: MockerFixture, session: Session, database: Database
) -> None:
    """A Stop after statement 1 returns early and never reaches failure handling.

    Statement 1 has a result when the Stop lands, so the partial result list is
    non-empty; only a length comparison against the script's statements sees that
    results are missing. Zipping them instead raises a ValueError that failure
    handling turns into STOPPED, which a status assertion alone cannot tell apart.
    """
    calls: list[str] = []

    def execute(cursor: Any, sql: str, db_: Database) -> None:
        calls.append(sql)
        stop_from_other_session(session)

    mocker.patch.object(database.db_engine_spec, "execute", side_effect=execute)
    execute_statements = mocker.spy(SQLExecutor, "_execute_statements")
    record_failure = mocker.spy(SQLExecutor, "_record_failure")
    result = database.execute("SELECT 1 AS one; SELECT 2 AS two")
    assert len(calls) == 1
    assert execute_statements.spy_return == []
    record_failure.assert_not_called()
    assert result.status == QueryStatus.STOPPED
    assert result.statements == []
    assert result.error_message is None
    session.expire_all()
    query = session.query(Query).one()
    assert query.status == "stopped"
    assert query.error_message is None


def cached_result() -> QueryResult:
    """A populated cache hit, rather than an empty-iterating MagicMock."""
    return QueryResult(
        status=QueryStatus.SUCCESS,
        is_cached=True,
        statements=[
            StatementResult(
                original_sql="SELECT 1 AS one",
                executed_sql="SELECT 1 AS one",
                data=pd.DataFrame({"one": [1]}),
                row_count=1,
                execution_time_ms=0,
            )
        ],
    )


def test_cache_history_fields(
    mocker: MockerFixture, session: Session, database: Database
) -> None:
    """Cache hits persist a complete outcome in a single commit."""
    mocker.patch.object(SQLExecutor, "_get_from_cache", return_value=cached_result())
    commit = mocker.spy(session, "commit")
    result = database.execute("SELECT 1 AS one")
    assert result.status == QueryStatus.SUCCESS
    assert result.is_cached is True
    assert commit.call_count == 1
    query = session.get(Query, result.query_id)
    assert query.status == "success"
    assert query.start_time is not None
    assert query.end_time >= query.start_time
    assert " ".join(query.executed_sql.split()) == "SELECT 1 AS one"
    assert query.extra["is_cached"] is True
    assert query.progress == 100
    assert query.rows == 1
    assert query.select_as_cta is False


@pytest.mark.parametrize("write_failure", ["extra", "commit"])
def test_cache_history_write_failure(
    mocker: MockerFixture, session: Session, database: Database, write_failure: str
) -> None:
    """Metadata failure must not discard cached data or publish a partial row."""
    mocker.patch.object(SQLExecutor, "_get_from_cache", return_value=cached_result())
    if write_failure == "extra":
        mocker.patch.object(
            Query,
            "set_extra_json_key",
            side_effect=RuntimeError("metadata unavailable"),
        )
    else:
        mocker.patch.object(
            session, "commit", side_effect=RuntimeError("metadata unavailable")
        )
    warning = mocker.patch("superset.sql.execution.executor.logger.warning")
    result = database.execute("SELECT 1 AS one")
    assert result.status == QueryStatus.SUCCESS
    assert result.statements[0].data.to_dict("records") == [{"one": 1}]
    assert result.query_id is None
    assert session.query(Query).count() == 0
    warning.assert_called_once()


@pytest.mark.parametrize("oauth_redirect", [False, True])
def test_oauth_failure_finishes_history(
    mocker: MockerFixture, session: Session, database: Database, oauth_redirect: bool
) -> None:
    """OAuth exceptions propagate with the recorded failed run's ID."""
    error = (
        OAuth2RedirectError(
            url="https://example.com/authorize",
            tab_id="tab",
            redirect_uri="https://example.com/callback",
        )
        if oauth_redirect
        else OAuth2Error("missing configuration")
    )
    mocker.patch.object(database.db_engine_spec, "execute", side_effect=error)
    with pytest.raises(type(error)) as caught:
        database.execute("SELECT 1 AS one")
    query = session.query(Query).one()
    assert query.status == "failed"
    assert query.start_time <= query.start_running_time <= query.end_time
    assert query.error_message
    assert caught.value.query_id == query.id


@pytest.mark.parametrize("failure", [False, True])
def test_history_records_mutated_statement(
    mocker: MockerFixture, session: Session, database: Database, failure: bool
) -> None:
    """Audit SQL matches what is sent to the warehouse, including on failure."""
    mocker.patch.object(
        database, "mutate_sql_based_on_config", return_value="SELECT 2 AS two"
    )
    if failure:
        mocker.patch.object(
            database.db_engine_spec,
            "execute",
            side_effect=RuntimeError("warehouse error"),
        )
    result = database.execute("SELECT 1 AS one")
    assert result.status == (QueryStatus.FAILED if failure else QueryStatus.SUCCESS)
    assert session.get(Query, result.query_id).executed_sql == "SELECT 2 AS two"


@pytest.mark.parametrize("write_site", ["progress", "success"])
@pytest.mark.parametrize("persist_database", [False, True])
@pytest.mark.parametrize("with_orig", [False, True])
def test_failed_flush_finishes_history(
    session: Session,
    database: Database,
    write_site: str,
    persist_database: bool,
    with_orig: bool,
) -> None:
    """A failed flush must not mask its error by loading an expired Query ID."""
    from sqlalchemy import event
    from sqlalchemy.exc import OperationalError
    from sqlalchemy.orm.unitofwork import UOWTransaction

    if persist_database:
        session.add(database)
        session.commit()
    injected = False

    def fail_flush(flushing: Session, context: UOWTransaction) -> None:
        """Fail once after the progress or success update has been flushed."""
        nonlocal injected
        status = "running" if write_site == "progress" else "success"
        if not injected and any(
            isinstance(row, Query) and row.progress == 100 and row.status == status
            for row in flushing.dirty
        ):
            injected = True
            message = f"metadata {write_site} flush failed"
            if with_orig:
                # SQLAlchemy wraps the DBAPI error with the statement and its
                # parameters, which must not reach the history row or the caller.
                raise OperationalError(
                    'INSERT INTO "query" (sql) VALUES (?)',
                    ("SELECT 1",),
                    Exception(message),
                )
            raise RuntimeError(message)

    event.listen(session, "after_flush", fail_flush)
    try:
        result = database.execute("SELECT 1 AS one")
    finally:
        event.remove(session, "after_flush", fail_flush)

    assert injected
    assert result.status == QueryStatus.FAILED
    assert result.error_message == f"metadata {write_site} flush failed"
    query = session.query(Query).one()
    assert result.query_id == query.id
    assert query.status == "failed"
    assert query.error_message == result.error_message
    assert "INSERT INTO" not in result.error_message
    assert query.end_time >= query.start_time
    assert session.is_active


@pytest.mark.asyncio
@pytest.mark.parametrize("expired", [False, True])
async def test_driver_cancellation_finishes_history(
    mocker: MockerFixture, session: Session, database: Database, expired: bool
) -> None:
    """An expired call's driver error is a deadline, not a warehouse failure."""
    from flask import current_app

    from superset.mcp_service.worker import (
        _active_call,
        warehouse_cursor,
        WorkerCall,
    )

    call = WorkerCall(current_app._get_current_object(), mocker.Mock(), 30)
    error = RuntimeError("driver query cancelled")

    def cancel(*args: object) -> None:
        """Model a driver raising after deadline/disconnect cancellation."""
        if expired:
            call.expired.set()
        raise error

    mocker.patch.object(database.db_engine_spec, "execute", side_effect=cancel)
    mocker.patch("superset.mcp_service.worker.QueryCancellation.capture")
    mocker.patch("superset.mcp_service.worker.QueryCancellation.register")
    call_token = _active_call.set(call)
    cursor_token = cursor_scope.set(warehouse_cursor)
    try:
        if expired:
            with pytest.raises(WorkerDeadlineExceeded) as caught:
                database.execute("SELECT 1 AS one")
            assert caught.value.__cause__ is error
        else:
            result = database.execute("SELECT 1 AS one")
            assert result.status == QueryStatus.FAILED
            assert (
                result.error_message
                == database.db_engine_spec.extract_error_message(error)
            )
    finally:
        cursor_scope.reset(cursor_token)
        _active_call.reset(call_token)

    query = session.query(Query).one()
    assert query.status == ("timed_out" if expired else "failed")
    assert query.error_message == (
        "Query exceeded the timeout limit"
        if expired
        else database.db_engine_spec.extract_error_message(error)
    )
    assert query.start_time <= query.start_running_time <= query.end_time
    assert call.cancel_query is None


def test_cached_history_matches_mutated_last_statement(
    mocker: MockerFixture, session: Session, database: Database
) -> None:
    """Cached runs record the last statement as mutated for the current user."""
    mutate = mocker.patch.object(
        database,
        "mutate_sql_based_on_config",
        side_effect=["SELECT 2 AS two", "SELECT 4 AS four", "SELECT 6 AS six"],
    )
    first = database.execute("SELECT 1 AS one; SELECT 3 AS three")
    first_id = first.query_id
    assert first.status == QueryStatus.SUCCESS
    first.is_cached = True
    mocker.patch.object(SQLExecutor, "_get_from_cache", return_value=first)
    second = database.execute("SELECT 1 AS one; SELECT 3 AS three")

    assert second.status == QueryStatus.SUCCESS
    assert second.is_cached
    assert second.query_id != first_id
    executed = session.get(Query, first_id)
    cached = session.get(Query, second.query_id)
    assert executed.executed_sql == "SELECT 4 AS four"
    assert cached.executed_sql == "SELECT 6 AS six"
    assert cached.sql == executed.sql
    assert mutate.call_count == 3
    assert mutate.call_args == mocker.call(
        mutate.call_args_list[1].args[0], is_split=True
    )


def test_empty_cached_history_retains_sql(
    mocker: MockerFixture, session: Session, database: Database
) -> None:
    """Legacy cache entries without statement metadata retain the prepared SQL."""
    cached = cached_result()
    cached.statements = []
    mocker.patch.object(SQLExecutor, "_get_from_cache", return_value=cached)
    result = database.execute("SELECT 1 AS one")
    query = session.get(Query, result.query_id)
    assert result.status == QueryStatus.SUCCESS
    assert " ".join(query.executed_sql.split()) == "SELECT 1 AS one"


@pytest.mark.asyncio
async def test_expired_sqlalchemy_error_cleans_up_before_deadline(
    mocker: MockerFixture, session: Session, database: Database
) -> None:
    """SQLAlchemy closes a failed cursor before the raw owner raises a deadline."""
    from flask import current_app
    from sqlalchemy import event, text
    from sqlalchemy.exc import OperationalError

    from superset.mcp_service.worker import (
        _active_call,
        warehouse_cursor,
        WorkerCall,
    )
    from superset.sql.execution.cancellation import cancellable_engine

    call = WorkerCall(current_app._get_current_object(), mocker.Mock(), 30)
    warehouse = create_engine("sqlite://")
    handled: list[MagicMock] = []
    connections: list[Connection] = []
    rollbacks: list[MagicMock] = []
    closed_cursors: list[MagicMock] = []

    def expire(
        conn: Connection,
        cursor: Any,
        statement: str,
        parameters: Any,
        context: ExecutionContext,
        executemany: bool,
    ) -> None:
        """Expire after registration, while the driver is executing."""
        call.expired.set()
        handled.append(mocker.spy(context, "handle_dbapi_exception"))

    event.listen(warehouse, "before_cursor_execute", expire)

    def execute(*args: object) -> None:
        """Model an engine spec issuing a SQLAlchemy statement during execution."""
        with cancellable_engine(database, warehouse, None, None):
            with warehouse.connect() as connection:
                connections.append(connection)
                rollbacks.append(mocker.spy(connection, "_rollback_impl"))
                closed_cursors.append(mocker.spy(connection, "_safe_close_cursor"))
                connection.execute(text("SELECT * FROM missing_table"))

    mocker.patch.object(database.db_engine_spec, "execute", side_effect=execute)
    mocker.patch("superset.mcp_service.worker.QueryCancellation.capture")
    mocker.patch("superset.mcp_service.worker.QueryCancellation.register")
    call_token = _active_call.set(call)
    cursor_token = cursor_scope.set(warehouse_cursor)
    try:
        with pytest.raises(WorkerDeadlineExceeded) as caught:
            database.execute("SELECT 1 AS one")
    finally:
        cursor_scope.reset(cursor_token)
        _active_call.reset(call_token)
        warehouse.dispose()

    handled[0].assert_called_once()
    closed_cursors[0].assert_called_once()
    rollbacks[0].assert_called_once()
    assert connections[0].closed
    assert not connections[0].in_transaction()
    assert isinstance(caught.value.__cause__, OperationalError)
    query = session.query(Query).one()
    assert query.status == "timed_out"
    assert query.error_message == "Query exceeded the timeout limit"
    assert query.start_time <= query.start_running_time <= query.end_time
    assert call.cancel_query is None


def test_failed_running_insert_restores_session(
    session: Session, database: Database
) -> None:
    """A failed initial history flush leaves no row and a usable metadata session."""
    from sqlalchemy import event
    from sqlalchemy.orm.unitofwork import UOWTransaction

    def fail_insert(flushing: Session, context: UOWTransaction) -> None:
        """Fail during the first commit, before the executor receives a Query."""
        if any(isinstance(row, Query) for row in flushing.new):
            raise RuntimeError("metadata running insert failed")

    event.listen(session, "after_flush", fail_insert)
    try:
        result = database.execute("SELECT 1 AS one")
    finally:
        event.remove(session, "after_flush", fail_insert)

    assert result.status == QueryStatus.FAILED
    assert result.error_message == "metadata running insert failed"
    assert result.query_id is None
    assert session.is_active
    assert not session.in_transaction()
    assert session.query(Query).count() == 0
    assert database.execute("SELECT 1 AS one").status == QueryStatus.SUCCESS


def test_cache_write_failure_preserves_success(
    mocker: MockerFixture, session: Session, database: Database
) -> None:
    """An optional cache write cannot turn committed warehouse success into failure."""
    mocker.patch.object(
        SQLExecutor, "_store_in_cache", side_effect=RuntimeError("cache unavailable")
    )
    warning = mocker.patch("superset.sql.execution.executor.logger.warning")
    result = database.execute("SELECT 1 AS one")

    assert result.status == QueryStatus.SUCCESS
    assert result.error_message is None
    assert result.statements[0].data.to_dict("records") == [{"one": 1}]
    query = session.get(Query, result.query_id)
    assert query.status == "success"
    assert query.error_message is None
    assert query.rows == 1
    assert query.start_time <= query.start_running_time <= query.end_time
    warning.assert_called_once_with(
        "Unable to store SQL result in cache", exc_info=True
    )


@pytest.mark.parametrize("interruption", [SystemExit, KeyboardInterrupt])
def test_interruption_after_success_commit_keeps_success(
    mocker: MockerFixture,
    session: Session,
    database: Database,
    interruption: type[BaseException],
) -> None:
    """A BaseException during the cache write leaves committed success alone."""
    mocker.patch.object(SQLExecutor, "_try_store_in_cache", side_effect=interruption)
    mark_failed = mocker.spy(SQLExecutor, "_mark_query_failed")
    with pytest.raises(interruption):
        database.execute("SELECT 1 AS one")

    # The committed outcome is final: no failure write targets its row.
    assert all(call.args[1] is None for call in mark_failed.call_args_list)
    query = session.query(Query).one()
    assert query.status == "success"
    assert query.error_message is None
    assert query.rows == 1


@pytest.mark.parametrize("outcome", ["warehouse", "security", "timeout"])
def test_failure_history_timestamps(
    mocker: MockerFixture, session: Session, database: Database, outcome: str
) -> None:
    """Every recorded synchronous error has ordered start and end timestamps."""
    from superset.exceptions import SupersetSecurityException

    if outcome == "warehouse":
        error: Exception = RuntimeError("warehouse failed")
    elif outcome == "security":
        error = SupersetSecurityException(
            SupersetError(
                error_type=SupersetErrorType.GENERIC_BACKEND_ERROR,
                message="execution failed",
                level=ErrorLevel.ERROR,
            )
        )
    else:
        error = SupersetTimeoutException(
            error_type=SupersetErrorType.GENERIC_BACKEND_ERROR,
            message="execution failed",
            level=ErrorLevel.ERROR,
        )
    mocker.patch.object(SQLExecutor, "_execute_statements", side_effect=error)
    result = database.execute("SELECT 1 AS one")

    assert result.status == (
        QueryStatus.TIMED_OUT if outcome == "timeout" else QueryStatus.FAILED
    )
    query = session.get(Query, result.query_id)
    assert query.status == result.status.value
    assert query.start_time <= query.start_running_time <= query.end_time


def test_async_submission_failure_history_timestamps(
    mocker: MockerFixture, session: Session, database: Database
) -> None:
    """A broker rejection finishes the pending row even before a worker starts."""
    mocker.patch(
        "superset.sql.execution.celery_task.execute_sql_task.delay",
        side_effect=RuntimeError("broker unavailable"),
    )
    with pytest.raises(RuntimeError, match="broker unavailable"):
        database.execute_async("SELECT 1 AS one")

    query = session.query(Query).one()
    assert query.status == "failed"
    assert query.error_message == "broker unavailable"
    assert query.start_time is not None
    assert query.end_time >= query.start_time
    assert query.start_running_time is None


def test_unacknowledged_success_commit_keeps_success(
    mocker: MockerFixture, session: Session, database: Database
) -> None:
    """A success commit that applied before raising is not rewritten as failed."""
    commit = db.session.commit
    injected = False

    def commit_then_fail() -> None:
        """Apply the commit, then lose its acknowledgement once it publishes success."""
        nonlocal injected
        commit()
        if not injected and session.query(Query.status).scalar() == "success":
            injected = True
            raise RuntimeError("commit acknowledgement lost")

    mocker.patch.object(db.session, "commit", side_effect=commit_then_fail)
    result = database.execute("SELECT 1 AS one")

    assert injected
    assert result.status == QueryStatus.FAILED
    assert "commit acknowledgement lost" in result.error_message
    query = session.query(Query).one()
    assert result.query_id == query.id
    assert query.status == "success"
    assert query.error_message is None
