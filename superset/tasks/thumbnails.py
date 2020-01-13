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
# pylint: disable=C,R,W

"""Utility functions used across Superset"""

import logging

from superset import app, security_manager, thumbnail_cache
from superset.tasks.celery_app import app as celery_app
from superset.utils.selenium import DashboardScreenshot, SliceScreenshot


@celery_app.task(name="cache_chart_thumbnail", soft_time_limit=300)
def cache_chart_thumbnail(chart_id, force=False):
    with app.app_context():
        logging.info(f"Caching chart {chart_id}")
        screenshot = SliceScreenshot(model_id=chart_id)
        user = security_manager.find_user("Admin")
        screenshot.compute_and_cache(user=user, cache=thumbnail_cache, force=force)


@celery_app.task(name="cache_dashboard_thumbnail", soft_time_limit=300)
def cache_dashboard_thumbnail(dashboard_id, force=False):
    with app.app_context():
        logging.info(f"Caching dashboard {dashboard_id}")
        screenshot = DashboardScreenshot(model_id=dashboard_id)
        user = security_manager.find_user("Admin")
        screenshot.compute_and_cache(user=user, cache=thumbnail_cache, force=force)
