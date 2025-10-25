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
MCP server for Apache Superset
"""

import logging
import os

from superset.mcp_service.app import create_mcp_app, init_fastmcp_server
from superset.mcp_service.mcp_config import get_mcp_factory_config


def configure_logging(debug: bool = False) -> None:
    """Configure logging for the MCP service."""
    import sys

    if debug or os.environ.get("SQLALCHEMY_DEBUG"):
        # Only configure basic logging if no handlers exist (respects logging.ini)
        root_logger = logging.getLogger()
        if not root_logger.handlers:
            logging.basicConfig(
                level=logging.INFO,
                format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
                stream=sys.stderr,  # Always log to stderr, not stdout
            )

        # Only override SQLAlchemy logger levels if they're not explicitly configured
        for logger_name in [
            "sqlalchemy.engine",
            "sqlalchemy.pool",
            "sqlalchemy.dialects",
        ]:
            logger = logging.getLogger(logger_name)
            # Only set level if it's still at default (WARNING for SQLAlchemy)
            if logger.level == logging.WARNING or logger.level == logging.NOTSET:
                logger.setLevel(logging.INFO)

        # Use logging instead of print to avoid stdout contamination
        logging.info("🔍 SQL Debug logging enabled")


def run_server(
    host: str = "127.0.0.1",
    port: int = 5008,
    debug: bool = False,
    use_factory_config: bool = False,
) -> None:
    """
    Run the MCP service server with FastMCP endpoints.
    Uses streamable-http transport for HTTP server mode.

    Args:
        host: Host to bind to
        port: Port to bind to
        debug: Enable debug logging
        use_factory_config: Use configuration from get_mcp_factory_config()
    """

    configure_logging(debug)

    if use_factory_config:
        # Use factory configuration for customization
        logging.info("Creating MCP app from factory configuration...")
        factory_config = get_mcp_factory_config()
        mcp_instance = create_mcp_app(**factory_config)
    else:
        # Use default initialization
        logging.info("Creating MCP app with default configuration...")
        mcp_instance = init_fastmcp_server()

    env_key = f"FASTMCP_RUNNING_{port}"
    if not os.environ.get(env_key):
        os.environ[env_key] = "1"
        try:
            logging.info("Starting FastMCP on %s:%s", host, port)
            mcp_instance.run(transport="streamable-http", host=host, port=port)
        except Exception as e:
            logging.error("FastMCP failed: %s", e)
            os.environ.pop(env_key, None)
    else:
        logging.info("FastMCP already running on %s:%s", host, port)


if __name__ == "__main__":
    run_server()
