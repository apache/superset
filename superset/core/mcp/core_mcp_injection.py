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


def create_tool_decorator(
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

    Supports both @tool and @tool() syntax.

    Args:
        func_or_name: When used as @tool, this will be the function.
                     When used as @tool("name"), this will be the name.
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

            protected_status = "protected" if protect else "public"
            logger.info("Registered MCP tool: %s (%s)", tool_name, protected_status)
            return wrapped_func

        except Exception as e:
            logger.error("Failed to register MCP tool %s: %s", name or func.__name__, e)
            # Return the original function so extension doesn't break
            return func

    # If called as @tool (without parentheses)
    if callable(func_or_name):
        # Type cast is safe here since we've confirmed it's callable
        return decorator(func_or_name)  # type: ignore[arg-type]

    # If called as @tool() or @tool(name="...")
    # func_or_name would be the name parameter or None
    actual_name = func_or_name if isinstance(func_or_name, str) else name

    def parameterized_decorator(func: F) -> F:
        # Use the actual_name if provided via func_or_name
        nonlocal name
        if actual_name is not None:
            name = actual_name
        return decorator(func)

    return parameterized_decorator


def create_prompt_decorator(
    func_or_name: str | Callable[..., Any] | None = None,
    *,
    name: Optional[str] = None,
    title: Optional[str] = None,
    description: Optional[str] = None,
    tags: Optional[set[str]] = None,
    protect: bool = True,
) -> Callable[[F], F] | F:
    """
    Create the concrete MCP prompt decorator implementation.

    This combines FastMCP prompt registration with optional Superset authentication,
    replacing the need for separate @mcp.prompt and @mcp_auth_hook decorators.

    Supports both @prompt and @prompt(...) syntax.

    Args:
        func_or_name: When used as @prompt, this will be the function.
                     When used as @prompt("name"), this will be the name.
        name: Prompt name (defaults to function name)
        title: Prompt title (defaults to function name)
        description: Prompt description (defaults to function docstring)
        tags: Set of tags for categorization
        protect: Whether to apply Superset authentication (defaults to True)

    Returns:
        Decorator that registers and wraps the prompt with optional authentication,
        or the wrapped function when used without parentheses
    """

    def decorator(func: F) -> F:
        try:
            # Import here to avoid circular imports
            from superset.mcp_service.app import mcp

            # Use provided values or extract from function
            prompt_name = name or func.__name__
            prompt_title = title or func.__name__
            prompt_description = description or func.__doc__ or f"Prompt: {prompt_name}"
            prompt_tags = tags or set()

            # Conditionally apply authentication wrapper
            if protect:
                from superset.mcp_service.auth import mcp_auth_hook

                wrapped_func = mcp_auth_hook(func)
            else:
                wrapped_func = func

            # Register prompt with FastMCP using the same pattern as existing code
            mcp.prompt(
                name=prompt_name,
                title=prompt_title,
                description=prompt_description,
                tags=prompt_tags,
            )(wrapped_func)

            protected_status = "protected" if protect else "public"
            logger.info("Registered MCP prompt: %s (%s)", prompt_name, protected_status)
            return wrapped_func

        except Exception as e:
            logger.error(
                "Failed to register MCP prompt %s: %s", name or func.__name__, e
            )
            # Return the original function so extension doesn't break
            return func

    # If called as @prompt (without parentheses)
    if callable(func_or_name):
        # Type cast is safe here since we've confirmed it's callable
        return decorator(func_or_name)  # type: ignore[arg-type]

    # If called as @prompt() or @prompt(name="...")
    # func_or_name would be the name parameter or None
    actual_name = func_or_name if isinstance(func_or_name, str) else name

    def parameterized_decorator(func: F) -> F:
        # Use the actual_name if provided via name_or_fn
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

        # Replace the abstract decorators with concrete implementations
        superset_core.mcp.tool = create_tool_decorator
        superset_core.mcp.prompt = create_prompt_decorator

        logger.info("MCP dependency injection initialized successfully")

    except ImportError as e:
        logger.warning("superset_core not available, skipping MCP injection: %s", e)
    except Exception as e:
        logger.error("Failed to initialize MCP dependencies: %s", e)
        raise
