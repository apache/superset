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
from typing import Any, Dict
from urllib.parse import urlparse

from flask import current_app
from marshmallow import ValidationError

from superset.themes.types import ThemeMode
from superset.utils.core import sanitize_svg_content, sanitize_url


def _is_valid_theme_mode(mode: str) -> bool:
    """Validate if a string represents a valid theme mode.

    Args:
    mode: String to validate against ThemeMode enum

    Returns:
    bool: True if mode is a valid ThemeMode value, False otherwise
    """
    try:
        ThemeMode(mode)
        return True
    except ValueError:
        return False


def _is_valid_algorithm(algorithm: Any) -> bool:
    """Helper function to validate theme algorithm"""
    if isinstance(algorithm, str):
        return _is_valid_theme_mode(algorithm) or algorithm == ThemeMode.SYSTEM
    elif isinstance(algorithm, list):
        return all(
            isinstance(alg, str) and _is_valid_theme_mode(alg) for alg in algorithm
        )
    else:
        return False


def is_valid_theme(theme: Dict[str, Any]) -> bool:
    """Validate theme dictionary structure and types.

    A valid theme can be empty or must contain properly typed fields:

    token (dict)
    components (dict)
    hashed (bool)
    inherit (bool)
    algorithm (str or list of str matching ThemeMode)
    Returns:
    bool: True if theme structure is valid, False otherwise
    """
    try:
        if not isinstance(theme, dict):
            return False

        # Empty dict is valid
        if not theme:
            return True

        # Validate each field type
        validations = [
            ("token", dict),
            ("components", dict),
            ("hashed", bool),
            ("inherit", bool),
        ]

        for field, expected_type in validations:
            if field in theme and not isinstance(theme[field], expected_type):
                return False

        # Validate algorithm field separately due to its complexity
        if "algorithm" in theme and not _is_valid_algorithm(theme["algorithm"]):
            return False

        return True
    except Exception:
        return False


def sanitize_theme_tokens(theme_config: Dict[str, Any]) -> Dict[str, Any]:
    """Sanitize theme configuration, focusing on potentially dangerous content.

    Sanitizes both brandSpinnerSvg content and brandSpinnerUrl values to prevent XSS.

    Args:
        theme_config: Theme configuration dictionary

    Returns:
        Dict[str, Any]: Sanitized theme configuration
    """
    if not isinstance(theme_config, dict):
        return theme_config

    # Create a copy to avoid modifying the original
    sanitized_config = theme_config.copy()

    # Sanitize SVG content and URLs in tokens
    if "token" in sanitized_config and isinstance(sanitized_config["token"], dict):
        tokens = sanitized_config["token"].copy()

        if "brandSpinnerSvg" in tokens and tokens["brandSpinnerSvg"]:
            tokens["brandSpinnerSvg"] = sanitize_svg_content(tokens["brandSpinnerSvg"])

        if "brandSpinnerUrl" in tokens and tokens["brandSpinnerUrl"]:
            tokens["brandSpinnerUrl"] = sanitize_url(tokens["brandSpinnerUrl"])

        sanitized_config["token"] = tokens

    return sanitized_config


def _validate_single_font_url(index: int, url: Any, allowed_domains: list[str]) -> str:
    """
    Validate a single font URL
    """
    if not isinstance(url, str):
        raise ValidationError(f"fontUrls[{index}] must be a string")

    # Reuse existing sanitize_url (blocks javascript:, data:, etc.)
    sanitized = sanitize_url(url.strip())
    if not sanitized:
        raise ValidationError(f"fontUrls[{index}] contains invalid URL")

    # Enforce HTTPS and validate domain
    try:
        parsed = urlparse(sanitized)
        if parsed.scheme != "https":
            raise ValidationError(f"fontUrls[{index}] must use HTTPS")
        if parsed.netloc.lower() not in [d.lower() for d in allowed_domains]:
            raise ValidationError(
                f"fontUrls[{index}] domain '{parsed.netloc}' not in allowed list"
            )
    except ValidationError:
        raise
    except Exception as e:
        raise ValidationError(f"fontUrls[{index}] is malformed: {e}") from e

    return sanitized


def validate_font_urls(font_urls: Any) -> list[str]:
    """
    Validate fontUrls array in theme token configuration
    """
    if font_urls is None:
        return []

    if not isinstance(font_urls, list):
        raise ValidationError("fontUrls must be an array")

    max_urls = current_app.config.get("THEME_FONTS_MAX_URLS", 15)
    if len(font_urls) > max_urls:
        raise ValidationError(f"Maximum {max_urls} font URLs allowed per theme")

    allowed_domains = current_app.config.get(
        "THEME_FONT_URL_ALLOWED_DOMAINS",
        [
            "fonts.googleapis.com",
            "fonts.gstatic.com",
            "use.typekit.net",
            "use.typekit.com",
        ],
    )

    return [
        _validate_single_font_url(i, url, allowed_domains)
        for i, url in enumerate(font_urls)
    ]
