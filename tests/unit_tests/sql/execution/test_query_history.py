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
from unittest.mock import patch

import pandas as pd
import pytest
from pytest_mock import MockerFixture
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session
from superset_core.queries.types import (
    QueryResult,
    QueryStatus,
    StatementResult,
)

from superset import db
from superset.daos.query import QueryDAO
from superset.errors import ErrorLevel, SupersetErrorType
from superset.exceptions import (
    OAuth2Error,
    OAuth2RedirectError,
    SupersetTimeoutException,
)
from superset.mcp_service.worker import WorkerDeadlineExceeded
from superset.models.core import Database
from superset.models.sql_lab import Query
from superset.sql.execution.cancellation import cursor_scope
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
    assert query.end_time >= query.start_running_time


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
    assert query.end_time is not None
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
    assert query.end_time >= query.start_running_time
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
