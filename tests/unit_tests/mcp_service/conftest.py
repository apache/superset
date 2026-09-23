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
MCP service test configuration.

Disables RBAC permission checks for integration tests.
RBAC logic is tested directly in test_auth_rbac.py.
"""

import pytest


@pytest.fixture(autouse=True)
def disable_mcp_rbac(app):
    """Disable RBAC permission checks for MCP integration tests.

    The RBAC permission logic is tested directly in test_auth_rbac.py.
    Integration tests use mock users that do not have real FAB roles,
    so we disable RBAC to let them exercise tool logic.
    """
    app.config["MCP_RBAC_ENABLED"] = False
    yield
    app.config.pop("MCP_RBAC_ENABLED", None)


@pytest.fixture(autouse=True)
def reset_mcp_user_id_var():
    """Reset _mcp_user_id_var around every test in this directory.

    _mcp_user_id_var is a module-level ContextVar that intentionally
    survives past the per-call Flask app context (see auth.py) so it can
    carry a resolved user id to middleware after the context pops. That
    means a test which sets it (directly, or indirectly via
    _setup_user_context()/mcp_auth_hook) but doesn't reset it leaks the
    value into whichever test runs next on the same thread -- e.g. a mock
    user without a numeric `.id` leaks a MagicMock into a later test that
    asserts a real integer user_id.
    """
    from superset.mcp_service.auth import _mcp_user_id_var

    token = _mcp_user_id_var.set(None)
    yield
    _mcp_user_id_var.reset(token)
