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
The server-sent event vocabulary spoken by the streaming endpoint.

One frame builder lives here and every producer uses it, so the wire format
cannot drift between code paths.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from superset.ai.types import ProgressStage, StreamEventType
from superset.utils import json

#: Sent on an idle timer so proxies and load balancers do not close the
#: connection. An SSE comment is ignored by conforming clients.
KEEPALIVE_FRAME = ": keepalive\n\n"

#: Seconds of silence before a keep-alive is emitted.
KEEPALIVE_INTERVAL_SECONDS = 15

#: Message shown to the user when a run fails for a reason we do not want to
#: describe. Exception text can carry connection strings, internal hostnames
#: and query fragments, so it is logged rather than sent to the browser.
GENERIC_ERROR_MESSAGE = "The assistant hit an unexpected error. Please try again."


@dataclass(frozen=True)
class StreamEvent:
    """
    One frame on the wire.

    Immutable so a producer cannot hand the same object to two consumers and
    then mutate it.
    """

    type: StreamEventType
    payload: dict[str, Any] = field(default_factory=dict)

    def encode(self) -> str:
        """Render as an SSE frame."""
        return f"event: {self.type.value}\ndata: {json.dumps(self.payload)}\n\n"


def session_event(thread_uuid: str, message_uuid: str) -> StreamEvent:
    """
    First frame of every stream.

    The client needs both identifiers before any content arrives so that it
    can resume or cancel a run whose output it never saw.
    """
    return StreamEvent(
        StreamEventType.SESSION,
        {"thread_uuid": thread_uuid, "message_uuid": message_uuid},
    )


def thinking_event(
    stage: ProgressStage,
    message: str,
    meta: dict[str, Any] | None = None,
) -> StreamEvent:
    """Coarse progress, rendered as user-facing status copy."""
    payload: dict[str, Any] = {"stage": stage.value, "message": message}
    if meta:
        payload["meta"] = meta
    return StreamEvent(StreamEventType.THINKING, payload)


def thoughts_event(delta: str) -> StreamEvent:
    """
    Intermediate model prose.

    Deliberately a separate event from :func:`assistant_delta_event`: prose
    the model emits between tool calls is reasoning, not answer, and a client
    that appended it to the answer would show contradictory half-conclusions.
    """
    return StreamEvent(StreamEventType.THOUGHTS, {"delta": delta})


def checkpoint_event(summary: str, meta: dict[str, Any] | None = None) -> StreamEvent:
    """
    A milestone worth keeping in the transcript.

    Informational by default: a client records it and keeps reading. Setting
    ``meta["requires_confirmation"]`` marks it as a gate the user must clear
    before the run continues, which needs a server-side resume to be meaningful.

    The distinction matters. A client that treats every milestone as a gate
    stalls the stream on each finished tool call and leaves the panel showing
    progress long after the answer has been delivered.
    """
    payload: dict[str, Any] = {"summary": summary}
    if meta:
        payload["meta"] = meta
    return StreamEvent(StreamEventType.CHECKPOINT, payload)


def assistant_delta_event(delta: str) -> StreamEvent:
    """A chunk of the answer."""
    return StreamEvent(StreamEventType.ASSISTANT_DELTA, {"delta": delta})


def final_event(content: str) -> StreamEvent:
    """
    The authoritative answer.

    Clients replace the answer bubble with this rather than appending, so a
    dropped or duplicated delta cannot corrupt what the user ends up reading.
    """
    return StreamEvent(
        StreamEventType.FINAL,
        {"role": "assistant", "content": content},
    )


def error_event(message: str = GENERIC_ERROR_MESSAGE) -> StreamEvent:
    """
    A terminal failure.

    Always keyed ``error``, never ``message``. A client reading one key while some
    code path emits the other renders an empty error at exactly the moment the
    transport is broken and the text matters most, so the key is fixed here rather
    than chosen per call site.
    """
    return StreamEvent(StreamEventType.ERROR, {"error": message})


def cancelled_event() -> StreamEvent:
    """The run stopped because the user asked it to."""
    return StreamEvent(StreamEventType.CANCELLED, {})


def done_event(ok: bool) -> StreamEvent:
    """
    Always the last frame.

    ``ok`` must reflect the real outcome. Emitting this from a bare ``finally``
    reports success for timeouts and crashes alike, which is what the upstream
    implementation did.
    """
    return StreamEvent(StreamEventType.DONE, {"ok": ok})
