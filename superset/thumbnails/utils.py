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
from typing import Optional, TYPE_CHECKING, Union

from flask import current_app, g
from flask_appbuilder.security.sqla.models import User

from superset import security_manager
from superset.thumbnails.exceptions import ThumbnailUserNotFoundError
from superset.thumbnails.types import ThumbnailExecutor

if TYPE_CHECKING:
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

logger = logging.getLogger(__name__)

EXECUTOR_INDEX = 0
DASHBOARD_INDEX = 1
CHART_INDEX = 2


def _get_digest(model: Union[Dashboard, Slice], idx) -> str:
    if config := current_app.config["THUMBNAIL_EXECUTOR_CONFIG"]:
        if callback := config[idx]:
            return callback(model)

    return model.digest


def get_chart_digest(chart: Slice) -> str:
    return _get_digest(chart, DASHBOARD_INDEX)


def get_dashboard_digest(dashboard: Dashboard) -> str:
    return _get_digest(dashboard, DASHBOARD_INDEX)


def _get_user(username: str) -> User:
    return security_manager.find_user(username=username)


def get_executor(username: Optional[str]) -> User:
    if config := current_app.config["THUMBNAIL_EXECUTOR_CONFIG"]:
        executor = config[EXECUTOR_INDEX]
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
