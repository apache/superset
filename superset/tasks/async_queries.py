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
from typing import Dict, Optional

from flask import current_app
from flask_appbuilder.security.sqla.models import User

from superset import app, security_manager, thumbnail_cache
from superset.extensions import celery_app

logger = logging.getLogger(__name__)
query_timeout = current_app.config[
    "SQLLAB_ASYNC_TIME_LIMIT_SEC"
]  # TODO: new config key


@celery_app.task(name="load_chart_data_into_cache", soft_time_limit=query_timeout)
def load_chart_data_into_cache(user: User, form_data: Dict,) -> None:
    from superset.charts.commands.data import (
        ChartDataCommand,
    )  # load here to prevent circular imports

    with app.app_context():  # type: ignore
        try:
            command = ChartDataCommand(user, form_data)
        except ChartDataValidationError as exc:
            # TODO: update job status
            raise
        except SupersetSecurityException:
            # TODO: update job status
            raise

        command.run()

        # if not thumbnail_cache:
        #     logger.warning("No cache set, refusing to compute")
        #     return None
        # logger.info("Caching chart: %s", url)
        # screenshot = ChartScreenshot(url, digest)
        # user = security_manager.find_user(current_app.config["THUMBNAIL_SELENIUM_USER"])
        # screenshot.compute_and_cache(
        #     user=user,
        #     cache=thumbnail_cache,
        #     force=force,
        #     window_size=window_size,
        #     thumb_size=thumb_size,
        # )
        return None
