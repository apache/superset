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

The MCP service operates as a standalone FastMCP server.

Quick Start:
-----------
# Run the MCP server
superset mcp run --port 5009

# The service will be available at:
# http://localhost:5009/mcp/
"""

__version__ = "1.0.0"

__all__ = [
    "__version__",
]
