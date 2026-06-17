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


import datetime as datetime_module

import pandas as pd
import pytest

from superset.reports.notifications.exceptions import (
    NotificationParamException,
    NotificationUnprocessableException,
)
from superset.reports.notifications.webhook import WebhookNotification
from superset.utils.core import HeaderDataType


@pytest.fixture
def mock_header_data() -> HeaderDataType:
    return {
        "notification_format": "PNG",
        "notification_type": "Alert",
        "owners": [1],
        "notification_source": None,
        "chart_id": None,
        "dashboard_id": None,
        "slack_channels": None,
        "execution_id": "test-execution-id",
    }


def test_get_webhook_url(mock_header_data) -> None:
    """
    Test the _get_webhook_url function to ensure it correctly extracts
    the webhook URL from recipient configuration
    """
    from superset.reports.models import ReportRecipients, ReportRecipientType
    from superset.reports.notifications.base import NotificationContent

    content = NotificationContent(
        name="test alert",
        header_data=mock_header_data,
        embedded_data=pd.DataFrame({"A": [1, 2, 3], "B": [4, 5, 6]}),
        description="Test description",
    )
    webhook_notification = WebhookNotification(
        recipient=ReportRecipients(
            type=ReportRecipientType.WEBHOOK,
            recipient_config_json='{"target": "https://example.com/webhook"}',
        ),
        content=content,
    )

    result = webhook_notification._get_webhook_url()

    assert result == "https://example.com/webhook"


def test_get_webhook_url_missing_url(mock_header_data) -> None:
    """
    Test that _get_webhook_url raises an exception when URL is missing
    """
    from superset.reports.models import ReportRecipients, ReportRecipientType
    from superset.reports.notifications.base import NotificationContent

    content = NotificationContent(
        name="test alert",
        header_data=mock_header_data,
        description="Test description",
    )
    webhook_notification = WebhookNotification(
        recipient=ReportRecipients(
            type=ReportRecipientType.WEBHOOK,
            recipient_config_json="{}",
        ),
        content=content,
    )

    with pytest.raises(NotificationParamException, match="Webhook URL is required"):
        webhook_notification._get_webhook_url()


def test_get_req_payload_basic(mock_header_data) -> None:
    """
    Test that _get_req_payload returns correct payload structure
    """
    from superset.reports.models import ReportRecipients, ReportRecipientType
    from superset.reports.notifications.base import NotificationContent

    content = NotificationContent(
        name="Payload Name",
        header_data=mock_header_data,
        embedded_data=None,
        description="Payload Description",
        url="http://example.com/report",
        text="Report Text",
    )
    webhook_notification = WebhookNotification(
        recipient=ReportRecipients(
            type=ReportRecipientType.WEBHOOK,
            recipient_config_json='{"target": "https://webhook.com"}',
        ),
        content=content,
    )

    payload = webhook_notification._get_req_payload()

    assert payload["name"] == "Payload Name"
    assert payload["description"] == "Payload Description"
    assert payload["url"] == "http://example.com/report"
    assert payload["text"] == "Report Text"
    assert isinstance(payload["header"], dict)
    # Optional fields from header_data
    assert payload["header"]["notification_format"] == "PNG"
    assert payload["header"]["notification_type"] == "Alert"


def test_get_files_includes_all_content_types(mock_header_data) -> None:
    """
    Test that _get_files correctly includes csv, pdf, and multiple screenshot attachments
    """  # noqa: E501

    from superset.reports.models import ReportRecipients, ReportRecipientType
    from superset.reports.notifications.base import NotificationContent

    csv_bytes = b"col1,col2\n1,2"
    pdf_bytes = b"%PDF-1.4"
    screenshots = [b"fakeimg1", b"fakeimg2"]

    content = NotificationContent(
        name="file test",
        header_data=mock_header_data,
        csv=csv_bytes,
        pdf=pdf_bytes,
        screenshots=screenshots,
        description="files test",
    )
    webhook_notification = WebhookNotification(
        recipient=ReportRecipients(
            type=ReportRecipientType.WEBHOOK,
            recipient_config_json='{"target": "https://webhook.com"}',
        ),
        content=content,
    )
    files = webhook_notification._get_files()
    # There should be 1 csv, 1 pdf, and 2 screenshots = 4 files total
    assert len(files) == 4

    file_names = [file_info[1][0] for file_info in files]
    assert "report.csv" in file_names
    assert "report.pdf" in file_names
    assert "screenshot_0.png" in file_names
    assert "screenshot_1.png" in file_names

    mime_types = [file_info[1][2] for file_info in files]
    assert "text/csv" in mime_types
    assert "application/pdf" in mime_types
    assert mime_types.count("image/png") == 2


def test_get_files_empty_when_no_content(mock_header_data) -> None:
    """
    Test that _get_files returns empty list when no files present
    """
    from superset.reports.models import ReportRecipients, ReportRecipientType
    from superset.reports.notifications.base import NotificationContent

    content = NotificationContent(
        name="no files",
        header_data=mock_header_data,
        description="no files test",
    )
    webhook_notification = WebhookNotification(
        recipient=ReportRecipients(
            type=ReportRecipientType.WEBHOOK,
            recipient_config_json='{"target": "https://webhook.com"}',
        ),
        content=content,
    )
    files = webhook_notification._get_files()
    assert files == []


def test_send_http_only_https_check(monkeypatch, mock_header_data) -> None:
    """
    Test send raises when URL is not HTTPS and config enforces HTTPS only
    """
    from superset.reports.models import ReportRecipients, ReportRecipientType
    from superset.reports.notifications.base import NotificationContent

    content = NotificationContent(
        name="test alert", header_data=mock_header_data, description="Test description"
    )
    webhook_notification = WebhookNotification(
        recipient=ReportRecipients(
            type=ReportRecipientType.WEBHOOK,
            recipient_config_json='{"target": "http://notsecure.com/webhook"}',
        ),
        content=content,
    )

    class MockCurrentApp:
        config = {"ALERT_REPORTS_WEBHOOK_HTTPS_ONLY": True}

    monkeypatch.setattr(
        "superset.reports.notifications.webhook.current_app", MockCurrentApp
    )
    monkeypatch.setattr(
        "superset.reports.notifications.webhook.feature_flag_manager.is_feature_enabled",
        lambda flag: True,
    )

    with pytest.raises(NotificationParamException, match="HTTPS is required by config"):
        webhook_notification.send()


def test_send_treats_redirect_as_failure(monkeypatch, mock_header_data) -> None:
    """
    A 3xx response is a failure: redirects are not followed
    (allow_redirects=False), so the request never reached the final target and
    must not be reported as success.
    """
    from superset.reports.models import ReportRecipients, ReportRecipientType
    from superset.reports.notifications.base import NotificationContent

    content = NotificationContent(
        name="test alert", header_data=mock_header_data, description="Test description"
    )
    webhook_notification = WebhookNotification(
        recipient=ReportRecipients(
            type=ReportRecipientType.WEBHOOK,
            recipient_config_json='{"target": "https://example.com/webhook"}',
        ),
        content=content,
    )

    class MockCurrentApp:
        config = {
            "ALERT_REPORTS_WEBHOOK_HTTPS_ONLY": True,
            "ALERT_REPORTS_WEBHOOK_ALLOW_INTERNAL_HOSTS": True,
        }

    class MockResponse:
        status_code = 302
        text = ""

    monkeypatch.setattr(
        "superset.reports.notifications.webhook.current_app", MockCurrentApp
    )
    monkeypatch.setattr(
        "superset.reports.notifications.webhook.feature_flag_manager.is_feature_enabled",
        lambda flag: True,
    )
    monkeypatch.setattr(
        "superset.reports.notifications.webhook.requests.post",
        lambda *args, **kwargs: MockResponse(),
    )

    with pytest.raises(NotificationParamException, match="redirect"):
        webhook_notification.send()


class _FakeBackoffDatetime:
    """
    Drop-in for the ``datetime`` *module* referenced as ``backoff._sync.datetime``.

    backoff 2.2.1 computes the ``max_time`` elapsed via
    ``datetime.datetime.now()`` inside ``backoff._sync`` (NOT via ``time``), so
    patching only ``backoff._sync.time.sleep`` leaves ``elapsed`` pinned at 0 and
    ``max_time`` never fires. This fake advances the clock a fixed ``step`` per
    ``now()`` call so the wall-time bound is observable in a sub-second test.
    A ``step`` of 0 holds the clock flat (elapsed stays 0).
    """

    def __init__(self, step_seconds: float) -> None:
        base = datetime_module.datetime(2020, 1, 1)
        state = {"calls": 0}

        class _FakeDateTime:
            @staticmethod
            def now() -> datetime_module.datetime:
                offset = datetime_module.timedelta(
                    seconds=step_seconds * state["calls"]
                )
                state["calls"] += 1
                return base + offset

        self.datetime = _FakeDateTime


def _make_webhook(mock_header_data) -> WebhookNotification:
    from superset.reports.models import ReportRecipients, ReportRecipientType
    from superset.reports.notifications.base import NotificationContent

    content = NotificationContent(
        name="test alert", header_data=mock_header_data, description="Test description"
    )
    return WebhookNotification(
        recipient=ReportRecipients(
            type=ReportRecipientType.WEBHOOK,
            recipient_config_json='{"target": "https://example.com/webhook"}',
        ),
        content=content,
    )


class _MockServerErrorResponse:
    status_code = 500
    text = ""


def _allow_internal_app() -> type:
    class MockCurrentApp:
        config = {
            "ALERT_REPORTS_WEBHOOK_HTTPS_ONLY": True,
            "ALERT_REPORTS_WEBHOOK_ALLOW_INTERNAL_HOSTS": True,
        }

    return MockCurrentApp


def test_send_backoff_bounded_by_max_time(monkeypatch, mock_header_data) -> None:
    """
    A persistently failing (500) target gives up on wall-time (``max_time``),
    not just ``max_tries``. With the fake clock stepping +50s per backoff sample,
    elapsed crosses ``max_time=120`` between the 2nd and 3rd POST, so exactly 3
    POSTs happen (distinct from ``max_tries=5``). The terminal exception type is
    unchanged on giveup.
    """
    webhook_notification = _make_webhook(mock_header_data)
    post_calls: list[int] = []

    def fake_post(*args, **kwargs) -> _MockServerErrorResponse:
        post_calls.append(1)
        return _MockServerErrorResponse()

    monkeypatch.setattr(
        "superset.reports.notifications.webhook.current_app", _allow_internal_app()
    )
    monkeypatch.setattr(
        "superset.reports.notifications.webhook.feature_flag_manager.is_feature_enabled",
        lambda flag: True,
    )
    monkeypatch.setattr(
        "superset.reports.notifications.webhook.requests.post", fake_post
    )
    monkeypatch.setattr("backoff._sync.time.sleep", lambda *a, **k: None)
    monkeypatch.setattr("backoff._sync.datetime", _FakeBackoffDatetime(50))

    with pytest.raises(NotificationUnprocessableException):
        webhook_notification.send()

    assert len(post_calls) == 3


def test_send_flat_clock_falls_back_to_max_tries(monkeypatch, mock_header_data) -> None:
    """
    Characterization (NOT a RED discriminator): with the clock held flat,
    ``max_time`` can never fire, so ``max_tries=5`` governs and exactly 5 POSTs
    happen. Passes on both buggy and fixed code; its job is to prove the 3-vs-5
    delta in ``test_send_backoff_bounded_by_max_time`` is attributable to
    wall-time, not to ``max_tries``.
    """
    webhook_notification = _make_webhook(mock_header_data)
    post_calls: list[int] = []

    def fake_post(*args, **kwargs) -> _MockServerErrorResponse:
        post_calls.append(1)
        return _MockServerErrorResponse()

    monkeypatch.setattr(
        "superset.reports.notifications.webhook.current_app", _allow_internal_app()
    )
    monkeypatch.setattr(
        "superset.reports.notifications.webhook.feature_flag_manager.is_feature_enabled",
        lambda flag: True,
    )
    monkeypatch.setattr(
        "superset.reports.notifications.webhook.requests.post", fake_post
    )
    monkeypatch.setattr("backoff._sync.time.sleep", lambda *a, **k: None)
    monkeypatch.setattr("backoff._sync.datetime", _FakeBackoffDatetime(0))

    with pytest.raises(NotificationUnprocessableException):
        webhook_notification.send()

    assert len(post_calls) == 5


def test_send_max_time_does_not_abandon_recovering_target(
    monkeypatch, mock_header_data
) -> None:
    """
    No-regression guard: a target that fails twice (500) then succeeds on the
    3rd attempt — cumulative elapsed well under ``max_time`` — still succeeds.
    Confirms ``max_time=120`` is not set so low that it abandons a target that
    recovers within the normal retry window.
    """
    webhook_notification = _make_webhook(mock_header_data)
    post_calls: list[int] = []

    class _OkResponse:
        status_code = 200
        text = ""

    def fake_post(*args, **kwargs):
        post_calls.append(1)
        if len(post_calls) < 3:
            return _MockServerErrorResponse()
        return _OkResponse()

    monkeypatch.setattr(
        "superset.reports.notifications.webhook.current_app", _allow_internal_app()
    )
    monkeypatch.setattr(
        "superset.reports.notifications.webhook.feature_flag_manager.is_feature_enabled",
        lambda flag: True,
    )
    monkeypatch.setattr(
        "superset.reports.notifications.webhook.requests.post", fake_post
    )
    monkeypatch.setattr("backoff._sync.time.sleep", lambda *a, **k: None)
    monkeypatch.setattr("backoff._sync.datetime", _FakeBackoffDatetime(10))

    webhook_notification.send()

    assert len(post_calls) == 3
