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
from marshmallow import ValidationError

from superset.themes.types import ThemeMode
from superset.themes.utils import (
    _is_valid_algorithm,
    _is_valid_theme_mode,
    is_valid_theme,
    sanitize_theme_tokens,
    validate_font_urls,
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


@pytest.fixture
def mock_app_config():
    """Create a mock Flask app with default config values."""
    mock_app = MagicMock()
    mock_app.config.get.side_effect = lambda k, d=None: {
        "THEME_FONTS_MAX_URLS": 15,
        "THEME_FONT_URL_ALLOWED_DOMAINS": [
            "fonts.googleapis.com",
            "fonts.gstatic.com",
            "use.typekit.net",
            "use.typekit.com",
        ],
    }.get(k, d)
    return mock_app


def test_validate_font_urls_none_returns_empty_list():
    """Test that None input returns an empty list."""
    result = validate_font_urls(None)
    assert result == []


@patch("superset.themes.utils.current_app")
def test_validate_font_urls_valid_google_fonts(mock_current_app, mock_app_config):
    """Test that valid Google Fonts URL passes validation."""
    mock_current_app.config = mock_app_config.config

    urls = ["https://fonts.googleapis.com/css2?family=Roboto:wght@400;500&display=swap"]
    result = validate_font_urls(urls)

    assert len(result) == 1
    assert result[0] == urls[0]


@patch("superset.themes.utils.current_app")
def test_validate_font_urls_valid_typekit(mock_current_app, mock_app_config):
    """Test that valid Adobe Fonts (Typekit) URL passes validation."""
    mock_current_app.config = mock_app_config.config

    urls = ["https://use.typekit.net/abc123.css"]
    result = validate_font_urls(urls)

    assert len(result) == 1
    assert result[0] == urls[0]


@patch("superset.themes.utils.current_app")
def test_validate_font_urls_multiple_valid_urls(mock_current_app, mock_app_config):
    """Test that multiple valid font URLs pass validation."""
    mock_current_app.config = mock_app_config.config

    urls = [
        "https://fonts.googleapis.com/css2?family=Roboto",
        "https://fonts.googleapis.com/css2?family=Open+Sans",
        "https://use.typekit.net/xyz789.css",
    ]
    result = validate_font_urls(urls)

    assert len(result) == 3
    assert result == urls


@patch("superset.themes.utils.current_app")
def test_validate_font_urls_rejects_http(mock_current_app, mock_app_config):
    """Test that HTTP URLs are rejected (HTTPS required)."""
    mock_current_app.config = mock_app_config.config

    with pytest.raises(ValidationError, match="must use HTTPS"):
        validate_font_urls(["http://fonts.googleapis.com/css2?family=Roboto"])


@patch("superset.themes.utils.current_app")
def test_validate_font_urls_rejects_unlisted_domain(mock_current_app, mock_app_config):
    """Test that URLs from non-whitelisted domains are rejected."""
    mock_current_app.config = mock_app_config.config

    with pytest.raises(ValidationError, match="not in allowed list"):
        validate_font_urls(["https://evil.com/malicious-font.css"])


@patch("superset.themes.utils.current_app")
def test_validate_font_urls_rejects_javascript_scheme(
    mock_current_app, mock_app_config
):
    """Test that javascript: URLs are rejected."""
    mock_current_app.config = mock_app_config.config

    with pytest.raises(ValidationError, match="invalid URL"):
        validate_font_urls(["javascript:alert('xss')"])


@patch("superset.themes.utils.current_app")
def test_validate_font_urls_rejects_data_scheme(mock_current_app, mock_app_config):
    """Test that data: URLs are rejected."""
    mock_current_app.config = mock_app_config.config

    with pytest.raises(ValidationError, match="invalid URL"):
        validate_font_urls(["data:text/css,body{color:red}"])


@patch("superset.themes.utils.current_app")
def test_validate_font_urls_max_urls_enforced(mock_current_app):
    """Test that maximum URL count is enforced."""
    # Create a fresh config mock with max_urls set to 3
    config_mock = MagicMock()
    config_mock.get.side_effect = lambda k, d=None: {
        "THEME_FONTS_MAX_URLS": 3,
        "THEME_FONT_URL_ALLOWED_DOMAINS": ["fonts.googleapis.com"],
    }.get(k, d)
    mock_current_app.config = config_mock

    urls = [f"https://fonts.googleapis.com/font{i}" for i in range(5)]

    with pytest.raises(ValidationError, match="Maximum 3 font URLs"):
        validate_font_urls(urls)


def test_validate_font_urls_rejects_non_array():
    """Test that non-array input is rejected."""
    with pytest.raises(ValidationError, match="must be an array"):
        validate_font_urls("not-an-array")


def test_validate_font_urls_rejects_non_string_elements():
    """Test that non-string elements in the array are rejected."""
    with pytest.raises(ValidationError, match="must be a string"):
        validate_font_urls([123, "https://fonts.googleapis.com/css"])


@patch("superset.themes.utils.current_app")
def test_validate_font_urls_strips_whitespace(mock_current_app, mock_app_config):
    """Test that whitespace is stripped from URLs."""
    mock_current_app.config = mock_app_config.config

    urls = ["  https://fonts.googleapis.com/css2?family=Roboto  "]
    result = validate_font_urls(urls)

    assert len(result) == 1
    assert result[0] == "https://fonts.googleapis.com/css2?family=Roboto"


@patch("superset.themes.utils.current_app")
def test_validate_font_urls_empty_array_returns_empty(
    mock_current_app, mock_app_config
):
    """Test that empty array returns empty list."""
    mock_current_app.config = mock_app_config.config

    result = validate_font_urls([])
    assert result == []


@patch("superset.themes.utils.current_app")
def test_validate_font_urls_case_insensitive_domain(mock_current_app, mock_app_config):
    """Test that domain matching is case-insensitive."""
    mock_current_app.config = mock_app_config.config

    urls = ["https://FONTS.GOOGLEAPIS.COM/css2?family=Roboto"]
    result = validate_font_urls(urls)

    assert len(result) == 1
