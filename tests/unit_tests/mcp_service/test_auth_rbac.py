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
as Superset's REST API endpoints.
"""

import sys
from unittest.mock import MagicMock, Mock, patch

import pytest
from flask import g

from superset.mcp_service.auth import (
    check_tool_permission,
    mcp_auth_hook,
    MCP_TOOL_PERMISSIONS,
    MCPPermissionDeniedError,
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


class TestMCPToolPermissions:
    """Tests for the permission registry mapping."""

    def test_execute_sql_requires_sqllab_permission(self):
        """Verify execute_sql tool requires SQLLab permission."""
        assert "execute_sql" in MCP_TOOL_PERMISSIONS
        permission, view = MCP_TOOL_PERMISSIONS["execute_sql"]
        assert permission == "can_execute_sql"
        assert view == "SQLLab"

    def test_chart_tools_require_chart_permissions(self):
        """Verify chart tools require Chart permissions."""
        chart_tools = [
            "list_charts",
            "get_chart_info",
            "get_chart_preview",
            "get_chart_data",
            "generate_chart",
            "update_chart",
        ]
        for tool_name in chart_tools:
            assert tool_name in MCP_TOOL_PERMISSIONS
            permission, view = MCP_TOOL_PERMISSIONS[tool_name]
            assert view == "Chart"

    def test_dashboard_tools_require_dashboard_permissions(self):
        """Verify dashboard tools require Dashboard permissions."""
        dashboard_tools = [
            "list_dashboards",
            "get_dashboard_info",
            "generate_dashboard",
        ]
        for tool_name in dashboard_tools:
            assert tool_name in MCP_TOOL_PERMISSIONS
            permission, view = MCP_TOOL_PERMISSIONS[tool_name]
            assert view == "Dashboard"

    def test_read_vs_write_permissions(self):
        """Verify read ops require can_read, write ops require can_write."""
        read_tools = ["list_charts", "get_chart_info", "list_dashboards"]
        write_tools = ["generate_chart", "update_chart", "generate_dashboard"]

        for tool_name in read_tools:
            permission, _ = MCP_TOOL_PERMISSIONS[tool_name]
            assert permission == "can_read", f"{tool_name} should require can_read"

        for tool_name in write_tools:
            permission, _ = MCP_TOOL_PERMISSIONS[tool_name]
            assert permission == "can_write", f"{tool_name} should require can_write"


class TestCheckToolPermission:
    """Tests for check_tool_permission function."""

    def test_permission_granted(self, mock_security_manager, mock_user):
        """Test when user has required permission."""
        mock_user.username = "admin"
        mock_security_manager.can_access.return_value = True

        # Patch the superset module's security_manager
        with patch.dict(
            sys.modules, {"superset": MagicMock(security_manager=mock_security_manager)}
        ):
            with patch.object(g, "user", mock_user, create=True):
                result = check_tool_permission("execute_sql")

                assert result is True
                mock_security_manager.can_access.assert_called_once_with(
                    "can_execute_sql", "SQLLab"
                )

    def test_permission_denied(self, mock_security_manager, mock_user):
        """Test when user lacks required permission."""
        mock_user.username = "limited_user"
        mock_security_manager.can_access.return_value = False

        with patch.dict(
            sys.modules, {"superset": MagicMock(security_manager=mock_security_manager)}
        ):
            with patch.object(g, "user", mock_user, create=True):
                result = check_tool_permission("execute_sql")

                assert result is False

    def test_no_user_context_denied(self):
        """Test that permission is denied when no user context exists."""
        # Create a fresh g object without user
        mock_g = MagicMock(spec=[])  # No 'user' attribute
        with patch("superset.mcp_service.auth.g", mock_g):
            result = check_tool_permission("execute_sql")
            assert result is False

    def test_unregistered_tool_allowed_by_default(
        self, mock_security_manager, mock_user
    ):
        """Test that tools not in registry are allowed (backward compatibility)."""
        mock_user.username = "admin"

        with patch.dict(
            sys.modules, {"superset": MagicMock(security_manager=mock_security_manager)}
        ):
            with patch.object(g, "user", mock_user, create=True):
                result = check_tool_permission("unregistered_custom_tool")

                assert result is True
                # security_manager.can_access should not be called
                mock_security_manager.can_access.assert_not_called()

    def test_explicit_permission_override(self, mock_security_manager, mock_user):
        """Test explicit permission/view parameters override registry."""
        mock_user.username = "admin"
        mock_security_manager.can_access.return_value = True

        with patch.dict(
            sys.modules, {"superset": MagicMock(security_manager=mock_security_manager)}
        ):
            with patch.object(g, "user", mock_user, create=True):
                result = check_tool_permission(
                    "execute_sql",
                    permission_name="custom_permission",
                    view_name="CustomView",
                )

                assert result is True
                mock_security_manager.can_access.assert_called_once_with(
                    "custom_permission", "CustomView"
                )


class TestRequireToolPermission:
    """Tests for require_tool_permission function."""

    def test_permission_granted_no_exception(self, mock_security_manager, mock_user):
        """Test no exception when permission is granted."""
        mock_user.username = "admin"
        mock_security_manager.can_access.return_value = True

        with patch.dict(
            sys.modules, {"superset": MagicMock(security_manager=mock_security_manager)}
        ):
            with patch.object(g, "user", mock_user, create=True):
                # Should not raise
                require_tool_permission("list_charts")

    def test_permission_denied_raises_exception(self, mock_security_manager, mock_user):
        """Test MCPPermissionDeniedError when permission is denied."""
        mock_user.username = "limited_user"
        mock_security_manager.can_access.return_value = False

        with patch.dict(
            sys.modules, {"superset": MagicMock(security_manager=mock_security_manager)}
        ):
            with patch.object(g, "user", mock_user, create=True):
                with pytest.raises(MCPPermissionDeniedError) as exc_info:
                    require_tool_permission("execute_sql")

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
    """Tests for mcp_auth_hook decorator with permission checking."""

    def test_sync_function_permission_check(self, mock_security_manager, mock_user):
        """Test permission check for synchronous tool function."""
        mock_user.username = "admin"
        mock_security_manager.can_access.return_value = True

        with patch.dict(
            sys.modules, {"superset": MagicMock(security_manager=mock_security_manager)}
        ):
            with patch(
                "superset.mcp_service.auth.get_user_from_request",
                return_value=mock_user,
            ):

                @mcp_auth_hook
                def execute_sql():
                    return "success"

                result = execute_sql()

                assert result == "success"
                mock_security_manager.can_access.assert_called_once_with(
                    "can_execute_sql", "SQLLab"
                )

    def test_sync_function_permission_denied(self, mock_security_manager, mock_user):
        """Test permission denial for synchronous tool function."""
        mock_user.username = "limited_user"
        mock_security_manager.can_access.return_value = False

        with patch.dict(
            sys.modules, {"superset": MagicMock(security_manager=mock_security_manager)}
        ):
            with patch(
                "superset.mcp_service.auth.get_user_from_request",
                return_value=mock_user,
            ):

                @mcp_auth_hook
                def execute_sql():
                    return "should not reach here"

                with pytest.raises(MCPPermissionDeniedError):
                    execute_sql()

    @pytest.mark.asyncio
    async def test_async_function_permission_check(
        self, mock_security_manager, mock_user
    ):
        """Test permission check for asynchronous tool function."""
        mock_user.username = "admin"
        mock_security_manager.can_access.return_value = True

        with patch.dict(
            sys.modules, {"superset": MagicMock(security_manager=mock_security_manager)}
        ):
            with patch(
                "superset.mcp_service.auth.get_user_from_request",
                return_value=mock_user,
            ):

                @mcp_auth_hook
                async def list_charts():
                    return "charts"

                result = await list_charts()

                assert result == "charts"
                mock_security_manager.can_access.assert_called_once_with(
                    "can_read", "Chart"
                )

    @pytest.mark.asyncio
    async def test_async_function_permission_denied(
        self, mock_security_manager, mock_user
    ):
        """Test permission denial for asynchronous tool function."""
        mock_user.username = "limited_user"
        mock_security_manager.can_access.return_value = False

        with patch.dict(
            sys.modules, {"superset": MagicMock(security_manager=mock_security_manager)}
        ):
            with patch(
                "superset.mcp_service.auth.get_user_from_request",
                return_value=mock_user,
            ):

                @mcp_auth_hook
                async def generate_chart():
                    return "should not reach here"

                with pytest.raises(MCPPermissionDeniedError):
                    await generate_chart()

    def test_skip_permission_check(self, mock_user):
        """Test skipping permission check with check_permissions=False."""
        mock_user.username = "any_user"

        with patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=mock_user,
        ):

            @mcp_auth_hook(check_permissions=False)
            def my_public_tool():
                return "public"

            # Should succeed without permission check
            result = my_public_tool()
            assert result == "public"


class TestIntegrationWithToolDecorator:
    """Integration tests for permission checking with the full tool decorator chain."""

    def test_tool_respects_rbac(self, mock_security_manager, mock_user):
        """Test that decorated tools properly enforce RBAC."""
        mock_user.username = "limited_user"

        with patch.dict(
            sys.modules, {"superset": MagicMock(security_manager=mock_security_manager)}
        ):
            with patch(
                "superset.mcp_service.auth.get_user_from_request",
                return_value=mock_user,
            ):
                # First call - permission granted
                mock_security_manager.can_access.return_value = True

                @mcp_auth_hook
                def list_dashboards():
                    return ["dashboard1", "dashboard2"]

                result = list_dashboards()
                assert result == ["dashboard1", "dashboard2"]

                # Second call - permission denied
                mock_security_manager.can_access.return_value = False

                @mcp_auth_hook
                def generate_dashboard():
                    return "new_dashboard"

                with pytest.raises(MCPPermissionDeniedError) as exc_info:
                    generate_dashboard()

                assert "can_write" in str(exc_info.value)
                assert "Dashboard" in str(exc_info.value)
