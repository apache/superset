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

from collections.abc import Callable

import backoff
import pandas as pd
from flask_babel import gettext as __
from slack_sdk.errors import SlackApiError, SlackClientNotConnectedError

from superset.reports.notifications.base import NotificationContent
from superset.utils.slack import (
    _get_slack_api_error_code,
    _get_slack_api_status_code,
    _is_transient_slack_api_error,
)

# Slack only allows Markdown messages up to 4k chars
MAXIMUM_MESSAGE_SIZE = 4000


def _give_up_slack_api_retry(ex: Exception) -> bool:
    if not isinstance(ex, SlackApiError):
        return False

    status_code = _get_slack_api_status_code(ex)
    # WebClient's RateLimitErrorRetryHandler owns the operator-configured 429
    # retry budget. Retrying an exhausted 429 here would multiply that budget
    # by this helper's max_tries.
    error_code = _get_slack_api_error_code(ex)
    if status_code == 429 or error_code == "ratelimited":
        return True
    if _is_transient_slack_api_error(ex, error_code):
        return False
    if status_code is not None and 400 <= status_code < 500:
        return True
    return bool(error_code)


@backoff.on_exception(
    backoff.expo,
    (SlackApiError, SlackClientNotConnectedError),
    factor=10,
    base=2,
    max_tries=5,
    giveup=_give_up_slack_api_retry,
)
def _call_slack_api(method: Callable[..., object], **kwargs: object) -> None:
    method(**kwargs)


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
