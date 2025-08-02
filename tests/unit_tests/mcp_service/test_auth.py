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
    get_mcp_audit_context,
    get_user_from_request,
    has_permission,
    impersonate_user,
    mcp_auth_hook,
    sanitize_mcp_payload,
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
        app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
        app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
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
        mock_func.__name__ = "generate_chart"
        assert has_permission(mock_user, mock_func) is False

    def test_has_permission_no_jwt(self, mock_user):
        """Test permission checking without JWT."""
        mock_func = MagicMock(__name__="generate_chart")

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

            # Disable event logger to avoid database issues
            with patch("superset.mcp_service.auth.event_logger", None):

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

    def test_sanitize_mcp_payload(self):
        """Test MCP payload sanitization for audit logging."""
        # Test sensitive field redaction
        payload = {
            "dataset_id": 123,
            "password": "secret123",
            "auth_token": "Bearer xyz",
            "api_key": "key123",
            "config": {"chart_type": "table"},
            "normal_field": "value",
        }

        sanitized = sanitize_mcp_payload(payload)

        assert sanitized["dataset_id"] == 123
        assert sanitized["password"] == "[REDACTED]"  # noqa: S105
        assert sanitized["auth_token"] == "[REDACTED]"  # noqa: S105
        assert sanitized["api_key"] == "[REDACTED]"
        assert sanitized["config"] == {"chart_type": "table"}
        assert sanitized["normal_field"] == "value"

    def test_sanitize_mcp_payload_truncation(self):
        """Test payload truncation for large values."""
        long_text = "x" * 1500
        payload = {"long_field": long_text, "short_field": "short"}

        sanitized = sanitize_mcp_payload(payload)

        assert len(sanitized["long_field"]) == 1000 + len("...[TRUNCATED]")
        assert sanitized["long_field"].endswith("...[TRUNCATED]")
        assert sanitized["short_field"] == "short"

    def test_get_mcp_audit_context(self, app, mock_user):
        """Test MCP audit context generation."""
        with app.app_context():
            with app.test_request_context(
                headers={
                    "User-Agent": "Claude-3.5-Sonnet",
                    "X-Session-ID": "session123",
                }
            ):
                g.user = mock_user

                def mock_tool():
                    pass

                mock_tool.__name__ = "test_tool"

                kwargs = {"dataset_id": 123, "config": {"type": "chart"}}

                context = get_mcp_audit_context(mock_tool, kwargs)

                assert context["log_source"] == "mcp"
                assert context["impersonation"] == "testuser"
                assert context["mcp_tool"] == "test_tool"
                assert context["model_info"] == "Claude-3.5-Sonnet"
                assert context["session_info"] == "session123"
                assert "whitelisted_payload" in context

    def test_get_mcp_audit_context_no_request(self, app, mock_user):
        """Test audit context generation when request info unavailable."""
        with app.app_context():
            g.user = mock_user

            def mock_tool():
                pass

            mock_tool.__name__ = "test_tool"

            kwargs = {"dataset_id": 123}

            # No request context
            context = get_mcp_audit_context(mock_tool, kwargs)

            assert context["log_source"] == "mcp"
            assert context["impersonation"] == "testuser"
            assert context["mcp_tool"] == "test_tool"
            # Should handle missing request gracefully

    @patch("superset.extensions.event_logger")
    @patch("superset.security_manager")
    @patch("fastmcp.server.dependencies.get_access_token")
    def test_mcp_auth_hook_with_audit_logging(
        self, mock_get_token, mock_sm, mock_event_logger, app, mock_user, mock_token
    ):
        """Test auth decorator with audit logging enabled."""
        with app.app_context():
            mock_get_token.return_value = mock_token
            mock_sm.find_user = Mock(return_value=mock_user)
            mock_event_logger.log_this_with_context = Mock(return_value=lambda f: f)

            # Mock the event logger to avoid database issues
            with patch("superset.mcp_service.auth.event_logger", mock_event_logger):

                @mcp_auth_hook
                def test_tool():
                    return "success"

                result = test_tool()
                assert result == "success"
                assert g.user == mock_user
                assert hasattr(g, "mcp_audit_context")
                assert g.mcp_audit_context["log_source"] == "mcp"

    @patch("superset.security_manager")
    @patch("fastmcp.server.dependencies.get_access_token")
    def test_mcp_auth_hook_without_event_logger(
        self, mock_get_token, mock_sm, app, mock_user, mock_token
    ):
        """Test auth decorator gracefully handles missing event logger."""
        with app.app_context():
            mock_get_token.return_value = mock_token
            mock_sm.find_user = Mock(return_value=mock_user)

            # Event logger is None (fallback case)
            with patch("superset.mcp_service.auth.event_logger", None):

                @mcp_auth_hook
                def test_tool():
                    return "success"

                result = test_tool()
                assert result == "success"
                assert g.user == mock_user
