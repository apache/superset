#!/usr/bin/env python3
"""
Simple authenticated MCP proxy server that connects to FastMCP server with
Bearer token authentication.
"""

import logging
import os
import signal
import sys
import time
from typing import Any, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Global proxy instance for cleanup
proxy: Optional[Any] = None


def signal_handler(signum: int, frame: Any) -> None:
    """Handle shutdown signals gracefully"""
    logger.info("Received signal %s, shutting down gracefully...", signum)
    if proxy:
        try:
            # Give the proxy a moment to clean up
            time.sleep(0.1)
        except Exception as e:
            logger.warning("Error during proxy cleanup: %s", e)
    sys.exit(0)


def main() -> None:
    """Main function to run the authenticated proxy"""
    global proxy

    try:
        from fastmcp import Client, FastMCP
        from fastmcp.client.auth import BearerAuth

        # Set up signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)

        # Get authentication token from environment
        auth_token = os.getenv("SUPERSET_MCP_TOKEN")

        if not auth_token:
            logger.error("No authentication token found in SUPERSET_MCP_TOKEN")
            logger.error("Please set SUPERSET_MCP_TOKEN environment variable")
            sys.exit(1)

        logger.info("Found authentication token, creating authenticated client...")

        # Create authenticated client
        client = Client("http://localhost:5008/mcp/", auth=BearerAuth(token=auth_token))

        logger.info("Creating authenticated proxy...")

        # Create proxy using the authenticated client
        proxy = FastMCP.as_proxy(client, name="Authenticated Superset MCP Proxy")

        logger.info("Proxy created successfully, starting...")

        # Run the proxy (this will block until interrupted)
        proxy.run()

    except KeyboardInterrupt:
        logger.info("Received keyboard interrupt, shutting down...")
        sys.exit(0)
    except ImportError as e:
        logger.error("Failed to import required modules: %s", e)
        logger.error(
            "Please install fastmcp with client support: pip install fastmcp[client]"
        )
        sys.exit(1)
    except Exception as e:
        logger.error("Unexpected error: %s", e)
        sys.exit(1)
    finally:
        logger.info("Authenticated proxy server stopped")


if __name__ == "__main__":
    main()
