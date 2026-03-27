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

from flask import current_app, Flask, has_app_context

logger = logging.getLogger(__name__)

logger.info("Creating Flask app instance for MCP service")

try:
    # Flask CLI's FlaskGroup automatically calls create_app() and pushes a Flask
    # app context before subcommands run (e.g., `superset mcp run`). Checking
    # has_app_context() directly is the most reliable way to detect this — it
    # avoids reading private FAB attributes like appbuilder._session, which is
    # an implementation detail that may not exist in all FAB versions.
    if has_app_context():
        # We're already in an app context (e.g., FlaskGroup pushed one via CLI,
        # or we're embedded in the main Superset server).
        # Reuse that app to avoid calling create_app() a second time, which would
        # re-initialize appbuilder with a different Flask instance and corrupt
        # shared state (views, security manager, etc.).
        logger.info("Reusing existing Flask app from app context for MCP service")
        # Use _get_current_object() to get the actual Flask app, not the LocalProxy
        app = current_app._get_current_object()
    else:
        # Standalone MCP server — Superset models are deeply coupled to
        # appbuilder, security_manager, event_logger, encrypted_field_factory,
        # etc. so we use create_app() for full initialization rather than
        # trying to init a minimal subset (which leads to cascading failures).
        #
        # create_app() is safe here because in standalone mode the main
        # Superset web server is not running in-process.
        from superset.app import create_app
        from superset.mcp_service.mcp_config import get_mcp_config

        logger.info("Creating fully initialized Flask app for standalone MCP service")
        _mcp_app = create_app()
        _mcp_app.debug = False

        # Apply MCP-specific configuration on top
        mcp_config = get_mcp_config(_mcp_app.config)
        _mcp_app.config.update(mcp_config)

        with _mcp_app.app_context():
            from superset.core.mcp.core_mcp_injection import (
                initialize_core_mcp_dependencies,
            )

            initialize_core_mcp_dependencies()

        app = _mcp_app
        logger.info("Flask app fully initialized for standalone MCP service")

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
