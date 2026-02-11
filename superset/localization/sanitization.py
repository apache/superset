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
"""
XSS sanitization for translation values.

Translation values are user-generated content stored as plain text.
All HTML tags are stripped to prevent XSS attacks when content is
rendered in the frontend. React's default escaping handles display.

Usage:
    from superset.localization.sanitization import sanitize_translations

    # In schema @post_load:
    data["translations"] = sanitize_translations(data.get("translations"))
"""

import html

import nh3


def sanitize_translation_value(value: str) -> str:
    """
    Strip HTML tags from translation value, return plain text.

    Uses nh3 to remove all HTML tags, then html.unescape to convert
    entities back to plain text characters. Result is safe plain text
    that React will escape when rendering.

    Args:
        value: Raw translation string, may contain HTML.

    Returns:
        Plain text with all HTML tags removed.

    Examples:
        >>> sanitize_translation_value("<b>Bold</b>")
        'Bold'
        >>> sanitize_translation_value("<script>evil()</script>OK")
        'OK'
        >>> sanitize_translation_value("A < B")
        'A < B'
    """
    # nh3.clean strips HTML tags but escapes special chars
    cleaned = nh3.clean(value, tags=set())
    # unescape to get plain text (safe because tags are gone)
    return html.unescape(cleaned)


def sanitize_translations(
    translations: dict[str, dict[str, str]] | None,
) -> dict[str, dict[str, str]] | None:
    """
    Sanitize all values in translations dict.

    Walks the nested dict structure and sanitizes each translation value.
    Returns a new dict; original is not mutated.

    Args:
        translations: Dict with structure {field: {locale: value}}, or None.

    Returns:
        New dict with all values sanitized, or None if input was None.

    Examples:
        >>> sanitize_translations({"title": {"de": "<b>X</b>"}})
        {'title': {'de': 'X'}}
        >>> sanitize_translations(None)
        None
    """
    if translations is None:
        return None

    return {
        field: {
            locale: sanitize_translation_value(value)
            for locale, value in locales.items()
        }
        for field, locales in translations.items()
    }
