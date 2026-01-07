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
- User authentication from JWT or configured dev user
- RBAC permission checking aligned with Superset's REST API permissions
- Dataset access validation
- Session lifecycle management

The RBAC enforcement mirrors Flask-AppBuilder's @protect() decorator behavior,
ensuring MCP tools respect the same permission model as the REST API.

Permission Pattern (mirrors FAB):
---------------------------------
Permissions are defined directly on tools using the @tool decorator's
class_permission_name parameter, similar to how FAB defines them on view classes:

    # FAB API pattern:
    class ChartRestApi(BaseSupersetApi):
        class_permission_name = "Chart"

        @expose("/", methods=("GET",))
        @protect()
        def get_list(self): ...

    # MCP tool pattern (equivalent):
    @tool(class_permission_name="Chart")
    async def list_charts(): ...

    @tool(class_permission_name="Chart", method_permission_name="write")
    async def generate_chart(): ...

The method_permission_name defaults to "read" for tools without the "mutate" tag,
and "write" for tools with the "mutate" tag. This mirrors FAB's convention where
GET endpoints default to "can_read" and POST/PUT default to "can_write".
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

# Constants for permission attribute names (mirrors FAB conventions)
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


def get_user_from_request() -> User | None:
    """
    Extract user from the current request context.

    Priority order:
    1. g.user (set by WorkspaceContextMiddleware from JWT)
    2. Configured dev username (MCP_DEV_USERNAME)
    3. None (unauthenticated)
    """
    from flask import current_app

    # First check if user is already set (from JWT middleware)
    if hasattr(g, "user") and g.user is not None:
        return g.user

    # Fall back to configured dev username
    if dev_username := current_app.config.get("MCP_DEV_USERNAME"):
        from superset import security_manager

        user = security_manager.find_user(username=dev_username)
        if user:
            return user
        logger.warning("MCP_DEV_USERNAME '%s' not found", dev_username)

    return None


def has_dataset_access(dataset: "SqlaTable") -> bool:
    """
    Check if the current user has access to a specific dataset.

    Args:
        dataset: The SqlaTable model instance to check access for

    Returns:
        True if user has access, False otherwise
    """
    try:
        from superset import security_manager

        # Get the current user
        if not hasattr(g, "user") or not g.user:
            return False

        # Use Superset's security manager to check access
        return security_manager.can_access_datasource(dataset)

    except Exception as e:
        logger.warning("Error checking dataset access: %s", e)
        return False  # Deny access on error


def check_tool_permission(func: Callable[..., Any]) -> bool:
    """
    Check if the current user has RBAC permission for an MCP tool.

    This function reads permission metadata from the tool function's attributes
    (set by the @tool decorator) and uses Superset's security_manager to check
    if the current user has the required permission.

    This mirrors Flask-AppBuilder's @protect() decorator behavior.

    Args:
        func: The tool function with permission attributes

    Returns:
        True if user has permission, False otherwise
    """
    try:
        from superset import security_manager

        # Get user from context
        if not hasattr(g, "user") or not g.user:
            logger.warning(
                "No user context for permission check on tool: %s", func.__name__
            )
            return False

        # Read permission metadata from function attributes
        class_permission_name = getattr(func, CLASS_PERMISSION_ATTR, None)
        method_permission_name = getattr(func, METHOD_PERMISSION_ATTR, None)

        # If no class_permission_name is set, allow by default (backward compat)
        if not class_permission_name:
            logger.debug(
                "Tool %s has no class_permission_name, allowing by default",
                func.__name__,
            )
            return True

        # Build the full permission string (e.g., "can_read", "can_write")
        permission_str = f"{PERMISSION_PREFIX}{method_permission_name or 'read'}"

        # Use Superset's security manager to check permission
        # This is the same check that FAB's @protect() decorator uses
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

    except Exception as e:
        logger.error("Error checking tool permission for %s: %s", func.__name__, e)
        return False  # Deny on error (fail secure)


def require_tool_permission(func: Callable[..., Any]) -> None:
    """
    Require RBAC permission for an MCP tool, raising an exception if denied.

    Args:
        func: The tool function with permission attributes

    Raises:
        MCPPermissionDeniedError: If user lacks required permission
    """
    if not check_tool_permission(func):
        class_permission_name = getattr(func, CLASS_PERMISSION_ATTR, "unknown")
        method_permission_name = getattr(func, METHOD_PERMISSION_ATTR, "read")
        permission_str = f"{PERMISSION_PREFIX}{method_permission_name}"

        user = g.user.username if hasattr(g, "user") and g.user else None
        raise MCPPermissionDeniedError(
            permission_name=permission_str,
            view_name=class_permission_name,
            user=user,
            tool_name=func.__name__,
        )


def _setup_user_context() -> User:
    """Set up the user context for MCP tool execution."""
    user = get_user_from_request()
    if not user:
        raise ValueError("No authenticated user found for MCP request")

    # Ensure g.user is set for downstream code that expects it
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


def _copy_permission_attributes(source: Callable[..., Any], target: Any) -> None:
    """Copy RBAC permission attributes from source function to target wrapper."""
    if hasattr(source, CLASS_PERMISSION_ATTR):
        setattr(target, CLASS_PERMISSION_ATTR, getattr(source, CLASS_PERMISSION_ATTR))
    if hasattr(source, METHOD_PERMISSION_ATTR):
        setattr(target, METHOD_PERMISSION_ATTR, getattr(source, METHOD_PERMISSION_ATTR))


def _update_wrapper_signature(
    wrapper: Any, func: Callable[..., Any], tool_sig: Any
) -> None:
    """Update wrapper signature, removing ctx parameter for FastMCP tools."""
    import inspect

    from fastmcp import Context as FMContext

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
        wrapper.__signature__ = tool_sig.replace(parameters=new_params)

        # Also remove ctx from annotations to match signature
        if "ctx" in wrapper.__annotations__:
            del wrapper.__annotations__["ctx"]


def _create_new_wrapper(
    wrapper: Callable[..., Any], func: Callable[..., Any]
) -> Callable[..., Any]:
    """Create a new wrapper function with merged globals and copied attributes."""
    import inspect
    import types

    # Merge original function's __globals__ into wrapper's __globals__
    # This allows get_type_hints() to resolve type annotations from the
    # original module (e.g., Context from fastmcp)
    merged_globals = {**wrapper.__globals__, **func.__globals__}
    new_wrapper = types.FunctionType(
        wrapper.__code__,
        merged_globals,
        wrapper.__name__,
        wrapper.__defaults__,
        wrapper.__closure__,
    )

    # Copy __dict__ but exclude __wrapped__
    # NOTE: We intentionally do NOT preserve __wrapped__ here.
    new_wrapper.__dict__.update(
        {k: v for k, v in wrapper.__dict__.items() if k != "__wrapped__"}
    )
    new_wrapper.__module__ = wrapper.__module__
    new_wrapper.__qualname__ = wrapper.__qualname__
    new_wrapper.__annotations__ = wrapper.__annotations__
    new_wrapper.__doc__ = func.__doc__

    # Copy permission attributes
    _copy_permission_attributes(func, new_wrapper)

    # Update signature
    tool_sig = inspect.signature(func)
    _update_wrapper_signature(new_wrapper, func, tool_sig)

    return new_wrapper


def mcp_auth_hook(
    tool_func: F | None = None,
    *,
    check_permissions: bool = True,
) -> F | Callable[[F], F]:
    """
    Authentication and authorization decorator for MCP tools.

    This decorator:
    1. Sets up user context from JWT or configured dev user
    2. Enforces RBAC permissions based on the tool's permission attributes
    3. Manages database session lifecycle

    Permission attributes are read from the tool function:
    - _class_permission_name: The view/resource name (e.g., "Chart", "Dashboard")
    - _method_permission_name: The action name (e.g., "read", "write")

    These attributes are set by the @tool decorator's class_permission_name
    and method_permission_name parameters.

    Supports both sync and async tool functions.

    Args:
        tool_func: The tool function to wrap (when used without parentheses)
        check_permissions: Whether to enforce RBAC permissions (default: True)
            Set to False for tools that should only require authentication,
            not specific action-level permissions.

    Returns:
        Wrapped function with authentication and authorization

    Example:
        @mcp_auth_hook
        def my_tool(): ...  # Checks permissions from function attributes

        @mcp_auth_hook(check_permissions=False)
        def my_public_tool(): ...  # Only requires authentication
    """
    import functools
    import inspect

    def decorator(func: F) -> F:
        is_async = inspect.iscoroutinefunction(func)

        if is_async:

            @functools.wraps(func)
            async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
                user = _setup_user_context()

                try:
                    logger.debug(
                        "MCP tool call: user=%s, tool=%s",
                        user.username,
                        func.__name__,
                    )

                    # Check RBAC permissions if enabled
                    if check_permissions:
                        require_tool_permission(func)

                    return await func(*args, **kwargs)
                except Exception:
                    _cleanup_session_on_error()
                    raise
                finally:
                    _cleanup_session_finally()

            wrapper = async_wrapper

        else:

            @functools.wraps(func)
            def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
                user = _setup_user_context()

                try:
                    logger.debug(
                        "MCP tool call: user=%s, tool=%s",
                        user.username,
                        func.__name__,
                    )

                    # Check RBAC permissions if enabled
                    if check_permissions:
                        require_tool_permission(func)

                    return func(*args, **kwargs)
                except Exception:
                    _cleanup_session_on_error()
                    raise
                finally:
                    _cleanup_session_finally()

            wrapper = sync_wrapper

        # Create final wrapper with merged globals, attributes, and signature
        return _create_new_wrapper(wrapper, func)  # type: ignore[return-value]

    # Support both @mcp_auth_hook and @mcp_auth_hook() syntax
    if tool_func is not None:
        return decorator(tool_func)
    return decorator
