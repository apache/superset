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
Carries streamed events from whatever produced them to the HTTP response.

Two implementations, matching the two execution modes. Inline execution needs
nothing more than an in-process queue. Worker execution needs a shared,
*replayable* channel — replayable because a browser that loses its connection
must be able to rejoin a run already in progress, which rules out
publish/subscribe: a subscriber that was absent when an event was published
never sees it.

The Redis implementation therefore uses streams, and reuses the cache backend
that Superset's async-query channel already configures rather than introducing
a second Redis client to operate.
"""

from __future__ import annotations

import logging
import queue
from abc import ABC, abstractmethod
from collections.abc import Iterator
from typing import Any

from superset.ai.events import StreamEvent
from superset.ai.types import StreamEventType
from superset.utils import json

logger = logging.getLogger(__name__)

#: Yielded by :meth:`BaseEventBus.consume` when nothing arrived within the poll
#: interval, so a caller can emit a keep-alive rather than block indefinitely.
IDLE = None

#: Terminal event types. Seeing one ends consumption, so a reader does not hang
#: waiting for a producer that has already finished.
_TERMINAL = frozenset(
    {StreamEventType.DONE, StreamEventType.ERROR, StreamEventType.CANCELLED}
)


class BaseEventBus(ABC):
    """A per-run channel of events."""

    @abstractmethod
    def publish(self, run_id: str, event: StreamEvent) -> None:
        """Append an event to a run's channel."""

    @abstractmethod
    def consume(
        self,
        run_id: str,
        timeout_seconds: float,
        poll_seconds: float = 1.0,
    ) -> Iterator[StreamEvent | None]:
        """
        Yield a run's events until a terminal one arrives or time runs out.

        Yields :data:`IDLE` when a poll interval passes with nothing new, which
        is the caller's cue to send a keep-alive frame.
        """

    @abstractmethod
    def close(self, run_id: str) -> None:
        """Release any resources held for a run."""


class MemoryEventBus(BaseEventBus):
    """
    An in-process queue per run.

    Correct only when the producer and the streaming request share a process.
    Selecting this alongside worker execution would leave every stream silent,
    which :func:`get_event_bus` refuses to allow.
    """

    def __init__(self) -> None:
        self._queues: dict[str, queue.SimpleQueue[StreamEvent]] = {}

    def _queue_for(self, run_id: str) -> queue.SimpleQueue[StreamEvent]:
        return self._queues.setdefault(run_id, queue.SimpleQueue())

    def publish(self, run_id: str, event: StreamEvent) -> None:
        self._queue_for(run_id).put(event)

    def consume(
        self,
        run_id: str,
        timeout_seconds: float,
        poll_seconds: float = 1.0,
    ) -> Iterator[StreamEvent | None]:
        import time

        # Deliberately not ``_queue_for``: reading must not create a channel.
        # This bus lives for the life of the process, so a client polling
        # unknown run identifiers would otherwise grow the dict without bound.
        channel = self._queues.get(run_id)
        deadline = time.monotonic() + timeout_seconds

        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                return
            if channel is None:
                # The producer may not have published yet; look again rather
                # than deciding the run does not exist. Only report idle if it
                # is still absent, so a channel that appeared during the wait
                # is drained on this pass instead of costing an extra tick.
                channel = self._queues.get(run_id)
                if channel is None:
                    yield IDLE
                    time.sleep(min(poll_seconds, remaining))
                continue
            try:
                # Bounded by whichever is sooner, so a generous poll interval
                # cannot overshoot the caller's deadline.
                event = channel.get(timeout=min(poll_seconds, remaining))
            except queue.Empty:
                yield IDLE
                continue
            yield event
            if event.type in _TERMINAL:
                return

    def close(self, run_id: str) -> None:
        self._queues.pop(run_id, None)


class RedisStreamEventBus(BaseEventBus):
    """
    A Redis stream per run.

    Replayable by construction: a reconnecting reader starts from the beginning
    of the stream and catches up, which is what makes worker execution usable
    from a browser on a flaky connection.
    """

    def __init__(
        self,
        cache: Any,
        prefix: str = "ai-events-",
        ttl_seconds: int = 900,
    ) -> None:
        self._cache = cache
        self._prefix = prefix
        self._ttl = ttl_seconds

    def _stream(self, run_id: str) -> str:
        return f"{self._prefix}{run_id}"

    def publish(self, run_id: str, event: StreamEvent) -> None:
        payload = {
            "data": json.dumps({"type": event.type.value, "payload": event.payload})
        }
        # A failure to publish must not kill the run that is producing useful
        # work; the reader will time out and the answer is still persisted.
        try:
            self._cache.xadd(self._stream(run_id), payload, "*", 10_000)
        except Exception:  # pylint: disable=broad-except
            logger.warning("Could not publish AI event for run %s", run_id)
            return
        if event.type in _TERMINAL:
            self.close(run_id)

    def consume(
        self,
        run_id: str,
        timeout_seconds: float,
        poll_seconds: float = 1.0,
    ) -> Iterator[StreamEvent | None]:
        import time

        stream = self._stream(run_id)
        deadline = time.monotonic() + timeout_seconds
        last_id = "-"

        while time.monotonic() < deadline:
            try:
                entries = self._cache.xrange(stream, last_id, "+", 100)
            except Exception:  # pylint: disable=broad-except
                logger.warning("Could not read AI events for run %s", run_id)
                yield IDLE
                time.sleep(poll_seconds)
                continue

            fresh = [entry for entry in entries if _entry_id(entry) != last_id]
            if not fresh:
                yield IDLE
                time.sleep(poll_seconds)
                continue

            for entry in fresh:
                last_id = _entry_id(entry)
                event = _decode(entry)
                if event is None:
                    continue
                yield event
                if event.type in _TERMINAL:
                    return

    def close(self, run_id: str) -> None:
        # The stream is left to expire rather than deleted, so a reader that is
        # still catching up is not cut off mid-replay.
        try:
            self._cache.expire(self._stream(run_id), self._ttl)
        except Exception:  # pylint: disable=broad-except
            logger.debug("Could not set TTL on AI event stream for %s", run_id)


def _entry_id(entry: Any) -> str:
    """Stream entry id, tolerating bytes from the Redis client."""
    raw = entry[0]
    return raw.decode() if isinstance(raw, bytes) else str(raw)


def _decode(entry: Any) -> StreamEvent | None:
    """Rebuild an event from a stream entry, skipping anything malformed."""
    fields = entry[1]
    raw = fields.get(b"data") or fields.get("data")
    if raw is None:
        return None
    if isinstance(raw, bytes):
        raw = raw.decode()
    try:
        decoded = json.loads(raw)
        return StreamEvent(StreamEventType(decoded["type"]), decoded["payload"])
    except (json.JSONDecodeError, KeyError, ValueError, TypeError):
        logger.warning("Discarding malformed AI event")
        return None


def get_event_bus() -> BaseEventBus:
    """
    Build the configured bus, refusing combinations that cannot work.

    An in-memory bus with worker execution is a silent failure — every stream
    would sit empty while the run completed elsewhere — so it is rejected at
    construction rather than discovered in production.
    """
    from flask import current_app

    mode = current_app.config.get("AI_ASSISTANT_EXECUTION_MODE", "inline")
    kind = current_app.config.get("AI_ASSISTANT_EVENT_BUS", "memory")

    if mode == "worker" and kind == "memory":
        raise RuntimeError(
            "AI_ASSISTANT_EXECUTION_MODE='worker' requires "
            "AI_ASSISTANT_EVENT_BUS='redis': an in-process bus cannot carry "
            "events from a Celery worker to the web process."
        )

    if kind == "memory":
        return _memory_bus()

    return RedisStreamEventBus(
        cache=_stream_backend(),
        prefix=current_app.config.get("AI_ASSISTANT_EVENT_STREAM_PREFIX", "ai-events-"),
        ttl_seconds=current_app.config.get("AI_ASSISTANT_EVENT_TTL_SECONDS", 900),
    )


def _stream_backend() -> Any:
    """
    Build a cache client that can speak Redis streams.

    Deliberately not ``cache_manager.cache``: the general-purpose cache is a
    Flask-Caching client with no stream commands, so publishing through it would
    fail with an ``AttributeError`` on the first event. The stream methods live
    on the same backend classes the async-query channel uses, and those are
    constructed from a config dict rather than taken from the extension.
    """
    from flask import current_app

    from superset.async_events.cache_backend import (
        RedisCacheBackend,
        RedisSentinelCacheBackend,
    )

    config = current_app.config.get("AI_ASSISTANT_EVENT_BUS_CACHE_CONFIG") or {}
    cache_type = config.get("CACHE_TYPE")

    if cache_type == "RedisCache":
        return RedisCacheBackend.from_config(config)
    if cache_type == "RedisSentinelCache":
        return RedisSentinelCacheBackend.from_config(config)

    raise RuntimeError(
        "AI_ASSISTANT_EVENT_BUS='redis' needs AI_ASSISTANT_EVENT_BUS_CACHE_CONFIG "
        "with CACHE_TYPE set to 'RedisCache' or 'RedisSentinelCache'."
    )


#: One in-process bus per process. Queues are keyed by run, so sharing the bus
#: is what lets a streaming request find the queue an inline run is writing to.
_MEMORY_BUS: MemoryEventBus | None = None


def _memory_bus() -> MemoryEventBus:
    global _MEMORY_BUS  # noqa: PLW0603
    if _MEMORY_BUS is None:
        _MEMORY_BUS = MemoryEventBus()
    return _MEMORY_BUS
