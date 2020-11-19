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
from io import IOBase
from typing import cast, Optional, Union

from flask_babel import gettext as __
from retry.api import retry
from slack import WebClient
from slack.errors import SlackApiError, SlackClientError
from slack.web.slack_response import SlackResponse

from superset import app
from superset.models.reports import ReportRecipientType
from superset.reports.notifications.base import BaseNotification
from superset.reports.notifications.exceptions import NotificationError

logger = logging.getLogger(__name__)


class SlackNotification(BaseNotification):  # pylint: disable=too-few-public-methods
    """
    Sends a slack notification for a report recipient
    """

    type = ReportRecipientType.SLACK

    def _get_channel(self) -> str:
        return json.loads(self._recipient.recipient_config_json)["target"]

    def _get_body(self) -> str:
        return __(
            """
            *%(name)s*\n
            <%(url)s|Explore in Superset>
            """,
            name=self._content.name,
            url=self._content.screenshot.url,
        )

    def _get_inline_screenshot(self) -> Optional[Union[str, IOBase, bytes]]:
        return self._content.screenshot.image

    @retry(SlackApiError, delay=10, backoff=2, tries=5)
    def send(self) -> None:
        file = self._get_inline_screenshot()
        channel = self._get_channel()
        body = self._get_body()

        try:
            client = WebClient(
                token=app.config["SLACK_API_TOKEN"], proxy=app.config["SLACK_PROXY"]
            )
            # files_upload returns SlackResponse as we run it in sync mode.
            if file:
                response = cast(
                    SlackResponse,
                    client.files_upload(
                        channels=channel,
                        file=file,
                        initial_comment=body,
                        title="subject",
                    ),
                )
                assert response["file"], str(response)  # the uploaded file
            else:
                response = cast(
                    SlackResponse, client.chat_postMessage(channel=channel, text=body),
                )
                assert response["message"]["text"], str(response)
            logger.info("Report sent to slack")
        except SlackClientError as ex:
            raise NotificationError(ex)
