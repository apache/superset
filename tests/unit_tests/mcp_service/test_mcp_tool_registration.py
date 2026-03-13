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

"""Test MCP app imports and tool/prompt registration."""

import asyncio


def _run(coro):
    """Run an async coroutine synchronously."""
    return asyncio.run(coro)


def test_mcp_app_imports_successfully():
    """Test that the MCP app can be imported without errors."""
    from superset.mcp_service.app import mcp

    assert mcp is not None

    tools = _run(mcp.list_tools())
    tool_names = [t.name for t in tools]
    assert len(tool_names) > 0
    assert "health_check" in tool_names
    assert "list_charts" in tool_names


def test_mcp_prompts_registered():
    """Test that MCP prompts are registered."""
    from superset.mcp_service.app import mcp

    prompts = _run(mcp.list_prompts())
    assert len(prompts) > 0


def test_mcp_resources_registered():
    """Test that MCP resources are registered.

    Resources are registered via @mcp.resource() decorators in resource files.
    They require __init__.py in parent packages for find_packages() to include
    them in distributions. This test ensures all expected resources are found.
    """
    from superset.mcp_service.app import mcp

    resources = _run(mcp.list_resources())
    assert len(resources) > 0, "No MCP resources registered"

    resource_uris = {str(r.uri) for r in resources}
    assert "chart://configs" in resource_uris, (
        "chart://configs resource not registered - "
        "check superset/mcp_service/chart/__init__.py exists"
    )
    assert "instance://metadata" in resource_uris, (
        "instance://metadata resource not registered - "
        "check superset/mcp_service/system/resources/ imports"
    )


def test_mcp_packages_discoverable_by_setuptools():
    """Test that all MCP sub-packages have __init__.py for setuptools.

    setuptools.find_packages() only discovers directories with __init__.py.
    Without __init__.py, sub-packages (tool, resources, prompts) are excluded
    from built distributions, causing missing module errors in deployments.
    """
    from pathlib import Path

    mcp_root = Path(__file__).parents[3] / "superset" / "mcp_service"
    assert mcp_root.is_dir(), f"MCP service root not found: {mcp_root}"

    # All immediate sub-directories that contain Python files should be packages
    missing = []
    for subdir in sorted(mcp_root.iterdir()):
        if not subdir.is_dir() or subdir.name.startswith(("_", ".")):
            continue
        # Check if it has any .py files in it or its subdirectories
        has_py = any(subdir.rglob("*.py"))
        if has_py and not (subdir / "__init__.py").exists():
            missing.append(subdir.name)

    assert not missing, (
        f"MCP sub-packages missing __init__.py (will be excluded from "
        f"setuptools distributions): {missing}"
    )
