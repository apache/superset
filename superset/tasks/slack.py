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
from typing import Any, Optional

from flask import current_app

from superset.extensions import cache_manager, celery_app
from superset.utils.slack import (
    _fetch_from_api,
    SLACK_CHANNELS_CACHE_KEY,
    SLACK_CHANNELS_CONTINUATION_CURSOR_KEY,
    SlackChannelTypes,
)

logger = logging.getLogger(__name__)

# Fallback time limits used when the task is dispatched without explicit
# options (e.g. a bare Celery beat schedule entry). On-demand callers should
# pass config-driven limits via ``cache_channels.apply_async`` using
# ``get_cache_warmup_options`` so that ``SLACK_CACHE_WARMUP_TIMEOUT`` is honored.
DEFAULT_CACHE_WARMUP_TIME_LIMIT = 300  # 5 minutes
DEFAULT_CACHE_WARMUP_SOFT_TIME_LIMIT = int(DEFAULT_CACHE_WARMUP_TIME_LIMIT * 0.8)


def get_cache_warmup_options() -> dict[str, int]:
    """
    Build Celery ``apply_async`` options with config-driven time limits.

    Read at dispatch time (inside an application context) rather than at import
    so operator overrides of ``SLACK_CACHE_WARMUP_TIMEOUT`` are respected. The
    soft limit is derived as 80% of the hard limit so the task can wind down
    before Celery force-kills it.
    """
    time_limit = current_app.config.get(
        "SLACK_CACHE_WARMUP_TIMEOUT", DEFAULT_CACHE_WARMUP_TIME_LIMIT
    )
    return {
        "time_limit": time_limit,
        "soft_time_limit": int(time_limit * 0.8),
    }


@celery_app.task(
    name="slack.cache_channels",
    time_limit=DEFAULT_CACHE_WARMUP_TIME_LIMIT,
    soft_time_limit=DEFAULT_CACHE_WARMUP_SOFT_TIME_LIMIT,
)
def cache_channels() -> None:
    """
    Celery task to warm up the Slack channels cache.

    This task fetches all Slack channels using pagination and stores them in cache.

    Respects the following config variables:
    - SLACK_ENABLE_CACHING: If False, this task does nothing
    - SLACK_CACHE_TIMEOUT: How long to keep cached data
    - SLACK_CACHE_MAX_CHANNELS: Maximum number of channels to cache. When the
      workspace has more channels than this, the cache is truncated and a
      continuation cursor is stored so paginated lookups can stream the
      remainder from the Slack API.
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
        "(cache_timeout=%ds, max_channels=%d, retry_count=%d)",
        cache_timeout,
        max_channels,
        retry_count,
    )

    try:
        all_channels: list[Any] = []
        cursor: Optional[str] = None
        page_count = 0
        # When the workspace exceeds ``max_channels`` we cache the first
        # ``max_channels`` and remember the Slack cursor for the rest so that
        # in-memory cache pagination can fall back to the API at the boundary.
        continuation_cursor: Optional[str] = None

        # Fetch directly from the Slack API (bypassing the cache-aware
        # ``get_channels_with_search``) so a warm cache never feeds the warmup
        # back into itself and real continuation cursors are produced.
        while True:
            page_count += 1

            result = _fetch_from_api(
                search_string="",
                types=list(SlackChannelTypes),
                exact_match=False,
                cursor=cursor,
                limit=999,
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

            if len(all_channels) >= max_channels:
                continuation_cursor = cursor
                logger.info(
                    "Reached SLACK_CACHE_MAX_CHANNELS (%d); caching the first "
                    "%d channels and storing a continuation cursor for the rest.",
                    max_channels,
                    max_channels,
                )
                break

        all_channels = all_channels[:max_channels]

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

        # Persist (or clear) the continuation cursor so the cache path knows
        # whether more channels exist beyond the cached set.
        if continuation_cursor:
            cache_manager.cache.set(
                SLACK_CHANNELS_CONTINUATION_CURSOR_KEY,
                continuation_cursor,
                timeout=cache_timeout,
            )
        else:
            cache_manager.cache.delete(SLACK_CHANNELS_CONTINUATION_CURSOR_KEY)

        logger.info("Slack channels cache warm-up completed successfully")

    except Exception as ex:
        logger.exception(
            "Failed to cache Slack channels: %s. "
            "If this is due to rate limiting, consider increasing "
            "SLACK_API_RATE_LIMIT_RETRY_COUNT.",
            str(ex),
        )
        raise
