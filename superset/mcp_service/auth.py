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
Authentication hooks for MCP tools.

Supports multiple authentication methods:
1. API Key authentication via FAB SecurityManager (configurable prefix)
2. JWT token authentication (via FastMCP BearerAuthProvider)
3. Development mode (MCP_DEV_USERNAME configuration)

API Key Authentication:
- Users create API keys via FAB's /api/v1/security/api_keys/ endpoints
- Keys use configurable prefixes (FAB_API_KEY_PREFIXES, default: ["sst_"])
- Keys are validated by FAB's SecurityManager.validate_api_key()
- Keys inherit the user's roles and permissions via FAB's RBAC

Configuration:
- FAB_API_KEY_ENABLED: Enable API key authentication (default: False)
- FAB_API_KEY_PREFIXES: List of recognized key prefixes (default: ["sst_"])
- MCP_DEV_USERNAME: Fallback username for development (no auth required)
"""

import logging
from typing import Any, Callable, TYPE_CHECKING, TypeVar

from flask import g
from flask_appbuilder.security.sqla.models import User

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlaTable

# Type variable for decorated functions
F = TypeVar("F", bound=Callable[..., Any])

logger = logging.getLogger(__name__)


def get_user_from_request() -> User:
    """
    Get the current user for the MCP tool request.

    Priority order:
    1. g.user if already set (by Preset workspace middleware or FastMCP auth)
    2. API key from Authorization header (via FAB SecurityManager)
    3. MCP_DEV_USERNAME from configuration (for development/testing)

    Returns:
        User object with roles and groups eagerly loaded

    Raises:
        ValueError: If user cannot be authenticated or found
    """
    from flask import current_app
    from sqlalchemy.orm import joinedload

    from superset.extensions import db

    # First check if user is already set by Preset workspace middleware
    if hasattr(g, "user") and g.user:
        return g.user

    # Try API key authentication via FAB SecurityManager
    api_key_enabled = current_app.config.get("FAB_API_KEY_ENABLED", False)
    if api_key_enabled:
        sm = current_app.appbuilder.sm
        api_key_string = sm._extract_api_key_from_request()
        if api_key_string is not None:
            user = sm.validate_api_key(api_key_string)
            if user:
                return user
            raise ValueError(
                "Invalid or expired API key. "
                "Create a new key at /api/v1/security/api_keys/."
            )

    # Fall back to configured username for development/single-user deployments
    username = current_app.config.get("MCP_DEV_USERNAME")

    if not username:
        raise ValueError(
            "No authenticated user found. "
            "Either pass a valid API key (Bearer sst_...), "
            "JWT token, or configure MCP_DEV_USERNAME for development."
        )

    # Query user directly with eager loading to ensure fresh session-bound object
    # Do NOT use security_manager.find_user() as it may return cached/detached user
    user = (
        db.session.query(User)
        .options(joinedload(User.roles), joinedload(User.groups))
        .filter(User.username == username)
        .first()
    )

    if not user:
        raise ValueError(
            f"User '{username}' not found. "
            f"Please create admin user with: superset fab create-admin"
        )

    return user


def has_dataset_access(dataset: "SqlaTable") -> bool:
    """
    Validate user has access to the dataset.

    This function checks if the current user (from Flask g.user context)
    has permission to access the given dataset using Superset's security manager.

    Args:
        dataset: The SqlaTable dataset to check access for

    Returns:
        True if user has access, False otherwise

    Security Note:
        This should be called after mcp_auth_hook has set g.user.
        Returns False on any error to fail securely.
    """
    try:
        from superset import security_manager

        # Check if user has read access to the dataset
        if hasattr(g, "user") and g.user:
            # Use Superset's security manager to check dataset access
            return security_manager.can_access_datasource(datasource=dataset)

        # If no user context, deny access
        return False

    except Exception as e:
        logger.warning("Error checking dataset access: %s", e)
        return False  # Deny access on error


def _setup_user_context() -> User:
    """
    Set up user context for MCP tool execution.

    Returns:
        User object with roles and groups loaded
    """
    user = get_user_from_request()

    # Validate user has necessary relationships loaded
    # (Force access to ensure they're loaded if lazy)
    user_roles = user.roles  # noqa: F841
    if hasattr(user, "groups"):
        user_groups = user.groups  # noqa: F841

    g.user = user
    return user


def _cleanup_session_on_error() -> None:
    """Clean up database session after an exception."""
    from superset.extensions import db

    # pylint: disable=consider-using-transaction
    try:
        db.session.rollback()
        db.session.remove()
    except Exception as e:
        logger.warning("Error cleaning up session after exception: %s", e)


def _cleanup_session_finally() -> None:
    """Clean up database session in finally block."""
    from superset.extensions import db

    # Rollback active session (no exception occurred)
    # Do NOT call remove() on success to avoid detaching user
    try:
        if db.session.is_active:
            # pylint: disable=consider-using-transaction
            db.session.rollback()
    except Exception as e:
        logger.warning("Error in finally block: %s", e)


def mcp_auth_hook(tool_func: F) -> F:
    """
    Authentication and authorization decorator for MCP tools.

    This decorator assumes Flask application context and g.user
    have already been set by WorkspaceContextMiddleware.

    Supports both sync and async tool functions.

    TODO (future PR): Add permission checking
    TODO (future PR): Add JWT scope validation
    TODO (future PR): Add comprehensive audit logging
    """
    import functools
    import inspect

    is_async = inspect.iscoroutinefunction(tool_func)

    if is_async:

        @functools.wraps(tool_func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            user = _setup_user_context()

            try:
                logger.debug(
                    "MCP tool call: user=%s, tool=%s",
                    user.username,
                    tool_func.__name__,
                )
                result = await tool_func(*args, **kwargs)
                return result
            except Exception:
                _cleanup_session_on_error()
                raise
            finally:
                _cleanup_session_finally()

        return async_wrapper  # type: ignore[return-value]

    else:

        @functools.wraps(tool_func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            user = _setup_user_context()

            try:
                logger.debug(
                    "MCP tool call: user=%s, tool=%s",
                    user.username,
                    tool_func.__name__,
                )
                result = tool_func(*args, **kwargs)
                return result
            except Exception:
                _cleanup_session_on_error()
                raise
            finally:
                _cleanup_session_finally()

        return sync_wrapper  # type: ignore[return-value]
