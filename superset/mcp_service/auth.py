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
from typing import Any, Optional

from flask_appbuilder.security.sqla.models import User

logger = logging.getLogger(__name__)


def get_user_from_request() -> User:
    """Extract user from JWT token with robust fallback to admin users."""
    from flask import current_app

    from superset import security_manager

    username = _extract_username_from_jwt(current_app)
    user = security_manager.find_user(username)

    if not user:
        user = _find_fallback_admin_user(username)

    return user


def _extract_username_from_jwt(app: Any) -> str:
    """Extract username from JWT token or return configured fallback."""
    try:
        from fastmcp.server.dependencies import get_access_token

        access_token = get_access_token()
        user_resolver = app.config.get("MCP_USER_RESOLVER")

        username = (
            user_resolver(access_token)
            if user_resolver and callable(user_resolver)
            else getattr(access_token, "client_id", None)
        )

        if username:
            logger.info(f"MCP auth: JWT user '{username}'")
            return username

    except Exception as e:
        logger.debug(f"JWT extraction failed: {e}")

    fallback = app.config.get("MCP_ADMIN_USERNAME", "admin")
    logger.debug(f"MCP auth: Using fallback user '{fallback}'")
    return fallback


def _find_fallback_admin_user(username: str) -> User:
    """Find any admin user as fallback when configured user doesn't exist."""
    from flask_appbuilder.security.sqla.models import User

    from superset import db

    try:
        admin_user = db.session.query(User).filter(User.roles.any(name="Admin")).first()

        if admin_user:
            logger.warning(
                f"User '{username}' not found, using '{admin_user.username}'"
            )
            return admin_user

    except Exception as e:
        logger.debug(f"Failed to find admin user: {e}")

    raise ValueError(
        f"User '{username}' not found. Create user or update MCP_ADMIN_USERNAME. "
        f"Use: superset fab create-admin"
    )


def impersonate_user(user: User, run_as: Optional[str] = None) -> User:
    """Return impersonated user or original if no impersonation requested."""
    if not run_as:
        return user

    from superset import security_manager

    impersonated = security_manager.find_user(run_as)
    if not impersonated:
        raise ValueError(f"Impersonation target '{run_as}' not found")

    logger.info(f"Impersonating {run_as} as {user.username}")
    return impersonated


def has_permission(user: User, tool_func: Any) -> bool:
    """Validate user permissions using JWT scopes and user status."""
    if not user or not user.is_active:
        return False

    try:
        from fastmcp.server.dependencies import get_access_token

        access_token = get_access_token()
        if not access_token:
            return True  # No JWT means no scope restrictions

        return _check_jwt_scopes(user, tool_func, access_token)

    except Exception:
        return True  # Allow access when JWT unavailable


def _check_jwt_scopes(user: User, tool_func: Any, access_token: Any) -> bool:
    """Check if user has required JWT scopes for the tool."""
    user_scopes = access_token.scopes or []

    scope_requirements = {
        "list_dashboards": ["dashboard:read"],
        "get_dashboard_info": ["dashboard:read"],
        "list_charts": ["chart:read"],
        "get_chart_info": ["chart:read"],
        "create_chart": ["chart:write"],
        "list_datasets": ["dataset:read"],
        "get_dataset_info": ["dataset:read"],
        "get_superset_instance_info": ["instance:read"],
    }

    required_scopes = scope_requirements.get(tool_func.__name__)
    if not required_scopes:
        return True

    has_access = any(scope in user_scopes for scope in required_scopes)
    if not has_access:
        logger.warning(
            f"User {user.username} lacks scopes {required_scopes} "
            f"for {tool_func.__name__}"
        )

    return has_access


def log_access(user: User, tool_name: str, args: Any, kwargs: Any) -> None:
    """Log tool access with optional JWT context."""

    if jwt_context := _get_jwt_context():
        logger.info(
            f"MCP access: user={user.username}, jwt={jwt_context['user']}, "
            f"tool={tool_name}, scopes={jwt_context['scopes']}"
        )
    else:
        logger.info(f"MCP access: user={user.username}, tool={tool_name}")


def _get_jwt_context() -> Optional[dict[str, Any]]:
    """Extract JWT context for logging purposes."""
    try:
        from fastmcp.server.dependencies import get_access_token

        token = get_access_token()
        if token:
            return {
                "user": getattr(token, "client_id", None),
                "scopes": getattr(token, "scopes", []),
            }
    except Exception as e:
        logger.debug(f"JWT context extraction failed: {e}")

    return None


def mcp_auth_hook(tool_func: Any) -> Any:
    """Authentication and authorization decorator for MCP tools."""
    import functools

    from flask import g

    @functools.wraps(tool_func)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        user = get_user_from_request()
        g.user = user

        if run_as := kwargs.get("run_as"):
            user = impersonate_user(user, run_as)

        if not has_permission(user, tool_func):
            raise PermissionError(
                f"Access denied: {user.username} lacks permission "
                f"for {tool_func.__name__}"
            )

        log_access(user, tool_func.__name__, args, kwargs)
        return tool_func(*args, **kwargs)

    return wrapper
