#!/usr/bin/env python3
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
Simple MCP proxy server that connects to FastMCP server on localhost:5008
"""

import logging
import signal
import sys
from typing import Any

from fastmcp import FastMCP

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Global proxy instance for cleanup
proxy: FastMCP | None = None


def signal_handler(signum: int, frame: Any) -> None:
    """Handle shutdown signals gracefully"""
    logger.info("Received signal %s, shutting down gracefully...", signum)
    # FastMCP.as_proxy() handles its own cleanup
    sys.exit(0)


def main() -> None:
    """Main function to run the proxy"""
    global proxy

    try:
        from fastmcp import FastMCP

        # Set up signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)

        logger.info("Starting MCP proxy server...")

        # Create a proxy to the remote FastMCP server
        proxy = FastMCP.as_proxy("http://localhost:5008/mcp/", name="MCP Proxy")

        logger.info("Proxy created successfully, starting...")

        # Run the proxy (this will block until interrupted)
        proxy.run()

    except KeyboardInterrupt:
        logger.info("Received keyboard interrupt, shutting down...")
        sys.exit(0)
    except ImportError as e:
        logger.error("Failed to import FastMCP: %s", e)
        logger.error("Please install fastmcp: pip install fastmcp")
        sys.exit(1)
    except Exception as e:
        logger.error("Unexpected error: %s", e)
        sys.exit(1)
    finally:
        logger.info("Proxy server stopped")


if __name__ == "__main__":
    main()
