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
    sanitize_svg_content,
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


def test_sanitize_svg_content_safe_svg():
    """Test that safe SVG content passes through unchanged."""
    safe_svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">'
        '<rect x="1" y="4" width="6" height="14" fill="currentColor">'
        '<animate attributeName="opacity" dur="0.75s" values="1;0.2"/>'
        "</rect></svg>"
    )
    result = sanitize_svg_content(safe_svg)
    assert "<svg" in result
    assert "rect" in result
    assert "animate" in result
    assert 'attributename="opacity"' in result


def test_sanitize_svg_content_removes_scripts():
    """Test that script tags are removed from SVG content."""
    malicious_svg = (
        '<svg><script>alert("xss")</script><rect width="10" height="10"/></svg>'
    )
    result = sanitize_svg_content(malicious_svg)
    assert "script" not in result.lower()
    assert "alert" not in result
    assert "rect" in result


def test_sanitize_svg_content_removes_event_handlers():
    """Test that event handlers are removed from SVG elements."""
    malicious_svg = '<svg><rect onclick="alert(1)" width="10" height="10"/></svg>'
    result = sanitize_svg_content(malicious_svg)
    assert "onclick" not in result.lower()
    assert "alert" not in result
    assert "rect" in result


def test_sanitize_svg_content_invalid_structure():
    """Test that invalid SVG structure returns empty string."""
    assert sanitize_svg_content("not svg") == ""
    assert sanitize_svg_content("<div>not svg</div>") == ""
    assert sanitize_svg_content("") == ""


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
    assert "alert" not in result["token"]["brandSpinnerSvg"]
    assert result["token"]["colorPrimary"] == "#ff0000"  # Other tokens unchanged


def test_sanitize_theme_tokens_no_svg():
    """Test that themes without SVG content are unchanged."""
    theme_config = {
        "token": {"colorPrimary": "#ff0000", "brandSpinnerUrl": "/spinner.gif"}
    }
    result = sanitize_theme_tokens(theme_config)
    assert result == theme_config


def test_sanitize_theme_tokens_empty_svg():
    """Test that empty SVG content is handled properly."""
    theme_config = {"token": {"brandSpinnerSvg": "", "colorPrimary": "#ff0000"}}
    result = sanitize_theme_tokens(theme_config)
    assert result["token"]["brandSpinnerSvg"] == ""
    assert result["token"]["colorPrimary"] == "#ff0000"
