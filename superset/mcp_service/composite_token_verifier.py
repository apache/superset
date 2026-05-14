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
- Tokens matching FAB_API_KEY_PREFIXES (e.g. ``sst_``) are passed through
  to the Flask layer where ``_resolve_user_from_api_key()`` handles
  actual validation via FAB SecurityManager.
- All other tokens are delegated to the wrapped JWT verifier (when one is
  configured); when no JWT verifier is configured, non-API-key tokens are
  rejected at the transport layer.
"""

import logging

from fastmcp.server.auth import AccessToken
from fastmcp.server.auth.providers.jwt import TokenVerifier

logger = logging.getLogger(__name__)

# Namespaced claim that flags an AccessToken as an API-key pass-through.
# Namespacing avoids collision with custom claims an external IdP might
# happen to mint on a JWT — a plain ``_api_key_passthrough`` claim could
# be silently misidentified as a Superset API-key request.
API_KEY_PASSTHROUGH_CLAIM = "_superset_mcp_api_key_passthrough"


class CompositeTokenVerifier(TokenVerifier):
    """Routes Bearer tokens between API key pass-through and JWT verification.

    API key tokens (identified by prefix) are accepted at the transport layer
    with a marker claim so that ``_resolve_user_from_jwt_context()`` can
    detect them and fall through to ``_resolve_user_from_api_key()`` for
    actual validation.

    Args:
        jwt_verifier: The wrapped JWT verifier for non-API-key tokens.
            When ``None``, only API-key tokens are accepted; all other
            Bearer tokens are rejected at the transport layer (used when
            ``MCP_AUTH_ENABLED=False`` but ``FAB_API_KEY_ENABLED=True``).
        api_key_prefixes: List of prefixes that identify API key tokens
            (e.g. ``["sst_"]``).
    """

    def __init__(
        self,
        jwt_verifier: TokenVerifier | None,
        api_key_prefixes: list[str],
    ) -> None:
        super().__init__(
            base_url=getattr(jwt_verifier, "base_url", None),
            required_scopes=getattr(jwt_verifier, "required_scopes", None) or [],
        )
        self._jwt_verifier = jwt_verifier
        valid: list[str] = [
            p for p in api_key_prefixes if isinstance(p, str) and p.strip()
        ]
        invalid = [p for p in api_key_prefixes if p not in valid]
        if invalid:
            logger.warning(
                "FAB_API_KEY_PREFIXES contains invalid entries (ignored): %r", invalid
            )
        self._api_key_prefixes = tuple(valid)

    async def verify_token(self, token: str) -> AccessToken | None:
        """Verify a Bearer token.

        If the token starts with an API key prefix, return a pass-through
        AccessToken with the namespaced ``API_KEY_PASSTHROUGH_CLAIM``
        (``_superset_mcp_api_key_passthrough``). The Flask-layer
        ``_resolve_user_from_api_key()`` performs the real validation.

        Otherwise, delegate to the wrapped JWT verifier when one is
        configured; if no JWT verifier is configured, reject the token.
        """
        if any(token.startswith(prefix) for prefix in self._api_key_prefixes):
            logger.debug("API key token detected (prefix match), passing through")
            # Populate ``scopes`` from ``self.required_scopes`` so FastMCP's
            # ``RequireAuthMiddleware`` (transport-layer scope check) is
            # satisfied for API-key requests. Without this, MCP_REQUIRED_SCOPES
            # being non-empty would 403 every API-key call before
            # ``_resolve_user_from_api_key`` even runs.
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
