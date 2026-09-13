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
"""Tests for the AI assistant data access objects."""

from datetime import datetime
from typing import Any

from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

#: Two unrelated people. No ``ab_user`` rows exist on the in-memory engine, and
#: none are needed: ownership is an integer comparison, not a join.
USER_A = 1
USER_B = 2


def _create_tables(session: Session) -> None:
    """Create only the AI tables on the in-memory SQLite engine."""
    from superset.models.ai import AIChatFeedback, AIChatMessage, AIChatThread

    for model in (AIChatThread, AIChatMessage, AIChatFeedback):
        model.__table__.create(session.bind)


def _thread(session: Session, owner: int, **kwargs: Any) -> Any:
    from superset.models.ai import AIChatThread

    thread = AIChatThread(created_by_fk=owner, **kwargs)
    session.add(thread)
    session.flush()
    return thread


def test_find_by_uuid_for_user_returns_an_owned_thread(session: Session) -> None:
    """The owner sees their own conversation."""
    from superset.daos.ai import AIChatThreadDAO

    _create_tables(session)
    thread = _thread(session, USER_A, title="Revenue by region")

    found = AIChatThreadDAO.find_by_uuid_for_user(thread.uuid, USER_A)

    assert found is thread


def test_find_by_uuid_for_user_hides_another_users_thread(session: Session) -> None:
    """
    Holding the identifier is not enough.

    This is the whole point of the method: the ownership predicate is in the
    query, so an API handler that forgets to compare owners still cannot serve
    somebody else's conversation.
    """
    from superset.daos.ai import AIChatThreadDAO

    _create_tables(session)
    thread = _thread(session, USER_A, title="Revenue by region")

    assert AIChatThreadDAO.find_by_uuid_for_user(thread.uuid, USER_B) is None


def test_find_by_uuid_for_user_accepts_a_string_identifier(session: Session) -> None:
    """Identifiers arrive from URLs as strings."""
    from superset.daos.ai import AIChatThreadDAO

    _create_tables(session)
    thread = _thread(session, USER_A)

    assert AIChatThreadDAO.find_by_uuid_for_user(str(thread.uuid), USER_A) is thread


def test_find_by_uuid_for_user_treats_a_malformed_identifier_as_missing(
    session: Session,
) -> None:
    """A junk path segment is a client mistake, not a server fault."""
    from superset.daos.ai import AIChatThreadDAO

    _create_tables(session)
    _thread(session, USER_A)

    assert AIChatThreadDAO.find_by_uuid_for_user("not-a-uuid", USER_A) is None


def test_find_by_uuid_for_user_returns_nothing_without_a_user(
    session: Session,
) -> None:
    """An unauthenticated caller owns nothing, so the read fails closed."""
    from superset.daos.ai import AIChatThreadDAO

    _create_tables(session)
    thread = _thread(session, USER_A)

    assert AIChatThreadDAO.find_by_uuid_for_user(thread.uuid, None) is None


def test_find_all_for_user_lists_only_owned_threads_most_recent_first(
    session: Session,
) -> None:
    """A user's list is their own conversations, freshest at the top."""
    from superset.daos.ai import AIChatThreadDAO

    _create_tables(session)
    older = _thread(
        session, USER_A, title="older", changed_on=datetime(2024, 1, 1, 10, 0)
    )
    newer = _thread(
        session, USER_A, title="newer", changed_on=datetime(2024, 1, 2, 10, 0)
    )
    _thread(session, USER_B, title="theirs")

    assert AIChatThreadDAO.find_all_for_user(USER_A) == [newer, older]


def test_find_all_for_user_filters_by_status(session: Session) -> None:
    """Archived conversations can be listed apart from active ones."""
    from superset.ai.types import ThreadStatus
    from superset.daos.ai import AIChatThreadDAO

    _create_tables(session)
    active = _thread(session, USER_A, title="active")
    archived = _thread(
        session, USER_A, title="archived", status=ThreadStatus.ARCHIVED.value
    )

    assert AIChatThreadDAO.find_all_for_user(USER_A, status=ThreadStatus.ACTIVE) == [
        active
    ]
    assert AIChatThreadDAO.find_all_for_user(USER_A, status=ThreadStatus.ARCHIVED) == [
        archived
    ]


def test_delete_older_than_removes_the_whole_expired_conversation(
    session: Session,
) -> None:
    """Retention removes messages and feedback but preserves newer threads."""
    from superset.ai.types import MessageRole
    from superset.daos.ai import AIChatMessageDAO, AIChatThreadDAO
    from superset.models.ai import AIChatFeedback, AIChatMessage, AIChatThread

    _create_tables(session)
    old = AIChatThreadDAO.create_for_user(USER_A)
    message, _ = AIChatMessageDAO.create_idempotent(
        old, MessageRole.ASSISTANT, "old answer", user_id=USER_A
    )
    session.add(AIChatFeedback(message_id=message.id, liked=True, created_by_fk=USER_A))
    old.changed_on = datetime(2024, 1, 1)
    new = AIChatThreadDAO.create_for_user(USER_A)
    new.changed_on = datetime(2024, 2, 1)
    session.flush()

    assert AIChatThreadDAO.delete_older_than(datetime(2024, 1, 15)) == 1
    assert session.query(AIChatThread).count() == 1
    assert session.query(AIChatThread).one().id == new.id
    assert session.query(AIChatMessage).count() == 0
    assert session.query(AIChatFeedback).count() == 0


def test_prune_task_is_registered_in_the_default_daily_schedule() -> None:
    """The documented retention task is runnable without custom wiring."""
    from superset import config
    from superset.ai.tasks import prune_conversations

    assert prune_conversations.name == "ai.prune_conversations"
    entry = config.CeleryConfig.beat_schedule["ai.prune_conversations"]
    assert entry["task"] == "ai.prune_conversations"
    assert entry["schedule"].minute == {30}
    assert entry["schedule"].hour == {3}


def test_create_for_user_records_the_owner_and_assigns_an_identifier(
    session: Session,
) -> None:
    """
    Ownership is written, not inferred.

    The audit mixin's default reads the request context; passing the owner
    explicitly keeps a thread findable when there is no request.
    """
    from superset.ai.types import ThreadStatus
    from superset.daos.ai import AIChatThreadDAO

    _create_tables(session)

    thread = AIChatThreadDAO.create_for_user(USER_A, title="Q3", agent_key="default")

    assert thread.created_by_fk == USER_A
    assert thread.uuid is not None
    assert thread.status == ThreadStatus.ACTIVE
    assert AIChatThreadDAO.find_by_uuid_for_user(thread.uuid, USER_A) is thread


def test_find_for_thread_returns_messages_in_conversation_order(
    session: Session,
) -> None:
    """A transcript reads oldest first."""
    from superset.ai.types import MessageRole
    from superset.daos.ai import AIChatMessageDAO, AIChatThreadDAO

    _create_tables(session)
    thread = AIChatThreadDAO.create_for_user(USER_A)

    for index, role in enumerate([MessageRole.USER, MessageRole.ASSISTANT]):
        AIChatMessageDAO.create_idempotent(
            thread, role, f"turn {index}", user_id=USER_A
        )

    assert [m.content for m in AIChatMessageDAO.find_for_thread(thread)] == [
        "turn 0",
        "turn 1",
    ]


def test_pending_message_can_be_claimed_only_once(session: Session) -> None:
    """Concurrent stream consumers cannot both start the same inference."""
    from superset.ai.types import MessageRole, MessageStatus
    from superset.daos.ai import AIChatMessageDAO, AIChatThreadDAO

    _create_tables(session)
    thread = AIChatThreadDAO.create_for_user(USER_A)
    message, _ = AIChatMessageDAO.create_idempotent(
        thread,
        MessageRole.ASSISTANT,
        "",
        user_id=USER_A,
        status=MessageStatus.PENDING,
    )

    assert AIChatMessageDAO.claim_pending(message.uuid) is True
    assert AIChatMessageDAO.claim_pending(message.uuid) is False
    session.refresh(message)
    assert message.status == MessageStatus.STREAMING.value


def test_message_find_by_uuid_for_user_hides_another_users_message(
    session: Session,
) -> None:
    """Ownership of a turn is ownership of the conversation holding it."""
    from superset.ai.types import MessageRole
    from superset.daos.ai import AIChatMessageDAO, AIChatThreadDAO

    _create_tables(session)
    thread = AIChatThreadDAO.create_for_user(USER_A)
    message, _ = AIChatMessageDAO.create_idempotent(
        thread, MessageRole.ASSISTANT, "an answer", user_id=USER_A
    )

    assert AIChatMessageDAO.find_by_uuid_for_user(message.uuid, USER_A) is message
    assert AIChatMessageDAO.find_by_uuid_for_user(message.uuid, USER_B) is None


def test_create_idempotent_returns_the_stored_turn_on_replay(
    session: Session,
) -> None:
    """A retried request must not double the user's question."""
    from superset.ai.types import MessageRole
    from superset.daos.ai import AIChatMessageDAO, AIChatThreadDAO
    from superset.models.ai import AIChatMessage

    _create_tables(session)
    thread = AIChatThreadDAO.create_for_user(USER_A)

    first, created = AIChatMessageDAO.create_idempotent(
        thread, MessageRole.USER, "how many users?", user_id=USER_A, request_id="req-1"
    )
    assert created is True

    replay, created = AIChatMessageDAO.create_idempotent(
        thread, MessageRole.USER, "how many users?", user_id=USER_A, request_id="req-1"
    )

    assert created is False
    assert replay is first
    assert session.query(AIChatMessage).count() == 1


def test_create_idempotent_recovers_from_a_racing_insert(
    session: Session,
    mocker: MockerFixture,
) -> None:
    """
    A replay that races the original resolves to the row that won.

    The lookup is made to miss once, which is what a concurrent request sees
    before the other transaction commits. The insert then loses to the unique
    constraint, and the savepoint keeps the session usable so the stored turn
    can still be read and returned.
    """
    from superset.ai.types import MessageRole
    from superset.daos.ai import AIChatMessageDAO, AIChatThreadDAO
    from superset.models.ai import AIChatMessage

    _create_tables(session)
    thread = AIChatThreadDAO.create_for_user(USER_A)
    first, _ = AIChatMessageDAO.create_idempotent(
        thread, MessageRole.USER, "how many users?", user_id=USER_A, request_id="req-1"
    )

    lookup = AIChatMessageDAO.find_by_request_id
    misses = {"remaining": 1}

    def lookup_missing_once(*args: Any, **kwargs: Any) -> Any:
        if misses["remaining"]:
            misses["remaining"] -= 1
            return None
        return lookup(*args, **kwargs)

    mocker.patch.object(
        AIChatMessageDAO,
        "find_by_request_id",
        side_effect=lookup_missing_once,
    )

    replay, created = AIChatMessageDAO.create_idempotent(
        thread, MessageRole.USER, "how many users?", user_id=USER_A, request_id="req-1"
    )

    assert created is False
    assert replay.id == first.id
    assert session.query(AIChatMessage).count() == 1
    # The session survived the rejected insert and can still be written to.
    AIChatMessageDAO.create_idempotent(
        thread, MessageRole.ASSISTANT, "42", user_id=USER_A
    )
    assert session.query(AIChatMessage).count() == 2


def test_create_idempotent_without_a_key_appends_every_time(
    session: Session,
) -> None:
    """Server-authored turns carry no client key and are not deduplicated."""
    from superset.ai.types import MessageRole
    from superset.daos.ai import AIChatMessageDAO, AIChatThreadDAO
    from superset.models.ai import AIChatMessage

    _create_tables(session)
    thread = AIChatThreadDAO.create_for_user(USER_A)

    for _ in range(2):
        AIChatMessageDAO.create_idempotent(
            thread, MessageRole.SYSTEM, "context", user_id=USER_A
        )

    assert session.query(AIChatMessage).count() == 2


def test_create_idempotent_records_activity_on_the_thread(
    session: Session,
) -> None:
    """
    Appending a turn moves the thread up its owner's list.

    Only the message row is written otherwise, so without this the list would
    be ordered by when conversations were opened.
    """
    from superset.ai.types import MessageRole
    from superset.daos.ai import AIChatMessageDAO, AIChatThreadDAO

    _create_tables(session)
    thread = AIChatThreadDAO.create_for_user(USER_A)
    thread.changed_on = datetime(2024, 1, 1, 10, 0)
    session.flush()

    AIChatMessageDAO.create_idempotent(
        thread, MessageRole.USER, "hello", user_id=USER_A
    )

    assert thread.changed_on > datetime(2024, 1, 1, 10, 0)


def test_feedback_upsert_revises_a_verdict_in_place(session: Session) -> None:
    """A changed mind is an update; a second row would double-count."""
    from superset.ai.types import MessageRole
    from superset.daos.ai import AIChatFeedbackDAO, AIChatMessageDAO, AIChatThreadDAO
    from superset.models.ai import AIChatFeedback

    _create_tables(session)
    thread = AIChatThreadDAO.create_for_user(USER_A)
    message, _ = AIChatMessageDAO.create_idempotent(
        thread, MessageRole.ASSISTANT, "42", user_id=USER_A
    )

    first, created = AIChatFeedbackDAO.upsert(message, USER_A, liked=True)
    assert created is True

    revised, created = AIChatFeedbackDAO.upsert(
        message, USER_A, liked=False, comment="wrong period"
    )

    assert created is False
    assert revised is first
    assert revised.liked is False
    assert revised.comment == "wrong period"
    assert session.query(AIChatFeedback).count() == 1


def test_feedback_upsert_keeps_verdicts_per_user(session: Session) -> None:
    """One row per user per message, so two users can disagree."""
    from superset.ai.types import MessageRole
    from superset.daos.ai import AIChatFeedbackDAO, AIChatMessageDAO, AIChatThreadDAO
    from superset.models.ai import AIChatFeedback

    _create_tables(session)
    thread = AIChatThreadDAO.create_for_user(USER_A)
    message, _ = AIChatMessageDAO.create_idempotent(
        thread, MessageRole.ASSISTANT, "42", user_id=USER_A
    )

    AIChatFeedbackDAO.upsert(message, USER_A, liked=True)
    AIChatFeedbackDAO.upsert(message, USER_B, liked=False)

    assert session.query(AIChatFeedback).count() == 2
    theirs = AIChatFeedbackDAO.find_for_message_and_user(message.id, USER_B)
    assert theirs is not None
    assert theirs.liked is False


def test_find_verdicts_for_user_reads_a_whole_transcript_at_once(
    session: Session,
) -> None:
    """
    The panel needs every rating on screen, so they are fetched together.

    This is what lets a thumb that was pressed before a reload still show as
    pressed; without it the reply looks unrated and is offered for voting again.
    """
    from superset.ai.types import MessageRole
    from superset.daos.ai import (
        AIChatFeedbackDAO,
        AIChatMessageDAO,
        AIChatThreadDAO,
    )

    _create_tables(session)
    thread = AIChatThreadDAO.create_for_user(USER_A)
    liked, _ = AIChatMessageDAO.create_idempotent(
        thread, MessageRole.ASSISTANT, "good answer", user_id=USER_A
    )
    disliked, _ = AIChatMessageDAO.create_idempotent(
        thread, MessageRole.ASSISTANT, "bad answer", user_id=USER_A
    )
    unrated, _ = AIChatMessageDAO.create_idempotent(
        thread, MessageRole.ASSISTANT, "no verdict", user_id=USER_A
    )

    AIChatFeedbackDAO.upsert(liked, USER_A, liked=True)
    AIChatFeedbackDAO.upsert(disliked, USER_A, liked=False)
    session.flush()

    verdicts = AIChatFeedbackDAO.find_verdicts_for_user(
        [liked.id, disliked.id, unrated.id], USER_A
    )

    # An unrated message is absent rather than False: the panel has to tell "no
    # verdict" from "thumbs down", and collapsing the two would render every
    # unrated reply as disliked.
    assert verdicts == {liked.id: True, disliked.id: False}


def test_find_verdicts_for_user_does_not_leak_another_users_verdict(
    session: Session,
) -> None:
    """A shared conversation does not disclose who thought what."""
    from superset.ai.types import MessageRole
    from superset.daos.ai import (
        AIChatFeedbackDAO,
        AIChatMessageDAO,
        AIChatThreadDAO,
    )

    _create_tables(session)
    thread = AIChatThreadDAO.create_for_user(USER_A)
    message, _ = AIChatMessageDAO.create_idempotent(
        thread, MessageRole.ASSISTANT, "an answer", user_id=USER_A
    )
    AIChatFeedbackDAO.upsert(message, USER_B, liked=True)
    session.flush()

    assert AIChatFeedbackDAO.find_verdicts_for_user([message.id], USER_A) == {}
    assert AIChatFeedbackDAO.find_verdicts_for_user([message.id], USER_B) == {
        message.id: True
    }


def test_find_verdicts_for_user_short_circuits_on_nothing_to_look_up(
    session: Session,
) -> None:
    """An anonymous reader or an empty transcript costs no query."""
    from superset.daos.ai import AIChatFeedbackDAO

    _create_tables(session)
    assert AIChatFeedbackDAO.find_verdicts_for_user([], USER_A) == {}
    assert AIChatFeedbackDAO.find_verdicts_for_user([1, 2], None) == {}
