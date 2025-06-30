#!/usr/bin/env python3
"""
Simple MCP proxy server that connects to FastMCP server on localhost:5009
"""

import signal
import sys
import time
import logging
from typing import Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global proxy instance for cleanup
proxy: Optional['FastMCP'] = None

def signal_handler(signum, frame):
    """Handle shutdown signals gracefully"""
    logger.info(f"Received signal {signum}, shutting down gracefully...")
    if proxy:
        try:
            # Give the proxy a moment to clean up
            time.sleep(0.1)
        except Exception as e:
            logger.warning(f"Error during proxy cleanup: {e}")
    sys.exit(0)

def main():
    """Main function to run the proxy"""
    global proxy
    
    try:
        from fastmcp import FastMCP
        
        # Set up signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        
        logger.info("Starting MCP proxy server...")
        
        # Create a proxy to the remote FastMCP server
        proxy = FastMCP.as_proxy(
            "http://localhost:5009/mcp/",
            name="Superset MCP Proxy"
        )
        
        logger.info("Proxy created successfully, starting...")
        
        # Run the proxy (this will block until interrupted)
        proxy.run()
        
    except KeyboardInterrupt:
        logger.info("Received keyboard interrupt, shutting down...")
        sys.exit(0)
    except ImportError as e:
        logger.error(f"Failed to import FastMCP: {e}")
        logger.error("Please install fastmcp: pip install fastmcp")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        sys.exit(1)
    finally:
        logger.info("Proxy server stopped")

if __name__ == "__main__":
    main()
