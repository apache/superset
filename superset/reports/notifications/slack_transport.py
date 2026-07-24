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

import math
import time
from collections.abc import Callable
from functools import partial
from typing import TypeVar
from urllib.error import HTTPError

import backoff
from flask import current_app as app
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError, SlackRequestError

from superset.reports.notifications.exceptions import (
    NotificationTransientError,
    NotificationUnprocessableException,
)
from superset.utils.slack import (
    get_slack_api_error_code,
    get_slack_api_status_code,
    is_retryable_slack_transport_error,
    is_transient_slack_api_error,
    is_transient_slack_transport_error,
    SLACK_TRANSIENT_TRANSPORT_ERRORS,
)

SLACK_API_TIMEOUT_MARGIN = 1

_SlackApiResult = TypeVar("_SlackApiResult")

_SLACK_RETRY_DEADLINE_MESSAGE = (
    "Slack send retry deadline exceeded; increase SLACK_SEND_RETRY_MAX_TIME "
    "for multi-channel or large-file reports"
)


class SlackRetryDeadlineError(Exception):
    """A Slack operation was skipped because the shared send budget expired."""

    def __init__(self) -> None:
        super().__init__(_SLACK_RETRY_DEADLINE_MESSAGE)


class SlackChannelResponseError(SlackRequestError):
    """Slack returned malformed channel-specific data before a terminal write."""


_SLACK_RETRY_ERRORS = (SlackApiError, *SLACK_TRANSIENT_TRANSPORT_ERRORS)
_SLACK_CHANNEL_FAILURES = (
    *_SLACK_RETRY_ERRORS,
    SlackChannelResponseError,
    SlackRetryDeadlineError,
)


def _get_slack_send_retry_max_time() -> float:
    """Return the effective total send budget in seconds."""
    configured_budget = float(app.config["SLACK_SEND_RETRY_MAX_TIME"])
    request_timeout = float(app.config.get("SLACK_API_TIMEOUT", 30))
    return max(
        configured_budget,
        request_timeout + SLACK_API_TIMEOUT_MARGIN,
    )


def _give_up_slack_api_retry(
    ex: Exception,
    *,
    retry_transient_errors: bool = True,
    retry_transport_errors: bool = False,
) -> bool:
    """Return whether application backoff should stop retrying a Slack call."""
    if isinstance(ex, HTTPError) and ex.code == 429:
        return True
    if not isinstance(ex, SlackApiError):
        if not retry_transient_errors:
            return True
        return not (
            is_transient_slack_transport_error(ex)
            if retry_transport_errors
            else is_retryable_slack_transport_error(ex)
        )

    status_code = get_slack_api_status_code(ex)
    # call_slack_api handles HTTP 429 within the shared monotonic deadline.
    # Retrying an exhausted 429 through the outer backoff would multiply the
    # operator-configured rate-limit budget.
    error_code = get_slack_api_error_code(ex)
    if status_code == 429:
        return True
    if not retry_transient_errors:
        return True
    if is_transient_slack_api_error(ex, error_code):
        return False
    if status_code is not None and 400 <= status_code < 500:
        return True
    return bool(error_code)


def _get_slack_retry_after(ex: SlackApiError | HTTPError) -> float | None:
    response = getattr(ex, "response", ex)
    headers = getattr(response, "headers", None)
    if headers is None:
        return None
    for name in headers.keys():
        if name.lower() != "retry-after":
            continue
        value = headers.get(name)
        raw_value = value[0] if isinstance(value, list) else value
        try:
            retry_after = float(raw_value)
            return max(retry_after, 0.0) if math.isfinite(retry_after) else None
        except (TypeError, ValueError):
            return None
    return None


def _get_slack_rate_limit_status(ex: SlackApiError | HTTPError) -> int | None:
    if isinstance(ex, HTTPError):
        return ex.code
    return get_slack_api_status_code(ex)


def call_slack_api(
    method: Callable[..., _SlackApiResult],
    *,
    retry_deadline: float | None = None,
    retry_transient_errors: bool = True,
    retry_transport_errors: bool = False,
    retry_rate_limits: bool = True,
    **kwargs: object,
) -> _SlackApiResult:
    """Call Slack with bounded retries, optionally sharing an outer deadline."""
    if retry_deadline is None:
        retry_deadline = time.monotonic() + _get_slack_send_retry_max_time()
    max_time = retry_deadline - time.monotonic()
    if max_time <= 0:
        raise SlackRetryDeadlineError

    max_rate_limit_retries = (
        max(
            int(app.config.get("SLACK_API_RATE_LIMIT_RETRY_COUNT", 2)),
            0,
        )
        if retry_rate_limits
        else 0
    )
    rate_limit_retries = 0

    @backoff.on_exception(
        backoff.expo,
        _SLACK_RETRY_ERRORS,
        factor=10,
        base=2,
        max_tries=5,
        max_time=max_time,
        giveup=partial(
            _give_up_slack_api_retry,
            retry_transient_errors=retry_transient_errors,
            retry_transport_errors=retry_transport_errors,
        ),
    )
    def call() -> _SlackApiResult:
        nonlocal rate_limit_retries
        while True:
            if time.monotonic() >= retry_deadline:
                raise SlackRetryDeadlineError
            try:
                return method(**kwargs)
            except (SlackApiError, HTTPError) as ex:
                if (
                    _get_slack_rate_limit_status(ex) != 429
                    or rate_limit_retries >= max_rate_limit_retries
                ):
                    raise
                retry_after = _get_slack_retry_after(ex)
                if retry_after is None:
                    raise
                remaining = retry_deadline - time.monotonic()
                if retry_after >= remaining:
                    raise SlackRetryDeadlineError from ex
                time.sleep(retry_after)
                rate_limit_retries += 1

    return call()


def call_slack_api_with_timeout(
    client: WebClient,
    method: Callable[..., _SlackApiResult],
    *,
    retry_deadline: float,
    retry_transient_errors: bool = True,
    retry_transport_errors: bool = False,
    retry_rate_limits: bool = True,
    **kwargs: object,
) -> _SlackApiResult:
    """Call Slack with the SDK request timeout capped by the shared budget."""
    original_timeout = client.timeout

    def call() -> _SlackApiResult:
        remaining = retry_deadline - time.monotonic()
        if remaining <= 0:
            raise SlackRetryDeadlineError
        client.timeout = min(float(original_timeout), remaining)
        try:
            return method(**kwargs)
        finally:
            client.timeout = original_timeout

    return call_slack_api(
        call,
        retry_deadline=retry_deadline,
        retry_transient_errors=retry_transient_errors,
        retry_transport_errors=retry_transport_errors,
        retry_rate_limits=retry_rate_limits,
    )


def send_to_slack_channels(
    channels: list[str],
    send_to_channel: Callable[[str, float], None],
) -> None:
    """Send to every channel within one retry deadline and aggregate failures."""
    retry_deadline = time.monotonic() + _get_slack_send_retry_max_time()
    failures: list[tuple[str, Exception]] = []
    for channel in channels:
        try:
            send_to_channel(channel, retry_deadline)
        except _SLACK_CHANNEL_FAILURES as ex:
            failures.append((channel, ex))

    if not failures:
        return

    details = "; ".join(f"{channel}: {error}" for channel, error in failures)
    message = f"Slack delivery failed for the following channels: {details}"
    if any(
        isinstance(error, SlackRetryDeadlineError)
        or isinstance(error, SlackChannelResponseError)
        or is_transient_slack_transport_error(error)
        or (
            isinstance(error, SlackApiError)
            and is_transient_slack_api_error(
                error,
                get_slack_api_error_code(error),
            )
        )
        for _, error in failures
    ):
        raise NotificationTransientError(message) from failures[0][1]
    raise NotificationUnprocessableException(message) from failures[0][1]
