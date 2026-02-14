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

"""Tests for DetailedJWTVerifier and related middleware."""

import base64
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from authlib.jose.errors import BadSignatureError, DecodeError

from superset.mcp_service.jwt_verifier import (
    _json_auth_error_handler,
    _jwt_failure_reason,
    DetailedBearerAuthBackend,
    DetailedJWTVerifier,
)
from superset.utils import json


def _make_token(
    header: dict[str, str], payload: dict[str, object], signature: str = "sig"
) -> str:
    """Build a fake JWT string from header + payload dicts."""
    h = base64.urlsafe_b64encode(json.dumps(header).encode()).rstrip(b"=").decode()
    p = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b"=").decode()
    return f"{h}.{p}.{signature}"


@pytest.fixture
def hs256_verifier():
    """Create a DetailedJWTVerifier configured for HS256."""
    return DetailedJWTVerifier(
        public_key="test-secret-key-for-hs256-tokens",
        issuer="test-issuer",
        audience="test-audience",
        algorithm="HS256",
        required_scopes=[],
    )


@pytest.fixture(autouse=True)
def _reset_contextvar():
    """Reset the failure reason contextvar before each test."""
    _jwt_failure_reason.set(None)
    yield
    _jwt_failure_reason.set(None)


@pytest.mark.asyncio
async def test_algorithm_mismatch(hs256_verifier):
    """Token with wrong algorithm should report algorithm mismatch."""
    token = _make_token(
        {"alg": "RS256", "typ": "JWT"},
        {"sub": "user1", "iss": "test-issuer", "aud": "test-audience"},
    )

    result = await hs256_verifier.load_access_token(token)

    assert result is None
    reason = _jwt_failure_reason.get()
    assert reason is not None
    assert "Algorithm mismatch" in reason
    assert "RS256" in reason
    assert "HS256" in reason


@pytest.mark.asyncio
async def test_malformed_token_header(hs256_verifier):
    """Token with invalid header should report malformed header."""
    # A token with only 2 parts (missing signature)
    result = await hs256_verifier.load_access_token("part1.part2")

    assert result is None
    reason = _jwt_failure_reason.get()
    assert reason is not None
    assert "Malformed token header" in reason


@pytest.mark.asyncio
async def test_signature_verification_failed(hs256_verifier):
    """Token with bad signature should report signature failure."""
    token = _make_token(
        {"alg": "HS256", "typ": "JWT"},
        {
            "sub": "user1",
            "iss": "test-issuer",
            "aud": "test-audience",
            "exp": int(time.time()) + 3600,
        },
    )

    with patch.object(
        hs256_verifier.jwt,
        "decode",
        side_effect=BadSignatureError(result=None),
    ):
        result = await hs256_verifier.load_access_token(token)

    assert result is None
    reason = _jwt_failure_reason.get()
    assert reason is not None
    assert "Signature verification failed" in reason


@pytest.mark.asyncio
async def test_expired_token(hs256_verifier):
    """Expired token should report token expired."""
    expired_time = int(time.time()) - 3600
    token = _make_token(
        {"alg": "HS256", "typ": "JWT"},
        {
            "sub": "user1",
            "iss": "test-issuer",
            "aud": "test-audience",
            "exp": expired_time,
        },
    )
    claims = {
        "sub": "user1",
        "iss": "test-issuer",
        "aud": "test-audience",
        "exp": expired_time,
    }

    with patch.object(hs256_verifier.jwt, "decode", return_value=claims):
        result = await hs256_verifier.load_access_token(token)

    assert result is None
    reason = _jwt_failure_reason.get()
    assert reason is not None
    assert "Token expired" in reason
    assert "user1" in reason


@pytest.mark.asyncio
async def test_issuer_mismatch(hs256_verifier):
    """Token with wrong issuer should report issuer mismatch."""
    token = _make_token(
        {"alg": "HS256", "typ": "JWT"},
        {
            "sub": "user1",
            "iss": "wrong-issuer",
            "aud": "test-audience",
            "exp": int(time.time()) + 3600,
        },
    )
    claims = {
        "sub": "user1",
        "iss": "wrong-issuer",
        "aud": "test-audience",
        "exp": int(time.time()) + 3600,
    }

    with patch.object(hs256_verifier.jwt, "decode", return_value=claims):
        result = await hs256_verifier.load_access_token(token)

    assert result is None
    reason = _jwt_failure_reason.get()
    assert reason is not None
    assert "Issuer mismatch" in reason
    assert "wrong-issuer" in reason
    assert "test-issuer" in reason


@pytest.mark.asyncio
async def test_audience_mismatch(hs256_verifier):
    """Token with wrong audience should report audience mismatch."""
    token = _make_token(
        {"alg": "HS256", "typ": "JWT"},
        {
            "sub": "user1",
            "iss": "test-issuer",
            "aud": "wrong-audience",
            "exp": int(time.time()) + 3600,
        },
    )
    claims = {
        "sub": "user1",
        "iss": "test-issuer",
        "aud": "wrong-audience",
        "exp": int(time.time()) + 3600,
    }

    with patch.object(hs256_verifier.jwt, "decode", return_value=claims):
        result = await hs256_verifier.load_access_token(token)

    assert result is None
    reason = _jwt_failure_reason.get()
    assert reason is not None
    assert "Audience mismatch" in reason
    assert "wrong-audience" in reason
    assert "test-audience" in reason


@pytest.mark.asyncio
async def test_missing_required_scopes(hs256_verifier):
    """Token missing required scopes should report missing scopes."""
    hs256_verifier.required_scopes = ["admin", "read"]

    token = _make_token(
        {"alg": "HS256", "typ": "JWT"},
        {
            "sub": "user1",
            "iss": "test-issuer",
            "aud": "test-audience",
            "exp": int(time.time()) + 3600,
            "scope": "read",
        },
    )
    claims = {
        "sub": "user1",
        "iss": "test-issuer",
        "aud": "test-audience",
        "exp": int(time.time()) + 3600,
        "scope": "read",
    }

    with patch.object(hs256_verifier.jwt, "decode", return_value=claims):
        result = await hs256_verifier.load_access_token(token)

    assert result is None
    reason = _jwt_failure_reason.get()
    assert reason is not None
    assert "Missing required scopes" in reason
    assert "admin" in reason


@pytest.mark.asyncio
async def test_valid_token(hs256_verifier):
    """Valid token should return AccessToken and clear contextvar."""
    future_exp = int(time.time()) + 3600
    token = _make_token(
        {"alg": "HS256", "typ": "JWT"},
        {
            "sub": "user1",
            "iss": "test-issuer",
            "aud": "test-audience",
            "exp": future_exp,
        },
    )
    claims = {
        "sub": "user1",
        "iss": "test-issuer",
        "aud": "test-audience",
        "exp": future_exp,
    }

    with patch.object(hs256_verifier.jwt, "decode", return_value=claims):
        result = await hs256_verifier.load_access_token(token)

    assert result is not None
    assert result.client_id == "user1"
    assert result.expires_at == future_exp
    # Contextvar should be None on success
    assert _jwt_failure_reason.get() is None


@pytest.mark.asyncio
async def test_valid_token_no_expiration(hs256_verifier):
    """Valid token without expiration should still succeed."""
    token = _make_token(
        {"alg": "HS256", "typ": "JWT"},
        {
            "sub": "user1",
            "iss": "test-issuer",
            "aud": "test-audience",
        },
    )
    claims = {
        "sub": "user1",
        "iss": "test-issuer",
        "aud": "test-audience",
    }

    with patch.object(hs256_verifier.jwt, "decode", return_value=claims):
        result = await hs256_verifier.load_access_token(token)

    assert result is not None
    assert result.client_id == "user1"
    assert result.expires_at is None


@pytest.mark.asyncio
async def test_decode_error(hs256_verifier):
    """Token that fails to decode should report decode failure."""
    token = _make_token(
        {"alg": "HS256", "typ": "JWT"},
        {"sub": "user1"},
    )

    with patch.object(
        hs256_verifier.jwt,
        "decode",
        side_effect=DecodeError("bad token"),
    ):
        result = await hs256_verifier.load_access_token(token)

    assert result is None
    reason = _jwt_failure_reason.get()
    assert reason is not None
    assert "Token decode failed" in reason


@pytest.mark.asyncio
async def test_verification_key_failure(hs256_verifier):
    """Failure to get verification key should report specific error."""
    token = _make_token(
        {"alg": "HS256", "typ": "JWT"},
        {"sub": "user1"},
    )

    with patch.object(
        hs256_verifier,
        "_get_verification_key",
        side_effect=ValueError("JWKS endpoint unreachable"),
    ):
        result = await hs256_verifier.load_access_token(token)

    assert result is None
    reason = _jwt_failure_reason.get()
    assert reason is not None
    assert "Failed to get verification key" in reason
    assert "JWKS endpoint unreachable" in reason


@pytest.mark.asyncio
async def test_contextvar_cleared_on_success(hs256_verifier):
    """Contextvar should be reset to None before successful validation."""
    # Set a stale failure reason
    _jwt_failure_reason.set("previous failure")

    future_exp = int(time.time()) + 3600
    token = _make_token(
        {"alg": "HS256", "typ": "JWT"},
        {
            "sub": "user1",
            "iss": "test-issuer",
            "aud": "test-audience",
            "exp": future_exp,
        },
    )
    claims = {
        "sub": "user1",
        "iss": "test-issuer",
        "aud": "test-audience",
        "exp": future_exp,
    }

    with patch.object(hs256_verifier.jwt, "decode", return_value=claims):
        result = await hs256_verifier.load_access_token(token)

    assert result is not None
    assert _jwt_failure_reason.get() is None


def test_decode_token_header_valid():
    """_decode_token_header should decode a valid JWT header."""
    header = {"alg": "RS256", "typ": "JWT", "kid": "key1"}
    header_b64 = (
        base64.urlsafe_b64encode(json.dumps(header).encode()).rstrip(b"=").decode()
    )
    token = f"{header_b64}.payload.signature"

    result = DetailedJWTVerifier._decode_token_header(token)

    assert result["alg"] == "RS256"
    assert result["kid"] == "key1"


def test_decode_token_header_too_few_parts():
    """_decode_token_header should raise for tokens with wrong number of parts."""
    with pytest.raises(ValueError, match="3 parts"):
        DetailedJWTVerifier._decode_token_header("only.two")


def test_get_middleware_returns_custom_components(hs256_verifier):
    """get_middleware should use DetailedBearerAuthBackend and custom error handler."""
    middleware_list = hs256_verifier.get_middleware()

    assert len(middleware_list) == 2

    # First middleware should be AuthenticationMiddleware with our custom backend
    auth_middleware = middleware_list[0]
    assert (
        auth_middleware.kwargs["backend"].__class__.__name__
        == "DetailedBearerAuthBackend"
    )
    assert auth_middleware.kwargs["on_error"] is _json_auth_error_handler


class _FakeHeaders(dict[str, str]):
    """A dict subclass that allows overriding .get() for mock connections."""

    def __init__(self, *args: object, **kwargs: object) -> None:
        super().__init__(*args, **kwargs)

    def get(self, key: str, default: str | None = None) -> str | None:  # type: ignore[override]
        return super().get(key, default)


@pytest.mark.asyncio
async def test_detailed_bearer_backend_raises_on_failure():
    """DetailedBearerAuthBackend should raise AuthenticationError with reason."""
    from starlette.authentication import AuthenticationError

    mock_verifier = MagicMock()
    mock_verifier.verify_token = AsyncMock(return_value=None)

    backend = DetailedBearerAuthBackend(mock_verifier)

    # Mock connection with Bearer token
    mock_conn = MagicMock()
    mock_conn.headers = _FakeHeaders({"authorization": "Bearer some-token"})

    # Set failure reason
    _jwt_failure_reason.set("Token expired for client 'user1'")

    with pytest.raises(AuthenticationError, match="Token expired"):
        await backend.authenticate(mock_conn)

    # Contextvar should be cleared after raising
    assert _jwt_failure_reason.get() is None


@pytest.mark.asyncio
async def test_detailed_bearer_backend_passes_through_success():
    """DetailedBearerAuthBackend should return normally on success."""
    mock_verifier = MagicMock()
    mock_token = MagicMock()
    mock_token.scopes = ["read"]
    mock_token.expires_at = None
    mock_verifier.verify_token = AsyncMock(return_value=mock_token)

    backend = DetailedBearerAuthBackend(mock_verifier)

    mock_conn = MagicMock()
    mock_conn.headers = _FakeHeaders({"authorization": "Bearer valid-token"})

    result = await backend.authenticate(mock_conn)

    assert result is not None
    assert _jwt_failure_reason.get() is None


@pytest.mark.asyncio
async def test_detailed_bearer_backend_no_bearer_token():
    """DetailedBearerAuthBackend should return None when no Bearer token."""
    mock_verifier = MagicMock()
    mock_verifier.verify_token = AsyncMock(return_value=None)

    backend = DetailedBearerAuthBackend(mock_verifier)

    # Mock connection without auth header
    mock_conn = MagicMock()
    mock_conn.headers = _FakeHeaders({})

    result = await backend.authenticate(mock_conn)

    assert result is None


def test_json_auth_error_handler():
    """_json_auth_error_handler should return JSON 401 with error details."""
    from starlette.authentication import AuthenticationError

    mock_conn = MagicMock()
    exc = AuthenticationError("Token expired for client 'user1'")

    response = _json_auth_error_handler(mock_conn, exc)

    assert response.status_code == 401
    body = json.loads(response.body.decode())
    assert body["error"] == "invalid_token"
    assert "Token expired" in body["error_description"]


@pytest.mark.asyncio
async def test_audience_mismatch_list_audience():
    """Token audience not in allowed audience list should fail."""
    verifier = DetailedJWTVerifier(
        public_key="test-secret",
        issuer="test-issuer",
        audience=["aud1", "aud2"],
        algorithm="HS256",
    )

    token = _make_token(
        {"alg": "HS256", "typ": "JWT"},
        {
            "sub": "user1",
            "iss": "test-issuer",
            "aud": "wrong-aud",
            "exp": int(time.time()) + 3600,
        },
    )
    claims = {
        "sub": "user1",
        "iss": "test-issuer",
        "aud": "wrong-aud",
        "exp": int(time.time()) + 3600,
    }

    with patch.object(verifier.jwt, "decode", return_value=claims):
        result = await verifier.load_access_token(token)

    assert result is None
    reason = _jwt_failure_reason.get()
    assert "Audience mismatch" in reason


@pytest.mark.asyncio
async def test_issuer_mismatch_list_issuer():
    """Token issuer not in allowed issuer list should fail."""
    verifier = DetailedJWTVerifier(
        public_key="test-secret",
        issuer=["iss1", "iss2"],
        audience="test-audience",
        algorithm="HS256",
    )

    token = _make_token(
        {"alg": "HS256", "typ": "JWT"},
        {
            "sub": "user1",
            "iss": "wrong-issuer",
            "aud": "test-audience",
            "exp": int(time.time()) + 3600,
        },
    )
    claims = {
        "sub": "user1",
        "iss": "wrong-issuer",
        "aud": "test-audience",
        "exp": int(time.time()) + 3600,
    }

    with patch.object(verifier.jwt, "decode", return_value=claims):
        result = await verifier.load_access_token(token)

    assert result is None
    reason = _jwt_failure_reason.get()
    assert "Issuer mismatch" in reason
    assert "wrong-issuer" in reason
