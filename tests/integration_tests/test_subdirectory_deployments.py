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

from unittest.mock import MagicMock
from urllib.parse import parse_qs, urlparse

from werkzeug.test import EnvironBuilder

from superset.app import AppRootMiddleware
from superset.views.utils import redirect_to_login
from tests.integration_tests.base_tests import SupersetTestCase


class TestSubdirectoryDeployments(SupersetTestCase):
    """Test subdirectory deployment features including middleware."""

    def setUp(self):
        super().setUp()

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

    def test_redirect_to_login_with_app_root(self):
        """Test that redirect_to_login includes app root in next parameter."""
        with self.app.test_request_context(
            "/superset/welcome/",
            environ_overrides={"SCRIPT_NAME": "/analytics"},
        ):
            response = redirect_to_login()
            parsed_url = urlparse(response.location)
            query_params = parse_qs(parsed_url.query)

            # The next parameter should include the app root prefix
            assert "next" in query_params
            assert query_params["next"][0] == "/analytics/superset/welcome/"

    def test_redirect_to_login_with_query_string_and_app_root(self):
        """Test that redirect_to_login preserves query string with app root."""
        with self.app.test_request_context(
            "/superset/welcome/?foo=bar",
            environ_overrides={"SCRIPT_NAME": "/analytics"},
        ):
            response = redirect_to_login()
            parsed_url = urlparse(response.location)
            query_params = parse_qs(parsed_url.query)

            # The next parameter should include both app root and query string
            assert "next" in query_params
            assert query_params["next"][0] == "/analytics/superset/welcome/?foo=bar"

    def test_redirect_to_login_without_app_root(self):
        """Test that redirect_to_login works without app root (no regression)."""
        with self.app.test_request_context("/superset/welcome/"):
            response = redirect_to_login()
            parsed_url = urlparse(response.location)
            query_params = parse_qs(parsed_url.query)

            # The next parameter should be the path without any prefix
            assert "next" in query_params
            assert query_params["next"][0] == "/superset/welcome/"

    def test_redirect_to_login_with_custom_target_and_app_root(self):
        """Test that redirect_to_login respects custom target parameter."""
        with self.app.test_request_context(
            "/some/other/path",
            environ_overrides={"SCRIPT_NAME": "/analytics"},
        ):
            # When next_target is explicitly provided, it should be used as-is
            custom_target = "/custom/target"
            response = redirect_to_login(next_target=custom_target)
            parsed_url = urlparse(response.location)
            query_params = parse_qs(parsed_url.query)

            assert "next" in query_params
            assert query_params["next"][0] == custom_target
