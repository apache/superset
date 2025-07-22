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

from unittest.mock import patch

import pytest

from superset.themes.types import ThemeMode, ThemeSettingsKey
from superset.themes.utils import (
    _is_valid_algorithm,
    _is_valid_theme_mode,
    is_valid_theme,
    is_valid_theme_settings,
)


@pytest.mark.parametrize(
    "mode, expected",
    [
        (ThemeMode.DEFAULT.value, True),
        (ThemeMode.DARK.value, True),
        (ThemeMode.SYSTEM.value, True),
        ("foo", False),
    ],
)
def test_is_valid_theme_mode(mode, expected):
    assert _is_valid_theme_mode(mode) is expected


@pytest.mark.parametrize(
    "algorithm, expected",
    [
        ("default", True),
        (ThemeMode.SYSTEM.value, True),
        ([ThemeMode.DEFAULT.value, ThemeMode.DARK.value], True),
        ([ThemeMode.DEFAULT.value, "foo"], False),
        (123, False),
        ([ThemeMode.DEFAULT.value, 123], False),
    ],
)
def test_is_valid_algorithm(algorithm, expected):
    assert _is_valid_algorithm(algorithm) is expected


@pytest.mark.parametrize(
    "theme, expected",
    [
        ([], False),  # not a dict
        ("string", False),
        ({}, True),  # empty dict
        ({"token": {}, "components": {}, "hashed": True, "inherit": False}, True),
        (
            {
                "token": [],
            },
            False,
        ),  # wrong type for token
        ({"algorithm": "default"}, True),
        ({"algorithm": "foo"}, False),
        ({"algorithm": ["default", "dark"]}, True),
        ({"algorithm": ["default", "foo"]}, False),
    ],
)
def test_is_valid_theme(theme, expected):
    assert is_valid_theme(theme) is expected


@pytest.mark.parametrize(
    "settings, expected",
    [
        ([], False),  # not a dict
        ("string", False),
        ({}, True),  # empty
        ({key.value: True for key in ThemeSettingsKey}, True),
        ({"enforced": True, "foo": False}, False),  # invalid key
        ({"enforced": "yes"}, False),  # invalid value type
    ],
)
def test_is_valid_theme_settings(settings, expected):
    assert is_valid_theme_settings(settings) is expected


class TestThemeDAOIntegration:
    """Integration tests for ThemeDAO with theme utils"""

    @patch("superset.daos.theme.ThemeDAO.find_by_uuid")
    def test_resolve_theme_with_uuid_integration(self, mock_find_by_uuid):
        """Test resolve_theme_with_uuid integration with actual theme validation"""
        from unittest.mock import Mock

        from superset.daos.theme import ThemeDAO
        from superset.models.core import Theme

        # Arrange
        mock_theme = Mock(spec=Theme)
        mock_theme.json_data = (
            '{"algorithm": "dark", "token": {"colorPrimary": "#000"}}'
        )
        mock_find_by_uuid.return_value = mock_theme

        theme_config = {"uuid": "test-uuid", "algorithm": "default"}

        # Act
        result = ThemeDAO.resolve_theme_with_uuid(theme_config)

        # Assert - Result should be valid theme
        assert is_valid_theme(result) is True
        assert result["algorithm"] == "dark"
