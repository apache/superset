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
from superset.utils.slack import (
    get_channels_with_search,
    SLACK_CHANNELS_CACHE_KEY,
    SLACK_CHANNELS_CONTINUATION_CURSOR_KEY,
    SlackChannelTypes,
)

logger = logging.getLogger(__name__)


@celery_app.task(
    name="slack.cache_channels",
    time_limit=300,  # 5 minute hard timeout (via SLACK_CACHE_WARMUP_TIMEOUT)
    soft_time_limit=240,  # 4 minute warning
)
def cache_channels() -> None:
    """
    Celery task to warm up the Slack channels cache.

    This task fetches all Slack channels using pagination and stores them in cache.
    Includes safeguards for very large workspaces (50k+ channels).

    Respects the following config variables:
    - SLACK_ENABLE_CACHING: If False, this task does nothing
    - SLACK_CACHE_MAX_CHANNELS: Maximum channels to cache (prevents runaway fetches)
    - SLACK_CACHE_WARMUP_TIMEOUT: Task timeout in seconds
    - SLACK_CACHE_TIMEOUT: How long to keep cached data
    """
    enable_caching = current_app.config.get("SLACK_ENABLE_CACHING", True)
    if not enable_caching:
        logger.info(
            "Slack caching disabled (SLACK_ENABLE_CACHING=False), skipping cache warmup"
        )
        return

    cache_timeout = current_app.config["SLACK_CACHE_TIMEOUT"]
    max_channels = current_app.config.get("SLACK_CACHE_MAX_CHANNELS", 20000)
    retry_count = current_app.config.get("SLACK_API_RATE_LIMIT_RETRY_COUNT", 2)

    logger.info(
        "Starting Slack channels cache warm-up task "
        "(max_channels=%d, cache_timeout=%ds, retry_count=%d)",
        max_channels,
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

            # Safety check: stop if we hit the max channel limit
            if len(all_channels) >= max_channels:
                # Store the continuation cursor so we can resume via API later
                if cursor:
                    cache_manager.cache.set(
                        SLACK_CHANNELS_CONTINUATION_CURSOR_KEY,
                        cursor,
                        timeout=cache_timeout,
                    )
                    logger.warning(
                        "Reached max channel limit (%d channels in %d pages). "
                        "Stored continuation cursor for API fallback. "
                        "Channels beyond limit will be fetched from API on demand.",
                        len(all_channels),
                        page_count,
                    )
                else:
                    logger.warning(
                        "Reached max channel limit (%d channels in %d pages). "
                        "No more channels available.",
                        len(all_channels),
                        page_count,
                    )
                break

            if not cursor or not result.get("has_more"):
                break

        cache_size_mb = len(str(all_channels)) / (1024 * 1024)
        logger.info(
            "Successfully fetched %d Slack channels in %d pages (%.1f MB). "
            "Caching results.",
            len(all_channels),
            page_count,
            cache_size_mb,
        )

        cache_manager.cache.set(
            SLACK_CHANNELS_CACHE_KEY, all_channels, timeout=cache_timeout
        )

        logger.info("Slack channels cache warm-up completed successfully")

    except Exception as ex:
        logger.exception(
            "Failed to cache Slack channels: %s. "
            "If this is due to rate limiting, consider increasing "
            "SLACK_API_RATE_LIMIT_RETRY_COUNT.",
            str(ex),
        )
        raise
