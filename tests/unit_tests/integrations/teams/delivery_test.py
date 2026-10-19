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
"""Teams notification formatting, resolution, retry, and SDK delivery tests."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Iterator
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from email.utils import format_datetime
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock

import httpx
import pytest
import requests
from flask import current_app, Flask
from sqlalchemy import create_engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from superset.integrations.teams.config import (
    parse_teams_config,
    TeamsConfig,
    TeamsDestination,
)
from superset.integrations.teams.models import TeamsInstallation
from superset.integrations.teams.store import TeamsInstallationStore
from superset.reports.models import ReportRecipients, ReportRecipientType
from superset.reports.notifications import create_notification, teams as notifications
from superset.reports.notifications.base import NotificationContent
from superset.reports.notifications.exceptions import (
    NotificationAuthorizationException,
    NotificationError,
    NotificationParamException,
    NotificationTransientError,
)
from superset.utils import json

adapter = pytest.importorskip(
    "superset.integrations.teams.adapter", exc_type=ImportError
)
TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
APPLICATION = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
SERVICE_URL = "https://smba.trafficmanager.net/amer/"


@pytest.fixture
def deployment() -> dict[str, Any]:
    """Return the server-only identity and destination allowlist."""
    return {
        "tenant_id": TENANT,
        "application_id": APPLICATION,
        "credential": "server-only-secret",
        "destinations": [
            {
                "key": "ops",
                "label": "Operations",
                "team_id": "team-1",
                "channel_id": "channel-1",
            }
        ],
    }


@pytest.fixture
def configured(deployment: dict[str, Any]) -> TeamsConfig:
    """Parse the same deployment configuration used by real notifications."""
    config = parse_teams_config(deployment)
    assert config is not None
    return config


@pytest.fixture
def content() -> NotificationContent:
    """Include difficult text to verify normal structured JSON serialization."""
    return NotificationContent(
        name='Alert "Revenue"\nCafé 東京 🚨',
        description='Description "quoted"\n第二行',
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


@pytest.fixture
def notification_context(
    deployment: dict[str, Any],
    monkeypatch: pytest.MonkeyPatch,
) -> Iterator[SimpleNamespace]:
    """Use the real installation table and resolve through the notification class."""
    app = Flask(__name__)
    app.config.update(
        ALERT_REPORTS_TEAMS=deployment, FEATURE_FLAGS={"ALERT_REPORT_TEAMS": True}
    )
    engine = create_engine("sqlite://")
    TeamsInstallation.__table__.create(engine)
    with Session(engine) as session:
        TeamsInstallationStore(session).install(
            TENANT, APPLICATION, "team-1", SERVICE_URL
        )
        session.commit()
    monkeypatch.setattr(notifications, "db", SimpleNamespace(engine=engine))
    monkeypatch.setattr(
        notifications.feature_flag_manager,
        "is_feature_enabled",
        lambda name: current_app.config["FEATURE_FLAGS"].get(name, False),
    )
    send = MagicMock()
    monkeypatch.setattr(notifications, "_send_to_teams", send)
    try:
        with app.app_context():
            yield SimpleNamespace(app=app, engine=engine, send=send)
    finally:
        engine.dispose()


def recipient(target: str = "ops") -> ReportRecipients:
    """Recipients store only a configured destination key."""
    return ReportRecipients(
        type=ReportRecipientType.TEAMS,
        recipient_config_json=json.dumps({"target": target}),
    )


def test_factory_resolves_active_installation_and_formats_card(
    notification_context: SimpleNamespace,
    content: NotificationContent,
) -> None:
    notification = create_notification(recipient(), content)
    assert isinstance(notification, notifications.TeamsNotification)
    notification.send()
    config, destination, service_url, card = notification_context.send.call_args.args
    assert config.credential == "server-only-secret"
    assert destination.key == "ops"
    assert destination.channel_id == "channel-1"
    assert service_url == SERVICE_URL
    assert card["body"][0]["text"] == content.name
    assert card["body"][1]["text"] == content.description
    assert card["actions"][0]["url"] == content.url
    assert "server-only-secret" not in json.dumps(card)


@pytest.mark.parametrize(
    "include_cta,url",
    [
        (False, "https://superset.example"),
        (True, None),
        (True, "javascript:alert(1)"),
        (True, "https://[invalid"),
    ],
)
def test_optional_link_respects_existing_setting(
    content: NotificationContent, include_cta: bool, url: str | None
) -> None:
    content.include_cta, content.url = include_cta, url
    assert "actions" not in notifications.build_teams_card(content)


def test_optional_description_and_diagnostics(content: NotificationContent) -> None:
    content.description = None
    content.text = (
        'SQL failed: SELECT "password" FROM internal_table; database://secret'
    )
    card = notifications.build_teams_card(content)
    assert len(card["body"]) == 2
    assert (
        card["body"][1]["text"]
        == "Alert execution failed. Contact the alert owner for details."
    )
    serialized = json.dumps(card)
    assert "password" not in serialized
    assert "internal_table" not in serialized
    assert "database://secret" not in serialized


def test_card_json_round_trip_preserves_quotes_newlines_and_unicode(
    content: NotificationContent,
) -> None:
    card = notifications.build_teams_card(content)
    decoded = json.loads(json.dumps(card))
    assert decoded["body"][0]["text"] == content.name
    assert decoded["body"][1]["text"] == content.description


@pytest.mark.parametrize(
    "target", ["unapproved", "https://example.com", "", None, ["ops"]]
)
def test_recipient_target_is_a_destination_key(
    notification_context: SimpleNamespace,
    content: NotificationContent,
    target: Any,
) -> None:
    entry = recipient()
    entry.recipient_config_json = json.dumps({"target": target})
    with pytest.raises(NotificationParamException):
        notifications.TeamsNotification(entry, content).send()
    notification_context.send.assert_not_called()


@pytest.mark.parametrize(
    "raw",
    [
        "{",
        "[]",
        "{}",
        '{"target":"ops","credential":"secret"}',
        '{"target":"ops","channel_id":"override"}',
    ],
)
def test_invalid_recipient_json_is_rejected(
    notification_context: SimpleNamespace, content: NotificationContent, raw: str
) -> None:
    entry = recipient()
    entry.recipient_config_json = raw
    with pytest.raises(NotificationParamException):
        notifications.TeamsNotification(entry, content).send()
    notification_context.send.assert_not_called()


@pytest.mark.parametrize(
    "mode", ["inactive", "missing", "other-tenant", "other-application"]
)
def test_installation_must_be_active_for_exact_identity(
    notification_context: SimpleNamespace,
    content: NotificationContent,
    mode: str,
) -> None:
    with Session(notification_context.engine) as session:
        store = TeamsInstallationStore(session)
        if mode == "inactive":
            store.remove(TENANT, APPLICATION, "team-1")
        else:
            session.query(TeamsInstallation).delete()
            other = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
            if mode != "missing":
                store.install(
                    other if mode == "other-tenant" else TENANT,
                    other if mode == "other-application" else APPLICATION,
                    "team-1",
                    SERVICE_URL,
                )
        session.commit()
    with pytest.raises(NotificationAuthorizationException):
        notifications.TeamsNotification(recipient(), content).send()
    notification_context.send.assert_not_called()


@pytest.mark.parametrize(
    "mode",
    [
        "disabled",
        "unconfigured",
        "report",
        "editor-diagnostic",
        "csv",
        "xlsx",
        "pdf",
        "screenshots",
        "embedded_data",
    ],
)
def test_out_of_scope_delivery_is_rejected(
    notification_context: SimpleNamespace, content: NotificationContent, mode: str
) -> None:
    if mode == "disabled":
        notification_context.app.config["FEATURE_FLAGS"]["ALERT_REPORT_TEAMS"] = False
    elif mode == "unconfigured":
        notification_context.app.config["ALERT_REPORTS_TEAMS"] = {}
    elif mode == "report":
        content.header_data["notification_type"] = "Report"
    elif mode == "editor-diagnostic":
        content.is_editor_error = True
    else:
        setattr(content, mode, [b"file"] if mode == "screenshots" else b"file")
    with pytest.raises(NotificationParamException):
        notifications.TeamsNotification(recipient(), content).send()
    notification_context.send.assert_not_called()


def test_database_errors_are_sanitized(
    notification_context: SimpleNamespace,
    content: NotificationContent,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        TeamsInstallationStore,
        "get_active",
        MagicMock(side_effect=SQLAlchemyError("SELECT password FROM internal_table")),
    )
    with pytest.raises(NotificationError) as exc:
        notifications.TeamsNotification(recipient(), content).send()
    assert "internal_table" not in str(exc.value)
    assert exc.value.__cause__ is None
    notification_context.send.assert_not_called()


class FakeTransport:
    """Deterministic replaceable transport for bounded retry policy tests."""

    def __init__(self, errors: list[Exception | None]) -> None:
        """Consume one outcome for each root post attempt."""
        self.errors = iter(errors)
        self.posts: list[tuple[TeamsDestination, dict[str, Any]]] = []
        self.refreshes = 0
        self.closed = False
        self.loop: asyncio.AbstractEventLoop | None = None

    async def post_root(
        self, destination: TeamsDestination, card: dict[str, Any]
    ) -> None:
        """Record every fresh root-post attempt."""
        self.posts.append((destination, card))
        error = next(self.errors)
        if error:
            raise error

    async def refresh_auth(self) -> None:
        """Record a cache invalidation without contacting Entra."""
        self.refreshes += 1

    @asynccontextmanager
    async def factory(
        self, config: TeamsConfig, service_url: str, deadline: float
    ) -> AsyncIterator[FakeTransport]:
        """Track operation cleanup on both successful and failed delivery."""
        self.loop = asyncio.get_running_loop()
        try:
            yield self
        finally:
            self.closed = True


@pytest.fixture
def retry_clock(monkeypatch: pytest.MonkeyPatch) -> list[float]:
    """Advance retry time without actually sleeping."""
    elapsed = [0.0]
    sleeps: list[float] = []
    monkeypatch.setattr(adapter, "monotonic", lambda: elapsed[0])

    async def sleep(delay: float) -> None:
        """Advance the same clock used by the retry budget."""
        elapsed[0] += delay
        sleeps.append(delay)

    monkeypatch.setattr(adapter.asyncio, "sleep", sleep)
    return sleeps


@pytest.mark.parametrize("status", [None, 408, 429, 500, 502, 503, 504])
def test_transient_failures_retry_with_bounded_attempts(
    configured: TeamsConfig, retry_clock: list[float], status: int | None
) -> None:
    transport = FakeTransport([adapter.TeamsTransportError(status)] * 4)
    with pytest.raises(adapter.TeamsDeliveryError) as exc:
        adapter.deliver_teams_alert(
            configured,
            configured.destinations[0],
            SERVICE_URL,
            {},
            transport_factory=transport.factory,
        )
    assert exc.value.category == "transient"
    assert len(transport.posts) == 4
    assert retry_clock == [1.0, 2.0, 4.0]
    assert transport.closed
    assert transport.loop is not None
    assert transport.loop.is_closed()


@pytest.mark.parametrize(
    "headers,expected",
    [
        ({"Retry-After": "3"}, 3.0),
        ({"x-ms-retry-after-ms": "1500"}, 1.5),
        ({"Retry-After": "2", "x-ms-retry-after-ms": "3000"}, 3.0),
        ({"Retry-After": "invalid"}, 1.0),
    ],
)
def test_microsoft_retry_delays_are_respected(
    configured: TeamsConfig,
    retry_clock: list[float],
    headers: dict[str, str],
    expected: float,
) -> None:
    transport = FakeTransport(
        [adapter.TeamsTransportError(429, httpx.Headers(headers)), None]
    )
    adapter.deliver_teams_alert(
        configured,
        configured.destinations[0],
        SERVICE_URL,
        {},
        transport_factory=transport.factory,
    )
    assert retry_clock == [expected]
    assert len(transport.posts) == 2
    assert transport.closed


def test_retry_after_http_date() -> None:
    retry_at = datetime.now(timezone.utc) + timedelta(seconds=5)
    error = adapter.TeamsTransportError(
        429, httpx.Headers({"Retry-After": format_datetime(retry_at, usegmt=True)})
    )
    assert 3.0 <= adapter._retry_delay(error, 0) <= 5.0


def test_excessive_server_delay_is_not_shortened(
    configured: TeamsConfig, retry_clock: list[float]
) -> None:
    transport = FakeTransport(
        [adapter.TeamsTransportError(429, httpx.Headers({"Retry-After": "120"}))]
    )
    with pytest.raises(adapter.TeamsDeliveryError) as exc:
        adapter.deliver_teams_alert(
            configured,
            configured.destinations[0],
            SERVICE_URL,
            {},
            transport_factory=transport.factory,
        )
    assert exc.value.category == "transient"
    assert len(transport.posts) == 1
    assert retry_clock == []
    assert transport.closed


@pytest.mark.parametrize(
    "outcomes,category,posts,refreshes",
    [
        ([401, None], None, 2, 1),
        ([401, 401], "authorization", 2, 1),
        ([403], "authorization", 1, 0),
        ([400], "parameter", 1, 0),
        ([404], "parameter", 1, 0),
        ([302], "parameter", 1, 0),
        ([401, 503, 503, None], None, 4, 1),
    ],
)
def test_one_authentication_refresh_and_permanent_errors(
    configured: TeamsConfig,
    retry_clock: list[float],
    outcomes: list[int | None],
    category: str | None,
    posts: int,
    refreshes: int,
) -> None:
    transport = FakeTransport(
        [adapter.TeamsTransportError(status) if status else None for status in outcomes]
    )
    if category:
        with pytest.raises(adapter.TeamsDeliveryError) as exc:
            adapter.deliver_teams_alert(
                configured,
                configured.destinations[0],
                SERVICE_URL,
                {},
                transport_factory=transport.factory,
            )
        assert exc.value.category == category
    else:
        adapter.deliver_teams_alert(
            configured,
            configured.destinations[0],
            SERVICE_URL,
            {},
            transport_factory=transport.factory,
        )
    assert len(transport.posts) == posts
    assert transport.refreshes == refreshes
    assert transport.closed
    assert transport.loop is not None
    assert transport.loop.is_closed()


@pytest.mark.parametrize(
    "category,exception",
    [
        ("authorization", NotificationAuthorizationException),
        ("transient", NotificationTransientError),
        ("parameter", NotificationParamException),
    ],
)
def test_transport_errors_map_to_existing_notification_exceptions(
    configured: TeamsConfig,
    monkeypatch: pytest.MonkeyPatch,
    category: str,
    exception: type[Exception],
) -> None:
    monkeypatch.setattr(
        adapter,
        "deliver_teams_alert",
        MagicMock(side_effect=adapter.TeamsDeliveryError(category)),
    )
    with pytest.raises(exception) as exc:
        notifications._send_to_teams(
            configured, configured.destinations[0], SERVICE_URL, {}
        )
    assert exc.value.__cause__ is None


def _sdk_post_response(status: int) -> httpx.Response:
    """Script a successful root, malformed success, or failing connector response."""
    if status == 201:
        return httpx.Response(
            status, json={"id": "new-thread", "activityId": "root-message"}
        )
    if status == 299:
        return httpx.Response(201, json={"malformed": "success response"})
    return httpx.Response(
        status, headers={"Retry-After": "2"}, json={"error": "secret SQL diagnostic"}
    )


@pytest.fixture
def sdk_network(
    monkeypatch: pytest.MonkeyPatch, retry_clock: list[float]
) -> SimpleNamespace:
    """Run real MSAL and SDK serializers against offline HTTP endpoints."""
    state = SimpleNamespace(
        posts=[],
        tokens=0,
        oauth_responses=[],
        auth_sessions=[],
        clients=[],
        statuses=[],
        oauth_error=None,
    )

    class TrackedResponse(requests.Response):
        """Track closure of metadata and token HTTP responses."""

        closed = False

        def close(self) -> None:
            """Record deterministic cleanup even on OAuth failures."""
            super().close()
            self.closed = True

    class AuthSession(requests.Session):
        """Provide real requests response objects to MSAL's HTTP contract."""

        closed = False

        def __init__(self) -> None:
            """Record operation-owned sessions."""
            super().__init__()
            state.auth_sessions.append(self)

        def request(
            self, method: Any, url: Any, *args: Any, **kwargs: Any
        ) -> requests.Response:
            """Answer only known Microsoft metadata and client-credential calls."""
            assert 0 < kwargs["timeout"] <= 10
            response = TrackedResponse()
            response.status_code = 200
            response.url = url
            if method == "GET":
                assert (
                    url
                    == f"https://login.microsoftonline.com/{TENANT}/v2.0/.well-known/openid-configuration"
                )
                data: dict[str, Any] = {
                    "authorization_endpoint": f"https://login.microsoftonline.com/{TENANT}/oauth2/v2.0/authorize",
                    "token_endpoint": f"https://login.microsoftonline.com/{TENANT}/oauth2/v2.0/token",
                    "issuer": f"https://login.microsoftonline.com/{TENANT}/v2.0",
                }
            else:
                assert method == "POST"
                assert (
                    url
                    == f"https://login.microsoftonline.com/{TENANT}/oauth2/v2.0/token"
                )
                assert kwargs["data"]["grant_type"] == "client_credentials"
                assert (
                    kwargs["data"]["scope"] == "https://api.botframework.com/.default"
                )
                state.tokens += 1
                data = {
                    "access_token": f"token-{state.tokens}",
                    "token_type": "Bearer",
                    "expires_in": 3600,
                }
                if state.oauth_error:
                    response.status_code = 400
                    data = {
                        "error": "invalid_client",
                        "error_description": "secret SQL diagnostic",
                    }
            response._content = json.dumps(data).encode()
            _ = (
                response.content
            )  # Match requests' eager, non-streaming response behavior.
            state.oauth_responses.append(response)
            return response

        def close(self) -> None:
            """Close MSAL's caller-provided session."""
            super().close()
            self.closed = True

    def receive(request: httpx.Request) -> httpx.Response:
        """Inspect the actual SDK wire request and supply scripted statuses."""
        assert request.method == "POST"
        assert str(request.url) == SERVICE_URL.rstrip("/") + "/v3/conversations"
        state.posts.append((request, json.loads(request.content)))
        status = state.statuses.pop(0) if state.statuses else 201
        return _sdk_post_response(status)

    class SDKHttpClient(httpx.AsyncClient):
        """Use httpx's real serialization, response handling, and client lifecycle."""

        def __init__(self, **kwargs: Any) -> None:
            """Replace only external I/O with a deterministic mock transport."""
            kwargs["transport"] = httpx.MockTransport(receive)
            super().__init__(**kwargs)
            state.clients.append(self)

    monkeypatch.setattr(adapter.requests, "Session", AuthSession)
    monkeypatch.setattr(adapter.httpx, "AsyncClient", SDKHttpClient)
    return state


def assert_resources_closed(network: SimpleNamespace) -> None:
    """Verify all resources created by real SDK/MSAL calls are closed."""
    assert network.clients
    assert all(client.is_closed for client in network.clients)
    assert network.auth_sessions
    assert all(session.closed for session in network.auth_sessions)
    assert network.oauth_responses
    assert all(response.closed for response in network.oauth_responses)


def test_real_sdk_creates_fresh_channel_root_for_every_notification(
    sdk_network: SimpleNamespace,
    configured: TeamsConfig,
    content: NotificationContent,
) -> None:
    card = notifications.build_teams_card(content)
    for _ in range(2):
        adapter.deliver_teams_alert(
            configured, configured.destinations[0], SERVICE_URL, card
        )
    assert len(sdk_network.posts) == 2
    for request, payload in sdk_network.posts:
        assert request.headers["Authorization"].startswith("Bearer token-")
        assert payload["isGroup"] is True
        assert payload["tenantId"] == TENANT
        assert payload["channelData"]["channel"]["id"] == "channel-1"
        assert payload["channelData"]["team"]["id"] == "team-1"
        assert "replyToId" not in payload["activity"]
        assert "conversation" not in payload["activity"]
        assert payload["activity"]["attachments"] == [
            {"contentType": "application/vnd.microsoft.card.adaptive", "content": card}
        ]
        assert (
            payload["activity"]["attachments"][0]["content"]["body"][0]["text"]
            == content.name
        )
        assert "server-only-secret" not in request.content.decode()
    assert_resources_closed(sdk_network)


def test_real_sdk_refreshes_token_once_after_401(
    sdk_network: SimpleNamespace,
    configured: TeamsConfig,
    retry_clock: list[float],
) -> None:
    sdk_network.statuses = [429, 401, 201]
    adapter.deliver_teams_alert(configured, configured.destinations[0], SERVICE_URL, {})
    assert sdk_network.tokens == 2
    assert [request.headers["Authorization"] for request, _ in sdk_network.posts] == [
        "Bearer token-1",
        "Bearer token-1",
        "Bearer token-2",
    ]
    assert retry_clock == [2.0]
    assert_resources_closed(sdk_network)


@pytest.mark.parametrize(
    "statuses,oauth_error,category,posts",
    [
        ([401, 401], None, "authorization", 2),
        ([503, 503, 503, 503], None, "transient", 4),
        ([400], None, "parameter", 1),
        ([299], None, "parameter", 1),
        ([], True, "authorization", 0),
    ],
)
def test_real_sdk_failures_close_resources_and_sanitize_errors(
    sdk_network: SimpleNamespace,
    configured: TeamsConfig,
    statuses: list[int],
    oauth_error: bool | None,
    category: str,
    posts: int,
) -> None:
    sdk_network.statuses = statuses
    sdk_network.oauth_error = oauth_error
    with pytest.raises(adapter.TeamsDeliveryError) as exc:
        adapter.deliver_teams_alert(
            configured, configured.destinations[0], SERVICE_URL, {}
        )
    assert exc.value.category == category
    assert "secret SQL diagnostic" not in str(exc.value)
    assert "server-only-secret" not in str(exc.value)
    assert len(sdk_network.posts) == posts
    assert_resources_closed(sdk_network)


def test_auth_http_closes_response_and_preserves_retry_delay(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    response = MagicMock(spec=requests.Response)
    response.status_code = 429
    response.headers = requests.structures.CaseInsensitiveDict({"Retry-After": "7"})
    session = MagicMock(spec=requests.Session)
    session.request.return_value = response
    monkeypatch.setattr(adapter, "monotonic", lambda: 0)
    http = adapter._AuthHttpClient(session, 60)
    with pytest.raises(adapter.TeamsTransportError) as exc:
        http.post("https://login.microsoftonline.com/token")
    assert exc.value.retry_after == "7"
    response.close.assert_called_once()
    assert session.request.call_args.kwargs["timeout"] == 10
