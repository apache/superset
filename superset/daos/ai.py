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
Data access for AI assistant conversations.

Every read takes the owning user identifier as an argument instead of
resolving it from the request context. Making ownership a parameter means a
caller cannot omit it by accident, and the scope of a query is visible at its
call site rather than buried in a filter that runs elsewhere.

A conversation holds the questions its author asked about their data, so
ownership here is not overridable by role.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from superset.ai.types import MessageRole, MessageStatus, ThreadStatus
from superset.daos.base import BaseDAO
from superset.extensions import db
from superset.models.ai import AIChatFeedback, AIChatMessage, AIChatThread

logger = logging.getLogger(__name__)


def _coerce_uuid(value: str | UUID) -> UUID | None:
    """
    Parse a caller-supplied identifier.

    These values arrive from URLs, so a malformed one is an ordinary client
    mistake and resolves to "no such row" rather than an exception the API
    layer would have to translate out of a 500.
    """
    if isinstance(value, UUID):
        return value
    try:
        return UUID(str(value))
    except (AttributeError, TypeError, ValueError):
        return None


class AIChatThreadDAO(BaseDAO[AIChatThread]):
    """
    Owner-scoped access to conversation threads.

    The inherited unscoped finders are deliberately unused by this feature:
    reach for the ``*_for_user`` methods, whose required ``user_id`` argument
    makes an unscoped read a type error rather than an oversight.
    """

    @classmethod
    def find_by_uuid_for_user(
        cls,
        thread_uuid: str | UUID,
        user_id: int | None,
    ) -> AIChatThread | None:
        """
        Return the thread only when ``user_id`` owns it.

        A thread identifier is not a capability. The ownership predicate is
        part of the query rather than a follow-up check, so a caller that
        forgets to compare owners still cannot read another user's
        conversation.

        :param thread_uuid: The public identifier of the thread
        :param user_id: The user the thread must belong to
        :returns: The thread, or ``None`` when it is missing or owned by
            somebody else
        """
        parsed = _coerce_uuid(thread_uuid)
        if parsed is None or user_id is None:
            return None

        return (
            db.session.query(AIChatThread)
            .filter(
                AIChatThread.uuid == parsed,
                AIChatThread.created_by_fk == user_id,
            )
            .one_or_none()
        )

    @classmethod
    def find_all_for_user(
        cls,
        user_id: int | None,
        *,
        status: ThreadStatus | str | None = None,
        limit: int | None = None,
        offset: int = 0,
    ) -> list[AIChatThread]:
        """
        List a user's threads, most recently active first.

        :param user_id: The owner whose threads to return
        :param status: Optional lifecycle filter
        :param limit: Maximum number of threads to return
        :param offset: Number of threads to skip
        :returns: The matching threads
        """
        if user_id is None:
            return []

        query = db.session.query(AIChatThread).filter(
            AIChatThread.created_by_fk == user_id
        )
        if status is not None:
            query = query.filter(AIChatThread.status == str(status))
        query = query.order_by(
            AIChatThread.changed_on.desc(),
            # Tie-break on the primary key: threads written within the same
            # clock tick would otherwise come back in an arbitrary order, and a
            # paged list would drop or repeat rows.
            AIChatThread.id.desc(),
        )
        if offset:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
        return query.all()

    @classmethod
    def create_for_user(
        cls,
        user_id: int,
        *,
        title: str | None = None,
        agent_key: str | None = None,
    ) -> AIChatThread:
        """
        Insert a thread owned by ``user_id``.

        ``created_by_fk`` is written explicitly rather than left to the audit
        mixin's default, which reads the request context: a thread opened on a
        user's behalf outside a request would otherwise be attributed to
        nobody, leaving a row no owner-scoped read can return.

        :param user_id: The owner of the new thread
        :param title: Optional human-readable label
        :param agent_key: Optional agent profile the thread runs with
        :returns: The persisted thread
        """
        thread: AIChatThread = cls.create(
            attributes={
                "title": title,
                "agent_key": agent_key,
                "status": ThreadStatus.ACTIVE.value,
                "created_by_fk": user_id,
                "changed_by_fk": user_id,
            }
        )
        # Flush so the server-assigned id and the client-visible uuid exist
        # before the caller serialises the thread.
        db.session.flush()
        return thread

    @classmethod
    def touch(cls, thread: AIChatThread, *, user_id: int | None = None) -> None:
        """
        Record activity against a thread.

        Threads are listed most recently active first, and appending a message
        writes only the message row, so without this a thread would sort by
        when it was opened rather than when it was last used.

        :param thread: The thread that saw activity
        :param user_id: The user responsible for the activity
        """
        thread.changed_on = datetime.now()
        if user_id is not None:
            thread.changed_by_fk = user_id
        db.session.add(thread)

    @classmethod
    def delete_older_than(cls, cutoff: datetime) -> int:
        """Delete conversations last changed before ``cutoff`` and their rows."""
        thread_ids = select(AIChatThread.id).where(AIChatThread.changed_on < cutoff)
        message_ids = select(AIChatMessage.id).where(
            AIChatMessage.thread_id.in_(thread_ids)
        )
        db.session.query(AIChatFeedback).filter(
            AIChatFeedback.message_id.in_(message_ids)
        ).delete(synchronize_session=False)
        db.session.query(AIChatMessage).filter(
            AIChatMessage.thread_id.in_(thread_ids)
        ).delete(synchronize_session=False)
        return (
            db.session.query(AIChatThread)
            .filter(AIChatThread.changed_on < cutoff)
            .delete(synchronize_session=False)
        )


class AIChatMessageDAO(BaseDAO[AIChatMessage]):
    """
    Access to the turns of a conversation.

    Reads that start from a thread take the thread *instance*, not its integer
    id: the only way to hold one is to have fetched it through
    :meth:`AIChatThreadDAO.find_by_uuid_for_user`, so the argument type carries
    the proof that ownership was established.
    """

    @classmethod
    def find_for_thread(cls, thread: AIChatThread) -> list[AIChatMessage]:
        """
        Return a thread's messages in conversation order.

        :param thread: The owning thread
        :returns: The thread's messages, oldest first
        """
        return (
            db.session.query(AIChatMessage)
            .filter(AIChatMessage.thread_id == thread.id)
            .order_by(AIChatMessage.created_on.asc(), AIChatMessage.id.asc())
            .all()
        )

    @classmethod
    def claim_pending(cls, message_uuid: str | UUID) -> bool:
        """Atomically move one pending assistant message into execution."""
        parsed = _coerce_uuid(message_uuid)
        if parsed is None:
            return False
        return (
            db.session.query(AIChatMessage)
            .filter(
                AIChatMessage.uuid == parsed,
                AIChatMessage.status == MessageStatus.PENDING.value,
            )
            .update(
                {AIChatMessage.status: MessageStatus.STREAMING.value},
                synchronize_session=False,
            )
            == 1
        )

    @classmethod
    def find_by_uuid_for_user(
        cls,
        message_uuid: str | UUID,
        user_id: int | None,
    ) -> AIChatMessage | None:
        """
        Return a message only when ``user_id`` owns its thread.

        Ownership lives on the thread, so the join is the authorisation check.
        A message's own ``created_by_fk`` is not consulted, because assistant
        and system turns have no author.

        :param message_uuid: The public identifier of the message
        :param user_id: The user who must own the containing thread
        :returns: The message, or ``None`` when it is missing or belongs to
            somebody else's conversation
        """
        parsed = _coerce_uuid(message_uuid)
        if parsed is None or user_id is None:
            return None

        return (
            db.session.query(AIChatMessage)
            .join(AIChatThread, AIChatMessage.thread_id == AIChatThread.id)
            .filter(
                AIChatMessage.uuid == parsed,
                AIChatThread.created_by_fk == user_id,
            )
            .one_or_none()
        )

    @classmethod
    def find_by_request_id(
        cls,
        thread_id: int,
        request_id: str,
        role: MessageRole | str,
    ) -> AIChatMessage | None:
        """
        Look up the turn a client's idempotency key already produced.

        :param thread_id: The thread the turn belongs to
        :param request_id: The client-supplied idempotency key
        :param role: The author of the turn
        :returns: The stored message, or ``None`` when the key is unused
        """
        return (
            db.session.query(AIChatMessage)
            .filter(
                AIChatMessage.thread_id == thread_id,
                AIChatMessage.request_id == request_id,
                AIChatMessage.role == str(role),
            )
            .one_or_none()
        )

    @classmethod
    def create_idempotent(
        cls,
        thread: AIChatThread,
        role: MessageRole | str,
        content: str,
        *,
        user_id: int | None = None,
        request_id: str | None = None,
        status: MessageStatus | str | None = None,
    ) -> tuple[AIChatMessage, bool]:
        """
        Append a turn, at most once per ``(thread, request_id, role)``.

        A retried request must not double a user's question, so the client's
        key is honoured twice over: a lookup handles the ordinary replay, and a
        savepoint around the insert handles a replay that races the original.
        Without the savepoint the rejected insert would poison the surrounding
        unit of work, and the caller could not go on to read the row that won.

        :param thread: The thread to append to
        :param role: The author of the turn
        :param content: The turn's text, which may be empty for an assistant
            row opened before inference starts
        :param user_id: The user responsible for the turn
        :param request_id: Optional client-supplied idempotency key
        :param status: Optional initial lifecycle value
        :returns: The message, and whether this call created it
        """
        role_value = MessageRole(role).value

        if request_id:
            existing = cls.find_by_request_id(thread.id, request_id, role_value)
            if existing is not None:
                return existing, False

        attributes: dict[str, Any] = {
            "thread_id": thread.id,
            "role": role_value,
            "content": content,
            "request_id": request_id,
            "created_by_fk": user_id,
            "changed_by_fk": user_id,
        }
        if status is not None:
            # Set only when supplied: the column default carries the terminal
            # status, and the model's validator rejects ``None`` outright.
            attributes["status"] = MessageStatus(status).value

        message = AIChatMessage(**attributes)

        try:
            with db.session.begin_nested():
                db.session.add(message)
        except IntegrityError:
            if not request_id:
                raise
            existing = cls.find_by_request_id(thread.id, request_id, role_value)
            if existing is None:
                raise
            logger.info(
                "Idempotency key %s replayed on thread %s; returning stored message",
                request_id,
                thread.uuid,
            )
            return existing, False

        AIChatThreadDAO.touch(thread, user_id=user_id)
        db.session.flush()
        return message, True


class AIChatFeedbackDAO(BaseDAO[AIChatFeedback]):
    """Access to the verdicts users leave on assistant messages."""

    @classmethod
    def find_for_message_and_user(
        cls,
        message_id: int,
        user_id: int | None,
    ) -> AIChatFeedback | None:
        """
        Return this user's verdict on a message, if they left one.

        :param message_id: The message that was rated
        :param user_id: The user who rated it
        :returns: The stored verdict, or ``None``
        """
        if user_id is None:
            return None
        return (
            db.session.query(AIChatFeedback)
            .filter(
                AIChatFeedback.message_id == message_id,
                AIChatFeedback.created_by_fk == user_id,
            )
            .one_or_none()
        )

    @classmethod
    def find_verdicts_for_user(
        cls,
        message_ids: list[int],
        user_id: int | None,
    ) -> dict[int, bool]:
        """
        This user's verdicts across several messages, keyed by message id.

        One query for a whole conversation rather than one per message, because
        this is read on every transcript fetch: the panel has to show which
        messages the user already rated, and a per-message lookup would add a
        round trip for every reply on screen.

        :param message_ids: The messages to look up
        :param user_id: The user whose verdicts to return
        :returns: Message id to whether the user liked it, omitting unrated ones
        """
        if user_id is None or not message_ids:
            return {}
        rows = (
            db.session.query(AIChatFeedback.message_id, AIChatFeedback.liked)
            .filter(
                AIChatFeedback.message_id.in_(message_ids),
                AIChatFeedback.created_by_fk == user_id,
            )
            .all()
        )
        return dict(rows)

    @classmethod
    def upsert(
        cls,
        message: AIChatMessage,
        user_id: int,
        *,
        liked: bool,
        comment: str | None = None,
    ) -> tuple[AIChatFeedback, bool]:
        """
        Record a verdict, replacing whatever this user said before.

        The table holds one row per user per message, so a changed mind is an
        update; a second row would double-count the message in every aggregate
        built from this table. As with an appended message the insert runs in a
        savepoint, so a double-submitted verdict resolves to an update instead
        of failing the request.

        :param message: The message being rated
        :param user_id: The user leaving the verdict
        :param liked: Whether the message was helpful
        :param comment: Optional free-text remark
        :returns: The verdict, and whether this call created it
        """
        existing = cls.find_for_message_and_user(message.id, user_id)

        if existing is None:
            feedback = AIChatFeedback(
                message_id=message.id,
                liked=liked,
                comment=comment,
                created_by_fk=user_id,
                changed_by_fk=user_id,
            )
            try:
                with db.session.begin_nested():
                    db.session.add(feedback)
            except IntegrityError:
                existing = cls.find_for_message_and_user(message.id, user_id)
                if existing is None:
                    raise
            else:
                db.session.flush()
                return feedback, True

        existing.liked = liked
        existing.comment = comment
        existing.changed_by_fk = user_id
        db.session.add(existing)
        db.session.flush()
        return existing, False
