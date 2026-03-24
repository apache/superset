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

"""Tests for MCP user resolution priority and stale g.user prevention."""

from unittest.mock import MagicMock, patch

import pytest
from flask import g

from superset.mcp_service.auth import (
    _resolve_user_from_jwt_context,
    get_user_from_request,
    mcp_auth_hook,
)
from superset.mcp_service.mcp_config import default_user_resolver


def _make_mock_user(username: str = "testuser") -> MagicMock:
    """Create a mock User with required attributes."""
    user = MagicMock()
    user.username = username
    user.roles = []
    user.groups = []
    return user


def _make_access_token(
    claims: dict[str, str] | None = None, **kwargs: str
) -> MagicMock:
    """Create a mock AccessToken matching FastMCP's format."""
    token = MagicMock()
    token.claims = claims or {}
    token.client_id = kwargs.get("client_id", "")
    token.scopes = kwargs.get("scopes", [])
    # Remove auto-created attributes so getattr fallbacks work correctly
    for attr in ("subject", "payload"):
        if attr not in kwargs:
            delattr(token, attr)
    for attr in kwargs:
        setattr(token, attr, kwargs[attr])
    return token


# -- _resolve_user_from_jwt_context --


def test_jwt_context_resolves_correct_user(app) -> None:
    """JWT context with valid claims resolves the correct DB user."""
    mock_user = _make_mock_user("alice")
    token = _make_access_token(claims={"sub": "alice"})

    with app.app_context():
        with (
            patch("fastmcp.server.dependencies.get_access_token", return_value=token),
            patch(
                "superset.mcp_service.auth.load_user_with_relationships",
                return_value=mock_user,
            ),
        ):
            result = _resolve_user_from_jwt_context(app)

    assert result is not None
    assert result.username == "alice"


def test_jwt_context_returns_none_when_no_token(app) -> None:
    """No JWT token present returns None (fall through to next source)."""
    with app.app_context():
        with patch("fastmcp.server.dependencies.get_access_token", return_value=None):
            result = _resolve_user_from_jwt_context(app)

    assert result is None


def test_jwt_context_raises_for_unknown_user(app) -> None:
    """JWT resolves a username not in DB — raises ValueError (fail closed)."""
    token = _make_access_token(claims={"sub": "nonexistent"})

    with app.app_context():
        with (
            patch("fastmcp.server.dependencies.get_access_token", return_value=token),
            patch(
                "superset.mcp_service.auth.load_user_with_relationships",
                return_value=None,
            ),
        ):
            with pytest.raises(ValueError, match="not found in Superset database"):
                _resolve_user_from_jwt_context(app)


def test_jwt_context_raises_when_no_username_in_claims(app) -> None:
    """JWT present but claims have no extractable username — fails closed."""
    token = _make_access_token(claims={"iss": "some-issuer"})

    with app.app_context():
        with patch("fastmcp.server.dependencies.get_access_token", return_value=token):
            with pytest.raises(ValueError, match="no username could be extracted"):
                _resolve_user_from_jwt_context(app)


def test_jwt_context_uses_custom_resolver(app) -> None:
    """Custom MCP_USER_RESOLVER config is used when set."""
    mock_user = _make_mock_user("custom_user")
    token = _make_access_token(claims={"custom_field": "custom_user"})
    custom_resolver = MagicMock(return_value="custom_user")

    with app.app_context():
        app.config["MCP_USER_RESOLVER"] = custom_resolver
        try:
            with (
                patch(
                    "fastmcp.server.dependencies.get_access_token", return_value=token
                ),
                patch(
                    "superset.mcp_service.auth.load_user_with_relationships",
                    return_value=mock_user,
                ),
            ):
                result = _resolve_user_from_jwt_context(app)
        finally:
            app.config.pop("MCP_USER_RESOLVER", None)

    assert result is not None
    assert result.username == "custom_user"
    custom_resolver.assert_called_once_with(app, token)


def test_jwt_context_email_fallback_lookup(app) -> None:
    """When resolver returns an email, tries email lookup after username miss."""
    mock_user = _make_mock_user("alice")
    token = _make_access_token(claims={"email": "alice@example.com"})

    def _load_side_effect(username=None, email=None):
        if email == "alice@example.com":
            return mock_user
        return None

    with app.app_context():
        with (
            patch("fastmcp.server.dependencies.get_access_token", return_value=token),
            patch(
                "superset.mcp_service.auth.load_user_with_relationships",
                side_effect=_load_side_effect,
            ),
        ):
            result = _resolve_user_from_jwt_context(app)

    assert result is not None
    assert result.username == "alice"


# -- get_user_from_request priority order --


def test_jwt_takes_priority_over_stale_g_user(app) -> None:
    """Core regression test: JWT user wins over stale g.user."""
    stale_user = _make_mock_user("stale_bob")
    jwt_user = _make_mock_user("jwt_alice")
    token = _make_access_token(claims={"sub": "jwt_alice"})

    with app.app_context():
        g.user = stale_user
        with (
            patch("fastmcp.server.dependencies.get_access_token", return_value=token),
            patch(
                "superset.mcp_service.auth.load_user_with_relationships",
                return_value=jwt_user,
            ),
        ):
            result = get_user_from_request()

    assert result.username == "jwt_alice"


def test_dev_username_fallback_when_no_jwt(app) -> None:
    """MCP_DEV_USERNAME used when no JWT context available."""
    mock_user = _make_mock_user("dev_admin")

    with app.app_context():
        app.config["MCP_DEV_USERNAME"] = "dev_admin"
        try:
            with (
                patch(
                    "fastmcp.server.dependencies.get_access_token", return_value=None
                ),
                patch(
                    "superset.mcp_service.auth.load_user_with_relationships",
                    return_value=mock_user,
                ),
            ):
                result = get_user_from_request()
        finally:
            app.config.pop("MCP_DEV_USERNAME", None)

    assert result.username == "dev_admin"


def test_g_user_fallback_when_no_jwt_and_no_dev_username(app) -> None:
    """g.user used as last-resort fallback (Preset middleware compatibility)."""
    preset_user = _make_mock_user("preset_user")

    with app.app_context():
        app.config.pop("MCP_DEV_USERNAME", None)
        g.user = preset_user
        with patch("fastmcp.server.dependencies.get_access_token", return_value=None):
            result = get_user_from_request()

    assert result.username == "preset_user"


def test_raises_when_no_auth_source(app) -> None:
    """ValueError raised when no auth source is available."""
    with app.app_context():
        app.config.pop("MCP_DEV_USERNAME", None)
        g.pop("user", None)
        with patch("fastmcp.server.dependencies.get_access_token", return_value=None):
            with pytest.raises(ValueError, match="No authenticated user found"):
                get_user_from_request()


def test_dev_username_not_found_raises(app) -> None:
    """MCP_DEV_USERNAME configured but user not in DB raises ValueError."""
    with app.app_context():
        app.config["MCP_DEV_USERNAME"] = "ghost"
        try:
            with (
                patch(
                    "fastmcp.server.dependencies.get_access_token", return_value=None
                ),
                patch(
                    "superset.mcp_service.auth.load_user_with_relationships",
                    return_value=None,
                ),
            ):
                with pytest.raises(ValueError, match="not found"):
                    get_user_from_request()
        finally:
            app.config.pop("MCP_DEV_USERNAME", None)


# -- g.user clearing in mcp_auth_hook --


def test_mcp_auth_hook_clears_stale_g_user(app) -> None:
    """mcp_auth_hook clears g.user before setting up user context.

    Uses a side_effect that asserts g.user was cleared before user
    resolution runs, so the test fails if g.pop("user") is removed.
    """
    stale_user = _make_mock_user("stale")
    fresh_user = _make_mock_user("fresh")

    def dummy_tool():
        """Dummy tool."""
        return g.user.username

    wrapped = mcp_auth_hook(dummy_tool)

    def _assert_cleared_then_return():
        """Verify stale g.user was cleared before returning fresh user."""
        assert not hasattr(g, "user") or g.user is None, (
            "g.user should have been cleared before get_user_from_request() "
            f"but found g.user={getattr(g, 'user', '<missing>')}"
        )
        return fresh_user

    with app.app_context():
        g.user = stale_user
        with patch(
            "superset.mcp_service.auth.get_user_from_request",
            side_effect=lambda: _assert_cleared_then_return(),
        ):
            result = wrapped()

    assert result == "fresh"


def test_mcp_auth_hook_clears_stale_g_user_async(app) -> None:
    """mcp_auth_hook clears g.user before setting up user context (async).

    Uses a side_effect that asserts g.user was cleared before user
    resolution runs, so the test fails if g.pop("user") is removed.
    """
    import asyncio

    stale_user = _make_mock_user("stale")
    fresh_user = _make_mock_user("fresh")

    async def dummy_tool():
        """Dummy tool."""
        return g.user.username

    wrapped = mcp_auth_hook(dummy_tool)

    def _assert_cleared_then_return():
        """Verify stale g.user was cleared before returning fresh user."""
        assert not hasattr(g, "user") or g.user is None, (
            "g.user should have been cleared before get_user_from_request() "
            f"but found g.user={getattr(g, 'user', '<missing>')}"
        )
        return fresh_user

    with app.app_context():
        g.user = stale_user
        with patch(
            "superset.mcp_service.auth.get_user_from_request",
            side_effect=lambda: _assert_cleared_then_return(),
        ):
            result = asyncio.run(wrapped())

    assert result == "fresh"


def test_mcp_auth_hook_preserves_g_user_in_request_context(app) -> None:
    """g.user is NOT cleared when a request context is active (middleware compat).

    Uses a side_effect that asserts g.user is still the middleware-set
    user when get_user_from_request() is called, proving the hook did
    NOT clear it.
    """
    middleware_user = _make_mock_user("middleware_user")

    def dummy_tool():
        """Dummy tool."""
        return g.user.username

    wrapped = mcp_auth_hook(dummy_tool)

    def _assert_preserved_then_return():
        """Verify g.user was preserved (not cleared) before returning."""
        assert hasattr(g, "user"), (
            "g.user should be preserved in request context but was removed"
        )
        assert g.user is middleware_user, (
            "g.user should be preserved in request context but was changed; "
            f"g.user={g.user}"
        )
        return middleware_user

    with app.test_request_context():
        g.user = middleware_user
        with patch(
            "superset.mcp_service.auth.get_user_from_request",
            side_effect=lambda: _assert_preserved_then_return(),
        ):
            result = wrapped()

    assert result == "middleware_user"


# -- default_user_resolver --


def test_default_resolver_extracts_sub_from_claims() -> None:
    """Extracts 'sub' claim as last-resort from AccessToken.claims dict."""
    token = _make_access_token(claims={"sub": "alice"})
    assert default_user_resolver(None, token) == "alice"


def test_default_resolver_extracts_preferred_username() -> None:
    """Extracts 'preferred_username' claim (common OIDC claim)."""
    token = _make_access_token(claims={"preferred_username": "alice"})
    assert default_user_resolver(None, token) == "alice"


def test_default_resolver_extracts_email_from_claims() -> None:
    """Falls back to 'email' claim when 'sub' is absent."""
    token = _make_access_token(claims={"email": "alice@example.com"})
    assert default_user_resolver(None, token) == "alice@example.com"


def test_default_resolver_extracts_username_from_claims() -> None:
    """Falls back to 'username' claim."""
    token = _make_access_token(claims={"username": "alice"})
    assert default_user_resolver(None, token) == "alice"


def test_default_resolver_falls_back_to_subject_attr() -> None:
    """Falls back to legacy .subject attribute when claims empty."""
    token = _make_access_token(claims={}, subject="legacy_user")
    assert default_user_resolver(None, token) == "legacy_user"


def test_default_resolver_falls_back_to_client_id() -> None:
    """Falls back to .client_id when claims empty and no subject."""
    token = _make_access_token(claims={}, client_id="service-account")
    assert default_user_resolver(None, token) == "service-account"


def test_default_resolver_returns_none_for_empty_token() -> None:
    """Returns None when no claims or attributes have a username."""
    token = _make_access_token(claims={}, client_id="")
    assert default_user_resolver(None, token) is None


def test_default_resolver_preferred_username_takes_priority() -> None:
    """'preferred_username' takes priority over 'sub' and 'email' in claims."""
    token = _make_access_token(
        claims={
            "sub": "opaque-id-123",
            "preferred_username": "alice",
            "email": "alice@example.com",
        }
    )
    assert default_user_resolver(None, token) == "alice"
