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
import logging
import uuid
from typing import Any, Dict

import jwt
from flask import Flask, Response, session

logger = logging.getLogger(__name__)


class AsyncQueryManager:
    def __init__(self) -> None:
        super().__init__()
        self._jwt_cookie_name = None
        self._jwt_secret = None

    def init_app(self, app: Flask) -> None:
        self._jwt_cookie_name = app.config["GLOBAL_ASYNC_QUERIES_JWT_COOKIE_NAME"]
        self._jwt_secret = app.config["GLOBAL_ASYNC_QUERIES_JWT_SECRET"]

        @app.after_request
        def set_async_jwt_cookie(response: Response) -> Response:
            reset_token = False
            user_id = None

            if "user_id" in session:
                user_id = session["user_id"]

            if "async_channel_id" not in session or "async_user_id" not in session:
                reset_token = True
            elif user_id != session["async_user_id"]:
                reset_token = True

            if reset_token:
                logger.info("******************** setting async_channel_id")
                async_channel_id = str(uuid.uuid4())
                session["async_channel_id"] = async_channel_id
                session["async_user_id"] = user_id

                token = self.get_jwt({"channel": async_channel_id, "user_id": user_id})

                response.set_cookie(
                    self._jwt_cookie_name,
                    value=token,
                    httponly=True,
                    # max_age=max_age or config.cookie_max_age,
                    # secure=config.cookie_secure,
                    # domain=config.cookie_domain,
                    # path=config.access_cookie_path,
                    # samesite=config.cookie_samesite
                )

            # logger.info("session", session)

            return response

    def get_jwt(self, data: Dict) -> Dict[str, Any]:
        encoded_jwt = jwt.encode(data, self._jwt_secret, algorithm="HS256")
        return encoded_jwt
