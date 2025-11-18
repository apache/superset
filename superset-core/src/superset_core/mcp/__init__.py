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

This module provides an interface for extensions to register MCP
tools with the host application.

Usage:
    from superset_core.mcp import mcp_tool

    @mcp_tool(
        name="my_extension.my_extension_tool",
        description="Custom business logic from my extension",
        tags=["extension", "custom"]
    )
    async def my_extension_tool(ctx: Context) -> dict:
        return {"message": "Hello from my extension!"}
"""

from typing import Any, Callable

from .types import MCPToolDefinition


def mcp_tool(
    name: str,
    func: Callable[..., Any],
    description: str,
    tags: list[str],
) -> None:
    """
    Register an MCP tool with the host application.

    This function will be replaced by the host implementation during initialization
    with a concrete implementation providing actual functionality.

    Args:
        name: Unique name for the MCP tool
        func: Function that implements the tool logic
        description: Human-readable description of the tool's purpose
        tags: List of tags for categorizing the tool

    Raises:
        NotImplementedError: If called before host implementation is initialized

    Example:
        @mcp_tool(
            name="my_extension.my_custom_tool",
            description="Does something useful",
            tags=["extension", "utility"]
        )
        async def my_custom_tool(ctx: Context) -> dict:
            return {"result": "success"}
    """
    raise NotImplementedError("Function will be replaced during initialization")


__all__ = [
    "MCPToolDefinition",
    "mcp_tool",
]
