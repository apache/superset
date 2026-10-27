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
"""API response contracts for AI commands."""

from typing import Any

import pytest
from flask.testing import FlaskClient
from pytest_mock import MockerFixture
from sqlalchemy import event
from sqlalchemy.orm import Session

pytestmark = [
    pytest.mark.parametrize(
        "app", [{"FEATURE_FLAGS": {"AI_ASSISTANT": True}}], indirect=True
    ),
    pytest.mark.usefixtures("full_api_access"),
]


@pytest.fixture
def conversations(session: Session, mocker: MockerFixture) -> None:
    from superset.models.ai import AIChatFeedback, AIChatMessage, AIChatThread

    for model in (AIChatThread, AIChatMessage, AIChatFeedback):
        model.__table__.create(session.bind)
    mocker.patch("superset.ai.api.AIRestApi._reject_if_unconfigured", return_value=None)
    mocker.patch("superset.ai.api.AIRestApi._user_id", return_value=1)
    mocker.patch("superset.utils.log.DBEventLogger.log")
    for owner, title, count in (
        (1, "older", 2),
        (1, "empty", 0),
        (1, "newer", 3),
        (2, "foreign", 5),
    ):
        thread = AIChatThread(created_by_fk=owner, title=title)
        thread.messages = [
            AIChatMessage(role="user", content="question") for _ in range(count)
        ]
        session.add(thread)
    session.commit()
    session.expire_all()


@pytest.mark.usefixtures("conversations")
@pytest.mark.parametrize(
    "query",
    [
        "limit=-1",
        "limit=0",
        "limit=101",
        "limit=1.5",
        "limit=bad",
        "limit=",
        "offset=-1",
        "offset=1.5",
        "offset=bad",
        "offset=9223372036854775808",
    ],
)
def test_invalid_pagination_returns_422(client: FlaskClient, query: str) -> None:
    response = client.get(f"/api/v1/ai/thread/?{query}")
    assert response.status_code == 422


@pytest.mark.usefixtures("conversations")
@pytest.mark.parametrize(
    "query,titles,counts",
    [
        ("", ["newer", "empty", "older"], [3, 0, 2]),
        ("?limit=1&offset=1", ["empty"], [0]),
        ("?offset=3", [], []),
    ],
)
def test_thread_page_uses_aggregate_counts(
    client: FlaskClient,
    session: Session,
    query: str,
    titles: list[str],
    counts: list[int],
) -> None:
    statements: list[str] = []

    def record(
        _conn: Any,
        _cursor: Any,
        statement: str,
        _params: Any,
        _context: Any,
        _many: bool,
    ) -> None:
        if statement.lstrip().upper().startswith("SELECT") and "ai_chat_" in statement:
            statements.append(statement)

    event.listen(session.bind, "before_cursor_execute", record)
    try:
        response = client.get(f"/api/v1/ai/thread/{query}")
    finally:
        event.remove(session.bind, "before_cursor_execute", record)

    assert response.status_code == 200
    rows = response.json["result"]
    assert [row["title"] for row in rows] == titles
    assert [row["message_count"] for row in rows] == counts
    assert response.json["count"] == len(titles)
    assert len(statements) == (2 if titles else 1)
    assert all("ai_chat_message.content" not in sql for sql in statements)
