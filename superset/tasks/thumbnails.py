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

from flask import current_app

from superset import app, security_manager, thumbnail_cache
from superset.extensions import celery_app
from superset.utils.screenshots import ChartScreenshot, DashboardScreenshot

logger = logging.getLogger(__name__)


@celery_app.task(name="cache_chart_thumbnail", soft_time_limit=300)
def cache_chart_thumbnail(chart_id: int, force: bool = False) -> None:
    with app.app_context():  # type: ignore
        if not thumbnail_cache:
            logger.warning("No cache set, refusing to compute")
            return
        logging.info("Caching chart %i", chart_id)
        screenshot = ChartScreenshot(model_id=chart_id)
        user = security_manager.find_user(current_app.config["THUMBNAIL_SELENIUM_USER"])
        screenshot.compute_and_cache(user=user, cache=thumbnail_cache, force=force)


@celery_app.task(name="cache_dashboard_thumbnail", soft_time_limit=300)
def cache_dashboard_thumbnail(  # pylint: disable=inconsistent-return-statements
    dashboard_id: int, force: bool = False
) -> None:
    with app.app_context():  # type: ignore
        if not thumbnail_cache:
            logging.warning("No cache set, refusing to compute")
            return
        logger.info("Caching dashboard %i", dashboard_id)
        screenshot = DashboardScreenshot(model_id=dashboard_id)
        user = security_manager.find_user(current_app.config["THUMBNAIL_SELENIUM_USER"])
        screenshot.compute_and_cache(user=user, cache=thumbnail_cache, force=force)
