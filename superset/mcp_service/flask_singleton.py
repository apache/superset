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

from flask import Flask

logger = logging.getLogger(__name__)

logger.info("Creating Flask app instance for MCP service")

try:
    from superset.app import create_app
    from superset.mcp_service.mcp_config import get_mcp_config

    # Create a temporary context to avoid
    # "Working outside of application context" errors.
    _temp_app = create_app()

    # Push an application context and initialize core dependencies and extensions
    with _temp_app.app_context():
        # Apply MCP configuration - reads from app.config first, falls back to defaults
        mcp_config = get_mcp_config(_temp_app.config)
        _temp_app.config.update(mcp_config)
        try:
            from superset.initialization import SupersetAppInitializer

            # Create initializer and run only dependency injection
            # NOT the full init_app_in_ctx which includes web views
            initializer = SupersetAppInitializer(_temp_app)
            initializer.init_all_dependencies_and_extensions()

            logger.info("Core dependencies and extensions initialized for MCP service")
        except Exception as e:
            logger.warning("Failed to initialize dependencies for MCP service: %s", e)

    # Store the app instance for later use
    app = _temp_app

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
