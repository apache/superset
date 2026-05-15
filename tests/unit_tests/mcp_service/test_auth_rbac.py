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
    with patch("superset.security_manager", mock_sm):
        result = check_tool_permission(func)

    assert result is True
    mock_sm.can_access.assert_called_once_with("can_read", "Chart")


def test_check_tool_permission_denied(app_context) -> None:
    """When security_manager.can_access returns False, permission is denied."""
    g.user = MagicMock(username="viewer")
    func = _make_tool_func(class_perm="Dashboard", method_perm="write")

    mock_sm = MagicMock()
    mock_sm.can_access = MagicMock(return_value=False)
    with patch("superset.security_manager", mock_sm):
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
    with patch("superset.security_manager", mock_sm):
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
