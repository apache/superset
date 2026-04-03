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
- FAB_API_KEY_ENABLED: Flask config key to enable API key auth (default: False)
- FAB_API_KEY_PREFIXES: Key prefixes (default: ["sst_"])
- MCP_DEV_USERNAME: Fallback username for development
"""

import logging
from contextlib import AbstractContextManager
from typing import Any, Callable, TYPE_CHECKING, TypeVar

from flask import g, has_request_context
from flask_appbuilder.security.sqla.models import Group, User

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlaTable
    from superset.mcp_service.chart.chart_utils import DatasetValidationResult

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


def _resolve_user_from_jwt_context(app: Any) -> User | None:
    """
    Resolve the current user from the MCP SDK's per-request JWT context.

    Uses FastMCP's ``get_access_token()`` which returns the JWT AccessToken
    for the current async task via a ContextVar — safe across concurrent
    requests, unlike ``g.user`` which can be stale.

    The username is extracted from token claims using a configurable resolver
    (``MCP_USER_RESOLVER`` config) or the default ``default_user_resolver()``.

    Returns:
        User object with relationships loaded, or None if no JWT context
        (i.e. no token present — caller should fall through to next source).

    Raises:
        ValueError: If JWT resolves a username that doesn't exist in the DB
            (fail closed — do NOT fall through to weaker auth sources).
    """
    try:
        from fastmcp.server.dependencies import get_access_token
    except ImportError:
        logger.debug("fastmcp.server.dependencies not available, skipping JWT context")
        return None

    access_token = get_access_token()
    if access_token is None:
        return None

    # Use configurable resolver or default
    from superset.mcp_service.mcp_config import default_user_resolver

    resolver = app.config.get("MCP_USER_RESOLVER", default_user_resolver)
    username = resolver(app, access_token)

    if not username:
        # Fail closed: JWT is present but identity cannot be determined.
        # Do NOT fall through to weaker auth sources.
        raise ValueError(
            "JWT context present but no username could be extracted from claims"
        )

    # Try username lookup first, then email fallback for OIDC email claims
    user = load_user_with_relationships(username)
    if not user and "@" in username:
        user = load_user_with_relationships(email=username)
    if not user:
        # Fail closed: JWT says this user should exist but they don't.
        # Do NOT fall through to MCP_DEV_USERNAME or stale g.user.
        raise ValueError(
            f"JWT authenticated user '{username}' not found in Superset database. "
            f"Ensure the user exists before granting MCP access."
        )

    return user


def _resolve_user_from_api_key(app: Any) -> User | None:
    """
    Resolve the current user from an API key in the Authorization header.

    Uses FAB SecurityManager's API key validation. Only attempts when
    FAB_API_KEY_ENABLED is True and a request context is active.

    Returns:
        User object with relationships loaded, or None if no API key present
        or API key auth is not enabled/available.

    Raises:
        PermissionError: If an API key is present but invalid/expired,
            or if validation is not available in this FAB version.
    """
    if not app.config.get("FAB_API_KEY_ENABLED", False) or not has_request_context():
        return None

    sm = app.appbuilder.sm
    # _extract_api_key_from_request is FAB's internal method for reading
    # the Bearer token from the Authorization header and matching prefixes.
    # Not all FAB versions include this method, so guard with hasattr.
    if not hasattr(sm, "_extract_api_key_from_request"):
        logger.debug(
            "FAB SecurityManager does not have _extract_api_key_from_request; "
            "API key authentication is not available in this FAB version"
        )
        return None

    api_key_string = sm._extract_api_key_from_request()
    if api_key_string is None:
        return None

    if not hasattr(sm, "validate_api_key"):
        logger.warning(
            "FAB SecurityManager does not have validate_api_key; "
            "cannot validate API key"
        )
        raise PermissionError(
            "API key validation is not available in this FAB version."
        )

    user = sm.validate_api_key(api_key_string)
    if not user:
        raise PermissionError(
            "Invalid or expired API key. "
            "Create a new key at /api/v1/security/api_keys/."
        )

    # Reload user with all relationships eagerly loaded to avoid
    # detached-instance errors during later permission checks.
    user_with_rels = load_user_with_relationships(username=user.username)
    if user_with_rels is None:
        logger.warning(
            "Failed to reload API key user %s with relationships; "
            "using original user object which may have lazy-loaded "
            "relationships",
            user.username,
        )
        return user
    return user_with_rels


def get_user_from_request() -> User:
    """
    Get the current user for the MCP tool request.

    Priority order:
    1. JWT auth context (per-request ContextVar from MCP SDK) — safest
    2. API key from Authorization header (via FAB SecurityManager)
    3. MCP_DEV_USERNAME from configuration (for development/testing)
    4. g.user fallback (for external middleware like Preset's
       WorkspaceContextMiddleware that sets g.user fresh per request)

    This ordering prevents stale ``g.user`` from a previous tool call
    from being used in open-source deployments where no middleware
    refreshes ``g.user`` per request.

    Returns:
        User object with roles and groups eagerly loaded

    Raises:
        ValueError: If user cannot be authenticated or found
    """
    from flask import current_app

    # Priority 1: JWT context (per-request safe via ContextVar)
    if (jwt_user := _resolve_user_from_jwt_context(current_app)) is not None:
        return jwt_user

    # Priority 2: API key authentication via FAB SecurityManager
    if (api_key_user := _resolve_user_from_api_key(current_app)) is not None:
        return api_key_user

    # Priority 3: Configured dev username for development/single-user deployments
    if username := current_app.config.get("MCP_DEV_USERNAME"):
        user = load_user_with_relationships(username)
        if not user:
            raise ValueError(
                f"User '{username}' not found. "
                f"Please create admin user with: superset fab create-admin"
            )
        return user

    # Priority 4: g.user fallback (set by external middleware, e.g. Preset)
    if hasattr(g, "user") and g.user:
        return g.user

    # No auth source available — raise with diagnostic details
    auth_enabled = current_app.config.get("MCP_AUTH_ENABLED", False)
    jwt_configured = bool(
        current_app.config.get("MCP_JWKS_URI")
        or current_app.config.get("MCP_JWT_PUBLIC_KEY")
        or current_app.config.get("MCP_JWT_SECRET")
    )
    details = [
        f"No JWT access token in MCP request context "
        f"(MCP_AUTH_ENABLED={auth_enabled}, "
        f"JWT keys configured={jwt_configured})",
        "No API key in Authorization header",
        "MCP_DEV_USERNAME is not configured",
        "g.user was not set by external middleware",
    ]
    configured_prefixes = current_app.config.get("FAB_API_KEY_PREFIXES", ["sst_"])
    prefix_example = configured_prefixes[0] if configured_prefixes else "sst_"
    raise ValueError(
        "No authenticated user found. Tried:\n"
        + "\n".join(f"  - {d}" for d in details)
        + f"\n\nEither pass a valid API key (Bearer {prefix_example}...), "
        "JWT token, or configure MCP_DEV_USERNAME for development."
    )


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


def check_chart_data_access(chart: Any) -> "DatasetValidationResult":
    """Validate that the current user can access a chart's underlying dataset.

    This extends the RBAC system: ``mcp_auth_hook`` enforces class-level
    permissions before tool execution; this function enforces data-level
    permissions inside tools after retrieving specific objects.

    Args:
        chart: A Slice ORM object with datasource_id attribute

    Returns:
        DatasetValidationResult with is_valid, error, etc.
    """
    from superset.mcp_service.chart.chart_utils import validate_chart_dataset

    return validate_chart_dataset(chart, check_access=True)


def _setup_user_context() -> User | None:
    """
    Set up user context for MCP tool execution.

    Includes retry logic for stale database connections (e.g., SSL dropped
    by proxy/load balancer after idle periods). On OperationalError, the
    session is reset and the user lookup is retried once.

    Returns:
        User object with roles and groups loaded, or None if no Flask context
    """
    # Clear stale g.user to prevent user impersonation across
    # tool calls when no per-request middleware refreshes it.
    # Only clear in app-context-only mode; preserve g.user when
    # a request context is active (external middleware set it).
    from flask import has_request_context

    if not has_request_context():
        g.pop("user", None)

    from sqlalchemy.exc import OperationalError

    for attempt in range(2):
        try:
            user = get_user_from_request()

            # Validate user has necessary relationships loaded.
            # Force access to ensure they're loaded if lazy.
            # This is inside the retry loop because relationship loading
            # also hits the DB and can fail on stale SSL connections.
            user_roles = user.roles  # noqa: F841
            if hasattr(user, "groups"):
                user_groups = user.groups  # noqa: F841

            break
        except RuntimeError as e:
            # No Flask application context (e.g., prompts before middleware runs)
            if "application context" in str(e):
                logger.debug("No Flask app context available for user setup")
                return None
            raise
        except OperationalError as e:
            if attempt == 0:
                logger.warning(
                    "Stale DB connection during user setup (attempt 1), "
                    "resetting session and retrying: %s",
                    e,
                )
                _cleanup_session_on_error()
                continue
            logger.error("DB connection failed on retry during user setup: %s", e)
            raise
        except ValueError as e:
            # JWT user resolution failed (e.g. SAML subject not in DB).
            from flask import has_request_context

            if has_request_context() and hasattr(g, "user") and g.user:
                logger.warning(
                    "JWT user resolution failed (%s), "
                    "using middleware-provided g.user=%s",
                    e,
                    g.user.username,
                )
                user = g.user
                break
            raise

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

    # Detect if the original function expects a ctx: Context parameter.
    # If so, we inject it via get_context() at call time so tool functions
    # don't need @parse_request to handle Context injection.
    from fastmcp import Context as FMContext

    _tool_sig = inspect.signature(tool_func)
    _needs_ctx = any(
        p.annotation is FMContext
        or (hasattr(p.annotation, "__name__") and p.annotation.__name__ == "Context")
        for p in _tool_sig.parameters.values()
    )

    def _inject_ctx(kwargs: dict[str, Any]) -> dict[str, Any]:
        """Inject FastMCP Context into kwargs if the tool function expects it."""
        if _needs_ctx and "ctx" not in kwargs:
            from fastmcp.server.dependencies import get_context

            kwargs["ctx"] = get_context()
        return kwargs

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
                    return await tool_func(*args, **_inject_ctx(kwargs))

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
                    result = await tool_func(*args, **_inject_ctx(kwargs))
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
                    return tool_func(*args, **_inject_ctx(kwargs))

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
                    result = tool_func(*args, **_inject_ctx(kwargs))
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
    has_var_positional = any(
        p.kind == inspect.Parameter.VAR_POSITIONAL
        for p in _tool_sig.parameters.values()
    )

    if not has_var_positional:
        # For functions without *args, preserve signature but remove ctx
        new_params = []
        for _name, param in _tool_sig.parameters.items():
            # Skip ctx parameter - FastMCP tools don't expose it to clients
            if param.annotation is FMContext or (
                hasattr(param.annotation, "__name__")
                and param.annotation.__name__ == "Context"
            ):
                continue
            new_params.append(param)
        new_wrapper.__signature__ = _tool_sig.replace(  # type: ignore[attr-defined]
            parameters=new_params
        )

        # Also remove ctx from annotations to match signature
        if "ctx" in new_wrapper.__annotations__:
            del new_wrapper.__annotations__["ctx"]
    # For functions with *args (parse_request output), the signature
    # is already set by parse_request without ctx.

    return new_wrapper  # type: ignore[return-value]
