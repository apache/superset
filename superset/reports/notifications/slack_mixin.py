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
import pandas as pd
from flask import current_app as app
from flask_babel import gettext as __
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError, SlackRequestError

from superset.reports.notifications.base import NotificationContent
from superset.reports.notifications.exceptions import (
    NotificationTransientError,
    NotificationUnprocessableException,
)
from superset.utils.slack import (
    _get_slack_api_error_code,
    _get_slack_api_status_code,
    _is_transient_slack_api_error,
    is_retryable_slack_transport_error,
    is_transient_slack_transport_error,
    SLACK_TRANSIENT_TRANSPORT_ERRORS,
)

# Slack only allows Markdown messages up to 4k chars
MAXIMUM_MESSAGE_SIZE = 4000
SLACK_SEND_RETRY_MAX_TIME = 150

_SlackApiResult = TypeVar("_SlackApiResult")


class SlackRetryDeadlineError(Exception):
    """A Slack operation was skipped because the shared send budget expired."""


class SlackChannelResponseError(SlackRequestError):
    """Slack returned malformed channel-specific data before a terminal write."""


_SLACK_RETRY_ERRORS = (SlackApiError, *SLACK_TRANSIENT_TRANSPORT_ERRORS)
_SLACK_CHANNEL_FAILURES = (
    *_SLACK_RETRY_ERRORS,
    SlackChannelResponseError,
    SlackRetryDeadlineError,
)


def _give_up_slack_api_retry(
    ex: Exception,
    *,
    retry_transient_errors: bool = True,
    retry_transport_errors: bool = False,
) -> bool:
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

    status_code = _get_slack_api_status_code(ex)
    # call_slack_api handles HTTP 429 within the shared monotonic deadline.
    # Retrying an exhausted 429 through the outer backoff would multiply the
    # operator-configured rate-limit budget.
    error_code = _get_slack_api_error_code(ex)
    if status_code == 429:
        return True
    if not retry_transient_errors:
        return True
    if _is_transient_slack_api_error(ex, error_code):
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
    return _get_slack_api_status_code(ex)


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
        retry_deadline = time.monotonic() + SLACK_SEND_RETRY_MAX_TIME
    max_time = retry_deadline - time.monotonic()
    if max_time <= 0:
        raise SlackRetryDeadlineError("Slack send retry deadline exceeded")

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
                raise SlackRetryDeadlineError("Slack send retry deadline exceeded")
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
                    raise SlackRetryDeadlineError(
                        "Slack send retry deadline exceeded"
                    ) from ex
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
            raise SlackRetryDeadlineError("Slack send retry deadline exceeded")
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
    retry_deadline = time.monotonic() + SLACK_SEND_RETRY_MAX_TIME
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
            and _is_transient_slack_api_error(
                error,
                _get_slack_api_error_code(error),
            )
        )
        for _, error in failures
    ):
        raise NotificationTransientError(message) from failures[0][1]
    raise NotificationUnprocessableException(message) from failures[0][1]


# pylint: disable=too-few-public-methods
class SlackMixin:
    def _message_template(
        self,
        content: NotificationContent,
        table: str = "",
    ) -> str:
        return __(
            """*%(name)s*

%(description)s

<%(url)s|Explore in Superset>

%(table)s
""",
            name=content.name,
            description=content.description or "",
            url=content.url,
            table=table,
        )

    @staticmethod
    def _error_template(name: str, description: str, text: str) -> str:
        return __(
            """*%(name)s*

    %(description)s

    Error: %(text)s
    """,
            name=name,
            description=description,
            text=text,
        )

    def _get_body(self, content: NotificationContent) -> str:
        if content.text:
            return self._error_template(
                content.name, content.description or "", content.text
            )

        if content.embedded_data is None:
            return self._message_template(content=content)

        # Embed data in the message
        df = content.embedded_data

        # Flatten columns/index so they show up nicely in the table
        df.columns = [
            (
                " ".join(str(name) for name in column).strip()
                if isinstance(column, tuple)
                else column
            )
            for column in df.columns
        ]
        df.index = [
            (
                " ".join(str(name) for name in index).strip()
                if isinstance(index, tuple)
                else index
            )
            for index in df.index
        ]

        # Slack Markdown only works on messages shorter than 4k chars, so we might
        # need to truncate the data
        for i in range(len(df) - 1):
            truncated_df = df[: i + 1].fillna("")
            truncated_row = pd.Series(dict.fromkeys(df.columns, "..."))
            truncated_df = pd.concat(
                [truncated_df, truncated_row.to_frame().T], ignore_index=True
            )
            tabulated = df.to_markdown()
            table = f"```\n{tabulated}\n```\n\n(table was truncated)"
            message = self._message_template(table=table, content=content)
            if len(message) > MAXIMUM_MESSAGE_SIZE:
                # Decrement i and build a message that is under the limit
                truncated_df = df[:i].fillna("")
                truncated_row = pd.Series(dict.fromkeys(df.columns, "..."))
                truncated_df = pd.concat(
                    [truncated_df, truncated_row.to_frame().T], ignore_index=True
                )
                tabulated = df.to_markdown()
                table = (
                    f"```\n{tabulated}\n```\n\n(table was truncated)"
                    if len(truncated_df) > 0
                    else ""
                )
                break

        # Send full data
        else:
            tabulated = df.to_markdown()
            table = f"```\n{tabulated}\n```"

        return self._message_template(table=table, content=content)
