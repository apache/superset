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

from flask import current_app as app
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError
from slack_sdk.http_retry.builtin_handlers import RateLimitErrorRetryHandler

from superset import feature_flag_manager
from superset.exceptions import SupersetException
from superset.extensions import cache_manager
from superset.reports.schemas import SlackChannelSchema
from superset.utils import cache as cache_util
from superset.utils.backports import StrEnum

logger = logging.getLogger(__name__)


class SlackChannelTypes(StrEnum):
    PUBLIC = "public_channel"
    PRIVATE = "private_channel"


class SlackClientError(Exception):
    pass


def get_slack_client() -> WebClient:
    token: str = app.config["SLACK_API_TOKEN"]
    if callable(token):
        token = token()
    client = WebClient(token=token, proxy=app.config["SLACK_PROXY"])

    max_retry_count = app.config.get("SLACK_API_RATE_LIMIT_RETRY_COUNT", 2)
    rate_limit_handler = RateLimitErrorRetryHandler(max_retry_count=max_retry_count)
    client.retry_handlers.append(rate_limit_handler)

    logger.debug("Slack client configured with %d rate limit retries", max_retry_count)

    return client


@cache_util.memoized_func(
    key="slack_conversations_list",
    cache=cache_manager.cache,
)
def get_channels() -> list[SlackChannelSchema]:
    """
    Retrieves a list of all conversations accessible by the bot
    from the Slack API, and caches results (to avoid rate limits).

    The Slack API does not provide search so to apply a search use
    get_channels_with_search instead.
    """
    client = get_slack_client()
    channel_schema = SlackChannelSchema()
    channels: list[SlackChannelSchema] = []
    extra_params = {"types": ",".join(SlackChannelTypes)}
    cursor = None
    page_count = 0

    logger.info("Starting Slack channels fetch")

    try:
        while True:
            page_count += 1

            response = client.conversations_list(
                limit=999, cursor=cursor, exclude_archived=True, **extra_params
            )
            page_channels = response.data["channels"]
            channels.extend(channel_schema.load(channel) for channel in page_channels)

            logger.debug(
                "Fetched page %d: %d channels (total: %d)",
                page_count,
                len(page_channels),
                len(channels),
            )

            cursor = response.data.get("response_metadata", {}).get("next_cursor")
            if not cursor:
                break

        logger.info(
            "Successfully fetched %d Slack channels in %d pages",
            len(channels),
            page_count,
        )
        return channels
    except SlackApiError as ex:
        logger.error(
            "Failed to fetch Slack channels after %d pages: %s",
            page_count,
            str(ex),
            exc_info=True,
        )
        raise


def _fetch_channels_without_search(
    client: WebClient,
    channel_schema: SlackChannelSchema,
    types_param: str,
    cursor: Optional[str],
    limit: int,
) -> dict[str, Any]:
    """Fetch channels without search filtering, paginating for large limits."""
    channels: list[SlackChannelSchema] = []
    slack_cursor = cursor
    page_size = min(limit, 200)

    while True:
        response = client.conversations_list(
            limit=page_size,
            cursor=slack_cursor,
            exclude_archived=True,
            types=types_param,
        )

        page_channels = [
            channel_schema.load(channel) for channel in response.data["channels"]
        ]
        channels.extend(page_channels)

        slack_cursor = response.data.get("response_metadata", {}).get("next_cursor")

        if not slack_cursor or len(page_channels) < page_size or len(channels) >= limit:
            break

    return {
        "result": channels[:limit],
        "next_cursor": slack_cursor,
        "has_more": bool(slack_cursor),
    }


def _fetch_channels_with_search(
    client: WebClient,
    channel_schema: SlackChannelSchema,
    types_param: str,
    search_string: str,
    exact_match: bool,
    cursor: Optional[str],
    limit: int,
) -> dict[str, Any]:
    """Fetch channels with search filtering, streaming through pages."""
    matches: list[SlackChannelSchema] = []
    slack_cursor = cursor
    max_pages_to_fetch = 50
    pages_fetched = 0
    search_string_lower = search_string.lower()

    while len(matches) < limit and pages_fetched < max_pages_to_fetch:
        response = client.conversations_list(
            limit=200,
            cursor=slack_cursor,
            exclude_archived=True,
            types=types_param,
        )

        for channel_data in response.data["channels"]:
            channel_name_lower = channel_data["name"].lower()
            channel_id_lower = channel_data["id"].lower()

            is_match = False
            if exact_match:
                is_match = (
                    search_string_lower == channel_name_lower
                    or search_string_lower == channel_id_lower
                )
            else:
                is_match = (
                    search_string_lower in channel_name_lower
                    or search_string_lower in channel_id_lower
                )

            if is_match:
                channel = channel_schema.load(channel_data)
                matches.append(channel)

            if len(matches) >= limit:
                break

        slack_cursor = response.data.get("response_metadata", {}).get("next_cursor")
        if not slack_cursor:
            break

        pages_fetched += 1

    has_more = bool(slack_cursor) and len(matches) >= limit

    return {
        "result": matches[:limit],
        "next_cursor": slack_cursor if has_more else None,
        "has_more": has_more,
    }


def get_channels_with_search(
    search_string: str = "",
    types: Optional[list[SlackChannelTypes]] = None,
    exact_match: bool = False,
    cursor: Optional[str] = None,
    limit: int = 100,
) -> dict[str, Any]:
    """
    Fetches Slack channels with pagination and search support.

    Returns a dict with:
    - result: list of channels
    - next_cursor: cursor for next page (None if no more pages)
    - has_more: boolean indicating if more pages exist

    The Slack API is paginated but does not include search.
    We handle two cases:
    1. WITHOUT search: Fetch single page from Slack API
    2. WITH search: Stream through Slack API pages until we find enough matches
       (stops early to prevent timeouts on large workspaces)
    """
    try:
        client = get_slack_client()
        channel_schema = SlackChannelSchema()

        types_param = (
            ",".join(types)
            if types and len(types) < len(SlackChannelTypes)
            else ",".join(SlackChannelTypes)
        )

        if not search_string:
            return _fetch_channels_without_search(
                client, channel_schema, types_param, cursor, limit
            )

        return _fetch_channels_with_search(
            client,
            channel_schema,
            types_param,
            search_string,
            exact_match,
            cursor,
            limit,
        )

    except SlackApiError as ex:
        # Check if it's a rate limit error
        status_code = getattr(ex.response, "status_code", None)
        if status_code == 429:
            raise SupersetException(
                f"Slack API rate limit exceeded: {ex}. "
                "For large workspaces, consider increasing "
                "SLACK_API_RATE_LIMIT_RETRY_COUNT"
            ) from ex
        raise SupersetException(f"Failed to list channels: {ex}") from ex
    except SlackClientError as ex:
        raise SupersetException(f"Failed to list channels: {ex}") from ex


def should_use_v2_api() -> bool:
    if not feature_flag_manager.is_feature_enabled("ALERT_REPORT_SLACK_V2"):
        return False
    try:
        client = get_slack_client()
        client.conversations_list()
        logger.info("Slack API v2 is available")
        return True
    except SlackApiError:
        # use the v1 api but warn with a deprecation message
        logger.warning(
            """Your current Slack scopes are missing `channels:read`. Please add
            this to your Slack app in order to continue using the v1 API. Support
            for the old Slack API will be removed in Superset version 6.0.0."""
        )
        return False


def get_user_avatar(email: str, client: WebClient = None) -> str:
    client = client or get_slack_client()
    try:
        response = client.users_lookupByEmail(email=email)
    except Exception as ex:
        raise SlackClientError(f"Failed to lookup user by email: {email}") from ex

    user = response.data.get("user")
    if user is None:
        raise SlackClientError("No user found with that email.")

    profile = user.get("profile")
    if profile is None:
        raise SlackClientError("User found but no profile available.")

    avatar_url = profile.get("image_192")
    if avatar_url is None:
        raise SlackClientError("Profile image is not available.")

    return avatar_url
