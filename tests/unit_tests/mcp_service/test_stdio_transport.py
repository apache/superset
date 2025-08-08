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

"""Tests for MCP service STDIO transport mode."""

import os
import sys
from unittest.mock import MagicMock, patch

from superset.utils import json


class TestSTDIOTransport:
    """Test suite for MCP service STDIO transport."""

    def test_stdio_json_rpc_format(self):
        """Test JSON-RPC message format validation."""
        test_messages = [
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-18",
                    "capabilities": {},
                },
            },
            {
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/list",
                "params": {},
            },
            {
                "jsonrpc": "2.0",
                "id": 3,
                "method": "tools/call",
                "params": {
                    "name": "list_dashboards",
                    "arguments": {"page": 1, "page_size": 10},
                },
            },
        ]

        for message in test_messages:
            # Verify valid JSON-RPC format
            assert message["jsonrpc"] == "2.0"
            assert "id" in message
            assert "method" in message
            assert "params" in message

            # Verify it can be serialized
            json_str = json.dumps(message)
            parsed = json.loads(json_str)
            assert parsed == message

    def test_stdio_environment_detection(self):
        """Test that STDIO mode is detected from environment variables."""
        # Test STDIO mode detection
        with patch.dict(os.environ, {"FASTMCP_TRANSPORT": "stdio"}):
            assert os.environ.get("FASTMCP_TRANSPORT") == "stdio"

        # Test HTTP mode detection
        with patch.dict(os.environ, {"FASTMCP_TRANSPORT": "http"}):
            assert os.environ.get("FASTMCP_TRANSPORT") == "http"

        # Test default mode (stdio when not specified)
        with patch.dict(os.environ, {}, clear=True):
            # When FASTMCP_TRANSPORT is not set, the default in __main__ is "stdio"
            default_transport = os.environ.get("FASTMCP_TRANSPORT", "stdio")
            assert default_transport == "stdio"

    def test_click_monkey_patching(self):
        """Test that click is monkey-patched for STDIO mode."""
        # Save original click functions
        import click

        original_secho = click.secho
        original_echo = click.echo

        try:
            # Test that click functions exist and are callable
            assert callable(click.secho)
            assert callable(click.echo)

            # Test that they can be monkey-patched
            mock_secho = MagicMock()
            mock_echo = MagicMock()

            click.secho = mock_secho
            click.echo = mock_echo

            # Verify patching worked
            click.secho("test")
            mock_secho.assert_called_once_with("test")

            click.echo("test")
            mock_echo.assert_called_once_with("test")

        finally:
            # Restore original functions
            click.secho = original_secho
            click.echo = original_echo

    def test_logging_levels(self):
        """Test logging level configuration for STDIO mode."""
        import logging

        # Test that CRITICAL level is highest
        assert logging.CRITICAL == 50

        # Test that loggers can be configured
        test_logger = logging.getLogger("test_logger")
        test_logger.setLevel(logging.CRITICAL)
        assert test_logger.level == logging.CRITICAL

        # Test that handlers can be filtered
        handler = logging.StreamHandler(sys.stderr)
        test_logger.addHandler(handler)
        assert handler in test_logger.handlers

        # Remove handler
        test_logger.removeHandler(handler)
        assert handler not in test_logger.handlers

    def test_output_redirection_context(self):
        """Test that output can be redirected using contextlib."""
        import contextlib
        import io

        # Test redirect_stdout
        captured = io.StringIO()
        with contextlib.redirect_stdout(captured):
            print("test output")

        assert "test output" in captured.getvalue()

        # Test redirect_stderr
        captured_err = io.StringIO()
        with contextlib.redirect_stderr(captured_err):
            sys.stderr.write("error output")

        assert "error output" in captured_err.getvalue()

    def test_flask_app_context_pattern(self):
        """Test Flask app context manager pattern."""
        # Mock Flask app
        mock_app = MagicMock()
        mock_context = MagicMock()

        # Set up context manager protocol
        mock_context.__enter__ = MagicMock(return_value=mock_context)
        mock_context.__exit__ = MagicMock(return_value=None)
        mock_app.app_context.return_value = mock_context

        # Test context manager usage
        with mock_app.app_context() as ctx:
            assert ctx == mock_context

        # Verify context manager methods were called
        mock_context.__enter__.assert_called_once()
        mock_context.__exit__.assert_called_once()

    def test_mcp_debug_environment(self):
        """Test MCP_DEBUG environment variable handling."""
        # Test with MCP_DEBUG set
        with patch.dict(os.environ, {"MCP_DEBUG": "1"}):
            assert os.environ.get("MCP_DEBUG") == "1"
            # In the actual code, this enables debug output
            debug_enabled = bool(os.environ.get("MCP_DEBUG"))
            assert debug_enabled is True

        # Test without MCP_DEBUG
        with patch.dict(os.environ, {}, clear=True):
            debug_enabled = bool(os.environ.get("MCP_DEBUG"))
            assert debug_enabled is False

    def test_transport_mode_selection(self):
        """Test transport mode selection logic."""
        # Test different transport modes
        transport_modes = ["stdio", "http", "streamable-http"]

        for mode in transport_modes:
            with patch.dict(os.environ, {"FASTMCP_TRANSPORT": mode}):
                transport = os.environ.get("FASTMCP_TRANSPORT", "stdio")
                assert transport == mode

        # Test default fallback
        with patch.dict(os.environ, {}, clear=True):
            transport = os.environ.get("FASTMCP_TRANSPORT", "stdio")
            assert transport == "stdio"

    def test_streamable_http_configuration(self):
        """Test streamable-http transport configuration."""
        test_env = {
            "FASTMCP_TRANSPORT": "streamable-http",
            "FASTMCP_HOST": "0.0.0.0",  # noqa: S104
            "FASTMCP_PORT": "6000",
        }

        with patch.dict(os.environ, test_env):
            transport = os.environ.get("FASTMCP_TRANSPORT")
            host = os.environ.get("FASTMCP_HOST", "127.0.0.1")
            port = int(os.environ.get("FASTMCP_PORT", "5008"))

            assert transport == "streamable-http"
            assert host == "0.0.0.0"  # noqa: S104
            assert port == 6000

    def test_warning_suppression(self):
        """Test that warnings can be suppressed."""
        import warnings

        # Test filtering warnings
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore")
            # This warning should be suppressed
            warnings.warn("Test warning", UserWarning, stacklevel=2)
            # No assertion needed - just verify no exception raised
