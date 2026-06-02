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

"""Tests for MCP RBAC permission checking (auth.py)."""

from unittest.mock import MagicMock, patch

import pytest
from flask import g

from superset.mcp_service.auth import (
    check_tool_permission,
    CLASS_PERMISSION_ATTR,
    is_tool_visible_to_current_user,
    MCPPermissionDeniedError,
    METHOD_PERMISSION_ATTR,
    PERMISSION_PREFIX,
)


@pytest.fixture(autouse=True)
def enable_mcp_rbac(app):
    """Re-enable RBAC for dedicated RBAC tests.

    The shared conftest disables RBAC for integration tests. This fixture
    overrides that so we can test the actual permission checking logic.
    """
    app.config["MCP_RBAC_ENABLED"] = True
    yield
    app.config.pop("MCP_RBAC_ENABLED", None)


class _ToolFunc:
    """Minimal callable stand-in for a tool function in tests.

    Unlike MagicMock, this does NOT auto-create attributes on access,
    so ``getattr(func, ATTR, None)`` properly returns None when the
    attribute hasn't been set.
    """

    def __init__(self, name: str = "test_tool"):
        self.__name__ = name

    def __call__(self, *args, **kwargs):
        pass


def _make_tool_func(
    class_perm: str | None = None,
    method_perm: str | None = None,
) -> _ToolFunc:
    """Create a tool function stub with optional permission attributes."""
    func = _ToolFunc()
    if class_perm is not None:
        setattr(func, CLASS_PERMISSION_ATTR, class_perm)
    if method_perm is not None:
        setattr(func, METHOD_PERMISSION_ATTR, method_perm)
    return func


# -- MCPPermissionDeniedError --


def test_permission_denied_error_message_basic() -> None:
    err = MCPPermissionDeniedError(
        permission_name="can_read",
        view_name="Chart",
    )
    assert "can_read" in str(err)
    assert "Chart" in str(err)
    assert err.permission_name == "can_read"
    assert err.view_name == "Chart"


def test_permission_denied_error_message_with_user_and_tool() -> None:
    err = MCPPermissionDeniedError(
        permission_name="can_write",
        view_name="Dashboard",
        user="alice",
        tool_name="generate_dashboard",
    )
    assert "alice" in str(err)
    assert "generate_dashboard" in str(err)
    assert "Dashboard" in str(err)


# -- check_tool_permission --


def test_check_tool_permission_no_class_permission_allows(app_context) -> None:
    """Tools without class_permission_name should be allowed by default."""
    g.user = MagicMock(username="admin")
    func = _make_tool_func()  # no class_permission_name
    assert check_tool_permission(func) is True


def test_check_tool_permission_no_user_denies(app_context) -> None:
    """If no g.user, permission check should deny."""
    g.user = None
    func = _make_tool_func(class_perm="Chart")
    assert check_tool_permission(func) is False


def test_check_tool_permission_granted(app_context) -> None:
    """When security_manager.can_access returns True, permission is granted."""
    g.user = MagicMock(username="admin")
    func = _make_tool_func(class_perm="Chart", method_perm="read")

    mock_sm = MagicMock()
    mock_sm.can_access = MagicMock(return_value=True)
    with patch("superset.mcp_service.auth.security_manager", mock_sm):
        result = check_tool_permission(func)

    assert result is True
    mock_sm.can_access.assert_called_once_with("can_read", "Chart")


def test_check_tool_permission_denied(app_context) -> None:
    """When security_manager.can_access returns False, permission is denied."""
    g.user = MagicMock(username="viewer")
    func = _make_tool_func(class_perm="Dashboard", method_perm="write")

    mock_sm = MagicMock()
    mock_sm.can_access = MagicMock(return_value=False)
    with patch("superset.mcp_service.auth.security_manager", mock_sm):
        result = check_tool_permission(func)

    assert result is False
    mock_sm.can_access.assert_called_once_with("can_write", "Dashboard")


def test_check_tool_permission_default_method_is_read(app_context) -> None:
    """When no method_permission_name is set, defaults to 'read'."""
    g.user = MagicMock(username="admin")
    func = _make_tool_func(class_perm="Dataset")
    # No method_perm set - should default to "read"

    mock_sm = MagicMock()
    mock_sm.can_access = MagicMock(return_value=True)
    with patch("superset.mcp_service.auth.security_manager", mock_sm):
        result = check_tool_permission(func)

    assert result is True
    mock_sm.can_access.assert_called_once_with("can_read", "Dataset")


def test_check_tool_permission_disabled_via_config(app_context, app) -> None:
    """When MCP_RBAC_ENABLED is False, permission checks are skipped."""
    g.user = MagicMock(username="viewer")
    func = _make_tool_func(class_perm="Chart", method_perm="read")

    app.config["MCP_RBAC_ENABLED"] = False
    try:
        assert check_tool_permission(func) is True
    finally:
        app.config["MCP_RBAC_ENABLED"] = True


# -- Permission constants --


def test_permission_prefix() -> None:
    assert PERMISSION_PREFIX == "can_"


def test_class_permission_attr() -> None:
    assert CLASS_PERMISSION_ATTR == "_class_permission_name"


def test_method_permission_attr() -> None:
    assert METHOD_PERMISSION_ATTR == "_method_permission_name"


# -- create_tool_decorator permission metadata --


def test_permission_attrs_read_tag() -> None:
    """Tags with class_permission_name set method_permission to read."""
    func = _make_tool_func(class_perm="Chart", method_perm="read")
    assert getattr(func, CLASS_PERMISSION_ATTR) == "Chart"
    assert getattr(func, METHOD_PERMISSION_ATTR) == "read"


def test_permission_attrs_write_tag() -> None:
    """mutate tag convention → method_permission = 'write'."""
    func = _make_tool_func(class_perm="Chart", method_perm="write")
    assert getattr(func, CLASS_PERMISSION_ATTR) == "Chart"
    assert getattr(func, METHOD_PERMISSION_ATTR) == "write"


def test_permission_attrs_custom_method() -> None:
    """Explicit method_permission_name overrides tag-based default."""
    func = _make_tool_func(class_perm="SQLLab", method_perm="execute_sql")
    assert getattr(func, CLASS_PERMISSION_ATTR) == "SQLLab"
    assert getattr(func, METHOD_PERMISSION_ATTR) == "execute_sql"


def test_no_class_permission_means_no_attrs() -> None:
    """Without class_permission_name, no permission attrs are set."""
    func = _make_tool_func()
    assert not hasattr(func, CLASS_PERMISSION_ATTR)
    assert not hasattr(func, METHOD_PERMISSION_ATTR)


# -- Fixture --


@pytest.fixture
def app_context(app):
    """Provide Flask app context for tests needing g.user."""
    with app.app_context():
        yield


# -- is_tool_visible_to_current_user --


def _make_mock_tool(
    class_perm: str | None = None,
    method_perm: str | None = None,
    fn: object | None = None,
) -> MagicMock:
    """Create a mock FastMCP Tool object for visibility tests."""
    tool = MagicMock()
    if fn is not None:
        tool.fn = fn
    elif class_perm is not None:
        func = _make_tool_func(class_perm, method_perm)
        tool.fn = func
    else:
        tool.fn = None
    return tool


def _patch_token_scopes(scopes):
    """Patch the JWT access-token lookup used by ``_get_token_scopes``.

    ``scopes=None`` simulates no JWT context / no token; a list simulates a
    token that advertises those scopes; an empty list simulates a token with
    no scopes (treated as scope-less -> RBAC-only).
    """
    if scopes is None:
        token = None
    else:
        token = MagicMock()
        token.scopes = scopes
    return patch(
        "fastmcp.server.dependencies.get_access_token",
        return_value=token,
    )


def test_visibility_returns_true_when_rbac_disabled(app_context, app) -> None:
    """is_tool_visible_to_current_user returns True when RBAC is disabled."""
    app.config["MCP_RBAC_ENABLED"] = False
    tool = _make_mock_tool(class_perm="Chart", method_perm="write")
    try:
        assert is_tool_visible_to_current_user(tool) is True
    finally:
        app.config["MCP_RBAC_ENABLED"] = True


def test_visibility_returns_true_when_fn_is_none(app_context) -> None:
    """Tools with fn=None (public/synthetic) are always visible."""
    tool = _make_mock_tool()
    assert is_tool_visible_to_current_user(tool) is True


def test_visibility_public_tool_no_class_permission(app_context) -> None:
    """Tools without class_permission_name are visible to all users."""
    g.user = MagicMock(username="viewer")
    func = _make_tool_func()  # no class permission
    tool = MagicMock()
    tool.fn = func
    assert is_tool_visible_to_current_user(tool) is True


def test_visibility_allowed_tool(app_context) -> None:
    """Tools where security_manager grants access are visible."""
    g.user = MagicMock(username="admin")
    func = _make_tool_func(class_perm="Chart", method_perm="read")
    tool = MagicMock()
    tool.fn = func

    mock_sm = MagicMock()
    mock_sm.can_access = MagicMock(return_value=True)
    with patch("superset.mcp_service.auth.security_manager", mock_sm):
        result = is_tool_visible_to_current_user(tool)

    assert result is True


def test_visibility_denied_tool(app_context) -> None:
    """Tools where security_manager denies access are hidden."""
    g.user = MagicMock(username="viewer")
    func = _make_tool_func(class_perm="Dashboard", method_perm="write")
    tool = MagicMock()
    tool.fn = func

    mock_sm = MagicMock()
    mock_sm.can_access = MagicMock(return_value=False)
    with patch("superset.mcp_service.auth.security_manager", mock_sm):
        result = is_tool_visible_to_current_user(tool)

    assert result is False


def test_visibility_data_model_metadata_denied(app_context) -> None:
    """Tools requiring data-model metadata access are hidden when user lacks it."""
    g.user = MagicMock(username="viewer")
    func = _make_tool_func(class_perm="Dataset", method_perm="read")
    func._requires_data_model_metadata_access = True  # type: ignore[attr-defined]
    tool = MagicMock()
    tool.fn = func

    mock_sm = MagicMock()
    mock_sm.can_access = MagicMock(return_value=True)
    with (
        patch("superset.mcp_service.auth.security_manager", mock_sm),
        patch(
            "superset.mcp_service.privacy.user_can_view_data_model_metadata",
            return_value=False,
        ),
    ):
        result = is_tool_visible_to_current_user(tool)

    assert result is False


def test_visibility_data_model_metadata_allowed(app_context) -> None:
    """Tools requiring data-model metadata access are visible when user has it."""
    g.user = MagicMock(username="alpha")
    func = _make_tool_func(class_perm="Dataset", method_perm="read")
    func._requires_data_model_metadata_access = True  # type: ignore[attr-defined]
    tool = MagicMock()
    tool.fn = func

    mock_sm = MagicMock()
    mock_sm.can_access = MagicMock(return_value=True)
    with (
        patch("superset.mcp_service.auth.security_manager", mock_sm),
        patch(
            "superset.mcp_service.privacy.user_can_view_data_model_metadata",
            return_value=True,
        ),
    ):
        result = is_tool_visible_to_current_user(tool)

    assert result is True


# -- Scope-aware authorization (intersection of token scopes and RBAC) --


def test_scope_denies_when_token_lacks_required_scope(app_context) -> None:
    """RBAC grants but the token does not carry the required write scope: deny."""
    g.user = MagicMock(username="editor")
    func = _make_tool_func(class_perm="Chart", method_perm="write")

    mock_sm = MagicMock()
    mock_sm.can_access = MagicMock(return_value=True)
    with (
        patch("superset.security_manager", mock_sm),
        _patch_token_scopes(["superset:read"]),
    ):
        result = check_tool_permission(func)

    assert result is False


def test_scope_allows_when_token_has_required_scope(app_context) -> None:
    """RBAC grants and the token carries the required write scope: allow."""
    g.user = MagicMock(username="editor")
    func = _make_tool_func(class_perm="Chart", method_perm="write")

    mock_sm = MagicMock()
    mock_sm.can_access = MagicMock(return_value=True)
    with (
        patch("superset.security_manager", mock_sm),
        _patch_token_scopes(["superset:read", "superset:write"]),
    ):
        result = check_tool_permission(func)

    assert result is True


def test_scope_falls_back_to_rbac_when_token_has_no_scopes(app_context) -> None:
    """Token present but with no scopes: RBAC-only behavior (back-compat)."""
    g.user = MagicMock(username="editor")
    func = _make_tool_func(class_perm="Chart", method_perm="write")

    mock_sm = MagicMock()
    mock_sm.can_access = MagicMock(return_value=True)
    with (
        patch("superset.security_manager", mock_sm),
        _patch_token_scopes([]),
    ):
        result = check_tool_permission(func)

    # No scopes advertised -> scope check is skipped, RBAC grant stands.
    assert result is True


def test_scope_falls_back_to_rbac_when_no_jwt_context(app_context) -> None:
    """No JWT context at all (e.g. API key / dev mode): RBAC-only behavior."""
    g.user = MagicMock(username="editor")
    func = _make_tool_func(class_perm="Chart", method_perm="read")

    mock_sm = MagicMock()
    mock_sm.can_access = MagicMock(return_value=True)
    with (
        patch("superset.security_manager", mock_sm),
        _patch_token_scopes(None),
    ):
        result = check_tool_permission(func)

    assert result is True


def test_scope_read_denied_when_token_lacks_read_scope(app_context) -> None:
    """A read tool is denied when the token only carries an unrelated scope."""
    g.user = MagicMock(username="viewer")
    func = _make_tool_func(class_perm="Chart", method_perm="read")

    mock_sm = MagicMock()
    mock_sm.can_access = MagicMock(return_value=True)
    with (
        patch("superset.security_manager", mock_sm),
        _patch_token_scopes(["some:other-scope"]),
    ):
        result = check_tool_permission(func)

    assert result is False


def test_scope_denies_unmapped_method_for_scoped_token(app_context) -> None:
    """A scoped token presented for a method permission that is NOT in the
    scope map fails closed (denied), even when RBAC grants, so an unmapped
    custom permission cannot silently bypass scope enforcement."""
    g.user = MagicMock(username="editor")
    func = _make_tool_func(class_perm="Chart", method_perm="some_custom_perm")

    mock_sm = MagicMock()
    mock_sm.can_access = MagicMock(return_value=True)
    with (
        patch("superset.security_manager", mock_sm),
        _patch_token_scopes(["superset:read", "superset:write"]),
    ):
        result = check_tool_permission(func)

    assert result is False


def test_scope_execute_sql_query_requires_write_scope(app_context) -> None:
    """SQL execution (execute_sql_query) is a write-class operation: a scoped
    token must carry the write scope, and a read-only scope is denied."""
    g.user = MagicMock(username="analyst")
    func = _make_tool_func(class_perm="SQLLab", method_perm="execute_sql_query")

    mock_sm = MagicMock()
    mock_sm.can_access = MagicMock(return_value=True)
    with patch("superset.security_manager", mock_sm):
        with _patch_token_scopes(["superset:read"]):
            assert check_tool_permission(func) is False
        with _patch_token_scopes(["superset:write"]):
            assert check_tool_permission(func) is True
