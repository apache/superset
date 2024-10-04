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
from flask import g
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
from superset.reports.notifications.slack_mixin import SlackMixin
from superset.utils import json
from superset.utils.core import get_email_address_list
from superset.utils.decorators import statsd_gauge
from superset.utils.slack import get_slack_client

logger = logging.getLogger(__name__)


class SlackV2Notification(SlackMixin, BaseNotification):  # pylint: disable=too-few-public-methods
    """
    Sends a slack notification for a report recipient with the slack upload v2 API
    """

    type = ReportRecipientType.SLACKV2

    def _get_channels(self) -> List[str]:
        """
        Get the recipient's channel(s).
        :returns: A list of channel ids: "EID676L"
        :raises NotificationParamException or SlackApiError: If the recipient is not found
        """
        recipient_str = json.loads(self._recipient.recipient_config_json)["target"]

        return get_email_address_list(recipient_str)

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

    @backoff.on_exception(backoff.expo, SlackApiError, factor=10, base=2, max_tries=5)
    @statsd_gauge("reports.slack.send")
    def send(self) -> None:
        global_logs_context = getattr(g, "logs_context", {}) or {}
        try:
            client = get_slack_client()
            title = self._content.name
            body = self._get_body(content=self._content)

            channels = self._get_channels()

            if not channels:
                raise NotificationParamException("No recipients saved in the report")

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
