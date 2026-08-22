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
"""Coordination service implementation.

See :mod:`superset.coordination` for the package overview.
"""

from __future__ import annotations

import logging
import threading
import time
from typing import Any, Callable, TYPE_CHECKING, TypeVar

from flask import current_app
from redis.exceptions import TimeoutError as RedisTimeoutError

from superset.coordination.exceptions import CoordinationBackendUnavailableError
from superset.coordination.types import SignalListener

if TYPE_CHECKING:
    from superset.coordination.types import CoordinationBackend

logger = logging.getLogger(__name__)

T = TypeVar("T")

# Reliable signalling uses Redis Streams: entries are persisted and replayable, so a
# waiter still receives a signal if it subscribes slightly late, reconnects, or
# survives a failover. A signal is a single stream entry; the caller-supplied
# predicate stays the source of truth, so the stream only needs to retain its latest
# entry briefly.
_SIGNAL_STREAM_MAXLEN = 1
# Fallback signal-stream retention (seconds) when the app config is unavailable;
# operators tune it via ``DISTRIBUTED_COORDINATION_SIGNAL_TTL`` (default 24h).
_DEFAULT_SIGNAL_STREAM_TTL_SECONDS = 86400
# Blocking-XREAD chunk: how long each read parks before the loop re-checks the
# deadline. The read returns as soon as an entry lands, so this only bounds the
# no-signal wakeup cadence and can be generous.
_STREAM_BLOCK_MS = 5000
# Shorter chunk for background listeners so stop() and signal detection stay prompt.
_LISTEN_BLOCK_MS = 1000


class CoordinationService:
    """Single entry point for the Valkey/Redis coordination primitives.

    Two layers of API:

    - **Raw primitives** — ``publish`` (best-effort, at-most-once pub/sub),
      ``get`` / ``set`` / ``delete``, ``stream_add`` / ``stream_range``. These are
      backend-only and have no fallback: they raise
      :class:`CoordinationBackendUnavailableError` when no backend is available,
      rather than silently doing nothing. Each accepts an optional ``backend`` so a
      caller with its own connection (Global Async Queries, during the deprecation
      window) can run against it instead of the shared coordinator.
    - **Await / notify** — ``notify`` (signal) plus ``wait_for_signal``
      (blocking) and ``listen_for_signal`` (background), combining a channel with a
      caller-supplied predicate. Signals ride Redis Streams; because stream entries
      are persisted, a waiter that reads slightly late, reconnects, or fails over
      still receives them. With a backend the waiter blocks on the stream and wakes
      when a signal lands (event-driven, no polling); without a backend it polls the
      predicate. The predicate is the source of truth, so a duplicate or already-seen
      signal is harmless.

    All methods are class-level: the service is app-global. Calls resolve the shared
    coordination backend from ``DISTRIBUTED_COORDINATION_CONFIG`` on each call, except
    the raw primitives, which accept an optional ``backend`` so a caller with its own
    connection (Global Async Queries, during the deprecation window) can run against it.

    Distributed locking is *not* exposed here: it has its own user-facing interface
    (:class:`~superset.distributed_lock.DistributedLock`) that uses this service's
    backend when one is defined and falls back to a database-backed lock otherwise.
    """

    @classmethod
    def get_backend(cls) -> "CoordinationBackend | None":
        """Resolve the coordination backend from ``DISTRIBUTED_COORDINATION_CONFIG``.

        Returns the shared coordination connection (via the cache manager), or
        ``None`` when ``DISTRIBUTED_COORDINATION_CONFIG`` is not configured. This is
        the single source of truth for the coordinator's consumers: distributed
        locks, the Global Task Framework (including async chart-data queries), and
        future stream/pub-sub users.
        """
        from superset.extensions import cache_manager

        return cache_manager.distributed_coordination

    @classmethod
    def is_backend_defined(cls) -> bool:
        """Whether a coordination backend is defined.

        Some operations require the Valkey/Redis backend
        (``DISTRIBUTED_COORDINATION_CONFIG``) to be configured; those that do note it
        on their own docstring. Best-effort callers should branch on this before
        invoking a backend-dependent operation instead of catching
        :class:`CoordinationBackendUnavailableError`.
        """
        return cls.get_backend() is not None

    @classmethod
    def _require_backend(
        cls, backend: "CoordinationBackend | None" = None
    ) -> "CoordinationBackend":
        """Return a usable backend or raise if none is available.

        Used by the backend-only primitives (pub/sub publish, key/value, streams)
        so a missing backend fails loudly instead of silently no-op'ing. When
        ``backend`` is supplied (e.g. Global Async Queries passing its own separate
        backend) it is used directly; otherwise the shared coordinator backend is
        resolved via :meth:`get_backend`.
        """
        backend = backend or cls.get_backend()
        if backend is None:
            raise CoordinationBackendUnavailableError(
                "No coordination backend configured; set "
                "DISTRIBUTED_COORDINATION_CONFIG to enable key/value and stream "
                "operations."
            )
        return backend

    # -- Pub/Sub -------------------------------------------------------------

    @classmethod
    def publish(
        cls,
        channel: str,
        message: str,
        backend: "CoordinationBackend | None" = None,
    ) -> int:
        """Best-effort pub/sub publish (**at-most-once** — may be lost).

        Redis pub/sub does not persist messages: if no subscriber is connected at
        publish time, or one disconnects/reconnects/fails over, the message is
        *forever lost*. Use this **only** for loss-tolerant nudges. For any signal a
        receiver must not miss (task completion, abort), use :meth:`notify` (backed by
        Redis Streams) instead.

        Only publishing is offered here — subscribing needs the native connection.

        :param backend: optional explicit backend (see :meth:`_require_backend`).
        :raises CoordinationBackendUnavailableError: if no backend is available.
        """
        return cls._require_backend(backend).publish(channel, message)

    # -- Key/Value -----------------------------------------------------------

    @classmethod
    def get_value(cls, key: str, backend: "CoordinationBackend | None" = None) -> Any:
        """Return the raw (bytes) value at ``key``, or ``None`` if absent.

        :param backend: optional explicit backend (see :meth:`_require_backend`).
        :raises CoordinationBackendUnavailableError: if no backend is available.
        """
        return cls._require_backend(backend).get(key)

    @classmethod
    def set_value(
        cls,
        key: str,
        value: Any,
        ttl: int | None = None,
        if_absent: bool = False,
        if_present: bool = False,
        backend: "CoordinationBackend | None" = None,
    ) -> bool | None:
        """Store ``value`` at ``key``.

        :param ttl: optional expiry, in seconds.
        :param if_absent: only set if the key does not already exist.
        :param if_present: only set if the key already exists.
        :param backend: optional explicit backend (see :meth:`_require_backend`).
        :returns: ``True`` on success, or ``None`` when an ``if_absent`` /
            ``if_present`` condition prevented the write.
        :raises CoordinationBackendUnavailableError: if no backend is available.
        """
        return cls._require_backend(backend).set(
            key, value, ex=ttl, nx=if_absent, xx=if_present
        )

    @classmethod
    def delete_value(
        cls, *keys: str, backend: "CoordinationBackend | None" = None
    ) -> int:
        """Delete one or more keys; returns the number deleted.

        :param backend: optional explicit backend (see :meth:`_require_backend`).
        :raises CoordinationBackendUnavailableError: if no backend is available.
        """
        return cls._require_backend(backend).delete(*keys)

    # -- Streams -------------------------------------------------------------

    @classmethod
    def stream_add(
        cls,
        stream: str,
        data: dict[str, Any],
        event_id: str = "*",
        max_len: int | None = None,
        backend: "CoordinationBackend | None" = None,
    ) -> str:
        """Append an event to a stream; returns the generated event id.

        :param backend: optional explicit backend (see :meth:`_require_backend`).
        :raises CoordinationBackendUnavailableError: if no backend is available.
        """
        return cls._require_backend(backend).xadd(stream, data, event_id, max_len)

    @classmethod
    def stream_range(
        cls,
        stream: str,
        start: str = "-",
        end: str = "+",
        count: int | None = None,
        backend: "CoordinationBackend | None" = None,
    ) -> list[Any]:
        """Read a range of events from a stream.

        :param backend: optional explicit backend (see :meth:`_require_backend`).
        :raises CoordinationBackendUnavailableError: if no backend is available.
        """
        return cls._require_backend(backend).xrange(stream, start, end, count)

    # -- Await / notify ------------------------------------------------------

    @classmethod
    def notify(
        cls,
        channel: str,
        message: str = "1",
        *,
        ttl: int | None = None,
        backend: "CoordinationBackend | None" = None,
    ) -> None:
        """Signal ``channel`` so waiters wake and re-check.

        Appends an entry to the channel's Redis Stream. Because stream entries are
        persisted, a waiter that reads slightly late, reconnects, or fails over still
        receives it. The stream is capped to its latest entry and given a TTL, so
        signal streams for tasks that are never awaited do not accumulate in
        Redis/Valkey. Pair with :meth:`wait_for_signal` / :meth:`listen_for_signal`.

        :param message: small marker stored on the entry; the caller's predicate is
            the source of truth, so this is only a wake-up nudge.
        :param ttl: seconds to retain the signal stream; defaults to
            ``DISTRIBUTED_COORDINATION_SIGNAL_TTL``.
        :param backend: optional explicit backend (see :meth:`_require_backend`).
        :raises CoordinationBackendUnavailableError: if no backend is available.
        """
        backend = cls._require_backend(backend)
        if ttl is None:
            ttl = current_app.config.get(
                "DISTRIBUTED_COORDINATION_SIGNAL_TTL",
                _DEFAULT_SIGNAL_STREAM_TTL_SECONDS,
            )
        backend.xadd(channel, {"m": message}, "*", _SIGNAL_STREAM_MAXLEN)
        backend.expire(channel, ttl)

    @classmethod
    def wait_for_signal(
        cls,
        channel: str,
        check: Callable[[], T | None],
        *,
        timeout: float | None = None,
        poll_interval: float = 1.0,
    ) -> T:
        """Block until ``check()`` returns a non-``None`` value; return that value.

        ``check`` is the source of truth (typically a metastore read). With a
        coordination backend, this waits on ``channel``'s Redis Stream and re-runs
        ``check`` when a signal (:meth:`notify`) lands — event-driven, no
        polling. Without a backend it polls ``check`` every ``poll_interval``
        seconds.

        :param channel: stream that peers :meth:`notify` when the awaited state is
            reached.
        :param check: returns a truthy result once satisfied, else ``None``.
        :param timeout: max seconds to wait; ``None`` waits indefinitely.
        :param poll_interval: poll cadence for the no-backend fallback.
        :raises TimeoutError: if ``timeout`` elapses before ``check`` is satisfied.
        """
        deadline = None if timeout is None else time.monotonic() + timeout
        # Fast path: already satisfied → return without touching the backend.
        if (result := check()) is not None:
            return result
        backend = cls.get_backend()
        if backend is None:
            return cls._poll_until(channel, check, deadline, poll_interval)
        # Capture the stream position, then re-check: a signal that lands between the
        # fast-path check and now is caught here (peers write the authoritative state
        # before they notify); anything after is delivered by the blocking read.
        last_id = backend.stream_last_id(channel)
        if (result := check()) is not None:
            return result
        while True:
            remaining = cls._remaining(deadline, channel)
            last_id = cls._read_stream(
                backend,
                channel,
                last_id,
                cls._bounded_block_ms(_STREAM_BLOCK_MS, remaining),
            )
            if (result := check()) is not None:
                return result

    @staticmethod
    def _remaining(deadline: float | None, channel: str) -> float | None:
        """Seconds left before ``deadline``; raise ``TimeoutError`` if already past."""
        if deadline is None:
            return None
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError(f"Timed out waiting on {channel}")
        return remaining

    @classmethod
    def _poll_until(
        cls,
        channel: str,
        check: Callable[[], T | None],
        deadline: float | None,
        poll_interval: float,
    ) -> T:
        """No-backend fallback: poll ``check`` every ``poll_interval`` seconds."""
        while True:
            remaining = cls._remaining(deadline, channel)
            time.sleep(
                poll_interval if remaining is None else min(poll_interval, remaining)
            )
            if (result := check()) is not None:
                return result

    @staticmethod
    def _bounded_block_ms(block_ms: int, remaining: float | None) -> int:
        """Clamp a blocking-read duration (ms) to the time left before the deadline."""
        if remaining is None:
            return block_ms
        return max(1, min(block_ms, int(remaining * 1000)))

    @classmethod
    def _read_stream(
        cls,
        backend: "CoordinationBackend",
        channel: str,
        last_id: str,
        block_ms: int,
    ) -> str:
        """Block for the next entry on ``channel``; return the new last-seen id.

        A socket timeout mid-block means "nothing arrived yet": the caller re-checks
        the predicate and reads again, so a short ``socket_timeout`` only affects
        cadence, never correctness.
        """
        try:
            entries = backend.xread({channel: last_id}, block_ms=block_ms)
        except (RedisTimeoutError, OSError):
            return last_id
        for _stream, items in entries:
            if items:
                new_id = items[-1][0]
                last_id = new_id.decode() if isinstance(new_id, bytes) else new_id
        return last_id

    @classmethod
    def listen_for_signal(
        cls,
        channel: str,
        check: Callable[[], bool],
        on_signal: Callable[[], None],
        *,
        poll_interval: float,
        name: str | None = None,
    ) -> SignalListener:
        """Run a background daemon that invokes ``on_signal`` once ``check`` is true.

        Same model as :meth:`wait_for_signal`: with a backend it waits on
        ``channel``'s Redis Stream (event-driven); without one it polls ``check``
        every ``poll_interval`` seconds. The thread stops after firing ``on_signal``
        once, or when :meth:`SignalListener.stop` is called.

        :param channel: stream peers :meth:`notify` when the condition is met.
        :param check: returns ``True`` once ``on_signal`` should fire.
        :param on_signal: invoked (once) when ``check`` becomes true.
        :param poll_interval: poll cadence for the no-backend fallback.
        :param name: optional thread name suffix for logging.
        """
        stop_event = threading.Event()
        thread = threading.Thread(
            target=cls._run_listen_loop,
            args=(channel, check, on_signal, stop_event, poll_interval),
            daemon=True,
            name=f"coord-listen-{name or channel}",
        )
        thread.start()
        return SignalListener(thread, stop_event)

    @classmethod
    def _run_listen_loop(
        cls,
        channel: str,
        check: Callable[[], bool],
        on_signal: Callable[[], None],
        stop_event: threading.Event,
        poll_interval: float,
    ) -> None:
        """Body of the background listener thread (see :meth:`listen_for_signal`)."""
        backend = cls.get_backend()
        # Baseline before the first check (see wait_for_signal), so a signal that
        # lands between capturing it and the first check is not missed.
        last_id = backend.stream_last_id(channel) if backend is not None else "0-0"
        try:
            while not stop_event.is_set():
                if check():
                    on_signal()
                    return
                if backend is not None:
                    last_id = cls._read_stream(
                        backend, channel, last_id, _LISTEN_BLOCK_MS
                    )
                else:
                    stop_event.wait(timeout=poll_interval)
        except Exception:  # pylint: disable=broad-except
            if not stop_event.is_set():
                logger.exception("Signal listener on %s crashed", channel)
