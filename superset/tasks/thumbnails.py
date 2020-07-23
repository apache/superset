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
from typing import Optional, Tuple

from flask import current_app

from superset import app, security_manager, thumbnail_cache
from superset.extensions import celery_app
from superset.utils.screenshots import ChartScreenshot, DashboardScreenshot

logger = logging.getLogger(__name__)

WindowSize = Tuple[int, int]


@celery_app.task(name="cache_chart_thumbnail", soft_time_limit=300)
def cache_chart_thumbnail(
    url: str,
    digest: str,
    force: bool = False,
    window_size: Optional[WindowSize] = None,
    thumb_size: Optional[WindowSize] = None,
) -> None:
    with app.app_context():  # type: ignore
        if not thumbnail_cache:
            logger.warning("No cache set, refusing to compute")
            return None
        logging.info("Caching chart at {url}")
        screenshot = ChartScreenshot(url, digest)
        user = security_manager.find_user(current_app.config["THUMBNAIL_SELENIUM_USER"])
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
    url: str, digest: str, force: bool = False, thumb_size: Optional[WindowSize] = None
) -> None:
    with app.app_context():  # type: ignore
        if not thumbnail_cache:
            logging.warning("No cache set, refusing to compute")
            return
        logger.info("Caching dashboard: %s", url)
        screenshot = DashboardScreenshot(url, digest)
        user = security_manager.find_user(current_app.config["THUMBNAIL_SELENIUM_USER"])
        screenshot.compute_and_cache(
            user=user, cache=thumbnail_cache, force=force, thumb_size=thumb_size,
        )
