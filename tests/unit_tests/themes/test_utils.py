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


import pytest

from superset.themes.types import ThemeMode
from superset.themes.utils import (
    _is_valid_algorithm,
    _is_valid_theme_mode,
    is_valid_theme,
    sanitize_theme_tokens,
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


def test_sanitize_theme_tokens_with_svg():
    """Test that theme tokens with SVG content get sanitized."""
    theme_config = {
        "token": {
            "brandSpinnerSvg": (
                '<svg><script>alert("xss")</script><rect width="10"/></svg>'
            ),
            "colorPrimary": "#ff0000",
        }
    }
    result = sanitize_theme_tokens(theme_config)

    assert "script" not in result["token"]["brandSpinnerSvg"].lower()
    assert result["token"]["colorPrimary"] == "#ff0000"  # Other tokens unchanged


def test_sanitize_theme_tokens_with_url():
    """Test that theme tokens with URL get sanitized."""
    theme_config = {
        "token": {
            "brandSpinnerUrl": "javascript:alert('xss')",
            "colorPrimary": "#ff0000",
        }
    }
    result = sanitize_theme_tokens(theme_config)

    assert result["token"]["brandSpinnerUrl"] == ""  # Blocked
    assert result["token"]["colorPrimary"] == "#ff0000"  # Unchanged


def test_sanitize_theme_tokens_no_spinner_tokens():
    """Test that themes without spinner tokens are unchanged."""
    theme_config = {"token": {"colorPrimary": "#ff0000", "fontFamily": "Arial"}}
    result = sanitize_theme_tokens(theme_config)
    assert result == theme_config
