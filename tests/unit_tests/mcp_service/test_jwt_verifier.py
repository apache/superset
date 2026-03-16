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
import logging
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from authlib.jose.errors import BadSignatureError, DecodeError, ExpiredTokenError

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
    assert reason == "Algorithm mismatch"
    # Claim values must not leak into the contextvar reason
    assert "RS256" not in reason
    assert "HS256" not in reason


@pytest.mark.asyncio
async def test_malformed_token_header(hs256_verifier):
    """Token with invalid header should report malformed header."""
    # A token with only 2 parts (missing signature)
    result = await hs256_verifier.load_access_token("part1.part2")

    assert result is None
    reason = _jwt_failure_reason.get()
    assert reason == "Malformed token header"


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
    assert reason == "Signature verification failed"


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
    assert reason == "Token expired"
    # Claim values must not leak into the contextvar reason
    assert "user1" not in reason


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
    assert reason == "Issuer mismatch"
    # Claim values must not leak into the contextvar reason
    assert "wrong-issuer" not in reason
    assert "test-issuer" not in reason


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
    assert reason == "Audience mismatch"
    # Claim values must not leak into the contextvar reason
    assert "wrong-audience" not in reason
    assert "test-audience" not in reason


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
    assert reason == "Missing required scopes"
    # Claim values must not leak into the contextvar reason
    assert "admin" not in reason


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
    assert reason == "Token decode failed"


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
    assert reason == "Failed to get verification key"
    # Exception details must not leak into the contextvar reason
    assert "JWKS endpoint unreachable" not in reason


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
    """get_middleware should use DetailedBearerAuthBackend and generic error handler."""
    middleware_list = hs256_verifier.get_middleware()

    assert len(middleware_list) == 2

    # First middleware should be AuthenticationMiddleware with our custom backend
    auth_middleware = middleware_list[0]
    assert (
        auth_middleware.kwargs["backend"].__class__.__name__
        == "DetailedBearerAuthBackend"
    )
    # on_error should be the RFC 6750-compliant generic handler
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

    # Set failure reason (generic, no claim values)
    _jwt_failure_reason.set("Token expired")

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


def test_error_handler_never_leaks_jwt_details():
    """Error handler MUST return generic error per RFC 6750 Section 3.1.

    No JWT claim values, server config, or validation details should
    ever appear in the HTTP response - regardless of the failure type.
    References: CVE-2022-29266, CVE-2019-7644.
    """
    from starlette.authentication import AuthenticationError

    mock_conn = MagicMock()

    # Simulate various failure reasons that contain sensitive claim values
    sensitive_reasons = [
        "Algorithm mismatch: token uses 'RS256', expected 'HS256'",
        "Issuer mismatch: token has 'https://evil.com', expected 'https://good.com'",
        "Audience mismatch: token has 'wrong-aud', expected 'my-api'",
        "Token expired for client 'admin-service'",
        "Missing required scopes: {'admin'}. Token has: {'read'}",
    ]

    for reason in sensitive_reasons:
        exc = AuthenticationError(reason)
        response = _json_auth_error_handler(mock_conn, exc)

        assert response.status_code == 401

        body = json.loads(response.body.decode())
        # Body must only have generic message
        assert body["error"] == "invalid_token", f"Wrong error code for: {reason}"
        assert body["error_description"] == "Authentication failed", (
            f"Detailed reason leaked for: {reason}"
        )

        # WWW-Authenticate must not contain any claim values
        www_auth = response.headers.get("www-authenticate", "")
        assert www_auth == 'Bearer error="invalid_token"', (
            f"Detailed reason leaked in header for: {reason}"
        )


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
    assert reason == "Audience mismatch"


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
    assert reason == "Issuer mismatch"
    # Claim values must not leak into the contextvar reason
    assert "wrong-issuer" not in reason


def test_decode_token_header_padding_multiple_of_4():
    """_decode_token_header should handle headers whose length is a multiple of 4."""
    # eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 is 36 chars (divisible by 4)
    # This is the standard HS256/JWT header
    header = {"alg": "HS256", "typ": "JWT"}
    header_b64 = (
        base64.urlsafe_b64encode(json.dumps(header).encode()).rstrip(b"=").decode()
    )
    token = f"{header_b64}.payload.signature"

    result = DetailedJWTVerifier._decode_token_header(token)

    assert result["alg"] == "HS256"
    assert result["typ"] == "JWT"


@pytest.mark.asyncio
async def test_warning_logs_never_contain_claim_values(hs256_verifier, caplog):
    """WARNING logs must contain only generic categories; details go to DEBUG."""
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

    with caplog.at_level(logging.DEBUG, logger="superset.mcp_service.jwt_verifier"):
        with patch.object(hs256_verifier.jwt, "decode", return_value=claims):
            await hs256_verifier.load_access_token(token)

    # WARNING logs must not contain claim values
    warning_messages = [
        r.message for r in caplog.records if r.levelno >= logging.WARNING
    ]
    for msg in warning_messages:
        assert "wrong-issuer" not in msg
        assert "test-issuer" not in msg

    # DEBUG logs should contain the detailed values
    debug_messages = [r.message for r in caplog.records if r.levelno == logging.DEBUG]
    assert any("wrong-issuer" in msg for msg in debug_messages)


@pytest.mark.asyncio
async def test_hs256_secret_never_logged(hs256_verifier, caplog):
    """The HS256 secret key must never appear in any log at any level."""
    # This matches the public_key value from the hs256_verifier fixture
    hs256_signing_value = "test-secret-key-for-hs256-tokens"

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

    with caplog.at_level(logging.DEBUG, logger="superset.mcp_service.jwt_verifier"):
        with patch.object(hs256_verifier.jwt, "decode", return_value=claims):
            await hs256_verifier.load_access_token(token)

    # The signing value must never appear at ANY log level
    all_messages = [r.message for r in caplog.records]
    for msg in all_messages:
        assert hs256_signing_value not in msg, f"HS256 secret leaked in log: {msg}"


@pytest.mark.asyncio
async def test_expired_token_during_decode(hs256_verifier):
    """ExpiredTokenError raised by jwt.decode should set generic reason."""
    token = _make_token(
        {"alg": "HS256", "typ": "JWT"},
        {
            "sub": "user1",
            "iss": "test-issuer",
            "aud": "test-audience",
            "exp": int(time.time()) - 3600,
        },
    )

    with patch.object(
        hs256_verifier.jwt,
        "decode",
        side_effect=ExpiredTokenError(),
    ):
        result = await hs256_verifier.load_access_token(token)

    assert result is None
    reason = _jwt_failure_reason.get()
    assert reason == "Token has expired (detected during decode)"


@pytest.mark.asyncio
async def test_catch_all_exception_sets_generic_reason(hs256_verifier):
    """Catch-all handler should set generic reason without exception details."""
    token = _make_token(
        {"alg": "HS256", "typ": "JWT"},
        {
            "sub": "user1",
            "iss": "test-issuer",
            "aud": "test-audience",
            "exp": int(time.time()) + 3600,
        },
    )
    claims = {
        "sub": "user1",
        "iss": "test-issuer",
        "aud": "test-audience",
        "exp": int(time.time()) + 3600,
    }

    with patch.object(hs256_verifier.jwt, "decode", return_value=claims):
        with patch.object(
            hs256_verifier,
            "_extract_scopes",
            side_effect=TypeError("unexpected type in scopes"),
        ):
            result = await hs256_verifier.load_access_token(token)

    assert result is None
    reason = _jwt_failure_reason.get()
    assert reason == "Token validation failed"
    assert "unexpected type" not in reason
