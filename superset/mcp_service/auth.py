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


import logging

from flask import current_app, g
from flask_login import AnonymousUserMixin
from superset.extensions import security_manager

logger = logging.getLogger(__name__)


def get_user_from_request():
    """
    Extract user info from the request context (e.g., from Bearer token, headers, etc.).
    By default, returns admin user. Override for OIDC/OAuth/Okta integration.
    """
    from flask import current_app
    from superset.extensions import security_manager
    admin_username = current_app.config.get("MCP_ADMIN_USERNAME", "admin")
    return security_manager.get_user_by_username(admin_username)


def impersonate_user(user, run_as=None):
    """
    Optionally impersonate another user if allowed. By default, returns the same user.
    Override to enforce impersonation rules.
    """
    return user


def has_permission(user, tool_func):
    """
    Check if the user has permission to run the tool. By default, always True.
    Override for RBAC.
    """
    return True


def log_access(user, tool_name, args, kwargs):
    """
    Log access/action for observability/audit. By default, does nothing.
    Override to log to your system.
    """
    pass


def mcp_auth_hook(tool_func):
    """
    Decorator for MCP tool functions to enforce auth, impersonation, RBAC, and logging.
    Also sets up Flask user context (g.user) for downstream DAO/model code.
    All logic is overridable for enterprise integration.
    """
    import functools
    @functools.wraps(tool_func)
    def wrapper(*args, **kwargs):
        # --- Setup user context (was _setup_user_context) ---
        admin_username = current_app.config.get("MCP_ADMIN_USERNAME", "admin")
        admin_user = security_manager.get_user_by_username(admin_username)
        if not admin_user:
            g.user = AnonymousUserMixin()
        else:
            g.user = admin_user
        # --- End user context setup ---

        user = get_user_from_request()
        run_as = kwargs.get("run_as")
        if run_as:
            user = impersonate_user(user, run_as)
        if not has_permission(user, tool_func):
            raise PermissionError(
                f"User {getattr(user, 'username', user)} not authorized for "
                f"{tool_func.__name__}")
        log_access(user, tool_func.__name__, args, kwargs)
        return tool_func(*args, **kwargs)

    return wrapper
