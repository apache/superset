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
MCP dependency injection implementation.

This module provides the concrete implementation of MCP abstractions
that replaces the abstract functions in superset-core during initialization.
"""

import logging
from typing import Any, Callable, Optional, TypeVar

# Type variable for decorated functions
F = TypeVar("F", bound=Callable[..., Any])

logger = logging.getLogger(__name__)


def create_mcp_tool_decorator(
    func_or_name: str | Callable[..., Any] | None = None,
    *,
    name: Optional[str] = None,
    description: Optional[str] = None,
    tags: Optional[list[str]] = None,
    protect: bool = True,
) -> Callable[[F], F] | F:
    """
    Create the concrete MCP tool decorator implementation.

    This combines FastMCP tool registration with optional Superset authentication,
    replacing the need for separate @mcp.tool and @mcp_auth_hook decorators.

    Supports both @mcp_tool and @mcp_tool() syntax.

    Args:
        func_or_name: When used as @mcp_tool, this will be the function.
                     When used as @mcp_tool("name"), this will be the name.
        name: Tool name (defaults to function name)
        description: Tool description (defaults to function docstring)
        tags: List of tags for categorization (defaults to empty list)
        protect: Whether to apply Superset authentication (defaults to True)

    Returns:
        Decorator that registers and wraps the tool with optional authentication,
        or the wrapped function when used without parentheses
    """

    def decorator(func: F) -> F:
        try:
            # Import here to avoid circular imports
            from superset.mcp_service.app import mcp

            # Use provided values or extract from function
            tool_name = name or func.__name__
            tool_description = description or func.__doc__ or f"Tool: {tool_name}"
            tool_tags = tags or []

            # Conditionally apply authentication wrapper
            if protect:
                from superset.mcp_service.auth import mcp_auth_hook

                wrapped_func = mcp_auth_hook(func)
            else:
                wrapped_func = func

            from fastmcp.tools import Tool

            tool = Tool.from_function(
                wrapped_func,
                name=tool_name,
                description=tool_description,
                tags=tool_tags,
            )
            mcp.add_tool(tool)

            auth_status = "with auth" if protect else "without auth"
            logger.info("Registered MCP tool: %s (%s)", tool_name, auth_status)
            return wrapped_func

        except Exception as e:
            logger.error("Failed to register MCP tool %s: %s", name or func.__name__, e)
            # Return the original function so extension doesn't break
            return func

    # If called as @mcp_tool (without parentheses)
    if callable(func_or_name):
        # Type cast is safe here since we've confirmed it's callable
        return decorator(func_or_name)  # type: ignore[arg-type]

    # If called as @mcp_tool() or @mcp_tool(name="...")
    # func_or_name would be the name parameter or None
    actual_name = func_or_name if isinstance(func_or_name, str) else name

    def parameterized_decorator(func: F) -> F:
        # Use the actual_name if provided via func_or_name
        nonlocal name
        if actual_name is not None:
            name = actual_name
        return decorator(func)

    return parameterized_decorator


def initialize_core_mcp_dependencies() -> None:
    """
    Initialize MCP dependency injection by replacing abstract functions
    in superset_core.mcp with concrete implementations.
    """
    try:
        import superset_core.mcp

        # Replace the abstract mcp_tool decorator with concrete implementation
        superset_core.mcp.mcp_tool = create_mcp_tool_decorator

        logger.info("MCP dependency injection initialized successfully")

    except ImportError as e:
        logger.warning("superset_core not available, skipping MCP injection: %s", e)
    except Exception as e:
        logger.error("Failed to initialize MCP dependencies: %s", e)
        raise
