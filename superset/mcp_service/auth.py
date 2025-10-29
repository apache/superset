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
from typing import Any, Callable, TypeVar

from flask import g
from flask_appbuilder.security.sqla.models import User

# Type variable for decorated functions
F = TypeVar("F", bound=Callable[..., Any])

logger = logging.getLogger(__name__)


def get_user_from_request() -> User:
    """
    Get the current user for the MCP tool request.

    TODO (future PR): Add JWT token extraction and validation.
    TODO (future PR): Add user impersonation support.

    For now, this uses MCP_DEV_USERNAME from configuration for development.

    Raises:
        ValueError: If MCP_DEV_USERNAME is not configured or user doesn't exist
    """
    from flask import current_app

    from superset import security_manager

    # TODO: Extract from JWT token once authentication is implemented
    # For now, use MCP_DEV_USERNAME from configuration
    username = current_app.config.get("MCP_DEV_USERNAME")

    if not username:
        raise ValueError("Username not configured")

    user = security_manager.find_user(username)

    if not user:
        raise ValueError(f"User '{username}' not found")

    return user


def mcp_auth_hook(tool_func: F) -> F:
    """
    Authentication and authorization decorator for MCP tools.

    This is a minimal implementation that:
    1. Gets the current user
    2. Sets g.user for Flask context

    TODO (future PR): Add permission checking
    TODO (future PR): Add JWT scope validation
    TODO (future PR): Add comprehensive audit logging
    TODO (future PR): Add rate limiting integration
    """
    import functools

    @functools.wraps(tool_func)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        # Get user and set Flask context
        user = get_user_from_request()
        g.user = user

        # TODO: Add permission checks here in future PR
        # TODO: Add audit logging here in future PR

        logger.debug(
            "MCP tool call: user=%s, tool=%s", user.username, tool_func.__name__
        )

        return tool_func(*args, **kwargs)

    return wrapper  # type: ignore[return-value]
