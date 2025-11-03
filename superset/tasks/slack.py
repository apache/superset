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
from typing import Optional

from flask import current_app

from superset.extensions import cache_manager, celery_app
from superset.utils.slack import get_channels_with_search, SlackChannelTypes

logger = logging.getLogger(__name__)


@celery_app.task(name="slack.cache_channels")
def cache_channels() -> None:
    """
    Celery task to warm up the Slack channels cache.

    This task fetches all Slack channels using pagination and stores them in cache.
    Useful for large workspaces where the initial channel fetch can be slow.
    """
    cache_timeout = current_app.config["SLACK_CACHE_TIMEOUT"]
    retry_count = current_app.config.get("SLACK_API_RATE_LIMIT_RETRY_COUNT", 2)

    logger.info(
        "Starting Slack channels cache warm-up task "
        "(cache_timeout=%ds, retry_count=%d)",
        cache_timeout,
        retry_count,
    )

    try:
        all_channels = []
        cursor: Optional[str] = None
        page_count = 0

        while True:
            page_count += 1

            result = get_channels_with_search(
                search_string="",
                types=list(SlackChannelTypes),
                cursor=cursor,
                limit=1000,
            )

            page_channels = result["result"]
            all_channels.extend(page_channels)

            logger.debug(
                "Fetched page %d: %d channels (total: %d)",
                page_count,
                len(page_channels),
                len(all_channels),
            )

            cursor = result.get("next_cursor")
            if not cursor or not result.get("has_more"):
                break

        logger.info(
            "Successfully fetched %d Slack channels in %d pages. Caching results.",
            len(all_channels),
            page_count,
        )

        cache_key = "slack_conversations_list"
        cache_manager.cache.set(cache_key, all_channels, timeout=cache_timeout)

        logger.info("Slack channels cache warm-up completed successfully")

    except Exception as ex:
        logger.exception(
            "Failed to cache Slack channels: %s. "
            "If this is due to rate limiting, consider increasing "
            "SLACK_API_RATE_LIMIT_RETRY_COUNT.",
            str(ex),
        )
        raise
