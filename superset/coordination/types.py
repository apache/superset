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
from typing import Any, TYPE_CHECKING

from superset.coordination.utils import close_pubsub

if TYPE_CHECKING:
    from superset.async_events.cache_backend import (
        RedisCacheBackend,
        RedisSentinelCacheBackend,
    )

    # The concrete coordination backend resolved from DISTRIBUTED_COORDINATION_CONFIG.
    CoordinationBackend = RedisCacheBackend | RedisSentinelCacheBackend

logger = logging.getLogger(__name__)


class SignalListener:
    """Handle for a background listener started by
    :meth:`~superset.coordination.base.CoordinationService.listen_for_signal`.

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
            close_pubsub(self._pubsub)
        if self._thread.is_alive():
            self._thread.join(timeout=2.0)
            if self._thread.is_alive():
                # Daemon thread: it will be reaped at process exit. Don't block.
                logger.warning(
                    "Signal listener thread %s did not terminate within 2s.",
                    self._thread.name,
                )
