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
"""Notification contract tests that run without the optional Microsoft SDK."""

from collections.abc import Iterator
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from flask import Flask
from sqlalchemy.exc import SQLAlchemyError

from superset.integrations.teams import validation
from superset.reports.models import ReportRecipients, ReportRecipientType
from superset.reports.notifications import create_notification, teams
from superset.reports.notifications.base import NotificationContent
from superset.reports.notifications.exceptions import (
    NotificationAuthorizationException,
    NotificationError,
    NotificationParamException,
)
from superset.reports.notifications.teams import _send_to_teams
from superset.utils import json


@pytest.fixture
def notification(monkeypatch: pytest.MonkeyPatch) -> Iterator[SimpleNamespace]:
    """Keep the transport replaceable while exercising real recipient validation."""
    app = Flask(__name__)
    app.config["ALERT_REPORTS_TEAMS"] = {
        "tenant_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "application_id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        "credential": "server-only-credential",
        "destinations": [
            {
                "key": "ops",
                "label": "Operations",
                "team_id": "team-1",
                "channel_id": "channel-1",
            }
        ],
    }
    monkeypatch.setattr(
        validation.feature_flag_manager, "is_feature_enabled", lambda _: True
    )
    session = MagicMock()
    monkeypatch.setattr(teams, "db", SimpleNamespace(engine=object()))
    monkeypatch.setattr(teams, "Session", session)
    store = MagicMock()
    store.return_value.get_active.return_value = SimpleNamespace(
        service_url="https://smba.trafficmanager.net/amer/"
    )
    monkeypatch.setattr(teams, "TeamsInstallationStore", store)
    send = MagicMock()
    monkeypatch.setattr(teams, "_send_to_teams", send)
    content = NotificationContent(
        name='Revenue "quoted"\n東京 🚨',
        description="Café\nsecond line",
        header_data={
            "notification_type": "Alert",
            "notification_format": "NONE",
            "editors": [],
            "notification_source": None,
            "chart_id": None,
            "dashboard_id": None,
            "slack_channels": None,
            "execution_id": None,
        },
        url="https://superset.example/chart/42/",
    )
    recipient = ReportRecipients(
        type=ReportRecipientType.TEAMS, recipient_config_json='{"target":"ops"}'
    )
    with app.app_context():
        yield SimpleNamespace(
            app=app,
            content=content,
            recipient=recipient,
            store=store,
            session=session,
            send=send,
        )


def test_factory_delivery_uses_server_config_and_closes_session(
    notification: SimpleNamespace,
) -> None:
    """A destination key resolves on the server and database work ends before send."""

    def check_closed(*_: object, **kwargs: object) -> None:
        notification.session.return_value.__exit__.assert_called_once()

    notification.content.delivery_deadline = 123.0
    notification.send.side_effect = check_closed
    handler = create_notification(notification.recipient, notification.content)
    assert isinstance(handler, teams.TeamsNotification)
    handler.send()
    config, destination, service_url, card = notification.send.call_args.args
    assert notification.send.call_args.kwargs == {"retry_deadline": 123.0}
    assert config.credential == "server-only-credential"
    assert destination.key == "ops"
    assert service_url == "https://smba.trafficmanager.net/amer/"
    assert json.loads(json.dumps(card))["body"][0]["text"] == notification.content.name
    assert card["body"][1]["text"] == notification.content.description
    assert card["actions"][0]["url"] == notification.content.url
    assert "server-only-credential" not in json.dumps(card)
    assert json.loads(notification.recipient.recipient_config_json) == {"target": "ops"}


@pytest.mark.parametrize(
    "field,value",
    [
        ("csv", b"csv"),
        ("xlsx", b"xlsx"),
        ("pdf", b"pdf"),
        ("screenshots", [b"png"]),
        ("embedded_data", []),
        ("is_editor_error", True),
    ],
)
def test_rejects_attachments_and_editor_diagnostics(
    notification: SimpleNamespace, field: str, value: object
) -> None:
    """Excluded content fails before accessing installations or the transport."""
    setattr(notification.content, field, value)
    with pytest.raises(NotificationParamException):
        teams.TeamsNotification(notification.recipient, notification.content).send()
    notification.store.assert_not_called()
    notification.send.assert_not_called()


@pytest.mark.parametrize(
    "change", ["disabled", "unconfigured", "removed", "report", "attachment"]
)
def test_saved_recipient_is_revalidated_at_delivery(
    notification: SimpleNamespace, monkeypatch: pytest.MonkeyPatch, change: str
) -> None:
    """Previously saved recipients cannot bypass deployment or schedule changes."""
    handler = teams.TeamsNotification(notification.recipient, notification.content)
    if change == "disabled":
        monkeypatch.setattr(
            validation.feature_flag_manager, "is_feature_enabled", lambda _: False
        )
    elif change == "unconfigured":
        notification.app.config["ALERT_REPORTS_TEAMS"] = {}
    elif change == "removed":
        notification.app.config["ALERT_REPORTS_TEAMS"]["destinations"][0]["key"] = (
            "replacement"
        )
    elif change == "report":
        notification.content.header_data["notification_type"] = "Report"
    else:
        notification.content.header_data["notification_format"] = "PNG"
    with pytest.raises(NotificationParamException):
        handler.send()
    notification.store.assert_not_called()
    notification.send.assert_not_called()


def test_missing_active_installation_prevents_transport(
    notification: SimpleNamespace,
) -> None:
    """Saving without installation is allowed; sending without one is not."""
    notification.store.return_value.get_active.return_value = None
    with pytest.raises(
        NotificationAuthorizationException, match="No active Teams bot installation"
    ):
        teams.TeamsNotification(notification.recipient, notification.content).send()
    notification.session.return_value.__exit__.assert_called_once()
    notification.send.assert_not_called()


def test_sql_error_is_sanitized_before_leaving_notification(
    notification: SimpleNamespace,
) -> None:
    """Neither channel content nor the outward exception includes SQL diagnostics."""
    notification.store.return_value.get_active.side_effect = SQLAlchemyError(
        "SELECT password FROM secret_table"
    )
    with pytest.raises(
        NotificationError, match="^Unable to resolve Teams bot installation$"
    ) as error:
        teams.TeamsNotification(notification.recipient, notification.content).send()
    assert error.value.__suppress_context__
    notification.send.assert_not_called()


@pytest.mark.parametrize(
    "include_cta,url",
    [
        (False, "https://superset.example"),
        (True, None),
        (True, "javascript:alert(1)"),
        (True, "https://[invalid"),
    ],
)
def test_card_omits_disabled_or_invalid_link(
    notification: SimpleNamespace, include_cta: bool, url: str | None
) -> None:
    """Link opt-out and malformed URLs never create card actions."""
    notification.content.include_cta = include_cta
    notification.content.url = url
    assert "actions" not in teams.build_teams_card(notification.content)


def test_card_omits_empty_description_and_hides_execution_error(
    notification: SimpleNamespace,
) -> None:
    """Only a generic failure notice is posted for internal execution errors."""
    notification.content.description = None
    notification.content.text = (
        "SELECT password FROM secret_table; database://credential"
    )
    card = teams.build_teams_card(notification.content)
    assert len(card["body"]) == 2
    assert (
        card["body"][1]["text"]
        == "Alert execution failed. Contact the alert owner for details."
    )
    assert "secret_table" not in json.dumps(card)
    assert "credential" not in json.dumps(card)


def test_delivery_still_reports_missing_sdk(
    notification: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Previously saved recipients retain the lazy delivery-time dependency error."""
    monkeypatch.setattr(teams, "_send_to_teams", _send_to_teams)
    with patch.dict("sys.modules", {"superset.integrations.teams.adapter": None}):
        with pytest.raises(
            NotificationParamException, match="^Teams SDK is not installed$"
        ):
            teams.TeamsNotification(notification.recipient, notification.content).send()
    notification.session.return_value.__exit__.assert_called_once()
