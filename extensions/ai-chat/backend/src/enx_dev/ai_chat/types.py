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
"""Neutral, provider-independent data structures for the AI chat gateway.

The orchestrator and every provider speak this vocabulary. Providers
translate to and from their own wire format so the rest of the gateway, and
the frontend, never depend on a specific model vendor.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum, StrEnum
from typing import Any


class ChatRole(StrEnum):
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"


class ToolClassification(StrEnum):
    """Impact class of an MCP tool, derived from its declared annotations.

    ``UNKNOWN`` is gated wherever ``MUTATING`` is, so a tool without
    recognizable annotations is never the easier one to reach.
    """

    READ_ONLY = "read_only"
    MUTATING = "mutating"
    DESTRUCTIVE = "destructive"
    UNKNOWN = "unknown"


class ToolApprovalMode(StrEnum):
    """How much of the tool surface an operator gates behind an approval.

    Set by the operator alone, never by the model or the browser. Approval is
    a confirmation step on top of authentication, the allowlist, validation
    and RBAC, which apply in every mode.
    """

    #: Every allowlisted tool runs as soon as validation passes.
    DISABLED = "disabled"
    #: Read-only tools run inline; mutating and destructive ones are gated.
    MUTATIONS_ONLY = "mutations_only"
    #: Every tool call is gated, including read-only ones.
    ALL_TOOLS = "all_tools"


class FinishReason(StrEnum):
    STOP = "stop"
    TOOL_CALLS = "tool_calls"
    LENGTH = "length"


@dataclass
class ToolCall:
    """A tool invocation requested by the model."""

    id: str
    name: str
    arguments: dict[str, Any]


@dataclass
class ImageAttachment:
    """An image the user attached to a message.

    Carried as base64 with its media type, the neutral shape both provider
    wire formats are built from. Never persisted server-side.
    """

    media_type: str
    data: str
    name: str | None = None

    @property
    def data_url(self) -> str:
        return f"data:{self.media_type};base64,{self.data}"


@dataclass
class ChatMessage:
    """One message of the neutral conversation format."""

    role: ChatRole
    content: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    # For role == TOOL: which call this message answers
    tool_call_id: str | None = None
    # For role == TOOL: the tool name, which some providers require
    name: str | None = None
    # For role == USER: images sent alongside the text
    images: list[ImageAttachment] = field(default_factory=list)


@dataclass
class ProviderResult:
    """Normalized result of one provider completion call."""

    content: str | None
    tool_calls: list[ToolCall] = field(default_factory=list)
    finish_reason: FinishReason = FinishReason.STOP
    usage: dict[str, int] | None = None


@dataclass
class ToolSpec:
    """An MCP tool exposed to the model after allowlisting."""

    name: str
    description: str
    input_schema: dict[str, Any]
    classification: ToolClassification
    title: str | None = None


@dataclass
class ToolExecution:
    """Outcome of one MCP tool invocation."""

    ok: bool
    content: str = ""
    truncated: bool = False
    error: str | None = None


class Sentinel(Enum):
    REDACTED = "***redacted***"


_SENSITIVE_KEY_PATTERN = re.compile(
    r"password|secret|token|api[_-]?key|credential|authorization|private[_-]?key",
    re.IGNORECASE,
)


def redact_sensitive(value: Any) -> Any:
    """Recursively replace values of secret-looking keys with a placeholder.

    Applied to tool arguments before they are echoed back to the browser or
    written to logs, leaving the original arguments unaffected.
    """
    if isinstance(value, dict):
        return {
            key: (
                Sentinel.REDACTED.value
                if isinstance(key, str) and _SENSITIVE_KEY_PATTERN.search(key)
                else redact_sensitive(item)
            )
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [redact_sensitive(item) for item in value]
    return value
