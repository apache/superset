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
"""Typed event protocol between the AI chat gateway and the frontend.

The gateway returns an ordered list of these events per request. The shape is
transport-agnostic, so a later streaming transport such as SSE can emit the
same events incrementally without changing the frontend event model.

Event types:

- ``message.completed``: an assistant text message
- ``tool.running``: a tool call started
- ``tool.completed``: a tool call finished successfully
- ``tool.failed``: a tool call failed
- ``tool.approval_required``: a call awaits the user's approval
- ``tool.rejected``: the user rejected a proposed call
- ``request.completed``: the turn finished normally
- ``request.failed``: the turn aborted with an error

``tool.approval_required`` appears only for calls ``TOOL_APPROVAL_MODE``
gates, and never with approval disabled. The frontend renders approval
controls from that event alone, not from the mode it was told.
"""

from __future__ import annotations

import uuid
from typing import Any

from enx_dev.ai_chat.types import ToolClassification


class EventTypes:
    """Wire names of the protocol events, shared with the frontend."""

    MESSAGE_COMPLETED = "message.completed"
    TOOL_RUNNING = "tool.running"
    TOOL_COMPLETED = "tool.completed"
    TOOL_FAILED = "tool.failed"
    TOOL_APPROVAL_REQUIRED = "tool.approval_required"
    TOOL_REJECTED = "tool.rejected"
    REQUEST_COMPLETED = "request.completed"
    REQUEST_FAILED = "request.failed"


def new_id(prefix: str) -> str:
    """Opaque id for an event the server originates."""
    return f"{prefix}_{uuid.uuid4().hex}"


def message_completed(content: str, message_id: str | None = None) -> dict[str, Any]:
    """A finished assistant reply."""
    return {
        "type": EventTypes.MESSAGE_COMPLETED,
        "id": message_id or new_id("msg"),
        "content": content,
    }


def tool_running(
    tool_call_id: str, tool_name: str, arguments_summary: dict[str, Any]
) -> dict[str, Any]:
    """A tool has started; arguments are already redacted."""
    return {
        "type": EventTypes.TOOL_RUNNING,
        "id": tool_call_id,
        "tool": tool_name,
        "arguments": arguments_summary,
    }


def tool_completed(
    tool_call_id: str, tool_name: str, result_summary: str, truncated: bool
) -> dict[str, Any]:
    """A tool succeeded, carrying a bounded excerpt of its result."""
    return {
        "type": EventTypes.TOOL_COMPLETED,
        "id": tool_call_id,
        "tool": tool_name,
        "result": result_summary,
        "truncated": truncated,
    }


def tool_failed(tool_call_id: str, tool_name: str, error: str) -> dict[str, Any]:
    """A tool raised; the message is already sanitized for the browser."""
    return {
        "type": EventTypes.TOOL_FAILED,
        "id": tool_call_id,
        "tool": tool_name,
        "error": error,
    }


def tool_approval_required(  # noqa: PLR0913  pylint: disable=too-many-arguments
    tool_call_id: str,
    tool_name: str,
    tool_title: str | None,
    arguments_summary: dict[str, Any],
    classification: ToolClassification,
    approval_id: str,
    expires_at: str,
    reversible: bool,
    warnings: list[str],
) -> dict[str, Any]:
    """A gated call is paused, waiting on the user's decision."""
    return {
        "type": EventTypes.TOOL_APPROVAL_REQUIRED,
        "id": tool_call_id,
        "tool": tool_name,
        "tool_title": tool_title,
        "arguments": arguments_summary,
        "classification": classification.value,
        "approval_id": approval_id,
        "expires_at": expires_at,
        "reversible": reversible,
        "warnings": warnings,
    }


def tool_rejected(tool_call_id: str, tool_name: str) -> dict[str, Any]:
    """The user refused a proposed call, which therefore never ran."""
    return {
        "type": EventTypes.TOOL_REJECTED,
        "id": tool_call_id,
        "tool": tool_name,
    }


def request_completed(usage: dict[str, int] | None = None) -> dict[str, Any]:
    """The turn finished; usage is included when the provider reports it."""
    event: dict[str, Any] = {"type": EventTypes.REQUEST_COMPLETED}
    if usage:
        event["usage"] = usage
    return event


def request_failed(error_code: str, message: str) -> dict[str, Any]:
    """The turn ended in an error the frontend can act on by code."""
    return {
        "type": EventTypes.REQUEST_FAILED,
        "error_code": error_code,
        "message": message,
    }
