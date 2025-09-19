"""
Simple module-level Flask app instance for MCP service.

Following the Stack Overflow recommendation:
"a simple module with just the instance is enough"
- The module itself acts as the singleton
- No need for complex patterns or metaclasses
- Clean and Pythonic approach
"""

import logging

from flask import Flask

logger = logging.getLogger(__name__)

logger.info("Creating Flask app instance for MCP service")

try:
    from superset.app import create_app
    from superset.mcp_service.mcp_config import get_mcp_config

    # Create the Flask app instance - this is the singleton
    app = create_app()

    # Apply MCP-specific defaults to app.config if not already set
    mcp_config = get_mcp_config()
    for key, value in mcp_config.items():
        if key not in app.config:
            app.config[key] = value

    logger.info("Flask app instance created successfully")

except Exception as e:
    logger.error("Failed to create Flask app: %s", e)
    raise


def get_flask_app() -> Flask:
    """
    Get the Flask app instance.

    Returns:
        Flask: The module-level Flask app instance
    """
    return app
