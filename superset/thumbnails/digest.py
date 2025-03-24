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

from superset import security_manager
from superset.tasks.exceptions import ExecutorNotFoundError
from superset.tasks.types import ExecutorType
from superset.tasks.utils import get_current_user, get_executor
from superset.utils.core import override_user
from superset.utils.hashing import md5_sha_from_str

if TYPE_CHECKING:
    from superset.connectors.sqla.models import BaseDatasource, SqlaTable
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


def _adjust_string_with_rls(
    unique_string: str,
    datasources: list[SqlaTable | None] | set[BaseDatasource],
    executor: str,
) -> str:
    """
    Add the RLS filters to the unique string based on current executor.
    """
    user = (
        security_manager.find_user(executor)
        or security_manager.get_current_guest_user_if_guest()
    )

    if user:
        stringified_rls = ""
        with override_user(user):
            for datasource in datasources:
                if (
                    datasource
                    and hasattr(datasource, "is_rls_supported")
                    and datasource.is_rls_supported
                ):
                    rls_filters = datasource.get_sqla_row_level_filters()

                    if len(rls_filters) > 0:
                        stringified_rls += (
                            f"{str(datasource.id)}\t"
                            + "\t".join([str(f) for f in rls_filters])
                            + "\n"
                        )

        if stringified_rls:
            unique_string = f"{unique_string}\n{stringified_rls}"

    return unique_string


def get_dashboard_digest(dashboard: Dashboard) -> str | None:
    config = current_app.config
    try:
        executor_type, executor = get_executor(
            executors=config["THUMBNAIL_EXECUTORS"],
            model=dashboard,
            current_user=get_current_user(),
        )
    except ExecutorNotFoundError:
        return None

    if func := config["THUMBNAIL_DASHBOARD_DIGEST_FUNC"]:
        return func(dashboard, executor_type, executor)

    unique_string = (
        f"{dashboard.id}\n{dashboard.charts}\n{dashboard.position_json}\n"
        f"{dashboard.css}\n{dashboard.json_metadata}"
    )

    unique_string = _adjust_string_for_executor(unique_string, executor_type, executor)
    unique_string = _adjust_string_with_rls(
        unique_string, dashboard.datasources, executor
    )

    return md5_sha_from_str(unique_string)


def get_chart_digest(chart: Slice) -> str | None:
    config = current_app.config
    try:
        executor_type, executor = get_executor(
            executors=config["THUMBNAIL_EXECUTORS"],
            model=chart,
            current_user=get_current_user(),
        )
    except ExecutorNotFoundError:
        return None

    if func := config["THUMBNAIL_CHART_DIGEST_FUNC"]:
        return func(chart, executor_type, executor)

    unique_string = f"{chart.params or ''}.{executor}"
    unique_string = _adjust_string_for_executor(unique_string, executor_type, executor)
    unique_string = _adjust_string_with_rls(unique_string, [chart.datasource], executor)

    return md5_sha_from_str(unique_string)
