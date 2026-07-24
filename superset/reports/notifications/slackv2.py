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
import time
from collections.abc import Sequence
from email.message import Message
from io import IOBase
from typing import List, Union
from urllib.error import HTTPError

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
)
from superset.reports.notifications.slack_mixin import SlackMixin
from superset.reports.notifications.slack_transport import (
    call_slack_api,
    call_slack_api_with_timeout,
    send_to_slack_channels,
    SlackChannelResponseError,
    SlackRetryDeadlineError,
)
from superset.utils import json
from superset.utils.decorators import statsd_gauge
from superset.utils.slack import (
    get_slack_client,
    NO_SLACK_RECIPIENTS_MESSAGE,
    parse_slack_recipient_targets,
)

logger = logging.getLogger(__name__)


def _read_upload_data(file: str | IOBase | bytes) -> bytes:
    """Read a Slack upload input using the SDK's supported single-file forms."""
    if isinstance(file, str):
        with open(file, "rb") as readable:
            return readable.read()
    if isinstance(file, bytes):
        return file
    data = file.read()
    return data.encode() if isinstance(data, str) else data


def _upload_file_to_slack(
    client: WebClient,
    *,
    channel: str,
    file: str | IOBase | bytes,
    initial_comment: str,
    title: str,
    filename: str,
    retry_deadline: float,
) -> None:
    """Upload one file without replaying completed phases during retries."""
    data = _read_upload_data(file)
    upload_url_response = call_slack_api_with_timeout(
        client,
        client.files_getUploadURLExternal,
        retry_deadline=retry_deadline,
        retry_transport_errors=True,
        filename=filename,
        length=len(data),
    )
    try:
        file_id = upload_url_response.get("file_id")
        upload_url = upload_url_response.get("upload_url")
    except (AttributeError, TypeError) as ex:
        raise SlackChannelResponseError(
            "Slack did not return valid upload metadata"
        ) from ex
    if (
        not isinstance(file_id, str)
        or not file_id
        or not isinstance(upload_url, str)
        or not upload_url
    ):
        raise SlackChannelResponseError("Slack did not return a file ID and upload URL")

    def upload_file() -> None:
        remaining = retry_deadline - time.monotonic()
        if remaining <= 0:
            raise SlackRetryDeadlineError
        # files_upload_v2 uses this SDK helper internally. Calling it directly
        # keeps retries scoped to the raw upload rather than replaying URL creation.
        result = client._upload_file(  # pylint: disable=protected-access
            url=upload_url,
            data=data,
            logger=logger,
            timeout=min(float(client.timeout), remaining),
            proxy=client.proxy,
            ssl=client.ssl,
        )
        if result.status != 200:
            raise HTTPError(
                upload_url,
                result.status,
                f"Slack external upload failed: {result.body}",
                Message(),
                None,
            )

    call_slack_api(upload_file, retry_deadline=retry_deadline)
    call_slack_api_with_timeout(
        client,
        client.files_completeUploadExternal,
        retry_deadline=retry_deadline,
        retry_transient_errors=False,
        files=[{"id": file_id, "title": title}],
        channel_id=channel,
        initial_comment=initial_comment,
    )


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
        """  # noqa: E501
        try:
            recipient_str = json.loads(self._recipient.recipient_config_json)["target"]
        except (KeyError, TypeError, ValueError) as ex:
            raise NotificationParamException(NO_SLACK_RECIPIENTS_MESSAGE) from ex

        if not isinstance(recipient_str, str):
            raise NotificationParamException(NO_SLACK_RECIPIENTS_MESSAGE)

        return parse_slack_recipient_targets(recipient_str)

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

    @statsd_gauge("reports.slack.send")
    def send(self) -> None:
        global_logs_context = getattr(g, "logs_context", {}) or {}
        try:
            client = get_slack_client(for_delivery=True)
            title = self._content.name
            body = self._get_body(content=self._content)

            channels = self._get_channels()

            if not channels:
                raise NotificationParamException(NO_SLACK_RECIPIENTS_MESSAGE)

            file_type, files = self._get_inline_files()

            def send_to_channel(channel: str, retry_deadline: float) -> None:
                if len(files) > 0:
                    if file_type is None:
                        raise SlackChannelResponseError(
                            "Slack upload file type was not provided"
                        )
                    file_name = f"{title}.{file_type}"
                    for file in files:
                        _upload_file_to_slack(
                            client,
                            retry_deadline=retry_deadline,
                            channel=channel,
                            file=file,
                            initial_comment=body,
                            title=title,
                            filename=file_name,
                        )
                else:
                    call_slack_api_with_timeout(
                        client,
                        client.chat_postMessage,
                        retry_deadline=retry_deadline,
                        retry_transient_errors=False,
                        channel=channel,
                        text=body,
                    )

            send_to_slack_channels(channels, send_to_channel)

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
