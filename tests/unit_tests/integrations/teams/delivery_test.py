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
import importlib
import importlib.util
import threading
import time
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
from billiard.exceptions import SoftTimeLimitExceeded
from flask import current_app, Flask
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from superset.integrations.teams import validation as teams_validation
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
    NotificationParamException,
    NotificationTransientError,
)
from superset.utils import json

if importlib.util.find_spec("microsoft_teams") is None:
    pytest.skip("Optional Teams SDK is not installed", allow_module_level=True)

adapter = importlib.import_module("superset.integrations.teams.adapter")
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
        teams_validation.feature_flag_manager,
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


@pytest.mark.parametrize(
    "mode", ["removed-destination", "disabled", "report", "attachments"]
)
def test_saved_notification_rechecks_changes_before_touching_installations(
    notification_context: SimpleNamespace,
    content: NotificationContent,
    monkeypatch: pytest.MonkeyPatch,
    mode: str,
) -> None:
    entry = recipient()
    saved_json = entry.recipient_config_json
    notification = notifications.TeamsNotification(entry, content)
    if mode == "removed-destination":
        notification_context.app.config["ALERT_REPORTS_TEAMS"]["destinations"][0][
            "key"
        ] = "changed"
    elif mode == "disabled":
        notification_context.app.config["FEATURE_FLAGS"]["ALERT_REPORT_TEAMS"] = False
    elif mode == "report":
        content.header_data["notification_type"] = "Report"
    else:
        content.header_data["notification_format"] = "PNG"
    lookup = MagicMock()
    monkeypatch.setattr(TeamsInstallationStore, "get_active", lookup)
    with pytest.raises(NotificationParamException):
        notification.send()
    lookup.assert_not_called()
    notification_context.send.assert_not_called()
    assert entry.recipient_config_json == saved_json


@pytest.mark.parametrize("phase", ["metadata", "token"])
def test_real_msal_requests_timeout_and_close_resources(
    configured: TeamsConfig,
    sdk_network: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
    phase: str,
) -> None:
    """A stalled OAuth endpoint is bounded by requests, without an async timer."""
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

    release = threading.Event()

    class StalledEndpoint(BaseHTTPRequestHandler):
        """Accept a connection but withhold the response until teardown."""

        def do_GET(self) -> None:  # noqa: N802
            """Stall either metadata discovery or token acquisition."""
            release.wait(2)

        do_POST = do_GET  # noqa: N815

        def log_message(self, format: str, *args: Any) -> None:
            """Suppress test server access logs."""

    server = ThreadingHTTPServer(("127.0.0.1", 0), StalledEndpoint)
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    session_type = adapter.requests.Session
    request = session_type.request
    real_request = requests.sessions.Session.request
    timeouts: list[float] = []

    def stalled_request(
        self: requests.Session, method: str, url: str, **kwargs: Any
    ) -> requests.Response:
        """Use real socket I/O for the chosen OAuth phase only."""
        if (phase == "metadata" and method == "GET") or (
            phase == "token" and method == "POST"
        ):
            timeouts.append(kwargs["timeout"])
            self.trust_env = False
            return real_request(
                self, method, f"http://127.0.0.1:{server.server_port}/", **kwargs
            )
        return request(self, method, url, **kwargs)

    monkeypatch.setattr(session_type, "request", stalled_request)
    monkeypatch.setattr(adapter, "monotonic", time.monotonic)
    monkeypatch.setattr(adapter, "_DELIVERY_TIMEOUT", 0.15)
    try:
        started = time.monotonic()
        with pytest.raises(adapter.TeamsDeliveryError, match="temporarily unavailable"):
            adapter.deliver_teams_alert(
                configured, configured.destinations[0], SERVICE_URL, {}
            )
        assert time.monotonic() - started < 1
        assert len(timeouts) == 1
        assert 0 < timeouts[0] <= 0.15
        assert sdk_network.posts == []
        assert all(session.closed for session in sdk_network.auth_sessions)
        assert all(client.is_closed for client in sdk_network.clients)
        assert all(response.closed for response in sdk_network.oauth_responses)
    finally:
        release.set()
        server.shutdown()
        server.server_close()
        worker.join(timeout=1)


@pytest.mark.parametrize("phase", ["construction", "post", "refresh", "cleanup"])
def test_celery_soft_timeout_propagates_after_cleanup(
    configured: TeamsConfig,
    monkeypatch: pytest.MonkeyPatch,
    phase: str,
) -> None:
    """The existing task handler receives soft limits without transport retries."""
    transport = FakeTransport(
        [adapter.TeamsTransportError(401)] if phase == "refresh" else [None]
    )
    closed: list[bool] = []
    soft_timeout = SoftTimeLimitExceeded()

    async def interrupt(*args: Any) -> None:
        raise soft_timeout

    if phase == "post":
        monkeypatch.setattr(transport, "post_root", interrupt)
    if phase == "refresh":
        monkeypatch.setattr(transport, "refresh_auth", interrupt)

    @asynccontextmanager
    async def factory(*args: Any) -> AsyncIterator[FakeTransport]:
        try:
            if phase == "construction":
                raise soft_timeout
            yield transport
        finally:
            closed.append(True)
            if phase == "cleanup":
                raise soft_timeout

    with pytest.raises(SoftTimeLimitExceeded) as error:
        adapter.deliver_teams_alert(
            configured,
            configured.destinations[0],
            SERVICE_URL,
            {},
            transport_factory=factory,
        )
    assert error.value is soft_timeout
    assert closed == [True]
    assert len(transport.posts) <= 1


@pytest.mark.parametrize("phase", ["construction", "post", "cleanup"])
def test_elapsed_work_and_cleanup_do_not_report_success_after_deadline(
    configured: TeamsConfig,
    monkeypatch: pytest.MonkeyPatch,
    phase: str,
) -> None:
    """Every phase shares the caller's deadline, including successful teardown."""
    clock = [0.0]
    monkeypatch.setattr(adapter, "monotonic", lambda: clock[0])
    transport = FakeTransport([None])
    post = transport.post_root

    async def post_root(*args: Any) -> None:
        await post(*args)
        if phase == "post":
            clock[0] = 3.0

    monkeypatch.setattr(transport, "post_root", post_root)

    @asynccontextmanager
    async def factory(*args: Any) -> AsyncIterator[FakeTransport]:
        assert args[2] == 2.0
        transport.loop = asyncio.get_running_loop()
        try:
            if phase == "construction":
                clock[0] = 3.0
            yield transport
        finally:
            transport.closed = True
            if phase == "cleanup":
                clock[0] = 3.0

    with pytest.raises(adapter.TeamsDeliveryError, match="temporarily unavailable"):
        adapter.deliver_teams_alert(
            configured,
            configured.destinations[0],
            SERVICE_URL,
            {},
            retry_deadline=2.0,
            transport_factory=factory,
        )
    assert transport.closed
    assert len(transport.posts) == (0 if phase == "construction" else 1)
    assert transport.loop is not None
    assert transport.loop.is_closed()


def test_expired_execution_budget_does_not_open_transport(
    configured: TeamsConfig,
) -> None:
    """An exhausted report deadline cannot start a new 60-second Teams budget."""
    factory = MagicMock()
    with pytest.raises(adapter.TeamsDeliveryError):
        adapter.deliver_teams_alert(
            configured,
            configured.destinations[0],
            SERVICE_URL,
            {},
            retry_deadline=time.monotonic() - 1,
            transport_factory=factory,
        )
    factory.assert_not_called()


def test_retry_after_uses_remaining_execution_budget(
    configured: TeamsConfig, retry_clock: list[float]
) -> None:
    """Neither a refresh nor Retry-After creates another delivery allowance."""
    transport = FakeTransport(
        [
            adapter.TeamsTransportError(401),
            adapter.TeamsTransportError(429, httpx.Headers({"Retry-After": "2"})),
            adapter.TeamsTransportError(503, httpx.Headers({"Retry-After": "2"})),
        ]
    )
    with pytest.raises(adapter.TeamsDeliveryError):
        adapter.deliver_teams_alert(
            configured,
            configured.destinations[0],
            SERVICE_URL,
            {},
            retry_deadline=3.0,
            transport_factory=transport.factory,
        )
    assert transport.refreshes == 1
    assert len(transport.posts) == 3
    assert retry_clock == [2.0]
    assert transport.closed


def test_expired_oauth_response_closes_before_returning_token(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A synchronous response arriving after budget cannot proceed to a post."""
    clock = [0.0]
    monkeypatch.setattr(adapter, "monotonic", lambda: clock[0])
    response = MagicMock(spec=requests.Response)
    session = MagicMock(spec=requests.Session)

    def receive(*args: Any, **kwargs: Any) -> requests.Response:
        clock[0] = 3.0
        return response

    session.request.side_effect = receive
    with pytest.raises(adapter.TeamsTransportError):
        adapter._AuthHttpClient(session, 2.0).post(
            "https://login.microsoftonline.com/token"
        )
    response.close.assert_called_once()
    assert session.request.call_args.kwargs["timeout"] == 2.0


@pytest.mark.parametrize("phase", ["metadata", "token"])
def test_celery_soft_timeout_during_real_msal_acquisition_is_not_retried(
    configured: TeamsConfig,
    sdk_network: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
    phase: str,
) -> None:
    """A task timeout during synchronous OAuth reaches the scheduler unchanged."""
    session_type = adapter.requests.Session
    request = session_type.request
    error = SoftTimeLimitExceeded()

    def interrupted_request(
        self: requests.Session, method: str, url: str, **kwargs: Any
    ) -> requests.Response:
        if (phase == "metadata" and method == "GET") or (
            phase == "token" and method == "POST"
        ):
            raise error
        return request(self, method, url, **kwargs)

    monkeypatch.setattr(session_type, "request", interrupted_request)
    with pytest.raises(SoftTimeLimitExceeded) as caught:
        adapter.deliver_teams_alert(
            configured, configured.destinations[0], SERVICE_URL, {}
        )
    assert caught.value is error
    assert sdk_network.posts == []
    assert all(session.closed for session in sdk_network.auth_sessions)
    assert all(client.is_closed for client in sdk_network.clients)


def test_real_sdk_caps_metadata_token_and_post_to_one_deadline(
    configured: TeamsConfig,
    sdk_network: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Synchronous OAuth work reduces the remaining channel request timeout."""
    clock = [0.0]
    monkeypatch.setattr(adapter, "monotonic", lambda: clock[0])
    session_type = adapter.requests.Session
    request = session_type.request
    timeouts: list[float] = []

    def auth_request(
        self: requests.Session, method: str, url: str, **kwargs: Any
    ) -> requests.Response:
        timeouts.append(kwargs["timeout"])
        response = request(self, method, url, **kwargs)
        clock[0] += 1.0
        return response

    monkeypatch.setattr(session_type, "request", auth_request)
    adapter.deliver_teams_alert(
        configured, configured.destinations[0], SERVICE_URL, {}, retry_deadline=3.0
    )
    assert timeouts == [3.0, 2.0]
    request_sent, _ = sdk_network.posts[0]
    assert request_sent.extensions["timeout"] == {
        "connect": 1.0,
        "read": 1.0,
        "write": 1.0,
        "pool": 1.0,
    }
    assert_resources_closed(sdk_network)
