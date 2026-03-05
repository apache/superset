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
Authentication and authorization hooks for MCP tools.

This module provides:
- User authentication from JWT, API key, or configured dev user
- RBAC permission checking aligned with Superset's REST API permissions
- Dataset access validation
- Session lifecycle management

The RBAC enforcement mirrors Flask-AppBuilder's @protect() decorator,
ensuring MCP tools respect the same permission model as the REST API.

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
- FAB_API_KEY_ENABLED: Enable API key auth (default: False)
- FAB_API_KEY_PREFIXES: Key prefixes (default: ["sst_"])
- MCP_DEV_USERNAME: Fallback username for development
"""

import logging
from contextlib import AbstractContextManager
from typing import Any, Callable, TYPE_CHECKING, TypeVar

from flask import g
from flask_appbuilder.security.sqla.models import Group, User

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlaTable

# Type variable for decorated functions
F = TypeVar("F", bound=Callable[..., Any])

logger = logging.getLogger(__name__)

# Constants for RBAC permission attributes (mirrors FAB conventions)
PERMISSION_PREFIX = "can_"
CLASS_PERMISSION_ATTR = "_class_permission_name"
METHOD_PERMISSION_ATTR = "_method_permission_name"


class MCPPermissionDeniedError(Exception):
    """Raised when user lacks required RBAC permission for an MCP tool."""

    def __init__(
        self,
        permission_name: str,
        view_name: str,
        user: str | None = None,
        tool_name: str | None = None,
    ):
        self.permission_name = permission_name
        self.view_name = view_name
        self.user = user
        self.tool_name = tool_name
        message = (
            f"Permission denied: {permission_name} on {view_name}"
            + (f" for user {user}" if user else "")
            + (f" (tool: {tool_name})" if tool_name else "")
        )
        super().__init__(message)


def check_tool_permission(func: Callable[..., Any]) -> bool:
    """Check if the current user has RBAC permission for an MCP tool.

    Reads permission metadata stored on the function by the @tool decorator
    and uses Superset's security_manager to verify access.

    Controlled by the ``MCP_RBAC_ENABLED`` config flag (default True).
    Set to False in superset_config.py to disable RBAC checking.

    Args:
        func: The tool function with optional permission attributes.

    Returns:
        True if user has permission or no permission is required.
    """
    try:
        from flask import current_app

        if not current_app.config.get("MCP_RBAC_ENABLED", True):
            return True

        from superset import security_manager

        if not hasattr(g, "user") or not g.user:
            logger.warning(
                "No user context for permission check on tool: %s", func.__name__
            )
            return False

        class_permission_name = getattr(func, CLASS_PERMISSION_ATTR, None)
        if not class_permission_name:
            # No RBAC configured for this tool; allow by default.
            return True

        method_permission_name = getattr(func, METHOD_PERMISSION_ATTR, "read")
        permission_str = f"{PERMISSION_PREFIX}{method_permission_name}"

        has_permission = security_manager.can_access(
            permission_str, class_permission_name
        )

        if not has_permission:
            logger.warning(
                "Permission denied for user %s: %s on %s (tool: %s)",
                g.user.username,
                permission_str,
                class_permission_name,
                func.__name__,
            )

        return has_permission

    except (AttributeError, ValueError, RuntimeError) as e:
        logger.warning("Error checking tool permission: %s", e)
        return False


def load_user_with_relationships(
    username: str | None = None, email: str | None = None
) -> User | None:
    """
    Load a user with all relationships needed for permission checks.

    This function eagerly loads User.roles, User.groups, and Group.roles
    to prevent detached instance errors when the session is closed/rolled back.

    IMPORTANT: Always use this function instead of security_manager.find_user()
    when loading users for MCP tool execution. The find_user() method doesn't
    eagerly load Group.roles, causing "detached instance" errors when permission
    checks access group.roles after the session is rolled back.

    Args:
        username: The username to look up (optional if email provided)
        email: The email to look up (optional if username provided)

    Returns:
        User object with relationships loaded, or None if not found

    Raises:
        ValueError: If neither username nor email is provided
    """
    if not username and not email:
        raise ValueError("Either username or email must be provided")

    from sqlalchemy.orm import joinedload

    from superset.extensions import db

    query = db.session.query(User).options(
        joinedload(User.roles),
        joinedload(User.groups).joinedload(Group.roles),
    )

    if username:
        query = query.filter(User.username == username)
    else:
        query = query.filter(User.email == email)

    return query.first()


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

    # First check if user is already set by Preset workspace middleware
    if hasattr(g, "user") and g.user:
        return g.user

    # Try API key authentication via FAB SecurityManager
    # Only attempt when in a request context (not for MCP internal operations
    # like tool discovery that run with only an application context)
    from flask import has_request_context

    api_key_enabled = current_app.config.get("FAB_API_KEY_ENABLED", False)
    if api_key_enabled and has_request_context():
        sm = current_app.appbuilder.sm
        api_key_string = sm._extract_api_key_from_request()
        if api_key_string is not None:
            user = sm.validate_api_key(api_key_string)
            if user:
                # Reload user with all relationships eagerly loaded to avoid
                # detached-instance errors during later permission checks.
                user_with_rels = load_user_with_relationships(
                    username=user.username,
                )
                return user_with_rels or user
            raise ValueError(
                "Invalid or expired API key. "
                "Create a new key at /api/v1/security/api_keys/."
            )

    # Fall back to configured username for development/single-user deployments
    username = current_app.config.get("MCP_DEV_USERNAME")

    if not username:
        auth_enabled = current_app.config.get("MCP_AUTH_ENABLED", False)
        jwt_configured = bool(
            current_app.config.get("MCP_JWKS_URI")
            or current_app.config.get("MCP_JWT_PUBLIC_KEY")
            or current_app.config.get("MCP_JWT_SECRET")
        )
        details = []
        details.append(
            f"g.user was not set by JWT middleware "
            f"(MCP_AUTH_ENABLED={auth_enabled}, "
            f"JWT keys configured={jwt_configured})"
        )
        details.append("MCP_DEV_USERNAME is not configured")
        prefixes = current_app.config.get("FAB_API_KEY_PREFIXES", ["sst_"])
        prefix_example = prefixes[0] if prefixes else "sst_"
        raise ValueError(
            "No authenticated user found. Tried:\n"
            + "\n".join(f"  - {d}" for d in details)
            + f"\n\nEither pass a valid API key (Bearer {prefix_example}...), "
            "JWT token, or configure MCP_DEV_USERNAME for development."
        )

    # Use helper function to load user with all required relationships
    user = load_user_with_relationships(username)

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


def _setup_user_context() -> User | None:
    """
    Set up user context for MCP tool execution.

    Returns:
        User object with roles and groups loaded, or None if no Flask context
    """
    try:
        user = get_user_from_request()
    except RuntimeError as e:
        # No Flask application context (e.g., prompts before middleware runs)
        # This is expected for some FastMCP operations - return None gracefully
        if "application context" in str(e):
            logger.debug("No Flask app context available for user setup")
            return None
        raise

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


def mcp_auth_hook(tool_func: F) -> F:  # noqa: C901
    """
    Authentication and authorization decorator for MCP tools.

    This decorator pushes Flask application context, sets up g.user,
    and enforces RBAC permission checks for MCP tool execution.

    Permission metadata (class_permission_name, method_permission_name) is
    stored on tool_func by the @tool decorator in core_mcp_injection.py.
    If present, check_tool_permission() verifies the user has the required
    FAB permission before the tool function runs.

    Supports both sync and async tool functions.
    """
    import contextlib
    import functools
    import inspect
    import types

    from flask import has_app_context

    from superset.mcp_service.flask_singleton import get_flask_app

    def _get_app_context_manager() -> AbstractContextManager[None]:
        """Return app context manager only if not already in one."""
        if has_app_context():
            # Already in app context (e.g., in tests), use null context
            return contextlib.nullcontext()
        # Push new app context for standalone MCP server
        app = get_flask_app()
        return app.app_context()

    is_async = inspect.iscoroutinefunction(tool_func)

    if is_async:

        @functools.wraps(tool_func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            with _get_app_context_manager():
                user = _setup_user_context()

                # No Flask context - this is a FastMCP internal operation
                # (e.g., tool discovery, prompt listing) that doesn't require auth
                if user is None:
                    logger.debug(
                        "MCP internal call without Flask context: tool=%s",
                        tool_func.__name__,
                    )
                    return await tool_func(*args, **kwargs)

                # RBAC permission check
                if not check_tool_permission(tool_func):
                    method_name = getattr(tool_func, METHOD_PERMISSION_ATTR, "read")
                    raise MCPPermissionDeniedError(
                        permission_name=f"{PERMISSION_PREFIX}{method_name}",
                        view_name=getattr(tool_func, CLASS_PERMISSION_ATTR, "unknown"),
                        user=user.username,
                        tool_name=tool_func.__name__,
                    )

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

        wrapper = async_wrapper

    else:

        @functools.wraps(tool_func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            with _get_app_context_manager():
                user = _setup_user_context()

                # No Flask context - this is a FastMCP internal operation
                # (e.g., tool discovery, prompt listing) that doesn't require auth
                if user is None:
                    logger.debug(
                        "MCP internal call without Flask context: tool=%s",
                        tool_func.__name__,
                    )
                    return tool_func(*args, **kwargs)

                # RBAC permission check
                if not check_tool_permission(tool_func):
                    method_name = getattr(tool_func, METHOD_PERMISSION_ATTR, "read")
                    raise MCPPermissionDeniedError(
                        permission_name=f"{PERMISSION_PREFIX}{method_name}",
                        view_name=getattr(tool_func, CLASS_PERMISSION_ATTR, "unknown"),
                        user=user.username,
                        tool_name=tool_func.__name__,
                    )

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

        wrapper = sync_wrapper

    # Merge original function's __globals__ into wrapper's __globals__
    # This allows get_type_hints() to resolve type annotations from the
    # original module (e.g., Context from fastmcp)
    # FastMCP 2.13.2+ uses get_type_hints() which needs access to these types
    merged_globals = {**wrapper.__globals__, **tool_func.__globals__}  # type: ignore[attr-defined]
    new_wrapper = types.FunctionType(
        wrapper.__code__,  # type: ignore[attr-defined]
        merged_globals,
        wrapper.__name__,
        wrapper.__defaults__,  # type: ignore[attr-defined]
        wrapper.__closure__,  # type: ignore[attr-defined]
    )
    # Copy __dict__ but exclude __wrapped__
    # NOTE: We intentionally do NOT preserve __wrapped__ here.
    # Setting __wrapped__ causes inspect.signature() to follow the chain
    # and find 'ctx' in the original function's signature, even after
    # FastMCP's create_function_without_params removes it from annotations.
    # This breaks Pydantic's TypeAdapter which expects signature params
    # to match type_hints.
    new_wrapper.__dict__.update(
        {k: v for k, v in wrapper.__dict__.items() if k != "__wrapped__"}
    )
    new_wrapper.__module__ = wrapper.__module__
    new_wrapper.__qualname__ = wrapper.__qualname__
    new_wrapper.__annotations__ = wrapper.__annotations__
    # Copy docstring from original function (not wrapper, which may have lost it)
    new_wrapper.__doc__ = tool_func.__doc__

    # Set __signature__ from the original function, but:
    # 1. Remove ctx parameter - FastMCP tools don't expose it to clients
    # 2. Skip if original has *args (parse_request output has its own handling)
    from fastmcp import Context as FMContext

    tool_sig = inspect.signature(tool_func)
    has_var_positional = any(
        p.kind == inspect.Parameter.VAR_POSITIONAL for p in tool_sig.parameters.values()
    )

    if not has_var_positional:
        # For functions without *args, preserve signature but remove ctx
        new_params = []
        for _name, param in tool_sig.parameters.items():
            # Skip ctx parameter - FastMCP tools don't expose it to clients
            if param.annotation is FMContext or (
                hasattr(param.annotation, "__name__")
                and param.annotation.__name__ == "Context"
            ):
                continue
            new_params.append(param)
        new_wrapper.__signature__ = tool_sig.replace(  # type: ignore[attr-defined]
            parameters=new_params
        )

        # Also remove ctx from annotations to match signature
        if "ctx" in new_wrapper.__annotations__:
            del new_wrapper.__annotations__["ctx"]
    # For functions with *args (parse_request output), the signature
    # is already set by parse_request without ctx.

    return new_wrapper  # type: ignore[return-value]
