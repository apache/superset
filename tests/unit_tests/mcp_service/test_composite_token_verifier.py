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
    API_KEY_VALIDATED_USERNAME_CLAIM,
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
    mock_jwt_verifier.verify_token.assert_awaited_once_with("not_a_valid_token")


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
async def test_empty_string_prefix_is_filtered_out() -> None:
    """An empty-string prefix would match every Bearer token (DoS vector).
    It must be silently dropped and never stored in _api_key_prefixes."""
    verifier = CompositeTokenVerifier(jwt_verifier=None, api_key_prefixes=[""])

    assert "" not in verifier._api_key_prefixes
    # A plain JWT must NOT be misidentified as an API key.
    result = await verifier.verify_token("eyJhbGciOiJSUzI1NiJ9.jwt_payload")
    assert result is None


@pytest.mark.asyncio
async def test_whitespace_only_prefix_is_filtered_out() -> None:
    """A whitespace-only prefix is also invalid and must be dropped."""
    verifier = CompositeTokenVerifier(jwt_verifier=None, api_key_prefixes=["   "])

    assert "   " not in verifier._api_key_prefixes
    result = await verifier.verify_token("   starts_with_spaces")
    assert result is None


@pytest.mark.asyncio
async def test_prefix_with_surrounding_whitespace_is_trimmed() -> None:
    """Configured prefixes should tolerate accidental surrounding whitespace."""
    verifier = CompositeTokenVerifier(jwt_verifier=None, api_key_prefixes=[" sst_ "])

    assert verifier._api_key_prefixes == ("sst_",)
    result = await verifier.verify_token("sst_abc123")
    assert result is not None
    assert result.claims.get(API_KEY_PASSTHROUGH_CLAIM) is True


@pytest.mark.asyncio
async def test_non_string_prefix_is_filtered_out() -> None:
    """Non-string entries (e.g. None, int) must not be stored and must not
    cause a TypeError during verify_token."""
    verifier = CompositeTokenVerifier(
        jwt_verifier=None,
        api_key_prefixes=[None, 42, "sst_"],  # type: ignore[list-item]
    )

    assert None not in verifier._api_key_prefixes
    assert 42 not in verifier._api_key_prefixes
    assert verifier._api_key_prefixes == ("sst_",)


@pytest.mark.asyncio
async def test_invalid_prefixes_emit_warning(caplog: pytest.LogCaptureFixture) -> None:
    """Invalid prefix entries must trigger a logger.warning so operators can
    detect misconfiguration in FAB_API_KEY_PREFIXES."""
    import logging

    logger_name = "superset.mcp_service.composite_token_verifier"
    with caplog.at_level(logging.WARNING, logger=logger_name):
        CompositeTokenVerifier(jwt_verifier=None, api_key_prefixes=["", "sst_"])

    assert any("invalid" in record.message.lower() for record in caplog.records)


@pytest.mark.asyncio
async def test_all_invalid_prefixes_accepts_no_api_keys() -> None:
    """When all prefixes are invalid and filtered out, no token should match
    the API key path."""
    verifier = CompositeTokenVerifier(jwt_verifier=None, api_key_prefixes=["", "  "])

    assert verifier._api_key_prefixes == ()
    result = await verifier.verify_token("sst_abc123")
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


# -- Transport-layer DB validation (app configured) --


def _make_app_with_api_key(username: str | None) -> MagicMock:
    """Return a mock Flask app whose SecurityManager validates to ``username``."""
    mock_user = MagicMock()
    mock_user.username = username

    mock_sm = MagicMock()
    mock_sm.validate_api_key = MagicMock(return_value=mock_user if username else None)

    mock_app = MagicMock()
    mock_app.app_context.return_value.__enter__ = MagicMock(return_value=None)
    mock_app.app_context.return_value.__exit__ = MagicMock(return_value=False)
    mock_app.appbuilder.sm = mock_sm
    return mock_app


@pytest.mark.asyncio
async def test_transport_validation_valid_key_returns_access_token() -> None:
    """A valid API key with app configured returns AccessToken with username claim."""
    mock_app = _make_app_with_api_key("alice")
    verifier = CompositeTokenVerifier(
        jwt_verifier=None, api_key_prefixes=["sst_"], app=mock_app
    )

    result = await verifier.verify_token("sst_valid_key")

    assert result is not None
    assert result.client_id == "api_key"
    assert result.claims.get(API_KEY_PASSTHROUGH_CLAIM) is True
    assert result.claims.get(API_KEY_VALIDATED_USERNAME_CLAIM) == "alice"


@pytest.mark.asyncio
async def test_transport_validation_invalid_key_returns_none() -> None:
    """An invalid API key is rejected at transport (returns None → HTTP 401)."""
    mock_app = _make_app_with_api_key(None)
    verifier = CompositeTokenVerifier(
        jwt_verifier=None, api_key_prefixes=["sst_"], app=mock_app
    )

    result = await verifier.verify_token("sst_bogus_key")

    assert result is None


@pytest.mark.asyncio
async def test_transport_validation_db_error_rejects_token(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """An unexpected DB error during validation rejects the token (fail closed)."""
    import logging

    mock_sm = MagicMock()
    mock_sm.validate_api_key = MagicMock(side_effect=RuntimeError("db down"))

    mock_app = MagicMock()
    mock_app.app_context.return_value.__enter__ = MagicMock(return_value=None)
    mock_app.app_context.return_value.__exit__ = MagicMock(return_value=False)
    mock_app.appbuilder.sm = mock_sm

    verifier = CompositeTokenVerifier(
        jwt_verifier=None, api_key_prefixes=["sst_"], app=mock_app
    )

    logger_name = "superset.mcp_service.composite_token_verifier"
    with caplog.at_level(logging.WARNING, logger=logger_name):
        result = await verifier.verify_token("sst_some_key")

    assert result is None
    assert any("failed" in r.message.lower() for r in caplog.records)


@pytest.mark.asyncio
async def test_transport_validation_no_validate_api_key_method_rejects() -> None:
    """If FAB SecurityManager lacks validate_api_key, token is rejected."""
    mock_sm = MagicMock(spec=[])  # no attributes

    mock_app = MagicMock()
    mock_app.app_context.return_value.__enter__ = MagicMock(return_value=None)
    mock_app.app_context.return_value.__exit__ = MagicMock(return_value=False)
    mock_app.appbuilder.sm = mock_sm

    verifier = CompositeTokenVerifier(
        jwt_verifier=None, api_key_prefixes=["sst_"], app=mock_app
    )

    result = await verifier.verify_token("sst_some_key")

    assert result is None


@pytest.mark.asyncio
async def test_transport_validation_jwt_token_not_affected() -> None:
    """JWT tokens are still delegated to the JWT verifier even when app is set."""
    mock_app = _make_app_with_api_key("alice")
    mock_jwt_verifier = MagicMock()
    mock_jwt_verifier.required_scopes = []
    mock_jwt_verifier.verify_token = AsyncMock(return_value=None)

    verifier = CompositeTokenVerifier(
        jwt_verifier=mock_jwt_verifier,
        api_key_prefixes=["sst_"],
        app=mock_app,
    )

    await verifier.verify_token("eyJhbGciOiJSUzI1NiJ9.jwt_payload")

    mock_jwt_verifier.verify_token.assert_awaited_once_with(
        "eyJhbGciOiJSUzI1NiJ9.jwt_payload"
    )
    mock_app.appbuilder.sm.validate_api_key.assert_not_called()
