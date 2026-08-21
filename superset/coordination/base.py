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

from superset.coordination.exceptions import CoordinationBackendUnavailableError
from superset.coordination.types import SignalListener
from superset.coordination.utils import close_pubsub

if TYPE_CHECKING:
    from superset.coordination.types import CoordinationBackend

logger = logging.getLogger(__name__)

T = TypeVar("T")

# Poll cadence for the pub/sub wait loop: how long each ``get_message`` blocks
# before the loop re-checks the predicate, the timeout, and the stop flag. Keeps
# stop latency and missed-message recovery bounded to ~1s.
_PUBSUB_TICK_SECONDS = 1.0


class CoordinationService:
    """Single entry point for the Valkey/Redis coordination primitives.

    Two layers of API:

    - **Raw primitives** — ``publish``, ``get`` / ``set`` / ``delete``,
      ``stream_add`` / ``stream_range``. These are backend-only and have no fallback:
      they raise :class:`CoordinationBackendUnavailableError` when no backend is
      available, rather than silently doing nothing. Each accepts an optional
      ``backend`` so a caller with its own connection (Global Async Queries, during
      the deprecation window) can run against it instead of the shared coordinator.
    - **Higher-level await/notify** — ``wait_for_signal`` (blocking) and
      ``listen_for_signal`` (background). These combine a pub/sub channel with a
      caller-supplied predicate:
      when a backend is defined they wake promptly on a published message and
      re-check the predicate each tick; without a backend they poll the predicate.
      This keeps the pub/sub-vs-poll boilerplate in one place; callers just supply a
      channel and a check.

    All methods are class-level: the service is app-global and resolves its backend
    from the shared coordination connection on each call.

    Distributed locking is *not* exposed here: it has its own user-facing interface
    (:class:`~superset.distributed_lock.DistributedLock`) that uses this service's
    backend when one is defined and falls back to a database-backed lock otherwise.
    """

    @classmethod
    def get_backend(cls) -> "CoordinationBackend | None":
        """Resolve the coordination backend from ``DISTRIBUTED_COORDINATION_CONFIG``.

        Returns the shared coordination connection (via the cache manager), or
        ``None`` when ``DISTRIBUTED_COORDINATION_CONFIG`` is not configured. This is
        the single source of truth for the coordinator's consumers (distributed
        locks, the Global Task Framework, and future stream/pub-sub users); it does
        *not* consult the deprecated ``GLOBAL_ASYNC_QUERIES_CACHE_BACKEND``. Global
        Async Queries resolve their own backend (this coordinator when configured,
        else the deprecated dedicated backend — see
        :class:`~superset.async_events.async_query_manager.AsyncQueryManager`) and pass
        it explicitly to the primitives below via ``backend``.
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
        """Publish a message to a channel; returns the subscriber count.

        Only publishing is offered here — subscribing needs the native connection
        (a long-lived subscription with its own receive loop), so consumers that
        subscribe should obtain it via :meth:`get_backend`.

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
    def wait_for_signal(
        cls,
        channel: str,
        check: Callable[[], T | None],
        *,
        timeout: float | None = None,
        poll_interval: float = 1.0,
    ) -> T:
        """Block until ``check()`` returns a non-``None`` value; return that value.

        ``check`` is the source of truth (typically a metastore read). When a
        coordination backend is defined, this subscribes to ``channel`` and re-runs
        ``check`` promptly whenever a message is published; otherwise it polls
        ``check`` every ``poll_interval`` seconds. ``check`` is also re-evaluated on
        every tick even in pub/sub mode, so a signal published before the subscription
        (or a dropped message) is still caught.

        :param channel: pub/sub channel that peers publish to when the awaited state
            is reached (used only as a low-latency wake-up; correctness relies on
            ``check``).
        :param check: returns a truthy result once the wait is satisfied, else
            ``None``.
        :param timeout: max seconds to wait; ``None`` waits indefinitely.
        :param poll_interval: poll cadence when no backend is defined.
        :raises TimeoutError: if ``timeout`` elapses before ``check`` is satisfied.
        """
        deadline = None if timeout is None else time.monotonic() + timeout
        # Check first, before touching the backend: if the awaited state is already
        # reached (e.g. the task is already terminal), return straight from the
        # source of truth so the fast path never requires the backend to be reachable.
        if (result := check()) is not None:
            return result
        backend = cls.get_backend()
        pubsub = backend.pubsub() if backend is not None else None
        try:
            if pubsub is not None:
                pubsub.subscribe(channel)
            while True:
                # Re-check every tick even in pub/sub mode, so a signal published
                # before the subscription (or a dropped message) is still caught.
                if (result := check()) is not None:
                    return result
                remaining = (
                    None if deadline is None else max(0.0, deadline - time.monotonic())
                )
                if remaining is not None and remaining <= 0:
                    raise TimeoutError(f"Timed out waiting on channel {channel}")
                cls._wait_tick(pubsub, poll_interval, remaining)
        finally:
            if pubsub is not None:
                close_pubsub(pubsub)

    @staticmethod
    def _wait_tick(pubsub: Any, poll_interval: float, remaining: float | None) -> None:
        """Block for one wait tick: a pub/sub message (nudge) or a poll sleep."""
        if pubsub is not None:
            wait = (
                _PUBSUB_TICK_SECONDS
                if remaining is None
                else min(_PUBSUB_TICK_SECONDS, remaining)
            )
            pubsub.get_message(ignore_subscribe_messages=True, timeout=wait)
        else:
            time.sleep(
                poll_interval if remaining is None else min(poll_interval, remaining)
            )

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

        Same wake-vs-poll model as :meth:`wait_for_signal`: a published message on
        ``channel`` wakes the loop when a backend is defined, otherwise it polls
        ``check`` every ``poll_interval`` seconds. The thread stops after firing
        ``on_signal`` once, or when :meth:`SignalListener.stop` is called.

        :param channel: pub/sub channel peers publish to when the condition is met.
        :param check: returns ``True`` once ``on_signal`` should fire.
        :param on_signal: invoked (once) when ``check`` becomes true.
        :param poll_interval: poll cadence when no backend is defined.
        :param name: optional thread name suffix for logging.
        """
        stop_event = threading.Event()
        backend = cls.get_backend()
        pubsub = backend.pubsub() if backend is not None else None
        if pubsub is not None:
            # Subscribe in the caller's thread so a connection failure surfaces here
            # (fail-fast) rather than dying silently in the daemon thread.
            try:
                pubsub.subscribe(channel)
            except Exception:
                close_pubsub(pubsub)
                raise
        thread = threading.Thread(
            target=cls._run_listen_loop,
            args=(channel, check, on_signal, stop_event, poll_interval, pubsub),
            daemon=True,
            name=f"coord-listen-{name or channel}",
        )
        thread.start()
        return SignalListener(thread, stop_event, pubsub)

    @classmethod
    def _run_listen_loop(
        cls,
        channel: str,
        check: Callable[[], bool],
        on_signal: Callable[[], None],
        stop_event: threading.Event,
        poll_interval: float,
        pubsub: Any,
    ) -> None:
        """Body of the background listener thread (see :meth:`listen_for_signal`)."""
        try:
            while not stop_event.is_set():
                try:
                    if check():
                        on_signal()
                        return
                    if pubsub is not None:
                        # Blocks up to a tick; the message is just a wake-up nudge.
                        pubsub.get_message(
                            ignore_subscribe_messages=True,
                            timeout=_PUBSUB_TICK_SECONDS,
                        )
                    else:
                        stop_event.wait(timeout=poll_interval)
                except (ValueError, OSError) as ex:
                    # Connection torn down (e.g. stop() closing the subscription, or
                    # shutdown). Expected when stopping; otherwise surface it and bail.
                    if not stop_event.is_set():
                        logger.error(
                            "Signal listener on %s failed: %s",
                            channel,
                            ex,
                            exc_info=True,
                        )
                    return
        except Exception:  # pylint: disable=broad-except
            if not stop_event.is_set():
                logger.exception("Signal listener on %s crashed", channel)
        finally:
            if pubsub is not None:
                close_pubsub(pubsub)
