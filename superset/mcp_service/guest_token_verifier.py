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
Guest-token verifier for the MCP service.

Recognizes Superset embedded *guest tokens* presented as MCP Bearer tokens and
validates them by reusing core's guest-token machinery
(``SupersetSecurityManager``): signature/expiry/audience via
``parse_jwt_guest_token`` (HS256 against ``GUEST_TOKEN_JWT_SECRET``), the same
structural claim checks the web embedded flow runs, and revocation via
``_is_guest_token_revoked``.

This verifier runs BEFORE the JWT verifier in ``CompositeTokenVerifier``: the MCP
JWT verifier pins its own algorithm/keys (default RS256 against the MCP
JWKS/keys) and would reject an HS256 guest token before any resolution code runs,
so guest tokens must be recognized at a verifier that runs first.

Gated behind ``MCP_EMBEDDED_GUEST_AUTH_ENABLED`` (opt-in, default False) AND the
``EMBEDDED_SUPERSET`` feature flag. On any failure the verifier returns ``None``
so the token falls through to the next verifier — mirroring the web request
loader, which returns ``None`` for an invalid guest token rather than raising.
"""

import asyncio
import logging
from typing import Any

from fastmcp.server.auth import AccessToken
from fastmcp.server.auth.providers.jwt import TokenVerifier

logger = logging.getLogger(__name__)

# Namespaced claim flagging an AccessToken as a verified guest token. The paired
# ``client_id == "guest"`` check keeps an external IdP JWT from posing as a guest.
GUEST_TOKEN_CLAIM: str = "_superset_mcp_guest_token"  # noqa: S105


class GuestTokenVerifier(TokenVerifier):
    """Verifies Superset embedded guest tokens for the MCP transport.

    Args:
        app: Flask application used to push an app context so the core
            SecurityManager (and the metadata DB, for revocation) is reachable
            during validation. When ``None`` the verifier is a no-op and
            returns ``None`` for every token.
    """

    def __init__(self, app: Any = None) -> None:
        super().__init__(base_url=None, required_scopes=[])
        self._app = app
        if app is None:
            logger.warning(
                "GuestTokenVerifier created without a Flask app; guest tokens "
                "cannot be validated and will be rejected."
            )

    def _verify_guest_sync(self, token: str) -> dict[str, Any] | None:
        """Validate a guest token against core's guest-token machinery.

        Runs in a thread executor under a fresh app context (SecurityManager +
        metadata DB reachable). Returns the validated claims, or ``None`` on any
        failure (defer to the next verifier). Revocation is checked here, matching
        the web flow.
        """
        if self._app is None:
            return None
        try:
            with self._app.app_context():
                # Deferred: is_feature_enabled isn't bound until app init completes.
                from superset import is_feature_enabled

                # Defense-in-depth: the verifier is only constructed when these
                # are enabled, but never honor a guest token if embedding is off.
                if not is_feature_enabled("EMBEDDED_SUPERSET"):
                    return None
                if not self._app.config.get("MCP_EMBEDDED_GUEST_AUTH_ENABLED", False):
                    return None

                sm = self._app.appbuilder.sm
                try:
                    parsed = sm.parse_jwt_guest_token(token)
                except Exception:  # noqa: BLE001 — not a guest token / bad sig / exp
                    # Most Bearer tokens aren't guest tokens (e.g. a regular OIDC
                    # JWT for the JWT verifier); keep quiet and fall through.
                    logger.debug("Bearer token is not a valid guest token; deferring")
                    return None

                # Mirror the web embedded flow's structural validation
                # (SupersetSecurityManager.get_guest_user_from_request).
                if (
                    not isinstance(parsed, dict)
                    or parsed.get("user") is None
                    or parsed.get("resources") is None
                    or parsed.get("rls_rules") is None
                    or parsed.get("type") != "guest"
                ):
                    logger.debug("Guest token failed structural validation; deferring")
                    return None

                if sm._is_guest_token_revoked(parsed):  # noqa: SLF001
                    logger.debug("Guest token has been revoked; rejecting")
                    return None

                # GuestUser is built from GUEST_ROLE_NAME; a missing role fails
                # RBAC confusingly, so reject up front with an actionable message.
                role_name = self._app.config["GUEST_ROLE_NAME"]
                if sm.find_role(role_name) is None:
                    logger.error(
                        "Guest token is valid but the guest role GUEST_ROLE_NAME=%r "
                        "does not exist; rejecting. Create the role to enable "
                        "embedded guest access over MCP.",
                        role_name,
                    )
                    return None

                return parsed
        except Exception:  # noqa: BLE001 — DB errors, FAB internals, etc.
            logger.warning(
                "Guest token transport validation failed unexpectedly; rejecting",
                exc_info=True,
            )
            return None

    async def verify_token(self, token: str) -> AccessToken | None:
        """Return a guest ``AccessToken`` when ``token`` is a valid guest token.

        Returns ``None`` (defer to the next verifier) when guest auth is disabled
        or the token is not a valid, non-revoked guest token.
        """
        if self._app is None:
            return None
        # Cheap opt-in gate before paying for a thread dispatch + DB work.
        if not self._app.config.get("MCP_EMBEDDED_GUEST_AUTH_ENABLED", False):
            return None

        try:
            loop = asyncio.get_running_loop()
            parsed = await loop.run_in_executor(None, self._verify_guest_sync, token)
        except Exception:  # noqa: BLE001 — asyncio/executor machinery failure
            # Honor the "any failure -> defer" contract even if the dispatch
            # itself fails (e.g. executor shutdown, no running loop).
            logger.warning(
                "Guest token verification dispatch failed; deferring", exc_info=True
            )
            return None

        if parsed is None:
            return None

        try:
            expires_at = int(parsed["exp"])
        except (KeyError, TypeError, ValueError):
            # parse_jwt_guest_token validates exp, but never raise here on a
            # missing/malformed claim — defer like every other failure path.
            logger.warning("Guest token lacks a valid exp claim; deferring")
            return None

        logger.debug("Guest token validated at transport layer for MCP")
        return AccessToken(
            token=token,
            client_id="guest",
            scopes=[],
            expires_at=expires_at,
            claims={GUEST_TOKEN_CLAIM: True, **parsed},
        )
