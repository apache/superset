# -*- coding: utf-8 -*-
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
import json
import logging
import textwrap
from io import IOBase
from typing import Optional, Union

import backoff
from flask_babel import gettext as __
from slack import WebClient
from slack.errors import SlackApiError, SlackClientError
from tabulate import tabulate

from superset import app
from superset.models.reports import ReportRecipientType
from superset.reports.notifications.base import BaseNotification
from superset.reports.notifications.exceptions import NotificationError

logger = logging.getLogger(__name__)

# Slack only shows ~25 lines in the code block section
MAXIMUM_ROWS_IN_CODE_SECTION = 21


class SlackNotification(BaseNotification):  # pylint: disable=too-few-public-methods
    """
    Sends a slack notification for a report recipient
    """

    type = ReportRecipientType.SLACK

    def _get_channel(self) -> str:
        return json.loads(self._recipient.recipient_config_json)["target"]

    @staticmethod
    def _error_template(name: str, description: str, text: str) -> str:
        return textwrap.dedent(
            __(
                """
            *%(name)s*\n
            %(description)s\n
            Error: %(text)s
            """,
                name=name,
                description=description,
                text=text,
            )
        )

    def _get_body(self) -> str:
        if self._content.text:
            return self._error_template(
                self._content.name, self._content.description or "", self._content.text
            )

        # Convert Pandas dataframe into a nice ASCII table
        if self._content.embedded_data is not None:
            df = self._content.embedded_data

            truncated = len(df) > MAXIMUM_ROWS_IN_CODE_SECTION
            message = "(table was truncated)" if truncated else ""
            if truncated:
                df = df[:MAXIMUM_ROWS_IN_CODE_SECTION].fillna("")
                # add a last row with '...' for values
                df = df.append({k: "..." for k in df.columns}, ignore_index=True)

            tabulated = tabulate(df, headers="keys", showindex=False)
            table = f"```\n{tabulated}\n```\n\n{message}"
        else:
            table = ""

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

    def _get_inline_file(self) -> Optional[Union[str, IOBase, bytes]]:
        if self._content.csv:
            return self._content.csv
        if self._content.screenshot:
            return self._content.screenshot
        return None

    @backoff.on_exception(backoff.expo, SlackApiError, factor=10, base=2, max_tries=5)
    def send(self) -> None:
        file = self._get_inline_file()
        title = self._content.name
        channel = self._get_channel()
        body = self._get_body()
        file_type = "csv" if self._content.csv else "png"
        try:
            token = app.config["SLACK_API_TOKEN"]
            if callable(token):
                token = token()
            client = WebClient(token=token, proxy=app.config["SLACK_PROXY"])
            # files_upload returns SlackResponse as we run it in sync mode.
            if file:
                client.files_upload(
                    channels=channel,
                    file=file,
                    initial_comment=body,
                    title=title,
                    filetype=file_type,
                )
            else:
                client.chat_postMessage(channel=channel, text=body)
            logger.info("Report sent to slack")
        except SlackClientError as ex:
            raise NotificationError(ex)
