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

Provides step-by-step JWT validation with specific error messages
instead of the generic "invalid_token" response from the base JWTVerifier.
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
_jwt_failure_reason: ContextVar[str | None] = ContextVar(
    "_jwt_failure_reason", default=None
)


def _sanitize_header_value(value: str) -> str:
    """Sanitize a string for safe use in HTTP header values.

    Removes/replaces characters that could enable header injection
    (CR, LF, quotes) from attacker-controlled JWT claims.
    """
    return value.replace("\r", " ").replace("\n", " ").replace('"', "'")


def _json_auth_error_handler(
    conn: HTTPConnection, exc: AuthenticationError
) -> JSONResponse:
    """Return a JSON 401 response with the specific JWT failure reason."""
    reason = str(exc)
    safe_reason = _sanitize_header_value(reason)
    return JSONResponse(
        status_code=401,
        content={
            "error": "invalid_token",
            "error_description": reason,
        },
        headers={
            "WWW-Authenticate": f'Bearer error="invalid_token", '
            f'error_description="{safe_reason}"',
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
    JWT verifier that provides specific error messages for each
    validation failure instead of generic "invalid_token".

    Overrides load_access_token() to perform step-by-step validation,
    storing the specific failure reason in a ContextVar that the
    custom BearerAuthBackend reads to return a descriptive 401 response.
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
                reason = f"Malformed token header: {e}"
                _jwt_failure_reason.set(reason)
                logger.warning(reason)
                return None

            token_alg = header.get("alg")
            if self.algorithm and token_alg != self.algorithm:
                reason = (
                    f"Algorithm mismatch: token uses '{token_alg}', "
                    f"expected '{self.algorithm}'"
                )
                _jwt_failure_reason.set(reason)
                logger.warning(reason)
                return None

            # Step 2: Get verification key (static or JWKS)
            try:
                verification_key = await self._get_verification_key(token)
            except ValueError as e:
                reason = f"Failed to get verification key: {e}"
                _jwt_failure_reason.set(reason)
                logger.warning(reason)
                return None

            # Step 3: Decode and verify signature
            try:
                claims = self.jwt.decode(token, verification_key)
            except BadSignatureError:
                reason = "Signature verification failed"
                _jwt_failure_reason.set(reason)
                logger.warning(reason)
                return None
            except ExpiredTokenError:
                reason = "Token has expired (detected during decode)"
                _jwt_failure_reason.set(reason)
                logger.warning(reason)
                return None
            except JoseError as e:
                reason = f"Token decode failed: {e}"
                _jwt_failure_reason.set(reason)
                logger.warning(reason)
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
                reason = f"Token expired for client '{client_id}'"
                _jwt_failure_reason.set(reason)
                logger.warning(reason)
                return None

            # Step 5: Validate issuer
            if self.issuer:
                iss = claims.get("iss")
                if isinstance(self.issuer, list):
                    issuer_valid = iss in self.issuer
                else:
                    issuer_valid = iss == self.issuer

                if not issuer_valid:
                    reason = (
                        f"Issuer mismatch: token has '{iss}', expected '{self.issuer}'"
                    )
                    _jwt_failure_reason.set(reason)
                    logger.warning(reason)
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
                    reason = (
                        f"Audience mismatch: token has '{aud}', "
                        f"expected '{self.audience}'"
                    )
                    _jwt_failure_reason.set(reason)
                    logger.warning(reason)
                    return None

            # Step 7: Check required scopes
            scopes = self._extract_scopes(claims)
            if self.required_scopes:
                token_scopes = set(scopes)
                required = set(self.required_scopes)
                if not required.issubset(token_scopes):
                    missing = required - token_scopes
                    reason = (
                        f"Missing required scopes: {missing}. Token has: {token_scopes}"
                    )
                    _jwt_failure_reason.set(reason)
                    logger.warning(reason)
                    return None

            # All validations passed
            logger.info("JWT validated for client '%s'", client_id)
            return AccessToken(
                token=token,
                client_id=str(client_id),
                scopes=scopes,
                expires_at=int(exp) if exp else None,
                claims=dict(claims),
            )

        except Exception as e:
            reason = f"Token validation failed: {e}"
            _jwt_failure_reason.set(reason)
            logger.warning(reason)
            return None

    def get_middleware(self) -> list[Any]:
        """
        Get middleware with detailed error reporting.

        Uses DetailedBearerAuthBackend which raises AuthenticationError
        with specific reasons, and a JSON error handler that returns
        structured 401 responses.
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
