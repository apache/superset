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

from unittest.mock import MagicMock, patch

import pytest

from superset.utils.webdriver import WebDriverSelenium


@pytest.fixture
def mock_app():
    """Mock Flask app with webdriver configuration."""
    app = MagicMock()
    app.config = {
        "WEBDRIVER_TYPE": "chrome",
        "WEBDRIVER_OPTION_ARGS": [],
        "WEBDRIVER_CONFIGURATION": {},
        "SCREENSHOT_LOCATE_WAIT": 10,
        "SCREENSHOT_LOAD_WAIT": 10,
    }
    return app


class TestWebDriverSelenium:
    """Test WebDriverSelenium timeout handling for urllib3 2.x compatibility."""

    @patch("superset.utils.webdriver.app")
    @patch("superset.utils.webdriver.firefox")
    @patch("superset.utils.webdriver.chrome")
    def test_timeout_conversion_to_float(
        self, mock_chrome, mock_firefox, mock_app_patch, mock_app
    ):
        """Test that timeout values are properly converted to float."""
        # Set up app mock to be used throughout
        mock_app_patch.config = {
            "WEBDRIVER_TYPE": "chrome",
            "WEBDRIVER_OPTION_ARGS": [],
            "SCREENSHOT_LOCATE_WAIT": 10,
            "SCREENSHOT_LOAD_WAIT": 10,
            "WEBDRIVER_WINDOW": {},
            "WEBDRIVER_CONFIGURATION": {
                "timeout": "30",
                "connect_timeout": "10.5",
                "socket_timeout": 20,
                "read_timeout": "15.0",
                "command_executor_timeout": "25",
            },
        }

        mock_driver_class = MagicMock()
        mock_chrome.webdriver.WebDriver = mock_driver_class
        mock_chrome.service.Service = MagicMock()
        mock_options = MagicMock()
        mock_options.add_argument = MagicMock()
        mock_chrome.options.Options = MagicMock(return_value=mock_options)

        driver = WebDriverSelenium(driver_type="chrome")
        driver.create()

        # Check that the driver was called with float timeout values
        mock_driver_class.assert_called_once()
        call_kwargs = mock_driver_class.call_args.kwargs
        assert call_kwargs["timeout"] == 30.0
        assert call_kwargs["connect_timeout"] == 10.5
        assert call_kwargs["socket_timeout"] == 20.0
        assert call_kwargs["read_timeout"] == 15.0
        assert call_kwargs["command_executor_timeout"] == 25.0

    @patch("superset.utils.webdriver.app")
    @patch("superset.utils.webdriver.chrome")
    def test_timeout_none_handling(self, mock_chrome, mock_app_patch, mock_app):
        """Test that None, 'None', and 'null' timeout values are set to None."""
        mock_app_patch.config = {
            "WEBDRIVER_TYPE": "chrome",
            "WEBDRIVER_OPTION_ARGS": [],
            "SCREENSHOT_LOCATE_WAIT": 10,
            "SCREENSHOT_LOAD_WAIT": 10,
            "WEBDRIVER_WINDOW": {},
            "WEBDRIVER_CONFIGURATION": {
                "timeout": None,
                "connect_timeout": "None",
                "socket_timeout": "null",
            },
        }

        mock_driver_class = MagicMock()
        mock_chrome.webdriver.WebDriver = mock_driver_class
        mock_chrome.service.Service = MagicMock()
        mock_options = MagicMock()
        mock_options.add_argument = MagicMock()
        mock_chrome.options.Options = MagicMock(return_value=mock_options)

        driver = WebDriverSelenium(driver_type="chrome")
        driver.create()

        # Check that None values are preserved
        mock_driver_class.assert_called_once()
        call_kwargs = mock_driver_class.call_args.kwargs
        assert call_kwargs["timeout"] is None
        assert call_kwargs["connect_timeout"] is None
        assert call_kwargs["socket_timeout"] is None

    @patch("superset.utils.webdriver.app")
    @patch("superset.utils.webdriver.chrome")
    @patch("superset.utils.webdriver.logger")
    def test_invalid_timeout_warning(
        self, mock_logger, mock_chrome, mock_app_patch, mock_app
    ):
        """Test that invalid timeout values log warnings and are set to None."""
        mock_app_patch.config = {
            "WEBDRIVER_TYPE": "chrome",
            "WEBDRIVER_OPTION_ARGS": [],
            "SCREENSHOT_LOCATE_WAIT": 10,
            "SCREENSHOT_LOAD_WAIT": 10,
            "WEBDRIVER_WINDOW": {},
            "WEBDRIVER_CONFIGURATION": {
                "timeout": "invalid",
                "connect_timeout": "not_a_number",
                "Page_Load_Timeout": "abc123",  # Test case-insensitive matching
            },
        }

        mock_driver_class = MagicMock()
        mock_chrome.webdriver.WebDriver = mock_driver_class
        mock_chrome.service.Service = MagicMock()
        mock_options = MagicMock()
        mock_options.add_argument = MagicMock()
        mock_chrome.options.Options = MagicMock(return_value=mock_options)

        driver = WebDriverSelenium(driver_type="chrome")
        driver.create()

        # Check that invalid values are set to None
        mock_driver_class.assert_called_once()
        call_kwargs = mock_driver_class.call_args.kwargs
        assert call_kwargs["timeout"] is None
        assert call_kwargs["connect_timeout"] is None
        assert call_kwargs["Page_Load_Timeout"] is None

        # Check that warnings were logged
        assert mock_logger.warning.call_count == 3
        mock_logger.warning.assert_any_call(
            "Invalid timeout value for timeout: invalid, setting to None"
        )
        mock_logger.warning.assert_any_call(
            "Invalid timeout value for connect_timeout: not_a_number, setting to None"
        )
        mock_logger.warning.assert_any_call(
            "Invalid timeout value for Page_Load_Timeout: abc123, setting to None"
        )

    @patch("superset.utils.webdriver.app")
    @patch("superset.utils.webdriver.chrome")
    def test_non_timeout_config_preserved(self, mock_chrome, mock_app_patch, mock_app):
        """Test that non-timeout configuration values are preserved."""
        mock_app_patch.config = {
            "WEBDRIVER_TYPE": "chrome",
            "WEBDRIVER_OPTION_ARGS": [],
            "SCREENSHOT_LOCATE_WAIT": 10,
            "SCREENSHOT_LOAD_WAIT": 10,
            "WEBDRIVER_WINDOW": {},
            "WEBDRIVER_CONFIGURATION": {
                "timeout": "30",
                "some_other_option": "value",
                "another_option": 123,
                "boolean_option": True,
            },
        }

        mock_driver_class = MagicMock()
        mock_chrome.webdriver.WebDriver = mock_driver_class
        mock_chrome.service.Service = MagicMock()
        mock_options = MagicMock()
        mock_options.add_argument = MagicMock()
        mock_chrome.options.Options = MagicMock(return_value=mock_options)

        driver = WebDriverSelenium(driver_type="chrome")
        driver.create()

        # Check that all config values are passed through
        mock_driver_class.assert_called_once()
        call_kwargs = mock_driver_class.call_args.kwargs
        assert call_kwargs["timeout"] == 30.0
        assert call_kwargs["some_other_option"] == "value"
        assert call_kwargs["another_option"] == 123
        assert call_kwargs["boolean_option"] is True

    @patch("superset.utils.webdriver.app")
    @patch("superset.utils.webdriver.chrome")
    def test_timeout_key_case_insensitive(self, mock_chrome, mock_app_patch, mock_app):
        """Test that timeout detection is case-insensitive."""
        mock_app_patch.config = {
            "WEBDRIVER_TYPE": "chrome",
            "WEBDRIVER_OPTION_ARGS": [],
            "SCREENSHOT_LOCATE_WAIT": 10,
            "SCREENSHOT_LOAD_WAIT": 10,
            "WEBDRIVER_WINDOW": {},
            "WEBDRIVER_CONFIGURATION": {
                "TIMEOUT": "10",
                "Connect_Timeout": "20",
                "SOCKET_TIMEOUT": "30",
                "connection_timeout_ms": "5000",  # Contains 'connection_timeout'
            },
        }

        mock_driver_class = MagicMock()
        mock_chrome.webdriver.WebDriver = mock_driver_class
        mock_chrome.service.Service = MagicMock()
        mock_options = MagicMock()
        mock_options.add_argument = MagicMock()
        mock_chrome.options.Options = MagicMock(return_value=mock_options)

        driver = WebDriverSelenium(driver_type="chrome")
        driver.create()

        # Check that all timeout values are converted to float
        mock_driver_class.assert_called_once()
        call_kwargs = mock_driver_class.call_args.kwargs
        assert call_kwargs["TIMEOUT"] == 10.0
        assert call_kwargs["Connect_Timeout"] == 20.0
        assert call_kwargs["SOCKET_TIMEOUT"] == 30.0
        assert call_kwargs["connection_timeout_ms"] == 5000.0

    @patch("superset.utils.webdriver.app")
    @patch("superset.utils.webdriver.chrome")
    def test_empty_webdriver_config(self, mock_chrome, mock_app_patch, mock_app):
        """Test handling of empty webdriver configuration."""
        mock_app_patch.config = {
            "WEBDRIVER_TYPE": "chrome",
            "WEBDRIVER_OPTION_ARGS": [],
            "SCREENSHOT_LOCATE_WAIT": 10,
            "SCREENSHOT_LOAD_WAIT": 10,
            "WEBDRIVER_WINDOW": {},
            "WEBDRIVER_CONFIGURATION": {},
        }

        mock_driver_class = MagicMock()
        mock_chrome.webdriver.WebDriver = mock_driver_class
        mock_chrome.service.Service = MagicMock()
        mock_options = MagicMock()
        mock_options.add_argument = MagicMock()
        mock_chrome.options.Options = MagicMock(return_value=mock_options)

        driver = WebDriverSelenium(driver_type="chrome")
        driver.create()

        # Should create driver without errors
        mock_driver_class.assert_called_once()
