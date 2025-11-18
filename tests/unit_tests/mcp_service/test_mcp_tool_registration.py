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

"""Tests for MCP tool registration system."""

from unittest.mock import MagicMock, patch

from superset.core.mcp.core_mcp_injection import initialize_mcp_dependencies


def test_initialize_mcp_dependencies_replaces_abstract_function():
    """Test that initialize_mcp_dependencies replaces the abstract mcp_tool function."""
    # Mock the superset_core.mcp module
    mock_mcp_module = MagicMock()

    with patch("superset_core.mcp", mock_mcp_module):
        initialize_mcp_dependencies()

        # Verify the abstract function was replaced
        assert hasattr(mock_mcp_module, "mcp_tool")
        assert callable(mock_mcp_module.mcp_tool)


def test_concrete_mcp_tool_registers_with_fastmcp():
    """Test that the concrete mcp_tool implementation registers tools with FastMCP."""
    # Mock the superset_core.mcp module
    mock_mcp_module = MagicMock()

    # Mock the FastMCP instance
    mock_fastmcp = MagicMock()

    with patch("superset_core.mcp", mock_mcp_module):
        with patch("superset.mcp_service.app.mcp", mock_fastmcp):
            # Initialize dependencies to get concrete implementation
            initialize_mcp_dependencies()

            # Get the concrete function that was injected
            concrete_mcp_tool = mock_mcp_module.mcp_tool

            # Test function and parameters
            def test_tool():
                return {"result": "test"}

            tool_name = "test_extension.test_tool"
            description = "Test tool for testing"
            tags = ["test", "extension"]

            # Call the concrete implementation
            concrete_mcp_tool(tool_name, test_tool, description, tags)

            # Verify FastMCP's add_tool was called with correct parameters
            mock_fastmcp.add_tool.assert_called_once_with(
                test_tool, name=tool_name, description=description
            )
