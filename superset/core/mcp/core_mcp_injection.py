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
MCP core dependency injection for direct import patterns.

This module provides the concrete implementation of MCP tool registration
that replaces the abstract functions in superset-core during initialization.
"""

from __future__ import annotations

import logging
from typing import Any, Callable

logger = logging.getLogger(__name__)


def initialize_mcp_dependencies() -> None:
    """
    Initialize MCP dependency injection.

    This function replaces the abstract register_mcp_tool function in
    superset-core with a concrete implementation that registers directly
    with the FastMCP instance.
    """
    import superset_core.mcp as mcp_module

    def concrete_register_mcp_tool(
        name: str, func: Callable[..., Any], description: str, tags: list[str]
    ) -> None:
        """
        Concrete implementation that registers tools directly with FastMCP.

        Args:
            name: Unique tool identifier, typically namespaced
            func: Function that implements the tool logic
            description: Human-readable description of the tool's purpose
            tags: List of tags for categorizing the tool
        """
        try:
            # Import here to avoid circular imports
            from superset.mcp_service.app import mcp

            # Register directly with FastMCP instance
            # Note: FastMCP's add_tool method handles the @mcp.tool decoration
            mcp.add_tool(func, name=name, description=description)

            logger.info("Registered extension MCP tool: %s", name)

        except ImportError:
            # MCP service not available - this is fine if MCP is not enabled
            logger.debug(
                "MCP service not available, skipping tool registration: %s", name
            )
        except Exception as e:
            logger.error("Failed to register MCP tool %s: %s", name, e)
            raise

    # Replace the abstract function with concrete implementation
    mcp_module.register_mcp_tool = concrete_register_mcp_tool

    logger.info("Initialized MCP dependency injection")
