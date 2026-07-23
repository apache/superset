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
from http.client import RemoteDisconnected
from typing import Any, Callable, Literal, Optional, overload
from urllib.error import HTTPError, URLError

from flask import current_app as app
from slack_sdk import WebClient
from slack_sdk.errors import (
    SlackApiError,
    SlackClientError as SlackSDKClientError,
    SlackClientNotConnectedError,
)
from slack_sdk.http_retry.builtin_handlers import RateLimitErrorRetryHandler

from superset import feature_flag_manager
from superset.constants import CACHE_DISABLED_TIMEOUT
from superset.exceptions import SupersetException
from superset.extensions import cache_manager
from superset.extensions.metastore_cache import SupersetMetastoreCache
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


class SlackV2ProbeError(SupersetException):
    """Transient probe failure classified by ``_send`` as a system error.

    ``BaseReportState._send`` catches this through ``SupersetException`` and
    uses the inherited status code to select ERROR severity.
    """


class SlackV2ProbeClientError(SlackV2ProbeError):
    """Permanent probe failure classified by ``_send`` as a client warning.

    ``BaseReportState._send`` catches this through ``SupersetException`` and
    uses this status code to select WARNING severity.
    """

    status = 422


class SlackChannelListingError(SupersetException):
    """Slack channel listing failed due to a transient service condition."""


class SlackChannelListingClientError(SlackChannelListingError):
    """Slack channel listing failed due to permanent token or client setup."""

    status = 422


_TRANSIENT_SLACK_API_ERROR_CODES = frozenset(
    {
        "fatal_error",
        "internal_error",
        "ratelimited",
        "request_timeout",
        "rollup_error",
        "service_unavailable",
        "timeout",
    }
)

SLACK_TRANSIENT_TRANSPORT_ERRORS: tuple[type[Exception], ...] = (
    SlackClientNotConnectedError,
    URLError,
    ConnectionResetError,
    RemoteDisconnected,
    TimeoutError,
)

_SLACK_CHANNEL_REFRESH_COOLDOWN_SECONDS = 300


NO_SLACK_RECIPIENTS_MESSAGE = "No recipients saved in the report"


def parse_slack_recipient_targets(target: str) -> list[str]:
    """Parse Slack targets, removing duplicates while preserving their order."""
    return list(dict.fromkeys(recipients_string_to_list(target)))


def _get_slack_api_error_data(ex: SlackApiError) -> dict[str, Any]:
    response = getattr(ex, "response", None)
    data = getattr(response, "data", None)
    if not isinstance(data, dict):
        data = response if isinstance(response, dict) else {}
    return data


def _get_slack_api_error_code(ex: SlackApiError) -> str:
    return str(_get_slack_api_error_data(ex).get("error") or "")


def _get_slack_api_status_code(ex: SlackApiError) -> int | None:
    return getattr(getattr(ex, "response", None), "status_code", None)


def _is_transient_slack_api_error(ex: SlackApiError, error_code: str) -> bool:
    status_code = _get_slack_api_status_code(ex)
    return bool(
        status_code in {408, 429}
        or (status_code is not None and 500 <= status_code < 600)
        or error_code in _TRANSIENT_SLACK_API_ERROR_CODES
    )


def is_transient_slack_transport_error(ex: Exception) -> bool:
    """Classify raw Slack WebClient transport and external-upload failures."""
    if isinstance(ex, HTTPError):
        return ex.code in {408, 429} or 500 <= ex.code < 600
    return isinstance(ex, SLACK_TRANSIENT_TRANSPORT_ERRORS)


def is_retryable_slack_transport_error(ex: Exception) -> bool:
    """Return whether an application retry cannot duplicate an accepted write."""
    if isinstance(ex, HTTPError):
        return is_transient_slack_transport_error(ex)
    return isinstance(ex, SlackClientNotConnectedError)


def get_slack_client(*, for_delivery: bool = False) -> WebClient:
    """Build a Slack client without nested SDK retries for delivery writes."""
    token: str = app.config["SLACK_API_TOKEN"]
    if callable(token):
        token = token()
    client = WebClient(
        token=token,
        proxy=app.config["SLACK_PROXY"],
        timeout=app.config["SLACK_API_TIMEOUT"],
        retry_handlers=[] if for_delivery else None,
    )

    max_retry_count = app.config.get("SLACK_API_RATE_LIMIT_RETRY_COUNT", 2)
    if not for_delivery:
        rate_limit_handler = RateLimitErrorRetryHandler(
            max_retry_count=max_retry_count,
        )
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


def _get_slack_channels_cache_key(team_id: Optional[str]) -> str:
    cache_key = "slack_conversations_list"
    return f"{cache_key}_{team_id}" if team_id else cache_key


def _slack_channel_cache_uses_report_session() -> bool:
    """Return whether cache writes commit or roll back the report DB session."""
    return isinstance(cache_manager.cache.cache, SupersetMetastoreCache)


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
    cache_key = _get_slack_channels_cache_key(team_id)
    return _get_channels(cache_key, team_id=team_id, **kwargs)


def _get_channels_with_cache_status() -> tuple[list[SlackChannelSchema], bool]:
    """Fetch channels and cache-hit provenance using one cache read."""
    team_id = get_team_id()
    cache_key = _get_slack_channels_cache_key(team_id)
    cache_timeout = app.config["SLACK_CACHE_TIMEOUT"]
    if cache_timeout == CACHE_DISABLED_TIMEOUT:
        return _get_channels(cache_key, team_id=team_id, cache=False), False
    if (cached_channels := cache_manager.cache.get(cache_key)) is not None:
        return cached_channels, True

    channels = _get_channels(cache_key, team_id=team_id, cache=False)
    if not _slack_channel_cache_uses_report_session():
        cache_manager.cache.set(cache_key, channels, timeout=cache_timeout)
    return channels, False


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


def _filter_slack_channels(
    channels: list[SlackChannelSchema],
    *,
    search_string: str,
    types: Optional[list[SlackChannelTypes]],
    exact_match: bool,
) -> list[SlackChannelSchema]:
    """Filter a complete Slack channel listing by type and target."""
    if types and len(types) != len(SlackChannelTypes):
        conditions: list[Callable[[SlackChannelSchema], bool]] = []
        if SlackChannelTypes.PUBLIC in types:
            conditions.append(lambda channel: not channel["is_private"])
        if SlackChannelTypes.PRIVATE in types:
            conditions.append(lambda channel: channel["is_private"])

        channels = [
            channel for channel in channels if any(cond(channel) for cond in conditions)
        ]

    if not search_string:
        return channels

    search_array = recipients_string_to_list(search_string)
    return [
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


@overload
def get_channels_with_search(
    search_string: str = "",
    types: Optional[list[SlackChannelTypes]] = None,
    exact_match: bool = False,
    force: bool = False,
    cache: bool = True,
    *,
    return_cache_status: Literal[False] = False,
) -> list[SlackChannelSchema]: ...


@overload
def get_channels_with_search(
    search_string: str = "",
    types: Optional[list[SlackChannelTypes]] = None,
    exact_match: bool = False,
    force: bool = False,
    cache: bool = True,
    *,
    return_cache_status: Literal[True],
) -> tuple[list[SlackChannelSchema], bool]: ...


def get_channels_with_search(
    search_string: str = "",
    types: Optional[list[SlackChannelTypes]] = None,
    exact_match: bool = False,
    force: bool = False,
    cache: bool = True,
    *,
    return_cache_status: bool = False,
) -> list[SlackChannelSchema] | tuple[list[SlackChannelSchema], bool]:
    """
    The slack api is paginated but does not include search, so we need to fetch
    all channels and filter them ourselves
    This will search by slack name or id
    """
    used_cache = False
    cache_timeout = app.config["SLACK_CACHE_TIMEOUT"]
    cache_enabled = cache and cache_timeout != CACHE_DISABLED_TIMEOUT
    try:
        if return_cache_status and cache_enabled and not force:
            channels, used_cache = _get_channels_with_cache_status()
        else:
            channels = get_channels(
                force=force,
                cache=cache_enabled,
                cache_timeout=cache_timeout,
            )
    except SlackApiError as ex:
        error_code = _get_slack_api_error_code(ex)
        error_class = (
            SlackChannelListingError
            if _is_transient_slack_api_error(ex, error_code)
            else SlackChannelListingClientError
        )
        raise error_class(f"Failed to list channels: {ex}") from ex
    except SLACK_TRANSIENT_TRANSPORT_ERRORS as ex:
        error_class = (
            SlackChannelListingError
            if is_transient_slack_transport_error(ex)
            else SlackChannelListingClientError
        )
        raise error_class(f"Failed to list channels: {ex}") from ex
    except (SlackSDKClientError, SlackClientError) as ex:
        raise SlackChannelListingClientError(f"Failed to list channels: {ex}") from ex

    channels = _filter_slack_channels(
        channels,
        search_string=search_string,
        types=types,
        exact_match=exact_match,
    )
    return (channels, used_cache) if return_cache_status else channels


def refresh_cached_slack_channels_with_search(
    search_string: str = "",
    types: Optional[list[SlackChannelTypes]] = None,
    exact_match: bool = False,
) -> list[SlackChannelSchema]:
    """Refresh stale channels with a best-effort cache-backend cooldown.

    External cache backends record a cooldown only after the refreshed listing
    is stored successfully. Disabled and metastore-backed caches use an uncached
    request without a cooldown because metastore writes commit the report
    transaction. Concurrent workers can still refresh in parallel when the
    backend cannot provide transaction-safe coordination.
    """
    team_id = get_team_id()
    cache_key = _get_slack_channels_cache_key(team_id)
    cooldown_key = f"{cache_key}_refresh_cooldown"
    cache_timeout = app.config["SLACK_CACHE_TIMEOUT"]

    if (
        _slack_channel_cache_uses_report_session()
        or cache_timeout == CACHE_DISABLED_TIMEOUT
    ):
        return get_channels_with_search(
            search_string=search_string,
            types=types,
            exact_match=exact_match,
            force=True,
            cache=False,
        )

    if cache_manager.cache.get(cooldown_key) is not None:
        return get_channels_with_search(
            search_string=search_string,
            types=types,
            exact_match=exact_match,
            force=False,
        )

    refreshed_channels = get_channels_with_search(
        force=True,
        cache=False,
    )
    try:
        cache_updated = (
            cache_manager.cache.set(
                cache_key,
                refreshed_channels,
                timeout=cache_timeout,
            )
            is not False
        )
    except Exception:  # pylint: disable=broad-exception-caught
        cache_updated = False
        logger.warning(
            "Could not cache refreshed Slack channels",
            exc_info=True,
        )

    channels = _filter_slack_channels(
        refreshed_channels,
        search_string=search_string,
        types=types,
        exact_match=exact_match,
    )
    if not cache_updated:
        return channels

    try:
        cache_manager.cache.set(
            cooldown_key,
            True,
            timeout=_SLACK_CHANNEL_REFRESH_COOLDOWN_SECONDS,
        )
    except Exception:  # pylint: disable=broad-exception-caught
        logger.warning(
            "Could not record Slack channel refresh cooldown",
            exc_info=True,
        )
    return channels


_SCOPE_MISSING_ERROR_CODES = frozenset(
    {"missing_scope", "not_allowed_token_type", "no_permission"}
)


def should_use_v2_api(*, raise_on_error: bool = False) -> bool:
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
        # scope. Scope errors continue through v1 for compatibility. Other
        # failures also fall back for text-only reports, while file-bearing
        # reports request an exception so monitoring retains the system/client
        # classification.
        error_code = _get_slack_api_error_code(ex)
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
                "Slack v2 probe failed with error %r. Investigate the underlying "
                "Slack API error; this is not a missing-scope problem.",
                error_code or str(ex),
            )
            if raise_on_error:
                error_class = (
                    SlackV2ProbeError
                    if _is_transient_slack_api_error(ex, error_code)
                    else SlackV2ProbeClientError
                )
                raise error_class(
                    f"Slack v2 availability probe failed: {error_code or str(ex)}"
                ) from ex
        return False
    except SLACK_TRANSIENT_TRANSPORT_ERRORS as ex:
        logger.warning(
            "Slack v2 probe failed (%s: %s).",
            type(ex).__name__,
            ex,
        )
        if raise_on_error:
            error_class = (
                SlackV2ProbeError
                if is_transient_slack_transport_error(ex)
                else SlackV2ProbeClientError
            )
            raise error_class(
                f"Slack v2 availability probe failed: {type(ex).__name__}: {ex}"
            ) from ex
        return False
    except SlackSDKClientError as ex:
        # Permanent SDK request/configuration failures are operator-fixable.
        # Text reports retain v1 compatibility, while file-bearing reports ask
        # the command to preserve the client-error classification.
        logger.warning(
            "Slack v2 probe failed (%s: %s).",
            type(ex).__name__,
            ex,
        )
        if raise_on_error:
            raise SlackV2ProbeClientError(
                f"Slack v2 availability probe failed: {type(ex).__name__}: {ex}"
            ) from ex
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
