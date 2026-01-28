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
Simple module-level Flask app instance for MCP service.

Following the Stack Overflow recommendation:
"a simple module with just the instance is enough"
- The module itself acts as the singleton
- No need for complex patterns or metaclasses
- Clean and Pythonic approach
"""

import logging
import os

from flask import current_app, Flask, has_app_context

logger = logging.getLogger(__name__)

logger.info("Creating Flask app instance for MCP service")

try:
    from superset.extensions import appbuilder

    # Check if appbuilder is already initialized (main Superset app is running).
    # If so, reuse that app to avoid corrupting the shared appbuilder singleton.
    # Calling create_app() again would re-initialize appbuilder and break views.
    #
    # NOTE: appbuilder.app now returns a LocalProxy to current_app (Flask-AppBuilder
    # deprecation), so we can't use `appbuilder.app is not None` as that always
    # returns True (compares LocalProxy object, not the resolved value).
    # Instead, check if init_app was called by looking at _session.
    appbuilder_initialized = appbuilder._session is not None

    if appbuilder_initialized and has_app_context():
        # We're in an app context (e.g., during main Superset startup),
        # so we can get the actual Flask app instance from current_app
        logger.info("Reusing existing Flask app from app context for MCP service")
        # Use _get_current_object() to get the actual Flask app, not the LocalProxy
        app = current_app._get_current_object()
    else:
        # Either appbuilder is not initialized (standalone MCP server),
        # or appbuilder is initialized but we're not in an app context
        # (edge case - should rarely happen). In both cases, create a minimal app.
        #
        # We avoid calling create_app() which would run full FAB initialization
        # and could corrupt the shared appbuilder singleton if main app starts.
        from superset.app import SupersetApp
        from superset.mcp_service.mcp_config import get_mcp_config

        if appbuilder_initialized:
            logger.warning(
                "Appbuilder initialized but not in app context - "
                "creating separate MCP Flask app"
            )
        else:
            logger.info("Creating minimal Flask app for standalone MCP service")

        # Disable debug mode to avoid side-effects like file watchers
        _mcp_app = SupersetApp(__name__)
        _mcp_app.debug = False

        # Load configuration
        config_module = os.environ.get("SUPERSET_CONFIG", "superset.config")
        _mcp_app.config.from_object(config_module)

        # Apply MCP-specific configuration
        mcp_config = get_mcp_config(_mcp_app.config)
        _mcp_app.config.update(mcp_config)

        # Initialize only the minimal dependencies needed for MCP service
        with _mcp_app.app_context():
            try:
                from superset.extensions import db

                db.init_app(_mcp_app)

                # Initialize only MCP-specific dependencies
                # MCP tools import directly from superset.daos/models, so we only need
                # the MCP decorator injection, not the full superset_core abstraction
                from superset.core.mcp.core_mcp_injection import (
                    initialize_core_mcp_dependencies,
                )

                initialize_core_mcp_dependencies()

                logger.info(
                    "Minimal MCP dependencies initialized for standalone MCP service"
                )
            except Exception as e:
                logger.warning(
                    "Failed to initialize dependencies for MCP service: %s", e
                )

        app = _mcp_app
        logger.info("Minimal Flask app instance created successfully for MCP service")

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
