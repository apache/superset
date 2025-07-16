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
Merged MCP server for Apache Superset (replaces both server.py and fastmcp_server.py)

This file provides:
- FastMCP server setup, tool registration, and middleware (init_fastmcp_server)
- Unified entrypoint for running the MCP service (HTTP)
"""
import logging
import os

from superset.mcp_service.mcp_app import mcp, init_fastmcp_server

def configure_logging(debug: bool = False) -> None:
    """Configure logging for the MCP service."""
    if debug or os.environ.get("SQLALCHEMY_DEBUG"):
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        for logger_name in ['sqlalchemy.engine', 'sqlalchemy.pool', 'sqlalchemy.dialects']:
            logging.getLogger(logger_name).setLevel(logging.INFO)
        print("🔍 SQL Debug logging enabled")

def run_server(host: str = "0.0.0.0", port: int = 5008, debug: bool = False) -> None:
    """
    Run the MCP service server with REST API and FastMCP endpoints.
    Only supports HTTP (streamable-http) transport.
    """
    configure_logging(debug)
    print(f"Creating MCP app...")
    # init_flask_app()
    init_fastmcp_server()  # This will register middleware, etc.

    env_key = f"FASTMCP_RUNNING_{port}"
    if not os.environ.get(env_key):
        os.environ[env_key] = "1"
        try:
            print(f"Starting FastMCP on {host}:{port}")
            mcp.run(transport="streamable-http", host=host, port=port)
        except Exception as e:
            print(f"FastMCP failed: {e}")
            os.environ.pop(env_key, None)
    else:
        print(f"FastMCP already running on {host}:{port}")

if __name__ == "__main__":
    run_server()

