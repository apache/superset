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
from __future__ import annotations

from typing import Any

import redis
from flask_caching.backends.rediscache import RedisCache, RedisSentinelCache
from redis.sentinel import Sentinel

# Atomic compare-and-delete: delete the key only if its current value still
# equals the caller's token. Runs server-side in one round trip, so it closes
# the TTL-expiry race a separate GET-then-DEL leaves open (the key expiring and
# being re-acquired by another holder between the two calls). Returns 1 if the
# key was deleted, 0 otherwise.
_COMPARE_AND_DELETE_LUA = """
if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('del', KEYS[1])
else
    return 0
end
"""


class RedisCommandsMixin:
    """Coordination commands issued against the backend's ``redis.Redis`` client.

    Both cache backends here wrap a plain ``redis.Redis`` handle in ``self._cache``
    (a direct connection, or a Sentinel-resolved master), so every coordination
    primitive is identical between them and lives here once. Each concrete backend
    contributes only its connection setup (``__init__`` / ``from_config``).

    Mixed in *before* the flask-caching base class so these implementations take
    precedence over the cache-oriented ``get``/``set``/``delete`` it defines: the
    coordination service needs the raw Redis semantics (``nx``/``xx``, byte values),
    not flask-caching's serializing variants.
    """

    # Cap on entries returned by :meth:`xrange` when the caller gives no count.
    MAX_EVENT_COUNT = 100

    _cache: redis.Redis

    def set(
        self,
        name: str,
        value: Any,
        ex: int | None = None,
        px: int | None = None,
        nx: bool = False,
        xx: bool = False,
    ) -> bool | None:
        """
        Set the value at key ``name``.

        :param name: Key name
        :param value: Value to set
        :param ex: Expire time in seconds
        :param px: Expire time in milliseconds
        :param nx: If True, set only if key does not exist
        :param xx: If True, set only if key already exists
        :returns: True if set successfully, None if nx/xx condition not met
        """
        return self._cache.set(name, value, ex=ex, px=px, nx=nx, xx=xx)

    def get(self, name: str) -> Any:
        """
        Get the raw value at key ``name``.

        :param name: Key name
        :returns: The stored value (bytes), or None if the key is absent
        """
        return self._cache.get(name)

    def delete(self, *names: str) -> int:
        """
        Delete one or more keys.

        :param names: Key names to delete
        :returns: Number of keys deleted
        """
        return self._cache.delete(*names)

    def compare_and_delete(self, name: str, expected: str) -> int:
        """
        Atomically delete ``name`` only if its value still equals ``expected``.

        :param name: Key name
        :param expected: The value the key must currently hold to be deleted
        :returns: 1 if the key was deleted, 0 otherwise
        """
        return int(self._cache.eval(_COMPARE_AND_DELETE_LUA, 1, name, expected))

    def publish(self, channel: str, message: str) -> int:
        """
        Publish a message to a Redis pub/sub channel.

        :param channel: The channel name to publish to
        :param message: The message to publish
        :returns: Number of subscribers that received the message
        """
        return self._cache.publish(channel, message)

    def pubsub(self) -> redis.client.PubSub:
        """
        Create a pub/sub subscription object.

        :returns: PubSub object for subscribing to channels
        """
        return self._cache.pubsub()

    def xadd(
        self,
        stream_name: str,
        event_data: dict[str, Any],
        event_id: str = "*",
        maxlen: int | None = None,
    ) -> str:
        return self._cache.xadd(stream_name, event_data, event_id, maxlen)

    def xrange(
        self,
        stream_name: str,
        start: str = "-",
        end: str = "+",
        count: int | None = None,
    ) -> list[Any]:
        count = count or self.MAX_EVENT_COUNT
        return self._cache.xrange(stream_name, start, end, count)

    def xread(
        self,
        streams: dict[str, str],
        count: int | None = None,
        block_ms: int | None = None,
    ) -> list[Any]:
        """
        Read new entries from one or more streams, optionally blocking.

        Reliable, event-driven delivery: pass the last id already seen per stream
        and this returns only entries added *after* it — so a signal is never
        missed, even across reconnects (unlike pub/sub). ``block_ms`` blocks up to
        that many milliseconds waiting for a new entry (``None``/``0`` returns
        immediately).

        :param streams: mapping of ``{stream_name: last_id_seen}``
        :param count: max entries to return
        :param block_ms: milliseconds to block for a new entry (``None`` = no block)
        :returns: redis-py XREAD reply — ``[[stream, [(id, {field: value}), ...]]]``
            — or an empty list when nothing arrived before the block elapsed
        """
        return self._cache.xread(streams, count=count, block=block_ms) or []

    def stream_last_id(self, stream_name: str) -> str:
        """
        Return the id of the last entry in a stream, or ``"0-0"`` if it is empty.

        Used to capture a baseline before waiting so a subsequent blocking
        :meth:`xread` from that id catches every entry added afterwards — closing
        the publish-before-subscribe race that pub/sub cannot.
        """
        entries = self._cache.xrevrange(stream_name, count=1)
        if not entries:
            return "0-0"
        last_id = entries[0][0]
        return last_id.decode() if isinstance(last_id, bytes) else last_id

    def expire(self, name: str, seconds: int) -> bool:
        """Set a TTL (seconds) on a key; used to bound signal-stream growth."""
        return bool(self._cache.expire(name, seconds))


class RedisCacheBackend(RedisCommandsMixin, RedisCache):
    def __init__(  # pylint: disable=too-many-arguments
        self,
        host: str,
        port: int,
        password: str | None = None,
        db: int = 0,
        default_timeout: int = 300,
        key_prefix: str | None = None,
        ssl: bool = False,
        ssl_certfile: str | None = None,
        ssl_keyfile: str | None = None,
        ssl_cert_reqs: str = "required",
        ssl_ca_certs: str | None = None,
        socket_timeout: float | None = None,
        socket_connect_timeout: float | None = None,
        **kwargs: Any,
    ) -> None:
        super().__init__(
            host=host,
            port=port,
            password=password,
            db=db,
            default_timeout=default_timeout,
            key_prefix=key_prefix,
            **kwargs,
        )
        # redis-py 8 defaults to a 5s socket timeout and RESP3 on the wire
        # (previously: no timeout, RESP2). Pin the pre-upgrade behavior
        # explicitly so bumping the library doesn't silently introduce new
        # timeouts or require RESP3 server support; socket_timeout/
        # connect_timeout stay operator-configurable. Built as a single
        # dict (rather than mixed explicit kwargs + **kwargs) because
        # combining both against redis.Redis's many @overloads defeats
        # mypy's overload resolution.
        connection_kwargs: dict[str, Any] = {
            "host": host,
            "port": port,
            "password": password,
            "db": db,
            "ssl": ssl,
            "ssl_certfile": ssl_certfile,
            "ssl_keyfile": ssl_keyfile,
            "ssl_cert_reqs": ssl_cert_reqs,
            "ssl_ca_certs": ssl_ca_certs,
            "socket_timeout": socket_timeout,
            "socket_connect_timeout": socket_connect_timeout,
            "protocol": 2,
            **kwargs,
        }
        self._cache = redis.Redis(**connection_kwargs)

    @classmethod
    def from_config(cls, config: dict[str, Any]) -> RedisCacheBackend:
        kwargs = {
            "host": config.get("CACHE_REDIS_HOST", "localhost"),
            "port": config.get("CACHE_REDIS_PORT", 6379),
            "db": config.get("CACHE_REDIS_DB", 0),
            "password": config.get("CACHE_REDIS_PASSWORD", None),
            "key_prefix": config.get("CACHE_KEY_PREFIX", None),
            "default_timeout": config.get("CACHE_DEFAULT_TIMEOUT", 300),
            "ssl": config.get("CACHE_REDIS_SSL", False),
            "ssl_certfile": config.get("CACHE_REDIS_SSL_CERTFILE", None),
            "ssl_keyfile": config.get("CACHE_REDIS_SSL_KEYFILE", None),
            "ssl_cert_reqs": config.get("CACHE_REDIS_SSL_CERT_REQS", "required"),
            "ssl_ca_certs": config.get("CACHE_REDIS_SSL_CA_CERTS", None),
            "socket_timeout": config.get("CACHE_REDIS_SOCKET_TIMEOUT", None),
            "socket_connect_timeout": config.get(
                "CACHE_REDIS_SOCKET_CONNECT_TIMEOUT", None
            ),
        }

        # Handle username separately as it's optional for Redis authentication.
        if configured_username := config.get("CACHE_REDIS_USER"):
            kwargs["username"] = configured_username

        return cls(**kwargs)


class RedisSentinelCacheBackend(RedisCommandsMixin, RedisSentinelCache):
    def __init__(  # pylint: disable=too-many-arguments
        self,
        sentinels: list[tuple[str, int]],
        master: str,
        password: str | None = None,
        sentinel_password: str | None = None,
        db: int = 0,
        default_timeout: int = 300,
        key_prefix: str = "",
        ssl: bool = False,
        ssl_certfile: str | None = None,
        ssl_keyfile: str | None = None,
        ssl_cert_reqs: str = "required",
        ssl_ca_certs: str | None = None,
        socket_timeout: float | None = None,
        socket_connect_timeout: float | None = None,
        **kwargs: Any,
    ) -> None:
        # Sentinel dont directly support SSL
        # Initialize Sentinel without SSL parameters
        self._sentinel = Sentinel(
            sentinels,
            # See the matching comment in RedisCacheBackend.__init__: pin the
            # pre-redis-py-8 defaults (no socket timeout, RESP2) explicitly
            # for the sentinel-node connections too, so this bump doesn't
            # silently change connection behavior.
            sentinel_kwargs={
                "password": sentinel_password,
                "socket_timeout": socket_timeout,
                "socket_connect_timeout": socket_connect_timeout,
                "protocol": 2,
            },
            **{
                k: v
                for k, v in kwargs.items()
                if k
                not in [
                    "ssl",
                    "ssl_certfile",
                    "ssl_keyfile",
                    "ssl_cert_reqs",
                    "ssl_ca_certs",
                ]
            },
        )

        # Prepare SSL-related arguments for master_for method
        master_kwargs: dict[str, Any] = {
            "password": password,
            "ssl": ssl,
            "ssl_certfile": ssl_certfile if ssl else None,
            "ssl_keyfile": ssl_keyfile if ssl else None,
            "ssl_cert_reqs": ssl_cert_reqs if ssl else None,
            "ssl_ca_certs": ssl_ca_certs if ssl else None,
        }

        # If SSL is False, remove all SSL-related keys
        # SSL_* are expected only if SSL is True
        if not ssl:
            master_kwargs = {
                k: v for k, v in master_kwargs.items() if not k.startswith("ssl")
            }

        # Filter out None values from master_kwargs
        master_kwargs = {k: v for k, v in master_kwargs.items() if v is not None}

        # Added after the None-filtering above: these must be forwarded even
        # when None (that's the explicit override), unlike the SSL args.
        master_kwargs["socket_timeout"] = socket_timeout
        master_kwargs["socket_connect_timeout"] = socket_connect_timeout
        master_kwargs["protocol"] = 2

        # Initialize Redis master connection
        self._cache = self._sentinel.master_for(master, **master_kwargs)

        # Call the parent class constructor
        super().__init__(
            host=None,
            port=None,
            password=password,
            db=db,
            default_timeout=default_timeout,
            key_prefix=key_prefix,
            **kwargs,
        )

    @classmethod
    def from_config(cls, config: dict[str, Any]) -> RedisSentinelCacheBackend:
        kwargs = {
            "sentinels": config.get("CACHE_REDIS_SENTINELS", [("127.0.0.1", 26379)]),
            "master": config.get("CACHE_REDIS_SENTINEL_MASTER", "mymaster"),
            "password": config.get("CACHE_REDIS_PASSWORD", None),
            "sentinel_password": config.get("CACHE_REDIS_SENTINEL_PASSWORD", None),
            "key_prefix": config.get("CACHE_KEY_PREFIX", ""),
            "db": config.get("CACHE_REDIS_DB", 0),
            "ssl": config.get("CACHE_REDIS_SSL", False),
            "ssl_certfile": config.get("CACHE_REDIS_SSL_CERTFILE", None),
            "ssl_keyfile": config.get("CACHE_REDIS_SSL_KEYFILE", None),
            "ssl_cert_reqs": config.get("CACHE_REDIS_SSL_CERT_REQS", "required"),
            "ssl_ca_certs": config.get("CACHE_REDIS_SSL_CA_CERTS", None),
            "socket_timeout": config.get("CACHE_REDIS_SOCKET_TIMEOUT", None),
            "socket_connect_timeout": config.get(
                "CACHE_REDIS_SOCKET_CONNECT_TIMEOUT", None
            ),
        }
        return cls(**kwargs)
