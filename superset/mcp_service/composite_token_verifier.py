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
Composite token verifier for MCP authentication.

Routes Bearer tokens to the appropriate verifier based on prefix:
- Tokens matching FAB_API_KEY_PREFIXES (e.g. ``sst_``) are validated against
  the FAB database at the transport layer. Invalid keys are rejected before
  any MCP method (tools/list, resources/list, tool calls) is reached.
- All other tokens are delegated to the wrapped JWT verifier (when one is
  configured); when no JWT verifier is configured, non-API-key tokens are
  rejected at the transport layer.
"""

import asyncio
import logging
from typing import Any

from fastmcp.server.auth import AccessToken
from fastmcp.server.auth.providers.jwt import TokenVerifier

logger = logging.getLogger(__name__)

# Namespaced claim that flags an AccessToken as an API-key token.
# Namespacing avoids collision with custom claims an external IdP might
# happen to mint on a JWT — a plain ``_api_key_passthrough`` claim could
# be silently misidentified as a Superset API-key request.
API_KEY_PASSTHROUGH_CLAIM = "_superset_mcp_api_key_passthrough"

# Claim that carries the FAB-validated username after transport-layer
# API key validation. When present, ``_resolve_user_from_api_key`` skips
# the second DB call and loads the user directly by username.
API_KEY_VALIDATED_USERNAME_CLAIM = "_superset_mcp_validated_username"


class CompositeTokenVerifier(TokenVerifier):
    """Routes Bearer tokens between API key validation and JWT verification.

    API key tokens (identified by prefix) are validated against the FAB
    database at the transport layer so that invalid keys are rejected before
    any MCP method (tools/list, resources/list, tool calls) is reached.

    Args:
        jwt_verifier: The wrapped JWT verifier for non-API-key tokens.
            When ``None``, only API-key tokens are accepted; all other
            Bearer tokens are rejected at the transport layer (used when
            ``MCP_AUTH_ENABLED=False`` but ``FAB_API_KEY_ENABLED=True``).
        api_key_prefixes: List of prefixes that identify API key tokens
            (e.g. ``["sst_"]``).
        app: Flask application instance used to push an app context for
            FAB SecurityManager access during token validation. When
            ``None``, prefix matching is used without DB validation
            (backward-compatible / test mode).
    """

    def __init__(
        self,
        jwt_verifier: TokenVerifier | None,
        api_key_prefixes: list[str],
        app: Any = None,
    ) -> None:
        super().__init__(
            base_url=getattr(jwt_verifier, "base_url", None),
            required_scopes=getattr(jwt_verifier, "required_scopes", None) or [],
        )
        self._jwt_verifier = jwt_verifier
        self._app = app
        if app is None:
            logger.warning(
                "CompositeTokenVerifier created without a Flask app; API keys "
                "will not be validated at the transport layer. Invalid keys are "
                "rejected later at the Flask layer instead. Pass app=<flask_app> "
                "to enable transport-layer rejection."
            )
        valid: list[str] = []
        invalid_count = 0
        for prefix in api_key_prefixes:
            if isinstance(prefix, str) and (normalized := prefix.strip()):
                valid.append(normalized)
            else:
                invalid_count += 1
        if invalid_count:
            # Log count only — actual values may be config secrets
            # (CodeQL py/clear-text-logging-sensitive-data).
            logger.warning(
                "FAB_API_KEY_PREFIXES has %d invalid entries (empty/non-string)"
                " — ignored",
                invalid_count,
            )
        self._api_key_prefixes = tuple(valid)

    def _validate_api_key_sync(self, token: str) -> str | None:
        """Validate an API key against FAB and return the owner's username.

        Runs synchronously inside a thread executor. Pushes a fresh Flask
        app context so that FAB's SecurityManager can access the database.

        Returns the username on success, or ``None`` if the key is invalid,
        FAB does not support ``validate_api_key``, or an unexpected error
        occurs (fail closed).
        """
        if self._app is None:
            return None
        try:
            with self._app.app_context():
                sm = self._app.appbuilder.sm
                if not hasattr(sm, "validate_api_key"):
                    logger.warning(
                        "FAB SecurityManager does not support validate_api_key; "
                        "rejecting API key token at transport"
                    )
                    return None
                user = sm.validate_api_key(token)
                username = user.username if user else None
                # Unbind the local reference so this frame no longer points at
                # the raw token (defense-in-depth). Python does not zero the
                # underlying string memory on rebind.
                token = ""  # noqa: S105
                return username
        except Exception:  # noqa: BLE001 — catch-all: DB errors, FAB internals, etc.
            logger.warning(
                "API key transport validation failed unexpectedly; rejecting token",
                exc_info=True,
            )
            return None

    async def verify_token(self, token: str) -> AccessToken | None:
        """Verify a Bearer token.

        For API key tokens (prefix match):
        - When a Flask app is configured, validates the key against FAB at
          the transport layer and rejects invalid keys with a transport-level
          401 before any MCP method is reached.
        - When no app is configured (test/compat mode), falls back to prefix-
          only acceptance and defers DB validation to the Flask layer.

        For all other tokens, delegates to the wrapped JWT verifier when one
        is configured; rejects if no JWT verifier is configured.
        """
        if any(token.startswith(prefix) for prefix in self._api_key_prefixes):
            if self._app is not None:
                loop = asyncio.get_running_loop()
                username = await loop.run_in_executor(
                    None, self._validate_api_key_sync, token
                )
                if username is None:
                    logger.debug(
                        "API key rejected at transport layer (invalid or expired)"
                    )
                    return None
                logger.debug(
                    "API key validated at transport layer for user=%s", username
                )
                return AccessToken(
                    token=token,
                    client_id="api_key",
                    scopes=list(self.required_scopes or []),
                    claims={
                        API_KEY_PASSTHROUGH_CLAIM: True,
                        API_KEY_VALIDATED_USERNAME_CLAIM: username,
                    },
                )

            # No app configured: fall back to prefix-only pass-through so
            # ``_resolve_user_from_api_key`` handles DB validation.
            # NOTE: ``MCP_REQUIRED_SCOPES`` is intentionally not enforced for
            # API-key auth — FAB API keys do not carry scopes. Authorization is
            # enforced downstream via ``check_tool_permission`` (RBAC).
            logger.debug("API key token detected (prefix match), passing through")
            return AccessToken(
                token=token,
                client_id="api_key",
                scopes=list(self.required_scopes or []),
                claims={API_KEY_PASSTHROUGH_CLAIM: True},
            )

        if self._jwt_verifier is None:
            logger.debug(
                "Bearer token does not match any API key prefix and no JWT "
                "verifier is configured; rejecting"
            )
            return None

        return await self._jwt_verifier.verify_token(token)
