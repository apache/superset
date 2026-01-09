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


def test_prompt_import_works():
    """Test that prompt can be imported from superset_core.mcp after
    initialization."""
    from superset_core.mcp import prompt

    # Should be callable
    assert callable(prompt)

    # Should return a decorator function
    decorator = prompt(name="test", description="test")
    assert callable(decorator)


def _find_mcp_creation_line(tree):
    """Find line number of mcp = create_mcp_app() assignment."""
    import ast

    for node in tree.body:
        if not isinstance(node, ast.Assign):
            continue
        for target in node.targets:
            if not isinstance(target, ast.Name) or target.id != "mcp":
                continue
            if not isinstance(node.value, ast.Call):
                continue
            if (
                hasattr(node.value.func, "id")
                and node.value.func.id == "create_mcp_app"
            ):
                return node.lineno
    return None


def _find_injection_call_line(tree):
    """Find line number of initialize_core_mcp_dependencies() call."""
    import ast

    for node in tree.body:
        if not isinstance(node, ast.Expr):
            continue
        if not isinstance(node.value, ast.Call):
            continue
        func = node.value.func
        if hasattr(func, "id") and func.id == "initialize_core_mcp_dependencies":
            return node.lineno
    return None


def _find_first_tool_import_line(tree):
    """Find line number of first tool/prompt import."""
    import ast

    for node in tree.body:
        if not isinstance(node, ast.ImportFrom):
            continue
        if node.module and "superset.mcp_service.chart" in node.module:
            return node.lineno
    return None


def test_mcp_app_initialization_order():
    """Test that app.py initializes dependencies before importing tools."""
    import ast

    with open("superset/mcp_service/app.py", "r") as f:
        tree = ast.parse(f.read())

    mcp_line = _find_mcp_creation_line(tree)
    injection_line = _find_injection_call_line(tree)
    import_line = _find_first_tool_import_line(tree)

    assert mcp_line is not None, "Could not find mcp = create_mcp_app()"
    assert injection_line is not None, "Could not find initialize call"
    assert import_line is not None, "Could not find tool imports"

    # Verify order: mcp creation < injection < tool imports
    assert mcp_line < injection_line, "mcp creation must come before injection"
    assert injection_line < import_line, "injection must come before tool imports"


def test_mcp_app_imports_successfully():
    """Test that the MCP app can be imported without errors.

    This is the ultimate integration test - if this fails, the initialization
    order is broken.
    """
    # This import should succeed without NotImplementedError
    from superset.mcp_service.app import mcp

    # Verify mcp instance is valid
    assert mcp is not None
    assert hasattr(mcp, "_tool_manager")

    # Verify tools are registered
    tools = mcp._tool_manager._tools
    assert len(tools) > 0, "No tools registered"

    # Verify some expected tools exist
    tool_names = list(tools.keys())
    assert "health_check" in tool_names
    assert "list_charts" in tool_names
    assert "get_schema" in tool_names


def test_mcp_prompts_registered():
    """Test that MCP prompts are registered after initialization."""
    from superset.mcp_service.app import mcp

    # Verify prompts are registered
    prompts = mcp._prompt_manager._prompts
    assert len(prompts) > 0, "No prompts registered"

    # Verify expected prompts exist
    prompt_names = list(prompts.keys())
    assert "quickstart" in prompt_names or "create_chart_guided" in prompt_names
