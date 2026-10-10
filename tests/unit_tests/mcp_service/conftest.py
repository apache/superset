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

from collections.abc import Iterator
from contextvars import Token

import pytest

from superset.mcp_service.auth import _mcp_user_id_var


@pytest.fixture(autouse=True)
def isolate_mcp_user_id_var() -> Iterator[None]:
    """Reset the ``_mcp_user_id_var`` ContextVar around every MCP test.

    ``_setup_user_context()`` sets the var and relies on ``on_call_tool``'s
    ``finally`` to clear it. Tests that call ``_setup_user_context()`` (or set
    the var) directly, without going through the middleware, leave it set in
    the thread's base context, and pytest-asyncio copies that context into
    every later async test's task -- so a resolved user id leaks into
    unrelated tests. In a serial run a middleware-exercising test file that
    sorts between the leaking file and its victim happened to clear the var;
    under pytest-xdist the files land on different workers and the leak
    surfaces as a flake. Scoping the var to each test removes the ordering
    dependence.
    """
    token: Token[int | None] = _mcp_user_id_var.set(None)
    try:
        yield
    finally:
        _mcp_user_id_var.reset(token)


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
