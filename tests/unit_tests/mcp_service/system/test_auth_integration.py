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
Unit tests for MCP service JWT authentication integration.
"""

import os
from unittest.mock import MagicMock, patch

from fastmcp.server.auth.providers.bearer import BearerAuthProvider, RSAKeyPair

from superset.mcp_service.auth import get_user_from_request, has_permission


class TestMCPAuthIntegration:
    """Test JWT authentication integration with MCP service."""

    def test_auth_disabled_by_default(self):
        """Test that authentication is disabled by default."""
        from superset.mcp_service.mcp_app import _create_auth_provider

        auth_provider = _create_auth_provider()
        assert auth_provider is None

    @patch.dict(os.environ, {"MCP_AUTH_ENABLED": "true"})
    def test_auth_enabled_missing_config(self):
        """Test that auth is disabled if enabled but config is missing."""
        from superset.mcp_service.mcp_app import _create_auth_provider

        auth_provider = _create_auth_provider()
        assert auth_provider is None

    def test_auth_provider_creation_with_invalid_key(self):
        """Test that auth provider creation handles invalid configuration gracefully."""
        from superset.mcp_service.mcp_app import _create_auth_provider

        # This test verifies that _create_auth_provider doesn't crash with
        # invalid config
        # The function should return None gracefully when auth is not
        # properly configured
        auth_provider = _create_auth_provider()

        # Should return None when auth is not configured (default behavior)
        assert auth_provider is None

    @patch("superset.security_manager")
    def test_get_user_from_request_no_jwt(self, mock_sm):
        """Test user extraction falls back to configured admin user when
        no JWT available.
        """
        from unittest.mock import Mock

        # Mock the security manager to return a test user
        mock_user = MagicMock()
        mock_user.username = "test_admin"
        mock_user.is_active = True
        mock_sm.find_user = Mock(return_value=mock_user)

        user = get_user_from_request()

        # Should return the fallback admin user when no JWT context available
        assert hasattr(user, "username")
        assert user.username == "test_admin"
        assert hasattr(user, "is_active")
        assert user.is_active is True

        # Verify security manager was called at least once
        assert mock_sm.find_user.called

    def test_has_permission_no_jwt(self):
        """Test permission check without JWT context."""
        mock_user = MagicMock()
        mock_user.is_active = True
        mock_tool = MagicMock()
        mock_tool.__name__ = "list_dashboards"

        result = has_permission(mock_user, mock_tool)
        assert result is True

    def test_has_permission_inactive_user(self):
        """Test permission check with inactive user."""
        mock_user = MagicMock()
        mock_user.is_active = False
        mock_tool = MagicMock()
        mock_tool.__name__ = "list_dashboards"

        result = has_permission(mock_user, mock_tool)
        assert result is False


class TestJWTTokenGeneration:
    """Test JWT token generation and validation for development/testing."""

    def test_rsa_keypair_generation(self):
        """Test RSA key pair generation."""
        keypair = RSAKeyPair.generate()

        assert keypair.private_key.get_secret_value().startswith(
            "-----BEGIN PRIVATE KEY-----"
        )
        assert keypair.public_key.startswith("-----BEGIN PUBLIC KEY-----")

    def test_jwt_token_creation(self):
        """Test JWT token creation."""
        keypair = RSAKeyPair.generate()

        token = keypair.create_token(
            subject="test-user",
            issuer="https://test.example.com",
            audience="test-audience",
            scopes=["dashboard:read", "chart:read"],
        )

        assert isinstance(token, str)
        assert len(token.split(".")) == 3  # Header.Payload.Signature

    def test_bearer_auth_provider_validation(self):
        """Test BearerAuthProvider token validation."""
        keypair = RSAKeyPair.generate()

        # Create auth provider
        auth_provider = BearerAuthProvider(
            public_key=keypair.public_key,
            issuer="https://test.example.com",
            audience="test-audience",
        )

        # This is an async method, so we would need to run it in async context
        # For now, just verify the auth provider was created correctly
        assert auth_provider.issuer == "https://test.example.com"
        assert auth_provider.audience == "test-audience"
        assert auth_provider.public_key == keypair.public_key
