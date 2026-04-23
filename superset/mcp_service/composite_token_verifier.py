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
- All other tokens are delegated to the wrapped JWT verifier.
"""

import logging

from fastmcp.server.auth import AccessToken
from fastmcp.server.auth.providers.jwt import TokenVerifier

logger = logging.getLogger(__name__)


class CompositeTokenVerifier(TokenVerifier):
    """Routes Bearer tokens between API key pass-through and JWT verification.

    API key tokens (identified by prefix) are accepted at the transport layer
    with a marker claim so that ``_resolve_user_from_jwt_context()`` can
    detect them and fall through to ``_resolve_user_from_api_key()`` for
    actual validation.

    Args:
        jwt_verifier: The wrapped JWT verifier for non-API-key tokens.
        api_key_prefixes: List of prefixes that identify API key tokens
            (e.g. ``["sst_"]``).
    """

    def __init__(
        self,
        jwt_verifier: TokenVerifier,
        api_key_prefixes: list[str],
    ) -> None:
        super().__init__(
            base_url=getattr(jwt_verifier, "base_url", None),
            required_scopes=jwt_verifier.required_scopes,
        )
        self._jwt_verifier = jwt_verifier
        self._api_key_prefixes = tuple(api_key_prefixes)

    async def verify_token(self, token: str) -> AccessToken | None:
        """Verify a Bearer token.

        If the token starts with an API key prefix, return a pass-through
        AccessToken with a ``_api_key_passthrough`` claim. The Flask-layer
        ``_resolve_user_from_api_key()`` performs the real validation.

        Otherwise, delegate to the wrapped JWT verifier.
        """
        if any(token.startswith(prefix) for prefix in self._api_key_prefixes):
            logger.debug("API key token detected (prefix match), passing through")
            return AccessToken(
                token=token,
                client_id="api_key",
                scopes=[],
                claims={"_api_key_passthrough": True},
            )

        return await self._jwt_verifier.verify_token(token)
