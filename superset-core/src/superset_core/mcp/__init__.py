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
MCP (Model Context Protocol) tool registration for Superset extensions.

This module provides a decorator interface for extensions to register MCP
tools with the host application, combining FastMCP registration with authentication.

Usage:
    from superset_core.mcp import mcp_tool

    @mcp_tool(name="my_tool", description="Custom business logic", tags=["extension"])
    def my_extension_tool(param: str) -> dict:
        return {"message": f"Hello {param}!"}

    # Or use function name and docstring:
    @mcp_tool()
    def another_tool(value: int) -> str:
        '''Tool description from docstring'''
        return str(value * 2)
"""

from typing import Any, Callable, Optional, TypeVar

# Type variable for decorated functions
F = TypeVar("F", bound=Callable[..., Any])


def mcp_tool(
    name: Optional[str] = None,
    description: Optional[str] = None,
    tags: Optional[list[str]] = None,
) -> Callable[[F], F]:
    """
    Decorator to register an MCP tool with authentication.

    This decorator combines FastMCP tool registration with Superset authentication.

    Args:
        name: Tool name (defaults to function name, prefixed with extension ID)
        description: Tool description (defaults to function docstring)
        tags: List of tags for categorizing the tool (defaults to empty list)

    Returns:
        Decorator function that registers and wraps the tool

    Raises:
        NotImplementedError: If called before host implementation is initialized

    Example:
        @mcp_tool(name="my_tool", description="Does something useful", tags=["utility"])
        def my_custom_tool(param: str) -> dict:
            return {"result": param}

        @mcp_tool()  # Uses function name and docstring
        def simple_tool(value: int) -> str:
            '''Doubles the input value'''
            return str(value * 2)
    """

    def decorator(func: F) -> F:
        raise NotImplementedError(
            "MCP tool decorator not initialized. "
            "This decorator should be replaced during Superset startup."
        )

    return decorator


__all__ = [
    "mcp_tool",
]
