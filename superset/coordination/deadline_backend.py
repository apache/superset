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

"""Private, cancellation-bounded Redis operations for synchronous metadata callers.

Each command owns its async client and loop. Cancelling the command disconnects
its socket; shared coordinator pools and their retry/timeout policy are untouched.
"""

from __future__ import annotations

import asyncio
import math
import time
from contextlib import AsyncExitStack
from typing import Any

from redis.asyncio import Redis
from redis.asyncio.retry import Retry
from redis.asyncio.sentinel import Sentinel
from redis.backoff import NoBackoff
from redis.exceptions import RedisError, TimeoutError as RedisTimeoutError
from superset_core.semantic_layers.metadata import (
    MetadataRefreshError,
    remaining_budget,
)

from superset.coordination.cache_backend import _COMPARE_AND_DELETE_LUA

_COMPARE_AND_PUBLISH_LUA: str = """
if redis.call('get', KEYS[1]) ~= ARGV[1] then
    return 0
end
redis.call('psetex', KEYS[2], ARGV[3], ARGV[2])
redis.call('del', KEYS[1])
return 1
"""

_GET_WITH_TTL_LUA: str = """
return {redis.call('get', KEYS[1]), redis.call('pttl', KEYS[1])}
"""

_GET_OR_CREATE_LUA: str = """
local value = redis.call('get', KEYS[1])
if value then
    return value
end
redis.call('set', KEYS[1], ARGV[1], 'EX', ARGV[2])
return ARGV[1]
"""


class DeadlineRedisBackend:
    """Use the coordinator configuration without sharing mutable connections."""

    def __init__(self, config: dict[str, Any], *, deadline: float) -> None:
        if not math.isfinite(deadline) or config.get("CACHE_TYPE") not in {
            "RedisCache",
            "RedisSentinelCache",
        }:
            raise ValueError("Unsupported metadata coordination configuration")
        self._config: dict[str, Any] = dict(config)
        self._deadline: float = deadline

    def with_deadline(self, deadline: float) -> DeadlineRedisBackend:
        """Create a private call budget without extending the operation ceiling."""
        if not math.isfinite(deadline):
            raise ValueError("Metadata deadline must be finite")
        return DeadlineRedisBackend(
            self._config, deadline=min(self._deadline, deadline)
        )

    def _remaining(self) -> float:
        """Keep the transport's Redis error boundary while sharing SDK validation."""
        try:
            return remaining_budget(self._deadline, now=time.monotonic())
        except MetadataRefreshError:
            raise RedisTimeoutError("Metadata deadline invalid or expired") from None

    async def _command(self, *args: str | int) -> Any:
        remaining: float = self._remaining()
        options: dict[str, Any] = {
            "db": self._config.get("CACHE_REDIS_DB", 0),
            "username": self._config.get("CACHE_REDIS_USER"),
            "password": self._config.get("CACHE_REDIS_PASSWORD"),
            "socket_timeout": remaining,
            "socket_connect_timeout": remaining,
            "retry": Retry(NoBackoff(), 0),
            "protocol": 2,
        }
        if self._config.get("CACHE_REDIS_SSL", False):
            options.update(
                {
                    "ssl": True,
                    "ssl_certfile": self._config.get("CACHE_REDIS_SSL_CERTFILE"),
                    "ssl_keyfile": self._config.get("CACHE_REDIS_SSL_KEYFILE"),
                    "ssl_ca_certs": self._config.get("CACHE_REDIS_SSL_CA_CERTS"),
                    "ssl_cert_reqs": self._config.get(
                        "CACHE_REDIS_SSL_CERT_REQS", "required"
                    ),
                }
            )
        # One cancellation deadline covers DNS, Sentinel discovery, authentication,
        # response parsing (including trickled responses) and connection cleanup.
        stack: AsyncExitStack
        async with asyncio.timeout(remaining), AsyncExitStack() as stack:
            client: Redis
            if self._config["CACHE_TYPE"] == "RedisSentinelCache":
                sentinel: Sentinel = Sentinel(
                    self._config.get("CACHE_REDIS_SENTINELS", [("127.0.0.1", 26379)]),
                    sentinel_kwargs={
                        "password": self._config.get("CACHE_REDIS_SENTINEL_PASSWORD"),
                        "socket_timeout": remaining,
                        "socket_connect_timeout": remaining,
                        "retry": Retry(NoBackoff(), 0),
                        "protocol": 2,
                    },
                    **options,
                )
                sentinel_client: Redis
                for sentinel_client in sentinel.sentinels:
                    stack.push_async_callback(sentinel_client.aclose)
                client = sentinel.master_for(
                    self._config.get("CACHE_REDIS_SENTINEL_MASTER", "mymaster")
                )
            else:
                client = Redis(
                    host=self._config.get("CACHE_REDIS_HOST", "localhost"),
                    port=self._config.get("CACHE_REDIS_PORT", 6379),
                    **options,
                )
            await stack.enter_async_context(client)
            return await client.execute_command(*args)

    def execute(self, *args: str | int) -> Any:
        """Run one command with no automatic retry or detached Redis commands."""
        self._remaining()
        try:
            asyncio.get_running_loop()
        except RuntimeError:
            pass
        else:
            raise RedisError("Metadata backend requires a synchronous caller")
        loop: asyncio.AbstractEventLoop = asyncio.new_event_loop()
        try:
            try:
                return loop.run_until_complete(self._command(*args))
            except TimeoutError:
                raise RedisTimeoutError("Metadata deadline expired") from None
        finally:
            # asyncio.run waits for the default executor on shutdown, including
            # uncancellable system DNS resolution. Closing our private loop does
            # not wait for that resolver. The cancelled command cannot connect or
            # publish when the resolver eventually finishes.
            loop.close()

    def get(self, name: str) -> bytes | None:
        """Read without renewing the entry lifetime."""
        return self.execute("GET", name)

    def set(
        self,
        name: str,
        value: str,
        ex: int | None = None,
        px: int | None = None,
        nx: bool = False,
        xx: bool = False,
    ) -> bool | None:
        """Set a value with explicit expiry and optional ownership conditions."""
        args: list[str | int] = ["SET", name, value]
        if ex is not None:
            args.extend(["EX", ex])
        if px is not None:
            args.extend(["PX", px])
        if nx:
            args.append("NX")
        if xx:
            args.append("XX")
        return self.execute(*args)

    def delete(self, *names: str) -> int:
        """Delete the resolved keys in one operation."""
        return int(self.execute("DEL", *names))

    def compare_and_delete(self, name: str, expected: str) -> int:
        """Release a lease only while its owner still matches."""
        return int(self.execute("EVAL", _COMPARE_AND_DELETE_LUA, 1, name, expected))

    def compare_and_publish(
        self, lease_key: str, expected: str, snapshot_key: str, value: str, ttl_ms: int
    ) -> bool:
        """Publish and release atomically only for the active lease owner."""
        return bool(
            self.execute(
                "EVAL",
                _COMPARE_AND_PUBLISH_LUA,
                2,
                lease_key,
                snapshot_key,
                expected,
                value,
                ttl_ms,
            )
        )

    def get_with_ttl(self, name: str) -> tuple[bytes | None, int]:
        """Observe the value and remaining lifetime from the same entry."""
        result: list[Any] = self.execute("EVAL", _GET_WITH_TTL_LUA, 1, name)
        return result[0], int(result[1])

    def get_or_create(self, name: str, value: str, ttl: int) -> bytes:
        """Initialize an absent generation without extending an existing one."""
        return self.execute("EVAL", _GET_OR_CREATE_LUA, 1, name, value, ttl)
