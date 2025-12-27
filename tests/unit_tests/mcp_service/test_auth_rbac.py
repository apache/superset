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
Unit tests for MCP RBAC permission enforcement.

These tests verify that MCP tools respect the same RBAC permission model
as Superset's REST API endpoints, using the attribute-based permission pattern
that mirrors Flask-AppBuilder's @protect() decorator.
"""

import sys
from unittest.mock import MagicMock, Mock, patch

import pytest
from flask import g

from superset.mcp_service.auth import (
    check_tool_permission,
    CLASS_PERMISSION_ATTR,
    mcp_auth_hook,
    MCPPermissionDeniedError,
    METHOD_PERMISSION_ATTR,
    PERMISSION_PREFIX,
    require_tool_permission,
)


@pytest.fixture
def mock_security_manager():
    """Create a mock security manager."""
    mock_sm = MagicMock()
    return mock_sm


@pytest.fixture
def mock_user():
    """Create a mock user."""
    user = Mock()
    user.username = "test_user"
    user.roles = []
    return user


def create_tool_function_with_permissions(
    name: str,
    class_permission: str | None = None,
    method_permission: str | None = None,
):
    """Helper to create a mock tool function with permission attributes."""

    def tool_func():
        return "success"

    tool_func.__name__ = name
    if class_permission:
        setattr(tool_func, CLASS_PERMISSION_ATTR, class_permission)
    if method_permission:
        setattr(tool_func, METHOD_PERMISSION_ATTR, method_permission)
    return tool_func


class TestPermissionConstants:
    """Tests for permission-related constants."""

    def test_permission_prefix(self):
        """Verify permission prefix matches FAB convention."""
        assert PERMISSION_PREFIX == "can_"

    def test_class_permission_attr(self):
        """Verify class permission attribute name."""
        assert CLASS_PERMISSION_ATTR == "_class_permission_name"

    def test_method_permission_attr(self):
        """Verify method permission attribute name."""
        assert METHOD_PERMISSION_ATTR == "_method_permission_name"


class TestCheckToolPermission:
    """Tests for check_tool_permission function."""

    def test_permission_granted(self, mock_security_manager, mock_user):
        """Test when user has required permission."""
        mock_user.username = "admin"
        mock_security_manager.can_access.return_value = True

        # Create a tool function with permission attributes
        tool_func = create_tool_function_with_permissions(
            "execute_sql",
            class_permission="SQLLab",
            method_permission="execute_sql",
        )

        with patch.dict(
            sys.modules, {"superset": MagicMock(security_manager=mock_security_manager)}
        ):
            with patch.object(g, "user", mock_user, create=True):
                result = check_tool_permission(tool_func)

                assert result is True
                mock_security_manager.can_access.assert_called_once_with(
                    "can_execute_sql", "SQLLab"
                )

    def test_permission_denied(self, mock_security_manager, mock_user):
        """Test when user lacks required permission."""
        mock_user.username = "limited_user"
        mock_security_manager.can_access.return_value = False

        tool_func = create_tool_function_with_permissions(
            "generate_chart",
            class_permission="Chart",
            method_permission="write",
        )

        with patch.dict(
            sys.modules, {"superset": MagicMock(security_manager=mock_security_manager)}
        ):
            with patch.object(g, "user", mock_user, create=True):
                result = check_tool_permission(tool_func)

                assert result is False

    def test_no_user_context_denied(self):
        """Test that permission is denied when no user context exists."""
        tool_func = create_tool_function_with_permissions(
            "list_charts",
            class_permission="Chart",
            method_permission="read",
        )

        # Create a fresh g object without user
        mock_g = MagicMock(spec=[])  # No 'user' attribute
        with patch("superset.mcp_service.auth.g", mock_g):
            result = check_tool_permission(tool_func)
            assert result is False

    def test_no_class_permission_allowed_by_default(
        self, mock_security_manager, mock_user
    ):
        """Test that tools without class_permission are allowed (backward compat)."""
        mock_user.username = "admin"

        # Tool without permission attributes
        tool_func = create_tool_function_with_permissions("legacy_tool")

        with patch.dict(
            sys.modules, {"superset": MagicMock(security_manager=mock_security_manager)}
        ):
            with patch.object(g, "user", mock_user, create=True):
                result = check_tool_permission(tool_func)

                assert result is True
                # security_manager.can_access should not be called
                mock_security_manager.can_access.assert_not_called()

    def test_default_method_permission_is_read(self, mock_security_manager, mock_user):
        """Test that method_permission defaults to 'read' when not specified."""
        mock_user.username = "admin"
        mock_security_manager.can_access.return_value = True

        # Tool with class_permission but no method_permission
        tool_func = create_tool_function_with_permissions(
            "list_charts",
            class_permission="Chart",
            # method_permission not set - should default to "read"
        )

        with patch.dict(
            sys.modules, {"superset": MagicMock(security_manager=mock_security_manager)}
        ):
            with patch.object(g, "user", mock_user, create=True):
                result = check_tool_permission(tool_func)

                assert result is True
                mock_security_manager.can_access.assert_called_once_with(
                    "can_read", "Chart"
                )


class TestRequireToolPermission:
    """Tests for require_tool_permission function."""

    def test_permission_granted_no_exception(self, mock_security_manager, mock_user):
        """Test no exception when permission is granted."""
        mock_user.username = "admin"
        mock_security_manager.can_access.return_value = True

        tool_func = create_tool_function_with_permissions(
            "list_charts",
            class_permission="Chart",
            method_permission="read",
        )

        with patch.dict(
            sys.modules, {"superset": MagicMock(security_manager=mock_security_manager)}
        ):
            with patch.object(g, "user", mock_user, create=True):
                # Should not raise
                require_tool_permission(tool_func)

    def test_permission_denied_raises_exception(self, mock_security_manager, mock_user):
        """Test MCPPermissionDeniedError when permission is denied."""
        mock_user.username = "limited_user"
        mock_security_manager.can_access.return_value = False

        tool_func = create_tool_function_with_permissions(
            "execute_sql",
            class_permission="SQLLab",
            method_permission="execute_sql",
        )

        with patch.dict(
            sys.modules, {"superset": MagicMock(security_manager=mock_security_manager)}
        ):
            with patch.object(g, "user", mock_user, create=True):
                with pytest.raises(MCPPermissionDeniedError) as exc_info:
                    require_tool_permission(tool_func)

                assert exc_info.value.permission_name == "can_execute_sql"
                assert exc_info.value.view_name == "SQLLab"
                assert exc_info.value.user == "limited_user"
                assert exc_info.value.tool_name == "execute_sql"


class TestMCPPermissionDeniedError:
    """Tests for MCPPermissionDeniedError exception."""

    def test_error_message_format(self):
        """Test error message contains all relevant information."""
        error = MCPPermissionDeniedError(
            permission_name="can_write",
            view_name="Chart",
            user="test_user",
            tool_name="generate_chart",
        )

        message = str(error)
        assert "can_write" in message
        assert "Chart" in message
        assert "test_user" in message
        assert "generate_chart" in message

    def test_error_without_user(self):
        """Test error message without user context."""
        error = MCPPermissionDeniedError(
            permission_name="can_read",
            view_name="Dashboard",
        )

        message = str(error)
        assert "can_read" in message
        assert "Dashboard" in message
        assert "for user" not in message


class TestMCPAuthHookWithPermissions:
    """Tests for mcp_auth_hook decorator with permission checking.

    NOTE: The mcp_auth_hook decorator imports fastmcp.Context which has
    beartype circular import issues in unit tests. These tests mock the
    fastmcp import to avoid the issue while still testing the permission
    checking logic.

    IMPORTANT: We must mock check_tool_permission directly rather than
    patching sys.modules with superset, because patching sys.modules breaks
    the reference to superset.mcp_service.auth.get_user_from_request.
    """

    def test_sync_function_permission_check(self, mock_security_manager, mock_user):
        """Test permission check for synchronous tool function."""
        mock_user.username = "admin"

        # Create the function with permission attributes BEFORE decorating
        def execute_sql():
            return "success"

        setattr(execute_sql, CLASS_PERMISSION_ATTR, "SQLLab")
        setattr(execute_sql, METHOD_PERMISSION_ATTR, "execute_sql")

        # Mock fastmcp to avoid beartype circular import issues
        mock_fastmcp = MagicMock()
        mock_fastmcp.Context = MagicMock()

        with patch.dict(sys.modules, {"fastmcp": mock_fastmcp}):
            with patch(
                "superset.mcp_service.auth.get_user_from_request",
                return_value=mock_user,
            ):
                with patch(
                    "superset.mcp_service.auth.check_tool_permission",
                    return_value=True,
                ) as mock_check:
                    # Now apply the decorator
                    decorated = mcp_auth_hook(execute_sql)
                    result = decorated()

                    assert result == "success"
                    # Verify check_tool_permission was called with the original func
                    mock_check.assert_called_once()

    def test_sync_function_permission_denied(self, mock_security_manager, mock_user):
        """Test permission denial for synchronous tool function."""
        mock_user.username = "limited_user"

        def execute_sql():
            return "should not reach here"

        setattr(execute_sql, CLASS_PERMISSION_ATTR, "SQLLab")
        setattr(execute_sql, METHOD_PERMISSION_ATTR, "execute_sql")

        mock_fastmcp = MagicMock()
        mock_fastmcp.Context = MagicMock()

        with patch.dict(sys.modules, {"fastmcp": mock_fastmcp}):
            with patch(
                "superset.mcp_service.auth.get_user_from_request",
                return_value=mock_user,
            ):
                with patch(
                    "superset.mcp_service.auth.check_tool_permission",
                    return_value=False,
                ):
                    decorated = mcp_auth_hook(execute_sql)

                    with pytest.raises(MCPPermissionDeniedError):
                        decorated()

    @pytest.mark.asyncio
    async def test_async_function_permission_check(
        self, mock_security_manager, mock_user
    ):
        """Test permission check for asynchronous tool function."""
        mock_user.username = "admin"

        async def list_charts():
            return "charts"

        setattr(list_charts, CLASS_PERMISSION_ATTR, "Chart")
        setattr(list_charts, METHOD_PERMISSION_ATTR, "read")

        mock_fastmcp = MagicMock()
        mock_fastmcp.Context = MagicMock()

        with patch.dict(sys.modules, {"fastmcp": mock_fastmcp}):
            with patch(
                "superset.mcp_service.auth.get_user_from_request",
                return_value=mock_user,
            ):
                with patch(
                    "superset.mcp_service.auth.check_tool_permission",
                    return_value=True,
                ) as mock_check:
                    decorated = mcp_auth_hook(list_charts)
                    result = await decorated()

                    assert result == "charts"
                    mock_check.assert_called_once()

    @pytest.mark.asyncio
    async def test_async_function_permission_denied(
        self, mock_security_manager, mock_user
    ):
        """Test permission denial for asynchronous tool function."""
        mock_user.username = "limited_user"

        async def generate_chart():
            return "should not reach here"

        setattr(generate_chart, CLASS_PERMISSION_ATTR, "Chart")
        setattr(generate_chart, METHOD_PERMISSION_ATTR, "write")

        mock_fastmcp = MagicMock()
        mock_fastmcp.Context = MagicMock()

        with patch.dict(sys.modules, {"fastmcp": mock_fastmcp}):
            with patch(
                "superset.mcp_service.auth.get_user_from_request",
                return_value=mock_user,
            ):
                with patch(
                    "superset.mcp_service.auth.check_tool_permission",
                    return_value=False,
                ):
                    decorated = mcp_auth_hook(generate_chart)

                    with pytest.raises(MCPPermissionDeniedError):
                        await decorated()

    def test_skip_permission_check(self, mock_user):
        """Test skipping permission check with check_permissions=False."""
        mock_user.username = "any_user"

        def my_public_tool():
            return "public"

        # Even with permissions set, check_permissions=False should skip
        setattr(my_public_tool, CLASS_PERMISSION_ATTR, "RestrictedView")
        setattr(my_public_tool, METHOD_PERMISSION_ATTR, "write")

        mock_fastmcp = MagicMock()
        mock_fastmcp.Context = MagicMock()

        with patch.dict(sys.modules, {"fastmcp": mock_fastmcp}):
            with patch(
                "superset.mcp_service.auth.get_user_from_request",
                return_value=mock_user,
            ):
                decorated = mcp_auth_hook(check_permissions=False)(my_public_tool)

                # Should succeed without permission check
                result = decorated()
                assert result == "public"


class TestPermissionAttributeCopying:
    """Tests to verify permission attributes are copied to wrapped function."""

    def test_attributes_copied_to_wrapper(self, mock_user):
        """Test that permission attributes are preserved on wrapped function."""

        def my_tool():
            return "result"

        setattr(my_tool, CLASS_PERMISSION_ATTR, "TestView")
        setattr(my_tool, METHOD_PERMISSION_ATTR, "test_action")

        mock_fastmcp = MagicMock()
        mock_fastmcp.Context = MagicMock()

        with patch.dict(sys.modules, {"fastmcp": mock_fastmcp}):
            with patch(
                "superset.mcp_service.auth.get_user_from_request",
                return_value=mock_user,
            ):
                # Apply the decorator
                decorated = mcp_auth_hook(check_permissions=False)(my_tool)

                # Verify attributes are copied
                assert hasattr(decorated, CLASS_PERMISSION_ATTR)
                assert hasattr(decorated, METHOD_PERMISSION_ATTR)
                assert getattr(decorated, CLASS_PERMISSION_ATTR) == "TestView"
                assert getattr(decorated, METHOD_PERMISSION_ATTR) == "test_action"


class TestFABPermissionPatternAlignment:
    """Tests to verify alignment with Flask-AppBuilder permission patterns."""

    def test_read_permission_pattern(self, mock_security_manager, mock_user):
        """Test can_read permission pattern (like FAB GET endpoints)."""
        mock_user.username = "reader"
        mock_security_manager.can_access.return_value = True

        tool_func = create_tool_function_with_permissions(
            "list_dashboards",
            class_permission="Dashboard",
            method_permission="read",
        )

        with patch.dict(
            sys.modules, {"superset": MagicMock(security_manager=mock_security_manager)}
        ):
            with patch.object(g, "user", mock_user, create=True):
                result = check_tool_permission(tool_func)

                assert result is True
                mock_security_manager.can_access.assert_called_once_with(
                    "can_read", "Dashboard"
                )

    def test_write_permission_pattern(self, mock_security_manager, mock_user):
        """Test can_write permission pattern (like FAB POST/PUT endpoints)."""
        mock_user.username = "writer"
        mock_security_manager.can_access.return_value = True

        tool_func = create_tool_function_with_permissions(
            "generate_dashboard",
            class_permission="Dashboard",
            method_permission="write",
        )

        with patch.dict(
            sys.modules, {"superset": MagicMock(security_manager=mock_security_manager)}
        ):
            with patch.object(g, "user", mock_user, create=True):
                result = check_tool_permission(tool_func)

                assert result is True
                mock_security_manager.can_access.assert_called_once_with(
                    "can_write", "Dashboard"
                )

    def test_custom_permission_pattern(self, mock_security_manager, mock_user):
        """Test custom permission pattern (like SQLLab's can_execute_sql)."""
        mock_user.username = "sql_user"
        mock_security_manager.can_access.return_value = True

        tool_func = create_tool_function_with_permissions(
            "execute_sql",
            class_permission="SQLLab",
            method_permission="execute_sql",  # Custom permission like FAB
        )

        with patch.dict(
            sys.modules, {"superset": MagicMock(security_manager=mock_security_manager)}
        ):
            with patch.object(g, "user", mock_user, create=True):
                result = check_tool_permission(tool_func)

                assert result is True
                mock_security_manager.can_access.assert_called_once_with(
                    "can_execute_sql", "SQLLab"
                )
