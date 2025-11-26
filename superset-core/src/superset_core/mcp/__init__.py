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
MCP (Model Context Protocol) tool registration for Superset MCP server.

This module provides a decorator interface to register MCP tools with the
host application.

Usage:
    from superset_core.mcp import tool

    @tool(name="my_tool", description="Custom business logic", tags=["extension"])
    def my_extension_tool(param: str) -> dict:
        return {"message": f"Hello {param}!"}

    # Or use function name and docstring:
    @tool
    def another_tool(value: int) -> str:
        '''Tool description from docstring'''
        return str(value * 2)
"""

from typing import Any, Callable, TypeVar

# Type variable for decorated functions
F = TypeVar("F", bound=Callable[..., Any])


def tool(
    func_or_name: str | Callable[..., Any] | None = None,
    *,
    name: str | None = None,
    description: str | None = None,
    tags: list[str] | None = None,
    protect: bool = True,
) -> Any:  # Use Any to avoid mypy issues with dependency injection
    """
    Decorator to register an MCP tool with optional authentication.

    This decorator combines FastMCP tool registration with optional authentication.

    Can be used as:
        @tool
        def my_tool(): ...

    Or:
        @tool(name="custom_name", protect=False)
        def my_tool(): ...

    Args:
        func_or_name: When used as @tool, this will be the function.
                     When used as @tool("name"), this will be the name.
        name: Tool name (defaults to function name, prefixed with extension ID)
        description: Tool description (defaults to function docstring)
        tags: List of tags for categorizing the tool (defaults to empty list)
        protect: Whether to require Superset authentication (defaults to True)

    Returns:
        Decorator function that registers and wraps the tool, or the wrapped function

    Raises:
        NotImplementedError: If called before host implementation is initialized

    Example:
        @tool(name="my_tool", description="Does something useful", tags=["utility"])
        def my_custom_tool(param: str) -> dict:
            return {"result": param}

        @tool  # Uses function name and docstring with auth
        def simple_tool(value: int) -> str:
            '''Doubles the input value'''
            return str(value * 2)

        @tool(protect=False)  # No authentication required
        def public_tool() -> str:
            '''Public tool accessible without auth'''
            return "Hello world"
    """
    raise NotImplementedError(
        "MCP tool decorator not initialized. "
        "This decorator should be replaced during Superset startup."
    )


def prompt(
    func_or_name: str | Callable[..., Any] | None = None,
    *,
    name: str | None = None,
    title: str | None = None,
    description: str | None = None,
    tags: set[str] | None = None,
    protect: bool = True,
) -> Any:  # Use Any to avoid mypy issues with dependency injection
    """
    Decorator to register an MCP prompt with optional authentication.

    This decorator combines FastMCP prompt registration with optional authentication.

    Can be used as:
        @prompt
        async def my_prompt_handler(): ...

    Or:
        @prompt("my_prompt")
        async def my_prompt_handler(): ...

    Or:
        @prompt("my_prompt", protected=False, title="Custom Title")
        async def my_prompt_handler(): ...

    Args:
        func_or_name: When used as @prompt, this will be the function.
                     When used as @prompt("name"), this will be the name.
        name: Prompt name (defaults to function name if not provided)
        title: Prompt title (defaults to function name)
        description: Prompt description (defaults to function docstring)
        tags: Set of tags for categorizing the prompt
        protect: Whether to require Superset authentication (defaults to True)

    Returns:
        Decorator function that registers and wraps the prompt, or the wrapped function

    Raises:
        NotImplementedError: If called before host implementation is initialized

    Example:
        @prompt
        async def my_prompt_handler(ctx: Context) -> str:
            '''Interactive prompt for doing something.'''
            return "Prompt instructions here..."

        @prompt("custom_prompt", protect=False, title="Custom Title")
        async def public_prompt_handler(ctx: Context) -> str:
            '''Public prompt accessible without auth'''
            return "Public prompt accessible without auth"
    """
    raise NotImplementedError(
        "MCP prompt decorator not initialized. "
        "This decorator should be replaced during Superset startup."
    )


__all__ = [
    "tool",
    "prompt",
]
