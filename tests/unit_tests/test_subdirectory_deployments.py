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

from unittest.mock import patch

import pytest

from superset.app import create_app
from tests.integration_tests.base_tests import SupersetTestCase


class TestSubdirectoryDeployments(SupersetTestCase):
    """Test subdirectory deployment features for both app config and views."""

    def setUp(self):
        super().setUp()

    # Swagger redirect view tests
    def test_swagger_redirect_default_deployment(self):
        """Test swagger redirect works for default deployment."""
        self.login()

        with patch("superset.views.core.app.config") as mock_config:
            mock_config.get.side_effect = lambda key, default=None: {
                "FAB_API_SWAGGER_UI": True,
                "APPLICATION_ROOT": "/",
            }.get(key, default)

            resp = self.client.get("/swagger/v1")

            assert resp.status_code == 302
            assert resp.location == "/api/v1/swagger"

    def test_swagger_redirect_subdirectory_deployment(self):
        """Test swagger redirect works for subdirectory deployment."""
        self.login()

        with patch("superset.views.core.app.config") as mock_config:
            mock_config.get.side_effect = lambda key, default=None: {
                "FAB_API_SWAGGER_UI": True,
                "APPLICATION_ROOT": "/superset",
            }.get(key, default)

            resp = self.client.get("/swagger/v1")

            assert resp.status_code == 302
            assert resp.location == "/superset/api/v1/swagger"

    def test_swagger_redirect_with_trailing_slash(self):
        """Test swagger redirect handles trailing slashes correctly."""
        self.login()

        with patch("superset.views.core.app.config") as mock_config:
            mock_config.get.side_effect = lambda key, default=None: {
                "FAB_API_SWAGGER_UI": True,
                "APPLICATION_ROOT": "/superset/",
            }.get(key, default)

            resp = self.client.get("/swagger/v1")

            assert resp.status_code == 302
            assert resp.location == "/superset/api/v1/swagger"
            # Ensure no double slashes
            assert "//" not in resp.location

    def test_swagger_redirect_disabled(self):
        """Test swagger redirect returns 404 when swagger is disabled."""
        self.login()

        with patch("superset.views.core.app.config") as mock_config:
            mock_config.get.side_effect = lambda key, default=None: {
                "FAB_API_SWAGGER_UI": False,
                "APPLICATION_ROOT": "/",
            }.get(key, default)

            resp = self.client.get("/swagger/v1")

            assert resp.status_code == 404

    def test_swagger_redirect_requires_authentication(self):
        """Test swagger redirect requires authentication."""
        # Don't log in - should redirect to login
        resp = self.client.get("/swagger/v1")

        assert resp.status_code == 302
        assert "/login/" in resp.location

    @pytest.mark.parametrize("subdirectory", ["/test", "/analytics", "/bi"])
    def test_swagger_redirect_various_subdirectories(self, subdirectory):
        """Test swagger redirect works with various subdirectory names."""
        self.login()

        with patch("superset.views.core.app.config") as mock_config:
            mock_config.get.side_effect = lambda key, default=None: {
                "FAB_API_SWAGGER_UI": True,
                "APPLICATION_ROOT": subdirectory,
            }.get(key, default)

            resp = self.client.get("/swagger/v1")

            assert resp.status_code == 302
            assert resp.location == f"{subdirectory}/api/v1/swagger"

    # APP_ICON configuration tests
    def test_app_icon_default_deployment(self):
        """Test APP_ICON remains unchanged for default deployment."""
        config = {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "APP_ICON": "/static/assets/images/superset-logo-horiz.png",
        }

        with patch("superset.app.guess_app_root") as mock_guess:
            mock_guess.return_value = "/"

            app = create_app(config)

            # APP_ICON should remain unchanged for default deployment
            assert (
                app.config["APP_ICON"]
                == "/static/assets/images/superset-logo-horiz.png"
            )

    def test_app_icon_subdirectory_deployment(self):
        """Test APP_ICON is prefixed for subdirectory deployment."""
        config = {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "APP_ICON": "/static/assets/images/superset-logo-horiz.png",
        }

        with patch("superset.app.guess_app_root") as mock_guess:
            mock_guess.return_value = "/superset"

            app = create_app(config)

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

        with patch("superset.app.guess_app_root") as mock_guess:
            mock_guess.return_value = "/superset"

            app = create_app(config)

            # Custom paths should remain unchanged
            assert app.config["APP_ICON"] == "/custom/path/logo.png"

    def test_app_icon_external_url_unchanged(self):
        """Test external URL APP_ICON paths are not modified."""
        config = {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "APP_ICON": "https://example.com/logo.png",
        }

        with patch("superset.app.guess_app_root") as mock_guess:
            mock_guess.return_value = "/superset"

            app = create_app(config)

            # External URLs should remain unchanged
            assert app.config["APP_ICON"] == "https://example.com/logo.png"

    def test_app_icon_missing_config(self):
        """Test APP_ICON logic handles missing configuration gracefully."""
        config = {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            # No APP_ICON configured
        }

        with patch("superset.app.guess_app_root") as mock_guess:
            mock_guess.return_value = "/superset"

            app = create_app(config)

            # Should not crash and should have no APP_ICON or default value
            assert (
                app.config.get("APP_ICON") is None
                or app.config.get("APP_ICON", "") == ""
            )

    def test_app_icon_empty_string(self):
        """Test APP_ICON logic handles empty string gracefully."""
        config = {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "APP_ICON": "",
        }

        with patch("superset.app.guess_app_root") as mock_guess:
            mock_guess.return_value = "/superset"

            app = create_app(config)

            # Empty string should remain empty
            assert app.config["APP_ICON"] == ""

    @pytest.mark.parametrize(
        "subdirectory,expected_prefix",
        [
            ("/test", "/test"),
            ("/analytics", "/analytics"),
            ("/bi", "/bi"),
            ("/app", "/app"),
        ],
    )
    def test_app_icon_various_subdirectories(self, subdirectory, expected_prefix):
        """Test APP_ICON logic works with various subdirectory names."""
        config = {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "APP_ICON": "/static/assets/images/logo.png",
        }

        with patch("superset.app.guess_app_root") as mock_guess:
            mock_guess.return_value = subdirectory

            app = create_app(config)

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

        with patch("superset.app.guess_app_root") as mock_guess:
            mock_guess.return_value = "/superset"

            app = create_app(config)

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

        with patch("superset.app.guess_app_root") as mock_guess:
            mock_guess.return_value = "/superset"

            app = create_app(config)

            # All three should be configured consistently
            assert app.config["APP_ICON"] == "/superset/static/assets/images/logo.png"
            assert app.config["STATIC_ASSETS_PREFIX"] == "/superset"
            assert app.config["APPLICATION_ROOT"] == "/superset"
