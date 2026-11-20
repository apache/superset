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
"""Tests for the AI assistant commands."""

from typing import Any

import pytest
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


def _open_thread(owner: int = USER_A, title: str | None = None) -> Any:
    from superset.commands.ai.thread import CreateAIChatThreadCommand

    return CreateAIChatThreadCommand(owner, title=title).run()


def test_create_thread_records_the_owner(session: Session) -> None:
    """A new conversation belongs to the user who opened it."""
    from superset.ai.types import ThreadStatus

    _create_tables(session)

    thread = _open_thread(title="  Revenue by region  ")

    assert thread.created_by_fk == USER_A
    assert thread.status == ThreadStatus.ACTIVE
    # Surrounding whitespace is not part of what the user meant to type.
    assert thread.title == "Revenue by region"


@pytest.mark.parametrize("title", ["", "   "])
def test_create_thread_rejects_a_blank_title(session: Session, title: str) -> None:
    """A title of nothing is a client bug, not a request to clear the label."""
    from superset.commands.ai.exceptions import AIChatThreadInvalidError

    _create_tables(session)

    with pytest.raises(AIChatThreadInvalidError):
        _open_thread(title=title)


def test_create_thread_rejects_a_title_the_column_cannot_hold(
    session: Session,
) -> None:
    """
    An over-long title is refused rather than truncated.

    Storing something other than what the user typed is worse than saying no.
    """
    from superset.commands.ai.exceptions import AIChatThreadInvalidError
    from superset.commands.ai.thread import TITLE_MAX_LENGTH

    _create_tables(session)

    with pytest.raises(AIChatThreadInvalidError):
        _open_thread(title="x" * (TITLE_MAX_LENGTH + 1))


def test_update_thread_renames(session: Session) -> None:
    """The owner can relabel their conversation."""
    from superset.commands.ai.thread import UpdateAIChatThreadCommand

    _create_tables(session)
    thread = _open_thread(title="Untitled")

    updated = UpdateAIChatThreadCommand(
        thread.uuid, USER_A, title="Revenue by region"
    ).run()

    assert updated.title == "Revenue by region"


def test_update_thread_archives(session: Session) -> None:
    """Archiving does not require restating the title."""
    from superset.ai.types import ThreadStatus
    from superset.commands.ai.thread import UpdateAIChatThreadCommand

    _create_tables(session)
    thread = _open_thread(title="Revenue by region")

    updated = UpdateAIChatThreadCommand(
        thread.uuid, USER_A, status=ThreadStatus.ARCHIVED
    ).run()

    assert updated.status == ThreadStatus.ARCHIVED
    assert updated.title == "Revenue by region"


def test_update_thread_rejects_an_unknown_status(session: Session) -> None:
    """
    An undefined lifecycle value is a bad request, not a server fault.

    The model's validator would also refuse it, but as a ``ValueError`` the API
    layer would report as a 500.
    """
    from superset.commands.ai.exceptions import AIChatThreadInvalidError
    from superset.commands.ai.thread import UpdateAIChatThreadCommand

    _create_tables(session)
    thread = _open_thread()

    with pytest.raises(AIChatThreadInvalidError):
        UpdateAIChatThreadCommand(thread.uuid, USER_A, status="deleted").run()


def test_update_thread_rejects_a_title_the_column_cannot_hold(
    session: Session,
) -> None:
    """The rename path checks the same bound as the create path."""
    from superset.commands.ai.exceptions import AIChatThreadInvalidError
    from superset.commands.ai.thread import TITLE_MAX_LENGTH, UpdateAIChatThreadCommand

    _create_tables(session)
    thread = _open_thread()

    with pytest.raises(AIChatThreadInvalidError):
        UpdateAIChatThreadCommand(
            thread.uuid, USER_A, title="x" * (TITLE_MAX_LENGTH + 1)
        ).run()


def test_delete_thread_takes_its_messages_with_it(session: Session) -> None:
    """No transcript outlives the conversation its owner deleted."""
    from superset.commands.ai.append_message import AppendAIChatMessageCommand
    from superset.commands.ai.thread import DeleteAIChatThreadCommand
    from superset.models.ai import AIChatMessage, AIChatThread

    _create_tables(session)
    thread = _open_thread()
    AppendAIChatMessageCommand(thread.uuid, USER_A, "user", "how many users?").run()
    AppendAIChatMessageCommand(thread.uuid, USER_A, "assistant", "42").run()
    assert session.query(AIChatMessage).count() == 2

    DeleteAIChatThreadCommand(thread.uuid, USER_A).run()

    assert session.query(AIChatThread).count() == 0
    assert session.query(AIChatMessage).count() == 0


def test_another_user_can_neither_read_rename_delete_nor_append(
    session: Session,
) -> None:
    """
    A conversation is private to its owner.

    Every entry point reports *not found* rather than *forbidden*: a 403 would
    confirm that the identifier names a real conversation, which is itself
    something the owner did not share.
    """
    from superset.commands.ai.append_message import AppendAIChatMessageCommand
    from superset.commands.ai.exceptions import AIChatThreadNotFoundError
    from superset.commands.ai.thread import (
        DeleteAIChatThreadCommand,
        UpdateAIChatThreadCommand,
    )
    from superset.daos.ai import AIChatMessageDAO, AIChatThreadDAO
    from superset.models.ai import AIChatMessage, AIChatThread

    _create_tables(session)
    thread = _open_thread(owner=USER_A, title="Revenue by region")
    AppendAIChatMessageCommand(thread.uuid, USER_A, "user", "how many users?").run()

    # Read.
    assert AIChatThreadDAO.find_by_uuid_for_user(thread.uuid, USER_B) is None
    assert AIChatThreadDAO.find_all_for_user(USER_B) == []
    message_uuid = thread.messages[0].uuid
    assert AIChatMessageDAO.find_by_uuid_for_user(message_uuid, USER_B) is None

    # Rename.
    with pytest.raises(AIChatThreadNotFoundError):
        UpdateAIChatThreadCommand(thread.uuid, USER_B, title="mine now").run()

    # Delete.
    with pytest.raises(AIChatThreadNotFoundError):
        DeleteAIChatThreadCommand(thread.uuid, USER_B).run()

    # Append.
    with pytest.raises(AIChatThreadNotFoundError):
        AppendAIChatMessageCommand(thread.uuid, USER_B, "user", "and mine?").run()

    # Nothing the intruder did touched the conversation.
    assert session.query(AIChatThread).count() == 1
    assert session.query(AIChatMessage).count() == 1
    stored = AIChatThreadDAO.find_by_uuid_for_user(thread.uuid, USER_A)
    assert stored is not None
    assert stored.title == "Revenue by region"


def test_append_message_is_idempotent_on_a_replayed_request(
    session: Session,
) -> None:
    """
    A retried request returns the turn the first attempt stored.

    The client's key is the promise; honouring it is what keeps a flaky network
    from asking the assistant the same question twice.
    """
    from superset.commands.ai.append_message import AppendAIChatMessageCommand
    from superset.models.ai import AIChatMessage

    _create_tables(session)
    thread = _open_thread()

    first_command = AppendAIChatMessageCommand(
        thread.uuid, USER_A, "user", "how many users?", request_id="req-1"
    )
    first = first_command.run()
    assert first_command.created is True

    replay_command = AppendAIChatMessageCommand(
        thread.uuid, USER_A, "user", "how many users?", request_id="req-1"
    )
    replay = replay_command.run()

    assert replay_command.created is False
    assert replay.id == first.id
    assert session.query(AIChatMessage).count() == 1


def test_append_message_deduplicates_per_role_and_thread(session: Session) -> None:
    """
    One turn legitimately stores a question and an answer under one key.

    A second conversation may reuse the key too; only the same key, thread and
    role together identify a replay.
    """
    from superset.commands.ai.append_message import AppendAIChatMessageCommand
    from superset.models.ai import AIChatMessage

    _create_tables(session)
    first_thread = _open_thread()
    second_thread = _open_thread()

    for thread in (first_thread, second_thread):
        for role in ("user", "assistant"):
            AppendAIChatMessageCommand(
                thread.uuid, USER_A, role, "text", request_id="req-1"
            ).run()

    assert session.query(AIChatMessage).count() == 4


def test_append_message_rejects_an_unknown_role(session: Session) -> None:
    """Roles are constrained to the documented vocabulary."""
    from superset.commands.ai.append_message import AppendAIChatMessageCommand
    from superset.commands.ai.exceptions import AIChatMessageInvalidError

    _create_tables(session)
    thread = _open_thread()

    with pytest.raises(AIChatMessageInvalidError):
        AppendAIChatMessageCommand(thread.uuid, USER_A, "root", "hi").run()


def test_append_message_rejects_an_over_long_request_id(session: Session) -> None:
    """
    A key the column would truncate is refused.

    Truncation would silently break the idempotency the client is relying on.
    """
    from superset.commands.ai.append_message import (
        AppendAIChatMessageCommand,
        REQUEST_ID_MAX_LENGTH,
    )
    from superset.commands.ai.exceptions import AIChatMessageInvalidError

    _create_tables(session)
    thread = _open_thread()

    with pytest.raises(AIChatMessageInvalidError):
        AppendAIChatMessageCommand(
            thread.uuid,
            USER_A,
            "user",
            "hi",
            request_id="x" * (REQUEST_ID_MAX_LENGTH + 1),
        ).run()


def test_append_message_accepts_an_empty_assistant_turn(session: Session) -> None:
    """
    An assistant row is opened before inference produces anything.

    A client that reconnects mid-run needs a row to attach to.
    """
    from superset.ai.types import MessageStatus
    from superset.commands.ai.append_message import AppendAIChatMessageCommand

    _create_tables(session)
    thread = _open_thread()

    message = AppendAIChatMessageCommand(
        thread.uuid,
        USER_A,
        "assistant",
        "",
        status=MessageStatus.PENDING,
    ).run()

    assert message.content == ""
    assert message.status == MessageStatus.PENDING
    assert message.is_terminal is False


def test_submit_feedback_records_then_revises_a_verdict(session: Session) -> None:
    """Submitting again revises the earlier verdict rather than adding one."""
    from superset.commands.ai.append_message import AppendAIChatMessageCommand
    from superset.commands.ai.submit_feedback import SubmitAIChatFeedbackCommand
    from superset.models.ai import AIChatFeedback

    _create_tables(session)
    thread = _open_thread()
    message = AppendAIChatMessageCommand(thread.uuid, USER_A, "assistant", "42").run()

    first_command = SubmitAIChatFeedbackCommand(message.uuid, USER_A, liked=True)
    first = first_command.run()
    assert first_command.created is True

    revision_command = SubmitAIChatFeedbackCommand(
        message.uuid, USER_A, liked=False, comment="wrong period"
    )
    revision = revision_command.run()

    assert revision_command.created is False
    assert revision.id == first.id
    assert revision.liked is False
    assert revision.comment == "wrong period"
    assert session.query(AIChatFeedback).count() == 1


def test_submit_feedback_rejects_a_turn_the_assistant_did_not_write(
    session: Session,
) -> None:
    """Rating one's own question carries no signal worth aggregating."""
    from superset.commands.ai.append_message import AppendAIChatMessageCommand
    from superset.commands.ai.exceptions import AIChatFeedbackInvalidError
    from superset.commands.ai.submit_feedback import SubmitAIChatFeedbackCommand

    _create_tables(session)
    thread = _open_thread()
    message = AppendAIChatMessageCommand(
        thread.uuid, USER_A, "user", "how many users?"
    ).run()

    with pytest.raises(AIChatFeedbackInvalidError):
        SubmitAIChatFeedbackCommand(message.uuid, USER_A, liked=True).run()


def test_another_user_cannot_rate_a_message(session: Session) -> None:
    """Reaching a message means owning the conversation that holds it."""
    from superset.commands.ai.append_message import AppendAIChatMessageCommand
    from superset.commands.ai.exceptions import AIChatMessageNotFoundError
    from superset.commands.ai.submit_feedback import SubmitAIChatFeedbackCommand

    _create_tables(session)
    thread = _open_thread(owner=USER_A)
    message = AppendAIChatMessageCommand(thread.uuid, USER_A, "assistant", "42").run()

    with pytest.raises(AIChatMessageNotFoundError):
        SubmitAIChatFeedbackCommand(message.uuid, USER_B, liked=True).run()
