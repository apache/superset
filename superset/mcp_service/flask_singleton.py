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
Lazy Flask app singleton for MCP service.

The Flask app is created on first call to ``get_flask_app()``, not at import
time.  This avoids import-time side effects that conflict with the pytest
test harness (which pre-initializes ``appbuilder`` before MCP modules are
collected).
"""

import logging
import threading

from flask import Flask

logger = logging.getLogger(__name__)

_app: Flask | None = None
_lock = threading.Lock()


def _create_flask_app() -> Flask:
    """Create and configure the Flask app.  Called once on first use."""
    from flask import current_app, has_app_context

    from superset.extensions import appbuilder

    # WARNING: appbuilder._session is a private API (Flask-AppBuilder).
    # Used because appbuilder.app returns a LocalProxy (always truthy).
    appbuilder_initialized = appbuilder._session is not None

    if appbuilder_initialized and has_app_context():
        # We're in an app context (e.g., during main Superset startup),
        # so we can get the actual Flask app instance from current_app
        logger.info("Reusing existing Flask app from app context for MCP service")
        # Use _get_current_object() to get the actual Flask app, not the LocalProxy
        return current_app._get_current_object()

    if appbuilder_initialized:
        # appbuilder is initialized but we have no app context.  Calling
        # create_app() here would invoke appbuilder.init_app() a second
        # time with a *different* Flask app, overwriting shared internal
        # state (views, security manager, etc.).  Fail loudly instead of
        # silently corrupting the singleton.
        raise RuntimeError(
            "appbuilder is already initialized but no Flask app context is "
            "available.  Cannot call create_app() as it would re-initialize "
            "appbuilder with a different Flask app instance."
        )

    # Standalone MCP server — Superset models are deeply coupled to
    # appbuilder, security_manager, event_logger, encrypted_field_factory,
    # etc. so we use create_app() for full initialization rather than
    # trying to init a minimal subset (which leads to cascading failures).
    #
    # create_app() is safe here because in standalone mode the main
    # Superset web server is not running in-process.
    from superset.app import create_app
    from superset.mcp_service.mcp_config import get_mcp_config

    logger.info("Creating Flask app for standalone MCP service")
    mcp_app = create_app()
    mcp_app.debug = False

    # Apply MCP-specific configuration on top
    mcp_config = get_mcp_config(mcp_app.config)
    mcp_app.config.update(mcp_config)

    return mcp_app


def get_flask_app() -> Flask:
    """Get the Flask app instance, creating it lazily on first call."""
    global _app  # noqa: PLW0603
    if _app is not None:
        return _app
    with _lock:
        if _app is not None:  # double-checked locking
            return _app
        try:
            _app = _create_flask_app()
        except Exception as e:
            logger.error("Failed to create Flask app: %s", e)
            raise
        return _app
