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

Tool imports are handled by app.py, not here.
"""

from unittest.mock import patch

import pytest


@pytest.fixture(autouse=True)
def mock_rbac_permission_check():
    """Allow all RBAC permission checks in MCP integration tests.

    The RBAC permission logic is tested directly in test_auth_rbac.py,
    which imports check_tool_permission and calls it without going
    through mcp_auth_hook. This fixture patches the module-level name
    so that mcp_auth_hook (same module) sees the mock, while direct
    imports in test_auth_rbac.py still reference the real function.
    """
    with patch("superset.mcp_service.auth.check_tool_permission", return_value=True):
        yield
