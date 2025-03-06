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
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError
from slack_sdk.http_retry.builtin_handlers import RateLimitErrorRetryHandler

from superset import feature_flag_manager
from superset.exceptions import SupersetException
from superset.extensions import cache_manager
from superset.reports.schemas import SlackChannelSchema
from superset.utils import cache as cache_util
from superset.utils.backports import StrEnum
from superset.utils.core import recipients_string_to_list

logger = logging.getLogger(__name__)


class SlackChannelTypes(StrEnum):
    PUBLIC = "public_channel"
    PRIVATE = "private_channel"


class SlackClientError(Exception):
    pass


def get_slack_client() -> WebClient:
    token: str = current_app.config["SLACK_API_TOKEN"]
    if callable(token):
        token = token()
    client = WebClient(token=token, proxy=current_app.config["SLACK_PROXY"])

    rate_limit_handler = RateLimitErrorRetryHandler(max_retry_count=2)
    client.retry_handlers.append(rate_limit_handler)

    return client


@cache_util.memoized_func(
    key="slack_conversations_list",
    cache=cache_manager.cache,
)
def get_channels(limit: int, extra_params: dict[str, Any]) -> list[SlackChannelSchema]:
    """
    Retrieves a list of all conversations accessible by the bot
    from the Slack API, and caches results (to avoid rate limits).

    The Slack API does not provide search so to apply a search use
    get_channels_with_search instead.
    """
    client = get_slack_client()
    channel_schema = SlackChannelSchema()
    channels: list[SlackChannelSchema] = []
    cursor = None

    while True:
        response = client.conversations_list(
            limit=limit, cursor=cursor, exclude_archived=True, **extra_params
        )
        channels.extend(
            channel_schema.load(channel) for channel in response.data["channels"]
        )
        cursor = response.data.get("response_metadata", {}).get("next_cursor")
        if not cursor:
            break

    return channels


def get_channels_with_search(
    search_string: str = "",
    limit: int = 999,
    types: Optional[list[SlackChannelTypes]] = None,
    exact_match: bool = False,
    force: bool = False,
) -> list[SlackChannelSchema]:
    """
    The slack api is paginated but does not include search, so we need to fetch
    all channels and filter them ourselves
    This will search by slack name or id
    """
    extra_params = {}
    extra_params["types"] = ",".join(types) if types else None
    try:
        channels = get_channels(
            limit=limit,
            extra_params=extra_params,
            force=force,
            cache_timeout=86400,
        )
    except (SlackClientError, SlackApiError) as ex:
        raise SupersetException(f"Failed to list channels: {ex}") from ex

    # The search string can be multiple channels separated by commas
    if search_string:
        search_array = recipients_string_to_list(search_string)
        channels = [
            channel
            for channel in channels
            if any(
                (
                    search.lower() == channel["name"].lower()
                    or search.lower() == channel["id"].lower()
                    if exact_match
                    else (
                        search.lower() in channel["name"].lower()
                        or search.lower() in channel["id"].lower()
                    )
                )
                for search in search_array
            )
        ]
    return channels


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
