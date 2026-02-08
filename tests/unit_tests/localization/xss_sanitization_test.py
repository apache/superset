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
Tests for XSS sanitization of translation values.

Translation values are user-generated content that could contain malicious HTML.
Sanitization strips all HTML tags to store plain text, preventing XSS attacks
when content is rendered in the frontend.
"""

import pytest

from superset.localization.sanitization import (
    sanitize_translation_value,
    sanitize_translations,
)


# =============================================================================
# Unit Tests: sanitize_translation_value()
# =============================================================================


def test_plain_text_preserved() -> None:
    """Plain text without HTML passes through unchanged."""
    assert sanitize_translation_value("Normal text") == "Normal text"
    assert sanitize_translation_value("Продажи за 2024") == "Продажи за 2024"
    assert sanitize_translation_value("Verkaufs-Dashboard") == "Verkaufs-Dashboard"


def test_special_chars_preserved() -> None:
    """Plain text with special characters (<, >, &) preserved as-is."""
    assert sanitize_translation_value("A < B") == "A < B"
    assert sanitize_translation_value("A > B") == "A > B"
    assert sanitize_translation_value("A & B") == "A & B"
    assert sanitize_translation_value("A < B & C > D") == "A < B & C > D"


def test_script_tag_stripped() -> None:
    """Script tags and their content removed completely."""
    assert sanitize_translation_value("<script>alert(1)</script>") == ""
    assert sanitize_translation_value("<script>evil()</script>OK") == "OK"
    assert sanitize_translation_value("Before<script>x</script>After") == "BeforeAfter"


def test_event_handler_stripped() -> None:
    """HTML elements with event handlers stripped."""
    assert sanitize_translation_value('<img onerror="alert(1)">') == ""
    assert sanitize_translation_value('<img src=x onerror=alert(1)>') == ""
    assert sanitize_translation_value('<svg onload="evil()">') == ""
    assert sanitize_translation_value('<div onclick="hack()">text</div>') == "text"


def test_html_tags_stripped_text_preserved() -> None:
    """HTML tags stripped but text content preserved."""
    assert sanitize_translation_value("<b>Bold</b>") == "Bold"
    assert sanitize_translation_value("<i>Italic</i>") == "Italic"
    assert sanitize_translation_value("<b>Bold</b> and <i>italic</i>") == "Bold and italic"
    assert sanitize_translation_value("<div><p>Nested</p></div>") == "Nested"


def test_link_tag_stripped_text_preserved() -> None:
    """Anchor tags stripped, link text preserved."""
    assert sanitize_translation_value('<a href="http://evil.com">Click</a>') == "Click"
    assert sanitize_translation_value('<a href="javascript:alert(1)">XSS</a>') == "XSS"


def test_style_tag_stripped() -> None:
    """Style tags and CSS injection removed."""
    assert sanitize_translation_value("<style>body{display:none}</style>") == ""
    assert sanitize_translation_value("Text<style>*{}</style>More") == "TextMore"


def test_iframe_object_embed_stripped() -> None:
    """Dangerous embedding tags removed completely."""
    assert sanitize_translation_value('<iframe src="evil.html"></iframe>') == ""
    assert sanitize_translation_value('<object data="evil.swf"></object>') == ""
    assert sanitize_translation_value('<embed src="evil.swf">') == ""


def test_empty_string_returns_empty() -> None:
    """Empty string returns empty string."""
    assert sanitize_translation_value("") == ""


def test_whitespace_preserved() -> None:
    """Whitespace in plain text preserved."""
    assert sanitize_translation_value("  spaced  ") == "  spaced  "
    assert sanitize_translation_value("line1\nline2") == "line1\nline2"


def test_unicode_preserved() -> None:
    """Unicode characters preserved correctly."""
    assert sanitize_translation_value("日本語テスト") == "日本語テスト"
    assert sanitize_translation_value("Ümläuts äöü") == "Ümläuts äöü"
    assert sanitize_translation_value("Emoji 🎉") == "Emoji 🎉"


# =============================================================================
# Unit Tests: sanitize_translations()
# =============================================================================


def test_none_returns_none() -> None:
    """None input returns None."""
    assert sanitize_translations(None) is None


def test_empty_dict_returns_empty_dict() -> None:
    """Empty dict returns empty dict."""
    assert sanitize_translations({}) == {}


def test_single_field_single_locale_sanitized() -> None:
    """Single field with single locale sanitized correctly."""
    translations = {"title": {"de": "<b>Bold</b>"}}
    result = sanitize_translations(translations)
    assert result == {"title": {"de": "Bold"}}


def test_multiple_fields_sanitized() -> None:
    """Multiple fields all sanitized."""
    translations = {
        "dashboard_title": {"de": "<script>x</script>Titel"},
        "description": {"de": "Normal<br>text"},
    }
    result = sanitize_translations(translations)
    assert result == {
        "dashboard_title": {"de": "Titel"},
        "description": {"de": "Normaltext"},
    }


def test_multiple_locales_sanitized() -> None:
    """Multiple locales for same field all sanitized."""
    translations = {
        "title": {
            "de": "<b>Deutsch</b>",
            "fr": "<i>Français</i>",
            "es": "<script>malo</script>Español",
        }
    }
    result = sanitize_translations(translations)
    assert result == {
        "title": {
            "de": "Deutsch",
            "fr": "Français",
            "es": "Español",
        }
    }


def test_clean_translations_unchanged() -> None:
    """Translations without HTML pass through unchanged."""
    translations = {
        "dashboard_title": {"de": "Verkaufs-Dashboard", "fr": "Tableau de bord"},
        "description": {"de": "Monatlicher Bericht"},
    }
    result = sanitize_translations(translations)
    assert result == translations


def test_empty_value_preserved() -> None:
    """Empty string values preserved."""
    translations = {"title": {"de": ""}}
    result = sanitize_translations(translations)
    assert result == {"title": {"de": ""}}


def test_original_dict_not_mutated() -> None:
    """Original translations dict not mutated."""
    original = {"title": {"de": "<b>Bold</b>"}}
    original_copy = {"title": {"de": "<b>Bold</b>"}}
    sanitize_translations(original)
    assert original == original_copy


# =============================================================================
# Schema Integration Tests
# =============================================================================


def test_dashboard_put_schema_sanitizes_translations(app_context: None) -> None:
    """
    DashboardPutSchema sanitizes translations on load.

    Given translations with HTML content,
    when schema.load() is called,
    then HTML is stripped from all translation values.
    """
    from unittest.mock import patch

    from superset.dashboards.schemas import DashboardPutSchema

    schema = DashboardPutSchema()
    data = {
        "dashboard_title": "Test",
        "translations": {
            "dashboard_title": {"de": "<script>evil</script>Titel"},
            "description": {"de": "<b>Beschreibung</b>"},
        },
    }

    with patch("superset.dashboards.schemas.is_feature_enabled", return_value=True):
        result = schema.load(data)

    assert result["translations"] == {
        "dashboard_title": {"de": "Titel"},
        "description": {"de": "Beschreibung"},
    }


def test_chart_put_schema_sanitizes_translations(app_context: None) -> None:
    """
    ChartPutSchema sanitizes translations on load.

    Given translations with HTML content,
    when schema.load() is called,
    then HTML is stripped from all translation values.
    """
    from unittest.mock import patch

    from superset.charts.schemas import ChartPutSchema

    schema = ChartPutSchema()
    data = {
        "slice_name": "Test Chart",
        "translations": {
            "slice_name": {"de": "<img onerror=alert(1)>Chart"},
        },
    }

    with patch("superset.charts.schemas.is_feature_enabled", return_value=True):
        result = schema.load(data)

    assert result["translations"] == {
        "slice_name": {"de": "Chart"},
    }


def test_schema_without_translations_unaffected(app_context: None) -> None:
    """
    Schema load without translations works normally.

    Sanitization only applies when translations field is present.
    """
    from unittest.mock import patch

    from superset.dashboards.schemas import DashboardPutSchema

    schema = DashboardPutSchema()
    data = {"dashboard_title": "Test Dashboard"}

    with patch("superset.dashboards.schemas.is_feature_enabled", return_value=True):
        result = schema.load(data)

    assert result["dashboard_title"] == "Test Dashboard"
    assert "translations" not in result


def test_schema_with_null_translations_returns_none(app_context: None) -> None:
    """
    Schema load with translations=null returns None.

    Null translations used to clear existing translations.
    """
    from unittest.mock import patch

    from superset.dashboards.schemas import DashboardPutSchema

    schema = DashboardPutSchema()
    data = {"dashboard_title": "Test", "translations": None}

    with patch("superset.dashboards.schemas.is_feature_enabled", return_value=True):
        result = schema.load(data)

    assert result["translations"] is None
