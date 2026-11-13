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

"""execute_sql records every run in query history, as SQL Lab does."""

from collections.abc import Iterator
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from fastmcp import Client
from flask_appbuilder.security.sqla.models import User
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from superset.mcp_service.app import mcp
from superset.models.core import Database
from superset.models.sql_lab import Query
from superset.utils import json


@pytest.fixture
def session_engine() -> Engine:
    """Let the tool worker thread use the ``session`` built by this test."""
    return create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )


@pytest.fixture
def user(session: Session) -> User:
    """Persist the MCP caller so query rows can reference it."""
    Query.metadata.create_all(session.get_bind())
    user = User(
        first_name="MCP", last_name="Caller", username="mcp", email="mcp@example.com"
    )
    session.add(user)
    session.commit()
    return user


@pytest.fixture
def database(session: Session, user: User) -> Database:
    """Register a warehouse the caller may query."""
    database = Database(database_name="warehouse", sqlalchemy_uri="sqlite://")
    session.add(database)
    session.commit()
    return database


@pytest.fixture(autouse=True)
def caller(user: User) -> Iterator[None]:
    """Authenticate the MCP caller and grant it the query."""
    with (
        patch("superset.mcp_service.auth.get_user_from_request", return_value=user),
        patch("superset.security.SupersetSecurityManager.raise_for_access"),
        patch(
            "superset.security.SupersetSecurityManager.can_access_all_queries",
            return_value=False,
        ),
    ):
        yield


async def call(tool: str, request: dict[str, Any]) -> dict[str, Any]:
    """Call a registered tool through MCP and decode its response."""
    async with Client(mcp) as client:
        result = await client.call_tool(tool, {"request": request})
        return json.loads(result.content[0].text)


@pytest.mark.asyncio
async def test_execute_sql_records_query_history(
    session: Session, user: User, database: Database
) -> None:
    """A successful run returns its query id and is listed in query history."""
    response = await call(
        "execute_sql", {"database_id": database.id, "sql": "SELECT 1 AS one"}
    )

    assert response["success"] is True
    assert response["query_id"] is not None
    query = session.get(Query, response["query_id"])
    assert query is not None
    assert query.user_id == user.id
    assert query.database_id == database.id
    assert query.status == "success"
    assert query.client_id
    assert "1 AS one" in query.sql
    assert "1 AS one" in query.executed_sql
    assert query.rows == 1
    assert query.start_time is not None
    assert query.end_time >= query.start_time

    history = await call("list_queries", {})
    assert response["query_id"] in [item["id"] for item in history["queries"]]


@pytest.mark.asyncio
async def test_execute_sql_records_failed_query(
    session: Session, user: User, database: Database
) -> None:
    """A run the warehouse rejects is recorded as failed, not left running."""
    response = await call(
        "execute_sql", {"database_id": database.id, "sql": "SELECT * FROM missing"}
    )

    assert response["success"] is False
    assert response["query_id"] is not None
    query = session.get(Query, response["query_id"])
    assert query is not None
    assert query.user_id == user.id
    assert query.status == "failed"
    assert "missing" in query.error_message
    assert query.end_time >= query.start_time


@pytest.mark.asyncio
async def test_execute_sql_records_cached_query(
    session: Session, user: User, database: Database
) -> None:
    """A run answered from the results cache is still recorded."""
    store: dict[str, Any] = {}
    data_cache = MagicMock()
    data_cache.get.side_effect = store.get
    data_cache.set.side_effect = lambda key, value, **kwargs: store.update({key: value})
    request = {"database_id": database.id, "sql": "SELECT 1 AS one"}

    with patch(
        "superset.sql.execution.executor.cache_manager",
        MagicMock(data_cache=data_cache),
    ):
        first = await call("execute_sql", request)
        second = await call("execute_sql", request)

    assert store, "the first run should populate the results cache"
    assert second["success"] is True
    assert second["query_id"] is not None
    assert second["query_id"] != first["query_id"]
    query = session.get(Query, second["query_id"])
    assert query is not None
    assert query.user_id == user.id
    assert query.status == "success"
    assert query.rows == 1
    assert query.extra.get("is_cached") is True
    assert query.end_time >= query.start_time


@pytest.mark.asyncio
async def test_execute_sql_deadline_finishes_query(
    session: Session, database: Database
) -> None:
    """A worker deadline finishes history before the transport reports timeout."""
    from fastmcp.exceptions import ToolError

    from superset.mcp_service.worker import WorkerDeadlineExceeded

    with patch(
        "superset.sql.execution.cancellation.check_query_deadline",
        side_effect=[None, WorkerDeadlineExceeded()],
    ) as check:
        with pytest.raises(ToolError, match="timed out"):
            await call("execute_sql", {"database_id": database.id, "sql": "SELECT 1"})
    assert check.call_count == 2
    query = session.query(Query).one()
    assert query.status == "timed_out"
    assert query.start_time <= query.start_running_time <= query.end_time
    assert query.error_message == "Query exceeded the timeout limit"


@pytest.mark.asyncio
@pytest.mark.parametrize("redirect", [False, True])
async def test_execute_sql_oauth_returns_query_id(
    session: Session, database: Database, redirect: bool
) -> None:
    """Both OAuth response variants identify the failed run in history."""
    from superset.exceptions import OAuth2Error, OAuth2RedirectError

    error = (
        OAuth2RedirectError(
            url="https://example.com/authorize",
            tab_id="tab",
            redirect_uri="https://example.com/callback",
        )
        if redirect
        else OAuth2Error("missing configuration")
    )
    with patch.object(database.db_engine_spec, "execute", side_effect=error):
        response = await call(
            "execute_sql", {"database_id": database.id, "sql": "SELECT 1"}
        )
    assert response["success"] is False
    query = session.query(Query).one()
    assert query.status == "failed"
    assert query.start_time <= query.start_running_time <= query.end_time
    assert response["query_id"] == query.id


def test_execute_sql_query_id_documents_missing_history() -> None:
    """The schema must not promise an ID for pre-execution or history failures."""
    from superset.mcp_service.sql_lab.schemas import ExecuteSqlResponse

    description = ExecuteSqlResponse.model_fields["query_id"].description
    assert "errors before" in description
    assert "cache-hit history" in description


@pytest.mark.parametrize("error_message", [None, "driver cancellation detail"])
def test_stopped_response_has_error_text(error_message: str | None) -> None:
    """A stopped run has a stable, actionable message in the MCP response."""
    from superset_core.queries.types import QueryResult, QueryStatus

    from superset.mcp_service.sql_lab.tool.execute_sql import _convert_to_response

    response = _convert_to_response(
        QueryResult(
            status=QueryStatus.STOPPED,
            query_id=123,
            error_message=error_message,
        )
    )
    assert response.success is False
    assert response.query_id == 123
    assert response.error_type == "stopped"
    assert response.error == "Query was stopped"
