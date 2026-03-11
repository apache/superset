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

from flask import current_app

from superset.extensions import celery_app
from superset.utils.slack import get_channels

logger = logging.getLogger(__name__)


@celery_app.task(name="slack.cache_channels")
def cache_channels() -> None:
    cache_timeout = current_app.config["SLACK_CACHE_TIMEOUT"]
    retry_count = current_app.config.get("SLACK_API_RATE_LIMIT_RETRY_COUNT", 2)

    logger.info(
        "Starting Slack channels cache warm-up task "
        "(cache_timeout=%ds, retry_count=%d)",
        cache_timeout,
        retry_count,
    )

    try:
        get_channels(force=True, cache_timeout=cache_timeout)
    except Exception as ex:
        logger.exception(
            "Failed to cache Slack channels: %s. "
            "If this is due to rate limiting, consider increasing "
            "SLACK_API_RATE_LIMIT_RETRY_COUNT.",
            str(ex),
        )
        raise
