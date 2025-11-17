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

"""Tests for MCP service configuration and branding."""

from unittest.mock import MagicMock, patch

from superset.mcp_service.app import get_default_instructions, init_fastmcp_server


def test_get_default_instructions_with_default_branding():
    """Test that default branding produces Apache Superset in instructions."""
    instructions = get_default_instructions()

    assert "Apache Superset" in instructions
    assert "Apache Superset MCP" in instructions
    assert "model context protocol" in instructions.lower()


def test_get_default_instructions_with_custom_branding():
    """Test that custom branding is reflected in instructions."""
    custom_branding = "ACME Analytics"
    instructions = get_default_instructions(branding=custom_branding)

    assert custom_branding in instructions
    assert f"{custom_branding} MCP" in instructions
    # Should not contain default Apache Superset branding
    assert "Apache Superset" not in instructions


def test_get_default_instructions_with_enterprise_branding():
    """Test instructions with enterprise/white-label branding."""
    enterprise_branding = "DataViz Platform"
    instructions = get_default_instructions(branding=enterprise_branding)

    assert enterprise_branding in instructions
    assert f"{enterprise_branding} MCP" in instructions
    # Verify it contains expected tool documentation
    assert "list_dashboards" in instructions
    assert "list_charts" in instructions
    assert "execute_sql" in instructions


def test_init_fastmcp_server_with_default_app_name():
    """Test that default APP_NAME produces Superset branding."""
    # Mock Flask app config with default APP_NAME
    mock_flask_app = MagicMock()
    mock_flask_app.config.get.return_value = "Superset"

    # Patch at the import location to avoid actual Flask app creation
    with patch.dict(
        "sys.modules",
        {"superset.mcp_service.flask_singleton": MagicMock(app=mock_flask_app)},
    ):
        with patch("superset.mcp_service.app.create_mcp_app") as mock_create:
            mock_mcp = MagicMock()
            mock_create.return_value = mock_mcp

            # Call with custom name to force create_mcp_app path
            init_fastmcp_server(name="Custom Name")

            # Verify create_mcp_app was called
            assert mock_create.called
            # Verify instructions use Superset branding (not Apache Superset)
            call_kwargs = mock_create.call_args[1]
            assert "Superset MCP" in call_kwargs["instructions"]
            assert "Superset dashboards" in call_kwargs["instructions"]


def test_init_fastmcp_server_with_custom_app_name():
    """Test that custom APP_NAME produces branded instructions."""
    custom_app_name = "ACME Analytics"
    # Mock Flask app config with custom APP_NAME
    mock_flask_app = MagicMock()
    mock_flask_app.config.get.return_value = custom_app_name

    # Patch at the import location to avoid actual Flask app creation
    with patch.dict(
        "sys.modules",
        {"superset.mcp_service.flask_singleton": MagicMock(app=mock_flask_app)},
    ):
        with patch("superset.mcp_service.app.create_mcp_app") as mock_create:
            mock_mcp = MagicMock()
            mock_create.return_value = mock_mcp

            # Call with custom name to force create_mcp_app path
            init_fastmcp_server(name="Custom Name")

            # Verify create_mcp_app was called
            assert mock_create.called
            # Verify instructions use custom branding
            call_kwargs = mock_create.call_args[1]
            assert custom_app_name in call_kwargs["instructions"]
            # Should not contain default Apache Superset branding
            assert "Apache Superset" not in call_kwargs["instructions"]


def test_init_fastmcp_server_derives_server_name_from_app_name():
    """Test that server name is derived from APP_NAME."""
    custom_app_name = "DataViz Platform"
    expected_server_name = f"{custom_app_name} MCP Server"

    # Mock Flask app config
    mock_flask_app = MagicMock()
    mock_flask_app.config.get.return_value = custom_app_name

    # Patch at the import location to avoid actual Flask app creation
    with patch.dict(
        "sys.modules",
        {"superset.mcp_service.flask_singleton": MagicMock(app=mock_flask_app)},
    ):
        with patch("superset.mcp_service.app.create_mcp_app") as mock_create:
            mock_mcp = MagicMock()
            mock_create.return_value = mock_mcp

            # Call without name parameter (should use default derived name)
            # Force custom params by passing instructions
            init_fastmcp_server(instructions="custom")

            # Verify create_mcp_app was called with derived name
            assert mock_create.called
            call_kwargs = mock_create.call_args[1]
            assert call_kwargs["name"] == expected_server_name
