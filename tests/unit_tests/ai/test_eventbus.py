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
Tests for the event bus that carries streamed events to the HTTP response.

Every test here bounds its own wall clock: the failure mode these buses have is
hanging, so a test that could block forever would report the bug as a hung
suite rather than as a failure.
"""

from __future__ import annotations

import time
from collections.abc import Iterator
from typing import Any, TYPE_CHECKING

import pytest
from flask import current_app
from pytest_mock import MockerFixture

from superset.utils import json

if TYPE_CHECKING:
    from superset.ai.eventbus import BaseEventBus
    from superset.ai.events import StreamEvent

#: Small enough that the whole file stays quick, large enough that a poll or two
#: really does elapse.
POLL = 0.02
TIMEOUT = 0.2


@pytest.fixture(autouse=True)
def _reset_memory_bus_singleton() -> Iterator[None]:
    """
    Clear the process-wide memory bus around every test.

    ``get_event_bus`` deliberately caches one :class:`MemoryEventBus` per
    process — that is what lets a streaming request find the queue an inline run
    is writing to — which makes it shared state between tests. Resetting it on
    both sides keeps ordering-dependent leakage out of the suite.
    """
    from superset.ai import eventbus

    eventbus._MEMORY_BUS = None
    yield
    eventbus._MEMORY_BUS = None


def _drain(bus: BaseEventBus, run_id: str, **kwargs: Any) -> list[StreamEvent | None]:
    """
    Consume a run to completion.

    That ``list()`` returns at all is part of what is being tested: a bus that
    ignored a terminal event or its own deadline would never get here.
    """
    kwargs.setdefault("timeout_seconds", TIMEOUT)
    kwargs.setdefault("poll_seconds", POLL)
    return list(bus.consume(run_id, **kwargs))


def _types(events: list[StreamEvent | None]) -> list[str]:
    """Event type names in order, with idle ticks shown as ``"idle"``."""
    return ["idle" if event is None else event.type.value for event in events]


def _delivered(events: list[StreamEvent | None]) -> list[StreamEvent]:
    """Just the real events, for asserting on payloads."""
    return [event for event in events if event is not None]


def _decoded_id(entry: Any) -> str:
    """Stream entry id as a string, whichever form the client handed back."""
    raw = entry[0]
    return raw.decode() if isinstance(raw, bytes) else str(raw)


class FakeStreamCache:
    """
    In-memory stand-in for the Redis-backed cache the bus writes through.

    Mirrors the contract :class:`RedisStreamEventBus` is written against: the
    four positional arguments of
    :class:`superset.async_events.cache_backend.RedisCacheBackend`, and an
    inclusive ``start`` for ``xrange``, which is what the bus's
    skip-the-entry-we-already-saw filter depends on.

    With ``binary=True`` it behaves like ``redis-py`` without response
    decoding: entry ids, field names and field values all come back as bytes.
    """

    def __init__(self, binary: bool = False) -> None:
        self.streams: dict[str, list[tuple[Any, dict[Any, Any]]]] = {}
        self.expirations: list[tuple[str, int]] = []
        self.binary = binary
        self._sequence = 0

    def _next_id(self) -> Any:
        self._sequence += 1
        # Zero padded so lexicographic order matches insertion order, the way
        # real Redis stream ids do.
        entry_id = f"{self._sequence:04d}-0"
        return entry_id.encode() if self.binary else entry_id

    def append_raw(self, stream_name: str, fields: dict[Any, Any]) -> None:
        """Put an entry on a stream without going through ``publish``."""
        self.streams.setdefault(stream_name, []).append((self._next_id(), fields))

    def xadd(
        self,
        stream_name: str,
        event_data: dict[str, Any],
        event_id: str = "*",
        maxlen: int | None = None,
    ) -> str:
        fields: dict[Any, Any] = dict(event_data)
        if self.binary:
            fields = {
                key.encode(): str(value).encode() for key, value in event_data.items()
            }
        self.append_raw(stream_name, fields)
        return _decoded_id(self.streams[stream_name][-1])

    def xrange(
        self,
        stream_name: str,
        start: str = "-",
        end: str = "+",
        count: int | None = None,
    ) -> list[Any]:
        entries = self.streams.get(stream_name, [])
        if start != "-":
            entries = [e for e in entries if _decoded_id(e) >= start]
        return list(entries[: count or len(entries)])

    def expire(self, stream_name: str, ttl_seconds: int) -> None:
        self.expirations.append((stream_name, ttl_seconds))


class BrokenWriteCache(FakeStreamCache):
    """A cache whose writes fail, as a Redis outage would make them."""

    def xadd(self, *args: Any, **kwargs: Any) -> str:
        raise RuntimeError("connection refused")


class FlakyReadCache(FakeStreamCache):
    """A cache whose reads fail a set number of times before recovering."""

    def __init__(self, failures: int) -> None:
        super().__init__()
        self.read_attempts = 0
        self._remaining_failures = failures

    def xrange(self, *args: Any, **kwargs: Any) -> list[Any]:
        self.read_attempts += 1
        if self._remaining_failures > 0:
            self._remaining_failures -= 1
            raise RuntimeError("connection reset")
        return super().xrange(*args, **kwargs)


class BrokenExpireCache(FakeStreamCache):
    """A cache that cannot set a TTL."""

    def expire(self, stream_name: str, ttl_seconds: int) -> None:
        raise RuntimeError("connection refused")


def _terminal_event(index: int) -> StreamEvent:
    """One event per terminal type, addressed by index so ids stay readable."""
    from superset.ai.events import cancelled_event, done_event, error_event

    return [done_event(True), error_event("boom"), cancelled_event()][index]


# --------------------------------------------------------------------------- #
# MemoryEventBus
# --------------------------------------------------------------------------- #


def test_memory_bus_yields_published_events_in_order() -> None:
    """Events come back in the order the run produced them, and only once."""
    from superset.ai.eventbus import MemoryEventBus
    from superset.ai.events import assistant_delta_event, done_event, final_event

    bus = MemoryEventBus()
    bus.publish("run-1", assistant_delta_event("Total "))
    bus.publish("run-1", assistant_delta_event("revenue"))
    bus.publish("run-1", final_event("Total revenue"))
    bus.publish("run-1", done_event(True))

    events = _drain(bus, "run-1")

    assert _types(events) == [
        "assistant_delta",
        "assistant_delta",
        "final",
        "done",
    ]
    delivered = _delivered(events)
    assert delivered[0].payload == {"delta": "Total "}
    assert delivered[2].payload == {"role": "assistant", "content": "Total revenue"}
    assert delivered[3].payload == {"ok": True}


def test_memory_bus_keeps_runs_apart() -> None:
    """Two concurrent runs in one process do not read each other's events."""
    from superset.ai.eventbus import MemoryEventBus
    from superset.ai.events import done_event, final_event

    bus = MemoryEventBus()
    bus.publish("run-1", final_event("one"))
    bus.publish("run-2", final_event("two"))
    bus.publish("run-1", done_event(True))
    bus.publish("run-2", done_event(True))

    first = _delivered(_drain(bus, "run-1"))
    second = _delivered(_drain(bus, "run-2"))

    assert first[0].payload["content"] == "one"
    assert second[0].payload["content"] == "two"


@pytest.mark.parametrize("index", [0, 1, 2])
def test_memory_bus_stops_at_a_terminal_event(index: int) -> None:
    """
    Consumption ends on ``done``, ``error`` or ``cancelled``.

    Without this the reader waits out the full timeout after a run has already
    finished, which the user experiences as a response that never closes.
    """
    from superset.ai.eventbus import MemoryEventBus
    from superset.ai.events import assistant_delta_event

    terminal = _terminal_event(index)

    bus = MemoryEventBus()
    bus.publish("run-1", terminal)
    # Anything queued after the terminal event is not the client's business.
    bus.publish("run-1", assistant_delta_event("trailing"))

    events = _drain(bus, "run-1", timeout_seconds=5.0)

    assert events == [terminal]


def test_memory_bus_yields_idle_while_nothing_is_published() -> None:
    """
    A quiet run produces keep-alive cues rather than silence.

    ``IDLE`` is the caller's signal to write an SSE comment, which is what stops
    a proxy from closing a connection during a long tool call.
    """
    from superset.ai.eventbus import IDLE, MemoryEventBus

    bus = MemoryEventBus()
    events = _drain(bus, "quiet-run")

    assert events, "a poll interval passing must produce something"
    assert all(event is IDLE for event in events)


def test_memory_bus_interleaves_idle_with_late_events() -> None:
    """An event published after an idle period is still delivered."""
    from superset.ai.eventbus import IDLE, MemoryEventBus
    from superset.ai.events import done_event

    bus = MemoryEventBus()
    stream = bus.consume("run-1", timeout_seconds=5.0, poll_seconds=POLL)

    assert next(stream) is IDLE

    bus.publish("run-1", done_event(True))
    assert next(stream) == done_event(True)

    with pytest.raises(StopIteration):
        next(stream)


def test_memory_bus_consume_returns_when_the_timeout_expires() -> None:
    """
    A run that never terminates gives up on its own deadline.

    A producer can die without emitting anything terminal; the reader has to
    return so the request completes instead of holding a worker forever.
    """
    from superset.ai.eventbus import IDLE, MemoryEventBus
    from superset.ai.events import assistant_delta_event

    bus = MemoryEventBus()
    bus.publish("run-1", assistant_delta_event("partial"))

    started = time.monotonic()
    events = _drain(bus, "run-1", timeout_seconds=0.1, poll_seconds=0.02)
    elapsed = time.monotonic() - started

    assert events[0] == assistant_delta_event("partial")
    assert events[-1] is IDLE
    assert elapsed < 2.0, "consume must honour its deadline, not block"


def test_memory_bus_close_releases_the_queue() -> None:
    """
    Closing a run drops its queue, so a finished run holds no memory.

    Anything still queued goes with it; ``close`` is called once the response
    has been written, at which point nobody is left to read it.
    """
    from superset.ai.eventbus import IDLE, MemoryEventBus
    from superset.ai.events import final_event

    bus = MemoryEventBus()
    bus.publish("run-1", final_event("never read"))
    bus.close("run-1")

    assert all(event is IDLE for event in _drain(bus, "run-1"))

    # Closing an unknown or already-closed run is not an error: the streaming
    # path closes in a ``finally`` that may run twice.
    bus.close("run-1")
    bus.close("never-existed")


# --------------------------------------------------------------------------- #
# RedisStreamEventBus
# --------------------------------------------------------------------------- #


def test_redis_bus_round_trips_an_event_through_the_stream() -> None:
    """
    An event survives encoding to the stream and decoding back out.

    This is the wire format two processes agree on, so the type and the payload
    both have to come back intact rather than merely close.
    """
    from superset.ai.eventbus import RedisStreamEventBus
    from superset.ai.events import done_event, thinking_event
    from superset.ai.types import ProgressStage

    cache = FakeStreamCache()
    bus = RedisStreamEventBus(cache=cache, prefix="ai-events-")

    published = thinking_event(ProgressStage.TOOL, "Reading the schema", {"n": 1})
    bus.publish("run-1", published)
    bus.publish("run-1", done_event(False))

    events = _drain(bus, "run-1")

    assert events == [published, done_event(False)]
    assert _delivered(events)[0].payload == {
        "stage": "tool",
        "message": "Reading the schema",
        "meta": {"n": 1},
    }

    # Stored under the prefixed key, as one JSON document per entry.
    stored = cache.streams["ai-events-run-1"]
    assert json.loads(stored[0][1]["data"])["type"] == "thinking"


def test_redis_bus_handles_byte_entry_ids_and_fields() -> None:
    """
    A client that does not decode responses is handled without duplication.

    ``redis-py`` hands back bytes for ids and fields alike. If the bus compared
    a bytes id against the string it tracks, every poll would look like fresh
    data and the browser would see the whole stream again on each pass.
    """
    from superset.ai.eventbus import RedisStreamEventBus
    from superset.ai.events import assistant_delta_event, done_event

    cache = FakeStreamCache(binary=True)
    bus = RedisStreamEventBus(cache=cache)

    bus.publish("run-1", assistant_delta_event("a"))
    bus.publish("run-1", assistant_delta_event("b"))
    bus.publish("run-1", done_event(True))

    events = _drain(bus, "run-1")

    assert events == [
        assistant_delta_event("a"),
        assistant_delta_event("b"),
        done_event(True),
    ]


def test_redis_bus_skips_malformed_entries() -> None:
    """
    An entry we cannot read is dropped, not raised.

    A stream is shared state that outlives the process that wrote it, so one
    unreadable entry — a truncated write, an event type from a newer version —
    must not end a stream that still has good events in it.
    """
    from superset.ai.eventbus import RedisStreamEventBus
    from superset.ai.events import done_event, final_event

    cache = FakeStreamCache()
    bus = RedisStreamEventBus(cache=cache)
    stream = "ai-events-run-1"

    cache.append_raw(stream, {"unexpected": "no data field at all"})
    cache.append_raw(stream, {"data": "{not json"})
    cache.append_raw(stream, {"data": json.dumps({"payload": {}})})
    cache.append_raw(
        stream, {"data": json.dumps({"type": "from_the_future", "payload": {}})}
    )
    bus.publish("run-1", final_event("the good one"))
    bus.publish("run-1", done_event(True))

    events = _drain(bus, "run-1")

    assert events == [final_event("the good one"), done_event(True)]


@pytest.mark.parametrize("index", [0, 1, 2])
def test_redis_bus_stops_at_a_terminal_event(index: int) -> None:
    """Consumption ends on the first terminal event, as in-process it does."""
    from superset.ai.eventbus import RedisStreamEventBus
    from superset.ai.events import assistant_delta_event

    terminal = _terminal_event(index)

    bus = RedisStreamEventBus(cache=FakeStreamCache())
    bus.publish("run-1", terminal)
    bus.publish("run-1", assistant_delta_event("trailing"))

    events = _drain(bus, "run-1", timeout_seconds=5.0)

    assert events == [terminal]


def test_redis_bus_publish_survives_a_broken_backend() -> None:
    """
    A failed publish must not kill the run producing the answer.

    The run's real output is persisted by the time it finishes; losing the live
    stream costs the user progress updates, whereas an exception here would
    cost them the answer.
    """
    from superset.ai.eventbus import RedisStreamEventBus
    from superset.ai.events import done_event, final_event

    cache = BrokenWriteCache()
    bus = RedisStreamEventBus(cache=cache)

    bus.publish("run-1", final_event("an answer nobody streams"))
    bus.publish("run-1", done_event(True))

    assert cache.streams == {}


def test_redis_bus_read_failure_yields_idle_and_keeps_trying() -> None:
    """
    A transient read failure is an idle tick, not the end of the stream.

    A Redis blip mid-run would otherwise truncate a response that was about to
    succeed; instead the reader keeps the connection alive and picks the events
    up when the backend comes back.
    """
    from superset.ai.eventbus import RedisStreamEventBus
    from superset.ai.events import done_event

    cache = FlakyReadCache(failures=2)
    bus = RedisStreamEventBus(cache=cache)
    bus.publish("run-1", done_event(True))

    events = _drain(bus, "run-1", timeout_seconds=5.0)

    assert _types(events) == ["idle", "idle", "done"]
    assert cache.read_attempts == 3


def test_redis_bus_survives_a_permanently_broken_backend() -> None:
    """A backend that never recovers times the reader out rather than raising."""
    from superset.ai.eventbus import IDLE, RedisStreamEventBus

    cache = FlakyReadCache(failures=10_000)
    bus = RedisStreamEventBus(cache=cache)

    events = _drain(bus, "run-1")

    assert events, "must keep polling rather than return immediately"
    assert all(event is IDLE for event in events)
    assert cache.read_attempts >= 2


def test_redis_bus_close_expires_rather_than_deletes() -> None:
    """
    Closing sets a TTL and leaves the entries in place.

    A browser that reconnects late replays the stream from the beginning, so
    deleting on close would cut off exactly the reader this bus exists for.
    """
    from superset.ai.eventbus import RedisStreamEventBus
    from superset.ai.events import done_event

    cache = FakeStreamCache()
    bus = RedisStreamEventBus(cache=cache, prefix="prefix-", ttl_seconds=42)
    bus.publish("run-1", done_event(True))
    bus.close("run-1")

    assert cache.expirations == [("prefix-run-1", 42)]
    assert len(cache.streams["prefix-run-1"]) == 1


def test_redis_bus_close_survives_a_broken_backend() -> None:
    """Failing to set a TTL is logged, not raised at the end of a request."""
    from superset.ai.eventbus import RedisStreamEventBus

    bus = RedisStreamEventBus(cache=BrokenExpireCache())
    bus.close("run-1")


# --------------------------------------------------------------------------- #
# get_event_bus
# --------------------------------------------------------------------------- #


def test_get_event_bus_returns_one_shared_memory_bus_for_inline_runs(
    mocker: MockerFixture,
) -> None:
    """
    Inline execution gets the in-process bus, and the same one every time.

    Sharing is load-bearing rather than an optimisation: the streaming request
    finds the inline run's queue only because both resolve to one object.
    """
    from superset.ai.eventbus import get_event_bus, MemoryEventBus

    mocker.patch.dict(
        current_app.config,
        {
            "AI_ASSISTANT_EXECUTION_MODE": "inline",
            "AI_ASSISTANT_EVENT_BUS": "memory",
        },
    )

    bus = get_event_bus()
    assert isinstance(bus, MemoryEventBus)
    assert get_event_bus() is bus


def test_get_event_bus_returns_a_redis_bus_configured_from_config(
    mocker: MockerFixture,
) -> None:
    """
    The Redis bus takes its key prefix and TTL from configuration.

    Also the only test that reaches the branch at all: the backend is built from
    ``AI_ASSISTANT_EVENT_BUS_CACHE_CONFIG`` rather than borrowed from the
    general-purpose cache, which has no stream commands. Getting that wrong
    would break every ``AI_ASSISTANT_EVENT_BUS='redis'`` deployment on its first
    published event while leaving the rest of this module green.
    """
    from superset.ai import eventbus as eventbus_module
    from superset.ai.eventbus import get_event_bus, RedisStreamEventBus
    from superset.ai.events import done_event

    cache = FakeStreamCache()
    mocker.patch.object(eventbus_module, "_stream_backend", return_value=cache)
    mocker.patch.dict(
        current_app.config,
        {
            "AI_ASSISTANT_EXECUTION_MODE": "worker",
            "AI_ASSISTANT_EVENT_BUS": "redis",
            "AI_ASSISTANT_EVENT_STREAM_PREFIX": "test-ai-events-",
            "AI_ASSISTANT_EVENT_TTL_SECONDS": 30,
        },
    )

    bus = get_event_bus()
    assert isinstance(bus, RedisStreamEventBus)

    bus.publish("run-1", done_event(True))
    bus.close("run-1")

    assert list(cache.streams) == ["test-ai-events-run-1"]
    assert cache.expirations == [("test-ai-events-run-1", 30)]


def test_worker_execution_refuses_the_memory_bus(mocker: MockerFixture) -> None:
    """
    The one combination that fails silently is rejected at construction.

    A Celery worker writing to an in-process queue leaves every stream in the
    web process empty forever: the run succeeds, the user sees nothing, and
    nothing anywhere logs an error. Better to refuse to start.
    """
    from superset.ai.eventbus import get_event_bus

    mocker.patch.dict(
        current_app.config,
        {
            "AI_ASSISTANT_EXECUTION_MODE": "worker",
            "AI_ASSISTANT_EVENT_BUS": "memory",
        },
    )

    with pytest.raises(RuntimeError, match="requires") as excinfo:
        get_event_bus()

    message = str(excinfo.value)
    # The message has to name both settings and the value to use, because the
    # operator reading it is looking at a config file, not at this code.
    assert "AI_ASSISTANT_EXECUTION_MODE='worker'" in message
    assert "AI_ASSISTANT_EVENT_BUS='redis'" in message
