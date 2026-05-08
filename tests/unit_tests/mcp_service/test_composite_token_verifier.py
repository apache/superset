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

"""Tests for CompositeTokenVerifier."""

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastmcp.server.auth import AccessToken

from superset.mcp_service.composite_token_verifier import (
    API_KEY_PASSTHROUGH_CLAIM,
    CompositeTokenVerifier,
)


@pytest.fixture
def mock_jwt_verifier() -> MagicMock:
    verifier = MagicMock()
    verifier.required_scopes = []
    verifier.verify_token = AsyncMock()
    return verifier


@pytest.fixture
def composite_verifier(mock_jwt_verifier: MagicMock) -> CompositeTokenVerifier:
    return CompositeTokenVerifier(
        jwt_verifier=mock_jwt_verifier,
        api_key_prefixes=["sst_", "pat_"],
    )


@pytest.mark.asyncio
async def test_api_key_token_returns_passthrough(
    composite_verifier: CompositeTokenVerifier,
) -> None:
    """Tokens matching an API key prefix return a pass-through AccessToken."""
    api_key = "sst_abc123secret"  # noqa: S105
    result = await composite_verifier.verify_token(api_key)

    assert result is not None
    assert result.token == api_key
    assert result.client_id == "api_key"
    assert result.claims.get(API_KEY_PASSTHROUGH_CLAIM) is True


@pytest.mark.asyncio
async def test_second_prefix_matches(
    composite_verifier: CompositeTokenVerifier,
) -> None:
    """All configured prefixes are checked, not just the first."""
    result = await composite_verifier.verify_token("pat_mytoken")

    assert result is not None
    assert result.claims.get(API_KEY_PASSTHROUGH_CLAIM) is True


@pytest.mark.asyncio
async def test_jwt_token_delegates_to_wrapped_verifier(
    composite_verifier: CompositeTokenVerifier, mock_jwt_verifier: MagicMock
) -> None:
    """Non-API-key tokens are delegated to the wrapped JWT verifier."""
    jwt_token = "eyJhbGciOiJSUzI1NiJ9.jwt_payload"  # noqa: S105
    jwt_result = AccessToken(
        token=jwt_token,
        client_id="oauth_client",
        scopes=["read"],
        claims={"sub": "user1"},
    )
    mock_jwt_verifier.verify_token.return_value = jwt_result

    result = await composite_verifier.verify_token("eyJhbGciOiJSUzI1NiJ9.jwt_payload")

    assert result is jwt_result
    mock_jwt_verifier.verify_token.assert_awaited_once_with(
        "eyJhbGciOiJSUzI1NiJ9.jwt_payload"
    )


@pytest.mark.asyncio
async def test_invalid_jwt_returns_none(
    composite_verifier: CompositeTokenVerifier, mock_jwt_verifier: MagicMock
) -> None:
    """When the JWT verifier rejects a token, None is returned."""
    mock_jwt_verifier.verify_token.return_value = None

    result = await composite_verifier.verify_token("not_a_valid_token")

    assert result is None
    mock_jwt_verifier.verify_token.assert_awaited_once()


@pytest.mark.asyncio
async def test_api_key_does_not_call_jwt_verifier(
    composite_verifier: CompositeTokenVerifier, mock_jwt_verifier: MagicMock
) -> None:
    """API key tokens bypass the JWT verifier entirely."""
    await composite_verifier.verify_token("sst_test_key")

    mock_jwt_verifier.verify_token.assert_not_awaited()


# -- API-key-only mode (no JWT verifier configured) --


@pytest.mark.asyncio
async def test_api_key_only_mode_accepts_api_keys() -> None:
    """When jwt_verifier is None, API key tokens are still passed through."""
    verifier = CompositeTokenVerifier(jwt_verifier=None, api_key_prefixes=["sst_"])

    result = await verifier.verify_token("sst_abc123")

    assert result is not None
    assert result.claims.get(API_KEY_PASSTHROUGH_CLAIM) is True


@pytest.mark.asyncio
async def test_api_key_only_mode_rejects_non_api_key_tokens() -> None:
    """When jwt_verifier is None, non-API-key Bearer tokens are rejected at
    the transport instead of being silently accepted."""
    verifier = CompositeTokenVerifier(jwt_verifier=None, api_key_prefixes=["sst_"])

    result = await verifier.verify_token("eyJhbGciOiJSUzI1NiJ9.jwt_payload")

    assert result is None


@pytest.mark.asyncio
async def test_api_key_passthrough_propagates_required_scopes() -> None:
    """The pass-through AccessToken must carry the verifier's required_scopes
    so FastMCP's transport-level ``RequireAuthMiddleware`` does not 403 the
    request before ``_resolve_user_from_api_key`` runs."""
    jwt_verifier = MagicMock()
    jwt_verifier.required_scopes = ["read", "write"]
    jwt_verifier.verify_token = AsyncMock()

    verifier = CompositeTokenVerifier(
        jwt_verifier=jwt_verifier, api_key_prefixes=["sst_"]
    )

    result = await verifier.verify_token("sst_abc123")

    assert result is not None
    assert result.scopes == ["read", "write"]
