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
from contextlib import closing
from email.message import Message
from ssl import SSLContext
from urllib.error import HTTPError
from urllib.parse import urlparse
from urllib.request import (
    build_opener,
    HTTPSHandler,
    ProxyHandler,
    Request,
    urlopen,
)

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
    get_slack_request_timeout,
    send_slack_text,
    send_to_slack_channels,
    SlackChannelResponseError,
)
from superset.utils.decorators import statsd_gauge
from superset.utils.slack import (
    get_slack_client,
    NO_SLACK_RECIPIENTS_MESSAGE,
)

logger = logging.getLogger(__name__)


def _upload_file_data(
    *,
    url: str,
    data: bytes,
    timeout: int,
    proxy: str | None,
    ssl: SSLContext | None,
) -> tuple[int, str]:
    """Upload bytes to Slack's issued URL using stable stdlib HTTP APIs."""
    if urlparse(url).scheme != "https":
        raise SlackRequestError("Slack upload URL must use HTTPS")
    request = Request(method="POST", url=url, data=data)  # noqa: S310
    if proxy is not None:
        if not isinstance(proxy, str):
            raise SlackRequestError(
                f"Invalid proxy detected: {proxy} must be a str value"
            )
        response = build_opener(
            ProxyHandler({"http": proxy, "https": proxy}),
            HTTPSHandler(context=ssl),
        ).open(request, timeout=timeout)
    else:
        response = urlopen(request, context=ssl, timeout=timeout)  # noqa: S310

    with closing(response):
        charset = response.headers.get_content_charset() or "utf-8"
        body = response.read().decode(charset)
        return response.status, body


def _upload_file_to_slack(
    client: WebClient,
    *,
    channel: str,
    file: bytes,
    initial_comment: str,
    title: str,
    filename: str,
    retry_deadline: float,
) -> None:
    """Upload one file without replaying completed phases during retries."""
    data = file
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
        timeout = get_slack_request_timeout(client.timeout, retry_deadline)
        status, response_body = _upload_file_data(
            url=upload_url,
            data=data,
            timeout=timeout,
            proxy=client.proxy,
            ssl=client.ssl,
        )
        if status != 200:
            raise HTTPError(
                upload_url,
                status,
                f"Slack external upload failed: {response_body}",
                Message(),
                None,
            )

    call_slack_api(
        upload_file,
        retry_deadline=retry_deadline,
        retry_transport_errors=True,
    )
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

    def _get_inline_files(
        self,
    ) -> tuple[str | None, list[bytes]]:
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
                    send_slack_text(
                        client,
                        channel,
                        body,
                        retry_deadline=retry_deadline,
                    )

            send_to_slack_channels(
                channels,
                send_to_channel,
                retry_deadline=self._content.slack_retry_deadline,
            )

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
