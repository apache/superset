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

"""Tests for MCP decorators in BUILD mode."""

from superset_core.extensions.context import get_context, RegistrationMode
from superset_core.mcp import prompt, tool


def test_tool_decorator_stores_metadata_in_build_mode():
    """Test that @tool decorator stores metadata when in BUILD mode."""
    ctx = get_context()
    ctx.set_mode(RegistrationMode.BUILD)

    try:

        @tool(tags=["database"])
        def test_query_tool(sql: str) -> dict:
            """Execute a SQL query."""
            return {"result": "test"}

        # Should have metadata attached
        assert hasattr(test_query_tool, "__tool_metadata__")
        meta = test_query_tool.__tool_metadata__
        assert meta.id == "test_query_tool"
        assert meta.name == "test_query_tool"
        assert meta.description == "Execute a SQL query."
        assert meta.tags == ["database"]
        assert meta.protect is True
        assert "test_query_tool" in meta.module

    finally:
        ctx.set_mode(RegistrationMode.HOST)


def test_tool_decorator_with_custom_metadata():
    """Test @tool decorator with custom name and description."""
    ctx = get_context()
    ctx.set_mode(RegistrationMode.BUILD)

    try:

        @tool(
            name="Custom Tool",
            description="Custom description",
            tags=["test"],
            protect=False,
        )
        def my_tool() -> str:
            """Original docstring."""
            return "test"

        meta = my_tool.__tool_metadata__
        assert meta.id == "my_tool"
        assert meta.name == "Custom Tool"
        assert meta.description == "Custom description"
        assert meta.tags == ["test"]
        assert meta.protect is False

    finally:
        ctx.set_mode(RegistrationMode.HOST)


def test_prompt_decorator_stores_metadata_in_build_mode():
    """Test that @prompt decorator stores metadata when in BUILD mode."""
    ctx = get_context()
    ctx.set_mode(RegistrationMode.BUILD)

    try:

        @prompt(tags=["analysis"])
        async def test_prompt(ctx, dataset: str) -> str:
            """Generate analysis for a dataset."""
            return f"Analyze {dataset}"

        # Should have metadata attached
        assert hasattr(test_prompt, "__prompt_metadata__")
        meta = test_prompt.__prompt_metadata__
        assert meta.id == "test_prompt"
        assert meta.name == "test_prompt"
        assert meta.description == "Generate analysis for a dataset."
        assert meta.tags == ["analysis"]
        assert meta.protect is True
        assert "test_prompt" in meta.module

    finally:
        ctx.set_mode(RegistrationMode.HOST)


def test_prompt_decorator_with_custom_metadata():
    """Test @prompt decorator with custom metadata."""
    ctx = get_context()
    ctx.set_mode(RegistrationMode.BUILD)

    try:

        @prompt(
            name="Custom Prompt",
            title="Custom Title",
            description="Custom description",
            tags=["custom"],
            protect=False,
        )
        async def my_prompt(ctx) -> str:
            """Original docstring."""
            return "test"

        meta = my_prompt.__prompt_metadata__
        assert meta.id == "my_prompt"
        assert meta.name == "Custom Prompt"
        assert meta.title == "Custom Title"
        assert meta.description == "Custom description"
        assert meta.tags == ["custom"]
        assert meta.protect is False

    finally:
        ctx.set_mode(RegistrationMode.HOST)


def test_decorators_do_not_register_in_build_mode():
    """Test that decorators don't attempt registration in BUILD mode."""
    ctx = get_context()
    ctx.set_mode(RegistrationMode.BUILD)

    try:
        # This should not raise an exception even though no MCP server is available
        @tool(tags=["test"])
        def build_mode_tool() -> str:
            return "test"

        @prompt(tags=["test"])
        async def build_mode_prompt(ctx) -> str:
            return "test"

        # Both should have metadata
        assert hasattr(build_mode_tool, "__tool_metadata__")
        assert hasattr(build_mode_prompt, "__prompt_metadata__")

    finally:
        ctx.set_mode(RegistrationMode.HOST)
