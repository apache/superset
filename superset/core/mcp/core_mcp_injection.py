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
from typing import Any, Callable, cast, Optional, TypeVar

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
    class_permission_name: Optional[str] = None,
    method_permission_name: Optional[str] = None,
) -> Callable[[F], F] | F:
    """
    Create the concrete MCP tool decorator implementation.

    This combines FastMCP tool registration with optional Superset authentication
    and RBAC permission checking, replacing the need for separate @mcp.tool
    and @mcp_auth_hook decorators.

    Supports both @tool and @tool() syntax.

    Permission Model (mirrors Flask-AppBuilder):
    --------------------------------------------
    The class_permission_name and method_permission_name parameters mirror
    Flask-AppBuilder's permission model used in Superset's REST API:

        # FAB API pattern:
        class ChartRestApi(BaseSupersetApi):
            class_permission_name = "Chart"  # The resource/view name

            @expose("/", methods=("GET",))
            @protect()
            def get_list(self): ...  # defaults to "can_read"

        # MCP tool pattern (equivalent):
        @tool(class_permission_name="Chart")  # defaults to "can_read"
        async def list_charts(): ...

        @tool(class_permission_name="Chart", method_permission_name="write")
        async def generate_chart(): ...

    Args:
        func_or_name: When used as @tool, this will be the function.
                     When used as @tool("name"), this will be the name.
        name: Tool name (defaults to function name)
        description: Tool description (defaults to function docstring)
        tags: List of tags for categorization (defaults to empty list)
        protect: Whether to apply Superset authentication (defaults to True)
        class_permission_name: The resource/view name for RBAC permission check
            (e.g., "Chart", "Dashboard", "SQLLab"). This corresponds to FAB's
            class_permission_name attribute on API view classes.
        method_permission_name: The action name for RBAC permission check
            (e.g., "read", "write", "delete"). Defaults to "write" if tags
            contains "mutate", otherwise "read". This corresponds to FAB's
            method_permission_name and is prefixed with "can_" to form
            "can_read", "can_write", etc.

    Returns:
        Decorator that registers and wraps the tool with optional authentication,
        or the wrapped function when used without parentheses

    Example:
        # Read-only tool (defaults to can_read permission)
        @tool(class_permission_name="Chart")
        async def list_charts(): ...

        # Write tool (explicit can_write permission)
        @tool(class_permission_name="Chart", method_permission_name="write")
        async def generate_chart(): ...

        # Using tags to auto-detect write permission
        @tool(class_permission_name="Dashboard", tags=["mutate"])
        async def update_dashboard(): ...  # Auto-detected as can_write
    """

    def decorator(func: F) -> F:
        try:
            # Import here to avoid circular imports
            from superset.mcp_service.app import mcp
            from superset.mcp_service.auth import (
                CLASS_PERMISSION_ATTR,
                METHOD_PERMISSION_ATTR,
            )

            # Use provided values or extract from function
            tool_name = name or func.__name__
            tool_description = description or func.__doc__ or f"Tool: {tool_name}"
            tool_tags = tags or []

            # Set permission attributes on the function (FAB pattern)
            # These will be read by mcp_auth_hook to check permissions
            if class_permission_name:
                setattr(func, CLASS_PERMISSION_ATTR, class_permission_name)

                # Auto-detect method_permission_name from tags if not provided
                # "mutate" tag implies write permission, otherwise default to read
                actual_method_permission = method_permission_name
                if actual_method_permission is None:
                    actual_method_permission = (
                        "write" if "mutate" in tool_tags else "read"
                    )
                setattr(func, METHOD_PERMISSION_ATTR, actual_method_permission)

                logger.debug(
                    "Tool %s: class_permission=%s, method_permission=can_%s",
                    tool_name,
                    class_permission_name,
                    actual_method_permission,
                )

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
            return cast(F, wrapped_func)

        except Exception as e:
            logger.error("Failed to register MCP tool %s: %s", name or func.__name__, e)
            # Return the original function so extension doesn't break
            return cast(F, func)

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
            return cast(F, wrapped_func)

        except Exception as e:
            logger.error(
                "Failed to register MCP prompt %s: %s", name or func.__name__, e
            )
            # Return the original function so extension doesn't break
            return cast(F, func)

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
