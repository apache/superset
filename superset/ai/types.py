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
Enumerations and typed dictionaries shared across the AI assistant.

Kept free of any heavyweight ``superset`` import so that models, commands,
DAOs and the API layer can all depend on it without creating an import cycle.
"""

from __future__ import annotations

from typing import Any, TypedDict

from superset.utils.backports import StrEnum


class MessageRole(StrEnum):
    """Author of a stored conversation message."""

    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class ThreadStatus(StrEnum):
    """Lifecycle of a conversation thread."""

    ACTIVE = "active"
    ARCHIVED = "archived"


class MessageStatus(StrEnum):
    """
    Lifecycle of a single message.

    Only assistant messages move through the non-terminal states; a user
    message is ``COMPLETE`` the moment it is stored.
    """

    PENDING = "pending"
    STREAMING = "streaming"
    COMPLETE = "complete"
    ERROR = "error"
    CANCELLED = "cancelled"

    @classmethod
    def terminal(cls) -> frozenset[MessageStatus]:
        """States from which a message will never transition again."""
        return frozenset({cls.COMPLETE, cls.ERROR, cls.CANCELLED})


class StreamEventType(StrEnum):
    """
    Server-sent event names emitted by the streaming endpoint.

    The vocabulary is deliberately small and stable: clients switch on these
    names, so adding a value is a compatible change while renaming one is not.
    """

    #: First frame of every stream. Carries the thread and message identifiers.
    SESSION = "session"
    #: Coarse progress. Carries a ``stage`` from :class:`ProgressStage`.
    THINKING = "thinking"
    #: Intermediate model prose, shown in a collapsible reasoning pane. Never
    #: part of the answer.
    THOUGHTS = "thoughts"
    #: A completed milestone worth surfacing in the transcript.
    CHECKPOINT = "checkpoint"
    #: A chunk of the answer.
    ASSISTANT_DELTA = "assistant_delta"
    #: The authoritative answer. Clients replace, not append.
    FINAL = "final"
    #: Terminal. Carries a client-safe message under the ``error`` key.
    ERROR = "error"
    #: Terminal. The run was cancelled cooperatively.
    CANCELLED = "cancelled"
    #: Always last. ``ok`` reflects the real outcome of the run.
    DONE = "done"


class ProgressStage(StrEnum):
    """
    Value of ``stage`` on a :attr:`StreamEventType.THINKING` event.

    These drive user-facing progress copy, so they describe *what the
    assistant is doing*, not which internal component is running.
    """

    START = "start"
    PROMPT = "prompt"
    AGENT = "agent"
    TOOL = "tool"
    REASONING = "reasoning"
    CONTEXT = "context"
    FALLBACK = "fallback"
    ERROR = "error"
    USAGE = "usage"


class RunOutcome(StrEnum):
    """How an assistant run finished."""

    SUCCESS = "success"
    ERROR = "error"
    CANCELLED = "cancelled"
    TIMEOUT = "timeout"


class ToolCallRecord(TypedDict, total=False):
    """One tool invocation, as persisted on an assistant message."""

    name: str
    arguments: dict[str, Any]
    ok: bool
    error: str
    duration_ms: int


class TokenUsage(TypedDict, total=False):
    """Provider-reported token accounting for a run."""

    model: str
    input_tokens: int
    output_tokens: int
    requests: int
    duration_ms: int


class MessageExtra(TypedDict, total=False):
    """
    Schema of the ``extra_json`` blob on a message.

    Stored as serialised JSON rather than a native JSON column so the same
    DDL works on PostgreSQL, MySQL and SQLite. Every key is optional; readers
    must tolerate absence.
    """

    agent_key: str
    model: str
    tool_calls: list[ToolCallRecord]
    usage: TokenUsage
    outcome: str
    error: str
    #: Bumped when the meaning of the blob's keys changes.
    version: int
