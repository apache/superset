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
from typing import TYPE_CHECKING

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

    Wraps the daemon thread and its stop flag. :meth:`stop` sets the flag and joins;
    the listener's bounded blocking read means it notices the flag within one short
    tick.
    """

    def __init__(
        self,
        thread: threading.Thread,
        stop_event: threading.Event,
    ) -> None:
        self._thread = thread
        self._stop_event = stop_event

    def stop(self) -> None:
        """Signal the listener to stop and wait briefly for the thread to finish."""
        self._stop_event.set()
        if self._thread.is_alive():
            self._thread.join(timeout=2.0)
            if self._thread.is_alive():
                # Daemon thread: it will be reaped at process exit. Don't block.
                logger.warning(
                    "Signal listener thread %s did not terminate within 2s.",
                    self._thread.name,
                )
