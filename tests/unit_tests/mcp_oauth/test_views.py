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

from __future__ import annotations

from datetime import timedelta
from typing import Any
from urllib.parse import parse_qs, urlsplit

import pytest
from authlib.jose import JsonWebKey, jwt
from pytest_mock import MockerFixture

from superset.mcp_oauth.models import MCPOAuthRefreshToken, utcnow
from tests.unit_tests.mcp_oauth.conftest import (
    CALLBACK,
    ISSUER,
    RESOURCE,
    s256,
    VERIFIER,
)


@pytest.fixture
def logged_in(mocker: MockerFixture, user: Any) -> Any:
    mocker.patch("superset.mcp_oauth.views._current_user", return_value=user)
    return user


@pytest.fixture
def registered(client: Any, oauth_db: Any) -> dict[str, Any]:
    response = client.post(
        "/oauth/mcp/register",
        json={
            "redirect_uris": [CALLBACK],
            "client_name": "Claude",
            "grant_types": ["authorization_code", "refresh_token"],
            "token_endpoint_auth_method": "client_secret_post",
        },
    )
    assert response.status_code == 201
    return response.json


def _authorize_params(client_id: str, **overrides: str) -> dict[str, str]:
    params = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": CALLBACK,
        "code_challenge": s256(VERIFIER),
        "code_challenge_method": "S256",
        "state": "xyz",
        "resource": RESOURCE,
        "scope": "mcp",
    }
    params.update(overrides)
    return params


def _approve(client: Any, registered: dict[str, Any], **overrides: str) -> str:
    params = _authorize_params(registered["client_id"], **overrides)
    response = client.post(
        "/oauth/mcp/authorize", data={**params, "decision": "approve"}
    )
    assert response.status_code == 302
    query = parse_qs(urlsplit(response.headers["Location"]).query)
    return query["code"][0]


def _exchange(
    client: Any, registered: dict[str, Any], code: str, **overrides: str
) -> Any:
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": CALLBACK,
        "code_verifier": VERIFIER,
        "client_id": registered["client_id"],
        "client_secret": registered["client_secret"],
        "resource": RESOURCE,
    }
    data.update(overrides)
    return client.post("/oauth/mcp/token", data=data)


def _refresh(client: Any, registered: dict[str, Any], token: str) -> Any:
    return client.post(
        "/oauth/mcp/token",
        data={
            "grant_type": "refresh_token",
            "refresh_token": token,
            "client_id": registered["client_id"],
            "client_secret": registered["client_secret"],
        },
    )


def test_endpoints_404_when_disabled(client: Any, app: Any) -> None:
    assert not app.config["MCP_OAUTH_ENABLED"]
    assert client.get("/.well-known/oauth-authorization-server").status_code == 404
    assert client.post("/oauth/mcp/register", json={}).status_code == 404


def test_metadata_documents(client: Any, oauth_config: Any) -> None:
    server = client.get("/.well-known/oauth-authorization-server")
    assert server.status_code == 200
    assert server.json["issuer"] == ISSUER

    resource = client.get("/.well-known/oauth-protected-resource/mcp")
    assert resource.status_code == 200
    assert resource.json == {
        "resource": RESOURCE,
        "authorization_servers": [ISSUER],
        "scopes_supported": ["mcp"],
        "bearer_methods_supported": ["header"],
        "resource_name": f"{oauth_config['APP_NAME']} MCP",
    }
    assert client.get("/.well-known/oauth-protected-resource/nope").status_code == 404

    jwks = client.get("/oauth/mcp/jwks.json")
    assert jwks.status_code == 200
    assert "d" not in jwks.json["keys"][0]


def test_register_rejects_http_redirect(client: Any, oauth_db: Any) -> None:
    response = client.post(
        "/oauth/mcp/register", json={"redirect_uris": ["http://claude.ai/cb"]}
    )
    assert response.status_code == 400
    assert response.json["error"] == "invalid_redirect_uri"


def test_authorize_redirects_anonymous_user_to_login(
    client: Any, registered: dict[str, Any], mocker: MockerFixture
) -> None:
    mocker.patch("superset.mcp_oauth.views._current_user", return_value=None)
    response = client.get(
        "/oauth/mcp/authorize",
        query_string=_authorize_params(registered["client_id"]),
    )
    assert response.status_code == 302
    location = response.headers["Location"]
    assert "/login" in location
    assert "next=" in location


def test_authorize_renders_consent(
    client: Any, registered: dict[str, Any], logged_in: Any
) -> None:
    response = client.get(
        "/oauth/mcp/authorize",
        query_string=_authorize_params(registered["client_id"]),
    )
    assert response.status_code == 200
    body = response.get_data(as_text=True)
    assert "Claude" in body
    assert "alice" in body
    assert 'name="csrf_token"' in body
    assert response.headers["X-Frame-Options"] == "DENY"


def test_authorize_unknown_client_never_redirects(
    client: Any, registered: dict[str, Any], logged_in: Any
) -> None:
    response = client.get(
        "/oauth/mcp/authorize", query_string=_authorize_params("unknown")
    )
    assert response.status_code == 400


def test_authorize_unregistered_redirect_never_redirects(
    client: Any, registered: dict[str, Any], logged_in: Any
) -> None:
    response = client.get(
        "/oauth/mcp/authorize",
        query_string=_authorize_params(
            registered["client_id"], redirect_uri="https://evil.example.com/cb"
        ),
    )
    assert response.status_code == 400


@pytest.mark.parametrize(
    "overrides,error",
    [
        ({"code_challenge_method": "plain"}, "invalid_request"),
        ({"code_challenge": ""}, "invalid_request"),
        ({"resource": "https://other.example.com/mcp"}, "invalid_target"),
        ({"scope": "admin"}, "invalid_scope"),
        ({"response_type": "token"}, "unsupported_response_type"),
    ],
)
def test_authorize_errors_redirect_to_client(
    client: Any,
    registered: dict[str, Any],
    logged_in: Any,
    overrides: dict[str, str],
    error: str,
) -> None:
    response = client.get(
        "/oauth/mcp/authorize",
        query_string=_authorize_params(registered["client_id"], **overrides),
    )
    assert response.status_code == 302
    location = response.headers["Location"]
    assert location.startswith(CALLBACK)
    query = parse_qs(urlsplit(location).query)
    assert query["error"] == [error]
    assert query["state"] == ["xyz"]


def test_authorize_deny(
    client: Any, registered: dict[str, Any], logged_in: Any
) -> None:
    params = _authorize_params(registered["client_id"])
    response = client.post("/oauth/mcp/authorize", data={**params, "decision": "deny"})
    query = parse_qs(urlsplit(response.headers["Location"]).query)
    assert query["error"] == ["access_denied"]
    assert query["state"] == ["xyz"]


def test_full_code_flow_and_refresh_rotation(
    client: Any,
    registered: dict[str, Any],
    logged_in: Any,
    oauth_config: Any,
    oauth_db: Any,
) -> None:
    params = _authorize_params(registered["client_id"])
    approve = client.post(
        "/oauth/mcp/authorize", data={**params, "decision": "approve"}
    )
    assert approve.status_code == 302
    query = parse_qs(urlsplit(approve.headers["Location"]).query)
    assert query["state"] == ["xyz"]
    assert query["iss"] == [ISSUER]

    tokens = _exchange(client, registered, query["code"][0])
    assert tokens.status_code == 200
    assert tokens.headers["Cache-Control"] == "no-store"
    body = tokens.json
    assert body["token_type"] == "Bearer"  # noqa: S105
    assert body["expires_in"] == 3600

    jwks = client.get("/oauth/mcp/jwks.json").json
    claims = jwt.decode(body["access_token"], JsonWebKey.import_key_set(jwks))
    claims.validate()
    assert claims["sub"] == "alice"
    assert claims["aud"] == RESOURCE
    assert claims["iss"] == ISSUER
    assert claims["client_id"] == registered["client_id"]
    assert claims["exp"] - claims["iat"] == 3600

    stored = oauth_db.query(MCPOAuthRefreshToken).one()
    assert stored.token_hash != body["refresh_token"]

    rotated = _refresh(client, registered, body["refresh_token"])
    assert rotated.status_code == 200
    new_refresh = rotated.json["refresh_token"]
    assert new_refresh != body["refresh_token"]

    replay = _refresh(client, registered, body["refresh_token"])
    assert replay.status_code == 400
    assert replay.json["error"] == "invalid_grant"

    # Replaying a rotated token revokes the whole family.
    assert _refresh(client, registered, new_refresh).status_code == 400


def test_token_bad_verifier(
    client: Any, registered: dict[str, Any], logged_in: Any
) -> None:
    code = _approve(client, registered)
    response = _exchange(client, registered, code, code_verifier="w" * 43)
    assert response.status_code == 400
    assert response.json["error"] == "invalid_grant"
    # A failed attempt burns the code.
    assert _exchange(client, registered, code).status_code == 400


def test_token_reused_code(
    client: Any, registered: dict[str, Any], logged_in: Any
) -> None:
    code = _approve(client, registered)
    assert _exchange(client, registered, code).status_code == 200
    reused = _exchange(client, registered, code)
    assert reused.status_code == 400
    assert reused.json["error"] == "invalid_grant"


def test_token_redirect_mismatch(
    client: Any, registered: dict[str, Any], logged_in: Any
) -> None:
    code = _approve(client, registered)
    response = _exchange(
        client, registered, code, redirect_uri="https://claude.ai/other"
    )
    assert response.status_code == 400
    assert response.json["error"] == "invalid_grant"


def test_token_expired_code(
    client: Any,
    registered: dict[str, Any],
    logged_in: Any,
    mocker: MockerFixture,
) -> None:
    code = _approve(client, registered)
    mocker.patch(
        "superset.mcp_oauth.service.utcnow",
        return_value=utcnow() + timedelta(seconds=61),
    )
    response = _exchange(client, registered, code)
    assert response.status_code == 400
    assert response.json["error"] == "invalid_grant"


def test_token_wrong_resource(
    client: Any, registered: dict[str, Any], logged_in: Any
) -> None:
    code = _approve(client, registered)
    response = _exchange(
        client, registered, code, resource="https://other.example.com/mcp"
    )
    assert response.status_code == 400
    assert response.json["error"] == "invalid_target"


def test_token_bad_client_secret(
    client: Any, registered: dict[str, Any], logged_in: Any
) -> None:
    code = _approve(client, registered)
    response = _exchange(client, registered, code, client_secret="wrong")  # noqa: S106
    assert response.status_code == 401
    assert response.json["error"] == "invalid_client"


def test_token_code_bound_to_client(
    client: Any, registered: dict[str, Any], logged_in: Any
) -> None:
    other = client.post(
        "/oauth/mcp/register",
        json={
            "redirect_uris": [CALLBACK],
            "token_endpoint_auth_method": "client_secret_post",
        },
    ).json
    code = _approve(client, registered)
    response = _exchange(
        client,
        registered,
        code,
        client_id=other["client_id"],
        client_secret=other["client_secret"],
    )
    assert response.status_code == 400
    assert response.json["error"] == "invalid_grant"


def test_token_unsupported_grant(client: Any, registered: dict[str, Any]) -> None:
    response = client.post(
        "/oauth/mcp/token",
        data={
            "grant_type": "password",
            "client_id": registered["client_id"],
            "client_secret": registered["client_secret"],
        },
    )
    assert response.status_code == 400
    assert response.json["error"] == "unsupported_grant_type"
