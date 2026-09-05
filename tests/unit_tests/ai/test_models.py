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
"""Tests for the AI assistant conversation models."""

from typing import Any

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm.session import Session


def _create_tables(session: Session) -> None:
    """Create only the AI tables on the in-memory SQLite engine."""
    from superset.models.ai import AIChatFeedback, AIChatMessage, AIChatThread

    for model in (AIChatThread, AIChatMessage, AIChatFeedback):
        model.__table__.create(session.bind)


def _thread(**kwargs: Any) -> Any:
    from superset.models.ai import AIChatThread

    return AIChatThread(**kwargs)


def test_thread_defaults(session: Session) -> None:
    """A new thread gets a uuid and starts active."""
    from superset.ai.types import ThreadStatus

    _create_tables(session)

    thread = _thread(title="Revenue by region")
    session.add(thread)
    session.flush()

    assert thread.uuid is not None
    assert thread.status == ThreadStatus.ACTIVE
    assert thread.message_count == 0
    assert thread.extra == {}


def test_thread_rejects_unknown_status(session: Session) -> None:
    """An unknown lifecycle value fails fast at assignment, not at flush."""
    _create_tables(session)

    with pytest.raises(ValueError, match="not-a-status"):
        _thread(title="t", status="not-a-status")


def test_message_rejects_unknown_role(session: Session) -> None:
    """Roles are constrained to the documented vocabulary."""
    from superset.models.ai import AIChatMessage

    _create_tables(session)

    with pytest.raises(ValueError, match="root"):
        AIChatMessage(role="root", content="hi")


def test_message_roundtrip_and_ordering(session: Session) -> None:
    """Messages come back attached to the thread in creation order."""
    from superset.ai.types import MessageRole
    from superset.models.ai import AIChatMessage

    _create_tables(session)

    thread = _thread(title="Q3")
    session.add(thread)
    session.flush()

    for index, role in enumerate(
        [MessageRole.USER, MessageRole.ASSISTANT, MessageRole.USER]
    ):
        session.add(
            AIChatMessage(
                thread_id=thread.id,
                role=role.value,
                content=f"message {index}",
            )
        )
    session.flush()
    session.refresh(thread)

    assert thread.message_count == 3
    assert [m.content for m in thread.messages] == [
        "message 0",
        "message 1",
        "message 2",
    ]


def test_message_extra_json_merges(session: Session) -> None:
    """
    ``update_extra`` merges rather than replaces.

    A run writes tool calls and token usage at different points, so a
    replacing writer would silently drop whichever landed first.
    """
    from superset.models.ai import AIChatMessage

    _create_tables(session)

    thread = _thread()
    session.add(thread)
    session.flush()

    message = AIChatMessage(thread_id=thread.id, role="assistant", content="")
    message.update_extra({"model": "test-model"})
    message.update_extra({"usage": {"input_tokens": 10, "output_tokens": 3}})

    assert message.extra["model"] == "test-model"
    assert message.extra["usage"]["input_tokens"] == 10
    assert message.extra["version"] == 1


def test_message_extra_json_tolerates_corruption(session: Session) -> None:
    """A malformed blob degrades to empty rather than failing the request."""
    from superset.models.ai import AIChatMessage

    _create_tables(session)

    message = AIChatMessage(role="assistant", content="")
    message.extra_json = "{not json"
    assert message.extra == {}

    # A valid JSON scalar is still not an object.
    message.extra_json = "42"
    assert message.extra == {}


def test_request_id_idempotency_is_enforced_by_the_database(
    session: Session,
) -> None:
    """
    A replayed turn cannot create a duplicate row.

    This is the constraint the upstream implementation lacked: it put a
    timestamp in the storage key, so a retry a millisecond later produced a
    second copy of the same user message.
    """
    from superset.models.ai import AIChatMessage

    _create_tables(session)

    thread = _thread()
    session.add(thread)
    session.flush()

    session.add(
        AIChatMessage(
            thread_id=thread.id,
            role="user",
            content="first",
            request_id="req-1",
        )
    )
    session.flush()

    session.add(
        AIChatMessage(
            thread_id=thread.id,
            role="user",
            content="replayed",
            request_id="req-1",
        )
    )
    with pytest.raises(IntegrityError):
        session.flush()


def test_request_id_scoped_per_role_and_thread(session: Session) -> None:
    """
    The same request id may appear once per role and once per thread.

    A single turn legitimately stores a user row and an assistant row that
    share the client's request id.
    """
    from superset.models.ai import AIChatMessage

    _create_tables(session)

    first = _thread()
    second = _thread()
    session.add_all([first, second])
    session.flush()

    session.add_all(
        [
            AIChatMessage(
                thread_id=first.id, role="user", content="q", request_id="req-1"
            ),
            AIChatMessage(
                thread_id=first.id,
                role="assistant",
                content="a",
                request_id="req-1",
            ),
            AIChatMessage(
                thread_id=second.id, role="user", content="q", request_id="req-1"
            ),
        ]
    )
    session.flush()

    assert session.query(AIChatMessage).count() == 3


def test_null_request_ids_do_not_collide(session: Session) -> None:
    """
    Messages without a request id are unconstrained.

    System messages and server-authored turns carry no client key, and SQL
    treats NULLs as distinct, so many may coexist.
    """
    from superset.models.ai import AIChatMessage

    _create_tables(session)

    thread = _thread()
    session.add(thread)
    session.flush()

    session.add_all(
        [
            AIChatMessage(thread_id=thread.id, role="system", content="ctx a"),
            AIChatMessage(thread_id=thread.id, role="system", content="ctx b"),
        ]
    )
    session.flush()

    assert session.query(AIChatMessage).count() == 2


def test_message_is_terminal(session: Session) -> None:
    """Terminal statuses are reported as such; in-flight ones are not."""
    from superset.ai.types import MessageStatus
    from superset.models.ai import AIChatMessage

    _create_tables(session)

    message = AIChatMessage(role="assistant", content="")
    for status in (MessageStatus.PENDING, MessageStatus.STREAMING):
        message.status = status.value
        assert message.is_terminal is False

    for status in (
        MessageStatus.COMPLETE,
        MessageStatus.ERROR,
        MessageStatus.CANCELLED,
    ):
        message.status = status.value
        assert message.is_terminal is True


def test_deleting_a_thread_removes_its_messages(session: Session) -> None:
    """Conversations are deleted whole; no orphan messages are left behind."""
    from superset.models.ai import AIChatMessage

    _create_tables(session)

    thread = _thread()
    session.add(thread)
    session.flush()
    session.add(AIChatMessage(thread_id=thread.id, role="user", content="hi"))
    session.flush()

    session.delete(thread)
    session.flush()

    assert session.query(AIChatMessage).count() == 0


def test_feedback_is_one_verdict_per_user_per_message(session: Session) -> None:
    """A user cannot register two verdicts on the same message."""
    from superset.models.ai import AIChatFeedback, AIChatMessage

    _create_tables(session)

    thread = _thread()
    session.add(thread)
    session.flush()
    message = AIChatMessage(thread_id=thread.id, role="assistant", content="a")
    session.add(message)
    session.flush()

    session.add(AIChatFeedback(message_id=message.id, liked=True, created_by_fk=1))
    session.flush()

    session.add(AIChatFeedback(message_id=message.id, liked=False, created_by_fk=1))
    with pytest.raises(IntegrityError):
        session.flush()
