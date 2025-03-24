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
from typing import Any, Dict, List, Optional, Tuple

import redis
from flask_caching.backends.rediscache import RedisCache, RedisSentinelCache
from redis.sentinel import Sentinel


class RedisCacheBackend(RedisCache):
    MAX_EVENT_COUNT = 100

    def __init__(  # pylint: disable=too-many-arguments
        self,
        host: str,
        port: int,
        password: Optional[str] = None,
        db: int = 0,
        default_timeout: int = 300,
        key_prefix: Optional[str] = None,
        ssl: bool = False,
        ssl_certfile: Optional[str] = None,
        ssl_keyfile: Optional[str] = None,
        ssl_cert_reqs: str = "required",
        ssl_ca_certs: Optional[str] = None,
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
        self._cache = redis.Redis(
            host=host,
            port=port,
            password=password,
            db=db,
            ssl=ssl,
            ssl_certfile=ssl_certfile,
            ssl_keyfile=ssl_keyfile,
            ssl_cert_reqs=ssl_cert_reqs,
            ssl_ca_certs=ssl_ca_certs,
            **kwargs,
        )

    def xadd(
        self,
        stream_name: str,
        event_data: Dict[str, Any],
        event_id: str = "*",
        maxlen: Optional[int] = None,
    ) -> str:
        return self._cache.xadd(stream_name, event_data, event_id, maxlen)

    def xrange(
        self,
        stream_name: str,
        start: str = "-",
        end: str = "+",
        count: Optional[int] = None,
    ) -> List[Any]:
        count = count or self.MAX_EVENT_COUNT
        return self._cache.xrange(stream_name, start, end, count)

    @classmethod
    def from_config(cls, config: Dict[str, Any]) -> "RedisCacheBackend":
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
        }
        return cls(**kwargs)


class RedisSentinelCacheBackend(RedisSentinelCache):
    MAX_EVENT_COUNT = 100

    def __init__(  # pylint: disable=too-many-arguments
        self,
        sentinels: List[Tuple[str, int]],
        master: str,
        password: Optional[str] = None,
        sentinel_password: Optional[str] = None,
        db: int = 0,
        default_timeout: int = 300,
        key_prefix: str = "",
        ssl: bool = False,
        ssl_certfile: Optional[str] = None,
        ssl_keyfile: Optional[str] = None,
        ssl_cert_reqs: str = "required",
        ssl_ca_certs: Optional[str] = None,
        **kwargs: Any,
    ) -> None:
        # Sentinel dont directly support SSL
        # Initialize Sentinel without SSL parameters
        self._sentinel = Sentinel(
            sentinels,
            sentinel_kwargs={
                "password": sentinel_password,
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
        master_kwargs = {
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

    def xadd(
        self,
        stream_name: str,
        event_data: Dict[str, Any],
        event_id: str = "*",
        maxlen: Optional[int] = None,
    ) -> str:
        return self._cache.xadd(stream_name, event_data, event_id, maxlen)

    def xrange(
        self,
        stream_name: str,
        start: str = "-",
        end: str = "+",
        count: Optional[int] = None,
    ) -> List[Any]:
        count = count or self.MAX_EVENT_COUNT
        return self._cache.xrange(stream_name, start, end, count)

    @classmethod
    def from_config(cls, config: Dict[str, Any]) -> "RedisSentinelCacheBackend":
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
        }
        return cls(**kwargs)
