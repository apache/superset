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
from unittest.mock import call, MagicMock, patch

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

from superset.reports.notifications.exceptions import (
    NotificationAuthorizationException,
    NotificationMalformedException,
    NotificationParamException,
    NotificationUnprocessableException,
)
from superset.reports.notifications.slackv2 import SlackV2Notification
from superset.utils.core import HeaderDataType


@pytest.fixture(autouse=True)
def _skip_backoff_sleep():
    """Make any @backoff.on_exception retries instant.

    SlackV2Notification.send() retries up to 5 times with `backoff.expo(factor=10,
    base=2)` — that's ~150s of real sleep on a persistently-failing send. We
    don't care about the wall-clock waits in unit tests; patching `time.sleep`
    inside backoff's sync runner keeps the assertion semantics (call_count,
    raised exception type) without the wait.
    """
    with patch("backoff._sync.time.sleep"):
        yield


@pytest.fixture
def mock_header_data() -> HeaderDataType:
    return {
        "notification_format": "PNG",
        "notification_type": "Alert",
        "owners": [1],
        "notification_source": None,
        "chart_id": None,
        "dashboard_id": None,
        "slack_channels": ["some_channel"],
        "execution_id": "test-execution-id",
    }


def test_get_channel_with_multi_recipients(mock_header_data) -> None:
    """
    Test the _get_channel function to ensure it will return a string
    with recipients separated by commas without interstitial spacing
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
            recipient_config_json='{"target": "some_channel; second_channel, third_channel"}',  # noqa: E501
        ),
        content=content,
    )

    result = slack_notification._get_channel()

    assert result == "some_channel,second_channel,third_channel"

    # Test if the recipient configuration JSON is valid when using a SlackV2 recipient type  # noqa: E501


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


def test_get_inline_files_with_screenshots(mock_header_data) -> None:
    """
    Test the _get_inline_files function to ensure it will return the correct tuple
    when content has screenshots
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
        screenshots=[b"screenshot1", b"screenshot2"],
    )
    slack_notification = SlackNotification(
        recipient=ReportRecipients(
            type=ReportRecipientType.SLACK,
            recipient_config_json='{"target": "some_channel"}',
        ),
        content=content,
    )

    result = slack_notification._get_inline_files()

    assert result == ("png", [b"screenshot1", b"screenshot2"])

    # Ensure _get_inline_files function returns None when content has no screenshots or csv  # noqa: E501


def test_get_inline_files_with_no_screenshots_or_csv(mock_header_data) -> None:
    """
    Test the _get_inline_files function to ensure it will return None
    when content has no screenshots or csv
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
            recipient_config_json='{"target": "some_channel"}',
        ),
        content=content,
    )

    result = slack_notification._get_inline_files()

    assert result == (None, [])


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
# tests below cover files_upload_v2 across screenshots/CSV/PDF, multi-channel
# fan-out, exception mapping, backoff, statsd, and logs propagation. Together
# they guarantee that every observable behavior of SlackV2Notification.send()
# is locked down before Slack v1 is removed.
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


@patch("superset.reports.notifications.slackv2.g")
@patch("superset.reports.notifications.slackv2.get_slack_client")
def test_v2_send_with_single_screenshot_calls_files_upload_v2(
    slack_client_mock: MagicMock,
    flask_global_mock: MagicMock,
    mock_header_data,
) -> None:
    flask_global_mock.logs_context = {"execution_id": uuid.uuid4()}
    content = _make_content(mock_header_data, screenshots=[b"screenshot-bytes"])
    notification = _make_v2_notification(content, target="C12345")

    notification.send()

    upload = slack_client_mock.return_value.files_upload_v2
    upload.assert_called_once()
    kwargs = upload.call_args.kwargs
    assert kwargs["channel"] == "C12345"
    assert kwargs["file"] == b"screenshot-bytes"
    assert kwargs["title"] == "test alert"
    assert kwargs["filename"] == "test alert.png"
    assert "test alert" in kwargs["initial_comment"]
    # chat_postMessage should NOT be called when files are present
    slack_client_mock.return_value.chat_postMessage.assert_not_called()


@patch("superset.reports.notifications.slackv2.g")
@patch("superset.reports.notifications.slackv2.get_slack_client")
def test_v2_send_with_multiple_screenshots_uploads_each(
    slack_client_mock: MagicMock,
    flask_global_mock: MagicMock,
    mock_header_data,
) -> None:
    flask_global_mock.logs_context = {}
    content = _make_content(
        mock_header_data, screenshots=[b"shot-1", b"shot-2", b"shot-3"]
    )
    notification = _make_v2_notification(content, target="C12345")

    notification.send()

    upload = slack_client_mock.return_value.files_upload_v2
    assert upload.call_count == 3
    uploaded_files = [c.kwargs["file"] for c in upload.call_args_list]
    assert uploaded_files == [b"shot-1", b"shot-2", b"shot-3"]
    # All three uploads target the same single channel
    for c in upload.call_args_list:
        assert c.kwargs["channel"] == "C12345"
        assert c.kwargs["filename"] == "test alert.png"


@patch("superset.reports.notifications.slackv2.g")
@patch("superset.reports.notifications.slackv2.get_slack_client")
def test_v2_send_with_csv_calls_files_upload_v2(
    slack_client_mock: MagicMock,
    flask_global_mock: MagicMock,
    mock_header_data,
) -> None:
    flask_global_mock.logs_context = {}
    content = _make_content(mock_header_data, csv=b"col1,col2\n1,2\n")
    notification = _make_v2_notification(content, target="C12345")

    notification.send()

    upload = slack_client_mock.return_value.files_upload_v2
    upload.assert_called_once()
    kwargs = upload.call_args.kwargs
    assert kwargs["file"] == b"col1,col2\n1,2\n"
    assert kwargs["filename"] == "test alert.csv"


@patch("superset.reports.notifications.slackv2.g")
@patch("superset.reports.notifications.slackv2.get_slack_client")
def test_v2_send_with_pdf_calls_files_upload_v2(
    slack_client_mock: MagicMock,
    flask_global_mock: MagicMock,
    mock_header_data,
) -> None:
    flask_global_mock.logs_context = {}
    content = _make_content(mock_header_data, pdf=b"%PDF-1.4...")
    notification = _make_v2_notification(content, target="C12345")

    notification.send()

    upload = slack_client_mock.return_value.files_upload_v2
    upload.assert_called_once()
    kwargs = upload.call_args.kwargs
    assert kwargs["file"] == b"%PDF-1.4..."
    assert kwargs["filename"] == "test alert.pdf"


@patch("superset.reports.notifications.slackv2.g")
@patch("superset.reports.notifications.slackv2.get_slack_client")
def test_v2_send_to_multiple_channels_uploads_per_channel(
    slack_client_mock: MagicMock,
    flask_global_mock: MagicMock,
    mock_header_data,
) -> None:
    flask_global_mock.logs_context = {}
    content = _make_content(mock_header_data, screenshots=[b"shot-1", b"shot-2"])
    notification = _make_v2_notification(content, target="C12345,C67890,C11111")

    notification.send()

    upload = slack_client_mock.return_value.files_upload_v2
    # 3 channels x 2 files = 6 uploads
    assert upload.call_count == 6
    seen = {(c.kwargs["channel"], c.kwargs["file"]) for c in upload.call_args_list}
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
            NotificationUnprocessableException,
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
def test_v2_send_retries_on_transient_slack_api_error(
    slack_client_mock: MagicMock,
    flask_global_mock: MagicMock,
    mock_header_data,
) -> None:
    """`@backoff.on_exception(NotificationUnprocessableException, max_tries=5)`
    retries the wrapped exception that send() actually raises.

    A persistent Slack rate-limit (or any other transient failure that maps to
    NotificationUnprocessableException) results in exactly max_tries=5 send
    attempts before the final exception propagates. This mirrors the existing
    pattern in webhook.py.
    """
    flask_global_mock.logs_context = {}
    slack_client_mock.return_value.chat_postMessage.side_effect = SlackApiError(
        message="rate limited", response={"ok": False, "error": "ratelimited"}
    )

    content = _make_content(mock_header_data)
    notification = _make_v2_notification(content, target="C12345")

    with pytest.raises(NotificationUnprocessableException):
        notification.send()

    assert slack_client_mock.return_value.chat_postMessage.call_count == 5


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
    get_channels_with_search_mock.return_value = [
        {"id": "C12345", "name": "general", "is_member": True, "is_private": False}
    ]

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
