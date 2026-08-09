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

"""Identity-binding behavior of ``_resolve_user_from_jwt_context`` when more
than one JWT issuer is trusted (``MCP_JWT_ISSUER`` configured as a list) and
no custom ``MCP_USER_RESOLVER`` is provided.

The default resolver (``default_user_resolver``) derives a Superset username
from token claims (``preferred_username`` / ``username`` / ``email`` / ``sub``)
without folding the token's ``iss`` claim into the lookup key. These tests
pin down what that means in practice: two tokens with different ``iss``
values but the same username claim resolve to the identical Superset user,
with the DB lookup performed on username alone.

The module emits a WARNING in this configuration (see
``test_auth_user_resolution.test_multi_issuer_warns_without_custom_resolver``)
but does not change the resolution behavior. These tests intentionally assert
the current (pre-fix) behavior so that a later change binding identity to
``iss`` (e.g. a compound iss+sub key, or failing closed when no issuer-aware
resolver is configured) will need this test updated alongside it.
"""

from unittest.mock import MagicMock, patch

from superset.mcp_service.auth import _resolve_user_from_jwt_context


def _make_mock_user(username: str = "alice") -> MagicMock:
    user = MagicMock()
    user.username = username
    user.roles = []
    user.groups = []
    return user


def _make_access_token(claims: dict[str, str]) -> MagicMock:
    token = MagicMock()
    token.claims = claims
    token.client_id = ""
    token.scopes = []
    for attr in ("subject", "payload"):
        delattr(token, attr)
    return token


def test_same_username_from_different_trusted_issuers_resolves_to_same_user(
    app,
) -> None:
    """Two trusted issuers minting the same username claim are not
    distinguished by the default resolver: both resolve to one Superset
    user, and the DB lookup is performed by username only (no ``iss``
    component), when ``MCP_JWT_ISSUER`` is a multi-issuer list and no
    ``MCP_USER_RESOLVER`` override is configured."""
    shared_user = _make_mock_user("alice")
    token_from_issuer_a = _make_access_token(
        claims={"sub": "alice", "iss": "https://issuer-a.example.com"}
    )
    token_from_issuer_b = _make_access_token(
        claims={"sub": "alice", "iss": "https://issuer-b.example.com"}
    )

    with app.app_context():
        app.config["MCP_JWT_ISSUER"] = [
            "https://issuer-a.example.com",
            "https://issuer-b.example.com",
        ]
        app.config.pop("MCP_USER_RESOLVER", None)
        try:
            with (
                patch(
                    "fastmcp.server.dependencies.get_access_token",
                    return_value=token_from_issuer_a,
                ),
                patch(
                    "superset.mcp_service.auth.load_user_with_relationships",
                    return_value=shared_user,
                ) as mock_load_a,
            ):
                result_a = _resolve_user_from_jwt_context(app)

            with (
                patch(
                    "fastmcp.server.dependencies.get_access_token",
                    return_value=token_from_issuer_b,
                ),
                patch(
                    "superset.mcp_service.auth.load_user_with_relationships",
                    return_value=shared_user,
                ) as mock_load_b,
            ):
                result_b = _resolve_user_from_jwt_context(app)
        finally:
            app.config.pop("MCP_JWT_ISSUER", None)

    # Both issuers resolve to the exact same Superset identity.
    assert result_a is shared_user
    assert result_b is shared_user

    # The lookup key passed to the DB layer is username-only: neither call
    # includes the token's `iss` claim, confirming resolution is not
    # issuer-scoped for this (unsupported but reachable) configuration.
    mock_load_a.assert_called_once_with("alice")
    mock_load_b.assert_called_once_with("alice")


def test_multi_issuer_without_custom_resolver_does_not_fail_closed(app) -> None:
    """The module logs a warning about the unbound multi-issuer configuration
    (see test_auth_user_resolution.py) but still returns a resolved user
    rather than refusing to authenticate the request."""
    mock_user = _make_mock_user("alice")
    token = _make_access_token(
        claims={"sub": "alice", "iss": "https://issuer-a.example.com"}
    )

    with app.app_context():
        app.config["MCP_JWT_ISSUER"] = [
            "https://issuer-a.example.com",
            "https://issuer-b.example.com",
        ]
        app.config.pop("MCP_USER_RESOLVER", None)
        try:
            with (
                patch(
                    "fastmcp.server.dependencies.get_access_token",
                    return_value=token,
                ),
                patch(
                    "superset.mcp_service.auth.load_user_with_relationships",
                    return_value=mock_user,
                ),
            ):
                result = _resolve_user_from_jwt_context(app)
        finally:
            app.config.pop("MCP_JWT_ISSUER", None)

    assert result is mock_user
