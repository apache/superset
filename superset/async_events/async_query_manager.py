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

import logging
import uuid
from typing import Any, Literal, Optional, Union

import jwt
import redis
from flask import Flask, Request, request, Response, session
from flask_caching.backends.base import BaseCache

from superset.async_events.cache_backend import (
    RedisCacheBackend,
    RedisSentinelCacheBackend,
)
from superset.utils import json
from superset.utils.core import get_user_id

logger = logging.getLogger(__name__)


class CacheBackendNotInitialized(Exception):
    pass


class AsyncQueryTokenException(Exception):
    pass


class AsyncQueryJobException(Exception):
    pass


def build_job_metadata(
    channel_id: str, job_id: str, user_id: Optional[int], **kwargs: Any
) -> dict[str, Any]:
    return {
        "channel_id": channel_id,
        "job_id": job_id,
        "user_id": user_id,
        "status": kwargs.get("status"),
        "errors": kwargs.get("errors", []),
        "result_url": kwargs.get("result_url"),
    }


def parse_event(event_data: tuple[str, dict[str, Any]]) -> dict[str, Any]:
    event_id = event_data[0]
    event_payload = event_data[1]["data"]
    return {"id": event_id, **json.loads(event_payload)}


def increment_id(entry_id: str) -> str:
    # redis stream IDs are in this format: '1607477697866-0'
    try:
        prefix, last = entry_id[:-1], int(entry_id[-1])
        return prefix + str(last + 1)
    except Exception:  # pylint: disable=broad-except
        return entry_id


def get_cache_backend(
    config: dict[str, Any],
) -> Union[RedisCacheBackend, RedisSentinelCacheBackend, redis.Redis]:  # type: ignore
    cache_config = config.get("GLOBAL_ASYNC_QUERIES_CACHE_BACKEND", {})
    cache_type = cache_config.get("CACHE_TYPE")

    if cache_type == "RedisCache":
        return RedisCacheBackend.from_config(cache_config)

    if cache_type == "RedisSentinelCache":
        return RedisSentinelCacheBackend.from_config(cache_config)

    # TODO: Deprecate hardcoded plain Redis code and expand cache backend options.
    # Maintain backward compatibility with 'GLOBAL_ASYNC_QUERIES_REDIS_CONFIG' until it is deprecated.
    return redis.Redis(
        **config["GLOBAL_ASYNC_QUERIES_REDIS_CONFIG"], decode_responses=True
    )


class AsyncQueryManager:
    MAX_EVENT_COUNT = 100
    STATUS_PENDING = "pending"
    STATUS_RUNNING = "running"
    STATUS_ERROR = "error"
    STATUS_DONE = "done"

    def __init__(self) -> None:
        super().__init__()
        self._cache: Optional[BaseCache] = None
        self._stream_prefix: str = ""
        self._stream_limit: Optional[int]
        self._stream_limit_firehose: Optional[int]
        self._jwt_cookie_name: str = ""
        self._jwt_cookie_secure: bool = False
        self._jwt_cookie_domain: Optional[str]
        self._jwt_cookie_samesite: Optional[Literal["None", "Lax", "Strict"]] = None
        self._jwt_secret: str
        self._load_chart_data_into_cache_job: Any = None
        # pylint: disable=invalid-name
        self._load_explore_json_into_cache_job: Any = None

    def init_app(self, app: Flask) -> None:
        config = app.config
        cache_type = config.get("CACHE_CONFIG", {}).get("CACHE_TYPE")
        data_cache_type = config.get("DATA_CACHE_CONFIG", {}).get("CACHE_TYPE")
        if cache_type in [None, "null"] or data_cache_type in [None, "null"]:
            raise Exception(  # pylint: disable=broad-exception-raised
                """
                Cache backends (CACHE_CONFIG, DATA_CACHE_CONFIG) must be configured
                and non-null in order to enable async queries
                """
            )

        self._cache = get_cache_backend(config)
        logger.debug("Using GAQ Cache backend as %s", type(self._cache).__name__)

        if len(config["GLOBAL_ASYNC_QUERIES_JWT_SECRET"]) < 32:
            raise AsyncQueryTokenException(
                "Please provide a JWT secret at least 32 bytes long"
            )

        self._stream_prefix = config["GLOBAL_ASYNC_QUERIES_REDIS_STREAM_PREFIX"]
        self._stream_limit = config["GLOBAL_ASYNC_QUERIES_REDIS_STREAM_LIMIT"]
        self._stream_limit_firehose = config[
            "GLOBAL_ASYNC_QUERIES_REDIS_STREAM_LIMIT_FIREHOSE"
        ]
        self._jwt_cookie_name = config["GLOBAL_ASYNC_QUERIES_JWT_COOKIE_NAME"]
        self._jwt_cookie_secure = config["GLOBAL_ASYNC_QUERIES_JWT_COOKIE_SECURE"]
        self._jwt_cookie_samesite = config["GLOBAL_ASYNC_QUERIES_JWT_COOKIE_SAMESITE"]
        self._jwt_cookie_domain = config["GLOBAL_ASYNC_QUERIES_JWT_COOKIE_DOMAIN"]
        self._jwt_secret = config["GLOBAL_ASYNC_QUERIES_JWT_SECRET"]

        if config["GLOBAL_ASYNC_QUERIES_REGISTER_REQUEST_HANDLERS"]:
            self.register_request_handlers(app)

        # pylint: disable=import-outside-toplevel
        from superset.tasks.async_queries import (
            load_chart_data_into_cache,
            load_explore_json_into_cache,
        )

        self._load_chart_data_into_cache_job = load_chart_data_into_cache
        self._load_explore_json_into_cache_job = load_explore_json_into_cache

    def register_request_handlers(self, app: Flask) -> None:
        @app.after_request
        def validate_session(response: Response) -> Response:
            user_id = get_user_id()

            reset_token = (
                not request.cookies.get(self._jwt_cookie_name)
                or "async_channel_id" not in session
                or "async_user_id" not in session
                or user_id != session["async_user_id"]
            )

            if reset_token:
                async_channel_id = str(uuid.uuid4())
                session["async_channel_id"] = async_channel_id
                session["async_user_id"] = user_id

                sub = str(user_id) if user_id else None
                token = jwt.encode(
                    {"channel": async_channel_id, "sub": sub},
                    self._jwt_secret,
                    algorithm="HS256",
                )

                response.set_cookie(
                    self._jwt_cookie_name,
                    value=token,
                    httponly=True,
                    secure=self._jwt_cookie_secure,
                    domain=self._jwt_cookie_domain,
                    samesite=self._jwt_cookie_samesite,
                )

            return response

    def parse_channel_id_from_request(self, req: Request) -> str:
        token = req.cookies.get(self._jwt_cookie_name)
        if not token:
            raise AsyncQueryTokenException("Token not preset")

        try:
            return jwt.decode(token, self._jwt_secret, algorithms=["HS256"])["channel"]
        except Exception as ex:
            logger.warning("Parse jwt failed", exc_info=True)
            raise AsyncQueryTokenException("Failed to parse token") from ex

    def init_job(self, channel_id: str, user_id: Optional[int]) -> dict[str, Any]:
        job_id = str(uuid.uuid4())
        return build_job_metadata(
            channel_id, job_id, user_id, status=self.STATUS_PENDING
        )

    # pylint: disable=too-many-arguments
    def submit_explore_json_job(
        self,
        channel_id: str,
        form_data: dict[str, Any],
        response_type: str,
        force: Optional[bool] = False,
        user_id: Optional[int] = None,
    ) -> dict[str, Any]:
        # pylint: disable=import-outside-toplevel
        from superset import security_manager

        job_metadata = self.init_job(channel_id, user_id)
        self._load_explore_json_into_cache_job.delay(
            {**job_metadata, "guest_token": guest_user.guest_token}
            if (guest_user := security_manager.get_current_guest_user_if_guest())
            else job_metadata,
            form_data,
            response_type,
            force,
        )
        return job_metadata

    def submit_chart_data_job(
        self,
        channel_id: str,
        form_data: dict[str, Any],
        user_id: Optional[int] = None,
    ) -> dict[str, Any]:
        # pylint: disable=import-outside-toplevel
        from superset import security_manager

        # if it's guest user, we want to pass the guest token to the celery task
        # chart data cache key is calculated based on the current user
        # this way we can keep the cache key consistent between sync and async command
        # so that it can be looked up consistently
        job_metadata = self.init_job(channel_id, user_id)
        self._load_chart_data_into_cache_job.delay(
            {**job_metadata, "guest_token": guest_user.guest_token}
            if (guest_user := security_manager.get_current_guest_user_if_guest())
            else job_metadata,
            form_data,
        )
        return job_metadata

    def read_events(
        self, channel: str, last_id: Optional[str]
    ) -> list[Optional[dict[str, Any]]]:
        if not self._cache:
            raise CacheBackendNotInitialized("Cache backend not initialized")

        stream_name = f"{self._stream_prefix}{channel}"
        start_id = increment_id(last_id) if last_id else "-"
        results = self._cache.xrange(stream_name, start_id, "+", self.MAX_EVENT_COUNT)
        # Decode bytes to strings, decode_responses is not supported at RedisCache and RedisSentinelCache
        if isinstance(self._cache, (RedisSentinelCacheBackend, RedisCacheBackend)):
            decoded_results = [
                (
                    event_id.decode("utf-8"),
                    {
                        key.decode("utf-8"): value.decode("utf-8")
                        for key, value in event_data.items()
                    },
                )
                for event_id, event_data in results
            ]
            return (
                [] if not decoded_results else list(map(parse_event, decoded_results))
            )
        return [] if not results else list(map(parse_event, results))

    def update_job(
        self, job_metadata: dict[str, Any], status: str, **kwargs: Any
    ) -> None:
        if not self._cache:
            raise CacheBackendNotInitialized("Cache backend not initialized")

        if "channel_id" not in job_metadata:
            raise AsyncQueryJobException("No channel ID specified")

        if "job_id" not in job_metadata:
            raise AsyncQueryJobException("No job ID specified")

        updates = {"status": status, **kwargs}
        event_data = {"data": json.dumps({**job_metadata, **updates})}

        full_stream_name = f"{self._stream_prefix}full"
        scoped_stream_name = f"{self._stream_prefix}{job_metadata['channel_id']}"

        logger.debug("********** logging event data to stream %s", scoped_stream_name)
        logger.debug(event_data)

        self._cache.xadd(scoped_stream_name, event_data, "*", self._stream_limit)
        self._cache.xadd(full_stream_name, event_data, "*", self._stream_limit_firehose)
