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
Configuration management for the Superset MCP Service.

This module provides configuration classes and utilities for the MCP service.
The configuration system will be extended in subsequent PRs to support
various deployment scenarios and authentication methods.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class MCPServiceConfig:
    """
    Configuration for the Superset MCP Service.

    This is a basic configuration structure that will be extended
    with additional settings in future PRs.
    """

    # Server configuration
    host: str = "localhost"
    port: int = 8089
    debug: bool = False

    # Authentication settings (placeholder)
    auth_enabled: bool = True
    auth_providers: List[str] = field(default_factory=list)

    # Service settings
    service_name: str = "superset-mcp-service"
    version: str = "0.1.0"

    # Superset connection settings
    superset_base_url: Optional[str] = None
    superset_api_key: Optional[str] = None

    # Feature flags (for future use)
    features: Dict[str, bool] = field(default_factory=dict)


# Global configuration instance (will be properly initialized in future PRs)
config: Optional[MCPServiceConfig] = None


def get_config() -> MCPServiceConfig:
    """
    Get the current MCP service configuration.

    Returns:
        MCPServiceConfig: The current configuration instance

    Raises:
        RuntimeError: If configuration is not initialized
    """
    global config
    if config is None:
        # Initialize with defaults for scaffolding
        config = MCPServiceConfig()
    return config


def init_config(config_dict: Optional[Dict[str, Any]] = None) -> MCPServiceConfig:
    """
    Initialize the MCP service configuration.

    Args:
        config_dict: Optional configuration dictionary to override defaults

    Returns:
        MCPServiceConfig: The initialized configuration
    """
    global config
    if config_dict:
        config = MCPServiceConfig(**config_dict)
    else:
        config = MCPServiceConfig()
    return config
