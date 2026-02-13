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
        with patch("superset.mcp_service.app.mcp") as mock_mcp:
            init_fastmcp_server()

            # Verify the global mcp instance was configured with Superset branding
            assert "Superset MCP" in mock_mcp._mcp_server.instructions
            assert "Superset dashboards" in mock_mcp._mcp_server.instructions


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
        with patch("superset.mcp_service.app.mcp") as mock_mcp:
            init_fastmcp_server()

            # Verify instructions use custom branding
            assert custom_app_name in mock_mcp._mcp_server.instructions
            # Should not contain default Apache Superset branding
            assert "Apache Superset" not in mock_mcp._mcp_server.instructions


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
        with patch("superset.mcp_service.app.mcp") as mock_mcp:
            init_fastmcp_server()

            # Verify the global mcp instance got the derived name
            assert mock_mcp._mcp_server.name == expected_server_name


def test_init_fastmcp_server_applies_auth_to_global_instance():
    """Test that auth is applied to the global mcp instance, not a new one."""
    mock_flask_app = MagicMock()
    mock_flask_app.config.get.return_value = "Superset"
    mock_auth = MagicMock()

    with patch.dict(
        "sys.modules",
        {"superset.mcp_service.flask_singleton": MagicMock(app=mock_flask_app)},
    ):
        with patch("superset.mcp_service.app.mcp") as mock_mcp:
            result = init_fastmcp_server(auth=mock_auth)

            # Auth should be set on the global instance
            assert mock_mcp.auth == mock_auth
            # Should return the global instance (not a new one)
            assert result is mock_mcp


def test_init_fastmcp_server_applies_middleware_to_global_instance():
    """Test that middleware is added to the global mcp instance."""
    mock_flask_app = MagicMock()
    mock_flask_app.config.get.return_value = "Superset"
    mock_mw = MagicMock()

    with patch.dict(
        "sys.modules",
        {"superset.mcp_service.flask_singleton": MagicMock(app=mock_flask_app)},
    ):
        with patch("superset.mcp_service.app.mcp") as mock_mcp:
            init_fastmcp_server(middleware=[mock_mw])

            # Middleware should be added via add_middleware
            mock_mcp.add_middleware.assert_called_once_with(mock_mw)


def test_get_default_instructions_without_unavailable_features():
    """Test that no unavailable features section appears when list is empty."""
    instructions = get_default_instructions()
    assert "Unavailable Features" not in instructions

    instructions_empty = get_default_instructions(unavailable_features=[])
    assert "Unavailable Features" not in instructions_empty

    instructions_none = get_default_instructions(unavailable_features=None)
    assert "Unavailable Features" not in instructions_none


def test_get_default_instructions_with_unavailable_features():
    """Test that unavailable features section is included when list is non-empty."""
    features = [
        "Action Log (Settings > Security > Action Log)",
        "List Users page (Settings > List Users)",
    ]
    instructions = get_default_instructions(unavailable_features=features)

    assert "IMPORTANT - Unavailable Features" in instructions
    assert "Action Log (Settings > Security > Action Log)" in instructions
    assert "List Users page (Settings > List Users)" in instructions
    assert "Do NOT suggest" in instructions
    assert "suggest alternatives using the MCP tools" in instructions


def test_init_fastmcp_server_reads_unavailable_features_from_config():
    """Test that init_fastmcp_server reads MCP_UNAVAILABLE_FEATURES from Flask config."""
    features = ["Action Log", "List Users"]
    mock_flask_app = MagicMock()

    def config_get(key, default=None):
        if key == "APP_NAME":
            return "Superset"
        if key == "MCP_UNAVAILABLE_FEATURES":
            return features
        return default

    mock_flask_app.config.get.side_effect = config_get

    with patch.dict(
        "sys.modules",
        {"superset.mcp_service.flask_singleton": MagicMock(app=mock_flask_app)},
    ):
        with patch("superset.mcp_service.app.mcp") as mock_mcp:
            init_fastmcp_server()

            instructions = mock_mcp._mcp_server.instructions
            assert "Unavailable Features" in instructions
            assert "Action Log" in instructions
            assert "List Users" in instructions
