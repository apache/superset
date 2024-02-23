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
from typing import TYPE_CHECKING

from flask import current_app

from superset.tasks.types import ExecutorType
from superset.tasks.utils import get_current_user, get_executor
from superset.utils.hashing import md5_sha_from_str

if TYPE_CHECKING:
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

logger = logging.getLogger(__name__)


def _adjust_string_for_executor(
    unique_string: str,
    executor_type: ExecutorType,
    executor: str,
) -> str:
    """
    Add the executor to the unique string if the thumbnail is
    user-specific.
    """
    if executor_type == ExecutorType.CURRENT_USER:
        # add the user id to the string to make it unique
        unique_string = f"{unique_string}\n{executor}"

    return unique_string


def get_dashboard_digest(dashboard: Dashboard) -> str:
    config = current_app.config
    executor_type, executor = get_executor(
        executor_types=config["THUMBNAIL_EXECUTE_AS"],
        model=dashboard,
        current_user=get_current_user(),
    )
    if func := config["THUMBNAIL_DASHBOARD_DIGEST_FUNC"]:
        return func(dashboard, executor_type, executor)

    unique_string = (
        f"{dashboard.id}\n{dashboard.charts}\n{dashboard.position_json}\n"
        f"{dashboard.css}\n{dashboard.json_metadata}"
    )

    unique_string = _adjust_string_for_executor(unique_string, executor_type, executor)
    return md5_sha_from_str(unique_string)


def get_chart_digest(chart: Slice) -> str:
    config = current_app.config
    executor_type, executor = get_executor(
        executor_types=config["THUMBNAIL_EXECUTE_AS"],
        model=chart,
        current_user=get_current_user(),
    )
    if func := config["THUMBNAIL_CHART_DIGEST_FUNC"]:
        return func(chart, executor_type, executor)

    unique_string = f"{chart.params or ''}.{executor}"
    unique_string = _adjust_string_for_executor(unique_string, executor_type, executor)
    return md5_sha_from_str(unique_string)
