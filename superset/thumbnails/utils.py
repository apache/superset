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
from enum import Enum
from typing import Optional, TYPE_CHECKING, Union

from flask import current_app, g
from flask_appbuilder.security.sqla.models import User

from superset import security_manager
from superset.thumbnails.exceptions import ThumbnailUserNotFoundError
from superset.thumbnails.types import ThumbnailExecutor
from superset.utils.hashing import md5_sha_from_str

if TYPE_CHECKING:
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

logger = logging.getLogger(__name__)


class ThumbnailConfigIndex(int, Enum):
    EXECUTOR = 0
    DASHBOARD_CALLBACK = 1
    CHART_CALLBACK = 2


def _get_digest(
    model: Union[Dashboard, Slice],
    callback_index: ThumbnailConfigIndex,
) -> str:
    user = security_manager.current_user
    if config := current_app.config["THUMBNAIL_EXECUTOR_CONFIG"]:
        if callback := config[callback_index]:
            return callback((model, user))

        # default to using user-specific digest when executing as user
        if config[ThumbnailConfigIndex.EXECUTOR] == ThumbnailExecutor.User:
            username = user.username if user else ""
            return md5_sha_from_str(f"{model.digest}\n{username}")

    return model.digest


def get_chart_digest(chart: Slice) -> str:
    return _get_digest(chart, ThumbnailConfigIndex.CHART_CALLBACK)


def get_dashboard_digest(dashboard: Dashboard) -> str:
    return _get_digest(dashboard, ThumbnailConfigIndex.DASHBOARD_CALLBACK)


def _get_user(username: Optional[str]) -> Optional[User]:
    if username:
        return security_manager.find_user(username=username)

    return None


def get_executor(username: Optional[str]) -> User:
    if config := current_app.config["THUMBNAIL_EXECUTOR_CONFIG"]:
        executor = config[ThumbnailConfigIndex.EXECUTOR]
        if executor == ThumbnailExecutor.Selenium:
            if username := current_app.config.get("THUMBNAIL_SELENIUM_USER"):
                logger.warning(
                    "The config `THUMBNAIL_SELENIUM_USER` is deprecated and will be "
                    "removed in a future version. Please use `SELENIUM_USER` instead."
                )
                return _get_user(username)
            elif username := current_app.config["SELENIUM_USER"]:
                return _get_user(username)
            raise ThumbnailUserNotFoundError(
                f"`{executor}` is not a valid thumbnail executor."
            )

        if executor == ThumbnailExecutor.User:
            return _get_user(username)

    raise ThumbnailUserNotFoundError("Unable to find executor")
