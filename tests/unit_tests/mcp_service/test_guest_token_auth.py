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

"""Tests for embedded guest-token authentication on the MCP transport.

Covers the three layers of the feature:
- ``GuestTokenVerifier`` (transport): validates a guest token by reusing core's
  guest-token machinery and emits a marked ``AccessToken``.
- ``CompositeTokenVerifier`` routing: guests are tried before the JWT verifier.
- ``_resolve_user_from_jwt_context`` (resolution): builds the ``GuestUser`` from
  the verified claims, and ignores look-alike tokens lacking the marker.
- The guest deny-list for sensitive enumeration tools.
"""

from contextlib import contextmanager
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock, patch

import jwt
import pytest
from fastmcp.server.auth import AccessToken
from flask import g

from superset.app import SupersetApp
from superset.constants import CHANGE_ME_GUEST_TOKEN_JWT_SECRET
from superset.mcp_service.auth import (
    _DEFAULT_GUEST_ALLOWED_TOOLS,
    _resolve_user_from_jwt_context,
    _tool_denied_for_principal,
    check_tool_permission,
    CLASS_PERMISSION_ATTR,
    is_tool_visible_to_current_user,
    METHOD_PERMISSION_ATTR,
)
from superset.mcp_service.composite_token_verifier import CompositeTokenVerifier
from superset.mcp_service.guest_token_verifier import (
    GUEST_TOKEN_CLAIM,
    GuestTokenVerifier,
)
from superset.mcp_service.mcp_config import (
    _is_mcp_guest_auth_enabled,
    _validate_guest_config,
    MCPAuthConfigError,
)
from superset.security.guest_token import GuestUser


def _access_token(client_id: str, claims: dict[str, Any]) -> AccessToken:
    """Build a fastmcp AccessToken for routing tests."""
    fake_token = "fake-token"  # noqa: S105 — test fixture, not a real credential
    return AccessToken(token=fake_token, client_id=client_id, scopes=[], claims=claims)


def _parsed_guest_claims(**overrides: Any) -> dict[str, Any]:
    """A decoded guest-token claims dict shaped like core's mint output."""
    claims = {
        "user": {"username": "embed-guest"},
        "resources": [{"type": "dashboard", "id": "abc-uuid"}],
        "rls_rules": [],
        "iat": 1,
        "exp": 9_999_999_999,
        "aud": "superset",
        "type": "guest",
    }
    claims.update(overrides)
    return claims


class _FakeApp:
    """Minimal Flask-app stand-in for unit-testing GuestTokenVerifier."""

    def __init__(self, config: dict[str, Any], sm: Any) -> None:
        self.config = config
        self.appbuilder = SimpleNamespace(sm=sm)

    @contextmanager
    def app_context(self) -> Any:
        yield


def _make_guest_verifier(
    *,
    parsed: dict[str, Any] | None = None,
    parse_error: Exception | None = None,
    revoked: bool = False,
    role_exists: bool = True,
    mcp_enabled: bool = True,
) -> tuple[GuestTokenVerifier, MagicMock]:
    sm = MagicMock()
    if parse_error is not None:
        sm.parse_jwt_guest_token.side_effect = parse_error
    else:
        sm.parse_jwt_guest_token.return_value = (
            _parsed_guest_claims() if parsed is None else parsed
        )
    sm._is_guest_token_revoked.return_value = revoked
    sm.find_role.return_value = object() if role_exists else None
    config = {
        "MCP_EMBEDDED_GUEST_AUTH_ENABLED": mcp_enabled,
        "GUEST_ROLE_NAME": "Public",
    }
    return GuestTokenVerifier(app=_FakeApp(config, sm)), sm


# -- GuestTokenVerifier --


@pytest.mark.asyncio
async def test_guest_verifier_accepts_valid_token() -> None:
    verifier, _ = _make_guest_verifier()
    with patch("superset.is_feature_enabled", return_value=True):
        token = await verifier.verify_token("raw-guest-token")

    assert token is not None
    assert token.client_id == "guest"
    assert token.claims[GUEST_TOKEN_CLAIM] is True
    # The parsed guest claims are carried through for resolution.
    assert token.claims["user"] == {"username": "embed-guest"}
    assert token.claims["type"] == "guest"


@pytest.mark.asyncio
async def test_guest_verifier_noop_when_mcp_flag_off() -> None:
    verifier, sm = _make_guest_verifier(mcp_enabled=False)
    with patch("superset.is_feature_enabled", return_value=True):
        token = await verifier.verify_token("raw-guest-token")

    assert token is None
    # Short-circuits before doing any parsing work.
    sm.parse_jwt_guest_token.assert_not_called()


@pytest.mark.asyncio
async def test_guest_verifier_defers_when_embedded_disabled() -> None:
    verifier, _ = _make_guest_verifier()
    with patch("superset.is_feature_enabled", return_value=False):
        token = await verifier.verify_token("raw-guest-token")

    assert token is None


@pytest.mark.asyncio
async def test_guest_verifier_defers_on_bad_signature() -> None:
    verifier, _ = _make_guest_verifier(parse_error=ValueError("bad signature"))
    with patch("superset.is_feature_enabled", return_value=True):
        token = await verifier.verify_token("not-a-guest-token")

    assert token is None


@pytest.mark.asyncio
async def test_guest_verifier_rejects_non_guest_type() -> None:
    verifier, _ = _make_guest_verifier(parsed=_parsed_guest_claims(type="access"))
    with patch("superset.is_feature_enabled", return_value=True):
        token = await verifier.verify_token("raw-token")

    assert token is None


@pytest.mark.asyncio
async def test_guest_verifier_rejects_missing_structural_claims() -> None:
    bad = _parsed_guest_claims()
    del bad["resources"]
    verifier, _ = _make_guest_verifier(parsed=bad)
    with patch("superset.is_feature_enabled", return_value=True):
        token = await verifier.verify_token("raw-token")

    assert token is None


@pytest.mark.asyncio
async def test_guest_verifier_rejects_revoked_token() -> None:
    verifier, _ = _make_guest_verifier(revoked=True)
    with patch("superset.is_feature_enabled", return_value=True):
        token = await verifier.verify_token("raw-guest-token")

    assert token is None


@pytest.mark.asyncio
async def test_guest_verifier_rejects_when_guest_role_missing() -> None:
    verifier, _ = _make_guest_verifier(role_exists=False)
    with patch("superset.is_feature_enabled", return_value=True):
        token = await verifier.verify_token("raw-guest-token")

    assert token is None


# -- CompositeTokenVerifier routing --


class _StubVerifier:
    base_url = None
    required_scopes: list[str] = []

    def __init__(self, return_value: Any) -> None:
        self._return_value = return_value
        self.called = False

    async def verify_token(self, token: str) -> Any:
        self.called = True
        return self._return_value


@pytest.mark.asyncio
async def test_composite_tries_guest_before_jwt() -> None:
    guest_at = _access_token("guest", {GUEST_TOKEN_CLAIM: True})
    guest = _StubVerifier(guest_at)
    jwt = _StubVerifier(_access_token("idp", {}))
    composite = CompositeTokenVerifier(
        jwt_verifier=jwt, api_key_prefixes=[], app=None, guest_verifier=guest
    )

    result = await composite.verify_token("some-token")

    assert result is guest_at
    assert guest.called is True
    assert jwt.called is False  # guest short-circuits the JWT path


@pytest.mark.asyncio
async def test_composite_falls_through_to_jwt_for_non_guest() -> None:
    jwt_result = _access_token("idp", {})
    guest = _StubVerifier(None)  # not a guest token
    jwt = _StubVerifier(jwt_result)
    composite = CompositeTokenVerifier(
        jwt_verifier=jwt, api_key_prefixes=[], app=None, guest_verifier=guest
    )

    result = await composite.verify_token("some-token")

    assert result is jwt_result
    assert guest.called is True
    assert jwt.called is True


# -- _resolve_user_from_jwt_context --


def test_resolve_builds_guest_user_from_token(app: SupersetApp) -> None:
    token = MagicMock()
    token.claims = {GUEST_TOKEN_CLAIM: True, **_parsed_guest_claims()}
    token.client_id = "guest"
    fake_guest = MagicMock()
    fake_guest.username = "embed-guest"

    with app.app_context():
        with (
            patch.dict(app.config, {"MCP_EMBEDDED_GUEST_AUTH_ENABLED": True}),
            patch("fastmcp.server.dependencies.get_access_token", return_value=token),
            patch("superset.mcp_service.auth.is_feature_enabled", return_value=True),
            patch("superset.mcp_service.auth.security_manager") as mock_sm,
        ):
            mock_sm.get_guest_user_from_token = MagicMock(return_value=fake_guest)
            result = _resolve_user_from_jwt_context(app)

    assert result is fake_guest
    # The internal marker must not leak into the GuestUser's token dict.
    passed_token = mock_sm.get_guest_user_from_token.call_args.args[0]
    assert GUEST_TOKEN_CLAIM not in passed_token


def test_resolve_ignores_guest_type_without_marker(app: SupersetApp) -> None:
    """An external IdP JWT that merely carries ``type==guest`` must NOT be
    treated as an embedded guest — it lacks the namespaced marker and the
    ``client_id == "guest"`` signal, so normal resolution applies."""
    mock_user = MagicMock()
    mock_user.username = "alice"
    mock_user.roles = []
    mock_user.groups = []
    token = MagicMock()
    token.claims = {"type": "guest", "sub": "alice"}
    token.client_id = "idp"

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


# -- Guest deny-list --


def _make_guest_user() -> GuestUser:
    return GuestUser(
        token={
            "user": {"username": "g"},
            "resources": [],
            "rls_rules": [],
            "iat": 1,
            "exp": 9_999_999_999,
        },
        roles=[],
    )


def test_tool_denied_for_principal_helper(app: SupersetApp) -> None:
    denied = MagicMock()
    denied.__name__ = "find_users"  # not on the allow-list
    allowed = MagicMock()
    allowed.__name__ = "list_charts"  # on the allow-list

    with app.app_context():
        # Non-guest: the guest allow-list never applies.
        g.user = MagicMock(spec=[])
        assert _tool_denied_for_principal(denied) is False

        # Guest: only allow-listed tools pass; everything else is denied.
        g.user = _make_guest_user()
        assert _tool_denied_for_principal(denied) is True
        assert _tool_denied_for_principal(allowed) is False


def test_default_allow_list_matches_config() -> None:
    """The auth.py default and the mcp_config.py default must stay in sync."""
    from superset.mcp_service.mcp_config import MCP_GUEST_ALLOWED_TOOLS

    assert set(_DEFAULT_GUEST_ALLOWED_TOOLS) == set(MCP_GUEST_ALLOWED_TOOLS)


@pytest.mark.parametrize("tool_name", sorted(_DEFAULT_GUEST_ALLOWED_TOOLS))
def test_allow_listed_tools_permitted_for_guest(
    app: SupersetApp, tool_name: str
) -> None:
    """Every tool on the default allow-list is reachable by a guest."""
    func = MagicMock()
    func.__name__ = tool_name

    with app.app_context():
        g.user = _make_guest_user()
        assert _tool_denied_for_principal(func) is False


@pytest.mark.parametrize(
    "tool_name",
    [
        # user-directory / security-config
        "find_users",
        "get_user_info",
        "list_users",
        "get_role_info",
        "list_roles",
        "get_instance_info",
        # data-model internals
        "get_dataset_info",
        "list_datasets",
        "query_dataset",
        "get_database_info",
        "get_chart_sql",
        "list_rls_filters",
        # newly-covered enumeration tools (tags/tasks/annotations/reports/queries)
        "list_tags",
        "list_tasks",
        "list_annotation_layers",
        "list_reports",
        "list_queries",
        "list_saved_queries",
        # mutating tools
        "execute_sql",
        "create_dataset",
        "update_dashboard",
        "generate_chart",
    ],
)
def test_non_allow_listed_tools_denied_to_guest(
    app: SupersetApp, tool_name: str
) -> None:
    """Default-deny: any tool not on the allow-list is blocked for a guest,
    regardless of its RBAC class (holds with RBAC off)."""
    func = MagicMock()
    func.__name__ = tool_name

    with app.app_context():
        g.user = _make_guest_user()
        assert _tool_denied_for_principal(func) is True


def test_guest_denied_tool_blocked_at_call_time(app: SupersetApp) -> None:
    func = MagicMock()
    func.__name__ = "find_users"

    with app.app_context():
        g.user = _make_guest_user()
        # Denied regardless of MCP_RBAC_ENABLED (it runs before the gate).
        assert check_tool_permission(func) is False


def test_guest_denied_tool_hidden_from_listing(app: SupersetApp) -> None:
    tool = MagicMock()
    tool.fn = MagicMock()
    tool.fn.__name__ = "get_instance_info"

    with app.app_context():
        g.user = _make_guest_user()
        assert is_tool_visible_to_current_user(tool) is False


def test_guest_allowed_tool_permitted_with_rbac(app: SupersetApp) -> None:
    """A guest passes the allow-list and is granted an allow-listed tool through
    the full RBAC chain (allow-list runs, RBAC grants, scopes allow)."""
    func = MagicMock()
    func.__name__ = "list_charts"
    setattr(func, CLASS_PERMISSION_ATTR, "Chart")
    setattr(func, METHOD_PERMISSION_ATTR, "read")

    with app.app_context():
        with (
            patch.dict(app.config, {"MCP_RBAC_ENABLED": True}),
            patch("superset.mcp_service.auth.security_manager") as mock_sm,
            patch("superset.mcp_service.auth._token_scope_allows", return_value=True),
        ):
            mock_sm.can_access = MagicMock(return_value=True)
            g.user = _make_guest_user()
            assert check_tool_permission(func) is True


def test_allowlist_string_misconfig_falls_back_to_default(app: SupersetApp) -> None:
    """A misconfigured string allow-list must not cause substring matching; the
    type guard falls back to the safe default set (fail-closed)."""
    func = MagicMock()
    func.__name__ = "chart"  # substring of allow-list entries like "get_chart_info"

    with app.app_context():
        with patch.dict(
            app.config, {"MCP_GUEST_ALLOWED_TOOLS": "get_chart_info,list_charts"}
        ):
            g.user = _make_guest_user()
            # Naive substring `in` would wrongly ALLOW "chart"; the guard falls
            # back to the default set, where "chart" is absent, so it is denied.
            assert _tool_denied_for_principal(func) is True
            # A genuinely allow-listed tool is still permitted via the default.
            func.__name__ = "get_chart_info"
            assert _tool_denied_for_principal(func) is False


def test_guest_allowed_tools_operator_override(app: SupersetApp) -> None:
    """An operator can widen the guest allow-list via config."""
    func = MagicMock()
    func.__name__ = "get_dataset_info"  # not on the default allow-list

    with app.app_context():
        g.user = _make_guest_user()
        assert _tool_denied_for_principal(func) is True
        with patch.dict(app.config, {"MCP_GUEST_ALLOWED_TOOLS": {"get_dataset_info"}}):
            assert _tool_denied_for_principal(func) is False


def test_restricted_tool_policy_hook_restricts_non_guest(app: SupersetApp) -> None:
    """A custom MCP_RESTRICTED_TOOL_POLICY can restrict a non-guest principal,
    proving the allow-list layer is principal-agnostic (guests are just the
    default). The policy returns an allow-list; non-listed tools are denied."""
    allowed = MagicMock()
    allowed.__name__ = "list_charts"
    denied = MagicMock()
    denied.__name__ = "execute_sql"

    def policy(user: Any) -> frozenset[str] | None:
        return frozenset({"list_charts"})

    with app.app_context():
        with patch.dict(app.config, {"MCP_RESTRICTED_TOOL_POLICY": policy}):
            g.user = MagicMock(spec=[])  # an ordinary (non-guest) principal
            assert _tool_denied_for_principal(allowed) is False
            assert _tool_denied_for_principal(denied) is True


def test_restricted_tool_policy_hook_none_means_unrestricted(app: SupersetApp) -> None:
    """A policy returning None leaves the principal governed by RBAC (not blocked
    by the allow-list layer)."""
    func = MagicMock()
    func.__name__ = "execute_sql"

    def policy(user: Any) -> frozenset[str] | None:
        return None

    with app.app_context():
        with patch.dict(app.config, {"MCP_RESTRICTED_TOOL_POLICY": policy}):
            g.user = _make_guest_user()
            assert _tool_denied_for_principal(func) is False


def test_restricted_tool_policy_hook_bad_return_fails_closed(app: SupersetApp) -> None:
    """A misbehaving policy that returns a non-collection denies all tools."""
    func = MagicMock()
    func.__name__ = "get_chart_info"

    def policy(user: Any) -> frozenset[str] | None:
        return "list_charts"  # type: ignore[return-value]

    with app.app_context():
        with patch.dict(app.config, {"MCP_RESTRICTED_TOOL_POLICY": policy}):
            g.user = _make_guest_user()
            assert _tool_denied_for_principal(func) is True


def test_restricted_tool_policy_hook_non_callable_uses_default(
    app: SupersetApp,
) -> None:
    """A non-callable policy (a set is the natural mistake, since
    MCP_GUEST_ALLOWED_TOOLS is a set) does not crash every call: it falls back to
    the built-in default, so a guest stays default-denied for non-allow-listed
    tools."""
    func = MagicMock()
    func.__name__ = "execute_sql"

    with app.app_context():
        with patch.dict(app.config, {"MCP_RESTRICTED_TOOL_POLICY": {"list_charts"}}):
            g.user = _make_guest_user()
            # No TypeError, and the guest is still restricted (execute_sql denied).
            assert _tool_denied_for_principal(func) is True


# -- Hardening: expiry, forgery, and the resolution gate --


@pytest.mark.asyncio
async def test_guest_verifier_defers_on_expired_token() -> None:
    verifier, _ = _make_guest_verifier(parse_error=jwt.ExpiredSignatureError("expired"))
    with patch("superset.is_feature_enabled", return_value=True):
        token = await verifier.verify_token("expired-guest-token")

    assert token is None


@pytest.mark.asyncio
async def test_verify_token_defers_on_missing_exp() -> None:
    """A successfully-parsed token with no usable ``exp`` must defer, not raise."""
    bad = _parsed_guest_claims()
    del bad["exp"]
    verifier, _ = _make_guest_verifier(parsed=bad)
    with patch("superset.is_feature_enabled", return_value=True):
        token = await verifier.verify_token("raw-token")

    assert token is None


@pytest.mark.asyncio
async def test_composite_strips_guest_marker_from_jwt_token() -> None:
    """A crafted IdP JWT carrying the guest marker must have it stripped by the
    composite, so it cannot be mistaken for a verified guest at resolution. The
    strip rebuilds the token rather than mutating in place, so it holds even when
    ``AccessToken.claims`` is an immutable or copied mapping."""
    forged = _access_token("guest", {GUEST_TOKEN_CLAIM: True, "sub": "attacker"})
    jwt_verifier = _StubVerifier(forged)
    composite = CompositeTokenVerifier(
        jwt_verifier=jwt_verifier, api_key_prefixes=[], app=None, guest_verifier=None
    )

    result = await composite.verify_token("crafted-idp-jwt")

    assert result is not None
    assert GUEST_TOKEN_CLAIM not in result.claims
    assert result.claims["sub"] == "attacker"
    # Rebuilt, not mutated: the original token still carries the marker.
    assert forged.claims[GUEST_TOKEN_CLAIM] is True


def test_resolve_rejects_guest_marker_when_guest_auth_disabled(
    app: SupersetApp,
) -> None:
    """Even with the marker + client_id, a token is not treated as a guest when
    embedded guest auth is disabled (defense against marker forgery)."""
    token = MagicMock()
    token.claims = {GUEST_TOKEN_CLAIM: True, **_parsed_guest_claims()}
    token.client_id = "guest"

    with app.app_context():
        with (
            patch.dict(app.config, {"MCP_EMBEDDED_GUEST_AUTH_ENABLED": False}),
            patch("fastmcp.server.dependencies.get_access_token", return_value=token),
            patch("superset.mcp_service.auth.is_feature_enabled", return_value=True),
        ):
            result = _resolve_user_from_jwt_context(app)

    assert result is None


def test_resolve_rejects_guest_marker_when_embedded_flag_off(app: SupersetApp) -> None:
    """The other half of the gate: with the marker + client_id + the MCP guest
    flag on, a token is still not treated as a guest when the EMBEDDED_SUPERSET
    feature flag is off (both gates are required)."""
    token = MagicMock()
    token.claims = {GUEST_TOKEN_CLAIM: True, **_parsed_guest_claims()}
    token.client_id = "guest"

    with app.app_context():
        with (
            patch.dict(app.config, {"MCP_EMBEDDED_GUEST_AUTH_ENABLED": True}),
            patch("fastmcp.server.dependencies.get_access_token", return_value=token),
            patch("superset.mcp_service.auth.is_feature_enabled", return_value=False),
        ):
            result = _resolve_user_from_jwt_context(app)

    assert result is None


def test_resolve_ignores_guest_marker_without_guest_client_id(app: SupersetApp) -> None:
    """The marker alone is not enough — ``client_id == "guest"`` is also required,
    so a normal JWT that carries the marker resolves as its own user."""
    mock_user = MagicMock()
    mock_user.username = "alice"
    mock_user.roles = []
    mock_user.groups = []
    token = MagicMock()
    token.claims = {GUEST_TOKEN_CLAIM: True, "sub": "alice"}
    token.client_id = "idp"  # not "guest"

    with app.app_context():
        with (
            patch.dict(app.config, {"MCP_EMBEDDED_GUEST_AUTH_ENABLED": True}),
            patch("fastmcp.server.dependencies.get_access_token", return_value=token),
            patch(
                "superset.mcp_service.auth.load_user_with_relationships",
                return_value=mock_user,
            ),
        ):
            result = _resolve_user_from_jwt_context(app)

    assert result is not None
    assert result.username == "alice"


# -- guest config validation --


def test_validate_guest_config_raises_on_default_secret() -> None:
    app = _FakeApp(
        {"GUEST_TOKEN_JWT_SECRET": CHANGE_ME_GUEST_TOKEN_JWT_SECRET}, MagicMock()
    )
    with pytest.raises(MCPAuthConfigError, match="insecure default"):
        _validate_guest_config(app)


def test_validate_guest_config_passes_with_strong_secret() -> None:
    app = _FakeApp(
        {
            "GUEST_TOKEN_JWT_SECRET": "a-strong-shared-secret",
            "GUEST_TOKEN_JWT_AUDIENCE": "superset",
        },
        MagicMock(),
    )
    _validate_guest_config(app)  # does not raise


# -- guest auth enablement gate --


def test_mcp_guest_auth_disabled_when_embedded_flag_off() -> None:
    app = _FakeApp({"MCP_EMBEDDED_GUEST_AUTH_ENABLED": True}, MagicMock())
    with patch("superset.is_feature_enabled", return_value=False):
        assert _is_mcp_guest_auth_enabled(app) is False


def test_mcp_guest_auth_enabled_when_flag_and_feature_on() -> None:
    app = _FakeApp({"MCP_EMBEDDED_GUEST_AUTH_ENABLED": True}, MagicMock())
    with patch("superset.is_feature_enabled", return_value=True):
        assert _is_mcp_guest_auth_enabled(app) is True


def test_mcp_guest_auth_disabled_when_opt_in_off() -> None:
    app = _FakeApp({"MCP_EMBEDDED_GUEST_AUTH_ENABLED": False}, MagicMock())
    assert _is_mcp_guest_auth_enabled(app) is False
