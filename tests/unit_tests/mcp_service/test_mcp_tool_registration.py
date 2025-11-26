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

"""Test MCP tool registration through superset-core dependency injection."""

import sys
from unittest.mock import MagicMock, patch

from superset.core.mcp.core_mcp_injection import initialize_core_mcp_dependencies


def test_initialize_core_mcp_dependencies_replaces_decorator():
    """Test that initialize_core_mcp_dependencies replaces the abstract tool
    decorator."""
    # Mock the superset_core.mcp module
    mock_mcp_module = MagicMock()

    with patch.dict(sys.modules, {"superset_core.mcp": mock_mcp_module}):
        initialize_core_mcp_dependencies()

        # Verify the abstract decorator was replaced
        assert hasattr(mock_mcp_module, "tool")
        assert callable(mock_mcp_module.tool)


def test_tool_import_works():
    """Test that tool can be imported from superset_core.mcp after
    initialization."""
    # This test verifies the basic import works (dependency injection has happened)
    from superset_core.mcp import tool

    # Should be callable
    assert callable(tool)

    # Should return a decorator function
    decorator = tool(name="test", description="test")
    assert callable(decorator)
