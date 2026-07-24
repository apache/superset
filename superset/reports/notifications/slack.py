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

from flask import g
from slack_sdk import WebClient
from slack_sdk.errors import (
    BotUserAccessError,
    SlackClientConfigurationError,
    SlackClientError,
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
from superset.reports.notifications.slack_mixin import SlackMixin
from superset.reports.notifications.slack_transport import (
    call_slack_api_with_timeout,
    send_to_slack_channels,
)
from superset.utils import json
from superset.utils.decorators import statsd_gauge
from superset.utils.slack import (
    get_slack_client,
    NO_SLACK_RECIPIENTS_MESSAGE,
    parse_slack_recipient_targets,
    should_use_v2_api,
)

logger = logging.getLogger(__name__)

SLACK_V1_FILE_UPLOAD_MESSAGE = (
    "Slack v1 file uploads are no longer supported because Slack retired "
    "`files.upload`. Enable `ALERT_REPORT_SLACK_V2` and grant the Slack bot "
    "both the `channels:read` and `groups:read` scopes so the recipient can "
    "be upgraded to Slack v2."
)


# Deprecated: Slack v1 will be removed in the next major release. The Slack
# `files.upload` endpoint was retired in 2025, so file-bearing sends already
# fail before attempting the retired v1 upload; only text-only
# `chat_postMessage` sends still work here. When the Slack bot has the
# `channels:read` and `groups:read` scopes, existing v1 recipients are
# auto-upgraded to SlackV2 on their first eligible send.
class SlackNotification(SlackMixin, BaseNotification):  # pylint: disable=too-few-public-methods
    """
    Sends a slack notification for a report recipient
    """

    type = ReportRecipientType.SLACK

    def _get_channels(self) -> list[str]:
        """
        Get the recipient's normalized channel list.

        :returns: channel names with duplicates removed in configured order
        """
        try:
            recipient_str = json.loads(self._recipient.recipient_config_json)["target"]
        except (KeyError, TypeError, ValueError) as ex:
            raise NotificationParamException(NO_SLACK_RECIPIENTS_MESSAGE) from ex

        if not isinstance(recipient_str, str):
            raise NotificationParamException(NO_SLACK_RECIPIENTS_MESSAGE)

        return parse_slack_recipient_targets(recipient_str)

    @staticmethod
    def _send_text(client: WebClient, channels: list[str], body: str) -> None:
        """Send a text notification once to each configured channel."""
        if not channels:
            raise NotificationParamException(NO_SLACK_RECIPIENTS_MESSAGE)
        send_to_slack_channels(
            channels,
            lambda target, retry_deadline: call_slack_api_with_timeout(
                client,
                client.chat_postMessage,
                retry_deadline=retry_deadline,
                retry_transient_errors=False,
                channel=target,
                text=body,
            ),
        )

    def _send_legacy_text(self) -> None:
        if self._content.has_attachments:
            raise NotificationParamException(SLACK_V1_FILE_UPLOAD_MESSAGE)

        body = self._get_body(content=self._content)
        global_logs_context = getattr(g, "logs_context", {}) or {}
        try:
            client = get_slack_client(for_delivery=True)
            channels = self._get_channels()
            self._send_text(client, channels, body)
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
        except SlackClientError as ex:
            # SlackClientError is the base class; keep it last so subclasses
            # retain their more specific notification classification.
            raise NotificationUnprocessableException(str(ex)) from ex

    @statsd_gauge("reports.slack.send")
    def send_legacy_text(self) -> None:
        """Send through Slack v1 without repeating the v2 availability probe."""
        self._send_legacy_text()

    @statsd_gauge(
        "reports.slack.send",
        ignored_exceptions=(SlackV1NotificationError,),
    )
    def send(self) -> None:
        if should_use_v2_api(raise_on_error=self._content.has_attachments):
            raise SlackV1NotificationError
        self._send_legacy_text()
