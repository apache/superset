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
"""Tests for subdirectory deployment features."""

import os
from unittest.mock import MagicMock, patch

from werkzeug.test import EnvironBuilder

from superset.app import AppRootMiddleware, create_app
from tests.integration_tests.base_tests import SupersetTestCase


class TestSubdirectoryDeployments(SupersetTestCase):
    """Test subdirectory deployment features including middleware and app icon."""

    def setUp(self):
        super().setUp()

    # URL generation tests for alert/report screenshots
    def test_get_url_path_default_deployment(self):
        """Test URL generation works for default deployment."""
        from flask import current_app

        from superset.utils.urls import get_url_path

        # Mock the app config
        with current_app.test_request_context():
            original_root = current_app.config.get("APPLICATION_ROOT")
            original_baseurl = current_app.config.get("WEBDRIVER_BASEURL")

            try:
                current_app.config["APPLICATION_ROOT"] = "/"
                current_app.config["WEBDRIVER_BASEURL"] = "http://localhost:8088"

                url = get_url_path("Superset.dashboard", dashboard_id_or_slug=123)

                # Should not have subdirectory prefix
                assert "/superset/" not in url
                assert url.startswith("http://localhost:8088/")
            finally:
                # Restore original values
                if original_root is not None:
                    current_app.config["APPLICATION_ROOT"] = original_root
                if original_baseurl is not None:
                    current_app.config["WEBDRIVER_BASEURL"] = original_baseurl

    def test_get_url_path_subdirectory_deployment(self):
        """Test URL generation includes subdirectory prefix."""
        from flask import current_app

        from superset.utils.urls import get_url_path

        # Mock the app config for subdirectory deployment
        with current_app.test_request_context():
            original_root = current_app.config.get("APPLICATION_ROOT")
            original_baseurl = current_app.config.get("WEBDRIVER_BASEURL")

            try:
                current_app.config["APPLICATION_ROOT"] = "/superset"
                current_app.config["WEBDRIVER_BASEURL"] = "http://localhost:8088"

                url = get_url_path("Superset.dashboard", dashboard_id_or_slug=123)

                # Should include subdirectory prefix
                assert "/superset/" in url
                assert "http://localhost:8088/superset/" in url
            finally:
                # Restore original values
                if original_root is not None:
                    current_app.config["APPLICATION_ROOT"] = original_root
                if original_baseurl is not None:
                    current_app.config["WEBDRIVER_BASEURL"] = original_baseurl

    def test_get_url_path_no_double_prefix(self):
        """Test URL generation doesn't double-prefix subdirectory."""
        from flask import current_app

        from superset.utils.urls import get_url_path

        # Mock the app config for subdirectory deployment
        with current_app.test_request_context():
            original_root = current_app.config.get("APPLICATION_ROOT")
            original_baseurl = current_app.config.get("WEBDRIVER_BASEURL")

            try:
                current_app.config["APPLICATION_ROOT"] = "/superset"
                current_app.config["WEBDRIVER_BASEURL"] = "http://localhost:8088"

                url = get_url_path("Superset.dashboard", dashboard_id_or_slug=123)

                # Should not have double prefix
                assert "/superset/superset/" not in url
                assert url.count("/superset/") == 1
            finally:
                # Restore original values
                if original_root is not None:
                    current_app.config["APPLICATION_ROOT"] = original_root
                if original_baseurl is not None:
                    current_app.config["WEBDRIVER_BASEURL"] = original_baseurl

    def test_get_url_path_chart_endpoint(self):
        """Test URL generation for chart endpoints in subdirectory deployment."""
        from flask import current_app

        from superset.utils.urls import get_url_path

        # Mock the app config for subdirectory deployment
        with current_app.test_request_context():
            original_root = current_app.config.get("APPLICATION_ROOT")
            original_baseurl = current_app.config.get("WEBDRIVER_BASEURL")

            try:
                current_app.config["APPLICATION_ROOT"] = "/superset"
                current_app.config["WEBDRIVER_BASEURL"] = "http://localhost:8088"

                url = get_url_path("ExploreView.root", form_data='{"slice_id": 123}')

                # Should include subdirectory prefix
                assert "/superset/" in url
                assert "http://localhost:8088/superset/" in url
            finally:
                # Restore original values
                if original_root is not None:
                    current_app.config["APPLICATION_ROOT"] = original_root
                if original_baseurl is not None:
                    current_app.config["WEBDRIVER_BASEURL"] = original_baseurl

    # AppRootMiddleware tests (core subdirectory deployment functionality)

    def test_app_root_middleware_path_handling(self):
        """Test middleware correctly handles path prefixes."""
        # Create a mock WSGI app
        mock_app = MagicMock()
        mock_app.return_value = [b"response"]

        middleware = AppRootMiddleware(mock_app, "/superset")

        # Test with correct prefix
        environ = EnvironBuilder("/superset/dashboard").get_environ()
        start_response = MagicMock()

        result = list(middleware(environ, start_response))

        # Should call the wrapped app
        mock_app.assert_called_once()
        called_environ = mock_app.call_args[0][0]

        # PATH_INFO should be stripped of prefix
        assert called_environ["PATH_INFO"] == "/dashboard"
        # SCRIPT_NAME should be set to the prefix
        assert called_environ["SCRIPT_NAME"] == "/superset"
        assert result == [b"response"]

    def test_app_root_middleware_wrong_path_returns_404(self):
        """Test middleware returns 404 for incorrect paths."""
        # Create a mock WSGI app
        mock_app = MagicMock()

        middleware = AppRootMiddleware(mock_app, "/superset")

        # Test with incorrect prefix
        environ = EnvironBuilder("/wrong/path").get_environ()
        start_response = MagicMock()

        list(middleware(environ, start_response))

        # Should not call the wrapped app
        mock_app.assert_not_called()

        # Should return 404 response
        start_response.assert_called_once()
        status = start_response.call_args[0][0]
        assert "404" in status

    def test_app_root_middleware_root_path_handling(self):
        """Test middleware handles root path correctly."""
        # Create a mock WSGI app
        mock_app = MagicMock()
        mock_app.return_value = [b"response"]

        middleware = AppRootMiddleware(mock_app, "/superset")

        # Test with exact prefix path
        environ = EnvironBuilder("/superset").get_environ()
        start_response = MagicMock()

        list(middleware(environ, start_response))

        # Should call the wrapped app
        mock_app.assert_called_once()
        called_environ = mock_app.call_args[0][0]

        # PATH_INFO should be empty
        assert called_environ["PATH_INFO"] == ""
        # SCRIPT_NAME should be set to the prefix
        assert called_environ["SCRIPT_NAME"] == "/superset"

    # Environment variable tests
    def test_superset_app_root_environment_variable(self):
        """Test SUPERSET_APP_ROOT environment variable is respected."""
        config = self._get_test_config()

        with patch.dict(os.environ, {"SUPERSET_APP_ROOT": "/env-superset"}):
            app = create_app(config)

            # Should use environment variable value
            assert app.config["APPLICATION_ROOT"] == "/env-superset"
            assert isinstance(app.wsgi_app, AppRootMiddleware)
            assert app.wsgi_app.app_root == "/env-superset"

    def test_parameter_overrides_environment_variable(self):
        """Test superset_app_root parameter overrides environment variable."""
        config = self._get_test_config()

        with patch.dict(os.environ, {"SUPERSET_APP_ROOT": "/env-superset"}):
            app = create_app(config, superset_app_root="/param-superset")

            # Should use parameter value, not environment variable
            assert app.config["APPLICATION_ROOT"] == "/param-superset"
            assert isinstance(app.wsgi_app, AppRootMiddleware)
            assert app.wsgi_app.app_root == "/param-superset"

    # Various subdirectory names tests
    def test_various_subdirectory_names(self):
        """Test subdirectory deployment works with various subdirectory names."""
        subdirectories = ["/test", "/analytics", "/bi", "/app", "/dashboard"]

        for subdirectory in subdirectories:
            with self.subTest(subdirectory=subdirectory):
                config = self._get_test_config()
                app = create_app(config, superset_app_root=subdirectory)

                # All configuration should be consistent
                assert app.config["APPLICATION_ROOT"] == subdirectory
                assert app.config["STATIC_ASSETS_PREFIX"] == subdirectory
                assert isinstance(app.wsgi_app, AppRootMiddleware)
                assert app.wsgi_app.app_root == subdirectory

    # APP_ICON configuration tests
    def test_app_icon_default_deployment(self):
        """Test APP_ICON remains unchanged for default deployment."""
        config = {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "APP_ICON": "/static/assets/images/superset-logo-horiz.png",
        }

        app = create_app(config, superset_app_root="/")

        # APP_ICON should remain unchanged for default deployment
        assert app.config["APP_ICON"] == "/static/assets/images/superset-logo-horiz.png"

    def test_app_icon_subdirectory_deployment(self):
        """Test APP_ICON is prefixed for subdirectory deployment."""
        config = {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "APP_ICON": "/static/assets/images/superset-logo-horiz.png",
        }

        app = create_app(config, superset_app_root="/superset")

        # APP_ICON should be prefixed with subdirectory
        assert (
            app.config["APP_ICON"]
            == "/superset/static/assets/images/superset-logo-horiz.png"
        )

    def test_app_icon_custom_path_unchanged(self):
        """Test custom APP_ICON paths are not modified."""
        config = {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "APP_ICON": "/custom/path/logo.png",
        }

        app = create_app(config, superset_app_root="/superset")

        # Custom paths should remain unchanged
        assert app.config["APP_ICON"] == "/custom/path/logo.png"

    def test_app_icon_external_url_unchanged(self):
        """Test external URL APP_ICON paths are not modified."""
        config = {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "APP_ICON": "https://example.com/logo.png",
        }

        app = create_app(config, superset_app_root="/superset")

        # External URLs should remain unchanged
        assert app.config["APP_ICON"] == "https://example.com/logo.png"

    def test_app_icon_missing_config(self):
        """Test APP_ICON logic handles missing configuration gracefully."""
        config = {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            # No APP_ICON configured
        }

        app = create_app(config, superset_app_root="/superset")

        # Should not crash and should have no APP_ICON or default value
        assert (
            app.config.get("APP_ICON") is None or app.config.get("APP_ICON", "") == ""
        )

    def test_app_icon_empty_string(self):
        """Test APP_ICON logic handles empty string gracefully."""
        config = {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "APP_ICON": "",
        }

        app = create_app(config, superset_app_root="/superset")

        # Empty string should remain empty
        assert app.config["APP_ICON"] == ""

    def test_app_icon_various_subdirectories(self):
        """Test APP_ICON logic works with various subdirectory names."""
        subdirectories = [
            ("/test", "/test"),
            ("/analytics", "/analytics"),
            ("/bi", "/bi"),
            ("/app", "/app"),
        ]

        for subdirectory, expected_prefix in subdirectories:
            with self.subTest(subdirectory=subdirectory):
                config = {
                    "TESTING": True,
                    "WTF_CSRF_ENABLED": False,
                    "APP_ICON": "/static/assets/images/logo.png",
                }

                app = create_app(config, superset_app_root=subdirectory)

                expected_icon = f"{expected_prefix}/static/assets/images/logo.png"
                assert app.config["APP_ICON"] == expected_icon

    def test_static_assets_prefix_configured_with_app_icon(self):
        """Test that STATIC_ASSETS_PREFIX is also configured correctly."""
        config = {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "APP_ICON": "/static/assets/images/logo.png",
            "STATIC_ASSETS_PREFIX": "",  # Not set
        }

        app = create_app(config, superset_app_root="/superset")

        # Both should be configured for subdirectory
        assert app.config["APP_ICON"] == "/superset/static/assets/images/logo.png"
        assert app.config["STATIC_ASSETS_PREFIX"] == "/superset"

    def test_application_root_configured_with_app_icon(self):
        """Test that APPLICATION_ROOT is also configured correctly."""
        config = {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "APP_ICON": "/static/assets/images/logo.png",
            "APPLICATION_ROOT": "/",  # Default value
        }

        app = create_app(config, superset_app_root="/superset")

        # All three should be configured consistently
        assert app.config["APP_ICON"] == "/superset/static/assets/images/logo.png"
        assert app.config["STATIC_ASSETS_PREFIX"] == "/superset"
        assert app.config["APPLICATION_ROOT"] == "/superset"
