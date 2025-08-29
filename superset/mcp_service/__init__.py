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

# superset/mcp_service/__init__.py

"""
Apache Superset MCP Service

This package provides the Model Context Protocol (MCP) service for Apache Superset,
enabling programmatic access to Superset's functionality through a standardized API.

The MCP service can operate in three modes:
1. Integrated: Flask Blueprint within Superset (recommended)
2. Standalone: Separate FastMCP server with JWT auth
3. Hybrid: Both endpoints available simultaneously

Quick Start:
-----------
# In superset_config.py
MCP_ENABLED = True
MCP_MODE = "integrated"  # Use Superset's auth

# The service will be available at:
# http://localhost:8088/api/v1/mcp/

For more information, see MIGRATION_GUIDE.md
"""

__version__ = "1.0.0"

# Re-export key functions for convenience
from superset.mcp_service.integration import (
    create_mcp_config_template,
    get_mcp_status,
    init_mcp_service,
)

__all__ = [
    "init_mcp_service",
    "get_mcp_status",
    "create_mcp_config_template",
    "__version__",
]
