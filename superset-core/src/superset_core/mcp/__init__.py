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
MCP (Model Context Protocol) tool and prompt registration for Superset.

This module provides decorator stubs that are replaced by the host application
during initialization. Each decorator defines metadata dataclasses that are
used for build-time discovery.

Usage:
    from superset_core.mcp import tool, prompt

    @tool(tags=["database"])
    def query_database(sql: str) -> dict:
        '''Execute a SQL query against a database.'''
        return execute_query(sql)

    @prompt(tags={"analysis"})
    async def analyze_data(ctx, dataset: str) -> str:
        '''Generate analysis for a dataset.'''
        return f"Analyze {dataset}..."
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, TypeVar

# Type variable for decorated functions
F = TypeVar("F", bound=Callable[..., Any])


# =============================================================================
# Metadata dataclasses - attached to decorated functions for discovery
# =============================================================================


@dataclass
class ToolMetadata:
    """
    Metadata stored on functions decorated with @tool.

    Attached to functions as __tool_metadata__ for build-time discovery.
    """

    id: str
    name: str
    description: str | None = None
    tags: list[str] = field(default_factory=list)
    protect: bool = True
    module: str = ""  # Format: "package.module.function_name"


@dataclass
class PromptMetadata:
    """
    Metadata stored on functions decorated with @prompt.

    Attached to functions as __prompt_metadata__ for build-time discovery.
    """

    id: str
    name: str
    title: str | None = None
    description: str | None = None
    tags: set[str] = field(default_factory=set)
    protect: bool = True
    module: str = ""  # Format: "package.module.function_name"


# =============================================================================
# Decorator stubs - replaced by host application during initialization
# =============================================================================


def tool(
    func_or_name: str | Callable[..., Any] | None = None,
    *,
    name: str | None = None,
    description: str | None = None,
    tags: list[str] | None = None,
    protect: bool = True,
) -> Any:
    """
    Decorator to register an MCP tool with optional authentication.

    This is a stub that raises NotImplementedError until the host application
    initializes the concrete implementation via dependency injection.

    In BUILD mode, stores metadata for discovery without registration.

    Can be used as:
        @tool
        def my_tool(): ...

        @tool(tags=["database"])
        def query(): ...

        @tool(name="custom_name", protect=False)
        def my_tool(): ...

    Args:
        func_or_name: When used as @tool, this will be the function.
                     When used as @tool("name"), this will be the name.
        name: Tool name (defaults to function name)
        description: Tool description (defaults to first line of docstring)
        tags: List of tags for categorizing the tool
        protect: Whether to require Superset authentication (defaults to True)

    Returns:
        Decorated function with __tool_metadata__ attribute

    Raises:
        NotImplementedError: Before host implementation is initialized (except in
        BUILD mode)
    """

    def decorator(func: F) -> F:
        # Try to get context for BUILD mode detection
        try:
            from superset_core.extensions.context import get_context

            ctx = get_context()

            # In BUILD mode, store metadata for discovery
            if ctx.is_build_mode:
                tool_name = name or func.__name__
                tool_description = description
                if tool_description is None and func.__doc__:
                    tool_description = func.__doc__.strip().split("\n")[0]
                tool_tags = tags or []

                metadata = ToolMetadata(
                    id=func.__name__,
                    name=tool_name,
                    description=tool_description,
                    tags=tool_tags,
                    protect=protect,
                    module=f"{func.__module__}.{func.__name__}",
                )
                func.__tool_metadata__ = metadata  # type: ignore[attr-defined]
                return func
        except ImportError:
            # Context not available - fall through to error
            pass

        # Default behavior: raise error for host to replace
        raise NotImplementedError(
            "MCP tool decorator not initialized. "
            "This decorator should be replaced during Superset startup."
        )

    # Handle decorator usage patterns
    if callable(func_or_name):
        return decorator(func_or_name)

    # Return parameterized decorator
    actual_name = func_or_name if isinstance(func_or_name, str) else name

    def parameterized_decorator(func: F) -> F:
        nonlocal name
        if actual_name is not None:
            name = actual_name
        return decorator(func)

    return parameterized_decorator


def prompt(
    func_or_name: str | Callable[..., Any] | None = None,
    *,
    name: str | None = None,
    title: str | None = None,
    description: str | None = None,
    tags: set[str] | None = None,
    protect: bool = True,
) -> Any:
    """
    Decorator to register an MCP prompt with optional authentication.

    This is a stub that raises NotImplementedError until the host application
    initializes the concrete implementation via dependency injection.

    In BUILD mode, stores metadata for discovery without registration.

    Can be used as:
        @prompt
        async def my_prompt(ctx): ...

        @prompt(tags={"analysis"})
        async def analyze(ctx): ...

        @prompt("custom_name", title="Custom Title")
        async def my_prompt(ctx): ...

    Args:
        func_or_name: When used as @prompt, this will be the function.
                     When used as @prompt("name"), this will be the name.
        name: Prompt name (defaults to function name)
        title: Prompt title (defaults to function name)
        description: Prompt description (defaults to first line of docstring)
        tags: Set of tags for categorizing the prompt
        protect: Whether to require Superset authentication (defaults to True)

    Returns:
        Decorated function with __prompt_metadata__ attribute

    Raises:
        NotImplementedError: Before host implementation is initialized (except in
        BUILD mode)
    """

    def decorator(func: F) -> F:
        # Try to get context for BUILD mode detection
        try:
            from superset_core.extensions.context import get_context

            ctx = get_context()

            # In BUILD mode, store metadata for discovery
            if ctx.is_build_mode:
                prompt_name = name or func.__name__
                prompt_title = title or func.__name__
                prompt_description = description
                if prompt_description is None and func.__doc__:
                    prompt_description = func.__doc__.strip().split("\n")[0]
                prompt_tags = tags or set()

                metadata = PromptMetadata(
                    id=func.__name__,
                    name=prompt_name,
                    title=prompt_title,
                    description=prompt_description,
                    tags=prompt_tags,
                    protect=protect,
                    module=f"{func.__module__}.{func.__name__}",
                )
                func.__prompt_metadata__ = metadata  # type: ignore[attr-defined]
                return func
        except ImportError:
            # Context not available - fall through to error
            pass

        # Default behavior: raise error for host to replace
        raise NotImplementedError(
            "MCP prompt decorator not initialized. "
            "This decorator should be replaced during Superset startup."
        )

    # Handle decorator usage patterns
    if callable(func_or_name):
        return decorator(func_or_name)

    # Return parameterized decorator
    actual_name = func_or_name if isinstance(func_or_name, str) else name

    def parameterized_decorator(func: F) -> F:
        nonlocal name
        if actual_name is not None:
            name = actual_name
        return decorator(func)

    return parameterized_decorator


__all__ = [
    "tool",
    "prompt",
    "ToolMetadata",
    "PromptMetadata",
]
