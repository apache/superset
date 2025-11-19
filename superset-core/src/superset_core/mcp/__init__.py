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
    from superset_core.mcp import mcp_tool

    @mcp_tool(name="my_tool", description="Custom business logic", tags=["extension"])
    def my_extension_tool(param: str) -> dict:
        return {"message": f"Hello {param}!"}

    # Or use function name and docstring:
    @mcp_tool
    def another_tool(value: int) -> str:
        '''Tool description from docstring'''
        return str(value * 2)
"""

from typing import Any, Callable, TypeVar

# Type variable for decorated functions
F = TypeVar("F", bound=Callable[..., Any])


def mcp_tool(
    func_or_name: str | Callable[..., Any] | None = None,
    *,
    name: str | None = None,
    description: str | None = None,
    tags: list[str] | None = None,
    secure: bool = True,
) -> Callable[[F], F] | F:
    """
    Decorator to register an MCP tool with optional authentication.

    This decorator combines FastMCP tool registration with optional authentication.

    Can be used as:
        @mcp_tool
        def my_tool(): ...

    Or:
        @mcp_tool(name="custom_name", secure=False)
        def my_tool(): ...

    Args:
        func_or_name: When used as @mcp_tool, this will be the function.
                     When used as @mcp_tool("name"), this will be the name.
        name: Tool name (defaults to function name, prefixed with extension ID)
        description: Tool description (defaults to function docstring)
        tags: List of tags for categorizing the tool (defaults to empty list)
        secure: Whether to require Superset authentication (defaults to True)

    Returns:
        Decorator function that registers and wraps the tool, or the wrapped function

    Raises:
        NotImplementedError: If called before host implementation is initialized

    Example:
        @mcp_tool(name="my_tool", description="Does something useful", tags=["utility"])
        def my_custom_tool(param: str) -> dict:
            return {"result": param}

        @mcp_tool  # Uses function name and docstring with auth
        def simple_tool(value: int) -> str:
            '''Doubles the input value'''
            return str(value * 2)

        @mcp_tool(secure=False)  # No authentication required
        def public_tool() -> str:
            '''Public tool accessible without auth'''
            return "Hello world"
    """

    def decorator(func: F) -> F:
        raise NotImplementedError(
            "MCP tool decorator not initialized. "
            "This decorator should be replaced during Superset startup."
        )

    # If called as @mcp_tool (without parentheses)
    if callable(func_or_name):
        # Type cast is safe here since we've confirmed it's callable
        return decorator(func_or_name)  # type: ignore[arg-type]

    # If called as @mcp_tool() or @mcp_tool(name="...")
    return decorator


__all__ = [
    "mcp_tool",
]
