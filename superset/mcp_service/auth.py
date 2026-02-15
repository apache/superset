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
Minimal authentication hooks for MCP tools.
This is a placeholder implementation that provides basic user context.

Future enhancements (to be added in separate PRs):
- JWT token authentication and validation
- User impersonation support
- Permission checking with scopes
- Comprehensive audit logging
- Field-level permissions
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
    1. g.user if already set (by Preset workspace middleware)
    2. MCP_DEV_USERNAME from configuration (for development/testing)

    Returns:
        User object with roles and groups eagerly loaded

    Raises:
        ValueError: If user cannot be authenticated or found
    """
    from flask import current_app

    # First check if user is already set by Preset workspace middleware
    if hasattr(g, "user") and g.user:
        return g.user

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
        raise ValueError(
            "No authenticated user found. Tried:\n"
            + "\n".join(f"  - {d}" for d in details)
            + "\n\nEither pass a valid JWT bearer token or configure "
            "MCP_DEV_USERNAME for development."
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

    This decorator pushes Flask application context and sets up g.user
    for MCP tool execution.

    Supports both sync and async tool functions.

    TODO (future PR): Add permission checking
    TODO (future PR): Add JWT scope validation
    TODO (future PR): Add comprehensive audit logging
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
