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
1. API Key authentication (Bearer token with pst_ prefix)
2. JWT token authentication (via FastMCP BearerAuthProvider)
3. Development mode (MCP_DEV_USERNAME configuration)

API Key Authentication:
- Users create API keys via Superset UI (/profile -> API Keys)
- Keys are prefixed with 'pst_' for identification
- Keys are validated against bcrypt hashes stored in ab_api_key table
- Keys inherit the user's roles and permissions

Configuration:
- MCP_API_KEY_AUTH_ENABLED: Enable API key authentication (default: True)
- MCP_DEV_USERNAME: Fallback username for development (no auth required)
"""

import logging
from typing import Any, Callable, TYPE_CHECKING, TypeVar

from flask import g, request
from flask_appbuilder.security.sqla.models import User

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlaTable

# Type variable for decorated functions
F = TypeVar("F", bound=Callable[..., Any])

logger = logging.getLogger(__name__)


def _authenticate_with_api_key(api_key: str) -> User | None:
    """
    Authenticate using an API key.

    Args:
        api_key: The plaintext API key (e.g., pst_abc123...)

    Returns:
        User object if authentication succeeds, None otherwise
    """
    from sqlalchemy.orm import joinedload

    from superset.daos.api_key import ApiKeyDAO
    from superset.extensions import db
    from superset.models.api_keys import ApiKey
    from superset.utils.api_key import validate_api_key

    # Get all active (non-revoked, non-expired) API keys
    # We need to check each one since we can't look up by plaintext key
    active_keys = (
        db.session.query(ApiKey)
        .filter(ApiKey.revoked_on.is_(None))
        .all()
    )

    for stored_key in active_keys:
        # Check if key is expired
        if not stored_key.is_active():
            continue

        # Validate the API key against the stored hash
        if validate_api_key(api_key, stored_key.key_hash):
            # Update last_used_on timestamp
            ApiKeyDAO.update_last_used(stored_key)

            # Get the user with eager loading
            user = (
                db.session.query(User)
                .options(joinedload(User.roles), joinedload(User.groups))
                .filter(User.id == stored_key.user_id)
                .first()
            )

            if user:
                logger.info(
                    "API key authentication successful: key_id=%s, user=%s",
                    stored_key.id,
                    user.username,
                )
                return user

    return None


def get_user_from_request() -> User:
    """
    Get the current user for the MCP tool request.

    Priority order:
    1. g.user if already set (by Preset workspace middleware or FastMCP auth)
    2. API key from Authorization header (if MCP_API_KEY_AUTH_ENABLED)
    3. MCP_DEV_USERNAME from configuration (for development/testing)

    Returns:
        User object with roles and groups eagerly loaded

    Raises:
        ValueError: If user cannot be authenticated or found
    """
    from flask import current_app
    from sqlalchemy.orm import joinedload

    from superset.extensions import db
    from superset.utils.api_key import extract_api_key_from_header

    # First check if user is already set by Preset workspace middleware
    if hasattr(g, "user") and g.user:
        return g.user

    # Try API key authentication if enabled
    api_key_auth_enabled = current_app.config.get("MCP_API_KEY_AUTH_ENABLED", True)
    if api_key_auth_enabled:
        # Try to get API key from Authorization header
        auth_header = None
        try:
            auth_header = request.headers.get("Authorization")
        except RuntimeError:
            # No request context (e.g., running in stdio mode)
            pass

        if auth_header:
            api_key = extract_api_key_from_header(auth_header)
            if api_key and api_key.startswith("pst_"):
                user = _authenticate_with_api_key(api_key)
                if user:
                    return user
                else:
                    raise ValueError(
                        "Invalid or expired API key. "
                        "Create a new key at Settings -> User Info -> API Keys."
                    )

    # Fall back to configured username for development/single-user deployments
    username = current_app.config.get("MCP_DEV_USERNAME")

    if not username:
        raise ValueError(
            "No authenticated user found. "
            "Either pass a valid API key (Bearer pst_...), "
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
