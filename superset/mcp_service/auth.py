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

    The user should already be set by WorkspaceContextMiddleware.
    This function validates that authentication succeeded.
    """
    # Check if user was set by middleware
    if not hasattr(g, "user") or g.user is None:
        raise ValueError(
            "User not authenticated. This tool requires authentication via JWT token."
        )

    user = g.user

    # Validate user is properly loaded with relationships
    if not hasattr(user, "roles"):
        logger.warning("User object missing 'roles' relationship")

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


def mcp_auth_hook(tool_func: F) -> F:
    """
    Authentication and authorization decorator for MCP tools.

    This decorator assumes Flask application context and g.user
    have already been set by WorkspaceContextMiddleware.

    TODO (future PR): Add permission checking
    TODO (future PR): Add JWT scope validation
    TODO (future PR): Add comprehensive audit logging
    """
    import functools

    @functools.wraps(tool_func)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        from superset.extensions import db

        # Get user from g (already set by middleware)
        user = get_user_from_request()

        # Validate user has necessary relationships loaded
        # (Force access to ensure they're loaded if lazy)
        _ = user.roles
        if hasattr(user, "groups"):
            _ = user.groups

        try:
            # TODO: Add permission checks here in future PR
            # TODO: Add audit logging here in future PR

            logger.debug(
                "MCP tool call: user=%s, tool=%s", user.username, tool_func.__name__
            )

            result = tool_func(*args, **kwargs)

            return result

        except Exception:
            # On error, rollback and cleanup session
            # pylint: disable=consider-using-transaction
            try:
                db.session.rollback()
                db.session.remove()
            except Exception as e:
                logger.warning("Error cleaning up session after exception: %s", e)
            raise

        finally:
            # Only rollback if session is still active (no exception occurred)
            # Do NOT call remove() on success to avoid detaching user
            try:
                if db.session.is_active:
                    # pylint: disable=consider-using-transaction
                    db.session.rollback()
            except Exception as e:
                logger.warning("Error in finally block: %s", e)

    return wrapper  # type: ignore[return-value]
