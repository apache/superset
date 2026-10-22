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
"""Exercise the real Teams SDK authentication boundary and Flask persistence."""

from __future__ import annotations

import asyncio
import importlib
import importlib.util
from collections.abc import Callable
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from typing import Any
from unittest.mock import patch

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from flask import current_app, Flask, Response
from flask.testing import FlaskClient
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from superset.integrations.teams import api as teams_api
from superset.integrations.teams.config import parse_teams_config
from superset.integrations.teams.models import TeamsInstallation
from superset.integrations.teams.store import TeamsInstallationStore
from superset.utils import json

if importlib.util.find_spec("microsoft_teams") is None:
    pytest.skip("Optional Teams SDK is not installed", allow_module_level=True)

teams_adapter = importlib.import_module("superset.integrations.teams.adapter")
PATH = "/api/v1/teams/events/"
TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
APPLICATION = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
OTHER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
SERVICE_URL = "https://smba.trafficmanager.net/amer/"


@pytest.fixture(scope="module")
def signing_key() -> rsa.RSAPrivateKey:
    """Sign real SDK-validated tokens without contacting Microsoft's JWKS service."""
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture(autouse=True)
def trusted_signing_key(
    monkeypatch: pytest.MonkeyPatch, signing_key: rsa.RSAPrivateKey
) -> None:
    """Replace only key discovery; the SDK verifies signature and claims itself."""
    monkeypatch.setattr(
        jwt.PyJWKClient,
        "get_signing_key_from_jwt",
        lambda self, token: SimpleNamespace(key=signing_key.public_key()),
    )


@pytest.fixture
def auth_headers(signing_key: rsa.RSAPrivateKey) -> Callable[..., dict[str, str]]:
    """Build connector JWTs with optional invalid claims or signing key."""

    def sign(
        claims: dict[str, Any] | None = None,
        key: rsa.RSAPrivateKey | None = None,
    ) -> dict[str, str]:
        """Sign a token so failures exercise the SDK's real validator."""
        now = datetime.now(timezone.utc)
        payload = {
            "aud": APPLICATION,
            "iss": "https://api.botframework.com",
            "iat": int(now.timestamp()),
            "nbf": int(now.timestamp()),
            "exp": int((now + timedelta(hours=1)).timestamp()),
            "serviceurl": SERVICE_URL,
        }
        payload.update(claims or {})
        return {
            "Authorization": "Bearer "
            + jwt.encode(payload, key or signing_key, algorithm="RS256")
        }

    return sign


@pytest.fixture
def installation() -> dict[str, Any]:
    """An installationUpdate event from a standard team channel."""
    return {
        "type": "installationUpdate",
        "action": "add",
        "id": "event-1",
        "serviceUrl": SERVICE_URL,
        "channelId": "msteams",
        "from": {"id": "29:installer"},
        "recipient": {"id": f"28:{APPLICATION}"},
        "conversation": {
            "id": "channel-1",
            "conversationType": "channel",
            "tenantId": TENANT,
        },
        "channelData": {
            "tenant": {"id": TENANT},
            "team": {"id": "team-1"},
            "channel": {"id": "channel-1", "type": "standard"},
        },
    }


@pytest.fixture
def teams_client(
    teams_config: dict[str, Any],
    teams_engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
) -> FlaskClient:
    """Mount the callback in Flask with real CSRF enforcement and SQLAlchemy."""
    app = Flask(__name__)
    app.config.update(
        TESTING=True,
        SECRET_KEY="test-callback-key",  # noqa: S106
        WTF_CSRF_ENABLED=True,
        FEATURE_FLAGS={"ALERT_REPORT_TEAMS": True},
        ALERT_REPORTS_TEAMS=teams_config,
    )
    monkeypatch.setattr(teams_api, "db", SimpleNamespace(engine=teams_engine))
    monkeypatch.setattr(
        teams_api.feature_flag_manager,
        "is_feature_enabled",
        lambda name: current_app.config["FEATURE_FLAGS"].get(name, False),
    )
    teams_api.csrf.init_app(app)
    teams_api.register_teams_api(app)

    @app.post("/csrf-control")
    def csrf_control() -> Response:
        """An unrelated route must remain CSRF protected."""
        return Response(status=200)

    return app.test_client()


def test_callback_persists_only_approved_metadata(
    teams_client: FlaskClient,
    teams_engine: Engine,
    teams_config: dict[str, Any],
    installation: dict[str, Any],
    auth_headers: Callable[..., dict[str, str]],
) -> None:
    before = deepcopy(teams_config)
    response = teams_client.post(PATH, json=installation, headers=auth_headers())
    assert response.status_code == 200
    assert response.data == b""
    with Session(teams_engine) as session:
        persisted = session.query(TeamsInstallation).one()
        assert persisted.service_url == SERVICE_URL
        assert persisted.active
        assert str(persisted.tenant_id) == TENANT
        assert str(persisted.application_id) == APPLICATION
        assert persisted.team_id == "team-1"
    assert teams_config == before
    assert b"deployment-secret" not in response.data


@pytest.mark.parametrize(
    "authentication",
    [
        "missing",
        "malformed",
        "bad-signature",
        "wrong-audience",
        "expired",
        "wrong-issuer",
        "missing-serviceurl",
        "mismatched-serviceurl",
    ],
)
def test_invalid_authentication_never_opens_database_session(
    teams_client: FlaskClient,
    installation: dict[str, Any],
    auth_headers: Callable[..., dict[str, str]],
    authentication: str,
) -> None:
    if authentication == "missing":
        headers = {}
    elif authentication == "malformed":
        headers = {"Authorization": "Bearer not-a-jwt"}
    elif authentication == "bad-signature":
        headers = auth_headers(
            key=rsa.generate_private_key(public_exponent=65537, key_size=2048)
        )
    else:
        claims = {
            "wrong-audience": {"aud": OTHER},
            "expired": {"exp": 1},
            "wrong-issuer": {"iss": "https://untrusted.example"},
            "missing-serviceurl": {"serviceurl": None},
            "mismatched-serviceurl": {
                "serviceurl": "https://smba.trafficmanager.net/other/"
            },
        }
        headers = auth_headers(claims[authentication])
    with patch.object(teams_api, "Session") as session:
        response = teams_client.post(PATH, json=installation, headers=headers)
    assert response.status_code == 401
    assert response.data == b""
    session.assert_not_called()


@pytest.mark.parametrize(
    "mismatch",
    [
        "tenant",
        "conversation-tenant",
        "token-tenant",
        "recipient",
        "team",
        "personal",
        "groupChat",
        "private",
        "shared",
        "private-team",
        "shared-team",
    ],
)
def test_authenticated_events_must_match_deployment_scope(
    teams_client: FlaskClient,
    installation: dict[str, Any],
    auth_headers: Callable[..., dict[str, str]],
    mismatch: str,
) -> None:
    claims = {}
    if mismatch == "tenant":
        installation["channelData"]["tenant"]["id"] = OTHER
    elif mismatch == "conversation-tenant":
        installation["conversation"]["tenantId"] = OTHER
    elif mismatch == "token-tenant":
        claims = {"tid": OTHER}
    elif mismatch == "recipient":
        installation["recipient"]["id"] = f"28:{OTHER}"
    elif mismatch == "team":
        installation["channelData"]["team"]["id"] = "unapproved-team"
    elif mismatch in {"personal", "groupChat"}:
        installation["conversation"]["conversationType"] = mismatch
    elif mismatch in {"private", "shared"}:
        installation["channelData"]["channel"]["type"] = mismatch
    else:
        installation["channelData"]["team"]["teamType"] = (
            "privateChannel" if mismatch == "private-team" else "sharedChannel"
        )
    with patch.object(teams_api, "Session") as session:
        response = teams_client.post(
            PATH, json=installation, headers=auth_headers(claims)
        )
    assert response.status_code == 403
    session.assert_not_called()


def test_entra_tokens_cannot_bypass_signed_service_url_binding(
    teams_client: FlaskClient,
    installation: dict[str, Any],
    auth_headers: Callable[..., dict[str, str]],
) -> None:
    # The SDK also supports Agent 365 tokens; this notification bot accepts only
    # connector tokens whose signed serviceurl claim binds the installation URL.
    headers = auth_headers(
        {
            "iss": f"https://login.microsoftonline.com/{TENANT}/v2.0",
            "tid": TENANT,
            "azp": "5a807f24-c9de-44ee-a3a7-329e88a00ffc",
            "serviceurl": None,
        }
    )
    with patch.object(teams_api, "Session") as session:
        response = teams_client.post(PATH, json=installation, headers=headers)
    assert response.status_code == 403
    session.assert_not_called()


def test_tokens_without_expiration_are_rejected(
    teams_client: FlaskClient,
    installation: dict[str, Any],
    auth_headers: Callable[..., dict[str, str]],
) -> None:
    with patch.object(teams_api, "Session") as session:
        response = teams_client.post(
            PATH, json=installation, headers=auth_headers({"exp": None})
        )
    assert response.status_code in (401, 403)
    session.assert_not_called()


def test_repeated_events_removal_and_reinstallation(
    teams_client: FlaskClient,
    teams_engine: Engine,
    installation: dict[str, Any],
    auth_headers: Callable[..., dict[str, str]],
) -> None:
    headers = auth_headers()
    for _ in range(2):
        assert (
            teams_client.post(PATH, json=installation, headers=headers).status_code
            == 200
        )
    with Session(teams_engine) as session:
        original = session.query(TeamsInstallation).one()
        identity, created_on = original.id, original.created_on
    installation["action"] = "remove"
    for _ in range(2):
        assert (
            teams_client.post(PATH, json=installation, headers=headers).status_code
            == 200
        )
    with Session(teams_engine) as session:
        removed = session.query(TeamsInstallation).one()
        assert removed.id == identity
        assert not removed.active
    installation["action"] = "add"
    refreshed = "https://smba.trafficmanager.net/emea/"
    installation["serviceUrl"] = refreshed
    for _ in range(2):
        response = teams_client.post(
            PATH, json=installation, headers=auth_headers({"serviceurl": refreshed})
        )
        assert response.status_code == 200
    with Session(teams_engine) as session:
        reinstalled = session.query(TeamsInstallation).one()
        assert reinstalled.id == identity
        assert reinstalled.created_on == created_on
        assert reinstalled.active
        assert reinstalled.service_url == refreshed


def test_removal_does_not_create_unknown_installation(
    teams_client: FlaskClient,
    teams_engine: Engine,
    installation: dict[str, Any],
    auth_headers: Callable[..., dict[str, str]],
) -> None:
    installation["action"] = "remove"
    assert (
        teams_client.post(PATH, json=installation, headers=auth_headers()).status_code
        == 200
    )
    with Session(teams_engine) as session:
        assert session.query(TeamsInstallation).count() == 0


@pytest.mark.parametrize(
    "change",
    [
        "type",
        "action",
        "malformed-action",
        "missing-service",
        "missing-channel",
        "missing-recipient",
        "attachment",
    ],
)
def test_unsupported_or_incomplete_events_do_not_persist(
    teams_client: FlaskClient,
    installation: dict[str, Any],
    auth_headers: Callable[..., dict[str, str]],
    change: str,
) -> None:
    if change == "type":
        installation["type"] = "message"
    elif change == "action":
        installation["action"] = "unknown"
    elif change == "malformed-action":
        installation["action"] = []
    elif change == "missing-service":
        installation.pop("serviceUrl")
    elif change == "missing-channel":
        installation.pop("channelId")
    elif change == "missing-recipient":
        installation.pop("recipient")
    else:
        installation["attachments"] = [{"contentType": "image/png"}]
    with patch.object(teams_api, "Session") as session:
        response = teams_client.post(PATH, json=installation, headers=auth_headers())
    assert response.status_code == 400
    session.assert_not_called()


def test_session_cookie_does_not_authenticate_callback(
    teams_client: FlaskClient, installation: dict[str, Any]
) -> None:
    with teams_client.session_transaction() as browser_session:
        browser_session["_user_id"] = "1"
        browser_session["_fresh"] = True
    with patch.object(teams_api, "Session") as session:
        response = teams_client.post(PATH, json=installation)
    assert response.status_code == 401
    session.assert_not_called()


def test_csrf_exemption_is_only_for_callback(teams_client: FlaskClient) -> None:
    # Without a CSRF exemption this would be 400 before SDK authentication.
    assert teams_client.post(PATH, json={}).status_code == 401
    assert teams_client.post("/csrf-control").status_code == 400
    assert teams_client.get(PATH).status_code == 405


@pytest.mark.parametrize(
    "mode", ["disabled", "unconfigured", "invalid-config", "missing-sdk"]
)
def test_callback_fails_closed_without_sdk_or_configuration(
    teams_client: FlaskClient,
    installation: dict[str, Any],
    auth_headers: Callable[..., dict[str, str]],
    mode: str,
) -> None:
    expected = 503
    if mode == "disabled":
        teams_client.application.config["FEATURE_FLAGS"]["ALERT_REPORT_TEAMS"] = False
        expected = 404
    elif mode == "unconfigured":
        teams_client.application.config["ALERT_REPORTS_TEAMS"] = {}
    elif mode == "invalid-config":
        teams_client.application.config["ALERT_REPORTS_TEAMS"] = {
            "credential": "deployment-secret"
        }
    with patch.dict("sys.modules", {"superset.integrations.teams.adapter": None}):
        response = teams_client.post(PATH, json=installation, headers=auth_headers())
    assert response.status_code == expected
    assert response.data == b""


def test_bad_json_is_rejected(teams_client: FlaskClient) -> None:
    assert teams_client.post(PATH, data="text").status_code == 415
    assert (
        teams_client.post(PATH, data="{", content_type="application/json").status_code
        == 400
    )
    assert teams_client.post(PATH, json=[]).status_code == 400


@pytest.mark.parametrize("fail", [False, True])
def test_database_operation_closes_session_and_commits_or_rolls_back(
    teams_client: FlaskClient,
    teams_engine: Engine,
    installation: dict[str, Any],
    auth_headers: Callable[..., dict[str, str]],
    monkeypatch: pytest.MonkeyPatch,
    fail: bool,
) -> None:
    original_install = TeamsInstallationStore.install
    closed: list[bool] = []

    class TrackedSession(Session):
        """Observe cleanup without replacing real SQLAlchemy transactions."""

        def close(self) -> None:
            """Record resource closure after rollback."""
            super().close()
            closed.append(not self.in_transaction())

    def failing_install(
        self: TeamsInstallationStore, *args: Any, **kwargs: Any
    ) -> TeamsInstallation:
        """Fail after writing so rollback must undo the database insert."""
        installation = original_install(self, *args, **kwargs)
        if fail:
            raise SQLAlchemyError("injected persistence failure")
        return installation

    monkeypatch.setattr(TeamsInstallationStore, "install", failing_install)
    monkeypatch.setattr(teams_api, "Session", TrackedSession)
    response = teams_client.post(PATH, json=installation, headers=auth_headers())
    assert response.status_code == (500 if fail else 200)
    assert response.data == b""
    assert closed == [True]
    with Session(teams_engine) as session:
        assert session.query(TeamsInstallation).count() == (0 if fail else 1)


@pytest.mark.parametrize("invalid_auth", [False, True])
def test_sdk_adapter_and_event_loop_are_operation_scoped(
    teams_config: dict[str, Any],
    installation: dict[str, Any],
    auth_headers: Callable[..., dict[str, str]],
    monkeypatch: pytest.MonkeyPatch,
    invalid_auth: bool,
) -> None:
    config = parse_teams_config(teams_config)
    assert config is not None
    loops: list[asyncio.AbstractEventLoop] = []
    original_stop = teams_adapter._FlaskServerAdapter.stop

    async def stop(adapter: Any) -> None:
        """Ensure cleanup runs within the operation's loop."""
        loops.append(asyncio.get_running_loop())
        await original_stop(adapter)
        assert adapter.handler is None

    monkeypatch.setattr(teams_adapter._FlaskServerAdapter, "stop", stop)
    # This callback needs authentication only; no SDK App/outbound clients are used.
    with patch(
        "microsoft_teams.common.http.Client.__init__",
        side_effect=AssertionError("unexpected outbound client"),
    ):
        result = teams_adapter.process_teams_event(
            config, installation, {} if invalid_auth else auth_headers()
        )
    assert result.status == (401 if invalid_auth else 200)
    assert len(loops) == 1
    assert loops[0].is_closed()


def test_sdk_initialization_failure_still_releases_adapter(
    teams_config: dict[str, Any],
    installation: dict[str, Any],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    config = parse_teams_config(teams_config)
    assert config is not None
    loops: list[asyncio.AbstractEventLoop] = []
    original_stop = teams_adapter._FlaskServerAdapter.stop

    async def stop(adapter: Any) -> None:
        """Record cleanup even if route initialization raises."""
        loops.append(asyncio.get_running_loop())
        await original_stop(adapter)

    monkeypatch.setattr(teams_adapter._FlaskServerAdapter, "stop", stop)
    with patch.object(
        teams_adapter.HttpServer,
        "initialize",
        side_effect=RuntimeError("initialization failed"),
    ):
        with pytest.raises(RuntimeError, match="initialization failed"):
            teams_adapter.process_teams_event(config, installation, {})
    assert len(loops) == 1
    assert loops[0].is_closed()


def post_sized_event(
    client: FlaskClient,
    installation: dict[str, Any],
    size: int,
    content_length: bool,
    **kwargs: Any,
) -> Response:
    """Send padded JSON through either sized or terminated-stream WSGI input."""
    body = json.dumps(installation).encode()
    return client.post(
        PATH,
        data=body + b" " * (size - len(body)),
        environ_overrides=(
            {}
            if content_length
            else {"CONTENT_LENGTH": "", "wsgi.input_terminated": True}
        ),
        **kwargs,
    )


@pytest.mark.parametrize("content_length", [True, False])
@pytest.mark.parametrize("limit", [None, 1024])
@pytest.mark.parametrize("extra_bytes", [1, 4096])
@pytest.mark.parametrize("content_type", ["application/json", "text/plain"])
def test_oversized_event_is_rejected_before_json_sdk_or_database(
    teams_client: FlaskClient,
    installation: dict[str, Any],
    content_length: bool,
    extra_bytes: int,
    content_type: str,
    limit: int | None,
) -> None:
    """Even valid JSON followed by excess whitespace must not reach the parser."""
    teams_client.application.config["MAX_CONTENT_LENGTH"] = limit
    with (
        patch.object(teams_client.application.request_class, "get_json") as parse,
        patch.object(teams_adapter, "process_teams_event") as sdk,
        patch.object(teams_api, "Session") as session,
    ):
        response = post_sized_event(
            teams_client,
            installation,
            (limit or 256 * 1024) + extra_bytes,
            content_length,
            content_type=content_type,
        )
    assert response.status_code == 413
    assert teams_client.application.config["MAX_CONTENT_LENGTH"] == limit
    parse.assert_not_called()
    sdk.assert_not_called()
    session.assert_not_called()


@pytest.mark.parametrize("content_length", [True, False])
@pytest.mark.parametrize("size", [1024, 256 * 1024])
def test_valid_event_within_body_limit_still_authenticates_and_persists(
    teams_client: FlaskClient,
    teams_engine: Engine,
    installation: dict[str, Any],
    auth_headers: Callable[..., dict[str, str]],
    content_length: bool,
    size: int,
) -> None:
    """Accept normal and boundary-size JSON bodies, including terminated streams."""
    response = post_sized_event(
        teams_client,
        installation,
        size,
        content_length,
        content_type="application/json",
        headers=auth_headers(),
    )
    assert response.status_code == 200
    with Session(teams_engine) as session:
        installation_record = session.query(TeamsInstallation).one()
        assert installation_record.team_id == "team-1"
        assert installation_record.active


def test_body_limit_applies_only_to_teams_callback(teams_client: FlaskClient) -> None:
    """A separate route retains the deployment's existing request-size handling."""
    app = teams_client.application

    @app.post("/other-body")
    @teams_api.csrf.exempt
    def other_body() -> Response:
        from flask import request

        return Response(str(len(request.get_data())))

    body = b"x" * (256 * 1024 + 1)
    assert (
        teams_client.post(PATH, data=body, content_type="application/json").status_code
        == 413
    )
    response = teams_client.post("/other-body", data=body)
    assert response.status_code == 200
    assert response.data == str(len(body)).encode()
    assert app.config["MAX_CONTENT_LENGTH"] is None
