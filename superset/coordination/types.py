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
"""Types for the coordination service."""

from __future__ import annotations

import logging
import threading
from typing import Callable, TYPE_CHECKING

if TYPE_CHECKING:
    from superset.coordination.cache_backend import (
        RedisCacheBackend,
        RedisSentinelCacheBackend,
    )

    # The concrete coordination backend resolved from DISTRIBUTED_COORDINATION_CONFIG.
    CoordinationBackend = RedisCacheBackend | RedisSentinelCacheBackend

logger = logging.getLogger(__name__)


class SignalListener:
    """Handle for a background listener started by
    :meth:`~superset.coordination.base.CoordinationService.listen_for_signal`.

    Wraps the daemon thread and its stop flag. :meth:`stop` sets the flag and,
    when a ``wake`` is provided, nudges the backend stream so a listener parked in
    a blocking read returns at once rather than waiting out its block interval —
    keeping task teardown from paying the full read timeout.
    """

    def __init__(
        self,
        thread: threading.Thread,
        stop_event: threading.Event,
        wake: "Callable[[], None] | None" = None,
    ) -> None:
        self._thread = thread
        self._stop_event = stop_event
        self._wake = wake

    def stop(self) -> None:
        """Signal the listener to stop and wait briefly for the thread to finish."""
        self._stop_event.set()
        # Wake a listener blocked in a backend read so it observes the stop flag
        # immediately (the no-backend loop already wakes on the event). Fire the
        # nudge on a daemon thread: it does a synchronous Redis write, which could
        # hang on a degraded backend with no socket timeout, and stop() must stay
        # bounded by the join below regardless. Best-effort — a failed/slow nudge
        # just falls back to the bounded join + daemon reap.
        if self._wake is not None:
            threading.Thread(
                target=self._safe_wake, daemon=True, name="coord-listen-wake"
            ).start()
        if self._thread.is_alive():
            self._thread.join(timeout=2.0)
            if self._thread.is_alive():
                # Daemon thread: it will be reaped at process exit. Don't block.
                logger.warning(
                    "Signal listener thread %s did not terminate within 2s.",
                    self._thread.name,
                )

    def _safe_wake(self) -> None:
        """Run the wake nudge, swallowing errors (best-effort accelerator)."""
        try:
            if self._wake is not None:
                self._wake()
        except Exception:  # pylint: disable=broad-except
            logger.debug("Signal listener wake nudge failed", exc_info=True)
