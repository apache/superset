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
"""Server-only conversation checkpoints with transcript revision validation."""

from __future__ import annotations

import hashlib
from collections.abc import Sequence
from dataclasses import asdict
from typing import Any

from superset.ai.llm.base import Message, ToolCall, ToolResult
from superset.ai.runtime.context import (
    ContextWindowError,
    ConversationContext,
    validate_context,
)
from superset.ai.types import MessageRole, MessageStatus
from superset.utils import json


def restore_context(messages: Sequence[Any]) -> ConversationContext:
    """Restore only a checkpoint matching this exact, owner-scoped history prefix.

    The caller must pass rows preceding its own assistant placeholder. A later
    queued turn's checkpoint is therefore never visible. Hashing source rows also
    invalidates a checkpoint if an earlier pending answer completed after it.
    """
    digests = _prefix_digests(messages)
    for index in reversed(range(len(messages))):
        row = messages[index]
        raw = getattr(row, "context_json", None)
        if (
            not isinstance(raw, str)
            or row.role != MessageRole.ASSISTANT.value
            or row.status != MessageStatus.COMPLETE.value
        ):
            continue
        try:
            document = json.loads(raw)
            if (
                document.get("version") != 1
                or document.get("history_digest") != digests[index]
            ):
                continue
            context = _decode_context(document["context"])
        except (AttributeError, KeyError, TypeError, ValueError, ContextWindowError):
            continue
        context.messages.extend(_replay_rows(messages[index + 1 :]))
        return context
    return ConversationContext(_replay_rows(messages))


def history_revision(messages: Sequence[Any]) -> str:
    """Identify the exact source snapshot used to prepare a model request."""
    prefixes = _prefix_digests(messages)
    return prefixes[-1] if prefixes else hashlib.sha256().hexdigest()


def encode_checkpoint(context: ConversationContext, messages: Sequence[Any]) -> str:
    """Serialize a derived checkpoint without modifying any original row."""
    validate_context(context)
    digests = _prefix_digests(messages)
    if not digests:
        raise ValueError("A context checkpoint requires a source conversation.")
    return json.dumps(
        {"version": 1, "history_digest": digests[-1], "context": asdict(context)},
        ensure_ascii=False,
    )


def _prefix_digests(messages: Sequence[Any]) -> list[str]:
    """Fingerprint content and status, excluding the derived checkpoint itself."""
    digest = hashlib.sha256()
    prefixes: list[str] = []
    for row in messages:
        extra = getattr(row, "extra", {})
        record = {
            "uuid": str(row.uuid),
            "role": row.role,
            "status": row.status,
            "content": row.content,
            "tool_calls": extra.get("tool_calls", [])
            if isinstance(extra, dict)
            else [],
        }
        digest.update(
            json.dumps(record, sort_keys=True, ensure_ascii=False).encode("utf-8")
        )
        digest.update(b"\n")
        prefixes.append(digest.hexdigest())
    return prefixes


def _replay_rows(rows: Sequence[Any]) -> list[Message]:
    """Keep all original turns, marking legacy tool excerpts as incomplete."""
    messages: list[Message] = []
    for row in rows:
        if row.role == MessageRole.SYSTEM.value:
            continue
        extra = getattr(row, "extra", {})
        calls = extra.get("tool_calls", []) if isinstance(extra, dict) else []
        if row.role == MessageRole.ASSISTANT.value and isinstance(calls, list):
            for index, call in enumerate(calls):
                if not isinstance(call, dict) or not (
                    isinstance(call.get("name"), str)
                    and isinstance(call.get("arguments"), dict)
                    and isinstance(call.get("output"), str)
                    and isinstance(call.get("ok"), bool)
                ):
                    continue
                call_id = f"history_{row.uuid}_{index}"
                messages.extend(
                    [
                        Message(
                            MessageRole.ASSISTANT,
                            tool_calls=[
                                ToolCall(call_id, call["name"], call["arguments"])
                            ],
                        ),
                        Message(
                            MessageRole.USER,
                            tool_results=[
                                ToolResult(
                                    call_id,
                                    "Recorded output excerpt "
                                    "(may be incomplete; not a fresh "
                                    "tool execution):\n" + call["output"],
                                    is_error=not call["ok"],
                                )
                            ],
                        ),
                    ]
                )
        if row.content:
            messages.append(Message(MessageRole(row.role), row.content))
    return messages


def _decode_context(value: Any) -> ConversationContext:
    """Validate stored shapes before constructing provider messages."""
    if not isinstance(value, dict) or not (
        isinstance(value.get("summary"), str)
        and type(value.get("compactions")) is int
        and value["compactions"] >= 0
        and isinstance(value.get("messages"), list)
    ):
        raise ValueError("Invalid context checkpoint")
    messages: list[Message] = []
    for item in value["messages"]:
        if not isinstance(item, dict) or not (
            isinstance(item.get("content"), str)
            and isinstance(item.get("tool_calls"), list)
            and isinstance(item.get("tool_results"), list)
        ):
            raise ValueError("Invalid context message")
        calls: list[ToolCall] = []
        results: list[ToolResult] = []
        for call in item["tool_calls"]:
            if not isinstance(call, dict) or not (
                isinstance(call.get("id"), str)
                and isinstance(call.get("name"), str)
                and isinstance(call.get("arguments"), dict)
            ):
                raise ValueError("Invalid context tool call")
            calls.append(ToolCall(call["id"], call["name"], call["arguments"]))
        for result in item["tool_results"]:
            if not isinstance(result, dict) or not (
                isinstance(result.get("call_id"), str)
                and isinstance(result.get("content"), str)
                and isinstance(result.get("is_error"), bool)
            ):
                raise ValueError("Invalid context tool result")
            results.append(
                ToolResult(result["call_id"], result["content"], result["is_error"])
            )
        messages.append(
            Message(MessageRole(item["role"]), item["content"], calls, results)
        )
    context = ConversationContext(messages, value["summary"], value["compactions"])
    validate_context(context)
    return context
