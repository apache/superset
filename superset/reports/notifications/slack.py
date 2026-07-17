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
from typing import Union

from flask import g
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
    SlackV1NotificationError,
)
from superset.reports.notifications.slack_mixin import _call_slack_api, SlackMixin
from superset.utils import json
from superset.utils.core import recipients_string_to_list
from superset.utils.decorators import statsd_gauge
from superset.utils.slack import (
    get_slack_client,
    should_use_v2_api,
)

logger = logging.getLogger(__name__)

_SLACK_V1_FILE_UPLOAD_MESSAGE = (
    "Slack v1 file uploads are no longer supported because Slack retired "
    "`files.upload`. Enable `ALERT_REPORT_SLACK_V2` and grant the Slack bot "
    "both the `channels:read` and `groups:read` scopes so the recipient can "
    "be upgraded to Slack v2."
)


def _get_slack_v1_file_upload_message(v2_upgrade_error: str | None) -> str:
    if not v2_upgrade_error:
        return _SLACK_V1_FILE_UPLOAD_MESSAGE
    return (
        f"{_SLACK_V1_FILE_UPLOAD_MESSAGE} Slack v2 upgrade failed: {v2_upgrade_error}"
    )


# Deprecated: Slack v1 will be removed in the next major release. The Slack
# `files.upload` endpoint was retired in 2025, so file-bearing sends already
# fail at the API level; only text-only `chat_postMessage` sends still work
# here. When the Slack bot has the `channels:read` and `groups:read` scopes,
# existing v1 recipients are auto-upgraded to SlackV2 on first send via
# `update_report_schedule_slack_v2`.
class SlackNotification(SlackMixin, BaseNotification):  # pylint: disable=too-few-public-methods
    """
    Sends a slack notification for a report recipient
    """

    type = ReportRecipientType.SLACK

    def _get_channel(self) -> str:
        """
        Get the recipient's channel(s).
        Note Slack SDK uses "channel" to refer to one or more
        channels. Multiple channels are demarcated by a comma.
        :returns: The comma separated list of channel(s)
        """
        try:
            recipient_str = json.loads(self._recipient.recipient_config_json)["target"]
        except (KeyError, TypeError, ValueError) as ex:
            raise NotificationParamException(
                "No recipients saved in the report"
            ) from ex

        if not isinstance(recipient_str, str):
            raise NotificationParamException("No recipients saved in the report")

        return ",".join(recipients_string_to_list(recipient_str))

    def _get_inline_files(
        self,
    ) -> tuple[Union[str, None], Sequence[Union[str, IOBase, bytes]]]:
        if self._content.csv:
            return ("csv", [self._content.csv])
        if self._content.xlsx:
            return ("xlsx", [self._content.xlsx])
        if self._content.screenshots:
            return ("png", self._content.screenshots)
        if self._content.pdf:
            return ("pdf", [self._content.pdf])
        return (None, [])

    @staticmethod
    def _send_text(client: WebClient, channel: str, body: str) -> None:
        """Send a text notification once to each configured channel."""
        targets = recipients_string_to_list(channel)
        if not targets:
            raise NotificationParamException("No recipients saved in the report")
        for target in targets:
            _call_slack_api(client.chat_postMessage, channel=target, text=body)

    @statsd_gauge("reports.slack.send")
    def send(
        self,
        *,
        force_v1: bool = False,
        v2_upgrade_error: str | None = None,
    ) -> None:
        _, files = self._get_inline_files()
        body = self._get_body(content=self._content)
        global_logs_context = getattr(g, "logs_context", {}) or {}

        # see if the v2 api will work
        if not force_v1 and should_use_v2_api(raise_on_error=bool(files)):
            # if we can fetch channels, then raise an error and use the v2 api
            raise SlackV1NotificationError

        if files:
            raise NotificationParamException(
                _get_slack_v1_file_upload_message(v2_upgrade_error)
            )

        try:
            client = get_slack_client()
            channel = self._get_channel()
            self._send_text(client, channel, body)
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
