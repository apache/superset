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

import logging
from typing import Any, List, Optional

from flask_appbuilder.security.sqla.models import User

logger = logging.getLogger(__name__)


class MCPUser:
    """Simple user object for MCP service operations with JWT identity."""

    def __init__(self, username: str, email: Optional[str] = None):
        self.username = username
        self.email = email or f"{username}@example.com"
        self.is_active = True
        self.is_authenticated = True
        self.is_anonymous = False  # Flask-Login compatibility
        self.id = username
        self.roles: List[Any] = []  # Flask-AppBuilder compatibility
        self.groups: List[Any] = []  # Flask-AppBuilder compatibility

    def __str__(self) -> str:
        return self.username

    def __repr__(self) -> str:
        return f"MCPUser(username='{self.username}')"


def get_user_from_request() -> User:
    """
    Extract user identity from JWT token for MCP service operations.
    Returns the actual Superset user from the database for proper permission handling.
    """
    from flask import current_app

    from superset import security_manager

    try:
        # Try to get JWT token from FastMCP auth context
        from fastmcp.server.dependencies import get_access_token

        access_token = get_access_token()

        # Extract user identifier from JWT claims (usually 'sub')
        username = access_token.client_id

        logger.debug(f"Authenticated user from JWT: {username}")

    except Exception as e:
        # No valid JWT token - fall back to dev/admin user (backward compatibility)
        logger.debug(f"No JWT token available ({e}), using dev user fallback")

        # Use MCP_DEV_USERNAME for development, fallback to MCP_ADMIN_USERNAME,
        # then "admin"
        username = current_app.config.get("MCP_DEV_USERNAME") or current_app.config.get(
            "MCP_ADMIN_USERNAME", "admin"
        )

    # Get the real Superset user from the database
    real_user = security_manager.find_user(username)
    if not real_user:
        raise ValueError(f"User '{username}' not found in Superset database")

    logger.debug(f"Using Superset user: {real_user.username} (ID: {real_user.id})")
    return real_user


def impersonate_user(user: User, run_as: Optional[str] = None) -> User:
    """
    Optionally impersonate another user if allowed.
    Returns the actual Superset user from the database.
    """
    if run_as:
        from superset import security_manager

        logger.info(f"User {user.username} impersonating {run_as}")
        impersonated_user = security_manager.find_user(run_as)
        if not impersonated_user:
            raise ValueError(
                f"Impersonation target user '{run_as}' not found in Superset database"
            )
        return impersonated_user
    return user


def has_permission(user: User, tool_func: Any) -> bool:
    """
    Check permissions using JWT scopes + basic user validation.
    Much simpler than Flask-AppBuilder integration.
    """
    # Basic user validation
    if not user or not user.is_active:
        return False

    # Check JWT scopes if available
    try:
        from fastmcp.server.dependencies import get_access_token

        access_token = get_access_token()

        if access_token:  # Only enforce JWT scopes if JWT is present
            user_scopes = access_token.scopes or []

            # Map tool functions to required scopes
            required_scopes = {
                "list_dashboards": ["dashboard:read"],
                "get_dashboard_info": ["dashboard:read"],
                "list_charts": ["chart:read"],
                "get_chart_info": ["chart:read"],
                "create_chart": ["chart:write"],
                "list_datasets": ["dataset:read"],
                "get_dataset_info": ["dataset:read"],
                "get_superset_instance_info": ["instance:read"],
            }

            tool_name = tool_func.__name__
            if required := required_scopes.get(tool_name):
                # Check if user has any of the required scopes
                if not any(scope in user_scopes for scope in required):
                    logger.warning(
                        f"User {user.username} missing required scopes "
                        f"{required} for {tool_name}"
                    )
                    return False

    except Exception as e:
        # No JWT context - allow access (fallback mode)
        logger.debug(f"No JWT context available: {e}")

    return True


def log_access(user: User, tool_name: str, args: Any, kwargs: Any) -> None:
    """
    Enhanced audit logging with JWT context information.
    Logs user access with both MCP user info and JWT claims.
    """
    try:
        from fastmcp.server.dependencies import get_access_token

        # Get JWT context if available
        access_token = get_access_token()
        jwt_user = access_token.client_id if access_token else None
        jwt_scopes = access_token.scopes if access_token else []

        logger.info(
            f"MCP Tool Access: user={user.username}, "
            f"jwt_user={jwt_user}, tool={tool_name}, scopes={jwt_scopes}"
        )

    except Exception:
        # Fallback to basic logging
        logger.info(f"MCP Tool Access: user={user.username}, tool={tool_name}")


def mcp_auth_hook(tool_func: Any) -> Any:
    """
    Decorator for MCP tool functions to enforce auth, impersonation, RBAC, and logging.
    Simplified to work with MCPUser instead of complex Flask-AppBuilder integration.
    """
    import functools

    from flask import g

    @functools.wraps(tool_func)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        # Get user identity from JWT (simple approach)
        user = get_user_from_request()

        # Set Flask context with user identity for downstream systems
        # Use a simple object that won't interfere with Flask-AppBuilder
        g.user = user

        # Apply impersonation if requested
        if run_as := kwargs.get("run_as"):
            user = impersonate_user(user, run_as)

        # Check JWT scopes (simple validation)
        if not has_permission(user, tool_func):
            raise PermissionError(
                f"User '{user.username}' lacks permission for {tool_func.__name__}"
            )

        # Enhanced audit logging with JWT context
        log_access(user, tool_func.__name__, args, kwargs)
        return tool_func(*args, **kwargs)

    return wrapper
