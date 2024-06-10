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
from collections.abc import Sequence
from io import IOBase
from typing import List, Union

import backoff
import pandas as pd
from deprecation import deprecated
from flask import g
from flask_babel import gettext as __
from slack_sdk import WebClient
from slack_sdk.errors import (
    BotUserAccessError,
    SlackApiError,
    SlackClientConfigurationError,
    SlackClientError,
    SlackClientNotConnectedError,
    SlackObjectFormationError,
    SlackRequestError,
    SlackTokenRotationError,
)

from superset.reports.models import ReportRecipientType
from superset.reports.notifications.base import BaseNotification
from superset.reports.notifications.exceptions import (
    NotificationAuthorizationException,
    NotificationMalformedException,
    NotificationParamException,
    NotificationUnprocessableException,
)
from superset.utils import json
from superset.utils.core import get_email_address_list
from superset.utils.decorators import statsd_gauge
from superset.utils.slack import get_slack_client

logger = logging.getLogger(__name__)

# Slack only allows Markdown messages up to 4k chars
MAXIMUM_MESSAGE_SIZE = 4000


class SlackNotification(BaseNotification):  # pylint: disable=too-few-public-methods
    """
    Sends a slack notification for a report recipient
    """

    type = ReportRecipientType.SLACK

    def _get_channels(self, client: WebClient) -> List[str]:
        """
        Get the recipient's channel(s).
        :returns: A list of channel ids: "EID676L"
        :raises SlackApiError: If the API call fails
        """
        recipient_str = json.loads(self._recipient.recipient_config_json)["target"]

        channel_recipients: List[str] = get_email_address_list(recipient_str)

        conversations_list_response = client.conversations_list(
            types="public_channel,private_channel"
        )

        return [
            c["id"]
            for c in conversations_list_response["channels"]
            if c["name"] in channel_recipients
        ]

    def _message_template(self, table: str = "") -> str:
        return __(
            """*%(name)s*

%(description)s

<%(url)s|Explore in Superset>

%(table)s
""",
            name=self._content.name,
            description=self._content.description or "",
            url=self._content.url,
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

    def _get_body(self) -> str:
        if self._content.text:
            return self._error_template(
                self._content.name, self._content.description or "", self._content.text
            )

        if self._content.embedded_data is None:
            return self._message_template()

        # Embed data in the message
        df = self._content.embedded_data

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
            truncated_row = pd.Series({k: "..." for k in df.columns})
            truncated_df = pd.concat(
                [truncated_df, truncated_row.to_frame().T], ignore_index=True
            )
            tabulated = df.to_markdown()
            table = f"```\n{tabulated}\n```\n\n(table was truncated)"
            message = self._message_template(table)
            if len(message) > MAXIMUM_MESSAGE_SIZE:
                # Decrement i and build a message that is under the limit
                truncated_df = df[:i].fillna("")
                truncated_row = pd.Series({k: "..." for k in df.columns})
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

        return self._message_template(table)

    def _get_inline_files(
        self,
    ) -> Sequence[Union[str, IOBase, bytes]]:
        if self._content.csv:
            return [self._content.csv]
        if self._content.screenshots:
            return self._content.screenshots
        if self._content.pdf:
            return [self._content.pdf]
        return []

    @deprecated(deprecated_in="4.1")
    def _deprecated_upload_files(
        self, client: WebClient, title: str, body: str
    ) -> None:
        """
        Deprecated method to upload files to slack
        Should only be used if the new method fails
        To be removed in the next major release
        """
        file_type, files = (None, [])
        if self._content.csv:
            file_type, files = ("csv", [self._content.csv])
        if self._content.screenshots:
            file_type, files = ("png", self._content.screenshots)
        if self._content.pdf:
            file_type, files = ("pdf", [self._content.pdf])

        recipient_str = json.loads(self._recipient.recipient_config_json)["target"]

        recipients = get_email_address_list(recipient_str)

        for channel in recipients:
            if len(files) > 0:
                for file in files:
                    client.files_upload(
                        channels=channel,
                        file=file,
                        initial_comment=body,
                        title=title,
                        filetype=file_type,
                    )
            else:
                client.chat_postMessage(channel=channel, text=body)

    @backoff.on_exception(backoff.expo, SlackApiError, factor=10, base=2, max_tries=5)
    @statsd_gauge("reports.slack.send")
    def send(self) -> None:
        global_logs_context = getattr(g, "logs_context", {}) or {}
        try:
            client = get_slack_client()
            title = self._content.name
            body = self._get_body()

            try:
                channels = self._get_channels(client)
            except SlackApiError:
                logger.warning(
                    "Slack scope missing. Using deprecated API to get channels. Please update your Slack app to use the new API.",
                    extra={
                        "execution_id": global_logs_context.get("execution_id"),
                    },
                )
                self._deprecated_upload_files(client, title, body)
                return

            if channels == []:
                raise NotificationParamException("No valid channel found")

            files = self._get_inline_files()

            # files_upload returns SlackResponse as we run it in sync mode.
            for channel in channels:
                if len(files) > 0:
                    for file in files:
                        client.files_upload_v2(
                            channel=channel,
                            file=file,
                            initial_comment=body,
                            title=title,
                        )
                else:
                    client.chat_postMessage(channel=channel, text=body)

            logger.info(
                "Report sent to slack",
                extra={
                    "execution_id": global_logs_context.get("execution_id"),
                },
            )
        except (
            BotUserAccessError,
            SlackRequestError,
            SlackClientConfigurationError,
        ) as ex:
            raise NotificationParamException(str(ex)) from ex
        except SlackObjectFormationError as ex:
            raise NotificationMalformedException(str(ex)) from ex
        except SlackTokenRotationError as ex:
            raise NotificationAuthorizationException(str(ex)) from ex
        except (SlackClientNotConnectedError, SlackApiError) as ex:
            raise NotificationUnprocessableException(str(ex)) from ex
        except SlackClientError as ex:
            # this is the base class for all slack client errors
            # keep it last so that it doesn't interfere with @backoff
            raise NotificationUnprocessableException(str(ex)) from ex
