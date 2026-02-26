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

The decorators:
1. Store metadata on functions for build-time discovery
2. In host mode: Register immediately with FastMCP
3. In extension mode: Defer registration (manifest validation by ExtensionManager)
4. In build mode: Metadata only (CLI discovery)
"""

import logging
from typing import Any, Callable, Optional, TypeVar

# Type variable for decorated functions
F = TypeVar("F", bound=Callable[..., Any])

logger = logging.getLogger(__name__)


def _register_tool_with_mcp(
    func: Callable[..., Any],
    tool_name: str,
    tool_description: str | None,
    tool_tags: list[str],
    protect: bool,
) -> Callable[..., Any]:
    """
    Register a tool with FastMCP.

    Args:
        func: The function to register
        tool_name: Name for the tool
        tool_description: Description for the tool
        tool_tags: Tags for categorization
        protect: Whether to wrap with authentication

    Returns:
        The wrapped function (with auth if protect=True)
    """
    from superset.mcp_service.app import mcp

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
        description=tool_description or f"Tool: {tool_name}",
        tags=tool_tags,
    )
    mcp.add_tool(tool)

    protected_status = "protected" if protect else "public"
    logger.info("Registered MCP tool: %s (%s)", tool_name, protected_status)

    return wrapped_func


def _register_prompt_with_mcp(
    func: Callable[..., Any],
    prompt_name: str,
    prompt_title: str,
    prompt_description: str | None,
    prompt_tags: set[str],
    protect: bool,
) -> Callable[..., Any]:
    """
    Register a prompt with FastMCP.

    Args:
        func: The function to register
        prompt_name: Name for the prompt
        prompt_title: Title for the prompt
        prompt_description: Description for the prompt
        prompt_tags: Tags for categorization
        protect: Whether to wrap with authentication

    Returns:
        The wrapped function (with auth if protect=True)
    """
    from superset.mcp_service.app import mcp

    # Conditionally apply authentication wrapper
    if protect:
        from superset.mcp_service.auth import mcp_auth_hook

        wrapped_func = mcp_auth_hook(func)
    else:
        wrapped_func = func

    # Register prompt with FastMCP
    mcp.prompt(
        name=prompt_name,
        title=prompt_title,
        description=prompt_description or f"Prompt: {prompt_name}",
        tags=prompt_tags,
    )(wrapped_func)

    protected_status = "protected" if protect else "public"
    logger.info("Registered MCP prompt: %s (%s)", prompt_name, protected_status)

    return wrapped_func


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

    This decorator:
    1. Stores ToolMetadata on the function for build-time discovery
    2. In host mode: Registers immediately with FastMCP
    3. In extension mode: Defers registration (ExtensionManager validates manifest)
    4. In build mode: Stores metadata only

    Supports both @tool and @tool() syntax.

    Args:
        func_or_name: When used as @tool, this will be the function.
                     When used as @tool("name"), this will be the name.
        name: Tool name (defaults to function name)
        description: Tool description (defaults to function docstring)
        tags: List of tags for categorization (defaults to empty list)
        protect: Whether to apply Superset authentication (defaults to True)

    Returns:
        Decorated function with __tool_metadata__ attribute
    """

    def decorator(func: F) -> F:
        from superset_core.extensions.context import get_context
        from superset_core.mcp import ToolMetadata

        # Use provided values or extract from function
        tool_name = name or func.__name__
        tool_description = description
        if tool_description is None and func.__doc__:
            tool_description = func.__doc__.strip().split("\n")[0]
        tool_tags = tags or []

        # Store metadata on function for discovery
        metadata = ToolMetadata(
            id=func.__name__,
            name=tool_name,
            description=tool_description,
            tags=tool_tags,
            protect=protect,
            module=f"{func.__module__}.{func.__name__}",
        )
        func.__tool_metadata__ = metadata  # type: ignore[attr-defined]

        ctx = get_context()

        # Build mode: metadata only, no registration
        if ctx.is_build_mode:
            return func

        # Extension mode: defer registration to ExtensionManager
        if ctx.is_extension_mode:
            ctx.add_pending_contribution(func, metadata, "tool")
            return func

        # Host mode: register immediately
        try:
            wrapped = _register_tool_with_mcp(
                func, tool_name, tool_description, tool_tags, protect
            )
            wrapped.__tool_metadata__ = metadata  # type: ignore[attr-defined]
            return wrapped  # type: ignore[return-value]
        except Exception as e:
            logger.error("Failed to register MCP tool %s: %s", tool_name, e)
            return func

    # Handle decorator usage patterns
    if callable(func_or_name):
        return decorator(func_or_name)  # type: ignore[arg-type]

    actual_name = func_or_name if isinstance(func_or_name, str) else name

    def parameterized_decorator(func: F) -> F:
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

    This decorator:
    1. Stores PromptMetadata on the function for build-time discovery
    2. In host mode: Registers immediately with FastMCP
    3. In extension mode: Defers registration (ExtensionManager validates manifest)
    4. In build mode: Stores metadata only

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
        Decorated function with __prompt_metadata__ attribute
    """

    def decorator(func: F) -> F:
        from superset_core.extensions.context import get_context
        from superset_core.mcp import PromptMetadata

        # Use provided values or extract from function
        prompt_name = name or func.__name__
        prompt_title = title or func.__name__
        prompt_description = description
        if prompt_description is None and func.__doc__:
            prompt_description = func.__doc__.strip().split("\n")[0]
        prompt_tags = tags or set()

        # Store metadata on function for discovery
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

        ctx = get_context()

        # Build mode: metadata only, no registration
        if ctx.is_build_mode:
            return func

        # Extension mode: defer registration to ExtensionManager
        if ctx.is_extension_mode:
            ctx.add_pending_contribution(func, metadata, "prompt")
            return func

        # Host mode: register immediately
        try:
            wrapped = _register_prompt_with_mcp(
                func,
                prompt_name,
                prompt_title,
                prompt_description,
                prompt_tags,
                protect,
            )
            wrapped.__prompt_metadata__ = metadata  # type: ignore[attr-defined]
            return wrapped  # type: ignore[return-value]
        except Exception as e:
            logger.error("Failed to register MCP prompt %s: %s", prompt_name, e)
            return func

    # Handle decorator usage patterns
    if callable(func_or_name):
        return decorator(func_or_name)  # type: ignore[arg-type]

    actual_name = func_or_name if isinstance(func_or_name, str) else name

    def parameterized_decorator(func: F) -> F:
        nonlocal name
        if actual_name is not None:
            name = actual_name
        return decorator(func)

    return parameterized_decorator


def register_tool_from_manifest(
    func: Callable[..., Any],
    metadata: Any,  # ToolMetadata
    extension_id: str,
) -> Callable[..., Any]:
    """
    Register a tool from an extension after manifest validation.

    Called by ExtensionManager after verifying the contribution
    is declared in the extension's manifest.

    Args:
        func: The decorated function
        metadata: ToolMetadata from the function
        extension_id: The extension ID (used for namespacing)

    Returns:
        The registered wrapped function
    """
    # Namespace the tool name with extension ID
    prefixed_name = f"{extension_id}.{metadata.name}"

    return _register_tool_with_mcp(
        func,
        prefixed_name,
        metadata.description,
        metadata.tags,
        metadata.protect,
    )


def register_prompt_from_manifest(
    func: Callable[..., Any],
    metadata: Any,  # PromptMetadata
    extension_id: str,
) -> Callable[..., Any]:
    """
    Register a prompt from an extension after manifest validation.

    Called by ExtensionManager after verifying the contribution
    is declared in the extension's manifest.

    Args:
        func: The decorated function
        metadata: PromptMetadata from the function
        extension_id: The extension ID (used for namespacing)

    Returns:
        The registered wrapped function
    """
    # Namespace the prompt name with extension ID
    prefixed_name = f"{extension_id}.{metadata.name}"

    return _register_prompt_with_mcp(
        func,
        prefixed_name,
        metadata.title or metadata.name,
        metadata.description,
        metadata.tags,
        metadata.protect,
    )


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
