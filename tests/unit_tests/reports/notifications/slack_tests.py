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

import uuid
from email.message import Message
from http.client import RemoteDisconnected
from typing import Any, TYPE_CHECKING
from unittest.mock import ANY, call, MagicMock, patch
from urllib.error import HTTPError, URLError

import pandas as pd
import pytest
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
from slack_sdk.web.slack_response import SlackResponse

from superset.reports.notifications.exceptions import (
    NotificationAuthorizationException,
    NotificationError,
    NotificationMalformedException,
    NotificationParamException,
    NotificationTransientError,
    NotificationUnprocessableException,
    SlackV1NotificationError,
)
from superset.reports.notifications.slack_mixin import (
    _give_up_slack_api_retry,
    call_slack_api,
    send_to_slack_channels,
    SlackRetryDeadlineError,
)
from superset.reports.notifications.slackv2 import SlackV2Notification
from superset.utils.core import HeaderDataType
from superset.utils.slack import SlackV2ProbeClientError, SlackV2ProbeError

if TYPE_CHECKING:
    from superset.reports.notifications.slack import SlackNotification


@pytest.fixture(autouse=True)
def _skip_backoff_sleep():
    """Make any @backoff.on_exception retries instant.

    SlackV2Notification.send() retries up to 5 times with `backoff.expo(factor=10,
    base=2)` — that's ~150s of real sleep on a persistently-failing send. We
    don't care about the wall-clock waits in unit tests; patching `time.sleep`
    inside backoff's sync runner keeps the assertion semantics (call_count,
    raised exception type) without the wait.
    """
    with patch("time.sleep"):
        yield


@pytest.fixture
def mock_header_data() -> HeaderDataType:
    return {
        "notification_format": "PNG",
        "notification_type": "Alert",
        "editors": [1],
        "notification_source": None,
        "chart_id": None,
        "dashboard_id": None,
        "slack_channels": ["some_channel"],
        "execution_id": "test-execution-id",
    }


def _make_v1_notification(
    mock_header_data: HeaderDataType,
    *,
    target: str,
    **content_overrides: Any,
) -> "SlackNotification":
    from superset.reports.models import ReportRecipients, ReportRecipientType
    from superset.reports.notifications.base import NotificationContent
    from superset.reports.notifications.slack import SlackNotification

    content_values: dict[str, Any] = {
        "name": "test alert",
        "header_data": mock_header_data,
        "description": "desc",
    }
    content_values.update(content_overrides)
    return SlackNotification(
        recipient=ReportRecipients(
            type=ReportRecipientType.SLACK,
            recipient_config_json=f'{{"target": "{target}"}}',
        ),
        content=NotificationContent(**content_values),
    )


def test_get_channels_with_multi_recipients(mock_header_data) -> None:
    """
    Test _get_channels returns normalized recipients without duplicates.
    """
    from superset.reports.models import ReportRecipients, ReportRecipientType
    from superset.reports.notifications.base import NotificationContent
    from superset.reports.notifications.slack import SlackNotification

    content = NotificationContent(
        name="test alert",
        header_data=mock_header_data,
        embedded_data=pd.DataFrame(
            {
                "A": [1, 2, 3],
                "B": [4, 5, 6],
                "C": ["111", "222", '<a href="http://www.example.com">333</a>'],
            }
        ),
        description='<p>This is <a href="#">a test</a> alert</p><br />',
    )
    slack_notification = SlackNotification(
        recipient=ReportRecipients(
            type=ReportRecipientType.SLACK,
            recipient_config_json='{"target": "some_channel; second_channel, third_channel, some_channel"}',  # noqa: E501
        ),
        content=content,
    )

    result = slack_notification._get_channels()

    assert result == ["some_channel", "second_channel", "third_channel"]


@pytest.mark.parametrize(
    "recipient_config_json",
    ["{not-json", '{"target": ["private-channel"]}'],
    ids=["malformed-json", "non-string-target"],
)
def test_get_channels_rejects_invalid_recipient_config(
    mock_header_data: HeaderDataType,
    recipient_config_json: str,
) -> None:
    from superset.reports.models import ReportRecipients, ReportRecipientType
    from superset.reports.notifications.base import NotificationContent
    from superset.reports.notifications.slack import SlackNotification

    notification = SlackNotification(
        recipient=ReportRecipients(
            type=ReportRecipientType.SLACK,
            recipient_config_json=recipient_config_json,
        ),
        content=NotificationContent(
            name="test alert",
            header_data=mock_header_data,
        ),
    )

    with pytest.raises(NotificationParamException, match="No recipients"):
        notification._get_channels()


@pytest.mark.parametrize(
    "recipient_config_json",
    ["{not-json", '{"target": ["C12345"]}'],
    ids=["malformed-json", "non-string-target"],
)
def test_slackv2_get_channels_rejects_invalid_recipient_config(
    mock_header_data: HeaderDataType,
    recipient_config_json: str,
) -> None:
    from superset.reports.models import ReportRecipients, ReportRecipientType
    from superset.reports.notifications.base import NotificationContent

    notification = SlackV2Notification(
        recipient=ReportRecipients(
            type=ReportRecipientType.SLACKV2,
            recipient_config_json=recipient_config_json,
        ),
        content=NotificationContent(
            name="test alert",
            header_data=mock_header_data,
        ),
    )

    with pytest.raises(NotificationParamException, match="No recipients"):
        notification._get_channels()


def test_valid_recipient_config_json_slackv2(mock_header_data) -> None:
    """
    Test if the recipient configuration JSON is valid when using a SlackV2 recipient type
    """  # noqa: E501
    from superset.reports.models import ReportRecipients, ReportRecipientType
    from superset.reports.notifications.base import NotificationContent
    from superset.reports.notifications.slack import SlackNotification

    content = NotificationContent(
        name="test alert",
        header_data=mock_header_data,
        embedded_data=pd.DataFrame(
            {
                "A": [1, 2, 3],
                "B": [4, 5, 6],
                "C": ["111", "222", '<a href="http://www.example.com">333</a>'],
            }
        ),
        description='<p>This is <a href="#">a test</a> alert</p><br />',
    )
    slack_notification = SlackNotification(
        recipient=ReportRecipients(
            type=ReportRecipientType.SLACKV2,
            recipient_config_json='{"target": "some_channel"}',
        ),
        content=content,
    )

    result = slack_notification._recipient.recipient_config_json

    assert result == '{"target": "some_channel"}'

    # Ensure _get_inline_files function returns the correct tuple when content has screenshots  # noqa: E501


@pytest.mark.parametrize(
    "content_overrides,expected",
    [
        ({"screenshots": [b"screenshot"]}, True),
        ({"csv": b"csv_content"}, True),
        ({"xlsx": b"xlsx_content"}, True),
        ({"pdf": b"pdf_content"}, True),
        ({}, False),
    ],
    ids=["screenshots", "csv", "xlsx", "pdf", "none"],
)
def test_notification_content_has_attachments(
    mock_header_data: HeaderDataType,
    content_overrides: dict[str, Any],
    expected: bool,
) -> None:
    from superset.reports.notifications.base import NotificationContent

    content = NotificationContent(
        name="test alert",
        header_data=mock_header_data,
        **content_overrides,
    )

    assert content.has_attachments is expected


def test_get_inline_files_with_xlsx_slackv2(mock_header_data: HeaderDataType) -> None:
    """SlackV2 _get_inline_files returns the xlsx tuple when content has Excel."""
    from superset.reports.models import ReportRecipients, ReportRecipientType
    from superset.reports.notifications.base import NotificationContent
    from superset.reports.notifications.slackv2 import SlackV2Notification

    content = NotificationContent(
        name="test alert",
        header_data=mock_header_data,
        xlsx=b"xlsx_content",
    )
    slack_notification = SlackV2Notification(
        recipient=ReportRecipients(
            type=ReportRecipientType.SLACKV2,
            recipient_config_json='{"target": "some_channel"}',
        ),
        content=content,
    )

    result = slack_notification._get_inline_files()

    assert result == ("xlsx", [b"xlsx_content"])

    # Ensure _get_inline_files function returns None when content has no screenshots or csv  # noqa: E501


@patch("superset.reports.notifications.slack.g")
@patch("superset.reports.notifications.slack.should_use_v2_api", return_value=False)
@patch("superset.reports.notifications.slack.get_slack_client")
def test_v1_send_without_channels_raises(
    slack_client_mock: MagicMock,
    should_use_v2_api_mock: MagicMock,
    flask_global_mock: MagicMock,
    mock_header_data: HeaderDataType,
) -> None:
    flask_global_mock.logs_context = {}
    notification = _make_v1_notification(mock_header_data, target="")

    with pytest.raises(NotificationParamException, match="No recipients"):
        notification.send()

    should_use_v2_api_mock.assert_called_once_with(raise_on_error=False)
    slack_client_mock.return_value.chat_postMessage.assert_not_called()


@patch("superset.reports.notifications.slack.g")
@patch("superset.reports.notifications.slack.should_use_v2_api")
@patch("superset.reports.notifications.slack.get_slack_client")
def test_send_legacy_text_skips_v2_probe(
    slack_client_mock: MagicMock,
    should_use_v2_api_mock: MagicMock,
    flask_global_mock: MagicMock,
    mock_header_data: HeaderDataType,
) -> None:
    flask_global_mock.logs_context = {}
    notification = _make_v1_notification(
        mock_header_data,
        target="private-channel",
    )

    notification.send_legacy_text()

    should_use_v2_api_mock.assert_not_called()
    slack_client_mock.assert_called_once_with(for_delivery=True)
    slack_client_mock.return_value.chat_postMessage.assert_called_once_with(
        channel="private-channel",
        text=ANY,
    )


@patch("superset.reports.notifications.slack.should_use_v2_api", return_value=True)
def test_v1_upgrade_handoff_does_not_record_terminal_send_metric(
    should_use_v2_api_mock: MagicMock,
    mock_header_data: HeaderDataType,
) -> None:
    """The v1-to-v2 handoff is routing, not a terminal Slack delivery."""
    notification = _make_v1_notification(
        mock_header_data,
        target="private-channel",
    )

    with (
        patch("superset.extensions.stats_logger_manager.instance.gauge") as statsd_mock,
        pytest.raises(SlackV1NotificationError),
    ):
        notification.send()

    should_use_v2_api_mock.assert_called_once_with(raise_on_error=False)
    statsd_mock.assert_not_called()


@patch("superset.reports.notifications.slack.get_slack_client")
def test_send_legacy_text_rejects_attachments(
    slack_client_mock: MagicMock,
    mock_header_data: HeaderDataType,
) -> None:
    notification = _make_v1_notification(
        mock_header_data,
        target="private-channel",
        screenshots=[b"screenshot"],
    )

    with pytest.raises(
        NotificationParamException,
        match="Slack v1 file uploads are no longer supported",
    ):
        notification.send_legacy_text()

    slack_client_mock.assert_not_called()


@patch("superset.reports.notifications.slack.g")
@patch("superset.reports.notifications.slack.should_use_v2_api", return_value=False)
@patch("superset.reports.notifications.slack.get_slack_client")
def test_v1_send_rejects_files_when_v2_probe_is_unavailable(
    slack_client_mock: MagicMock,
    should_use_v2_api_mock: MagicMock,
    flask_global_mock: MagicMock,
    mock_header_data: HeaderDataType,
) -> None:
    flask_global_mock.logs_context = {}
    notification = _make_v1_notification(
        mock_header_data,
        target="private-channel",
        screenshots=[b"screenshot"],
    )

    with pytest.raises(
        NotificationParamException,
        match="Slack v1 file uploads are no longer supported",
    ):
        notification.send()

    should_use_v2_api_mock.assert_called_once_with(raise_on_error=True)
    slack_client_mock.return_value.files_upload.assert_not_called()


@pytest.mark.parametrize(
    ("probe_error", "metric"),
    [
        (
            SlackV2ProbeError(
                "Slack v2 availability probe failed: service_unavailable"
            ),
            "reports.slack.send.error",
        ),
        (
            SlackV2ProbeClientError("Slack v2 availability probe failed: invalid_auth"),
            "reports.slack.send.warning",
        ),
    ],
    ids=["system", "client"],
)
@patch("superset.reports.notifications.slack.g")
@patch("superset.reports.notifications.slack.should_use_v2_api")
@patch("superset.reports.notifications.slack.get_slack_client")
def test_v1_file_send_records_v2_probe_failure_metric(
    slack_client_mock: MagicMock,
    should_use_v2_api_mock: MagicMock,
    flask_global_mock: MagicMock,
    mock_header_data: HeaderDataType,
    probe_error: SlackV2ProbeError,
    metric: str,
) -> None:
    flask_global_mock.logs_context = {}
    should_use_v2_api_mock.side_effect = probe_error
    notification = _make_v1_notification(
        mock_header_data,
        target="private-channel",
        screenshots=[b"screenshot"],
    )

    with (
        patch("superset.extensions.stats_logger_manager.instance.gauge") as statsd_mock,
        pytest.raises(type(probe_error)),
    ):
        notification.send()

    should_use_v2_api_mock.assert_called_once_with(raise_on_error=True)
    slack_client_mock.assert_not_called()
    statsd_mock.assert_called_once_with(metric, 1)


@patch("superset.reports.notifications.slack.g")
@patch("superset.reports.notifications.slack.should_use_v2_api", return_value=False)
@patch("superset.reports.notifications.slack.get_slack_client")
def test_v1_send_retries_only_the_failed_channel(
    slack_client_mock: MagicMock,
    should_use_v2_api_mock: MagicMock,
    flask_global_mock: MagicMock,
    mock_header_data: HeaderDataType,
) -> None:
    flask_global_mock.logs_context = {}
    failed_attempts = 0

    def chat_side_effect(channel: str, text: str) -> dict[str, bool]:
        nonlocal failed_attempts
        if channel == "private-b" and failed_attempts < 2:
            failed_attempts += 1
            response = _make_slack_response(
                429,
                {"ok": False, "error": "ratelimited"},
                headers={"Retry-After": ["0"]},
            )
            raise SlackApiError(
                message="rate limited",
                response=response,
            )
        return {"ok": True}

    slack_client_mock.return_value.chat_postMessage.side_effect = chat_side_effect
    notification = _make_v1_notification(
        mock_header_data,
        target="private-a,private-b",
    )

    notification.send()

    should_use_v2_api_mock.assert_called_once_with(raise_on_error=False)
    assert [
        slack_call.kwargs["channel"]
        for slack_call in slack_client_mock.return_value.chat_postMessage.call_args_list
    ] == ["private-a", "private-b", "private-b", "private-b"]


@patch("superset.reports.notifications.slack.g")
@patch("superset.reports.notifications.slack.should_use_v2_api", return_value=False)
@patch("superset.reports.notifications.slack.get_slack_client")
def test_v1_send_reports_failed_channel_and_continues_later_channels(
    slack_client_mock: MagicMock,
    should_use_v2_api_mock: MagicMock,
    flask_global_mock: MagicMock,
    mock_header_data: HeaderDataType,
) -> None:
    flask_global_mock.logs_context = {}

    def chat_side_effect(channel: str, text: str) -> dict[str, bool]:
        if channel == "private-b":
            raise SlackApiError(
                message="channel not found",
                response={"ok": False, "error": "channel_not_found"},
            )
        return {"ok": True}

    slack_client_mock.return_value.chat_postMessage.side_effect = chat_side_effect
    notification = _make_v1_notification(
        mock_header_data,
        target="private-a,private-b,private-c",
    )

    with pytest.raises(
        NotificationUnprocessableException,
        match="private-b",
    ):
        notification.send()

    should_use_v2_api_mock.assert_called_once_with(raise_on_error=False)
    assert [
        slack_call.kwargs["channel"]
        for slack_call in slack_client_mock.return_value.chat_postMessage.call_args_list
    ] == ["private-a", "private-b", "private-c"]


@patch("superset.reports.notifications.slack.g")
@patch("superset.reports.notifications.slack.should_use_v2_api", return_value=False)
@patch("superset.reports.notifications.slack.get_slack_client")
def test_v1_send_deduplicates_channels(
    slack_client_mock: MagicMock,
    should_use_v2_api_mock: MagicMock,
    flask_global_mock: MagicMock,
    mock_header_data: HeaderDataType,
) -> None:
    flask_global_mock.logs_context = {}
    notification = _make_v1_notification(
        mock_header_data,
        target="private-a, private-a",
    )

    notification.send()

    should_use_v2_api_mock.assert_called_once_with(raise_on_error=False)
    slack_client_mock.return_value.chat_postMessage.assert_called_once_with(
        channel="private-a",
        text=ANY,
    )


@patch("superset.reports.notifications.slackv2.g")
@patch("superset.reports.notifications.slackv2.logger")
@patch("superset.reports.notifications.slackv2.get_slack_client")
def test_send_slackv2(
    slack_client_mock: MagicMock,
    logger_mock: MagicMock,
    flask_global_mock: MagicMock,
    mock_header_data,
) -> None:
    # `superset.models.helpers`, a dependency of following imports,
    # requires app context
    from superset.reports.models import ReportRecipients, ReportRecipientType
    from superset.reports.notifications.base import NotificationContent

    execution_id = uuid.uuid4()
    flask_global_mock.logs_context = {"execution_id": execution_id}
    slack_client_mock.return_value.chat_postMessage.return_value = {"ok": True}
    content = NotificationContent(
        name="test alert",
        header_data=mock_header_data,
        embedded_data=pd.DataFrame(
            {
                "A": [1, 2, 3],
                "B": [4, 5, 6],
                "C": ["111", "222", '<a href="http://www.example.com">333</a>'],
            }
        ),
        description='<p>This is <a href="#">a test</a> alert</p><br />',
    )

    notification = SlackV2Notification(
        recipient=ReportRecipients(
            type=ReportRecipientType.SLACKV2,
            recipient_config_json='{"target": "some_channel"}',
        ),
        content=content,
    )
    notification.send()
    slack_client_mock.assert_called_once_with(for_delivery=True)
    logger_mock.info.assert_called_with(
        "Report sent to slack", extra={"execution_id": execution_id}
    )
    slack_client_mock.return_value.chat_postMessage.assert_called_with(
        channel="some_channel",
        text="""*test alert*

<p>This is <a href="#">a test</a> alert</p><br />

<None|Explore in Superset>

```
|    |   A |   B | C                                        |
|---:|----:|----:|:-----------------------------------------|
|  0 |   1 |   4 | 111                                      |
|  1 |   2 |   5 | 222                                      |
|  2 |   3 |   6 | <a href="http://www.example.com">333</a> |
```
""",
    )


@patch("superset.reports.notifications.slack.g")
@patch("superset.reports.notifications.slack.logger")
@patch("superset.utils.slack.get_slack_client")
@patch("superset.reports.notifications.slack.get_slack_client")
def test_send_slack(
    slack_client_mock: MagicMock,
    slack_client_mock_util: MagicMock,
    logger_mock: MagicMock,
    flask_global_mock: MagicMock,
    mock_header_data,
) -> None:
    # `superset.models.helpers`, a dependency of following imports,
    # requires app context
    from superset.reports.models import ReportRecipients, ReportRecipientType
    from superset.reports.notifications.base import NotificationContent
    from superset.reports.notifications.slack import SlackNotification

    execution_id = uuid.uuid4()
    flask_global_mock.logs_context = {"execution_id": execution_id}
    slack_client_mock.return_value.chat_postMessage.return_value = {"ok": True}
    slack_client_mock_util.return_value.conversations_list.side_effect = SlackApiError(
        "scope not found", "error"
    )

    content = NotificationContent(
        name="test alert",
        header_data=mock_header_data,
        embedded_data=pd.DataFrame(
            {
                "A": [1, 2, 3],
                "B": [4, 5, 6],
                "C": ["111", "222", '<a href="http://www.example.com">333</a>'],
            }
        ),
        description='<p>This is <a href="#">a test</a> alert</p><br />',
    )

    notification = SlackNotification(
        recipient=ReportRecipients(
            type=ReportRecipientType.SLACKV2,
            recipient_config_json='{"target": "some_channel"}',
        ),
        content=content,
    )
    notification.send()

    logger_mock.info.assert_called_with(
        "Report sent to slack", extra={"execution_id": execution_id}
    )
    slack_client_mock.return_value.chat_postMessage.assert_called_with(
        channel="some_channel",
        text="""*test alert*

<p>This is <a href="#">a test</a> alert</p><br />

<None|Explore in Superset>

```
|    |   A |   B | C                                        |
|---:|----:|----:|:-----------------------------------------|
|  0 |   1 |   4 | 111                                      |
|  1 |   2 |   5 | 222                                      |
|  2 |   3 |   6 | <a href="http://www.example.com">333</a> |
```
""",
    )


@patch(
    "superset.utils.slack.feature_flag_manager.is_feature_enabled",
    return_value=False,
)
@patch("superset.reports.notifications.slack.g")
@patch("superset.reports.notifications.slack.logger")
@patch("superset.utils.slack.get_slack_client")
@patch("superset.reports.notifications.slack.get_slack_client")
def test_send_slack_no_feature_flag(
    slack_client_mock: MagicMock,
    slack_client_mock_util: MagicMock,
    logger_mock: MagicMock,
    flask_global_mock: MagicMock,
    feature_flag_mock: MagicMock,
    mock_header_data,
) -> None:
    # `superset.models.helpers`, a dependency of following imports,
    # requires app context
    from superset.reports.models import ReportRecipients, ReportRecipientType
    from superset.reports.notifications.base import NotificationContent
    from superset.reports.notifications.slack import SlackNotification

    execution_id = uuid.uuid4()
    flask_global_mock.logs_context = {"execution_id": execution_id}
    slack_client_mock.return_value.chat_postMessage.return_value = {"ok": True}
    # Even with valid scopes, ALERT_REPORT_SLACK_V2=False forces the v1 path.
    slack_client_mock_util.return_value.conversations_list.return_value = {
        "channels": [{"id": "foo", "name": "bar"}]
    }

    content = NotificationContent(
        name="test alert",
        header_data=mock_header_data,
        embedded_data=pd.DataFrame(
            {
                "A": [1, 2, 3],
                "B": [4, 5, 6],
                "C": ["111", "222", '<a href="http://www.example.com">333</a>'],
            }
        ),
        description='<p>This is <a href="#">a test</a> alert</p><br />',
    )

    notification = SlackNotification(
        recipient=ReportRecipients(
            type=ReportRecipientType.SLACKV2,
            recipient_config_json='{"target": "some_channel"}',
        ),
        content=content,
    )
    notification.send()

    logger_mock.info.assert_called_with(
        "Report sent to slack", extra={"execution_id": execution_id}
    )
    slack_client_mock.return_value.chat_postMessage.assert_called_with(
        channel="some_channel",
        text="""*test alert*

<p>This is <a href="#">a test</a> alert</p><br />

<None|Explore in Superset>

```
|    |   A |   B | C                                        |
|---:|----:|----:|:-----------------------------------------|
|  0 |   1 |   4 | 111                                      |
|  1 |   2 |   5 | 222                                      |
|  2 |   3 |   6 | <a href="http://www.example.com">333</a> |
```
""",
    )


@patch("superset.reports.notifications.slackv2.g")
@patch("superset.reports.notifications.slackv2.get_slack_client")
def test_slackv2_send_without_channels_raises(
    slack_client_mock: MagicMock,
    flask_global_mock: MagicMock,
    mock_header_data,
) -> None:
    from superset.reports.models import ReportRecipients, ReportRecipientType
    from superset.reports.notifications.base import NotificationContent
    from superset.reports.notifications.exceptions import NotificationParamException

    flask_global_mock.logs_context = {}
    content = NotificationContent(name="test", header_data=mock_header_data)
    notification = SlackV2Notification(
        recipient=ReportRecipients(
            type=ReportRecipientType.SLACKV2,
            recipient_config_json='{"target": ""}',
        ),
        content=content,
    )
    with pytest.raises(NotificationParamException, match="No recipients"):
        notification.send()


@patch("superset.reports.notifications.slackv2.g")
@patch("superset.reports.notifications.slackv2.get_slack_client")
def test_slack_mixin_get_body_truncates_large_table(
    slack_client_mock: MagicMock,
    flask_global_mock: MagicMock,
    mock_header_data,
) -> None:
    from superset.reports.models import ReportRecipients, ReportRecipientType
    from superset.reports.notifications.base import NotificationContent

    flask_global_mock.logs_context = {}
    # Create a large DataFrame that exceeds the 4000-char message limit
    large_df = pd.DataFrame({"col_" + str(i): range(100) for i in range(10)})
    content = NotificationContent(
        name="test",
        header_data=mock_header_data,
        embedded_data=large_df,
        description="desc",
    )
    notification = SlackV2Notification(
        recipient=ReportRecipients(
            type=ReportRecipientType.SLACKV2,
            recipient_config_json='{"target": "some_channel"}',
        ),
        content=content,
    )
    body = notification._get_body(content=content)
    assert "(table was truncated)" in body


# ---------------------------------------------------------------------------
# Bulletproof v2 send-path coverage
#
# The tests above exercise the chat_postMessage path (text-only sends). The
# tests below cover the three-phase v2 upload across screenshots/CSV/PDF,
# multi-channel fan-out, exception mapping, backoff, statsd, and logs propagation.
# ---------------------------------------------------------------------------


def _make_v2_notification(content, target: str = "C12345"):
    """Helper to build a SlackV2Notification with a given target string."""
    from superset.reports.models import ReportRecipients, ReportRecipientType

    return SlackV2Notification(
        recipient=ReportRecipients(
            type=ReportRecipientType.SLACKV2,
            recipient_config_json=f'{{"target": "{target}"}}',
        ),
        content=content,
    )


def _make_content(mock_header_data, **overrides):
    """Helper to build a minimal NotificationContent."""
    from superset.reports.notifications.base import NotificationContent

    defaults: dict = {
        "name": "test alert",
        "header_data": mock_header_data,
        "description": "desc",
    }
    defaults.update(overrides)
    return NotificationContent(**defaults)


def _configure_v2_upload_client(client: MagicMock) -> MagicMock:
    """Configure an SDK-shaped client for the three-phase upload flow."""
    client.timeout = 30
    client.proxy = None
    client.ssl = None

    def create_upload_url(**kwargs: object) -> dict[str, str]:
        index = client.files_getUploadURLExternal.call_count
        return {
            "file_id": f"F{index}",
            "upload_url": f"https://files.slack.com/upload/{index}",
        }

    client.files_getUploadURLExternal.side_effect = create_upload_url
    client._upload_file.return_value = MagicMock(status=200, body="ok")
    client.files_completeUploadExternal.return_value = {"files": [{"id": "F1"}]}
    return client


@patch("superset.reports.notifications.slackv2.g")
@patch("superset.reports.notifications.slackv2.get_slack_client")
def test_v2_send_with_single_screenshot_uses_three_phase_upload(
    slack_client_mock: MagicMock,
    flask_global_mock: MagicMock,
    mock_header_data,
) -> None:
    flask_global_mock.logs_context = {"execution_id": uuid.uuid4()}
    client = _configure_v2_upload_client(slack_client_mock.return_value)
    content = _make_content(mock_header_data, screenshots=[b"screenshot-bytes"])
    notification = _make_v2_notification(content, target="C12345")

    notification.send()

    client.files_getUploadURLExternal.assert_called_once_with(
        filename="test alert.png",
        length=len(b"screenshot-bytes"),
    )
    assert client._upload_file.call_args.kwargs["data"] == b"screenshot-bytes"
    completion_kwargs = client.files_completeUploadExternal.call_args.kwargs
    assert completion_kwargs["channel_id"] == "C12345"
    assert completion_kwargs["files"] == [{"id": "F1", "title": "test alert"}]
    assert "test alert" in completion_kwargs["initial_comment"]
    client.files_upload_v2.assert_not_called()
    # chat_postMessage should NOT be called when files are present
    client.chat_postMessage.assert_not_called()


@pytest.mark.parametrize(
    ("status_code", "expected_exception", "expected_calls"),
    [
        (413, NotificationUnprocessableException, 1),
        (429, NotificationTransientError, 3),
        (504, NotificationTransientError, 5),
    ],
)
@patch("superset.reports.notifications.slackv2.g")
@patch("superset.reports.notifications.slackv2.get_slack_client")
def test_v2_file_upload_classifies_raw_http_status(
    slack_client_mock: MagicMock,
    flask_global_mock: MagicMock,
    status_code: int,
    expected_exception: type[Exception],
    expected_calls: int,
    mock_header_data: HeaderDataType,
) -> None:
    """Classify raw-upload HTTP failures and honor exposed Retry-After headers."""
    flask_global_mock.logs_context = {}
    client = _configure_v2_upload_client(slack_client_mock.return_value)
    upload = client._upload_file
    headers = Message()
    if status_code == 429:
        headers["Retry-After"] = "0"
    upload.side_effect = HTTPError(
        "https://files.slack.com/upload",
        status_code,
        "upload failed",
        headers,
        None,
    )
    notification = _make_v2_notification(
        _make_content(mock_header_data, screenshots=[b"screenshot-bytes"]),
        target="C12345",
    )

    with pytest.raises(expected_exception, match="C12345"):
        notification.send()

    assert upload.call_count == expected_calls
    client.files_getUploadURLExternal.assert_called_once()
    client.files_completeUploadExternal.assert_not_called()


@patch("superset.reports.notifications.slackv2.g")
@patch("superset.reports.notifications.slackv2.get_slack_client")
def test_v2_raw_upload_result_429_without_headers_does_not_retry(
    slack_client_mock: MagicMock,
    flask_global_mock: MagicMock,
    mock_header_data: HeaderDataType,
) -> None:
    """An SDK result without headers cannot safely synthesize a retry delay."""
    flask_global_mock.logs_context = {}
    client = _configure_v2_upload_client(slack_client_mock.return_value)
    client._upload_file.return_value = MagicMock(status=429, body="rate limited")
    notification = _make_v2_notification(
        _make_content(mock_header_data, screenshots=[b"screenshot-bytes"]),
        target="C12345",
    )

    with pytest.raises(NotificationTransientError, match="C12345"):
        notification.send()

    client._upload_file.assert_called_once()
    client.files_getUploadURLExternal.assert_called_once()
    client.files_completeUploadExternal.assert_not_called()


def test_raw_http_rate_limit_respects_zero_retry_config(mocker) -> None:
    headers = Message()
    headers["Retry-After"] = "0"
    error = HTTPError(
        "https://files.slack.com/upload",
        429,
        "upload rate limited",
        headers,
        None,
    )
    method = MagicMock(side_effect=error)
    mocker.patch.dict(
        "superset.reports.notifications.slack_mixin.app.config",
        {"SLACK_API_RATE_LIMIT_RETRY_COUNT": 0},
    )

    with pytest.raises(HTTPError):
        call_slack_api(method)

    method.assert_called_once_with()


def test_raw_http_rate_limit_respects_shared_deadline(mocker) -> None:
    headers = Message()
    headers["Retry-After"] = "120"
    error = HTTPError(
        "https://files.slack.com/upload",
        429,
        "upload rate limited",
        headers,
        None,
    )
    method = MagicMock(side_effect=error)
    clock = [0.0]
    sleep = mocker.patch("superset.reports.notifications.slack_mixin.time.sleep")
    sleep.side_effect = lambda duration: clock.__setitem__(0, clock[0] + duration)
    mocker.patch(
        "superset.reports.notifications.slack_mixin.time.monotonic",
        side_effect=lambda: clock[0],
    )
    mocker.patch.dict(
        "superset.reports.notifications.slack_mixin.app.config",
        {"SLACK_API_RATE_LIMIT_RETRY_COUNT": 2},
    )

    with pytest.raises(SlackRetryDeadlineError, match="deadline exceeded"):
        call_slack_api(method, retry_deadline=150.0)

    assert method.call_count == 2
    sleep.assert_called_once_with(120.0)


@pytest.mark.parametrize("retry_after", ["NaN", "inf", "-inf", ""])
def test_malformed_retry_after_preserves_channel_isolation(
    retry_after: str,
) -> None:
    response = _make_slack_response(
        429,
        {"ok": False, "error": "ratelimited"},
        headers={"Retry-After": [retry_after]},
    )
    methods = {
        "C1": MagicMock(
            side_effect=SlackApiError(message="rate limited", response=response)
        ),
        "C2": MagicMock(return_value={"ok": True}),
    }

    def send(channel: str, retry_deadline: float) -> None:
        call_slack_api(methods[channel], retry_deadline=retry_deadline)

    with pytest.raises(NotificationTransientError, match="C1"):
        send_to_slack_channels(["C1", "C2"], send)

    methods["C1"].assert_called_once_with()
    methods["C2"].assert_called_once_with()


@pytest.mark.parametrize(
    ("status_code", "expected_calls", "expected_exception"),
    [
        (429, 2, None),
        (503, 1, NotificationTransientError),
    ],
)
@patch("superset.reports.notifications.slackv2.g")
@patch("superset.reports.notifications.slackv2.get_slack_client")
def test_v2_completion_retry_does_not_replay_prior_upload_phases(
    slack_client_mock: MagicMock,
    flask_global_mock: MagicMock,
    status_code: int,
    expected_calls: int,
    expected_exception: type[Exception] | None,
    mock_header_data: HeaderDataType,
) -> None:
    flask_global_mock.logs_context = {}
    client = _configure_v2_upload_client(slack_client_mock.return_value)
    response = _make_slack_response(
        status_code,
        {"ok": False, "error": "ratelimited" if status_code == 429 else "fatal_error"},
    )
    if status_code == 429:
        response.headers["Retry-After"] = "0"
    client.files_completeUploadExternal.side_effect = [
        SlackApiError(message="completion failed", response=response),
        {"files": [{"id": "F1"}]},
    ]
    notification = _make_v2_notification(
        _make_content(mock_header_data, screenshots=[b"screenshot"]),
    )

    if expected_exception:
        with pytest.raises(expected_exception, match="C12345"):
            notification.send()
    else:
        notification.send()

    client.files_getUploadURLExternal.assert_called_once()
    client._upload_file.assert_called_once()
    assert client.files_completeUploadExternal.call_count == expected_calls


@pytest.mark.parametrize(
    "invalid_response",
    [
        object(),
        {"file_id": None, "upload_url": None},
        {"file_id": "", "upload_url": ""},
    ],
    ids=["non-mapping", "missing-values", "empty-values"],
)
@patch("superset.reports.notifications.slackv2.g")
@patch("superset.reports.notifications.slackv2.get_slack_client")
def test_v2_upload_aggregates_missing_metadata_per_channel(
    slack_client_mock: MagicMock,
    flask_global_mock: MagicMock,
    invalid_response: object,
    mock_header_data: HeaderDataType,
) -> None:
    flask_global_mock.logs_context = {}
    client = _configure_v2_upload_client(slack_client_mock.return_value)
    client.files_getUploadURLExternal.side_effect = [
        invalid_response,
        {"file_id": "F2", "upload_url": "https://files.slack.com/upload/2"},
    ]
    notification = _make_v2_notification(
        _make_content(mock_header_data, screenshots=[b"screenshot"]),
        target="C12345,C67890",
    )

    with pytest.raises(NotificationTransientError, match="C12345"):
        notification.send()

    assert client.files_getUploadURLExternal.call_count == 2
    client._upload_file.assert_called_once()
    client.files_completeUploadExternal.assert_called_once()


@patch("superset.reports.notifications.slackv2.g")
@patch("superset.reports.notifications.slackv2.get_slack_client")
def test_v2_upload_url_creation_retries_transient_transport_failure(
    slack_client_mock: MagicMock,
    flask_global_mock: MagicMock,
    mock_header_data: HeaderDataType,
) -> None:
    flask_global_mock.logs_context = {}
    client = _configure_v2_upload_client(slack_client_mock.return_value)
    client.files_getUploadURLExternal.side_effect = [
        URLError("connection reset"),
        {
            "file_id": "F1",
            "upload_url": "https://files.slack.com/upload/1",
        },
    ]
    notification = _make_v2_notification(
        _make_content(mock_header_data, screenshots=[b"screenshot"]),
    )

    notification.send()

    assert client.files_getUploadURLExternal.call_count == 2
    client._upload_file.assert_called_once()
    client.files_completeUploadExternal.assert_called_once()


@patch("superset.reports.notifications.slackv2.g")
@patch("superset.reports.notifications.slackv2.get_slack_client")
def test_v2_upload_does_not_start_completion_after_deadline(
    slack_client_mock: MagicMock,
    flask_global_mock: MagicMock,
    mock_header_data: HeaderDataType,
    mocker,
) -> None:
    flask_global_mock.logs_context = {}
    client = _configure_v2_upload_client(slack_client_mock.return_value)
    clock = [0.0]
    mocker.patch(
        "superset.reports.notifications.slack_mixin.time.monotonic",
        side_effect=lambda: clock[0],
    )
    mocker.patch(
        "superset.reports.notifications.slackv2.time.monotonic",
        side_effect=lambda: clock[0],
    )

    def cross_deadline(**kwargs: object) -> MagicMock:
        clock[0] = 151.0
        return MagicMock(status=200, body="ok")

    client._upload_file.side_effect = cross_deadline
    notification = _make_v2_notification(
        _make_content(mock_header_data, screenshots=[b"screenshot"]),
    )

    with pytest.raises(NotificationTransientError, match="deadline exceeded"):
        notification.send()

    client.files_getUploadURLExternal.assert_called_once()
    client._upload_file.assert_called_once()
    client.files_completeUploadExternal.assert_not_called()


@patch("superset.reports.notifications.slackv2.g")
@patch("superset.reports.notifications.slackv2.get_slack_client")
def test_v2_send_with_multiple_screenshots_uploads_each(
    slack_client_mock: MagicMock,
    flask_global_mock: MagicMock,
    mock_header_data,
) -> None:
    flask_global_mock.logs_context = {}
    client = _configure_v2_upload_client(slack_client_mock.return_value)
    content = _make_content(
        mock_header_data, screenshots=[b"shot-1", b"shot-2", b"shot-3"]
    )
    notification = _make_v2_notification(content, target="C12345")

    notification.send()

    upload = client._upload_file
    assert upload.call_count == 3
    uploaded_files = [c.kwargs["data"] for c in upload.call_args_list]
    assert uploaded_files == [b"shot-1", b"shot-2", b"shot-3"]
    assert [
        c.kwargs["channel_id"]
        for c in client.files_completeUploadExternal.call_args_list
    ] == ["C12345", "C12345", "C12345"]


@patch("superset.reports.notifications.slackv2.g")
@patch("superset.reports.notifications.slackv2.get_slack_client")
def test_v2_send_with_csv_calls_files_upload_v2(
    slack_client_mock: MagicMock,
    flask_global_mock: MagicMock,
    mock_header_data,
) -> None:
    flask_global_mock.logs_context = {}
    client = _configure_v2_upload_client(slack_client_mock.return_value)
    content = _make_content(mock_header_data, csv=b"col1,col2\n1,2\n")
    notification = _make_v2_notification(content, target="C12345")

    notification.send()

    client._upload_file.assert_called_once()
    assert client._upload_file.call_args.kwargs["data"] == b"col1,col2\n1,2\n"
    client.files_getUploadURLExternal.assert_called_once_with(
        filename="test alert.csv",
        length=len(b"col1,col2\n1,2\n"),
    )


@patch("superset.reports.notifications.slackv2.g")
@patch("superset.reports.notifications.slackv2.get_slack_client")
def test_v2_send_with_pdf_calls_files_upload_v2(
    slack_client_mock: MagicMock,
    flask_global_mock: MagicMock,
    mock_header_data,
) -> None:
    flask_global_mock.logs_context = {}
    client = _configure_v2_upload_client(slack_client_mock.return_value)
    content = _make_content(mock_header_data, pdf=b"%PDF-1.4...")
    notification = _make_v2_notification(content, target="C12345")

    notification.send()

    client._upload_file.assert_called_once()
    assert client._upload_file.call_args.kwargs["data"] == b"%PDF-1.4..."
    client.files_getUploadURLExternal.assert_called_once_with(
        filename="test alert.pdf",
        length=len(b"%PDF-1.4..."),
    )


@patch("superset.reports.notifications.slackv2.g")
@patch("superset.reports.notifications.slackv2.get_slack_client")
def test_v2_send_to_multiple_channels_uploads_per_channel(
    slack_client_mock: MagicMock,
    flask_global_mock: MagicMock,
    mock_header_data,
) -> None:
    flask_global_mock.logs_context = {}
    client = _configure_v2_upload_client(slack_client_mock.return_value)
    content = _make_content(mock_header_data, screenshots=[b"shot-1", b"shot-2"])
    notification = _make_v2_notification(content, target="C12345,C67890,C11111")

    notification.send()

    upload = client._upload_file
    # 3 channels x 2 files = 6 uploads
    assert upload.call_count == 6
    seen = {
        (completion.kwargs["channel_id"], upload_call.kwargs["data"])
        for completion, upload_call in zip(
            client.files_completeUploadExternal.call_args_list,
            upload.call_args_list,
            strict=True,
        )
    }
    assert seen == {
        ("C12345", b"shot-1"),
        ("C12345", b"shot-2"),
        ("C67890", b"shot-1"),
        ("C67890", b"shot-2"),
        ("C11111", b"shot-1"),
        ("C11111", b"shot-2"),
    }


@patch("superset.reports.notifications.slackv2.g")
@patch("superset.reports.notifications.slackv2.get_slack_client")
def test_v2_send_deduplicates_channels(
    slack_client_mock: MagicMock,
    flask_global_mock: MagicMock,
    mock_header_data: HeaderDataType,
) -> None:
    flask_global_mock.logs_context = {}
    notification = _make_v2_notification(
        _make_content(mock_header_data),
        target="C12345,C12345",
    )

    notification.send()

    slack_client_mock.return_value.chat_postMessage.assert_called_once_with(
        channel="C12345",
        text=ANY,
    )


@patch("superset.reports.notifications.slackv2.g")
@patch("superset.reports.notifications.slackv2.get_slack_client")
def test_v2_send_text_only_uses_chat_post_message(
    slack_client_mock: MagicMock,
    flask_global_mock: MagicMock,
    mock_header_data,
) -> None:
    flask_global_mock.logs_context = {}
    content = _make_content(mock_header_data)
    notification = _make_v2_notification(content, target="C12345,C67890")

    notification.send()

    # No files → chat_postMessage per channel, no files_upload_v2 calls
    slack_client_mock.return_value.files_upload_v2.assert_not_called()
    chat = slack_client_mock.return_value.chat_postMessage
    assert chat.call_count == 2
    channels = sorted(c.kwargs["channel"] for c in chat.call_args_list)
    assert channels == ["C12345", "C67890"]


def test_v2_inline_files_precedence(mock_header_data) -> None:
    """CSV beats screenshots beats PDF; only one inline-file type is sent."""
    content = _make_content(
        mock_header_data,
        csv=b"a,b\n1,2",
        screenshots=[b"shot-1"],
        pdf=b"%PDF",
    )
    notification = _make_v2_notification(content, target="C12345")
    file_type, files = notification._get_inline_files()
    assert file_type == "csv"
    assert files == [b"a,b\n1,2"]

    content = _make_content(
        mock_header_data,
        screenshots=[b"shot-1"],
        pdf=b"%PDF",
    )
    notification = _make_v2_notification(content, target="C12345")
    file_type, files = notification._get_inline_files()
    assert file_type == "png"
    assert files == [b"shot-1"]

    content = _make_content(mock_header_data, pdf=b"%PDF")
    notification = _make_v2_notification(content, target="C12345")
    file_type, files = notification._get_inline_files()
    assert file_type == "pdf"
    assert files == [b"%PDF"]


@pytest.mark.parametrize(
    ("slack_exc_factory", "expected_exc"),
    [
        (
            lambda: BotUserAccessError("bot user blocked"),
            NotificationParamException,
        ),
        (
            lambda: SlackRequestError("bad request"),
            NotificationParamException,
        ),
        (
            lambda: SlackClientConfigurationError("misconfigured"),
            NotificationParamException,
        ),
        (
            lambda: SlackObjectFormationError("malformed"),
            NotificationMalformedException,
        ),
        (
            lambda: SlackTokenRotationError(
                SlackApiError(message="rotation failed", response={"ok": False})
            ),
            NotificationAuthorizationException,
        ),
        (
            lambda: SlackClientNotConnectedError("offline"),
            NotificationError,
        ),
        (
            # Fallback: any other SlackClientError becomes Unprocessable.
            lambda: SlackClientError("misc client error"),
            NotificationUnprocessableException,
        ),
    ],
)
@patch("superset.reports.notifications.slackv2.g")
@patch("superset.reports.notifications.slackv2.get_slack_client")
def test_v2_send_maps_slack_sdk_exceptions(
    slack_client_mock: MagicMock,
    flask_global_mock: MagicMock,
    slack_exc_factory,
    expected_exc,
    mock_header_data,
) -> None:
    flask_global_mock.logs_context = {}
    slack_client_mock.return_value.chat_postMessage.side_effect = slack_exc_factory()

    content = _make_content(mock_header_data)
    notification = _make_v2_notification(content, target="C12345")

    with pytest.raises(expected_exc):
        notification.send()


@patch("superset.reports.notifications.slackv2.g")
@patch("superset.reports.notifications.slackv2.get_slack_client")
def test_v2_send_does_not_retry_ambiguous_transient_slack_api_error(
    slack_client_mock: MagicMock,
    flask_global_mock: MagicMock,
    mock_header_data,
) -> None:
    """An outcome-ambiguous terminal write is attempted at most once."""
    flask_global_mock.logs_context = {}
    slack_client_mock.return_value.chat_postMessage.side_effect = SlackApiError(
        message="service unavailable",
        response={"ok": False, "error": "service_unavailable"},
    )

    content = _make_content(mock_header_data)
    notification = _make_v2_notification(content, target="C12345")

    with pytest.raises(NotificationError, match="C12345"):
        notification.send()

    slack_client_mock.return_value.chat_postMessage.assert_called_once()


@patch("superset.reports.notifications.slackv2.g")
@patch("superset.reports.notifications.slackv2.get_slack_client")
def test_v2_send_retries_then_succeeds_on_explicit_http_rate_limit(
    slack_client_mock: MagicMock,
    flask_global_mock: MagicMock,
    mock_header_data,
) -> None:
    """An explicit HTTP 429 safely retries a rejected terminal write."""
    flask_global_mock.logs_context = {}
    response = _make_slack_response(
        429,
        {"ok": False, "error": "ratelimited"},
        headers={"Retry-After": ["0"]},
    )
    slack_client_mock.return_value.chat_postMessage.side_effect = [
        SlackApiError(message="rate limited", response=response),
        SlackApiError(message="rate limited", response=response),
        {"ok": True},
    ]

    content = _make_content(mock_header_data)
    notification = _make_v2_notification(content, target="C12345")

    with patch(
        "superset.extensions.stats_logger_manager.instance.gauge"
    ) as statsd_mock:
        notification.send()

    assert slack_client_mock.return_value.chat_postMessage.call_count == 3
    statsd_mock.assert_called_with("reports.slack.send.ok", 1)


@patch("superset.reports.notifications.slackv2.g")
@patch("superset.reports.notifications.slackv2.get_slack_client")
def test_v2_send_retries_only_failed_channel(
    slack_client_mock: MagicMock,
    flask_global_mock: MagicMock,
    mock_header_data,
) -> None:
    flask_global_mock.logs_context = {}
    failed_attempts = 0

    def chat_side_effect(channel: str, text: str) -> dict[str, bool]:
        nonlocal failed_attempts
        if channel == "C67890" and failed_attempts < 2:
            failed_attempts += 1
            response = _make_slack_response(
                429,
                {"ok": False, "error": "ratelimited"},
                headers={"Retry-After": ["0"]},
            )
            raise SlackApiError(
                message="rate limited",
                response=response,
            )
        return {"ok": True}

    slack_client_mock.return_value.chat_postMessage.side_effect = chat_side_effect

    content = _make_content(mock_header_data)
    notification = _make_v2_notification(content, target="C12345,C67890")

    notification.send()

    assert [
        slack_call.kwargs["channel"]
        for slack_call in slack_client_mock.return_value.chat_postMessage.call_args_list
    ] == ["C12345", "C67890", "C67890", "C67890"]


@pytest.mark.parametrize("send_fails", [False, True], ids=["success", "failure"])
@patch("superset.reports.notifications.slackv2.g")
@patch("superset.reports.notifications.slackv2.get_slack_client")
def test_v2_text_send_clamps_timeout_to_shared_deadline(
    slack_client_mock: MagicMock,
    flask_global_mock: MagicMock,
    send_fails: bool,
    mock_header_data: HeaderDataType,
) -> None:
    flask_global_mock.logs_context = {}
    client = slack_client_mock.return_value
    client.timeout = 30

    def assert_timeout(**kwargs: object) -> dict[str, bool]:
        assert client.timeout == 10
        if send_fails:
            raise SlackApiError(
                message="service unavailable",
                response={"ok": False, "error": "service_unavailable"},
            )
        return {"ok": True}

    client.chat_postMessage.side_effect = assert_timeout
    notification = _make_v2_notification(
        _make_content(mock_header_data),
        target="C12345",
    )

    clock = iter([0.0, 140.0])
    with patch(
        "superset.reports.notifications.slack_mixin.time.monotonic",
        side_effect=lambda: next(clock, 140.0),
    ):
        if send_fails:
            with pytest.raises(NotificationTransientError, match="C12345"):
                notification.send()
        else:
            notification.send()

    assert client.timeout == 30


@patch("superset.reports.notifications.slackv2.g")
@patch("superset.reports.notifications.slackv2.get_slack_client")
def test_v2_send_does_not_retry_permanent_slack_api_error(
    slack_client_mock: MagicMock,
    flask_global_mock: MagicMock,
    mock_header_data,
) -> None:
    flask_global_mock.logs_context = {}
    slack_client_mock.return_value.chat_postMessage.side_effect = SlackApiError(
        message="channel not found",
        response={"ok": False, "error": "channel_not_found"},
    )

    content = _make_content(mock_header_data)
    notification = _make_v2_notification(content, target="C12345")

    with pytest.raises(NotificationUnprocessableException):
        notification.send()

    assert slack_client_mock.return_value.chat_postMessage.call_count == 1


@pytest.mark.parametrize(
    ("content_overrides", "method_name", "target_keyword"),
    [
        ({}, "chat_postMessage", "channel"),
        (
            {"screenshots": [b"screenshot"]},
            "files_completeUploadExternal",
            "channel_id",
        ),
    ],
    ids=["text", "file"],
)
@patch("superset.reports.notifications.slackv2.g")
@patch("superset.reports.notifications.slackv2.get_slack_client")
def test_v2_send_reports_failed_channel_and_continues_later_channels(
    slack_client_mock: MagicMock,
    flask_global_mock: MagicMock,
    content_overrides: dict[str, Any],
    method_name: str,
    target_keyword: str,
    mock_header_data: HeaderDataType,
) -> None:
    flask_global_mock.logs_context = {}
    if content_overrides:
        _configure_v2_upload_client(slack_client_mock.return_value)

    def send_side_effect(**kwargs: object) -> dict[str, bool]:
        channel = kwargs[target_keyword]
        if channel == "C2":
            raise SlackApiError(
                message="channel not found",
                response={"ok": False, "error": "channel_not_found"},
            )
        return {"ok": True}

    method = getattr(slack_client_mock.return_value, method_name)
    method.side_effect = send_side_effect
    notification = _make_v2_notification(
        _make_content(mock_header_data, **content_overrides),
        target="C1,C2,C3",
    )

    with pytest.raises(NotificationUnprocessableException, match="C2"):
        notification.send()

    assert [
        slack_call.kwargs[target_keyword] for slack_call in method.call_args_list
    ] == [
        "C1",
        "C2",
        "C3",
    ]


@patch("superset.reports.notifications.slackv2.g")
@patch("superset.reports.notifications.slackv2.get_slack_client")
def test_v2_send_does_not_retry_param_errors(
    slack_client_mock: MagicMock,
    flask_global_mock: MagicMock,
    mock_header_data,
) -> None:
    """Non-transient errors (config / auth / malformed) are NOT retried — only
    NotificationUnprocessableException triggers backoff. A
    NotificationParamException-class failure (BotUserAccessError → 422) hits
    the API exactly once and surfaces immediately.
    """
    flask_global_mock.logs_context = {}
    slack_client_mock.return_value.chat_postMessage.side_effect = BotUserAccessError(
        "bot user blocked"
    )

    content = _make_content(mock_header_data)
    notification = _make_v2_notification(content, target="C12345")

    with pytest.raises(NotificationParamException):
        notification.send()

    assert slack_client_mock.return_value.chat_postMessage.call_count == 1


def _make_slack_response(
    status_code: int,
    data: dict[str, Any],
    headers: dict[str, list[str]] | None = None,
) -> SlackResponse:
    """Build an SDK-faithful SlackResponse that carries a real ``status_code``.

    The existing retry tests pass ``SlackApiError(response={...})`` — a plain
    dict, which has no ``status_code`` attribute. That makes
    ``_get_slack_api_status_code`` return ``None`` and the ``429 / 5xx → retry``
    branch in ``_give_up_slack_api_retry`` is never exercised. The real SDK hands
    back a ``SlackResponse`` with a populated ``status_code``, so we mirror that
    here to cover the status-code branch faithfully.
    """
    return SlackResponse(
        client=None,
        http_verb="POST",
        api_url="https://slack.com/api/chat.postMessage",
        req_args={},
        data=data,
        headers=headers or {},
        status_code=status_code,
    )


@pytest.mark.parametrize(
    "status_code,data",
    [
        # 5xx with an empty / unknown body: no `error` code to classify, so the
        # status-code branch is the only thing that can decide to retry. This is
        # the case the dict-based tests silently lost.
        (503, {"ok": False}),
        (502, {}),
    ],
)
def test_give_up_slack_api_retry_retries_on_status_code(
    status_code: int, data: dict[str, Any]
) -> None:
    response = _make_slack_response(status_code, data)
    ex = SlackApiError(message="transient", response=response)

    # give_up == False -> the request WILL be retried by backoff.
    assert _give_up_slack_api_retry(ex) is False


def test_give_up_slack_api_retry_retries_http_408() -> None:
    """Request timeout stays transient even though it is a 4xx response."""
    response = _make_slack_response(
        408,
        {"ok": False, "error": "request_timeout"},
    )
    ex = SlackApiError(message="request timed out", response=response)

    assert _give_up_slack_api_retry(ex) is False


def test_give_up_slack_api_retry_stops_after_rate_limit_budget() -> None:
    """Do not multiply call_slack_api's configured rate-limit retry budget."""
    response = _make_slack_response(
        429,
        {"ok": False, "error": "ratelimited"},
    )
    ex = SlackApiError(message="rate limited", response=response)

    assert _give_up_slack_api_retry(ex) is True


def test_call_slack_api_rate_limit_retries_respect_shared_deadline(mocker) -> None:
    """A Retry-After wait cannot begin an SDK write past the shared deadline."""
    response = _make_slack_response(
        429,
        {"ok": False, "error": "ratelimited"},
        headers={"Retry-After": ["120"]},
    )
    method = MagicMock(
        side_effect=SlackApiError(message="rate limited", response=response)
    )
    clock = [0.0]
    sleep = mocker.patch("superset.reports.notifications.slack_mixin.time.sleep")
    sleep.side_effect = lambda duration: clock.__setitem__(0, clock[0] + duration)
    mocker.patch(
        "superset.reports.notifications.slack_mixin.time.monotonic",
        side_effect=lambda: clock[0],
    )
    mocker.patch.dict(
        "superset.reports.notifications.slack_mixin.app.config",
        {"SLACK_API_RATE_LIMIT_RETRY_COUNT": 2},
    )

    with pytest.raises(SlackRetryDeadlineError, match="deadline exceeded"):
        call_slack_api(method, retry_deadline=150.0)

    assert method.call_count == 2
    sleep.assert_called_once_with(120.0)


def test_call_slack_api_rate_limit_budget_spans_server_error_retries(mocker) -> None:
    """A server-error retry does not reset the configured HTTP 429 budget."""
    rate_limit_error = SlackApiError(
        message="rate limited",
        response=_make_slack_response(
            429,
            {"ok": False, "error": "ratelimited"},
            headers={"Retry-After": ["0"]},
        ),
    )
    server_error = SlackApiError(
        message="service unavailable",
        response=_make_slack_response(503, {"ok": False}),
    )
    method = MagicMock(side_effect=[rate_limit_error, server_error, rate_limit_error])
    mocker.patch.dict(
        "superset.reports.notifications.slack_mixin.app.config",
        {"SLACK_API_RATE_LIMIT_RETRY_COUNT": 1},
    )

    with pytest.raises(SlackApiError):
        call_slack_api(method)

    assert method.call_count == 3


def test_call_slack_api_retries_ratelimited_code_without_http_429() -> None:
    """A ratelimited response without HTTP 429 uses application backoff."""
    ex = SlackApiError(
        message="rate limited",
        response={"ok": False, "error": "ratelimited"},
    )
    method = MagicMock(side_effect=ex)

    with pytest.raises(SlackApiError):
        call_slack_api(method)

    assert method.call_count == 5


def test_send_to_slack_channels_shares_one_retry_deadline() -> None:
    """Later channels do not start an API call after the shared deadline."""
    clock = [0.0]
    error = SlackApiError(
        message="service unavailable",
        response={"ok": False, "error": "service_unavailable"},
    )
    first_method = MagicMock()

    def fail_first_channel() -> None:
        if first_method.call_count == 5:
            clock[0] = 151.0
        raise error

    first_method.side_effect = fail_first_channel
    methods = {
        "private-a": first_method,
        "private-b": MagicMock(side_effect=error),
    }

    def send(channel: str, retry_deadline: float) -> None:
        call_slack_api(methods[channel], retry_deadline=retry_deadline)

    with (
        patch(
            "superset.reports.notifications.slack_mixin.time.monotonic",
            side_effect=lambda: clock[0],
        ),
        pytest.raises(
            NotificationTransientError,
            match="(?s)private-a.*private-b",
        ),
    ):
        send_to_slack_channels(["private-a", "private-b"], send)

    assert methods["private-a"].call_count == 5
    methods["private-b"].assert_not_called()


@pytest.mark.parametrize(
    "transport_error",
    [
        URLError("connection reset"),
        ConnectionResetError("connection reset"),
        RemoteDisconnected("connection closed"),
        TimeoutError("timed out"),
    ],
)
def test_send_to_slack_channels_does_not_retry_outcome_unknown_transport_errors(
    transport_error: Exception,
) -> None:
    """Response-loss errors remain transient without duplicating accepted writes."""
    methods = {
        "private-a": MagicMock(side_effect=transport_error),
        "private-b": MagicMock(return_value={"ok": True}),
    }

    def send(channel: str, retry_deadline: float) -> None:
        call_slack_api(methods[channel], retry_deadline=retry_deadline)

    with pytest.raises(NotificationTransientError, match="private-a"):
        send_to_slack_channels(["private-a", "private-b"], send)

    methods["private-a"].assert_called_once_with()
    methods["private-b"].assert_called_once_with()


def test_call_slack_api_checks_monotonic_deadline_before_each_retry() -> None:
    """A failed call that consumes the budget cannot start another attempt."""
    clock = [0.0]
    error = SlackApiError(
        message="service unavailable",
        response={"ok": False, "error": "service_unavailable"},
    )
    method = MagicMock()

    def fail_after_deadline() -> None:
        clock[0] = 151.0
        raise error

    method.side_effect = fail_after_deadline

    with (
        patch(
            "superset.reports.notifications.slack_mixin.time.monotonic",
            side_effect=lambda: clock[0],
        ),
        pytest.raises(SlackRetryDeadlineError, match="deadline exceeded"),
    ):
        call_slack_api(method, retry_deadline=150.0)

    method.assert_called_once_with()


def test_call_slack_api_without_explicit_deadline_is_still_bounded() -> None:
    """The helper's default cannot create an unbounded retry operation."""
    clock = [0.0]
    error = SlackApiError(
        message="service unavailable",
        response={"ok": False, "error": "service_unavailable"},
    )
    method = MagicMock()

    def fail_after_default_deadline() -> None:
        clock[0] = 151.0
        raise error

    method.side_effect = fail_after_default_deadline

    with (
        patch(
            "superset.reports.notifications.slack_mixin.time.monotonic",
            side_effect=lambda: clock[0],
        ),
        pytest.raises(SlackRetryDeadlineError, match="deadline exceeded"),
    ):
        call_slack_api(method)

    method.assert_called_once_with()


@patch("superset.reports.notifications.slackv2.g")
@patch("superset.reports.notifications.slackv2.get_slack_client")
def test_v2_send_uses_configured_application_rate_limit_budget(
    slack_client_mock: MagicMock,
    flask_global_mock: MagicMock,
    mock_header_data: HeaderDataType,
) -> None:
    """Delivery 429 retries use one configured application-owned budget."""
    flask_global_mock.logs_context = {}
    response = _make_slack_response(
        429,
        {"ok": False, "error": "ratelimited"},
        headers={"Retry-After": ["0"]},
    )
    slack_client_mock.return_value.chat_postMessage.side_effect = SlackApiError(
        message="rate limited",
        response=response,
    )
    notification = _make_v2_notification(
        _make_content(mock_header_data),
        target="C12345",
    )

    with (
        patch("superset.reports.notifications.slack_mixin.time.sleep"),
        pytest.raises(NotificationError, match="C12345"),
    ):
        notification.send()

    assert slack_client_mock.return_value.chat_postMessage.call_count == 3


def test_give_up_slack_api_retry_gives_up_on_permanent_status_code() -> None:
    """Control: a 4xx (non-429) with a non-transient error code is not retried,
    even when carried by a faithful SlackResponse — so the new helper above is
    asserting the status-code branch, not merely that everything retries.
    """
    response = _make_slack_response(404, {"ok": False, "error": "channel_not_found"})
    ex = SlackApiError(message="permanent", response=response)

    assert _give_up_slack_api_retry(ex) is True


def test_call_slack_api_does_not_retry_empty_client_error_response() -> None:
    """A non-429 4xx is permanent even when Slack omits an error code."""
    response = _make_slack_response(400, {})
    ex = SlackApiError(message="bad request", response=response)
    method = MagicMock(side_effect=ex)

    with pytest.raises(SlackApiError):
        call_slack_api(method)

    method.assert_called_once_with()


@patch("superset.reports.notifications.slackv2.g")
@patch("superset.reports.notifications.slackv2.get_slack_client")
def test_v2_send_records_statsd_gauge_on_success(
    slack_client_mock: MagicMock,
    flask_global_mock: MagicMock,
    mock_header_data,
) -> None:
    flask_global_mock.logs_context = {}
    content = _make_content(mock_header_data)
    notification = _make_v2_notification(content, target="C12345")

    with patch(
        "superset.extensions.stats_logger_manager.instance.gauge"
    ) as statsd_mock:
        notification.send()

    statsd_mock.assert_called_with("reports.slack.send.ok", 1)


@patch("superset.reports.notifications.slackv2.g")
@patch("superset.reports.notifications.slackv2.get_slack_client")
def test_v2_send_records_statsd_gauge_warning_on_param_error(
    slack_client_mock: MagicMock,
    flask_global_mock: MagicMock,
    mock_header_data,
) -> None:
    """Status<500 exceptions (NotificationParamException is 422) → .warning."""
    flask_global_mock.logs_context = {}
    slack_client_mock.return_value.chat_postMessage.side_effect = (
        SlackClientConfigurationError("bad config")
    )

    content = _make_content(mock_header_data)
    notification = _make_v2_notification(content, target="C12345")

    with patch(
        "superset.extensions.stats_logger_manager.instance.gauge"
    ) as statsd_mock:
        with pytest.raises(NotificationParamException):
            notification.send()

    assert call("reports.slack.send.warning", 1) in statsd_mock.call_args_list


@patch("superset.reports.notifications.slackv2.g")
@patch("superset.reports.notifications.slackv2.logger")
@patch("superset.reports.notifications.slackv2.get_slack_client")
def test_v2_send_propagates_execution_id_to_logs(
    slack_client_mock: MagicMock,
    logger_mock: MagicMock,
    flask_global_mock: MagicMock,
    mock_header_data,
) -> None:
    """The success log carries the execution_id from g.logs_context."""
    execution_id = uuid.uuid4()
    flask_global_mock.logs_context = {"execution_id": execution_id}
    _configure_v2_upload_client(slack_client_mock.return_value)

    content = _make_content(mock_header_data, screenshots=[b"shot"])
    notification = _make_v2_notification(content, target="C12345")
    notification.send()

    logger_mock.info.assert_called_with(
        "Report sent to slack", extra={"execution_id": execution_id}
    )


@patch("superset.reports.notifications.slackv2.g")
@patch("superset.reports.notifications.slackv2.logger")
@patch("superset.reports.notifications.slackv2.get_slack_client")
def test_v2_send_handles_missing_logs_context(
    slack_client_mock: MagicMock,
    logger_mock: MagicMock,
    flask_global_mock: MagicMock,
    mock_header_data,
) -> None:
    """When g.logs_context is None or missing, the log uses execution_id=None."""
    # Mirrors `getattr(g, "logs_context", {}) or {}` falsy-coalescing path.
    flask_global_mock.logs_context = None

    content = _make_content(mock_header_data)
    notification = _make_v2_notification(content, target="C12345")
    notification.send()

    logger_mock.info.assert_called_with(
        "Report sent to slack", extra={"execution_id": None}
    )


# ---------------------------------------------------------------------------
# End-to-end auto-upgrade: v1 recipient → SlackV1NotificationError → upgrade →
# row mutated to IDs → second send takes the v2 fast path with no resolution.
# ---------------------------------------------------------------------------


@patch(
    "superset.utils.slack.feature_flag_manager.is_feature_enabled",
    return_value=True,
)
@patch("superset.reports.notifications.slack.g")
@patch("superset.utils.slack.get_slack_client")
@patch("superset.reports.notifications.slack.get_slack_client")
@patch("superset.commands.report.execute.get_channels_with_search")
def test_auto_upgrade_round_trip_v1_to_v2(
    get_channels_with_search_mock: MagicMock,
    v1_client_mock: MagicMock,
    util_client_mock: MagicMock,
    flask_global_mock: MagicMock,
    feature_flag_mock: MagicMock,
    mock_header_data,
) -> None:
    """A v1 SLACK recipient with channel names is auto-upgraded to SlackV2 with
    channel IDs after the first send raises SlackV1NotificationError.

    The second send-as-v2 then uses the resolved IDs without further lookups.
    """
    from superset.commands.report.execute import BaseReportState
    from superset.reports.models import (
        ReportRecipients,
        ReportRecipientType,
        ReportSchedule,
    )
    from superset.reports.notifications.exceptions import SlackV1NotificationError
    from superset.reports.notifications.slack import SlackNotification

    flask_global_mock.logs_context = {}
    # Scopes are present → should_use_v2_api returns True → v1.send raises
    util_client_mock.return_value.conversations_list.return_value = {
        "channels": [{"id": "C12345", "name": "general"}]
    }
    get_channels_with_search_mock.return_value = (
        [
            {
                "id": "C12345",
                "name": "general",
                "is_member": True,
                "is_private": False,
            }
        ],
        False,
    )

    schedule = ReportSchedule(
        recipients=[
            ReportRecipients(
                type=ReportRecipientType.SLACK,
                recipient_config_json='{"target": "general"}',
            )
        ]
    )
    content = _make_content(mock_header_data)

    # Step 1: v1 send raises SlackV1NotificationError because v2 is available.
    v1 = SlackNotification(recipient=schedule.recipients[0], content=content)
    with pytest.raises(SlackV1NotificationError):
        v1.send()

    # Step 2: command-level upgrade rewrites the row to SlackV2 with channel IDs.
    state = BaseReportState(schedule, "January 1, 2021", "exec-id")
    state.update_report_schedule_slack_v2()
    assert schedule.recipients[0].type == ReportRecipientType.SLACKV2
    assert schedule.recipients[0].recipient_config_json == '{"target": "C12345"}'

    # Step 3: a fresh SlackV2Notification on the rewritten row sends to the
    # resolved channel ID directly. (SlackV2Notification.send() never calls
    # get_channels_with_search itself, so the upgraded row carrying IDs in
    # its target is the load-bearing assertion here.)
    with patch(
        "superset.reports.notifications.slackv2.get_slack_client"
    ) as v2_client_mock:
        v2 = SlackV2Notification(recipient=schedule.recipients[0], content=content)
        v2.send()
        v2_client_mock.return_value.chat_postMessage.assert_called_once()
        assert (
            v2_client_mock.return_value.chat_postMessage.call_args.kwargs["channel"]
            == "C12345"
        )
