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
from typing import Any, Optional

from flask import current_app as app
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError, SlackClientError as SlackSDKClientError
from slack_sdk.http_retry.builtin_handlers import RateLimitErrorRetryHandler

from superset import feature_flag_manager
from superset.exceptions import SupersetException
from superset.extensions import cache_manager
from superset.reports.schemas import SlackChannelSchema
from superset.utils.backports import StrEnum

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

SLACK_CHANNELS_CACHE_KEY = "slack_conversations_list"
SLACK_CHANNELS_CONTINUATION_CURSOR_KEY = (
    f"{SLACK_CHANNELS_CACHE_KEY}_continuation_cursor"
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

    while True:
        response = client.conversations_list(
            limit=999,
            cursor=slack_cursor,
            exclude_archived=True,
            types=types_param,
        )

        page_channels = [
            channel_schema.load(channel) for channel in response.data["channels"]
        ]
        channels.extend(page_channels)

        slack_cursor = response.data.get("response_metadata", {}).get("next_cursor")

        if not slack_cursor or len(channels) >= limit:
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
    search_terms = [
        term.strip().lower() for term in search_string.split(",") if term.strip()
    ]

    while len(matches) < limit:
        response = client.conversations_list(
            limit=999,
            cursor=slack_cursor,
            exclude_archived=True,
            types=types_param,
        )

        for channel_data in response.data["channels"]:
            channel_name_lower = channel_data["name"].lower()
            channel_id_lower = channel_data["id"].lower()

            is_match = False
            for search_term in search_terms:
                if exact_match:
                    if (
                        search_term == channel_name_lower
                        or search_term == channel_id_lower
                    ):
                        is_match = True
                        break
                else:
                    if (
                        search_term in channel_name_lower
                        or search_term in channel_id_lower
                    ):
                        is_match = True
                        break

            if is_match:
                channel = channel_schema.load(channel_data)
                matches.append(channel)

            if len(matches) >= limit:
                break

        slack_cursor = response.data.get("response_metadata", {}).get("next_cursor")
        if not slack_cursor:
            break

    has_more = bool(slack_cursor) and len(matches) >= limit

    return {
        "result": matches[:limit],
        "next_cursor": slack_cursor if has_more else None,
        "has_more": has_more,
    }


def _fetch_from_cache(  # noqa: C901
    cached_channels: list[SlackChannelSchema],
    search_string: str,
    types: Optional[list[SlackChannelTypes]],
    exact_match: bool,
    cursor: Optional[str],
    limit: int,
) -> Optional[dict[str, Any]]:
    """
    Fetch channels from cache with in-memory filtering and pagination.

    This is the fast path - operates entirely in-memory on cached data.
    Used when cache is available and warm.

    Args:
        cached_channels: Complete list of all cached channels
        search_string: Search term(s) for filtering
        types: Channel types to filter
        exact_match: If True, search term must exactly match
        cursor: Cache pagination cursor (format: "cache:N")
        limit: Maximum channels to return

    Returns:
        Dict with filtered and paginated results, or None if pagination
        exceeds cached data (signals need to fall back to API)
    """
    # Start with all cached channels
    channels = list(cached_channels)

    # Filter by channel types if specified
    if types and len(types) < len(SlackChannelTypes):
        type_set = set(types)
        channels = [
            ch
            for ch in channels
            if (
                (SlackChannelTypes.PRIVATE in type_set and ch.get("is_private"))
                or (SlackChannelTypes.PUBLIC in type_set and not ch.get("is_private"))
            )
        ]

    # Filter by search string with comma-separated OR logic
    if search_string:
        search_terms = [
            term.strip().lower() for term in search_string.split(",") if term.strip()
        ]
        filtered = []

        for ch in channels:
            channel_name_lower = ch.get("name", "").lower()
            channel_id_lower = ch.get("id", "").lower()
            is_match = False

            for search_term in search_terms:
                if exact_match:
                    if (
                        search_term == channel_name_lower
                        or search_term == channel_id_lower
                    ):
                        is_match = True
                        break
                else:
                    if (
                        search_term in channel_name_lower
                        or search_term in channel_id_lower
                    ):
                        is_match = True
                        break

            if is_match:
                filtered.append(ch)

        channels = filtered

    # Calculate pagination offset from cursor
    offset = 0
    if cursor and cursor.startswith("cache:"):
        try:
            offset = int(cursor.split(":", 1)[1])
        except (ValueError, IndexError):
            offset = 0

    # Check if we're trying to paginate beyond cached data
    if offset >= len(channels):
        logger.info(
            "Pagination offset (%d) exceeds cached data (%d channels). "
            "Falling back to API.",
            offset,
            len(channels),
        )
        return None

    # Paginate in memory
    page = channels[offset : offset + limit]
    next_offset = offset + limit
    has_more = next_offset < len(channels)

    # Check if we have a continuation cursor (cache was truncated)
    continuation_cursor = cache_manager.cache.get(
        SLACK_CHANNELS_CONTINUATION_CURSOR_KEY
    )

    # If we've reached the end of cached data but there's a continuation cursor,
    # signal that more data exists via API
    next_cursor: Optional[str]
    if not has_more and continuation_cursor:
        # Return special cursor that signals transition to API
        next_cursor = "api:continue"
        has_more = True
    else:
        # Use synthetic cursor for cache pagination
        next_cursor = f"cache:{next_offset}" if has_more else None

    return {
        "result": page,
        "next_cursor": next_cursor,
        "has_more": has_more,
    }


def _fetch_from_api(
    search_string: str,
    types: Optional[list[SlackChannelTypes]],
    exact_match: bool,
    cursor: Optional[str],
    limit: int,
) -> dict[str, Any]:
    """
    Fetch from Slack API with pagination.

    This is the original pagination implementation extracted into a helper.
    Used when cache is cold or disabled.

    Args:
        search_string: Search term(s) for filtering
        types: Channel types to filter
        exact_match: If True, search term must exactly match
        cursor: Real Slack API cursor for pagination
        limit: Maximum channels to return

    Returns:
        Dict with results from Slack API
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


def get_channels_with_search(
    search_string: str = "",
    types: Optional[list[SlackChannelTypes]] = None,
    exact_match: bool = False,
    cursor: Optional[str] = None,
    limit: int = 100,
) -> dict[str, Any]:
    """
    Fetches Slack channels with pagination and search support.

    Args:
        search_string: Search term(s). Can be comma-separated for OR logic.
                      e.g., "engineering,marketing" matches channels containing
                      "engineering" OR "marketing"
        types: Channel types to filter (public_channel, private_channel)
        exact_match: If True, search term must exactly match channel name/ID
        cursor: Pagination cursor (format: "cache:N" for cache path,
                "api:continue" for transitioning to API continuation,
                base64 string for API path, None for first page)
        limit: Maximum number of channels to return per page

    Returns a dict with:
    - result: list of channels for this page
    - next_cursor: cursor for next page (None if no more pages)
    - has_more: boolean indicating if more pages exist
    """
    enable_caching = app.config.get("SLACK_ENABLE_CACHING", True)

    # Handle transition from cache to API continuation
    if cursor == "api:continue":
        continuation_cursor = cache_manager.cache.get(
            SLACK_CHANNELS_CONTINUATION_CURSOR_KEY
        )
        if continuation_cursor:
            logger.info("Transitioning from cache to API using continuation cursor")
            return _fetch_from_api(
                search_string, types, exact_match, continuation_cursor, limit
            )
        else:
            logger.warning(
                "No continuation cursor available, cannot fetch more channels"
            )
            return {"result": [], "next_cursor": None, "has_more": False}

    # Try cache path for first page or cache cursor
    if enable_caching and (cursor is None or (cursor and cursor.startswith("cache:"))):
        cached_channels = cache_manager.cache.get(SLACK_CHANNELS_CACHE_KEY)
        if cached_channels:
            if cursor is None:
                logger.info(
                    "Using cache path (%d channels available)", len(cached_channels)
                )

            result = _fetch_from_cache(
                cached_channels, search_string, types, exact_match, cursor, limit
            )

            # If cache returns None, we've exceeded cache boundary
            if result is None:
                # Fall back to API using continuation cursor
                continuation_cursor = cache_manager.cache.get(
                    SLACK_CHANNELS_CONTINUATION_CURSOR_KEY
                )
                if continuation_cursor:
                    logger.info(
                        "Cache boundary exceeded, falling back to API "
                        "with continuation cursor"
                    )
                    return _fetch_from_api(
                        search_string, types, exact_match, continuation_cursor, limit
                    )
                else:
                    logger.warning(
                        "Cache boundary exceeded but no continuation cursor available"
                    )
                    return {"result": [], "next_cursor": None, "has_more": False}

            return result
        else:
            logger.debug("Cache not available, using API path")
            cursor = None  # Reset cursor for API call

    # API path for real Slack cursors
    logger.debug("Using API path")
    return _fetch_from_api(search_string, types, exact_match, cursor, limit)


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
