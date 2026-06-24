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

import asyncio
import base64
import logging
import time
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from authlib.jose.errors import BadSignatureError, DecodeError, ExpiredTokenError

from superset.mcp_service.jwt_verifier import (
    _auth_error_handler,
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
async def test_unpinned_algorithm_is_rejected(
    hs256_verifier: DetailedJWTVerifier,
) -> None:
    """A verifier with no pinned algorithm must reject signed tokens.

    The upstream JWTVerifier currently always defaults the algorithm to RS256,
    so this state is not reachable through normal construction. This asserts the
    fail-closed guard so the verifier does not silently rely on that upstream
    default: if the pinned algorithm is ever absent, tokens are rejected rather
    than validated against an unconstrained algorithm family.
    """
    # Simulate an unpinned verifier (e.g. a future upstream default change).
    hs256_verifier.algorithm = None
    token = _make_token(
        {"alg": "HS256", "typ": "JWT"},
        {"sub": "user1", "iss": "test-issuer", "aud": "test-audience"},
    )

    result = await hs256_verifier.load_access_token(token)

    assert result is None
    assert _jwt_failure_reason.get() == "No signing algorithm pinned"


@pytest.mark.asyncio
async def test_malformed_token_header(hs256_verifier):
    """Token with invalid header should report malformed header."""
    # A token with only 2 parts (missing signature)
    result = await hs256_verifier.load_access_token("part1.part2")

    assert result is None
    reason = _jwt_failure_reason.get()
    assert reason == "Malformed token header"


@pytest.mark.asyncio
async def test_jwks_network_error_is_handled(hs256_verifier):
    """A network error fetching the JWKS key is handled, not propagated."""
    import httpx

    token = _make_token(
        {"alg": "HS256", "typ": "JWT"},
        {"sub": "user1", "iss": "test-issuer", "aud": "test-audience"},
    )

    with patch.object(
        hs256_verifier,
        "_get_verification_key",
        side_effect=httpx.ConnectError("connection refused"),
    ):
        result = await hs256_verifier.load_access_token(token)

    assert result is None
    assert _jwt_failure_reason.get() == "JWKS verification key unavailable"


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
async def test_token_with_future_nbf_rejected(hs256_verifier):
    """Token whose nbf is in the future should report not-yet-valid."""
    future_nbf = int(time.time()) + 3600
    claims = {
        "sub": "user1",
        "iss": "test-issuer",
        "aud": "test-audience",
        "exp": int(time.time()) + 7200,
        "nbf": future_nbf,
    }
    token = _make_token({"alg": "HS256", "typ": "JWT"}, claims)

    with patch.object(hs256_verifier.jwt, "decode", return_value=claims):
        result = await hs256_verifier.load_access_token(token)

    assert result is None
    reason = _jwt_failure_reason.get()
    assert reason == "Token not yet valid"
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
async def test_valid_token_logs_success(hs256_verifier, caplog):
    """A successful authentication should leave an INFO-level audit entry."""
    future_exp = int(time.time()) + 3600
    token = _make_token(
        {"alg": "HS256", "typ": "JWT"},
        {"sub": "user1", "iss": "test-issuer", "aud": "test-audience"},
    )
    claims = {
        "sub": "user1",
        "iss": "test-issuer",
        "aud": "test-audience",
        "exp": future_exp,
    }

    with caplog.at_level(logging.INFO, logger="superset.mcp_service.jwt_verifier"):
        with patch.object(hs256_verifier.jwt, "decode", return_value=claims):
            result = await hs256_verifier.load_access_token(token)

    assert result is not None
    assert any(
        "JWT authentication succeeded" in record.message
        and record.levelno == logging.INFO
        for record in caplog.records
    )


@pytest.mark.asyncio
async def test_success_log_tolerates_non_orderable_scopes(hs256_verifier, caplog):
    """The success audit log must never raise on a non-orderable scope claim.

    Scope entries are coerced to strings before sorting, so a malformed scopes
    list like ``["read", 1]`` cannot raise ``TypeError`` inside the audit log and
    mask an otherwise-valid token as a generic ``"Token validation failed"``.
    """
    future_exp = int(time.time()) + 3600
    token = _make_token(
        {"alg": "HS256", "typ": "JWT"},
        {"sub": "user1", "iss": "test-issuer", "aud": "test-audience"},
    )
    claims = {
        "sub": "user1",
        "iss": "test-issuer",
        "aud": "test-audience",
        "exp": future_exp,
    }

    with caplog.at_level(logging.INFO, logger="superset.mcp_service.jwt_verifier"):
        with (
            patch.object(hs256_verifier.jwt, "decode", return_value=claims),
            patch.object(hs256_verifier, "_extract_scopes", return_value=["read", 1]),
        ):
            await hs256_verifier.load_access_token(token)

    # The success audit log is reached and emitted without raising. Before the
    # str-coercion fix, ``sorted(["read", 1])`` would raise ``TypeError`` *before*
    # this record was emitted, so its presence proves the logging path is safe.
    assert any(
        "JWT authentication succeeded" in record.message
        and record.levelno == logging.INFO
        for record in caplog.records
    )


@pytest.mark.asyncio
async def test_token_without_expiration_rejected(hs256_verifier):
    """Token without an exp claim must be rejected (exp is required)."""
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

    assert result is None
    reason = _jwt_failure_reason.get()
    assert reason == "Token missing expiration"
    # Claim values must not leak into the contextvar reason
    assert "user1" not in reason


@pytest.mark.asyncio
async def test_non_finite_expiration_rejected(hs256_verifier):
    """An infinite exp must be rejected cleanly, not crash on int() overflow.

    A JSON ``1e309`` decodes to ``float('inf')``, which passes the
    ``exp < time.time()`` expiry check and would later raise ``OverflowError``
    on ``int(exp)`` — surfacing as a 500 instead of a 401. The finite-number
    guard rejects it with a precise reason before that can happen.
    """
    token = _make_token(
        {"alg": "HS256", "typ": "JWT"},
        {"sub": "user1", "iss": "test-issuer", "aud": "test-audience"},
    )
    claims = {
        "sub": "user1",
        "iss": "test-issuer",
        "aud": "test-audience",
        "exp": float("inf"),
    }

    with patch.object(hs256_verifier.jwt, "decode", return_value=claims):
        result = await hs256_verifier.load_access_token(token)

    assert result is None
    assert _jwt_failure_reason.get() == "Token has invalid expiration"


@pytest.mark.asyncio
async def test_non_numeric_expiration_rejected(hs256_verifier):
    """A non-numeric exp must be rejected with the invalid-expiration reason.

    Without the finite-number guard, ``exp < time.time()`` would raise
    ``TypeError`` and degrade to the generic "Token validation failed" reason.
    """
    token = _make_token(
        {"alg": "HS256", "typ": "JWT"},
        {"sub": "user1", "iss": "test-issuer", "aud": "test-audience"},
    )
    claims = {
        "sub": "user1",
        "iss": "test-issuer",
        "aud": "test-audience",
        "exp": "2026-01-01",
    }

    with patch.object(hs256_verifier.jwt, "decode", return_value=claims):
        result = await hs256_verifier.load_access_token(token)

    assert result is None
    assert _jwt_failure_reason.get() == "Token has invalid expiration"


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
@pytest.mark.parametrize(
    "network_error",
    [
        httpx.ConnectError("connection refused"),
        httpx.ConnectTimeout("connect timed out"),
        httpx.ReadTimeout("read timed out"),
        httpx.HTTPStatusError(
            "500 Server Error",
            request=httpx.Request("GET", "https://idp.example/jwks"),
            response=httpx.Response(500),
        ),
        asyncio.TimeoutError("overall timeout"),
        ConnectionError("connection reset"),
        OSError("dns failure"),
    ],
    ids=[
        "connect_error",
        "connect_timeout",
        "read_timeout",
        "http_500",
        "asyncio_timeout",
        "connection_error",
        "os_error",
    ],
)
async def test_jwks_network_error_fails_closed(hs256_verifier, network_error):
    """A network failure while fetching the JWKS must reject the token.

    Remote JWKS verification performs a network call. If that call times out,
    is refused, or returns a non-200, verification cannot complete — the token
    must be rejected (fail CLOSED), never accepted and never surfaced as an
    unhandled 500. This covers raw transport exceptions that could escape the
    upstream conversion to ValueError.
    """
    token = _make_token(
        {"alg": "HS256", "typ": "JWT", "kid": "key-1"},
        {"sub": "user1"},
    )

    with patch.object(
        hs256_verifier,
        "_get_verification_key",
        side_effect=network_error,
    ):
        # Must NOT raise — must resolve to a clean auth failure.
        result = await hs256_verifier.load_access_token(token)

    # Fail closed: no access token granted.
    assert result is None
    # Generic, non-leaking failure reason recorded for the 401 path. Raw
    # transport errors are categorized as a JWKS retrieval failure.
    reason = _jwt_failure_reason.get()
    assert reason == "JWKS verification key unavailable"
    # Underlying error detail must not leak into the reason surfaced to clients.
    assert str(network_error) not in (reason or "")


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
    assert auth_middleware.kwargs["on_error"] is _auth_error_handler


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
        response = _auth_error_handler(mock_conn, exc)

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


@pytest.mark.asyncio
async def test_successful_auth_logged_with_safe_metadata(hs256_verifier, caplog):
    """Successful auth emits an INFO log with safe metadata, no token/secret."""
    future_exp = int(time.time()) + 3600
    token = _make_token(
        {"alg": "HS256", "typ": "JWT"},
        {
            "sub": "user1",
            "iss": "test-issuer",
            "aud": "test-audience",
            "exp": future_exp,
            "scope": "read write",
        },
    )
    claims = {
        "sub": "user1",
        "iss": "test-issuer",
        "aud": "test-audience",
        "exp": future_exp,
        "scope": "read write",
    }

    with caplog.at_level(logging.INFO, logger="superset.mcp_service.jwt_verifier"):
        with patch.object(hs256_verifier.jwt, "decode", return_value=claims):
            result = await hs256_verifier.load_access_token(token)

    assert result is not None

    info_messages = [r.message for r in caplog.records if r.levelno == logging.INFO]
    success_logs = [m for m in info_messages if "authentication succeeded" in m]
    assert success_logs, "Expected an INFO log on successful authentication"
    msg = success_logs[0]
    assert "user1" in msg
    assert "bearer_jwt" in msg
    # The raw token string and HS256 secret must never be logged
    assert token not in msg
    assert "test-secret-key-for-hs256-tokens" not in msg


def test_sanitize_for_log_escapes_newlines():
    """_sanitize_for_log escapes newline/carriage-return/tab to prevent
    log-line injection from attacker-controlled claim values."""
    from superset.mcp_service.jwt_verifier import _sanitize_for_log

    injected = "RS256\nFAKE LOG LINE: admin authenticated"
    sanitized = _sanitize_for_log(injected)

    assert "\n" not in sanitized
    assert "\\n" in sanitized
    assert _sanitize_for_log("a\rb\tc") == "a\\rb\\tc"
    # Backslashes are escaped first so escapes are unambiguous
    assert _sanitize_for_log("a\\nb") == "a\\\\nb"


# -- Strict-mode hardening: algorithm and audience config enforcement --


@pytest.mark.asyncio
async def test_algorithm_none_rejected(hs256_verifier):
    """Unsigned ('none') tokens must always be rejected, even though the
    verifier pins HS256 — defense in depth against alg confusion."""
    token = _make_token(
        {"alg": "none", "typ": "JWT"},
        {"sub": "user1", "iss": "test-issuer", "aud": "test-audience"},
    )

    result = await hs256_verifier.load_access_token(token)

    assert result is None
    assert _jwt_failure_reason.get() == "Algorithm not allowed"


@pytest.mark.asyncio
async def test_algorithm_none_rejected_when_no_algorithm_pinned():
    """When no algorithm is pinned, a 'none' token is still rejected."""
    verifier = DetailedJWTVerifier(
        public_key="test-secret-key-for-hs256-tokens",
        issuer="test-issuer",
        audience="test-audience",
        required_scopes=[],
    )
    # Header alg is case-insensitively matched against the forbidden set.
    token = _make_token(
        {"alg": "NONE", "typ": "JWT"},
        {"sub": "user1", "iss": "test-issuer", "aud": "test-audience"},
    )

    result = await verifier.load_access_token(token)

    assert result is None
    assert _jwt_failure_reason.get() == "Algorithm not allowed"


@pytest.mark.asyncio
async def test_algorithm_null_rejected(hs256_verifier):
    """A header with ``"alg": null`` (JSON null -> Python ``None``) bypasses the
    forbidden-set check (which is ``str``-typed), but the algorithm-mismatch
    guard still rejects it because the verifier pins a concrete algorithm."""
    claims = {"sub": "user1", "iss": "test-issuer", "aud": "test-audience"}
    token = _make_token({"alg": None, "typ": "JWT"}, claims)

    result = await hs256_verifier.load_access_token(token)

    assert result is None
    assert _jwt_failure_reason.get() == "Algorithm mismatch"


def test_algorithm_invariant_is_pinned_after_construction():
    """The mismatch defense (and thus the ``alg: null`` rejection above) relies
    on ``self.algorithm`` always being truthy post-construction. Pin that
    invariant: the factory defaults the algorithm to ``RS256`` when
    ``MCP_JWT_ALGORITHM`` is unset, so a constructed verifier never has a falsy
    algorithm."""
    verifier = DetailedJWTVerifier(
        public_key="test-secret-key-for-hs256-tokens",
        issuer="test-issuer",
        audience="test-audience",
        algorithm="HS256",
        required_scopes=[],
    )
    assert verifier.algorithm is not None
    assert verifier.algorithm


def test_warns_when_audience_not_configured(caplog):
    """Constructing a verifier without an audience logs a clear WARNING that
    audience validation is disabled (config-gated, not a hard failure)."""
    with caplog.at_level(logging.WARNING):
        DetailedJWTVerifier(
            public_key="test-secret-key-for-hs256-tokens",
            issuer="test-issuer",
            audience=None,
            algorithm="HS256",
            required_scopes=[],
        )

    warnings = [r.message for r in caplog.records if r.levelno == logging.WARNING]
    assert any("audience validation is DISABLED" in m for m in warnings)


def test_warns_when_algorithm_not_configured(caplog):
    """A verifier with a falsy algorithm logs a WARNING that the algorithm is
    not pinned. (fastmcp's JWTVerifier coerces ``algorithm=None`` to a default,
    so we exercise the helper directly with an empty algorithm.)"""
    from superset.mcp_service.jwt_verifier import _warn_on_weak_jwt_config

    with caplog.at_level(logging.WARNING):
        _warn_on_weak_jwt_config(audience="test-audience", algorithm=None)

    warnings = [r.message for r in caplog.records if r.levelno == logging.WARNING]
    assert any("without a pinned signing algorithm" in m for m in warnings)


def test_warns_when_algorithm_not_configured_via_constructor(caplog):
    """Constructing a verifier with no pinned algorithm (no app context, so the
    constructor falls back to the explicit ``algorithm`` kwarg) must still emit
    the weak-config WARNING. This exercises the ``config_algorithm or
    explicit_algorithm`` fallback path in ``__init__``, not just the helper."""
    with caplog.at_level(logging.WARNING):
        DetailedJWTVerifier(
            public_key="test-secret-key-for-hs256-tokens",
            issuer="test-issuer",
            audience="test-audience",
            algorithm=None,
            required_scopes=[],
        )

    warnings = [r.message for r in caplog.records if r.levelno == logging.WARNING]
    assert any("without a pinned signing algorithm" in m for m in warnings)


def test_no_weak_config_warning_when_fully_configured(caplog):
    """A fully configured verifier (audience + algorithm) emits no weak-config
    warnings."""
    with caplog.at_level(logging.WARNING):
        DetailedJWTVerifier(
            public_key="test-secret-key-for-hs256-tokens",
            issuer="test-issuer",
            audience="test-audience",
            algorithm="HS256",
            required_scopes=[],
        )

    warnings = [r.message for r in caplog.records if r.levelno == logging.WARNING]
    assert not any("audience validation is DISABLED" in m for m in warnings)
    assert not any("without a pinned signing algorithm" in m for m in warnings)
