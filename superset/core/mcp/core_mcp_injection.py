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
    name: Optional[str] = None,
    description: Optional[str] = None,
    tags: Optional[list[str]] = None,
) -> Callable[[F], F]:
    """
    Create the concrete MCP tool decorator implementation.

    This combines FastMCP tool registration with Superset authentication,
    replacing the need for separate @mcp.tool and @mcp_auth_hook decorators.

    Args:
        name: Tool name (defaults to function name)
        description: Tool description (defaults to function docstring)
        tags: List of tags for categorization (defaults to empty list)

    Returns:
        Decorator that registers and wraps the tool with authentication
    """

    def decorator(func: F) -> F:
        try:
            # Import here to avoid circular imports
            from superset.mcp_service.app import mcp
            from superset.mcp_service.auth import mcp_auth_hook

            # Use provided values or extract from function
            tool_name = name or func.__name__
            tool_description = description or func.__doc__ or f"Tool: {tool_name}"
            tool_tags = tags or []

            # Apply authentication wrapper first
            authenticated_func = mcp_auth_hook(func)

            # Register with FastMCP using Tool.from_function if available
            try:
                from fastmcp.tools import Tool

                tool = Tool.from_function(
                    authenticated_func,
                    name=tool_name,
                    description=tool_description,
                    tags=tool_tags,
                )
                mcp.add_tool(tool)
            except (AttributeError, ImportError):
                # Fallback to setting function attributes and direct registration
                authenticated_func.__name__ = tool_name
                authenticated_func.__doc__ = tool_description
                mcp.add_tool(authenticated_func)

            logger.info("Registered MCP tool: %s", tool_name)
            return authenticated_func

        except Exception as e:
            logger.error("Failed to register MCP tool %s: %s", name or func.__name__, e)
            # Return the original function so extension doesn't break
            return func

    return decorator


def initialize_mcp_dependencies() -> None:
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
