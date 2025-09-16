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
Main entry point for running the MCP service in stdio mode.
This allows running the service with: python -m superset.mcp_service
"""

import contextlib
import io
import logging
import os
import sys
import warnings
from typing import Any

# Must redirect click output BEFORE importing anything that uses it
import click

# Monkey-patch click to redirect output to stderr in stdio mode
if os.environ.get("FASTMCP_TRANSPORT", "stdio") == "stdio":
    original_secho = click.secho

    def secho_to_stderr(*args: Any, **kwargs: Any) -> Any:
        kwargs["file"] = sys.stderr
        return original_secho(*args, **kwargs)

    click.secho = secho_to_stderr
    click.echo = lambda *args, **kwargs: click.echo(*args, file=sys.stderr, **kwargs)

from superset.mcp_service.app import init_fastmcp_server, mcp


def main() -> None:
    """
    Run the MCP service in stdio mode with proper output suppression.
    """
    # Determine if we're running in stdio mode
    transport = os.environ.get("FASTMCP_TRANSPORT", "stdio")

    if transport == "stdio":
        # Suppress ALL output to stdout except for MCP messages
        # This includes Flask initialization messages, warnings, etc.

        # Redirect stderr to suppress logging output
        # We'll keep stderr for debugging if needed
        logging.basicConfig(
            level=logging.CRITICAL,  # Only show critical errors
            stream=sys.stderr,
            format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        )

        # Disable all Flask/Superset logging to stdout
        for logger_name in [
            "superset",
            "flask",
            "werkzeug",
            "sqlalchemy",
            "flask_appbuilder",
            "celery",
            "alembic",
        ]:
            logger = logging.getLogger(logger_name)
            logger.setLevel(logging.CRITICAL)
            # Filter out stdout handlers safely
            new_handlers = []
            for h in logger.handlers:
                if hasattr(h, "stream") and h.stream != sys.stdout:
                    new_handlers.append(h)
                elif not hasattr(h, "stream"):
                    # Keep handlers that don't have a stream attribute
                    new_handlers.append(h)
            logger.handlers = new_handlers

        # Suppress warnings
        warnings.filterwarnings("ignore")

        # Capture any print statements during initialization
        captured_output = io.StringIO()

        # Set up Flask app context for database access
        from superset.mcp_service.flask_singleton import get_flask_app

        # Temporarily redirect stdout during Flask app creation
        with contextlib.redirect_stdout(captured_output):
            flask_app = get_flask_app()
            # Initialize the FastMCP server
            # Disable auth config for stdio mode to avoid Flask app output
            init_fastmcp_server()

        # Log captured output to stderr for debugging (optional)
        captured = captured_output.getvalue()
        if captured and os.environ.get("MCP_DEBUG"):
            sys.stderr.write(f"[MCP] Suppressed initialization output:\n{captured}\n")

        # Run in Flask app context
        with flask_app.app_context():
            # Run in stdio mode - this will handle JSON-RPC communication
            sys.stderr.write("[MCP] Starting in stdio mode (stdin/stdout)\n")
            sys.stderr.flush()

            try:
                mcp.run(transport="stdio")
            except (BrokenPipeError, ConnectionResetError) as e:
                # Handle client disconnection gracefully
                sys.stderr.write(f"[MCP] Client disconnected: {e}\n")
                sys.exit(0)
    else:
        # For other transports, use normal initialization
        init_fastmcp_server()

        # Run with specified transport
        if transport == "streamable-http":
            host = os.environ.get("FASTMCP_HOST", "127.0.0.1")
            port = int(os.environ.get("FASTMCP_PORT", "5008"))
            mcp.run(transport=transport, host=host, port=port)
        else:
            mcp.run(transport=transport)


if __name__ == "__main__":
    main()
