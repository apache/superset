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
import json
import logging
import uuid
from typing import Any, Dict

import jwt
import redis
from flask import Flask, Response, session

logger = logging.getLogger(__name__)


class AsyncQueryTokenException(Exception):
    pass


class AsyncQueryJobException(Exception):
    pass


class AsyncQueryManager:
    STATUS_PENDING = "pending"
    STATUS_RUNNING = "running"
    STATUS_ERROR = "error"
    STATUS_DONE = "done"

    def __init__(self) -> None:
        super().__init__()
        self._redis = None
        self._stream_prefix = None
        self._stream_limit = None
        self._stream_limit_firehose = None
        self._jwt_cookie_name = None
        self._jwt_cookie_secure = None
        self._jwt_secret = None

    def init_app(self, app: Flask) -> None:
        self._redis = redis.Redis(**app.config["GLOBAL_ASYNC_QUERIES_REDIS_CONFIG"])
        self._stream_prefix = app.config["GLOBAL_ASYNC_QUERIES_REDIS_STREAM_PREFIX"]
        self._stream_limit = app.config["GLOBAL_ASYNC_QUERIES_REDIS_STREAM_LIMIT"]
        self._stream_limit_firehose = app.config[
            "GLOBAL_ASYNC_QUERIES_REDIS_STREAM_LIMIT_FIREHOSE"
        ]
        self._jwt_cookie_name = app.config["GLOBAL_ASYNC_QUERIES_JWT_COOKIE_NAME"]
        self._jwt_cookie_secure = app.config["GLOBAL_ASYNC_QUERIES_JWT_COOKIE_SECURE"]
        self._jwt_secret = app.config["GLOBAL_ASYNC_QUERIES_JWT_SECRET"]

        @app.after_request
        def validate_session(response: Response) -> Response:
            reset_token = False
            user_id = session["user_id"] if "user_id" in session else None

            if "async_channel_id" not in session or "async_user_id" not in session:
                reset_token = True
            elif user_id != session["async_user_id"]:
                reset_token = True

            if reset_token:
                logger.info("******************** setting async_channel_id")
                async_channel_id = str(uuid.uuid4())
                session["async_channel_id"] = async_channel_id
                session["async_user_id"] = user_id

                token = self.generate_jwt(
                    {"channel": async_channel_id, "user_id": user_id}
                )

                response.set_cookie(
                    self._jwt_cookie_name,
                    value=token,
                    httponly=True,
                    secure=self._jwt_cookie_secure,
                    # max_age=max_age or config.cookie_max_age,
                    # domain=config.cookie_domain,
                    # path=config.access_cookie_path,
                    # samesite=config.cookie_samesite
                )

            return response

    def generate_jwt(self, data: Dict) -> Dict[str, Any]:
        encoded_jwt = jwt.encode(data, self._jwt_secret, algorithm="HS256")
        return encoded_jwt

    def parse_jwt(self, token: str) -> Dict[str, Any]:
        data = jwt.decode(token, self._jwt_secret, algorithms=["HS256"])
        return data

    def parse_jwt_from_request(self, request: Dict) -> Dict[str, Any]:
        token = request.cookies.get(self._jwt_cookie_name)
        if not token:
            raise AsyncQueryTokenException("Token not preset")

        try:
            return self.parse_jwt(token)
        except Exception as exc:
            logger.warning(exc)
            raise AsyncQueryTokenException("Failed to parse token")

    def init_job(self, channel_id: str):
        job_id = str(uuid.uuid4())
        return self._build_job_metadata(channel_id, job_id, status=self.STATUS_PENDING)

    def _build_job_metadata(self, channel_id: str, job_id: str, **kwargs):
        return {
            "channel_id": channel_id,
            "job_id": job_id,
            "user_id": session["user_id"] if "user_id" in session else None,
            "status": kwargs["status"],
            "msg": kwargs["msg"] if "msg" in kwargs else None,
            "cache_key": kwargs["cache_key"] if "cache_key" in kwargs else None,
        }

    def update_job(self, job_metadata: Dict, status: str, **kwargs: Any):
        if "channel_id" not in job_metadata:
            raise AsyncQueryJobException("No channel ID specified")

        if "job_id" not in job_metadata:
            raise AsyncQueryJobException("No job ID specified")

        updates = {"status": status, **kwargs}
        event_data = {"data": json.dumps({**job_metadata, **updates})}

        logger.info(
            f"********** logging event data to stream {self._stream_prefix}{job_metadata['channel_id']}"
        )
        logger.info(event_data)

        full_stream_name = f"{self._stream_prefix}full"
        scoped_stream_name = f"{self._stream_prefix}{job_metadata['channel_id']}"

        self._redis.xadd(scoped_stream_name, event_data, "*", self._stream_limit)
        self._redis.xadd(full_stream_name, event_data, "*", self._stream_limit_firehose)
