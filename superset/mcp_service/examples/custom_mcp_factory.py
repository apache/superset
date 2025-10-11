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
Example of how to customize the FastMCP factory with authentication,
middleware, and custom configuration.

This demonstrates the Flask-style application factory pattern for
creating customized FastMCP instances.
"""

import asyncio
import logging
from typing import Any

from superset.mcp_service.app import create_mcp_app
from superset.mcp_service.mcp_config import get_mcp_factory_config


class SimpleAuthProvider:
    """Example auth provider for demonstration purposes."""

    def __init__(self, api_key: str):
        self.api_key = api_key

    async def authenticate(self, request: Any) -> bool:
        """Simple API key authentication."""
        auth_header = getattr(request, "headers", {}).get("Authorization", "")
        return auth_header == f"Bearer {self.api_key}"


async def custom_lifespan(app: Any) -> Any:
    """Custom lifespan handler for startup/shutdown logic."""
    logging.info("🚀 Custom FastMCP server starting up...")

    # Startup logic here
    yield

    # Shutdown logic here
    logging.info("🛑 Custom FastMCP server shutting down...")


def create_secure_mcp_app() -> Any:
    """
    Example: Create a secure FastMCP instance with authentication.
    """
    auth_provider = SimpleAuthProvider(api_key="your-secret-api-key")

    return create_mcp_app(
        name="Secure Superset MCP",
        auth=auth_provider,
        lifespan=custom_lifespan,
        include_tags={"public", "dashboard", "chart"},  # Only expose certain tools
        config={"debug": True, "timeout": 30},
    )


def create_tagged_mcp_app() -> Any:
    """
    Example: Create FastMCP instance with tag filtering.
    """
    return create_mcp_app(
        name="Filtered Superset MCP",
        include_tags={"dashboard", "chart"},  # Only dashboard and chart tools
        exclude_tags={"admin"},  # Exclude admin tools
        config={"read_only": True},
    )


def create_custom_instructions_mcp_app() -> Any:
    """
    Example: Create FastMCP instance with custom instructions.
    """
    custom_instructions = """
    Welcome to the Custom Superset MCP Service!

    This is a specialized instance for dashboard and chart management.
    Available tools are limited to read-only operations for security.

    Please use the dashboard and chart management tools to explore data.
    """

    return create_mcp_app(
        name="Custom Instructions MCP",
        instructions=custom_instructions,
        include_tags={"dashboard", "chart"},
        exclude_tags={"sql", "admin"},
    )


def create_mcp_from_config() -> Any:
    """
    Example: Create FastMCP instance from configuration file.
    """
    # Get base configuration
    factory_config = get_mcp_factory_config()

    # Customize the configuration
    factory_config.update(
        {
            "name": "Configured Superset MCP",
            "auth": SimpleAuthProvider("config-api-key"),
            "include_tags": {"public"},
            "config": {"environment": "production"},
        }
    )

    return create_mcp_app(**factory_config)


async def main() -> None:
    """Example of running different MCP configurations."""

    # Example 1: Secure MCP with authentication
    secure_mcp = create_secure_mcp_app()
    print(f"Created secure MCP: {secure_mcp.name}")

    # Example 2: Tagged/filtered MCP
    filtered_mcp = create_tagged_mcp_app()
    print(f"Created filtered MCP: {filtered_mcp.name}")

    # Example 3: Custom instructions MCP
    custom_mcp = create_custom_instructions_mcp_app()
    print(f"Created custom MCP: {custom_mcp.name}")

    # Example 4: Configuration-driven MCP
    config_mcp = create_mcp_from_config()
    print(f"Created config-driven MCP: {config_mcp.name}")


if __name__ == "__main__":
    # Configure logging
    logging.basicConfig(level=logging.INFO)

    # Run examples
    asyncio.run(main())
