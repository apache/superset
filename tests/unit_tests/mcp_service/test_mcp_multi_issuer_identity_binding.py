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
than one JWT issuer is trusted (``MCP_JWT_ISSUER`` configured as a list).

The default resolver (``default_user_resolver``) derives a Superset username
from token claims (``preferred_username`` / ``username`` / ``email`` / ``sub``)
without folding the token's ``iss`` claim into the lookup key. Without an
issuer-aware ``MCP_USER_RESOLVER``, two tokens minted by different trusted
issuers but sharing a username claim would otherwise resolve to the
identical Superset user, since the DB lookup would be performed on username
alone.

To prevent that, ``_resolve_user_from_jwt_context`` fails closed (raises
``MCPAuthConfigError``) when more than one issuer is trusted and no custom
``MCP_USER_RESOLVER`` is configured, instead of proceeding with a lookup that
isn't scoped to the trusted issuer. An operator-supplied, issuer-aware
resolver (e.g. one deriving a compound iss+sub identity) is unaffected and
continues to resolve normally.
"""

from unittest.mock import MagicMock, patch

import pytest

from superset.mcp_service.auth import _resolve_user_from_jwt_context
from superset.mcp_service.mcp_config import (
    MCPAuthConfigError,
    validate_multi_issuer_user_resolver,
)


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


def test_multi_issuer_without_custom_resolver_fails_closed(app) -> None:
    """Multiple trusted issuers with no issuer-aware ``MCP_USER_RESOLVER``
    refuses to resolve an identity rather than performing a username-only
    lookup that isn't scoped to the trusted issuer."""
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
            with patch(
                "fastmcp.server.dependencies.get_access_token",
                return_value=token,
            ):
                with pytest.raises(MCPAuthConfigError):
                    _resolve_user_from_jwt_context(app)
        finally:
            app.config.pop("MCP_JWT_ISSUER", None)


def test_duplicate_issuer_entries_do_not_fail_closed(app) -> None:
    """A list/tuple naming the same issuer more than once is one logical
    issuer, not a multi-issuer trust configuration -- deduplicate before
    counting so ``MCP_JWT_ISSUER = ["a", "a"]`` doesn't trigger the guard
    the way ``["a", "b"]`` correctly does."""
    token = _make_access_token(
        claims={"sub": "alice", "iss": "https://issuer-a.example.com"}
    )
    shared_user = _make_mock_user("alice")

    with app.app_context():
        app.config["MCP_JWT_ISSUER"] = [
            "https://issuer-a.example.com",
            "https://issuer-a.example.com",
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
                    return_value=shared_user,
                ),
            ):
                result = _resolve_user_from_jwt_context(app)
        finally:
            app.config.pop("MCP_JWT_ISSUER", None)

    assert result is shared_user


def test_unhashable_issuer_entries_fail_closed_not_typeerror(app) -> None:
    """A malformed ``MCP_JWT_ISSUER`` containing unhashable entries (e.g. a
    nested list from a bad config template) must still fail closed with
    ``MCPAuthConfigError``, not raise a bare ``TypeError`` from ``set()``.
    A plain ``TypeError`` isn't caught by the ``except MCPAuthConfigError``
    re-raise in ``_create_auth_provider``, so it would be swallowed by the
    trailing ``except Exception`` there and start the server unauthenticated."""
    with app.app_context():
        app.config["MCP_JWT_ISSUER"] = [["issuer-a"], ["issuer-b"]]
        app.config.pop("MCP_USER_RESOLVER", None)
        try:
            with pytest.raises(MCPAuthConfigError):
                validate_multi_issuer_user_resolver(app)
        finally:
            app.config.pop("MCP_JWT_ISSUER", None)


def test_multi_issuer_with_custom_resolver_resolves_normally(app) -> None:
    """An operator-supplied, issuer-aware ``MCP_USER_RESOLVER`` is unaffected
    by the multi-issuer guard: legitimate multi-issuer deployments that
    provide their own resolver continue to resolve users normally."""
    shared_user = _make_mock_user("alice")
    token_from_issuer_a = _make_access_token(
        claims={"sub": "alice", "iss": "https://issuer-a.example.com"}
    )
    token_from_issuer_b = _make_access_token(
        claims={"sub": "alice", "iss": "https://issuer-b.example.com"}
    )

    # A stand-in issuer-aware resolver: derives a compound iss+sub identity
    # instead of the default username/email-only lookup.
    def _issuer_aware_resolver(_app: object, access_token: MagicMock) -> str:
        claims = access_token.claims
        return f"{claims['iss']}:{claims['sub']}"

    with app.app_context():
        app.config["MCP_JWT_ISSUER"] = [
            "https://issuer-a.example.com",
            "https://issuer-b.example.com",
        ]
        app.config["MCP_USER_RESOLVER"] = _issuer_aware_resolver
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
            app.config.pop("MCP_USER_RESOLVER", None)

    assert result_a is shared_user
    assert result_b is shared_user

    # The custom resolver's compound iss+sub key is what reaches the DB
    # lookup, not a bare username — confirming the guard doesn't interfere
    # with a resolver that already binds identity to the issuer.
    mock_load_a.assert_called_once_with("https://issuer-a.example.com:alice")
    mock_load_b.assert_called_once_with("https://issuer-b.example.com:alice")
