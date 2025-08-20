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
import re
from typing import Any, Dict

from markupsafe import escape

from superset.themes.types import ThemeMode


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


def sanitize_svg_content(svg_content: str) -> str:
    """Sanitize SVG content to prevent XSS attacks.

    Removes dangerous elements and attributes while preserving safe SVG animation.
    Only allows standard SVG elements and attributes needed for spinners.

    Args:
        svg_content: Raw SVG content string

    Returns:
        str: Sanitized SVG content safe for rendering
    """
    if not svg_content or not svg_content.strip():
        return ""

    # Basic validation - must be valid SVG structure
    if not svg_content.strip().startswith("<svg") or not svg_content.strip().endswith(
        "</svg>"
    ):
        return ""

    # Allow list of safe SVG elements for spinner animations
    safe_elements = {
        "svg",
        "rect",
        "circle",
        "ellipse",
        "line",
        "path",
        "polygon",
        "polyline",
        "g",
        "defs",
        "animate",
        "animateTransform",
        "text",
        "tspan",
    }

    # Allow list of safe attributes (excluding event handlers and script-related)
    safe_attributes = {
        "xmlns",
        "width",
        "height",
        "viewBox",
        "fill",
        "stroke",
        "stroke-width",
        "x",
        "y",
        "cx",
        "cy",
        "r",
        "rx",
        "ry",
        "d",
        "transform",
        "opacity",
        "fill-opacity",
        "stroke-opacity",
        "id",
        "class",
        # Animation attributes
        "attributename",
        "begin",
        "dur",
        "end",
        "values",
        "from",
        "to",
        "by",
        "repeatcount",
        "calcmode",
        "keytimes",
        "keysplines",
    }

    # Remove any script tags or javascript: URLs
    svg_content = re.sub(
        r"<script[^>]*>.*?</script>", "", svg_content, flags=re.IGNORECASE | re.DOTALL
    )
    svg_content = re.sub(r"javascript:", "", svg_content, flags=re.IGNORECASE)
    svg_content = re.sub(r"on\w+\s*=", "", svg_content, flags=re.IGNORECASE)

    # Basic attribute filtering - remove any attribute not in safe list
    # This is a simple regex approach - for production might want XML parsing
    def clean_attributes(match: re.Match[str]) -> str:
        element = match.group(1)
        if element.lower() not in safe_elements:
            return ""  # Remove unknown elements entirely

        attrs = match.group(2)
        if not attrs:
            return f"<{element}>"

        # Keep only safe attributes
        safe_attrs = []
        attr_pattern = r'(\w+(?:-\w+)*)\s*=\s*["\']([^"\']*)["\']'
        for attr_match in re.finditer(attr_pattern, attrs):
            attr_name = attr_match.group(1).lower()
            attr_value = attr_match.group(2)

            if attr_name in safe_attributes:
                # Escape the attribute value
                safe_value = escape(attr_value)
                safe_attrs.append(f'{attr_name}="{safe_value}"')

        attrs_str = " " + " ".join(safe_attrs) if safe_attrs else ""
        return f"<{element}{attrs_str}>"

    # Apply cleaning to opening tags
    svg_content = re.sub(r"<(\w+)([^>]*)>", clean_attributes, svg_content)

    return svg_content


def sanitize_theme_tokens(theme_config: Dict[str, Any]) -> Dict[str, Any]:
    """Sanitize theme configuration, focusing on potentially dangerous content.

    Currently sanitizes brandSpinnerSvg content to prevent XSS.

    Args:
        theme_config: Theme configuration dictionary

    Returns:
        Dict[str, Any]: Sanitized theme configuration
    """
    if not isinstance(theme_config, dict):
        return theme_config

    # Create a copy to avoid modifying the original
    sanitized_config = theme_config.copy()

    # Sanitize SVG content in tokens
    if "token" in sanitized_config and isinstance(sanitized_config["token"], dict):
        tokens = sanitized_config["token"].copy()

        if "brandSpinnerSvg" in tokens and tokens["brandSpinnerSvg"]:
            tokens["brandSpinnerSvg"] = sanitize_svg_content(tokens["brandSpinnerSvg"])

        sanitized_config["token"] = tokens

    return sanitized_config
