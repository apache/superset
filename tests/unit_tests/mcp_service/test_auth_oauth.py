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
"""The MCP service as a resource server for Superset-issued OAuth tokens."""

from __future__ import annotations

import asyncio
import time
from typing import Any
from unittest.mock import MagicMock

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastmcp import FastMCP
from starlette.testclient import TestClient

from superset.mcp_oauth.keys import load_signing_key, sign_access_token
from superset.mcp_service.auth_oauth import OAuthResourceServerProvider
from superset.mcp_service.mcp_config import (
    create_default_mcp_auth_factory,
    default_user_resolver,
    MCPAuthConfigError,
)

ISSUER = "https://superset.example.com"
RESOURCE = "https://superset.example.com/mcp"


@pytest.fixture(scope="module")
def private_pem() -> str:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    return key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()


def _app(config: dict[str, Any]) -> MagicMock:
    app = MagicMock()
    app.config.get.side_effect = lambda key, default=None: config.get(key, default)
    return app


def _config(private_pem: str, **overrides: Any) -> dict[str, Any]:
    config = {
        "MCP_OAUTH_ENABLED": True,
        "MCP_OAUTH_ISSUER": ISSUER,
        "MCP_OAUTH_RESOURCES": [RESOURCE],
        "MCP_OAUTH_PRIVATE_KEY": private_pem,
        "MCP_OAUTH_SCOPES": ["mcp"],
        "APP_NAME": "Superset",
    }
    config.update(overrides)
    return config


def _token(private_pem: str, **overrides: Any) -> str:
    now = int(time.time())
    claims = {
        "iss": ISSUER,
        "sub": "alice",
        "preferred_username": "alice",
        "aud": RESOURCE,
        "scope": "mcp",
        "iat": now,
        "exp": now + 3600,
    }
    claims.update(overrides)
    key = load_signing_key({"MCP_OAUTH_PRIVATE_KEY": private_pem})
    return sign_access_token(key, claims)


def _provider(private_pem: str) -> OAuthResourceServerProvider:
    provider = create_default_mcp_auth_factory(_app(_config(private_pem)))
    assert isinstance(provider, OAuthResourceServerProvider)
    return provider


def test_factory_builds_resource_server(private_pem: str) -> None:
    provider = _provider(private_pem)

    assert str(provider._get_resource_url("/mcp")) == RESOURCE
    paths = [route.path for route in provider.get_routes("/mcp")]
    assert "/.well-known/oauth-protected-resource/mcp" in paths


def test_factory_verifies_minted_token_and_resolves_user(private_pem: str) -> None:
    provider = _provider(private_pem)

    access_token = asyncio.run(provider.verify_token(_token(private_pem)))

    assert access_token is not None
    assert default_user_resolver(MagicMock(), access_token) == "alice"


@pytest.mark.parametrize(
    "overrides",
    [
        {"aud": "https://other.example.com/mcp"},
        {"iss": "https://evil.example.com"},
        {"exp": int(time.time()) - 10},
    ],
)
def test_factory_rejects_invalid_tokens(
    private_pem: str, overrides: dict[str, Any]
) -> None:
    provider = _provider(private_pem)

    assert asyncio.run(provider.verify_token(_token(private_pem, **overrides))) is None


def test_factory_rejects_token_from_other_key(private_pem: str) -> None:
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    other_pem = other.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()
    provider = _provider(private_pem)

    assert asyncio.run(provider.verify_token(_token(other_pem))) is None


@pytest.mark.parametrize(
    "overrides",
    [
        {"MCP_OAUTH_ISSUER": None},
        {"MCP_OAUTH_RESOURCES": []},
        {"MCP_OAUTH_RESOURCES": ["http://superset.example.com/mcp"]},
        {"MCP_OAUTH_PRIVATE_KEY": None},
    ],
)
def test_factory_fails_closed_on_bad_config(
    private_pem: str, overrides: dict[str, Any]
) -> None:
    with pytest.raises(MCPAuthConfigError):
        create_default_mcp_auth_factory(_app(_config(private_pem, **overrides)))


def test_unauthenticated_request_advertises_resource_metadata(
    private_pem: str,
) -> None:
    provider = _provider(private_pem)
    http_app = FastMCP("test", auth=provider).http_app(path="/mcp")

    with TestClient(http_app) as client:
        response = client.post(
            "/mcp",
            json={"jsonrpc": "2.0", "id": 1, "method": "ping"},
            headers={"Accept": "application/json, text/event-stream"},
        )
        metadata = client.get("/.well-known/oauth-protected-resource/mcp")

    assert response.status_code == 401
    assert response.headers["WWW-Authenticate"].startswith("Bearer")
    assert (
        'resource_metadata="https://superset.example.com/.well-known/'
        'oauth-protected-resource/mcp"'
    ) in response.headers["WWW-Authenticate"]
    assert metadata.status_code == 200
    assert metadata.json()["authorization_servers"] == [f"{ISSUER}/"]
