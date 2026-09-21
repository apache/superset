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

import pandas as pd
from flask_babel import gettext as __

from superset.reports.models import ReportRecipients
from superset.reports.notifications.base import NotificationContent
from superset.reports.notifications.exceptions import NotificationParamException
from superset.utils import json
from superset.utils.slack import (
    NO_SLACK_RECIPIENTS_MESSAGE,
    parse_slack_recipient_targets,
)

# Slack only allows Markdown messages up to 4k chars
MAXIMUM_MESSAGE_SIZE = 4000


# pylint: disable=too-few-public-methods
class SlackMixin:
    _recipient: ReportRecipients

    def _get_channels(self) -> list[str]:
        """Return normalized Slack targets without duplicates."""
        try:
            recipient_str = json.loads(self._recipient.recipient_config_json)["target"]
        except (KeyError, TypeError, ValueError) as ex:
            raise NotificationParamException(NO_SLACK_RECIPIENTS_MESSAGE) from ex

        if not isinstance(recipient_str, str):
            raise NotificationParamException(NO_SLACK_RECIPIENTS_MESSAGE)

        return parse_slack_recipient_targets(recipient_str)

    def _message_template(
        self,
        content: NotificationContent,
        table: str = "",
    ) -> str:
        if content.include_cta:
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
        return __(
            """*%(name)s*

%(description)s

%(table)s
""",
            name=content.name,
            description=content.description or "",
            table=table,
        )

    @staticmethod
    def _error_template(
        name: str,
        description: str,
        text: str,
        retry_attempt: int | None = None,
        retry_max_attempts: int | None = None,
    ) -> str:
        if retry_attempt is not None:
            retries_remaining = (retry_max_attempts or 0) - retry_attempt
            return __(
                """*Report Retry [%(attempt)s of %(max)s]: %(name)s*

%(description)s

Retry attempt: %(attempt)s of %(max)s  |  Retries remaining: %(remaining)s

Error: %(text)s
""",
                name=name,
                description=description,
                attempt=retry_attempt,
                max=retry_max_attempts,
                remaining=retries_remaining,
                text=text,
            )
        if retry_max_attempts is not None:
            return __(
                """*Report Failed - All Retries Exhausted: %(name)s*

%(description)s

The report failed after %(max)s retry attempts.

Error: %(text)s
""",
                name=name,
                description=description,
                max=retry_max_attempts,
                text=text,
            )
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
                content.name,
                content.description or "",
                content.text,
                retry_attempt=content.retry_attempt,
                retry_max_attempts=content.retry_max_attempts,
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
