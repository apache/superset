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

"""Utility functions used across Superset"""

import logging
from typing import cast, Optional

from flask import current_app

from superset import security_manager, thumbnail_cache
from superset.extensions import celery_app
from superset.tasks.utils import get_executor
from superset.utils.core import override_user
from superset.utils.screenshots import ChartScreenshot, DashboardScreenshot
from superset.utils.urls import get_url_path
from superset.utils.webdriver import WindowSize

logger = logging.getLogger(__name__)


@celery_app.task(name="cache_chart_thumbnail", soft_time_limit=300)
def cache_chart_thumbnail(
    current_user: Optional[str],
    chart_id: int,
    force: bool = False,
    window_size: Optional[WindowSize] = None,
    thumb_size: Optional[WindowSize] = None,
) -> None:
    # pylint: disable=import-outside-toplevel
    from superset.models.slice import Slice

    if not thumbnail_cache:
        logger.warning("No cache set, refusing to compute")
        return None
    chart = cast(Slice, Slice.get(chart_id))
    if not chart:
        logger.warning("No chart found, skip computing chart thumbnail")
        return None
    url = get_url_path("Superset.slice", slice_id=chart.id)
    logger.info("Caching chart: %s", url)
    _, username = get_executor(
        executor_types=current_app.config["THUMBNAIL_EXECUTE_AS"],
        model=chart,
        current_user=current_user,
    )
    user = security_manager.find_user(username)
    with override_user(user):
        screenshot = ChartScreenshot(url, chart.digest)
        screenshot.compute_and_cache(
            user=user,
            cache=thumbnail_cache,
            force=force,
            window_size=window_size,
            thumb_size=thumb_size,
        )
    return None


@celery_app.task(name="cache_dashboard_thumbnail", soft_time_limit=300)
def cache_dashboard_thumbnail(
    current_user: Optional[str],
    dashboard_id: int,
    force: bool = False,
    thumb_size: Optional[WindowSize] = None,
    window_size: Optional[WindowSize] = None,
) -> None:
    # pylint: disable=import-outside-toplevel
    from superset.models.dashboard import Dashboard

    if not thumbnail_cache:
        logging.warning("No cache set, refusing to compute")
        return
    dashboard = Dashboard.get(dashboard_id)
    url = get_url_path("Superset.dashboard", dashboard_id_or_slug=dashboard.id)

    logger.info("Caching dashboard: %s", url)
    _, username = get_executor(
        executor_types=current_app.config["THUMBNAIL_EXECUTE_AS"],
        model=dashboard,
        current_user=current_user,
    )
    user = security_manager.find_user(username)
    with override_user(user):
        screenshot = DashboardScreenshot(url, dashboard.digest)
        screenshot.compute_and_cache(
            user=user,
            cache=thumbnail_cache,
            force=force,
            window_size=window_size,
            thumb_size=thumb_size,
        )


# pylint: disable=too-many-arguments
@celery_app.task(name="cache_dashboard_screenshot", soft_time_limit=60)
def cache_dashboard_screenshot(
    current_user: Optional[str],
    dashboard_id: int,
    dashboard_url: str,
    force: bool = False,
    thumb_size: Optional[WindowSize] = None,
    window_size: Optional[WindowSize] = None,
) -> None:
    # pylint: disable=import-outside-toplevel
    from superset.models.dashboard import Dashboard

    if not thumbnail_cache:
        logging.warning("No cache set, refusing to compute")
        return

    dashboard = Dashboard.get(dashboard_id)

    logger.info("Caching dashboard: %s", dashboard_url)
    _, username = get_executor(
        executor_types=current_app.config["THUMBNAIL_EXECUTE_AS"],
        model=dashboard,
        current_user=current_user,
    )
    user = security_manager.find_user(username)
    with override_user(user):
        screenshot = DashboardScreenshot(dashboard_url, dashboard.digest)
        screenshot.compute_and_cache(
            user=user,
            cache=thumbnail_cache,
            force=force,
            window_size=window_size,
            thumb_size=thumb_size,
        )
