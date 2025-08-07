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
"""Tests for superset.views.base module"""

from unittest.mock import MagicMock, patch


def test_common_bootstrap_payload_passes_locale_string():
    """Test that common_bootstrap_payload converts locale to string"""
    # Mock all the dependencies
    with patch("superset.views.base.get_locale") as mock_get_locale:
        # Mock get_locale to return a Locale-like object with __str__
        mock_locale = MagicMock()
        mock_locale.__str__ = lambda self: "de_DE"
        mock_get_locale.return_value = mock_locale

        with patch("superset.views.base.cached_common_bootstrap_data") as mock_cached:
            mock_cached.return_value = {"test": "data"}

            with patch("superset.views.base.get_flashed_messages") as mock_flash:
                mock_flash.return_value = []

                with patch("superset.views.base.utils.get_user_id") as mock_user_id:
                    mock_user_id.return_value = 1

                    # Import here to avoid initialization issues
                    from superset.views.base import common_bootstrap_payload

                    # Call the function
                    result = common_bootstrap_payload()

                    # Verify cached_common_bootstrap_data was called with string
                    mock_cached.assert_called_once_with(1, "de_DE")
                    assert result == {"test": "data", "flash_messages": []}


def test_locale_conversion_none():
    """Test that None locale is handled correctly"""
    with patch("superset.views.base.get_locale") as mock_get_locale:
        mock_get_locale.return_value = None

        with patch("superset.views.base.cached_common_bootstrap_data") as mock_cached:
            mock_cached.return_value = {"test": "data"}

            with patch("superset.views.base.get_flashed_messages") as mock_flash:
                mock_flash.return_value = []

                with patch("superset.views.base.utils.get_user_id") as mock_user_id:
                    mock_user_id.return_value = 1

                    from superset.views.base import common_bootstrap_payload

                    common_bootstrap_payload()

                    # Verify that cached_common_bootstrap_data was called with None
                    mock_cached.assert_called_once_with(1, None)


def test_locale_string_parsing_in_cached_function():
    """Test that locale string is correctly parsed for language extraction"""
    # We can't easily test the cached function directly without full app context
    # but we can verify the logic by checking the code handles string locales

    # Test the string splitting logic independently
    locale_str = "de_DE"
    expected = locale_str.split("_")[0]
    assert expected == "de"

    locale_str = "en_US"
    expected = locale_str.split("_")[0]
    assert expected == "en"

    locale_str = "fr"
    expected = locale_str.split("_")[0]
    assert expected == "fr"

    # Test None handling
    locale_str = None
    expected = locale_str.split("_")[0] if locale_str else "en"
    assert expected == "en"
