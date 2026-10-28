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
"""Tests for helpers shared by legacy and Celery SQL execution."""

import inspect

import pytest
from flask import current_app
from pytest_mock import MockerFixture
from sqlalchemy.orm import Session

from superset.common.db_query_status import QueryStatus
from superset.constants import QUERY_TARGET_COMMITTED_KEY
from superset.models.sql_lab import Query
from superset.sql.execution.utils import (
    commit_target_transaction,
    finish_query_stop,
    set_query_stopped,
)


@pytest.mark.parametrize(
    ("legacy_name", "celery_name"),
    [
        ("_extract_errors", "_extract_errors"),
        ("_discard_unreferenced_results", "_discard_unreferenced_results"),
        ("_discard_unpublished_results", "_discard_stored_results"),
    ],
)
def test_execution_helpers_are_shared(legacy_name: str, celery_name: str) -> None:
    """Both execution paths use the same neutral helper implementation."""
    from superset import sql_lab
    from superset.sql.execution import celery_task

    helper = getattr(sql_lab, legacy_name)
    assert helper is getattr(celery_task, celery_name)
    assert helper.__module__ == "superset.sql.execution.utils"


@pytest.fixture
def persisted_stop_query(session: Session) -> Query:
    """Create a query on the isolated session used by the production helpers."""
    Query.__table__.create(session.get_bind())
    query = Query(
        id=123,
        client_id="helper-stop",
        database_id=1,
        user_id=7,
        status=QueryStatus.RUNNING,
    )
    session.add(query)
    session.commit()
    return query


@pytest.mark.parametrize(
    "status", [QueryStatus.SUCCESS, QueryStatus.FAILED, QueryStatus.TIMED_OUT]
)
def test_stop_rejects_completed_query(
    session: Session, persisted_stop_query: Query, status: QueryStatus
) -> None:
    """A losing Stop leaves the completed outcome and timestamp untouched."""
    query = persisted_stop_query
    query.status = status
    query.end_time = 42.0
    session.commit()

    assert set_query_stopped(query, 84.0) is False
    session.commit()
    session.refresh(query)
    assert query.status == status
    assert query.end_time == 42.0


def test_target_commit_skips_accepted_stop(
    mocker: MockerFixture, session: Session, persisted_stop_query: Query
) -> None:
    """An accepted Stop prevents the supplied target commit from running."""
    query = persisted_stop_query
    query.status = QueryStatus.STOPPED
    query.end_time = 42.0
    session.commit()
    commit = mocker.Mock()

    assert commit_target_transaction(query, commit) is False
    commit.assert_not_called()
    assert query.status == QueryStatus.STOPPED
    assert query.end_time == 42.0
    assert QUERY_TARGET_COMMITTED_KEY not in query.extra


@pytest.mark.parametrize("cancel_outcome", ["success", "unsupported", "unreachable"])
@pytest.mark.parametrize("metadata_failure", ["none", "merge", "commit"])
def test_stop_acceptance_survives_cancellation_failures(
    mocker: MockerFixture,
    session: Session,
    persisted_stop_query: Query,
    cancel_outcome: str,
    metadata_failure: str,
) -> None:
    """Failure after the durable Stop cannot reject it or repeat cancellation."""
    query = persisted_stop_query
    assert set_query_stopped(query, 42.0) is True
    cancel = mocker.Mock(return_value=cancel_outcome == "success")
    if cancel_outcome == "unreachable":
        cancel.side_effect = RuntimeError("Engine unavailable")
    if metadata_failure == "merge":
        mocker.patch(
            "superset.sql.execution.utils.set_query_stopped",
            side_effect=RuntimeError("Cancellation metadata unavailable"),
        )
    commit = session.commit
    commits = 0

    def fail_second_commit() -> None:
        """Fail only after the initial Stop is durably accepted."""
        nonlocal commits
        commits += 1
        if metadata_failure == "commit" and commits == 2:
            raise RuntimeError("Cancellation metadata commit unavailable")
        commit()

    mocker.patch.object(session, "commit", side_effect=fail_second_commit)

    assert finish_query_stop(query, cancel) is True
    assert query.status == QueryStatus.STOPPED
    assert query.end_time == 42.0
    session.expire_all()
    assert query.status == QueryStatus.STOPPED
    assert query.end_time == 42.0
    assert finish_query_stop(query, cancel) is True
    cancel.assert_called_once_with()


def test_async_cancel_rejects_target_commit_winner(
    mocker: MockerFixture, session: Session, persisted_stop_query: Query
) -> None:
    """An async handle must propagate a target commit that defeats its Stop."""
    from superset.sql.execution.executor import SQLExecutor

    query = persisted_stop_query
    query.set_extra_json_key(QUERY_TARGET_COMMITTED_KEY, True)
    session.commit()
    cancel = mocker.patch.object(SQLExecutor, "_cancel_query")

    assert SQLExecutor(mocker.Mock())._create_async_handle(query.id).cancel() is False
    cancel.assert_not_called()
    session.refresh(query)
    assert query.status == QueryStatus.RUNNING
    assert query.extra[QUERY_TARGET_COMMITTED_KEY] is True
    assert query.end_time is None


@pytest.mark.parametrize("caller", ["helper", "api", "async_handle"])
def test_initial_stop_commit_failure_does_not_accept_or_cancel(
    mocker: MockerFixture,
    app_context: None,
    session: Session,
    persisted_stop_query: Query,
    caller: str,
) -> None:
    """Only a durable initial commit may report acceptance or cancel the engine."""
    from superset.queries.api import QueryRestApi
    from superset.sql.execution.executor import SQLExecutor

    query = persisted_stop_query
    mocker.patch("superset.daos.query.get_user_id", return_value=7)
    cancel = mocker.Mock()
    mocker.patch("superset.sql_lab.cancel_query", cancel)
    mocker.patch.object(SQLExecutor, "_cancel_query", cancel)
    mocker.patch.object(
        session, "commit", side_effect=RuntimeError("Initial Stop commit failed")
    )

    def request_stop() -> None:
        """Exercise the selected acceptance entry point without swallowing errors."""
        if caller == "helper":
            assert set_query_stopped(query, 42.0) is True
            finish_query_stop(query, cancel)
        elif caller == "api":
            with current_app.test_request_context(json={"client_id": query.client_id}):
                inspect.unwrap(QueryRestApi.stop_query)(QueryRestApi())
        else:
            SQLExecutor(mocker.Mock())._create_async_handle(query.id).cancel()

    with pytest.raises(RuntimeError, match="Initial Stop commit failed"):
        request_stop()

    cancel.assert_not_called()
    session.rollback()
    session.refresh(query)
    assert query.status == QueryStatus.RUNNING
    assert query.end_time is None
