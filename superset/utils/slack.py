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


import functools
import logging
import warnings
from typing import Any, Callable, Optional

from flask import current_app as app
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError, SlackClientError as SlackSDKClientError
from slack_sdk.http_retry.builtin_handlers import RateLimitErrorRetryHandler

from superset import feature_flag_manager
from superset.exceptions import SupersetException
from superset.extensions import cache_manager
from superset.reports.schemas import SlackChannelSchema
from superset.utils import cache as cache_util
from superset.utils.backports import StrEnum
from superset.utils.core import recipients_string_to_list

logger = logging.getLogger(__name__)

_SLACK_V1_DEPRECATION_MESSAGE = (
    "Slack v1 (the legacy `Slack` recipient type and `files.upload` API) is "
    "deprecated and will be removed in the next major release. Slack retired "
    "the `files.upload` endpoint in 2025, so v1 file uploads no longer work; "
    "only text-only `chat_postMessage` sends still succeed. Grant your Slack "
    "bot the `channels:read` and `groups:read` scopes so existing v1 "
    "recipients can be auto-upgraded to SlackV2 on "
    "their next send."
)


# functools.cache gives us a process-lifetime, thread-safe one-shot guard
# without the read-then-write race that bare module globals would have under
# multi-threaded WSGI workers. The cached return value (None) is irrelevant —
# we only care that the body executes at most once per process.
@functools.cache
def _emit_v1_flag_off_deprecation() -> None:
    warnings.warn(_SLACK_V1_DEPRECATION_MESSAGE, DeprecationWarning, stacklevel=3)
    logger.warning(
        "ALERT_REPORT_SLACK_V2 is disabled; %s", _SLACK_V1_DEPRECATION_MESSAGE
    )


@functools.cache
def _emit_v1_scope_missing_deprecation() -> None:
    warnings.warn(_SLACK_V1_DEPRECATION_MESSAGE, DeprecationWarning, stacklevel=3)


class SlackChannelTypes(StrEnum):
    PUBLIC = "public_channel"
    PRIVATE = "private_channel"


_SLACK_CONVERSATION_TYPES = ",".join(SlackChannelTypes)


class SlackClientError(Exception):
    pass


def get_slack_client() -> WebClient:
    token: str = app.config["SLACK_API_TOKEN"]
    if callable(token):
        token = token()
    client = WebClient(
        token=token,
        proxy=app.config["SLACK_PROXY"],
        timeout=app.config["SLACK_API_TIMEOUT"],
    )

    max_retry_count = app.config.get("SLACK_API_RATE_LIMIT_RETRY_COUNT", 2)
    rate_limit_handler = RateLimitErrorRetryHandler(max_retry_count=max_retry_count)
    client.retry_handlers.append(rate_limit_handler)

    logger.debug("Slack client configured with %d rate limit retries", max_retry_count)

    return client


def get_team_id() -> Optional[str]:
    """
    Return the Slack workspace (team) ID to target, or None.

    On an Enterprise Grid org, an org-scoped token spans multiple workspaces, so
    workspace-scoped methods such as ``conversations.list`` need a ``team_id`` to
    indicate which workspace to act on. The value is read from the ``SLACK_TEAM_ID``
    config var, which may be a string or a callable (mirroring ``SLACK_API_TOKEN``);
    when it is unset (the default for workspace-level tokens) None is returned and
    no ``team_id`` is sent, preserving the prior behavior.
    """
    team_id = app.config.get("SLACK_TEAM_ID")
    if callable(team_id):
        team_id = team_id()
    return team_id or None


def get_channels(
    team_id: Optional[str] = None, **kwargs: Any
) -> list[SlackChannelSchema]:
    """
    Retrieves a list of all conversations accessible by the bot
    from the Slack API, and caches results (to avoid rate limits).

    The Slack API does not provide search so to apply a search use
    get_channels_with_search instead.

    :param team_id: workspace (team) ID to target, required for org-scoped tokens
        on an Enterprise Grid org. Defaults to the configured ``SLACK_TEAM_ID``
        (via get_team_id) when not given. When set it also keys the cache so that
        distinct workspaces never share cached channel lists; when unset, the
        legacy cache key is used so that upgrading does not invalidate existing
        caches.
    :param kwargs: forwarded to the memoized fetch (``force``, ``cache_timeout``,
        ``cache``).
    """
    if team_id is None:
        team_id = get_team_id()
    cache_key = "slack_conversations_list"
    if team_id:
        cache_key = f"{cache_key}_{team_id}"
    return _get_channels(cache_key, team_id=team_id, **kwargs)


@cache_util.memoized_func(
    key="{cache_key}",
    cache=cache_manager.cache,
)
def _get_channels(
    cache_key: str, team_id: Optional[str] = None
) -> list[SlackChannelSchema]:
    client = get_slack_client()
    channel_schema = SlackChannelSchema()
    channels: list[SlackChannelSchema] = []
    extra_params = {"types": _SLACK_CONVERSATION_TYPES}
    if team_id:
        extra_params["team_id"] = team_id
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


def get_channels_with_search(
    search_string: str = "",
    types: Optional[list[SlackChannelTypes]] = None,
    exact_match: bool = False,
    force: bool = False,
) -> list[SlackChannelSchema]:
    """
    The slack api is paginated but does not include search, so we need to fetch
    all channels and filter them ourselves
    This will search by slack name or id
    """
    try:
        channels = get_channels(
            force=force,
            cache_timeout=app.config["SLACK_CACHE_TIMEOUT"],
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

    if types and not len(types) == len(SlackChannelTypes):
        conditions: list[Callable[[SlackChannelSchema], bool]] = []
        if SlackChannelTypes.PUBLIC in types:
            conditions.append(lambda channel: not channel["is_private"])
        if SlackChannelTypes.PRIVATE in types:
            conditions.append(lambda channel: channel["is_private"])

        channels = [
            channel for channel in channels if any(cond(channel) for cond in conditions)
        ]

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


_SCOPE_MISSING_ERROR_CODES = frozenset(
    {"missing_scope", "not_allowed_token_type", "no_permission"}
)


def should_use_v2_api() -> bool:
    if not feature_flag_manager.is_feature_enabled("ALERT_REPORT_SLACK_V2"):
        _emit_v1_flag_off_deprecation()
        return False
    try:
        client = get_slack_client()
        extra_params = {"types": _SLACK_CONVERSATION_TYPES}
        team_id = get_team_id()
        if team_id:
            extra_params["team_id"] = team_id
        client.conversations_list(
            limit=1,
            exclude_archived=True,
            **extra_params,
        )
        logger.info("Slack API v2 is available")
        return True
    except SlackApiError as ex:
        # Only the scope-missing branch is a v1-deprecation signal; other
        # SlackApiError codes (invalid_auth, ratelimited, server errors, etc.)
        # are unrelated probe failures and should not be reported as a missing
        # scope. We still fall back to v1 in both cases so a transient probe
        # failure doesn't break sends — operators get an actionable log either
        # way.
        # `response` is normally a SlackResponse whose payload lives in `.data`,
        # but the SDK (and our tests) can also hand back a plain dict. Read the
        # error code in either shape so the scope-missing branch isn't missed.
        response = getattr(ex, "response", None)
        data = getattr(response, "data", None)
        if not isinstance(data, dict):
            data = response if isinstance(response, dict) else {}
        error_code = data.get("error", "")
        if error_code in _SCOPE_MISSING_ERROR_CODES:
            # The DeprecationWarning fires once per process, but the actionable
            # log line fires every send so operators see it in their report logs.
            _emit_v1_scope_missing_deprecation()
            logger.warning(
                "Slack bot is missing the `channels:read` and `groups:read` "
                "scopes; falling back to the deprecated "
                "v1 API. %s",
                _SLACK_V1_DEPRECATION_MESSAGE,
            )
        else:
            logger.warning(
                "Slack v2 probe failed with error %r; falling back to the "
                "deprecated v1 API for this send. Investigate the underlying "
                "Slack API error — this is not a missing-scope problem.",
                error_code or str(ex),
            )
        return False
    except SlackSDKClientError as ex:
        # Non-API SDK failures (e.g. SlackClientNotConnectedError,
        # SlackRequestError, SlackClientConfigurationError) are not subclasses
        # of SlackApiError, so without this branch they would escape the probe
        # raw. The caller runs this probe *before* the mapped Slack send `try`,
        # so an un-caught probe error aborts the entire recipient loop instead
        # of failing a single recipient. Treat any probe connection/transport
        # failure as "v2 unavailable" and fall back to the deprecated v1 API,
        # matching the SlackApiError behavior above.
        logger.warning(
            "Slack v2 probe failed to connect (%s: %s); falling back to the "
            "deprecated v1 API for this send.",
            type(ex).__name__,
            ex,
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
