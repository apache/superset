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

"""Tests for MCP service URL utilities."""

from unittest.mock import MagicMock, patch

from superset.mcp_service.utils.url_utils import (
    get_mcp_service_url,
    get_superset_base_url,
)


class TestUrlUtils:
    """Test MCP service URL utility functions."""

    def test_get_superset_base_url_default(self):
        """Test get_superset_base_url returns default when no config available."""
        with patch("superset.mcp_service.utils.url_utils.current_app") as mock_app:
            mock_app.config = MagicMock()
            mock_app.config.get.side_effect = Exception("No config")
            url = get_superset_base_url()
            assert url == "http://localhost:9001"

    def test_get_superset_base_url_from_config(self):
        """Test get_superset_base_url uses SUPERSET_WEBSERVER_ADDRESS from config."""
        with patch("superset.mcp_service.utils.url_utils.current_app") as mock_app:
            mock_app.config = MagicMock()
            mock_app.config.get.return_value = "https://my-superset.com"
            url = get_superset_base_url()
            assert url == "https://my-superset.com"

    def test_get_superset_base_url_fallback_construction(self):
        """Test get_superset_base_url constructs URL from other config values."""
        with patch("superset.mcp_service.utils.url_utils.current_app") as mock_app:

            def mock_config_get(key, default=None):
                config_map = {
                    "SUPERSET_WEBSERVER_ADDRESS": None,
                    "PUBLIC_ROLE_LIKE_GAMMA": True,
                    "ENABLE_PROXY_FIX": True,
                    "WEBSERVER_HOST": "superset.example.com",
                    "WEBSERVER_PORT": 443,
                }
                return config_map.get(key, default)

            mock_app.config = MagicMock()
            mock_app.config.get.side_effect = mock_config_get
            url = get_superset_base_url()
            assert url == "https://superset.example.com:443"

    def test_get_superset_base_url_fallback_http(self):
        """Test get_superset_base_url uses HTTP when ENABLE_PROXY_FIX is False."""
        with patch("superset.mcp_service.utils.url_utils.current_app") as mock_app:

            def mock_config_get(key, default=None):
                config_map = {
                    "SUPERSET_WEBSERVER_ADDRESS": None,
                    "PUBLIC_ROLE_LIKE_GAMMA": True,
                    "ENABLE_PROXY_FIX": False,
                    "WEBSERVER_HOST": "localhost",
                    "WEBSERVER_PORT": 8080,
                }
                return config_map.get(key, default)

            mock_app.config = MagicMock()
            mock_app.config.get.side_effect = mock_config_get
            url = get_superset_base_url()
            assert url == "http://localhost:8080"

    def test_get_mcp_service_url_default(self):
        """Test get_mcp_service_url returns MCP service default URL."""
        with patch("superset.mcp_service.utils.url_utils.current_app") as mock_app:
            mock_app.config = MagicMock()
            mock_app.config.get.side_effect = Exception("No config")
            url = get_mcp_service_url()
            assert url == "http://localhost:5008"  # MCP service default

    def test_get_mcp_service_url_from_config(self):
        """Test get_mcp_service_url uses same URL as Superset."""
        with patch("superset.mcp_service.utils.url_utils.current_app") as mock_app:
            mock_app.config = MagicMock()
            mock_app.config.get.return_value = "https://my-superset.com"
            url = get_mcp_service_url()
            assert url == "https://my-superset.com"  # Same as Superset

    def test_get_mcp_service_url_exception_handling(self):
        """Test get_mcp_service_url handles exceptions gracefully."""
        with patch("superset.mcp_service.utils.url_utils.current_app") as mock_app:
            mock_app.config = MagicMock()
            mock_app.config.get.side_effect = Exception("Config error")
            url = get_mcp_service_url()
            assert url == "http://localhost:5008"  # MCP service default

    def test_url_functions_integration(self):
        """Test that URL functions work independently."""
        with patch("superset.mcp_service.utils.url_utils.current_app") as mock_app:

            def mock_config_get(key, default=None):
                config_map = {
                    "SUPERSET_WEBSERVER_ADDRESS": "https://superset.example.com",
                    "MCP_SERVICE_URL": "https://mcp.example.com",
                }
                return config_map.get(key, default)

            mock_app.config = MagicMock()
            mock_app.config.get.side_effect = mock_config_get

            superset_url = get_superset_base_url()
            mcp_url = get_mcp_service_url()

            assert superset_url == "https://superset.example.com"
            assert mcp_url == "https://mcp.example.com"  # Independent of Superset
            assert superset_url != mcp_url  # They are independent services
