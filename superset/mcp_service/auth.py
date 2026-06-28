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
from contextlib import AbstractContextManager, nullcontext
from typing import Any, Callable, TYPE_CHECKING, TypeVar

from flask import current_app, g, has_app_context, has_request_context
from flask_appbuilder.security.sqla.models import User

from superset import security_manager
from superset.mcp_service.composite_token_verifier import (
    API_KEY_PASSTHROUGH_CLAIM,
    API_KEY_VALIDATED_USERNAME_CLAIM,
)
from superset.mcp_service.mcp_config import (
    default_user_resolver,
    get_mcp_api_key_enabled,
)
from superset.mcp_service.utils.error_sanitization import (
    sanitize_for_log as _sanitize_for_log,
)

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

# Tools already warned about for declaring no class_permission_name, so the
# warning surfaces once per tool instead of on every protected-tool call.
_warned_permissionless_tools: set[str] = set()


class MCPNoAuthSourceError(ValueError):
    """Raised when no authentication source is configured for MCP.

    Inherits from ``ValueError`` so callers can catch ``ValueError`` broadly
    and then use ``isinstance(exc, MCPNoAuthSourceError)`` to distinguish
    "no auth configured at all" (safe to fail open) from other value errors
    (fail closed).
    """


# Maps a tool's method permission to the OAuth-style token scope it requires.
# Used by ``check_tool_permission`` for scope-aware authorization: enforcement
# is the INTERSECTION of token scopes and DB RBAC. Only applied when the token
# actually carries scopes — see ``_token_scope_allows``.
#
# SECURITY: this map must cover EVERY method permission used by an MCP tool.
# A scoped token presented for a method that is NOT in this map is denied
# (fail closed) rather than allowed, so adding a tool with a new custom
# permission cannot silently bypass scope enforcement. ``execute_sql_query``
# is a privileged, write-class operation and therefore requires the write
# scope. When introducing a new method permission, add it here.
_METHOD_TO_REQUIRED_SCOPE = {
    "read": "superset:read",
    "write": "superset:write",
    "delete": "superset:write",
    # SQL execution (execute_sql, get_chart_sql) runs arbitrary queries and is
    # treated as a write-class privileged operation for scope purposes.
    "execute_sql_query": "superset:write",
}


def _get_token_scopes() -> set[str] | None:
    """Return the set of scopes on the current JWT access token, or None.

    Returns None when there is no JWT context or the token carries no scopes,
    so callers can fall back to RBAC-only behavior (back-compat for API-key and
    scope-less JWT deployments). Returns a (possibly populated) set only when
    the token explicitly advertises scopes.
    """
    try:
        from fastmcp.server.dependencies import get_access_token
    except ImportError:
        return None

    try:
        access_token = get_access_token()
    except Exception:  # noqa: BLE001 - no JWT context for this request
        return None

    if access_token is None:
        return None

    scopes = getattr(access_token, "scopes", None)
    if not scopes:
        # Token present but no scopes advertised: do NOT enforce scope checks.
        return None
    return {str(s) for s in scopes}


def _token_scope_allows(method_permission_name: str) -> bool:
    """Return whether the current token's scopes permit the given method.

    Back-compat: returns True (allow) when the token carries no scopes or there
    is no JWT context, so deployments not using scopes keep RBAC-only behavior.
    Only when the token advertises scopes is the mapped required scope enforced.
    """
    token_scopes = _get_token_scopes()
    if token_scopes is None:
        return True
    required_scope = _METHOD_TO_REQUIRED_SCOPE.get(method_permission_name)
    if required_scope is None:
        # Fail closed: a scoped token was presented for a method permission that
        # is not in the scope map. Rather than silently bypassing scope
        # enforcement, deny it so an unmapped (e.g. newly added custom) method
        # permission cannot be reached by a scoped token. Map the permission in
        # ``_METHOD_TO_REQUIRED_SCOPE`` to grant access.
        logger.warning(
            "Denying scoped token for unmapped method permission '%s'; "
            "add it to _METHOD_TO_REQUIRED_SCOPE to grant scoped access.",
            method_permission_name,
        )
        return False
    return required_scope in token_scopes


class MCPPermissionDeniedError(PermissionError):
    """Raised when user lacks required RBAC permission for an MCP tool.

    Inherits from ``PermissionError`` so the middleware classifies denials as
    user errors (HTTP 403 / WARNING log / "Access denied" sanitized message)
    rather than unexpected server errors.
    """

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


def _log_scope_denial(
    func: Callable[..., Any],
    method_permission_name: str,
    permission_str: str,
    class_permission_name: str,
    *,
    log_denial: bool,
) -> None:
    """Log a scope-based denial for a tool the user has RBAC access to.

    Extracted from ``check_tool_permission`` to keep that function's
    cyclomatic complexity in check.
    """
    required_scope = _METHOD_TO_REQUIRED_SCOPE.get(method_permission_name)
    if log_denial:
        logger.warning(
            "Scope denied for user %s: token lacks required scope "
            "'%s' for %s on %s (tool: %s)",
            _sanitize_for_log(g.user.username),
            required_scope,
            permission_str,
            class_permission_name,
            func.__name__,
        )
    else:
        logger.debug(
            "Tool hidden for user %s: token lacks required scope '%s' (tool: %s)",
            _sanitize_for_log(g.user.username),
            required_scope,
            func.__name__,
        )


def check_tool_permission(func: Callable[..., Any], *, log_denial: bool = True) -> bool:
    """Check if the current user has RBAC permission for an MCP tool.

    Reads permission metadata stored on the function by the @tool decorator
    and uses Superset's security_manager to verify access.

    Controlled by the ``MCP_RBAC_ENABLED`` config flag (default True).
    Set to False in superset_config.py to disable RBAC checking.

    Args:
        func: The tool function with optional permission attributes.
        log_denial: When False, log denials at DEBUG level instead of WARNING.
            Pass False for list-time visibility checks to avoid per-tool warning
            noise for every hidden tool on every ``tools/list`` request.

    Returns:
        True if user has permission or no permission is required.
    """
    try:
        if not current_app.config.get("MCP_RBAC_ENABLED", True):
            return True

        if not hasattr(g, "user") or not g.user:
            if log_denial:
                logger.warning(
                    "No user context for permission check on tool: %s", func.__name__
                )
            else:
                logger.debug(
                    "No user context for permission check on tool: %s", func.__name__
                )
            return False

        class_permission_name = getattr(func, CLASS_PERMISSION_ATTR, None)
        if not class_permission_name:
            # No RBAC configured for this tool; allow by default. This is a
            # supported configuration (a protected tool may intentionally
            # declare no permission class), but surface it ONCE per tool so an
            # accidental omission on a sensitive tool doesn't silently fail open
            # — without emitting a WARNING on every protected-tool call.
            if func.__name__ not in _warned_permissionless_tools:
                _warned_permissionless_tools.add(func.__name__)
                logger.warning(
                    "Tool %s is permission-protected but declares no "
                    "class_permission_name; allowing access without an RBAC check",
                    func.__name__,
                )
            return True

        method_permission_name = getattr(func, METHOD_PERMISSION_ATTR, "read")
        permission_str = f"{PERMISSION_PREFIX}{method_permission_name}"

        has_permission = security_manager.can_access(
            permission_str, class_permission_name
        )

        # Scope-aware authorization: enforce the INTERSECTION of token scopes
        # and DB RBAC. A tool is allowed only if the user has the RBAC
        # permission AND the token carries the required scope.
        #
        # Back-compat: scope enforcement applies ONLY when the token actually
        # advertises scopes. Tokens/deployments that don't use scopes (API keys,
        # scope-less JWTs, dev-mode) fall through to RBAC-only behavior — see
        # ``_token_scope_allows``.
        if has_permission and not _token_scope_allows(method_permission_name):
            _log_scope_denial(
                func,
                method_permission_name,
                permission_str,
                class_permission_name,
                log_denial=log_denial,
            )
            return False

        if not has_permission:
            if log_denial:
                logger.warning(
                    "Permission denied for user id=%s: %s on %s (tool: %s)",
                    getattr(g.user, "id", "?"),
                    permission_str,
                    class_permission_name,
                    func.__name__,
                )
            else:
                logger.debug(
                    "Tool hidden for user id=%s: %s on %s (tool: %s)",
                    getattr(g.user, "id", "?"),
                    permission_str,
                    class_permission_name,
                    func.__name__,
                )

        return has_permission

    except (AttributeError, ValueError, RuntimeError) as e:
        logger.warning("Error checking tool permission: %s", e)
        return False


def is_tool_visible_to_current_user(tool: Any) -> bool:
    """Return whether the current user can see a tool in tools/list.

    Checks both RBAC permissions and data-model metadata privacy. The caller
    must set ``g.user`` before calling this function.

    This is the single source of truth for tool visibility — called from both
    ``RBACToolVisibilityMiddleware`` (``tools/list``) and
    ``_tool_allowed_for_current_user()`` (tool search).

    Args:
        tool: A FastMCP Tool object.

    Returns:
        True if the tool is visible to the current user, False otherwise.
    """
    try:
        if not current_app.config.get("MCP_RBAC_ENABLED", True):
            return True

        tool_func = getattr(tool, "fn", None)
        if tool_func is None:
            return True

        from superset.mcp_service.privacy import (
            tool_requires_data_model_metadata_access,
            user_can_view_data_model_metadata,
        )

        if (
            tool_requires_data_model_metadata_access(tool_func)
            and not user_can_view_data_model_metadata()
        ):
            return False

        class_permission_name = getattr(tool_func, CLASS_PERMISSION_ATTR, None)
        if not class_permission_name:
            return True

        return check_tool_permission(tool_func, log_denial=False)

    except (AttributeError, RuntimeError, ValueError):
        logger.debug("Could not evaluate tool visibility for current user")
        return False


def load_user_with_relationships(
    username: str | None = None, email: str | None = None
) -> User | None:
    """Load a user with roles and group roles eagerly loaded.

    Delegates to :meth:`SupersetSecurityManager.find_user_with_relationships`,
    which mirrors FAB's ``find_user`` (including ``auth_username_ci`` and
    ``MultipleResultsFound`` handling) while adding eager loading of
    ``User.roles`` and ``User.groups.roles`` to prevent detached-instance
    errors when the SQLAlchemy session is closed or rolled back after the
    lookup — as happens in MCP tool-execution contexts.

    Raises:
        ValueError: If neither username nor email is provided
    """
    if not username and not email:
        raise ValueError("Either username or email must be provided")

    return security_manager.find_user_with_relationships(username=username, email=email)


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

    # API key pass-through: CompositeTokenVerifier accepted this token
    # at the transport layer but defers actual validation to
    # _resolve_user_from_api_key() (priority 2 in get_user_from_request).
    # Require client_id=="api_key" (set by CompositeTokenVerifier) in addition
    # to the claim so that an external IdP JWT that happens to include the
    # claim name is not misclassified as an API-key pass-through.
    claims = getattr(access_token, "claims", None)
    if isinstance(claims, dict) and claims.get(API_KEY_PASSTHROUGH_CLAIM):
        if getattr(access_token, "client_id", None) == "api_key":
            logger.debug(
                "API key pass-through token detected, deferring to API key auth"
            )
            return None
        logger.debug(
            "API key passthrough claim present but client_id is not 'api_key';"
            " processing as JWT"
        )

    # Multi-issuer safety: when more than one issuer is trusted, a bare
    # username/email lookup is NOT issuer-scoped, so two issuers that mint the
    # same username/email claim would resolve to the same Superset user.
    #
    # Single-issuer deployments (the common case) are safe — the issuer is
    # already pinned by the verifier, so the username space is unambiguous and
    # we keep the existing lookup key to avoid breaking them. For multi-issuer
    # configs we warn: operators should provide an issuer-aware MCP_USER_RESOLVER
    # that derives a compound (iss + sub) identity. This is the least-breaking
    # correct option (warn, don't change the key out from under existing
    # single-issuer deployments).
    configured_issuer = app.config.get("MCP_JWT_ISSUER")
    if isinstance(configured_issuer, (list, tuple, set)) and len(configured_issuer) > 1:
        if not app.config.get("MCP_USER_RESOLVER"):
            token_iss = claims.get("iss") if isinstance(claims, dict) else None
            logger.warning(
                "Multiple JWT issuers are trusted (MCP_JWT_ISSUER is a list) but "
                "the default user resolver maps token claims to Superset users by "
                "username/email without binding the issuer (iss=%s). Distinct "
                "issuers minting the same username/email will collide. Configure an "
                "issuer-aware MCP_USER_RESOLVER to derive a compound (iss+sub) "
                "identity.",
                _sanitize_for_log(token_iss),
            )

    # Use configurable resolver or default

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
        # Avoid echoing the JWT-extracted username in the exception message
        # (CodeQL py/clear-text-logging-sensitive-data).
        logger.debug("JWT-authenticated user not found in database (identity from JWT)")
        raise ValueError(
            "JWT authenticated user not found in Superset database. "
            "Ensure the user exists before granting MCP access."
        )

    return user


def _redact_access_token(access_token: Any) -> None:
    """Redact the raw token value after validation so it does not persist."""
    try:
        object.__setattr__(access_token, "token", "")
    except (AttributeError, TypeError):
        # Immutable AccessToken: the raw token still lives on the object.
        # Log so the failure is visible; downstream log sanitization (where
        # configured) must redact it.
        logger.debug("Could not redact raw API key from AccessToken")


def _load_api_key_user_by_username(username: str) -> User:
    """Load a user by username after transport-layer API key validation."""
    user_with_rels = load_user_with_relationships(username=username)
    if user_with_rels is None:
        raise PermissionError(f"API key owner '{username}' not found in database.")
    return user_with_rels


def _validate_api_key_fallback(app: Any, api_key_string: str | None) -> User:
    """Validate an API key via FAB when transport-layer validation was skipped."""
    if not api_key_string:
        raise PermissionError(
            "API key pass-through token is missing the raw token value."
        )

    sm = app.appbuilder.sm
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
        create_url = app.config.get("MCP_API_KEY_CREATE_URL", "/profile/")
        raise PermissionError(
            f"Invalid or expired API key. Create a new key at {create_url}."
        )

    user_with_rels = load_user_with_relationships(username=user.username)
    if user_with_rels is None:
        logger.warning(
            "Failed to reload API key user id=%s with relationships; "
            "using original user object which may have lazy-loaded relationships",
            getattr(user, "id", "?"),
        )
        return user
    return user_with_rels


def _resolve_user_from_api_key(app: Any) -> User | None:
    """
    Resolve the current user from an API key passed via Bearer token.

    Reads the token from FastMCP's per-request ``AccessToken`` (set by
    ``CompositeTokenVerifier`` when a Bearer token matches an API key
    prefix). The streamable-http transport does not push a Flask request
    context, so we cannot rely on ``flask.request`` headers — the verifier
    already saw the token and stashed it on the ``AccessToken``.

    Returns:
        User object with relationships loaded, or None if no API key
        pass-through token is present or API key auth is not enabled.

    Raises:
        PermissionError: If an API key pass-through token is present but
            invalid/expired (fail closed — do NOT fall through to weaker
            auth sources like ``MCP_DEV_USERNAME``), or if validation is
            not available in this FAB version.
    """
    if not get_mcp_api_key_enabled(app):
        return None

    try:
        from fastmcp.server.dependencies import get_access_token
    except ImportError:
        logger.debug("fastmcp.server.dependencies not available, skipping API key auth")
        return None

    access_token = get_access_token()
    if access_token is None:
        return None

    # Only validate tokens that the CompositeTokenVerifier flagged as
    # API key pass-throughs. Plain JWTs were already validated by the JWT
    # verifier and resolved in _resolve_user_from_jwt_context.
    claims = getattr(access_token, "claims", None)
    if not (isinstance(claims, dict) and claims.get(API_KEY_PASSTHROUGH_CLAIM)):
        return None
    # Defense-in-depth: require client_id=="api_key" (set by CompositeTokenVerifier)
    # to guard against rogue external IdP JWTs that include the passthrough claim.
    if getattr(access_token, "client_id", None) != "api_key":
        return None

    # Fast path: transport layer already validated the key and stored the
    # username in the claim — skip the second DB call.
    if validated_username := claims.get(API_KEY_VALIDATED_USERNAME_CLAIM):
        _redact_access_token(access_token)
        return _load_api_key_user_by_username(validated_username)

    # Fallback: no transport-level validation (app=None in CompositeTokenVerifier).
    # Validate the raw token against FAB here instead.
    api_key_string = getattr(access_token, "token", None)
    _redact_access_token(access_token)
    return _validate_api_key_fallback(app, api_key_string)


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

    # No auth source available. Keep the configuration diagnostics in the
    # server logs only -- the message returned to the (unauthenticated) client
    # must not reveal which auth mechanisms are configured.
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
    logger.warning(
        "MCP request could not be authenticated. Tried: %s",
        "; ".join(details),
    )
    raise MCPNoAuthSourceError(
        "Authentication required. No valid credentials provided."
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


def _log_user_resolution_failure(exc: ValueError | PermissionError) -> None:
    """Log a user-resolution failure at the appropriate level.

    "No authenticated user found" is expected in unauthenticated/dev
    deployments (no JWT, no API key, no MCP_DEV_USERNAME configured) and
    during tools/list scanning — log at DEBUG to avoid ERROR noise.
    All other failures (e.g. dev username not in DB, permission denied) are
    genuine credential failures and are logged at ERROR.
    """
    if isinstance(exc, MCPNoAuthSourceError):
        logger.debug("MCP: no auth source configured, unauthenticated request")
    else:
        logger.error("MCP user resolution failed, denying request: %s", exc)


def _assert_user_active(user: User | None) -> None:
    """Raise ValueError if the user account is disabled (no-op for None)."""
    if user is None:
        return
    if not getattr(user, "is_active", getattr(user, "active", True)):
        raise ValueError(
            f"Account for user '{getattr(user, 'username', user)}' is disabled."
        )


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

    if not has_request_context():
        g.pop("user", None)

    from sqlalchemy.exc import OperationalError

    user = None  # Ensure defined before loop in case of unexpected exit

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
                # Only retry on connection-level errors (SSL drops, server
                # closed connection). Other OperationalErrors (e.g., lock
                # timeouts) are unlikely to succeed on immediate retry but
                # are bounded to one attempt so the cost is acceptable.
                logger.warning(
                    "Stale DB connection during user setup (attempt 1), "
                    "resetting session and retrying: %s",
                    e,
                )
                _cleanup_session_on_error()
                continue
            logger.error("DB connection failed on retry during user setup: %s", e)
            _cleanup_session_on_error()
            raise
        except (ValueError, PermissionError) as e:
            # User resolution failed — fail closed. Do not fall back to
            # g.user from middleware, as that could allow a request to
            # proceed as a different user in multi-tenant deployments.
            # Clear g.user so error/audit logging doesn't attribute
            # the denied request to the middleware-provided identity.
            _log_user_resolution_failure(e)
            if has_request_context():
                g.pop("user", None)
            raise

    _assert_user_active(user)
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


def _remove_session_safe() -> None:
    """Remove the scoped SQLAlchemy session, tolerating SSL/connection errors.

    Thread-pool workers reuse threads across requests.  Before each tool call
    the session is removed to prevent a prior request's thread-local session
    from leaking into the next one.  If the underlying DBAPI connection died
    between requests (e.g. RDS SSL idle-timeout or max-connection-age), the
    rollback implicit in ``session.close()`` raises a ``DBAPIError`` subclass
    (``OperationalError`` for psycopg2, ``InterfaceError`` for some other
    drivers).

    When that happens:
    1. Invalidate the dead connection so the pool discards it (rather than
       returning a broken connection to the next caller).
    2. Retry ``remove()`` to deregister the session from the scoped registry.

    The tool call still proceeds because a fresh connection will be obtained
    on the next DB access.
    """
    from sqlalchemy.exc import DBAPIError

    from superset.extensions import db

    try:
        db.session.remove()
    except DBAPIError as exc:
        logger.warning(
            "Connection error during pre-call session cleanup "
            "(likely SSL/idle timeout); invalidating connection and retrying: %s",
            exc,
        )
        try:
            db.session.invalidate()
        except Exception as invalidate_exc:
            logger.debug(
                "Could not invalidate session after connection error: %s",
                invalidate_exc,
            )
        db.session.remove()  # retry: session deregisters cleanly after invalidation


def _get_app_context_manager() -> AbstractContextManager[None]:
    """Return the right context manager for the current Flask state.

    When a request context is present, external middleware (e.g.
    Preset's WorkspaceContextMiddleware) has already set ``g.user``
    on a per-request app context — reuse it via ``nullcontext()``.

    When only a bare app context exists (no request context), push a
    **new** app context so concurrent tool calls do not share one ``g``
    namespace (which would cause ``g.user`` races under asyncio).

    When no context exists at all, push a fresh app context from the
    Flask singleton.

    This is the single source of truth for context selection — called
    from both ``mcp_auth_hook`` (tool execution) and
    ``RBACToolVisibilityMiddleware`` (tools/list filtering).
    """
    if has_request_context():
        return nullcontext()
    if has_app_context():
        # Push a new context for the CURRENT app (not get_flask_app()
        # which may return a different instance in test environments).
        return current_app._get_current_object().app_context()
    # Deferred: importing at module level would trigger create_app() before
    # Superset is fully initialised (e.g. during unit-test collection).
    from superset.mcp_service.flask_singleton import get_flask_app

    return get_flask_app().app_context()


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
    import functools
    import inspect
    import types

    is_async = inspect.iscoroutinefunction(tool_func)

    # Detect if the original function expects a ctx: Context parameter.
    # If so, we inject it via get_context() at call time.
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
                # Clear any stale thread-local SQLAlchemy session before user lookup.
                # Thread pool workers reuse threads across requests; db.session is
                # scoped by thread (not ContextVar), so a prior request's session may
                # still be bound to a different tenant's DB engine. Removing it here
                # ensures the next DB access creates a fresh session bound to the
                # correct engine for the current request.
                _remove_session_safe()
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

    # Set __signature__ from the original function, removing ctx parameter
    # since FastMCP tools don't expose it to clients.
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

    # Mark this wrapper as protected so a startup assertion can verify every
    # registered tool went through mcp_auth_hook (see issue #39395).
    new_wrapper._mcp_auth_protected = True  # type: ignore[attr-defined]

    return new_wrapper  # type: ignore[return-value]
