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

try:
    from mcp.types import ToolAnnotations
except ImportError:
    ToolAnnotations = dict

from superset.extensions.context import get_current_extension_context

# Type variable for decorated functions
F = TypeVar("F", bound=Callable[..., Any])

logger = logging.getLogger(__name__)


def _get_prefixed_id_with_context(base_id: str) -> tuple[str, str]:
    """
    Get ID with extension prefixing based on ambient context.

    Returns:
        Tuple of (prefixed_id, context_type) where context_type is 'extension' or 'host'
    """
    if context := get_current_extension_context():
        # Extension context: prefix ID to prevent collisions
        manifest = context.manifest
        prefixed_id = f"extensions.{manifest.publisher}.{manifest.name}.{base_id}"
        context_type = "extension"
    else:
        # Host context: use original ID
        prefixed_id = base_id
        context_type = "host"

    return prefixed_id, context_type


def create_tool_decorator(
    func_or_name: str | Callable[..., Any] | None = None,
    *,
    name: Optional[str] = None,
    description: Optional[str] = None,
    tags: Optional[list[str]] = None,
    protect: bool = True,
    class_permission_name: Optional[str] = None,
    method_permission_name: Optional[str] = None,
    annotations: ToolAnnotations | None = None,
) -> Callable[[F], F] | F:
    """
    Create the concrete MCP tool decorator implementation.

    This combines FastMCP tool registration with optional Superset authentication
    and RBAC permission checking.

    Supports both @tool and @tool() syntax.

    Args:
        func_or_name: When used as @tool, this will be the function.
                     When used as @tool("name"), this will be the name.
        name: Tool name (defaults to function name)
        description: Tool description (defaults to function docstring)
        tags: List of tags for categorization (defaults to empty list)
        protect: Whether to apply Superset authentication (defaults to True)
        class_permission_name: FAB view/resource name for RBAC
            (e.g., "Chart", "Dashboard", "SQLLab"). Enables permission checking.
        method_permission_name: FAB action name (e.g., "read", "write").
            Defaults to "write" if tags has "mutate", else "read".
        annotations: MCP tool annotations (title, readOnlyHint, destructiveHint, etc.)

    Returns:
        Decorator that registers and wraps the tool with optional authentication,
        or the wrapped function when used without parentheses
    """

    def decorator(func: F) -> F:
        try:
            # Import here to avoid circular imports
            from superset.mcp_service.app import mcp

            # Use provided values or extract from function
            base_tool_name = name or func.__name__
            tool_description = description or func.__doc__ or f"Tool: {base_tool_name}"
            tool_tags = tags or []

            # Get prefixed ID based on ambient context
            tool_name, context_type = _get_prefixed_id_with_context(base_tool_name)

            # Store RBAC permission metadata on the function so
            # mcp_auth_hook can read them at call time.
            if class_permission_name:
                from superset.mcp_service.auth import (
                    CLASS_PERMISSION_ATTR,
                    METHOD_PERMISSION_ATTR,
                )

                setattr(func, CLASS_PERMISSION_ATTR, class_permission_name)
                actual_method = method_permission_name
                if actual_method is None:
                    actual_method = "write" if "mutate" in tool_tags else "read"
                setattr(func, METHOD_PERMISSION_ATTR, actual_method)

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
                annotations=annotations,
            )
            mcp.add_tool(tool)

            protected_status = "protected" if protect else "public"
            logger.info(
                "Registered MCP tool: %s (%s, %s)",
                tool_name,
                protected_status,
                context_type,
            )
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
            base_prompt_name = name or func.__name__
            prompt_title = title or func.__name__
            prompt_description = (
                description or func.__doc__ or f"Prompt: {base_prompt_name}"
            )
            prompt_tags = tags or set()

            # Get prefixed ID based on ambient context
            prompt_name, context_type = _get_prefixed_id_with_context(base_prompt_name)

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
            logger.info(
                "Registered MCP prompt: %s (%s, %s)",
                prompt_name,
                protected_status,
                context_type,
            )
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


def initialize_core_mcp_decorators() -> None:
    """
    Replace the abstract MCP decorators in ``superset_core.mcp.decorators`` with
    concrete host implementations.

    This must run in *every* process that may import extensions -- not only those
    that serve MCP. Extensions can apply ``@tool``/``@prompt`` at import time, and
    the abstract decorators raise ``NotImplementedError`` until they are replaced
    here, so skipping this step would break such extensions at import. It is
    comparatively cheap: it does not import the MCP service app or register any
    host tools (see ``initialize_core_mcp_host_tools`` for that).
    """
    import superset_core.mcp.decorators

    try:
        from fastmcp.tools import Tool  # noqa: F401
    except ImportError:
        logger.info(
            "fastmcp is not installed, skipping MCP initialization. "
            "Install it with: pip install 'apache-superset[fastmcp]'"
        )
        return

    # Replace the abstract decorators with concrete implementations
    superset_core.mcp.decorators.tool = create_tool_decorator
    superset_core.mcp.decorators.prompt = create_prompt_decorator

    logger.info("MCP dependency injection initialized successfully")


def initialize_core_mcp_host_tools() -> None:
    """
    Import the MCP service app so that all host tools are registered BEFORE
    extension loading.

    This carries a real per-process memory cost -- it imports the MCP service app
    and every host tool module -- and is only needed in processes that actually
    serve MCP (the web app and the standalone MCP service). Deployments gate it
    off (``CORE_MCP_HOST_TOOLS_ENABLED = False``) for processes that never serve
    MCP, e.g. Celery workers.
    """
    try:
        # Import MCP service app to register host tools BEFORE extension loading
        # This prevents host tools from being registered during extension context
        from superset.mcp_service import app  # noqa: F401

        logger.info("MCP service app imported - host tools registered")
    except Exception as e:
        logger.error("Failed to register MCP host tools: %s", e)


def initialize_core_mcp_dependencies() -> None:
    """
    Initialize MCP dependency injection by replacing abstract functions
    in superset_core.api.mcp with concrete implementations, then registering the
    host tools.

    Kept for backwards compatibility and callers that want the full MCP setup in a
    single call. Processes that must avoid the host-tool import cost should instead
    call ``initialize_core_mcp_decorators`` unconditionally and gate
    ``initialize_core_mcp_host_tools`` on ``CORE_MCP_HOST_TOOLS_ENABLED`` (see
    ``SupersetAppInitializer.init_core_dependencies``).
    """
    initialize_core_mcp_decorators()
    initialize_core_mcp_host_tools()
