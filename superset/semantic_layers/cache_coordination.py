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

"""Ownership-safe coordination for semantic-cache descriptor mutations."""

import logging
import math
from collections.abc import Callable
from dataclasses import dataclass
from random import random
from threading import Event, Thread
from time import monotonic, sleep
from typing import Protocol, runtime_checkable
from uuid import uuid4

from redis.exceptions import RedisError

from superset.semantic_layers.cache_repository import SemanticCacheCoordinationError

SEMANTIC_CACHE_COORDINATION_FAILURE_METRIC: str = (
    "semantic_cache.containment.coordination_failure"
)
logger: logging.Logger = logging.getLogger(__name__)


@runtime_checkable
class OwnerTokenCoordinationBackend(Protocol):
    """Atomic lease operations required from a coordination backend."""

    def acquire_owner_token(
        self,
        key: str,
        owner_token: str,
        lease_seconds: int,
    ) -> bool: ...  # pragma: no cover

    def release_owner_token(
        self,
        key: str,
        owner_token: str,
    ) -> bool: ...  # pragma: no cover

    def refresh_owner_token(
        self,
        key: str,
        owner_token: str,
        lease_seconds: int,
    ) -> bool: ...  # pragma: no cover


@dataclass(frozen=True)
class SemanticCacheCoordinationSettings:
    """Validated bounded timing settings for descriptor leases."""

    wait_seconds: float
    lease_seconds: int

    def __post_init__(self) -> None:
        if (
            isinstance(self.wait_seconds, bool)
            or not isinstance(self.wait_seconds, (int, float))
            or not math.isfinite(self.wait_seconds)
            or self.wait_seconds < 0
        ):
            raise ValueError(
                "Coordination wait seconds must be finite and non-negative"
            )
        if (
            isinstance(self.lease_seconds, bool)
            or not isinstance(self.lease_seconds, int)
            or self.lease_seconds <= 0
        ):
            raise ValueError("Coordination lease seconds must be positive")


class SemanticCacheCoordinator:
    """Run descriptor mutations while holding an owner-token lease."""

    def __init__(
        self,
        backend: OwnerTokenCoordinationBackend,
        settings: SemanticCacheCoordinationSettings,
        *,
        clock: Callable[[], float] = monotonic,
        sleeper: Callable[[float], None] = sleep,
        token_factory: Callable[[], str] = lambda: uuid4().hex,
        failure_metric: Callable[[str], None] | None = None,
        jitter: Callable[[], float] = random,
    ) -> None:
        self._backend: OwnerTokenCoordinationBackend = backend
        self._settings: SemanticCacheCoordinationSettings = settings
        self._clock: Callable[[], float] = clock
        self._sleeper: Callable[[float], None] = sleeper
        self._token_factory: Callable[[], str] = token_factory
        self._failure_metric: Callable[[str], None] = failure_metric or (lambda _: None)
        self._jitter: Callable[[], float] = jitter

    def _failure(self, message: str, cause: RedisError | None = None) -> None:
        self._record_failure()
        error: SemanticCacheCoordinationError = SemanticCacheCoordinationError(message)
        if cause is None:
            raise error
        raise error from cause

    def _record_failure(self) -> None:
        try:
            self._failure_metric(SEMANTIC_CACHE_COORDINATION_FAILURE_METRIC)
        except Exception:  # pylint: disable=broad-exception-caught
            logger.debug("Semantic cache coordination metric failed", exc_info=True)

    def _run_with_renewal(
        self,
        lease_key: str,
        owner_token: str,
        operation: Callable[[], None],
    ) -> bool:
        renewal_stopped: Event = Event()
        renewal_failed: Event = Event()

        def renew_lease() -> None:
            interval: float = self._settings.lease_seconds / 3
            while not renewal_stopped.wait(interval):
                try:
                    refreshed: bool = self._backend.refresh_owner_token(
                        lease_key,
                        owner_token,
                        self._settings.lease_seconds,
                    )
                except RedisError:
                    renewal_failed.set()
                    return
                if not refreshed:
                    renewal_failed.set()
                    return

        renewal_thread: Thread = Thread(
            target=renew_lease,
            name="semantic-cache-lease-renewal",
            daemon=True,
        )
        renewal_thread.start()
        try:
            operation()
        finally:
            renewal_stopped.set()
            renewal_thread.join()
        return renewal_failed.is_set()

    def mutate(self, key: str, operation: Callable[[], None]) -> bool:
        """Acquire a bounded lease, mutate, and release only our ownership."""
        lease_key: str = f"semantic-cache-lock:{key}"
        owner_token: str = self._token_factory()
        deadline: float = self._clock() + self._settings.wait_seconds
        acquired: bool = False
        while True:
            try:
                acquired = self._backend.acquire_owner_token(
                    lease_key,
                    owner_token,
                    self._settings.lease_seconds,
                )
            except RedisError as ex:
                self._failure("Semantic cache lease acquisition failed", ex)
            if acquired:
                break
            remaining: float = deadline - self._clock()
            if remaining <= 0:
                self._record_failure()
                return False
            # Jitter the spin so a herd of waiters released by one lease
            # expiry does not retry in lockstep; the wait stays within 50 ms.
            self._sleeper(min(0.025 + 0.025 * self._jitter(), remaining))

        renewal_failed: bool
        try:
            renewal_failed = self._run_with_renewal(
                lease_key,
                owner_token,
                operation,
            )
        finally:
            try:
                released: bool = self._backend.release_owner_token(
                    lease_key,
                    owner_token,
                )
            except RedisError as ex:
                self._failure("Semantic cache lease release failed", ex)
            if not released:
                self._failure("Semantic cache lease ownership was lost")
        if renewal_failed:
            self._failure("Semantic cache lease renewal failed")
        return True
