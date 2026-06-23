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
"""
Detailed JWT verification for the MCP service.

Provides step-by-step JWT validation with tiered server-side logging:
- WARNING level: generic failure categories only (e.g. "Issuer mismatch")
- DEBUG level: detailed claim values and config for troubleshooting
- Secrets (e.g. HS256 keys) are NEVER logged at any level

HTTP responses always return generic errors per RFC 6750 Section 3.1.
"""

import base64
import logging
import time
from contextvars import ContextVar
from typing import Any, cast

from authlib.jose.errors import (
    BadSignatureError,
    DecodeError,
    ExpiredTokenError,
    JoseError,
)
from fastmcp.server.auth.auth import AccessToken
from fastmcp.server.auth.providers.jwt import JWTVerifier
from mcp.server.auth.middleware.auth_context import AuthContextMiddleware
from mcp.server.auth.middleware.bearer_auth import BearerAuthBackend
from starlette.authentication import AuthenticationError
from starlette.middleware import Middleware
from starlette.middleware.authentication import AuthenticationMiddleware
from starlette.requests import HTTPConnection
from starlette.responses import JSONResponse

from superset.utils import json

logger = logging.getLogger(__name__)

# Thread-safe storage for the specific JWT failure reason.
# Set by DetailedJWTVerifier.load_access_token() on failure,
# read by DetailedBearerAuthBackend.authenticate() to raise
# an AuthenticationError with the specific reason.
# SECURITY: Must ALWAYS contain generic failure categories only.
# Claim values and secrets must NEVER be stored here.
_jwt_failure_reason: ContextVar[str | None] = ContextVar(
    "_jwt_failure_reason", default=None
)


def _json_auth_error_handler(
    conn: HTTPConnection, exc: AuthenticationError
) -> JSONResponse:
    """JSON 401 error handler for authentication failures.

    Per RFC 6750 Section 3.1, error responses MUST NOT leak server
    configuration or token claim values. Only generic error codes are
    returned to clients. Detailed failure reasons are logged server-side
    only for debugging.

    References:
        - RFC 6750 Section 3.1: https://datatracker.ietf.org/doc/html/rfc6750#section-3.1
        - CVE-2022-29266, CVE-2019-7644: verbose JWT errors led to exploits
    """
    # Log detailed reason server-side only
    logger.warning("JWT authentication failed: %s", exc)

    return JSONResponse(
        status_code=401,
        content={
            "error": "invalid_token",
            "error_description": "Authentication failed",
        },
        headers={
            "WWW-Authenticate": 'Bearer error="invalid_token"',
        },
    )


class DetailedBearerAuthBackend(BearerAuthBackend):
    """
    Bearer auth backend that raises AuthenticationError with specific
    JWT failure reasons instead of silently returning None.
    """

    async def authenticate(self, conn: HTTPConnection) -> tuple[Any, Any] | None:
        result = await super().authenticate(conn)

        if result is not None:
            # Clear any stale failure reason on success
            _jwt_failure_reason.set(None)
            return result

        # Check if there's a Bearer token present - if so, there was a
        # validation failure we can report with a specific reason
        auth_header = next(
            (
                conn.headers.get(key)
                for key in conn.headers
                if key.lower() == "authorization"
            ),
            None,
        )
        if auth_header and auth_header.lower().startswith("bearer "):
            reason = _jwt_failure_reason.get()
            if reason:
                _jwt_failure_reason.set(None)
                raise AuthenticationError(reason)

        return None


class DetailedJWTVerifier(JWTVerifier):
    """
    JWT verifier with tiered server-side logging for each validation step.

    Logging tiers:
    - WARNING: generic failure categories only (via _jwt_failure_reason ContextVar
      and the error handler). No claim values, no server config.
    - DEBUG: detailed values (issuer, audience, client_id, scopes, exceptions)
      for operator troubleshooting.
    - Secrets (e.g. HS256 signing keys) are NEVER logged at any level.

    HTTP responses always return generic errors per RFC 6750 Section 3.1.
    Controlled by MCP_JWT_DEBUG_ERRORS config flag.
    """

    async def load_access_token(self, token: str) -> AccessToken | None:  # noqa: C901
        """
        Validate a JWT bearer token with detailed error reporting.

        Each validation step stores a specific failure reason in the
        _jwt_failure_reason ContextVar before returning None.
        """
        # Reset any previous failure reason
        _jwt_failure_reason.set(None)

        try:
            # Step 1: Decode header and check algorithm
            try:
                header = self._decode_token_header(token)
            except (ValueError, DecodeError) as e:
                reason = "Malformed token header"
                _jwt_failure_reason.set(reason)
                logger.debug("Malformed token header: %s", e)
                return None

            token_alg = header.get("alg")
            if self.algorithm and token_alg != self.algorithm:
                reason = "Algorithm mismatch"
                _jwt_failure_reason.set(reason)
                logger.debug(
                    "Algorithm mismatch: token uses '%s', expected '%s'",
                    token_alg,
                    self.algorithm,
                )
                return None

            # Step 2: Get verification key (static or JWKS)
            try:
                verification_key = await self._get_verification_key(token)
            except ValueError as e:
                reason = "Failed to get verification key"
                _jwt_failure_reason.set(reason)
                logger.debug("Failed to get verification key: %s", e)
                return None

            # Step 3: Decode and verify signature
            try:
                claims = self.jwt.decode(token, verification_key)
            except BadSignatureError:
                reason = "Signature verification failed"
                _jwt_failure_reason.set(reason)
                return None
            except ExpiredTokenError:
                reason = "Token has expired (detected during decode)"
                _jwt_failure_reason.set(reason)
                return None
            except JoseError as e:
                reason = "Token decode failed"
                _jwt_failure_reason.set(reason)
                logger.debug("Token decode failed: %s", e)
                return None

            # Extract client ID for logging
            client_id = (
                claims.get("client_id")
                or claims.get("azp")
                or claims.get("sub")
                or "unknown"
            )

            # Step 4: Check expiration
            exp = claims.get("exp")
            if exp and exp < time.time():
                reason = "Token expired"
                _jwt_failure_reason.set(reason)
                logger.debug("Token expired for client '%s'", client_id)
                return None

            # Step 5: Validate issuer
            if self.issuer:
                iss = claims.get("iss")
                if isinstance(self.issuer, list):
                    issuer_valid = iss in self.issuer
                else:
                    issuer_valid = iss == self.issuer

                if not issuer_valid:
                    reason = "Issuer mismatch"
                    _jwt_failure_reason.set(reason)
                    logger.debug(
                        "Issuer mismatch: token has '%s', expected '%s'",
                        iss,
                        self.issuer,
                    )
                    return None

            # Step 6: Validate audience
            if self.audience:
                aud = claims.get("aud")
                if isinstance(self.audience, list):
                    if isinstance(aud, list):
                        audience_valid = any(
                            expected in aud
                            for expected in cast(list[str], self.audience)
                        )
                    else:
                        audience_valid = aud in cast(list[str], self.audience)
                else:
                    if isinstance(aud, list):
                        audience_valid = self.audience in aud
                    else:
                        audience_valid = aud == self.audience

                if not audience_valid:
                    reason = "Audience mismatch"
                    _jwt_failure_reason.set(reason)
                    logger.debug(
                        "Audience mismatch: token has '%s', expected '%s'",
                        aud,
                        self.audience,
                    )
                    return None

            # Step 7: Check required scopes
            scopes = self._extract_scopes(claims)
            if self.required_scopes:
                token_scopes = set(scopes)
                required = set(self.required_scopes)
                if not required.issubset(token_scopes):
                    missing = required - token_scopes
                    reason = "Missing required scopes"
                    _jwt_failure_reason.set(reason)
                    logger.debug(
                        "Missing required scopes: %s. Token has: %s",
                        missing,
                        token_scopes,
                    )
                    return None

            # All validations passed
            return AccessToken(
                token=token,
                client_id=str(client_id),
                scopes=scopes,
                expires_at=int(exp) if exp else None,
                claims=dict(claims),
            )

        except (ValueError, JoseError, KeyError, AttributeError, TypeError) as e:
            reason = "Token validation failed"
            _jwt_failure_reason.set(reason)
            logger.debug("Token validation failed: %s", e)
            return None

    def get_middleware(self) -> list[Any]:
        """
        Get middleware with detailed server-side error logging.

        Uses DetailedBearerAuthBackend which raises AuthenticationError
        with specific reasons for server-side logging. The error handler
        always returns generic 401 responses per RFC 6750.
        """
        return [
            Middleware(
                AuthenticationMiddleware,
                backend=DetailedBearerAuthBackend(self),
                on_error=_json_auth_error_handler,
            ),
            Middleware(AuthContextMiddleware),
        ]

    @staticmethod
    def _decode_token_header(token: str) -> dict[str, Any]:
        """Decode the JWT header without verifying the signature."""
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError(
                f"Token must have 3 parts (header.payload.signature), got {len(parts)}"
            )
        header_b64 = parts[0]
        # Add padding only if needed
        header_b64 += "=" * (-len(header_b64) % 4)
        header_bytes = base64.urlsafe_b64decode(header_b64)
        return json.loads(header_bytes)
