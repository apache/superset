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

from flask import Flask

logger = logging.getLogger(__name__)

logger.info("Creating Flask app instance for MCP service")

try:
    from superset.extensions import appbuilder

    # Check if appbuilder is already initialized (main Superset app is running).
    # If so, reuse that app to avoid corrupting the shared appbuilder singleton.
    # Calling create_app() again would re-initialize appbuilder and break view endpoints.
    if appbuilder.app is not None:
        logger.info("Reusing existing Flask app from appbuilder for MCP service")
        app = appbuilder.app
    else:
        # Create a minimal Flask app for standalone MCP server.
        # We avoid calling create_app() which would run full FAB initialization
        # and could corrupt the shared appbuilder singleton if the main app starts later.
        from superset.app import SupersetApp
        from superset.mcp_service.mcp_config import get_mcp_config

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
