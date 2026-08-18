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
"""Centralized coordination service.

Provides one connection (``DISTRIBUTED_COORDINATION_CONFIG``) and one interface for
the Valkey/Redis coordination primitives Superset relies on: **pub/sub**, **key/value**,
and event **streams**, plus a higher-level **await/notify** layer (``wait_for_signal`` /
``listen_for_signal``) built on top of them. Distributed **locking** is served by
:class:`~superset.distributed_lock.DistributedLock`, which draws on this service's
backend when one is configured and falls back to a database-backed lock otherwise.

Historically these were wired up independently: the Global Task Framework used
``DISTRIBUTED_COORDINATION_CONFIG`` (pub/sub and locking) while Global Async Queries
used a separate ``GLOBAL_ASYNC_QUERIES_CACHE_BACKEND`` for its streams, and each caller
hand-rolled its own pub/sub-vs-poll wait loops. Consolidating them here keeps the
architecture modular, gives other components (e.g. the extensions framework) a single
reusable coordination surface, and reduces the number of moving parts. The legacy
``GLOBAL_ASYNC_QUERIES_CACHE_BACKEND`` is still honored as a fallback (with a
deprecation warning) so existing deployments keep working during the transition.
"""

from __future__ import annotations

import logging
import threading
import time
from typing import Any, Callable, TYPE_CHECKING, TypeVar

from superset.coordination.exceptions import CoordinationBackendUnavailableError

if TYPE_CHECKING:
    from superset.async_events.cache_backend import (
        RedisCacheBackend,
        RedisSentinelCacheBackend,
    )

    CoordinationBackend = RedisCacheBackend | RedisSentinelCacheBackend

logger = logging.getLogger(__name__)

T = TypeVar("T")

# Poll cadence for the pub/sub wait loop: how long each ``get_message`` blocks
# before the loop re-checks the predicate, the timeout, and the stop flag. Keeps
# stop latency and missed-message recovery bounded to ~1s.
_PUBSUB_TICK_SECONDS = 1.0


class SignalListener:
    """Handle for a background listener started by
    :meth:`CoordinationService.listen_for_signal`.

    Wraps the daemon thread, its stop flag, and (in pub/sub mode) the subscription.
    :meth:`stop` sets the flag and closes the subscription so a thread blocked in
    ``get_message`` wakes immediately, then joins.
    """

    def __init__(
        self,
        thread: threading.Thread,
        stop_event: threading.Event,
        pubsub: Any = None,
    ) -> None:
        self._thread = thread
        self._stop_event = stop_event
        self._pubsub = pubsub

    def stop(self) -> None:
        """Signal the listener to stop and wait briefly for the thread to finish."""
        self._stop_event.set()
        # Closing the subscription unblocks a thread parked in get_message so
        # teardown is near-immediate rather than waiting a full poll tick.
        if self._pubsub is not None:
            _close_pubsub(self._pubsub)
        if self._thread.is_alive():
            self._thread.join(timeout=2.0)
            if self._thread.is_alive():
                # Daemon thread: it will be reaped at process exit. Don't block.
                logger.warning(
                    "Signal listener thread %s did not terminate within 2s.",
                    self._thread.name,
                )


class CoordinationService:
    """Single entry point for the Valkey/Redis coordination primitives.

    Two layers of API:

    - **Raw primitives** — ``publish``, ``get`` / ``set`` / ``delete``,
      ``stream_add`` / ``stream_range``. These are backend-only and have no fallback:
      they raise :class:`CoordinationBackendUnavailableError` when no backend is
      configured, rather than silently doing nothing.
    - **Higher-level await/notify** — ``wait_for_signal`` (blocking) and
      ``listen_for_signal`` (background). These combine a pub/sub channel with a
      caller-supplied predicate:
      when a backend is defined they wake promptly on a published message, and either
      way they fall back to polling the predicate. This keeps the pub/sub-vs-poll
      boilerplate in one place; callers just supply a channel and a check.

    All methods are class-level: the service is app-global and resolves its backend
    from the shared coordination connection on each call.

    Distributed locking is *not* exposed here: it has its own user-facing interface
    (:class:`~superset.distributed_lock.DistributedLock`) that uses this service's
    backend when one is defined and falls back to a database-backed lock otherwise.
    """

    _legacy_backend: "CoordinationBackend | None" = None
    _legacy_warning_emitted: bool = False

    @classmethod
    def get_backend(cls) -> "CoordinationBackend | None":
        """Resolve the coordination backend.

        Prefers ``DISTRIBUTED_COORDINATION_CONFIG`` (via the cache manager). Falls
        back to the deprecated ``GLOBAL_ASYNC_QUERIES_CACHE_BACKEND`` when only that
        is configured, emitting a one-time deprecation warning. Returns ``None`` when
        neither is configured.
        """
        from superset.extensions import cache_manager

        if (backend := cache_manager.distributed_coordination) is not None:
            return backend
        return cls._get_legacy_backend()

    @classmethod
    def _get_legacy_backend(cls) -> "CoordinationBackend | None":
        if cls._legacy_backend is not None:
            return cls._legacy_backend

        from flask import current_app

        if not current_app.config.get("GLOBAL_ASYNC_QUERIES_CACHE_BACKEND", {}).get(
            "CACHE_TYPE"
        ):
            return None

        if not cls._legacy_warning_emitted:
            logger.warning(
                "GLOBAL_ASYNC_QUERIES_CACHE_BACKEND is deprecated and will be "
                "removed in Superset 8.0; configure DISTRIBUTED_COORDINATION_CONFIG "
                "instead so a single connection powers distributed locks, pub/sub, "
                "and streams."
            )
            cls._legacy_warning_emitted = True

        from superset.async_events.async_query_manager import get_cache_backend

        cls._legacy_backend = get_cache_backend(current_app.config)
        return cls._legacy_backend

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
    def _require_backend(cls) -> "CoordinationBackend":
        """Return the backend or raise if none is configured.

        Used by the backend-only primitives (pub/sub publish, key/value, streams)
        so a missing backend fails loudly instead of silently no-op'ing.
        """
        backend = cls.get_backend()
        if backend is None:
            raise CoordinationBackendUnavailableError(
                "No coordination backend configured; set "
                "DISTRIBUTED_COORDINATION_CONFIG to enable key/value and stream "
                "operations."
            )
        return backend

    # -- Pub/Sub -------------------------------------------------------------

    @classmethod
    def publish(cls, channel: str, message: str) -> int:
        """Publish a message to a channel; returns the subscriber count.

        Only publishing is offered here — subscribing needs the native connection
        (a long-lived subscription with its own receive loop), so consumers that
        subscribe should obtain it via :meth:`get_backend`.

        :raises CoordinationBackendUnavailableError: if no backend is configured.
        """
        return cls._require_backend().publish(channel, message)

    # -- Key/Value -----------------------------------------------------------

    @classmethod
    def get_value(cls, key: str) -> Any:
        """Return the raw (bytes) value at ``key``, or ``None`` if absent.

        :raises CoordinationBackendUnavailableError: if no backend is configured.
        """
        return cls._require_backend().get(key)

    @classmethod
    def set_value(
        cls,
        key: str,
        value: Any,
        ttl: int | None = None,
        if_absent: bool = False,
        if_present: bool = False,
    ) -> bool | None:
        """Store ``value`` at ``key``.

        :param ttl: optional expiry, in seconds.
        :param if_absent: only set if the key does not already exist.
        :param if_present: only set if the key already exists.
        :returns: ``True`` on success, or ``None`` when an ``if_absent`` /
            ``if_present`` condition prevented the write.
        :raises CoordinationBackendUnavailableError: if no backend is configured.
        """
        return cls._require_backend().set(
            key, value, ex=ttl, nx=if_absent, xx=if_present
        )

    @classmethod
    def delete_value(cls, *keys: str) -> int:
        """Delete one or more keys; returns the number deleted.

        :raises CoordinationBackendUnavailableError: if no backend is configured.
        """
        return cls._require_backend().delete(*keys)

    # -- Streams -------------------------------------------------------------

    @classmethod
    def stream_add(
        cls,
        stream: str,
        data: dict[str, Any],
        event_id: str = "*",
        max_len: int | None = None,
    ) -> str:
        """Append an event to a stream; returns the generated event id.

        :raises CoordinationBackendUnavailableError: if no backend is configured.
        """
        return cls._require_backend().xadd(stream, data, event_id, max_len)

    @classmethod
    def stream_range(
        cls,
        stream: str,
        start: str = "-",
        end: str = "+",
        count: int | None = None,
    ) -> list[Any]:
        """Read a range of events from a stream.

        :raises CoordinationBackendUnavailableError: if no backend is configured.
        """
        return cls._require_backend().xrange(stream, start, end, count)

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
        backend = cls.get_backend()
        pubsub = backend.pubsub() if backend is not None else None
        try:
            if pubsub is not None:
                pubsub.subscribe(channel)
            while True:
                # ``check`` is the source of truth; run it first so the fast path and
                # any signal missed before subscribing are both covered.
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
                _close_pubsub(pubsub)

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
                _close_pubsub(pubsub)
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
        """Body of the background listener thread (see :meth:`listen`)."""
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
                _close_pubsub(pubsub)


def _close_pubsub(pubsub: Any) -> None:
    """Best-effort unsubscribe + close of a pub/sub subscription."""
    try:
        pubsub.unsubscribe()
        pubsub.close()
    except Exception as ex:  # pylint: disable=broad-except
        logger.debug("Error closing pub/sub subscription: %s", ex)
