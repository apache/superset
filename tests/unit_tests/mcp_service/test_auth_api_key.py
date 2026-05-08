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

"""Tests for API key authentication in get_user_from_request().

The streamable-http transport does not push a Flask request context, so
``_resolve_user_from_api_key`` reads the token from FastMCP's per-request
``AccessToken`` (populated by ``CompositeTokenVerifier``) rather than from
``flask.request``. These tests mock ``get_access_token`` accordingly.
"""

from collections.abc import Generator
from unittest.mock import MagicMock, patch

import pytest
from flask import g

from superset.app import SupersetApp
from superset.mcp_service.auth import (
    _resolve_user_from_jwt_context,
    get_user_from_request,
)
from superset.mcp_service.composite_token_verifier import API_KEY_PASSTHROUGH_CLAIM


@pytest.fixture
def mock_user() -> MagicMock:
    user = MagicMock()
    user.username = "api_key_user"
    return user


def _passthrough_access_token(token: str) -> MagicMock:
    """Build an AccessToken matching what CompositeTokenVerifier emits."""
    access_token = MagicMock()
    access_token.token = token
    access_token.claims = {API_KEY_PASSTHROUGH_CLAIM: True}
    return access_token


def _patch_access_token(access_token: MagicMock | None):
    """Patch get_access_token where _resolve_user_from_api_key imports it."""
    return patch(
        "fastmcp.server.dependencies.get_access_token",
        return_value=access_token,
    )


@pytest.fixture
def _enable_api_keys(app: SupersetApp) -> Generator[None, None, None]:
    """Enable FAB API key auth and clear MCP_DEV_USERNAME so the API key
    path is exercised instead of falling through to the dev-user fallback."""
    app.config["FAB_API_KEY_ENABLED"] = True
    old_dev = app.config.pop("MCP_DEV_USERNAME", None)
    yield
    app.config.pop("FAB_API_KEY_ENABLED", None)
    if old_dev is not None:
        app.config["MCP_DEV_USERNAME"] = old_dev


@pytest.fixture
def _disable_api_keys(app: SupersetApp) -> Generator[None, None, None]:
    app.config["FAB_API_KEY_ENABLED"] = False
    old_dev = app.config.pop("MCP_DEV_USERNAME", None)
    yield
    app.config.pop("FAB_API_KEY_ENABLED", None)
    if old_dev is not None:
        app.config["MCP_DEV_USERNAME"] = old_dev


# -- Valid API key -> user loaded --


@pytest.mark.usefixtures("_enable_api_keys")
def test_valid_api_key_returns_user(app: SupersetApp, mock_user: MagicMock) -> None:
    """A valid API key pass-through token should authenticate and return the user."""
    mock_sm = MagicMock()
    mock_sm.validate_api_key.return_value = mock_user

    with app.app_context():
        g.user = None
        app.appbuilder = MagicMock()
        app.appbuilder.sm = mock_sm

        with (
            _patch_access_token(_passthrough_access_token("sst_abc123")),
            patch(
                "superset.mcp_service.auth.load_user_with_relationships",
                return_value=mock_user,
            ),
        ):
            result = get_user_from_request()

    assert result.username == "api_key_user"
    mock_sm.validate_api_key.assert_called_once_with("sst_abc123")


# -- Invalid API key -> PermissionError (does not silently fall back) --


@pytest.mark.usefixtures("_enable_api_keys")
def test_invalid_api_key_raises(app: SupersetApp) -> None:
    """An invalid API key pass-through token should raise PermissionError
    (fail closed — do NOT fall through to MCP_DEV_USERNAME)."""
    mock_sm = MagicMock()
    mock_sm.validate_api_key.return_value = None

    # The dangerous fallthrough scenario: dev username IS set, but the
    # request presented an invalid API key. The dev fallback must not
    # mask the rejection.
    app.config["MCP_DEV_USERNAME"] = "admin"
    try:
        with app.app_context():
            g.user = None
            app.appbuilder = MagicMock()
            app.appbuilder.sm = mock_sm

            with _patch_access_token(_passthrough_access_token("sst_bad_key")):
                with pytest.raises(PermissionError, match="Invalid or expired API key"):
                    get_user_from_request()
    finally:
        app.config.pop("MCP_DEV_USERNAME", None)


# -- API key disabled -> falls through to next auth method --


@pytest.mark.usefixtures("_disable_api_keys")
def test_api_key_disabled_skips_auth(app: SupersetApp) -> None:
    """When FAB_API_KEY_ENABLED is False, API key auth is skipped entirely
    even if an AccessToken is present."""
    mock_sm = MagicMock()

    with app.app_context():
        g.user = None
        app.appbuilder = MagicMock()
        app.appbuilder.sm = mock_sm

        with _patch_access_token(_passthrough_access_token("sst_abc123")):
            with pytest.raises(ValueError, match="No authenticated user found"):
                get_user_from_request()

    mock_sm.validate_api_key.assert_not_called()


# -- No AccessToken -> API key auth skipped --


@pytest.mark.usefixtures("_enable_api_keys")
def test_no_access_token_skips_api_key_auth(app: SupersetApp) -> None:
    """Without a FastMCP AccessToken (e.g., MCP_AUTH_ENABLED=False and no
    auth provider installed), API key auth is skipped."""
    mock_sm = MagicMock()

    with app.app_context():
        g.user = None
        app.appbuilder = MagicMock()
        app.appbuilder.sm = mock_sm

        with _patch_access_token(None):
            with pytest.raises(ValueError, match="No authenticated user found"):
                get_user_from_request()

    mock_sm.validate_api_key.assert_not_called()


# -- g.user fallback when no higher-priority auth succeeds --


@pytest.mark.usefixtures("_disable_api_keys")
def test_g_user_fallback_when_no_jwt_or_api_key(
    app: SupersetApp, mock_user: MagicMock
) -> None:
    """When no JWT or API key auth succeeds and MCP_DEV_USERNAME is not set,
    g.user (set by external middleware) is used as fallback."""
    with app.test_request_context():
        g.user = mock_user

        result = get_user_from_request()

    assert result.username == "api_key_user"


# -- FAB version without validate_api_key --


@pytest.mark.usefixtures("_enable_api_keys")
def test_fab_without_validate_method_raises(app: SupersetApp) -> None:
    """If FAB SecurityManager lacks validate_api_key, should raise
    PermissionError about unavailable validation."""
    mock_sm = MagicMock(spec=[])  # empty spec = no attributes

    with app.app_context():
        g.user = None
        app.appbuilder = MagicMock()
        app.appbuilder.sm = mock_sm

        with _patch_access_token(_passthrough_access_token("sst_abc123")):
            with pytest.raises(
                PermissionError, match="API key validation is not available"
            ):
                get_user_from_request()


# -- Relationship reload fallback --


@pytest.mark.usefixtures("_enable_api_keys")
def test_relationship_reload_failure_returns_original_user(
    app: SupersetApp, mock_user: MagicMock
) -> None:
    """If load_user_with_relationships fails, the original user from
    validate_api_key should be returned as fallback."""
    mock_sm = MagicMock()
    mock_sm.validate_api_key.return_value = mock_user

    with app.app_context():
        g.user = None
        app.appbuilder = MagicMock()
        app.appbuilder.sm = mock_sm

        with (
            _patch_access_token(_passthrough_access_token("sst_abc123")),
            patch(
                "superset.mcp_service.auth.load_user_with_relationships",
                return_value=None,
            ),
        ):
            result = get_user_from_request()

    assert result is mock_user


# -- AccessToken without passthrough claim (plain JWT) -> skip API key auth --


@pytest.mark.usefixtures("_enable_api_keys")
def test_jwt_access_token_skips_api_key_auth(app: SupersetApp) -> None:
    """When the AccessToken is a plain JWT (no ``_api_key_passthrough`` claim),
    API key auth is skipped — the JWT was already validated by the JWT
    verifier and resolved in _resolve_user_from_jwt_context."""
    mock_sm = MagicMock()

    jwt_access_token = MagicMock()
    jwt_access_token.token = "eyJhbGciOiJIUzI1NiJ9.not-an-api-key"  # noqa: S105
    jwt_access_token.claims = {"sub": "alice"}

    with app.app_context():
        g.user = None
        app.appbuilder = MagicMock()
        app.appbuilder.sm = mock_sm

        with _patch_access_token(jwt_access_token):
            # _resolve_user_from_jwt_context will try to resolve the user
            # from the JWT claims and (in this isolated unit-test setup)
            # raise ValueError because the username is not a real user.
            # We assert that _resolve_user_from_api_key did NOT short-circuit
            # to the API key path.
            with pytest.raises(ValueError, match="not found"):
                get_user_from_request()

    mock_sm.validate_api_key.assert_not_called()


# -- API key pass-through detection in JWT context resolver --


def test_jwt_context_with_api_key_passthrough_returns_none(app: SupersetApp) -> None:
    """When CompositeTokenVerifier passes through an API key token,
    _resolve_user_from_jwt_context should detect the namespaced
    pass-through claim and return None so get_user_from_request falls
    through to _resolve_user_from_api_key."""
    mock_access_token = MagicMock()
    mock_access_token.claims = {API_KEY_PASSTHROUGH_CLAIM: True}

    with patch(
        "fastmcp.server.dependencies.get_access_token",
        return_value=mock_access_token,
    ):
        result = _resolve_user_from_jwt_context(app)

    assert result is None


# -- Plain JWT with a colliding non-namespaced claim is NOT mistaken for API key --


@pytest.mark.usefixtures("_enable_api_keys")
def test_unnamespaced_passthrough_claim_does_not_trigger_api_key_path(
    app: SupersetApp,
) -> None:
    """A JWT minted by an external IdP that happens to include a custom
    ``_api_key_passthrough`` claim (legacy unnamespaced name) must NOT be
    treated as an API-key pass-through. Only the namespaced
    ``API_KEY_PASSTHROUGH_CLAIM`` triggers the API-key path."""
    mock_sm = MagicMock()

    rogue_token = MagicMock()
    rogue_token.token = "eyJhbGciOiJSUzI1NiJ9.rogue_jwt"  # noqa: S105
    rogue_token.claims = {"_api_key_passthrough": True, "sub": "alice"}

    with app.app_context():
        g.user = None
        app.appbuilder = MagicMock()
        app.appbuilder.sm = mock_sm

        with _patch_access_token(rogue_token):
            # JWT path tries to resolve user "alice" from DB and (in this
            # isolated unit-test setup) raises ValueError. The assertion
            # below confirms validate_api_key was never called — i.e., the
            # rogue claim did NOT divert into _resolve_user_from_api_key.
            with pytest.raises(ValueError, match="not found"):
                get_user_from_request()

    mock_sm.validate_api_key.assert_not_called()


# -- SecurityManager method name regression test --


def test_security_manager_has_expected_api_key_methods(app: SupersetApp) -> None:
    """Regression test: verify the SecurityManager method name referenced in
    auth._resolve_user_from_api_key() actually exists on the FAB
    SecurityManager class. Catches future renames before they silently break
    API key auth at runtime (see PR #39437)."""
    with app.app_context():
        from superset import security_manager

        sm = security_manager
        assert hasattr(sm, "validate_api_key"), (
            "FAB SecurityManager is missing 'validate_api_key'. "
            "auth._resolve_user_from_api_key() references this method by name — "
            "update auth.py if the FAB API changed."
        )
