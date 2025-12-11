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


# Permission registry mapping MCP tools to required RBAC permissions.
# Format: tool_name -> (permission_name, view_name)
# These align with Flask-AppBuilder's class_permission_name and method_permission_name
# as used in Superset's REST API endpoints.
#
# Permission names follow FAB conventions:
# - "can_read" for GET/list operations
# - "can_write" for POST/PUT operations (create/update)
# - "can_delete" for DELETE operations
#
# View names are the class_permission_name values from the API classes.
MCP_TOOL_PERMISSIONS: dict[str, tuple[str, str]] = {
    # SQL Lab tools - require SQLLab permissions
    "execute_sql": ("can_execute_sql", "SQLLab"),
    "open_sql_lab_with_context": ("can_read", "SQLLab"),
    # Chart tools
    "list_charts": ("can_read", "Chart"),
    "get_chart_info": ("can_read", "Chart"),
    "get_chart_preview": ("can_read", "Chart"),
    "get_chart_data": ("can_read", "Chart"),
    "get_chart_available_filters": ("can_read", "Chart"),
    "generate_chart": ("can_write", "Chart"),
    "update_chart": ("can_write", "Chart"),
    "update_chart_preview": ("can_write", "Chart"),
    # Dashboard tools
    "list_dashboards": ("can_read", "Dashboard"),
    "get_dashboard_info": ("can_read", "Dashboard"),
    "get_dashboard_available_filters": ("can_read", "Dashboard"),
    "generate_dashboard": ("can_write", "Dashboard"),
    "add_chart_to_existing_dashboard": ("can_write", "Dashboard"),
    # Dataset tools
    "list_datasets": ("can_read", "Dataset"),
    "get_dataset_info": ("can_read", "Dataset"),
    "get_dataset_available_filters": ("can_read", "Dataset"),
    # Explore tools
    "generate_explore_link": ("can_read", "Explore"),
    # System tools - typically available to authenticated users
    "get_instance_info": ("can_read", "Superset"),
    "health_check": ("can_read", "Superset"),
}


def get_user_from_request() -> User:
    """
    Get the current user for the MCP tool request.

    Priority order:
    1. g.user if already set (by Preset workspace middleware)
    2. MCP_DEV_USERNAME from configuration (for development/testing)

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

    # Fall back to configured username for development/single-user deployments
    username = current_app.config.get("MCP_DEV_USERNAME")

    if not username:
        raise ValueError(
            "No authenticated user found. "
            "Either pass a valid JWT bearer token or configure "
            "MCP_DEV_USERNAME for development."
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


def check_tool_permission(
    tool_name: str,
    permission_name: str | None = None,
    view_name: str | None = None,
) -> bool:
    """
    Check if the current user has RBAC permission for an MCP tool.

    This function enforces action-level permissions that mirror Flask-AppBuilder's
    @protect() decorator, ensuring MCP tools respect the same RBAC model as the
    REST API endpoints.

    Args:
        tool_name: The name of the MCP tool being called
        permission_name: Optional explicit permission name (overrides registry)
        view_name: Optional explicit view name (overrides registry)

    Returns:
        True if user has permission, False otherwise

    Example:
        # Check permission using registry
        if not check_tool_permission("execute_sql"):
            raise MCPPermissionDeniedError(...)

        # Check with explicit permission
        if not check_tool_permission("my_tool", "can_write", "Dashboard"):
            raise MCPPermissionDeniedError(...)
    """
    try:
        from superset import security_manager

        # Get user from context
        if not hasattr(g, "user") or not g.user:
            logger.warning(
                "No user context for permission check on tool: %s", tool_name
            )
            return False

        # Determine permission and view to check
        if permission_name is None or view_name is None:
            # Look up in registry
            if tool_name in MCP_TOOL_PERMISSIONS:
                reg_perm, reg_view = MCP_TOOL_PERMISSIONS[tool_name]
                permission_name = permission_name or reg_perm
                view_name = view_name or reg_view
            else:
                # Tool not in registry - allow by default (backward compatibility)
                # In production, you may want to deny by default instead
                logger.debug(
                    "Tool %s not in permission registry, allowing by default", tool_name
                )
                return True

        # Use Superset's security manager to check permission
        # This mirrors Flask-AppBuilder's has_access() check
        has_permission = security_manager.can_access(permission_name, view_name)

        if not has_permission:
            logger.warning(
                "Permission denied for user %s: %s on %s (tool: %s)",
                g.user.username,
                permission_name,
                view_name,
                tool_name,
            )

        return has_permission

    except Exception as e:
        logger.error("Error checking tool permission for %s: %s", tool_name, e)
        return False  # Deny on error (fail secure)


def require_tool_permission(
    tool_name: str,
    permission_name: str | None = None,
    view_name: str | None = None,
) -> None:
    """
    Require RBAC permission for an MCP tool, raising an exception if denied.

    This is a convenience wrapper around check_tool_permission that raises
    MCPPermissionDeniedError when permission is denied.

    Args:
        tool_name: The name of the MCP tool being called
        permission_name: Optional explicit permission name (overrides registry)
        view_name: Optional explicit view name (overrides registry)

    Raises:
        MCPPermissionDeniedError: If user lacks required permission
    """
    if not check_tool_permission(tool_name, permission_name, view_name):
        # Get actual permission/view for error message
        if permission_name is None or view_name is None:
            if tool_name in MCP_TOOL_PERMISSIONS:
                reg_perm, reg_view = MCP_TOOL_PERMISSIONS[tool_name]
                permission_name = permission_name or reg_perm
                view_name = view_name or reg_view
            else:
                permission_name = permission_name or "unknown"
                view_name = view_name or "unknown"

        user = g.user.username if hasattr(g, "user") and g.user else None
        raise MCPPermissionDeniedError(
            permission_name=permission_name,
            view_name=view_name,
            user=user,
            tool_name=tool_name,
        )


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


def mcp_auth_hook(
    tool_func: F | None = None,
    *,
    check_permissions: bool = True,
) -> F | Callable[[F], F]:
    """
    Authentication and authorization decorator for MCP tools.

    This decorator:
    1. Sets up user context from JWT or configured dev user
    2. Enforces RBAC permissions based on the tool permission registry
    3. Manages database session lifecycle

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
        def my_tool(): ...  # Checks permissions from registry

        @mcp_auth_hook(check_permissions=False)
        def my_public_tool(): ...  # Only requires authentication
    """
    import functools
    import inspect
    import types

    def decorator(func: F) -> F:
        is_async = inspect.iscoroutinefunction(func)

        if is_async:

            @functools.wraps(func)
            async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
                user = _setup_user_context()

                try:
                    tool_name = func.__name__
                    logger.debug(
                        "MCP tool call: user=%s, tool=%s",
                        user.username,
                        tool_name,
                    )

                    # Check RBAC permissions if enabled
                    if check_permissions:
                        require_tool_permission(tool_name)

                    result = await func(*args, **kwargs)
                    return result
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
                    tool_name = func.__name__
                    logger.debug(
                        "MCP tool call: user=%s, tool=%s",
                        user.username,
                        tool_name,
                    )

                    # Check RBAC permissions if enabled
                    if check_permissions:
                        require_tool_permission(tool_name)

                    result = func(*args, **kwargs)
                    return result
                except Exception:
                    _cleanup_session_on_error()
                    raise
                finally:
                    _cleanup_session_finally()

            wrapper = sync_wrapper

        # Merge original function's __globals__ into wrapper's __globals__
        # This allows get_type_hints() to resolve type annotations from the
        # original module (e.g., Context from fastmcp)
        # FastMCP 2.13.2+ uses get_type_hints() which needs access to these types
        merged_globals = {**wrapper.__globals__, **func.__globals__}  # type: ignore[attr-defined]
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
        new_wrapper.__doc__ = func.__doc__

        # Set __signature__ from the original function, but:
        # 1. Remove ctx parameter - FastMCP tools don't expose it to clients
        # 2. Skip if original has *args (parse_request output has its own handling)
        from fastmcp import Context as FMContext

        tool_sig = inspect.signature(func)
        has_var_positional = any(
            p.kind == inspect.Parameter.VAR_POSITIONAL
            for p in tool_sig.parameters.values()
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

    # Support both @mcp_auth_hook and @mcp_auth_hook() syntax
    if tool_func is not None:
        return decorator(tool_func)
    return decorator
