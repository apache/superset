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

from typing import Any

import pytest
from sqlalchemy.orm.session import Session

from superset.mcp_oauth import service
from superset.mcp_oauth.models import MCPOAuthClient
from tests.unit_tests.mcp_oauth.conftest import CALLBACK, ISSUER, RESOURCE


def test_authorization_server_metadata(oauth_config: Any) -> None:
    metadata = service.authorization_server_metadata()

    assert metadata["issuer"] == ISSUER
    assert metadata["authorization_endpoint"] == f"{ISSUER}/oauth/mcp/authorize"
    assert metadata["token_endpoint"] == f"{ISSUER}/oauth/mcp/token"
    assert metadata["registration_endpoint"] == f"{ISSUER}/oauth/mcp/register"
    assert metadata["jwks_uri"] == f"{ISSUER}/oauth/mcp/jwks.json"
    assert metadata["code_challenge_methods_supported"] == ["S256"]
    assert metadata["response_types_supported"] == ["code"]


def test_protected_resource_metadata(oauth_config: Any) -> None:
    metadata = service.protected_resource_metadata(RESOURCE)

    assert metadata["resource"] == RESOURCE
    assert metadata["authorization_servers"] == [ISSUER]


@pytest.mark.parametrize(
    "uri",
    [
        CALLBACK,
        "http://localhost:6274/callback",
        "http://127.0.0.1/cb",
    ],
)
def test_validate_redirect_uri_accepts(oauth_config: Any, uri: str) -> None:
    assert service.validate_redirect_uri(uri) == uri


@pytest.mark.parametrize(
    "uri",
    [
        "http://claude.ai/api/mcp/auth_callback",
        "https://claude.ai/cb#fragment",
        "https://user:pass@claude.ai/cb",
        "javascript:alert(1)",
        "custom-scheme://cb",
        "https:///no-host",
        "",
        42,
    ],
)
def test_validate_redirect_uri_rejects(oauth_config: Any, uri: Any) -> None:
    with pytest.raises(service.OAuthError) as excinfo:
        service.validate_redirect_uri(uri)
    assert excinfo.value.error == "invalid_redirect_uri"


def test_validate_redirect_uri_allowlist(oauth_config: Any) -> None:
    oauth_config["MCP_OAUTH_ALLOWED_REDIRECT_URIS"] = [CALLBACK]

    assert service.validate_redirect_uri(CALLBACK) == CALLBACK
    with pytest.raises(service.OAuthError):
        service.validate_redirect_uri("https://evil.example.com/cb")


def test_register_client_public(oauth_db: Session) -> None:
    response = service.register_client(
        {
            "redirect_uris": [CALLBACK],
            "client_name": "Claude",
            "token_endpoint_auth_method": "none",
            "grant_types": ["authorization_code", "refresh_token"],
        }
    )

    assert "client_secret" not in response
    client = oauth_db.query(MCPOAuthClient).one()
    assert client.client_id == response["client_id"]
    assert client.redirect_uri_list == [CALLBACK]
    assert client.client_secret_hash is None


def test_register_client_confidential_stores_hash(oauth_db: Session) -> None:
    response = service.register_client({"redirect_uris": [CALLBACK]})

    assert response["token_endpoint_auth_method"] == "client_secret_basic"  # noqa: S105
    client = oauth_db.query(MCPOAuthClient).one()
    assert client.client_secret_hash
    assert client.client_secret_hash != response["client_secret"]


@pytest.mark.parametrize(
    "metadata,error",
    [
        (None, "invalid_client_metadata"),
        ({}, "invalid_redirect_uri"),
        ({"redirect_uris": "https://a.example.com"}, "invalid_redirect_uri"),
        ({"redirect_uris": [CALLBACK] * 11}, "invalid_redirect_uri"),
        (
            {"redirect_uris": [CALLBACK], "grant_types": ["client_credentials"]},
            "invalid_client_metadata",
        ),
        (
            {"redirect_uris": [CALLBACK], "grant_types": ["refresh_token"]},
            "invalid_client_metadata",
        ),
        (
            {"redirect_uris": [CALLBACK], "response_types": ["token"]},
            "invalid_client_metadata",
        ),
        (
            {"redirect_uris": [CALLBACK], "token_endpoint_auth_method": "jwt"},
            "invalid_client_metadata",
        ),
        ({"redirect_uris": [CALLBACK], "scope": "admin"}, "invalid_client_metadata"),
        (
            {"redirect_uris": [CALLBACK], "client_name": "x" * 256},
            "invalid_client_metadata",
        ),
    ],
)
def test_register_client_rejects(oauth_db: Session, metadata: Any, error: str) -> None:
    with pytest.raises(service.OAuthError) as excinfo:
        service.register_client(metadata)
    assert excinfo.value.error == error
    assert oauth_db.query(MCPOAuthClient).count() == 0
