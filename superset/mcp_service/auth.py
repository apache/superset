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
Authentication framework for the Superset MCP Service.

This module provides the basic authentication framework that will be extended
in subsequent PRs to support various authentication methods including:
- Token-based authentication
- Session-based authentication
- OAuth integration
- RBAC (Role-Based Access Control)
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional


class AuthProvider(Enum):
    """Supported authentication providers."""

    NONE = "none"
    TOKEN = "token"  # noqa: S105
    SESSION = "session"
    OAUTH = "oauth"


@dataclass
class AuthContext:
    """
    Authentication context for MCP service requests.

    This will be populated with user information and permissions
    when authentication is fully implemented.
    """

    user_id: Optional[str] = None
    username: Optional[str] = None
    roles: Optional[List[str]] = None
    permissions: Optional[Dict[str, Any]] = None
    is_authenticated: bool = False
    auth_provider: AuthProvider = AuthProvider.NONE


class AuthenticationError(Exception):
    """Exception raised when authentication fails."""

    pass


class AuthorizationError(Exception):
    """Exception raised when authorization fails."""

    pass


class BaseAuthProvider(ABC):
    """
    Base class for authentication providers.

    This abstract base class defines the interface that all authentication
    providers must implement. Concrete implementations will be added in
    subsequent PRs.
    """

    @abstractmethod
    def authenticate(self, credentials: Dict[str, Any]) -> AuthContext:
        """
        Authenticate a user with the provided credentials.

        Args:
            credentials: Dictionary containing authentication credentials

        Returns:
            AuthContext: Authentication context with user information

        Raises:
            AuthenticationError: If authentication fails
        """
        pass

    @abstractmethod
    def authorize(self, auth_context: AuthContext, resource: str, action: str) -> bool:
        """
        Check if the authenticated user is authorized for the requested action.

        Args:
            auth_context: The authentication context
            resource: The resource being accessed
            action: The action being performed

        Returns:
            bool: True if authorized, False otherwise
        """
        pass


class NoAuthProvider(BaseAuthProvider):
    """
    No-authentication provider for development and testing.

    This provider allows all requests without authentication.
    Should not be used in production environments.
    """

    def authenticate(self, credentials: Dict[str, Any]) -> AuthContext:
        """
        Return a default authenticated context without validation.

        Args:
            credentials: Ignored in no-auth mode

        Returns:
            AuthContext: Default authenticated context
        """
        return AuthContext(
            user_id="default",
            username="default_user",
            is_authenticated=True,
            auth_provider=AuthProvider.NONE,
        )

    def authorize(self, auth_context: AuthContext, resource: str, action: str) -> bool:
        """
        Always authorize in no-auth mode.

        Args:
            auth_context: Ignored in no-auth mode
            resource: Ignored in no-auth mode
            action: Ignored in no-auth mode

        Returns:
            bool: Always True
        """
        return True


# Global auth provider instance (will be configurable in future PRs)
_auth_provider: Optional[BaseAuthProvider] = None


def get_auth_provider() -> BaseAuthProvider:
    """
    Get the current authentication provider.

    Returns:
        BaseAuthProvider: The current authentication provider
    """
    global _auth_provider
    if _auth_provider is None:
        # Default to no-auth for scaffolding
        _auth_provider = NoAuthProvider()
    return _auth_provider


def set_auth_provider(provider: BaseAuthProvider) -> None:
    """
    Set the authentication provider.

    Args:
        provider: The authentication provider to use
    """
    global _auth_provider
    _auth_provider = provider


def authenticate_request(credentials: Optional[Dict[str, Any]] = None) -> AuthContext:
    """
    Authenticate a request with the provided credentials.

    Args:
        credentials: Optional credentials dictionary

    Returns:
        AuthContext: Authentication context for the request

    Raises:
        AuthenticationError: If authentication fails
    """
    provider = get_auth_provider()
    return provider.authenticate(credentials or {})


def authorize_request(auth_context: AuthContext, resource: str, action: str) -> bool:
    """
    Check if a request is authorized.

    Args:
        auth_context: The authentication context
        resource: The resource being accessed
        action: The action being performed

    Returns:
        bool: True if authorized, False otherwise
    """
    provider = get_auth_provider()
    return provider.authorize(auth_context, resource, action)
