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

import pytest


@patch("superset.views.base.utils.get_user_id", return_value=1)
@patch(
    "superset.views.base.cached_common_bootstrap_data", return_value={"test": "data"}
)
@patch("superset.views.base.get_locale")
def test_common_bootstrap_payload_converts_locale_to_string(
    mock_get_locale: MagicMock,
    mock_cached: MagicMock,
    mock_user_id: MagicMock,
) -> None:
    """Test that common_bootstrap_payload converts locale to string for cache key"""

    # Mock get_locale to return a Locale-like object
    # Use a simple class with __str__ since MagicMock's __str__ doesn't work with str()
    class MockLocale:
        def __str__(self) -> str:
            return "de_DE"

    mock_get_locale.return_value = MockLocale()

    # Import here to avoid initialization issues
    from superset.views.base import common_bootstrap_payload

    result = common_bootstrap_payload()

    # Verify cached_common_bootstrap_data was called with string locale
    mock_cached.assert_called_once_with(1, "de_DE")
    assert result == {"test": "data"}


@patch("superset.views.base.utils.get_user_id", return_value=1)
@patch(
    "superset.views.base.cached_common_bootstrap_data", return_value={"test": "data"}
)
@patch("superset.views.base.get_locale", return_value=None)
def test_common_bootstrap_payload_handles_none_locale(
    mock_get_locale: MagicMock,
    mock_cached: MagicMock,
    mock_user_id: MagicMock,
) -> None:
    """Test that None locale is passed through correctly"""
    from superset.views.base import common_bootstrap_payload

    common_bootstrap_payload()

    mock_cached.assert_called_once_with(1, None)


def _extract_language(locale_str: str | None) -> str:
    """Helper that mirrors the logic in cached_common_bootstrap_data"""
    if locale_str:
        return locale_str.replace("-", "_").split("_")[0]
    return "en"


@pytest.mark.parametrize(
    "locale_str,expected_language",
    [
        ("de_DE", "de"),  # underscore format
        ("en_US", "en"),
        ("fr_FR", "fr"),
        ("de-DE", "de"),  # hyphen format
        ("en-US", "en"),
        ("zh-Hans", "zh"),
        ("fr", "fr"),  # no separator
        ("es", "es"),
        ("en", "en"),
        (None, "en"),  # None defaults to "en"
    ],
)
def test_locale_language_extraction(
    locale_str: str | None, expected_language: str
) -> None:
    """Test that language is correctly extracted from various locale formats"""
    result = _extract_language(locale_str)
    assert result == expected_language
