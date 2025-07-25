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

"""Unit tests for MCP service authentication."""

from unittest.mock import MagicMock, Mock, patch

import pytest
from flask import Flask, g

from superset.mcp_service.auth import (
    get_user_from_request,
    has_permission,
    impersonate_user,
    mcp_auth_hook,
)
from superset.mcp_service.config import (
    create_default_mcp_auth_factory,
    default_user_resolver,
)


class TestMCPAuth:
    """Test MCP authentication functionality."""

    @pytest.fixture
    def app(self):
        """Create test Flask app."""
        app = Flask(__name__)
        app.config["MCP_ADMIN_USERNAME"] = "admin"
        app.config["MCP_USER_RESOLVER"] = default_user_resolver
        return app

    @pytest.fixture
    def mock_user(self):
        """Create mock Superset user."""
        user = MagicMock()
        user.username = "testuser"
        user.id = 1
        user.is_active = True
        return user

    @pytest.fixture
    def mock_token(self):
        """Create mock JWT access token."""
        token = MagicMock()
        token.subject = "testuser"
        token.client_id = "testuser"
        token.scopes = ["dashboard:read", "chart:read"]
        token.payload = {"sub": "testuser", "email": "test@example.com"}
        return token

    def test_default_user_resolver(self, mock_token):
        """Test JWT user extraction."""
        # Test subject attribute
        mock_token.subject = "subject_user"
        assert default_user_resolver(mock_token) == "subject_user"

        # Test client_id fallback
        del mock_token.subject
        assert default_user_resolver(mock_token) == "testuser"

        # Test payload extraction
        del mock_token.client_id
        assert default_user_resolver(mock_token) == "testuser"

    @patch("superset.security_manager")
    @patch("fastmcp.server.dependencies.get_access_token")
    def test_get_user_from_jwt(
        self, mock_get_token, mock_sm, app, mock_user, mock_token
    ):
        """Test user extraction from JWT token."""
        with app.app_context():
            mock_get_token.return_value = mock_token
            # Use Mock instead of MagicMock to avoid async behavior
            mock_sm.find_user = Mock(return_value=mock_user)

            user = get_user_from_request()
            assert user == mock_user
            mock_sm.find_user.assert_called_once_with("testuser")

    @patch("superset.security_manager")
    @patch("fastmcp.server.dependencies.get_access_token")
    def test_get_user_fallback(self, mock_get_token, mock_sm, app, mock_user):
        """Test fallback to admin user when no JWT."""
        with app.app_context():
            mock_get_token.side_effect = Exception("No token")
            mock_sm.find_user = Mock(return_value=mock_user)

            user = get_user_from_request()
            assert user == mock_user
            mock_sm.find_user.assert_called_once_with("admin")

    @patch("superset.security_manager")
    def test_impersonate_user(self, mock_sm, mock_user):
        """Test user impersonation."""
        impersonated = MagicMock()
        impersonated.username = "other_user"
        mock_sm.find_user = Mock(return_value=impersonated)

        result = impersonate_user(mock_user, "other_user")
        assert result == impersonated
        mock_sm.find_user.assert_called_once_with("other_user")

        # Test no impersonation
        result = impersonate_user(mock_user, None)
        assert result == mock_user

    @patch("fastmcp.server.dependencies.get_access_token")
    def test_has_permission_with_scopes(self, mock_get_token, mock_user, mock_token):
        """Test permission checking with JWT scopes."""
        mock_get_token.return_value = mock_token

        # Test allowed access
        mock_func = MagicMock(__name__="list_dashboards")
        assert has_permission(mock_user, mock_func) is True

        # Test denied access
        mock_func.__name__ = "create_chart"
        assert has_permission(mock_user, mock_func) is False

    def test_has_permission_no_jwt(self, mock_user):
        """Test permission checking without JWT."""
        mock_func = MagicMock(__name__="create_chart")

        # Should allow access when no JWT
        with patch(
            "fastmcp.server.dependencies.get_access_token",
            side_effect=Exception("No token"),
        ):
            assert has_permission(mock_user, mock_func) is True

    @patch("superset.security_manager")
    @patch("fastmcp.server.dependencies.get_access_token")
    def test_mcp_auth_hook_decorator(
        self, mock_get_token, mock_sm, app, mock_user, mock_token
    ):
        """Test the auth decorator."""
        with app.app_context():
            mock_get_token.return_value = mock_token
            mock_sm.find_user = Mock(return_value=mock_user)

            @mcp_auth_hook
            def test_tool():
                return "success"

            result = test_tool()
            assert result == "success"
            assert g.user == mock_user

    def test_create_default_auth_factory(self, app):
        """Test auth factory creation."""
        # Test disabled auth
        app.config["MCP_AUTH_ENABLED"] = False
        assert create_default_mcp_auth_factory(app) is None

        # Test missing keys
        app.config["MCP_AUTH_ENABLED"] = True
        assert create_default_mcp_auth_factory(app) is None

        # Test successful creation with mock
        app.config["MCP_JWKS_URI"] = "https://example.com/.well-known/jwks"
        with patch(
            "fastmcp.server.auth.providers.bearer.BearerAuthProvider"
        ) as mock_provider:
            result = create_default_mcp_auth_factory(app)
            mock_provider.assert_called_once()
            assert result is not None
