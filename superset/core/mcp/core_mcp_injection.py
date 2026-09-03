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

import inspect
import logging
from typing import Any, Callable, get_type_hints, Optional, TypeVar

from pydantic import TypeAdapter

try:
    from mcp.types import ToolAnnotations
except ImportError:
    ToolAnnotations = dict

from superset.extensions.context import get_current_extension_context

# Type variable for decorated functions
F = TypeVar("F", bound=Callable[..., Any])

logger = logging.getLogger(__name__)


def _strip_schema_titles(value: Any) -> Any:
    """Remove generated JSON Schema titles while preserving useful metadata."""
    if isinstance(value, list):
        return [_strip_schema_titles(item) for item in value]
    if not isinstance(value, dict):
        return value
    return {
        key: _strip_schema_titles(item) for key, item in value.items() if key != "title"
    }


def _is_object_schema(schema: dict[str, Any], root_schema: dict[str, Any]) -> bool:
    """Return whether a schema, including a local reference, is an object."""
    if schema.get("type") == "object" or "properties" in schema:
        return True

    reference = schema.get("$ref")
    if not isinstance(reference, str) or not reference.startswith("#/$defs/"):
        return False
    definition = root_schema.get("$defs", {}).get(reference.removeprefix("#/$defs/"))
    return isinstance(definition, dict) and (
        definition.get("type") == "object" or "properties" in definition
    )


def _native_tool_output_schema(func: Callable[..., Any]) -> dict[str, Any] | None:
    """Build an output schema from the callable's validation shape.

    FastMCP normally derives schemas in Pydantic's serialization mode. A model
    serializer annotated as returning ``dict[str, Any]`` then collapses an
    otherwise typed model to an unconstrained object. Superset uses such
    serializers to omit unrequested columns and normalize aliases, but the
    model's validation schema remains an accurate superset of every field the
    serializer can emit.

    MCP requires an object at the output-schema root, so non-object return
    types are wrapped the same way FastMCP wraps them at execution time.
    """
    try:
        return_type = get_type_hints(func, include_extras=True).get("return")
        if return_type in (None, Any, inspect.Signature.empty):
            return None

        schema = TypeAdapter(return_type).json_schema(mode="validation")
    except Exception:  # noqa: BLE001
        logger.debug("Could not derive MCP output schema", exc_info=True)
        return None

    # A union of object response models is still an object on the wire. Marking
    # that fact at the root satisfies MCP's object-schema requirement without
    # introducing an artificial {"result": ...} envelope around every
    # success/error union.
    alternatives = schema.get("anyOf")
    if (
        isinstance(alternatives, list)
        and alternatives
        and all(
            isinstance(alternative, dict) and _is_object_schema(alternative, schema)
            for alternative in alternatives
        )
    ):
        schema["type"] = "object"

    if not _is_object_schema(schema, schema):
        definitions = schema.pop("$defs", None)
        schema = {
            "properties": {"result": schema},
            "required": ["result"],
            "type": "object",
            "x-fastmcp-wrap-result": True,
        }
        if definitions:
            schema["$defs"] = definitions

    return _strip_schema_titles(schema)


def _get_prefixed_id_with_context(base_id: str) -> tuple[str, str]:
    """
    Get ID with extension prefixing based on ambient context.

    Returns:
        Tuple of (prefixed_id, context_type) where context_type is 'extension' or 'host'
    """
    if context := get_current_extension_context():
        # Extension context: prefix ID to prevent collisions
        prefixed_id = (
            f"extensions.{context.extension.publisher}."
            f"{context.extension.name}.{base_id}"
        )
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

            tool_options: dict[str, Any] = {
                "name": tool_name,
                "description": tool_description,
                "tags": tool_tags,
                "annotations": annotations,
            }
            if context_type == "host" and (
                output_schema := _native_tool_output_schema(wrapped_func)
            ):
                tool_options["output_schema"] = output_schema

            tool = Tool.from_function(wrapped_func, **tool_options)
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
            # Fail-fast: don't silently serve unprotected tools. Returning the
            # unwrapped function here would bypass mcp_auth_hook, leaving the
            # tool exposed without auth or context isolation (see #39395).
            logger.error("Failed to register MCP tool %s: %s", name or func.__name__, e)
            raise

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
            # Fail-fast: don't silently serve unprotected prompts. Returning
            # the unwrapped function here would bypass mcp_auth_hook, leaving
            # the prompt exposed without auth or context isolation (see
            # #39395 — same invariant as create_tool_decorator).
            logger.error(
                "Failed to register MCP prompt %s: %s", name or func.__name__, e
            )
            raise

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
    in superset_core.api.mcp with concrete implementations.

    Also imports MCP service app to register all host tools BEFORE extension loading.
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

    try:
        # Import MCP service app to register host tools BEFORE extension loading
        # This prevents host tools from being registered during extension context
        from superset.mcp_service import app  # noqa: F401

        logger.info("MCP service app imported - host tools registered")
    except Exception as e:
        logger.error("Failed to register MCP host tools: %s", e)
