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
Tests for translations dict validation.

Validates structure and content of translations dict:
- Field names: string, 1-50 chars
- Locale codes: BCP 47 (pt-BR) or POSIX (pt_BR) format
- Translation values: string, configurable max length
- Total unique locales: configurable maximum
- Total JSON size: configurable maximum
"""

from typing import Any
from unittest.mock import patch

import pytest
from marshmallow import ValidationError

from superset.localization.validation import (
    DEFAULT_MAX_FIELD_LENGTH,
    DEFAULT_MAX_JSON_SIZE,
    DEFAULT_MAX_LOCALES,
    DEFAULT_MAX_TEXT_LENGTH,
    LOCALE_PATTERN,
    validate_locale_code,
    validate_translations,
)

# =============================================================================
# Unit Tests: LOCALE_PATTERN regex
# =============================================================================


def test_locale_pattern_simple_codes() -> None:
    """Simple two-letter locale codes match."""
    assert LOCALE_PATTERN.match("en")
    assert LOCALE_PATTERN.match("de")
    assert LOCALE_PATTERN.match("fr")
    assert LOCALE_PATTERN.match("ru")
    assert LOCALE_PATTERN.match("zh")


def test_locale_pattern_bcp47_codes() -> None:
    """BCP 47 format with hyphen matches."""
    assert LOCALE_PATTERN.match("pt-BR")
    assert LOCALE_PATTERN.match("zh-TW")
    assert LOCALE_PATTERN.match("en-US")
    assert LOCALE_PATTERN.match("de-AT")


def test_locale_pattern_posix_codes() -> None:
    """POSIX format with underscore matches."""
    assert LOCALE_PATTERN.match("pt_BR")
    assert LOCALE_PATTERN.match("zh_TW")
    assert LOCALE_PATTERN.match("en_US")
    assert LOCALE_PATTERN.match("de_AT")


def test_locale_pattern_invalid_codes() -> None:
    """Invalid locale codes do not match."""
    assert not LOCALE_PATTERN.match("")
    assert not LOCALE_PATTERN.match("e")
    assert not LOCALE_PATTERN.match("eng")
    assert not LOCALE_PATTERN.match("EN")
    assert not LOCALE_PATTERN.match("en-us")  # lowercase region
    assert not LOCALE_PATTERN.match("pt_br")  # lowercase region
    assert not LOCALE_PATTERN.match("en-USA")  # 3-letter region
    assert not LOCALE_PATTERN.match("english")
    assert not LOCALE_PATTERN.match("12")
    assert not LOCALE_PATTERN.match("en_")
    assert not LOCALE_PATTERN.match("en-")


# =============================================================================
# Unit Tests: validate_locale_code()
# =============================================================================


def test_validate_locale_code_valid_simple(app_context: None) -> None:
    """Valid simple locale codes pass validation."""
    validate_locale_code("en")
    validate_locale_code("de")
    validate_locale_code("fr")


def test_validate_locale_code_valid_bcp47(app_context: None) -> None:
    """Valid BCP 47 locale codes pass validation."""
    validate_locale_code("pt-BR")
    validate_locale_code("zh-TW")
    validate_locale_code("en-US")


def test_validate_locale_code_valid_posix(app_context: None) -> None:
    """Valid POSIX locale codes pass validation."""
    validate_locale_code("pt_BR")
    validate_locale_code("zh_TW")
    validate_locale_code("en_US")


def test_validate_locale_code_invalid_format(app_context: None) -> None:
    """Invalid locale code format raises ValidationError."""
    with pytest.raises(ValidationError, match="Invalid locale code"):
        validate_locale_code("english")

    with pytest.raises(ValidationError, match="Invalid locale code"):
        validate_locale_code("EN")

    with pytest.raises(ValidationError, match="Invalid locale code"):
        validate_locale_code("en-us")

    with pytest.raises(ValidationError, match="Invalid locale code"):
        validate_locale_code("")


def test_validate_locale_code_non_string(app_context: None) -> None:
    """Non-string locale code raises ValidationError."""
    with pytest.raises(ValidationError, match="Locale code must be string"):
        validate_locale_code(123)  # type: ignore[arg-type]

    with pytest.raises(ValidationError, match="Locale code must be string"):
        validate_locale_code(None)  # type: ignore[arg-type]


# =============================================================================
# Unit Tests: validate_translations() - None and empty
# =============================================================================


def test_validate_translations_none_passes(app_context: None) -> None:
    """None translations passes validation (clears translations)."""
    validate_translations(None)  # Should not raise


def test_validate_translations_empty_dict_passes(app_context: None) -> None:
    """Empty dict passes validation (no translations)."""
    validate_translations({})  # Should not raise


# =============================================================================
# Unit Tests: validate_translations() - valid structures
# =============================================================================


def test_validate_translations_single_field_single_locale(app_context: None) -> None:
    """Single field with single locale passes."""
    translations = {"dashboard_title": {"de": "Verkaufs-Dashboard"}}
    validate_translations(translations)  # Should not raise


def test_validate_translations_multiple_fields(app_context: None) -> None:
    """Multiple fields pass validation."""
    translations = {
        "dashboard_title": {"de": "Verkaufs-Dashboard"},
        "description": {"de": "Monatlicher Bericht"},
    }
    validate_translations(translations)  # Should not raise


def test_validate_translations_multiple_locales(app_context: None) -> None:
    """Multiple locales per field pass validation."""
    translations = {
        "dashboard_title": {
            "de": "Verkaufs-Dashboard",
            "fr": "Tableau de bord",
            "pt-BR": "Painel de Vendas",
            "zh_TW": "銷售儀表板",
        }
    }
    validate_translations(translations)  # Should not raise


def test_validate_translations_empty_value(app_context: None) -> None:
    """Empty string value passes (user can clear translation)."""
    translations = {"dashboard_title": {"de": ""}}
    validate_translations(translations)  # Should not raise


# =============================================================================
# Unit Tests: validate_translations() - invalid type
# =============================================================================


def test_validate_translations_invalid_type(app_context: None) -> None:
    """Non-dict translations raises ValidationError."""
    with pytest.raises(ValidationError, match="must be dict or null"):
        validate_translations("not a dict")  # type: ignore[arg-type]

    with pytest.raises(ValidationError, match="must be dict or null"):
        validate_translations(["list"])  # type: ignore[arg-type]

    with pytest.raises(ValidationError, match="must be dict or null"):
        validate_translations(123)  # type: ignore[arg-type]


# =============================================================================
# Unit Tests: validate_translations() - invalid field names
# =============================================================================


def test_validate_translations_field_name_non_string(app_context: None) -> None:
    """Non-string field name raises ValidationError."""
    translations: Any = {123: {"de": "value"}}
    with pytest.raises(ValidationError, match="Field name must be string"):
        validate_translations(translations)


def test_validate_translations_field_name_empty(app_context: None) -> None:
    """Empty field name raises ValidationError."""
    translations = {"": {"de": "value"}}
    with pytest.raises(ValidationError, match="Field name cannot be empty"):
        validate_translations(translations)


def test_validate_translations_field_name_too_long(app_context: None) -> None:
    """Field name exceeding max length raises ValidationError."""
    long_name = "a" * (DEFAULT_MAX_FIELD_LENGTH + 1)
    translations = {long_name: {"de": "value"}}
    with pytest.raises(ValidationError, match="exceeds maximum length"):
        validate_translations(translations)


def test_validate_translations_field_name_at_max_length(app_context: None) -> None:
    """Field name at exactly max length passes."""
    max_name = "a" * DEFAULT_MAX_FIELD_LENGTH
    translations = {max_name: {"de": "value"}}
    validate_translations(translations)  # Should not raise


# =============================================================================
# Unit Tests: validate_translations() - invalid locales dict
# =============================================================================


def test_validate_translations_locales_not_dict(app_context: None) -> None:
    """Non-dict locales value raises ValidationError."""
    translations: Any = {"dashboard_title": "not a dict"}
    with pytest.raises(ValidationError, match="must be dict"):
        validate_translations(translations)

    translations2: Any = {"dashboard_title": ["de", "value"]}
    with pytest.raises(ValidationError, match="must be dict"):
        validate_translations(translations2)


def test_validate_translations_invalid_locale_code(app_context: None) -> None:
    """Invalid locale code raises ValidationError."""
    translations = {"dashboard_title": {"invalid": "value"}}
    with pytest.raises(ValidationError, match="Invalid locale code"):
        validate_translations(translations)


# =============================================================================
# Unit Tests: validate_translations() - invalid values
# =============================================================================


def test_validate_translations_value_non_string(app_context: None) -> None:
    """Non-string translation value raises ValidationError."""
    translations: Any = {"dashboard_title": {"de": 123}}
    with pytest.raises(ValidationError, match="must be string"):
        validate_translations(translations)

    translations2: Any = {"dashboard_title": {"de": None}}
    with pytest.raises(ValidationError, match="must be string"):
        validate_translations(translations2)


def test_validate_translations_value_too_long(app_context: None) -> None:
    """Translation value exceeding max length raises ValidationError."""
    long_value = "x" * (DEFAULT_MAX_TEXT_LENGTH + 1)
    translations = {"dashboard_title": {"de": long_value}}
    with pytest.raises(ValidationError, match="exceeds maximum length"):
        validate_translations(translations)


def test_validate_translations_value_at_max_length(app_context: None) -> None:
    """Translation value at exactly max length passes."""
    max_value = "x" * DEFAULT_MAX_TEXT_LENGTH
    translations = {"dashboard_title": {"de": max_value}}
    validate_translations(translations)  # Should not raise


# =============================================================================
# Unit Tests: validate_translations() - limits
# =============================================================================


def test_validate_translations_max_locales_exceeded(app_context: None) -> None:
    """Exceeding max unique locales raises ValidationError."""
    # Create DEFAULT_MAX_LOCALES + 1 valid two-letter codes: aa, ab, ..., az, ba...
    locales_many: dict[str, str] = {}
    for i in range(DEFAULT_MAX_LOCALES + 1):
        first = chr(97 + i // 26)  # a-z
        second = chr(97 + i % 26)  # a-z
        locales_many[f"{first}{second}"] = f"value{i}"

    translations = {"field": locales_many}
    with pytest.raises(ValidationError, match="exceeds maximum"):
        validate_translations(translations)


def test_validate_translations_at_max_locales(app_context: None) -> None:
    """Exactly max unique locales passes."""
    locales_max: dict[str, str] = {}
    for i in range(DEFAULT_MAX_LOCALES):
        first = chr(97 + i // 26)
        second = chr(97 + i % 26)
        locales_max[f"{first}{second}"] = f"value{i}"

    translations = {"field": locales_max}
    validate_translations(translations)  # Should not raise


def test_validate_translations_json_size_exceeded(app_context: None) -> None:
    """Exceeding max JSON size raises ValidationError."""
    # Create translation that exceeds 1MB when serialized
    # Each char in JSON is ~1 byte, so create string > 1MB
    huge_value = "x" * (DEFAULT_MAX_JSON_SIZE + 1000)
    translations = {"field": {"en": huge_value}}
    with pytest.raises(ValidationError, match="JSON size.*exceeds maximum"):
        validate_translations(translations)


# =============================================================================
# Unit Tests: validate_translations() - config overrides
# =============================================================================


def test_validate_translations_custom_max_text_length(app_context: None) -> None:
    """Custom CONTENT_LOCALIZATION_MAX_TEXT_LENGTH is respected."""
    custom_max = 100
    value_over_custom = "x" * (custom_max + 1)
    translations = {"field": {"en": value_over_custom}}

    with patch.dict(
        "superset.localization.validation.current_app.config",
        {"CONTENT_LOCALIZATION_MAX_TEXT_LENGTH": custom_max},
    ):
        with pytest.raises(ValidationError, match="exceeds maximum length"):
            validate_translations(translations)


def test_validate_translations_custom_max_locales(app_context: None) -> None:
    """Custom CONTENT_LOCALIZATION_MAX_LOCALES is respected."""
    custom_max = 5
    locales = {f"e{chr(97+i)}": f"val{i}" for i in range(custom_max + 1)}
    translations = {"field": locales}

    with patch.dict(
        "superset.localization.validation.current_app.config",
        {"CONTENT_LOCALIZATION_MAX_LOCALES": custom_max},
    ):
        with pytest.raises(ValidationError, match="exceeds maximum"):
            validate_translations(translations)


# =============================================================================
# Schema Integration Tests
# =============================================================================


def test_dashboard_put_schema_validates_translations(app_context: None) -> None:
    """
    DashboardPutSchema validates translations structure.

    Invalid translations structure should raise ValidationError
    before XSS sanitization runs.
    """
    from superset.dashboards.schemas import DashboardPutSchema

    schema = DashboardPutSchema()
    data = {
        "dashboard_title": "Test",
        "translations": {"field": {"INVALID": "value"}},  # invalid locale
    }

    with patch("superset.dashboards.schemas.is_feature_enabled", return_value=True):
        with pytest.raises(ValidationError, match="Invalid locale code"):
            schema.load(data)


def test_chart_put_schema_validates_translations(app_context: None) -> None:
    """
    ChartPutSchema validates translations structure.

    Invalid translations structure should raise ValidationError
    before XSS sanitization runs.
    """
    from superset.charts.schemas import ChartPutSchema

    schema = ChartPutSchema()
    data = {
        "slice_name": "Test Chart",
        "translations": {"field": "not a dict"},  # invalid structure
    }

    with patch("superset.charts.schemas.is_feature_enabled", return_value=True):
        with pytest.raises(ValidationError, match="must be dict"):
            schema.load(data)


def test_dashboard_schema_valid_translations_passes(app_context: None) -> None:
    """
    DashboardPutSchema accepts valid translations.

    Valid structure passes validation and gets sanitized.
    """
    from superset.dashboards.schemas import DashboardPutSchema

    schema = DashboardPutSchema()
    data = {
        "dashboard_title": "Test",
        "translations": {
            "dashboard_title": {"de": "Test-Dashboard", "pt_BR": "Painel"},
        },
    }

    with patch("superset.dashboards.schemas.is_feature_enabled", return_value=True):
        result = schema.load(data)

    assert result["translations"] == {
        "dashboard_title": {"de": "Test-Dashboard", "pt_BR": "Painel"},
    }


def test_chart_schema_valid_translations_passes(app_context: None) -> None:
    """
    ChartPutSchema accepts valid translations.

    Valid structure passes validation and gets sanitized.
    """
    from superset.charts.schemas import ChartPutSchema

    schema = ChartPutSchema()
    data = {
        "slice_name": "Test Chart",
        "translations": {
            "slice_name": {"de": "Test-Diagramm", "zh-TW": "測試圖表"},
        },
    }

    with patch("superset.charts.schemas.is_feature_enabled", return_value=True):
        result = schema.load(data)

    assert result["translations"] == {
        "slice_name": {"de": "Test-Diagramm", "zh-TW": "測試圖表"},
    }


def test_validation_runs_before_sanitization(app_context: None) -> None:
    """
    Validation runs before XSS sanitization.

    Invalid structure is rejected even if values contain HTML.
    """
    from superset.dashboards.schemas import DashboardPutSchema

    schema = DashboardPutSchema()
    data = {
        "dashboard_title": "Test",
        "translations": {
            "field": {"INVALID_LOCALE": "<script>evil</script>"},
        },
    }

    with patch("superset.dashboards.schemas.is_feature_enabled", return_value=True):
        with pytest.raises(ValidationError, match="Invalid locale code"):
            schema.load(data)
