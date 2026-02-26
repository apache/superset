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
Tests for backend contributions discovery.
"""

from __future__ import annotations

import tempfile
from pathlib import Path

import pytest
from superset_extensions_cli.cli import discover_backend_contributions


@pytest.mark.unit
def test_discover_backend_contributions_finds_tools():
    """Test that discover_backend_contributions finds @tool decorated functions."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)

        # Create a Python file with decorated functions
        backend_file = tmpdir_path / "backend.py"
        backend_code = '''
from superset_core.mcp import tool, prompt
from superset_core.api.rest_api import RestApi, extension_api


@tool(tags=["database"], description="Query the database")
def query_database(sql: str) -> dict:
    """Execute a SQL query against the database."""
    return {"result": "success"}


@tool(name="custom_tool", protect=False)
def my_custom_tool():
    """A custom tool with specific configuration."""
    return {"custom": True}


@prompt(tags={"analysis"}, title="Data Analysis")
async def analyze_data(ctx, dataset: str) -> str:
    """Generate analysis for a dataset."""
    return f"Analysis for {dataset}"


@extension_api(id="test_api", name="Test API")
class TestAPI(RestApi):
    """Test API for the extension."""

    def get_data(self):
        return self.response(200, result={})
'''
        backend_file.write_text(backend_code)

        # Run discovery
        contributions = discover_backend_contributions(tmpdir_path, ["*.py"])

        # Verify tools were discovered
        assert len(contributions.mcp_tools) == 2

        # Check first tool
        tool1 = contributions.mcp_tools[0]
        assert tool1.id == "query_database"
        assert tool1.name == "query_database"
        assert tool1.description == "Execute a SQL query against the database."
        assert tool1.tags == ["database"]
        assert tool1.protect is True
        assert tool1.module == "backend.query_database"

        # Check second tool
        tool2 = contributions.mcp_tools[1]
        assert tool2.id == "my_custom_tool"
        assert tool2.name == "custom_tool"
        assert tool2.description == "A custom tool with specific configuration."
        assert tool2.tags == []
        assert tool2.protect is False
        assert tool2.module == "backend.my_custom_tool"

        # Verify prompt was discovered
        assert len(contributions.mcp_prompts) == 1

        prompt1 = contributions.mcp_prompts[0]
        assert prompt1.id == "analyze_data"
        assert prompt1.name == "analyze_data"
        assert prompt1.title == "Data Analysis"
        assert prompt1.description == "Generate analysis for a dataset."
        assert prompt1.tags == {"analysis"}
        assert prompt1.protect is True
        assert prompt1.module == "backend.analyze_data"

        # Verify REST API was discovered
        assert len(contributions.rest_apis) == 1

        api1 = contributions.rest_apis[0]
        assert api1.id == "test_api"
        assert api1.name == "Test API"
        assert api1.description == "Test API for the extension."
        assert api1.basePath == "/test_api"
        assert api1.module == "backend.TestAPI"

        # Verify auto-inferred Flask-AppBuilder fields
        assert api1.resourceName == "test_api"  # defaults to id.lower()
        assert api1.openapiSpecTag == "Test API"  # defaults to name
        assert api1.classPermissionName == "test_api"  # defaults to resource_name


@pytest.mark.unit
def test_discover_backend_contributions_handles_empty_directory():
    """Test that discovery handles directories with no Python files."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)

        # Create a non-Python file
        (tmpdir_path / "readme.txt").write_text("This is not Python")

        contributions = discover_backend_contributions(tmpdir_path, ["*.py"])

        assert len(contributions.mcp_tools) == 0
        assert len(contributions.mcp_prompts) == 0
        assert len(contributions.rest_apis) == 0


@pytest.mark.unit
def test_discover_backend_contributions_handles_syntax_errors():
    """Test that discovery handles Python files with syntax errors gracefully."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)

        # Create a Python file with syntax error
        bad_file = tmpdir_path / "bad.py"
        bad_file.write_text("def broken_function(\n  # missing closing parenthesis")

        # Create a good file with contributions
        good_file = tmpdir_path / "good.py"
        good_code = '''
from superset_core.mcp import tool

@tool
def working_tool():
    """This tool should be discovered."""
    return {}
'''
        good_file.write_text(good_code)

        contributions = discover_backend_contributions(tmpdir_path, ["*.py"])

        # Should discover the working tool despite the syntax error in other file
        assert len(contributions.mcp_tools) == 1
        assert contributions.mcp_tools[0].id == "working_tool"


@pytest.mark.unit
def test_discover_backend_contributions_skips_private_functions():
    """Test that discovery skips functions starting with underscore."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)

        backend_file = tmpdir_path / "backend.py"
        backend_code = '''
from superset_core.mcp import tool

@tool
def public_tool():
    """This should be discovered."""
    return {}

@tool
def _private_tool():
    """This should be skipped."""
    return {}
'''
        backend_file.write_text(backend_code)

        contributions = discover_backend_contributions(tmpdir_path, ["*.py"])

        # Should only find the public tool
        assert len(contributions.mcp_tools) == 1
        assert contributions.mcp_tools[0].id == "public_tool"


@pytest.mark.unit
def test_discover_backend_contributions_uses_file_patterns():
    """Test that discovery respects file patterns."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)

        # Create files in different subdirectories
        src_dir = tmpdir_path / "src"
        src_dir.mkdir()
        tests_dir = tmpdir_path / "tests"
        tests_dir.mkdir()

        src_file = src_dir / "tools.py"
        src_code = '''
from superset_core.mcp import tool

@tool
def src_tool():
    """Tool from src directory."""
    return {}
'''
        src_file.write_text(src_code)

        test_file = tests_dir / "test_tools.py"
        test_code = '''
from superset_core.mcp import tool

@tool
def test_tool():
    """Tool from tests directory."""
    return {}
'''
        test_file.write_text(test_code)

        # Only search in src directory
        contributions = discover_backend_contributions(tmpdir_path, ["src/**/*.py"])

        # Should only find the src tool
        assert len(contributions.mcp_tools) == 1
        assert contributions.mcp_tools[0].id == "src_tool"
