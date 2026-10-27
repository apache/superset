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
Persistence for AI assistant conversations.

Conversations live in Superset's own metadata database, which keeps the
feature deployable with no extra infrastructure and makes ownership
enforceable with the same DAO filters used everywhere else.

These models live under ``superset/models/`` rather than inside
``superset/ai/`` because background workers need them without importing the
API module.
"""

from __future__ import annotations

import uuid as uuid_module
from typing import Any

import sqlalchemy as sa
from flask_appbuilder import Model
from sqlalchemy.orm import relationship, validates
from sqlalchemy_utils import UUIDType

from superset.ai.types import (
    MessageExtra,
    MessageRole,
    MessageStatus,
    ThreadStatus,
)
from superset.models.helpers import AuditMixinNullable
from superset.utils import json
from superset.utils.core import MediumText

#: Bumped when the meaning of keys inside an ``extra_json`` blob changes, so a
#: reader can tell an old row from a new one instead of guessing.
EXTRA_JSON_VERSION = 1


class AIChatThread(AuditMixinNullable, Model):
    """
    One conversation between a user and the assistant.

    Ownership is expressed through ``created_by_fk`` (supplied by
    :class:`AuditMixinNullable`) and enforced by the DAO's base filter, so a
    thread identifier is not by itself a capability.
    """

    __tablename__ = "ai_chat_threads"
    __table_args__ = (
        # Serves the "my threads, most recent first" list query.
        sa.Index("ix_ai_chat_threads_owner_recent", "created_by_fk", "changed_on"),
    )

    id = sa.Column(sa.Integer, primary_key=True)
    #: The only identifier exposed over HTTP. Integer ids stay internal.
    uuid = sa.Column(
        UUIDType(binary=True),
        nullable=False,
        unique=True,
        default=uuid_module.uuid4,
    )

    title = sa.Column(sa.String(512), nullable=True)
    status = sa.Column(
        sa.String(32),
        nullable=False,
        default=ThreadStatus.ACTIVE.value,
        server_default=ThreadStatus.ACTIVE.value,
    )
    #: Which agent profile this thread was last run with.
    agent_key = sa.Column(sa.String(64), nullable=True)
    extra_json = sa.Column(MediumText(), nullable=True)

    # No ``passive_deletes``: SQLite does not enforce foreign keys unless
    # ``PRAGMA foreign_keys=ON``, so deferring the cascade to the database
    # would orphan messages there. The ORM deletes children itself, and the
    # ``ON DELETE CASCADE`` in the DDL remains a backstop for direct SQL.
    messages = relationship(
        "AIChatMessage",
        back_populates="thread",
        cascade="all, delete-orphan",
        order_by="AIChatMessage.created_on",
    )

    def __repr__(self) -> str:
        return f"<AIChatThread {self.uuid} [{self.status}]>"

    @validates("status")
    def _validate_status(self, _key: str, value: Any) -> str:
        """Reject unknown lifecycle values at assignment time."""
        return ThreadStatus(value).value

    @property
    def message_count(self) -> int:
        """
        Number of stored messages.

        Derived rather than denormalised: a counter column would have to be kept
        in step with cascade deletes and retention pruning, and a counter that
        drifts is worse than one query — it reports a conversation length nobody
        can reconcile against the rows.
        """
        return len(self.messages)

    @property
    def extra(self) -> dict[str, Any]:
        """Parsed ``extra_json``, or an empty dict when absent or corrupt."""
        return _load_json_object(self.extra_json)


class AIChatMessage(AuditMixinNullable, Model):
    """
    A single turn in a conversation.

    Assistant messages are inserted before inference begins so a client that
    reconnects mid-run has a row to attach to, then transition through
    ``streaming`` to a terminal status.
    """

    __tablename__ = "ai_chat_messages"
    __table_args__ = (
        sa.Index("ix_ai_chat_messages_thread_created", "thread_id", "created_on"),
        # Makes client-supplied idempotency real: replaying a request cannot
        # create a second row for the same turn. The constraint carries the role
        # as well, because one request legitimately produces both a user message
        # and the assistant message answering it.
        sa.UniqueConstraint(
            "thread_id",
            "request_id",
            "role",
            name="uq_ai_chat_messages_thread_request_role",
        ),
    )

    id = sa.Column(sa.Integer, primary_key=True)
    uuid = sa.Column(
        UUIDType(binary=True),
        nullable=False,
        unique=True,
        default=uuid_module.uuid4,
    )

    thread_id = sa.Column(
        sa.Integer,
        sa.ForeignKey("ai_chat_threads.id", ondelete="CASCADE"),
        nullable=False,
    )
    role = sa.Column(sa.String(16), nullable=False)
    #: Unbounded model or user text; deliberately not a plain ``Text`` column,
    #: which caps at 64 KB on MySQL.
    content = sa.Column(MediumText(), nullable=False, default="")
    status = sa.Column(
        sa.String(32),
        nullable=False,
        default=MessageStatus.COMPLETE.value,
        server_default=MessageStatus.COMPLETE.value,
    )
    #: Client-generated idempotency key for the turn.
    request_id = sa.Column(sa.String(96), nullable=True)
    #: Serialised :class:`~superset.ai.types.MessageExtra`.
    extra_json = sa.Column(MediumText(), nullable=True)

    thread = relationship("AIChatThread", back_populates="messages")

    def __repr__(self) -> str:
        return f"<AIChatMessage {self.uuid} {self.role} [{self.status}]>"

    @validates("role")
    def _validate_role(self, _key: str, value: Any) -> str:
        """Reject unknown authors at assignment time."""
        return MessageRole(value).value

    @validates("status")
    def _validate_status(self, _key: str, value: Any) -> str:
        """Reject unknown lifecycle values at assignment time."""
        return MessageStatus(value).value

    @property
    def is_terminal(self) -> bool:
        """Whether this message will never change again."""
        return MessageStatus(self.status) in MessageStatus.terminal()

    @property
    def extra(self) -> MessageExtra:
        """Parsed ``extra_json``, or an empty dict when absent or corrupt."""
        return _load_json_object(self.extra_json)  # type: ignore[return-value]

    def update_extra(self, updates: MessageExtra) -> None:
        """
        Merge keys into ``extra_json``.

        Merge rather than replace, because a run writes tool calls and token
        usage at different moments.
        """
        merged: dict[str, Any] = dict(self.extra)
        merged.update(updates)
        merged["version"] = EXTRA_JSON_VERSION
        self.extra_json = json.dumps(merged)


class AIChatFeedback(AuditMixinNullable, Model):
    """
    A thumbs up or down on an assistant message.

    A first-class table rather than a log line, so the signal can actually be
    aggregated and joined back to the conversation that produced it.
    """

    __tablename__ = "ai_chat_feedback"
    __table_args__ = (
        # One verdict per user per message; a repeat vote updates in place.
        sa.UniqueConstraint(
            "message_id",
            "created_by_fk",
            name="uq_ai_chat_feedback_message_user",
        ),
    )

    id = sa.Column(sa.Integer, primary_key=True)
    uuid = sa.Column(
        UUIDType(binary=True),
        nullable=False,
        unique=True,
        default=uuid_module.uuid4,
    )

    message_id = sa.Column(
        sa.Integer,
        sa.ForeignKey("ai_chat_messages.id", ondelete="CASCADE"),
        nullable=False,
    )
    liked = sa.Column(sa.Boolean, nullable=False)
    comment = sa.Column(MediumText(), nullable=True)

    message = relationship("AIChatMessage")

    def __repr__(self) -> str:
        verdict = "up" if self.liked else "down"
        return f"<AIChatFeedback {self.uuid} {verdict}>"


def _load_json_object(raw: str | None) -> dict[str, Any]:
    """
    Parse a stored JSON object defensively.

    Persisted blobs outlive the code that wrote them, so a malformed or
    non-object value degrades to an empty dict instead of failing a request.
    """
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except (json.JSONDecodeError, TypeError, ValueError):
        return {}
    return parsed if isinstance(parsed, dict) else {}
