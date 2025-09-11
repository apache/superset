"""
Singleton pattern for Flask app creation in MCP service.

This module ensures that only one Flask app instance is created and reused
throughout the MCP service lifecycle. This prevents issues with multiple
app instances and improves performance.
"""

import logging
import threading
from typing import Optional

from flask import Flask

logger = logging.getLogger(__name__)

# Singleton instance storage
_flask_app: Optional[Flask] = None
_flask_app_lock = threading.Lock()


def get_flask_app() -> Flask:
    """
    Get or create the singleton Flask app instance.

    This function ensures that only one Flask app is created, even when called
    from multiple threads or contexts. The app is created lazily on first access.

    Returns:
        Flask: The singleton Flask app instance
    """
    global _flask_app

    # Fast path: if app already exists, return it
    if _flask_app is not None:
        return _flask_app

    # Slow path: acquire lock and create app if needed
    with _flask_app_lock:
        # Double-check pattern: verify app still doesn't exist after acquiring lock
        if _flask_app is not None:
            return _flask_app

        logger.info("Creating singleton Flask app instance for MCP service")

        try:
            from superset.app import create_app
            from superset.mcp_service.config import DEFAULT_CONFIG

            # Create the Flask app instance
            _flask_app = create_app()

            # Apply MCP-specific defaults to app.config if not already set
            for key, value in DEFAULT_CONFIG.items():
                if key not in _flask_app.config:
                    _flask_app.config[key] = value

            logger.info("Flask app singleton created successfully")
            return _flask_app

        except Exception as e:
            logger.error("Failed to create Flask app singleton: %s", e)
            raise


def reset_flask_app() -> None:
    """
    Reset the singleton Flask app instance.

    This should only be used in testing scenarios where you need to
    recreate the app with different configurations.
    """
    global _flask_app

    with _flask_app_lock:
        if _flask_app is not None:
            logger.info("Resetting Flask app singleton")
        _flask_app = None
