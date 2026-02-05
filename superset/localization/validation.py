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
Validation for translations dict structure.

Validates user-provided translations before storage:
- Field names: non-empty string, max length
- Locale codes: BCP 47 (pt-BR) or POSIX (pt_BR) format
- Translation values: string, max length
- Total unique locales per entity: max count
- Total JSON size: max bytes

All limits are configurable via Flask config with sensible defaults.
Raises marshmallow.ValidationError on invalid input for schema integration.

Usage:
    from superset.localization.validation import validate_translations

    # In schema @validates_schema:
    validate_translations(data.get("translations"))
"""

import re

from flask import current_app
from marshmallow import ValidationError

from superset.utils import json

# Locale code pattern: supports both BCP 47 (pt-BR) and POSIX (pt_BR) formats
# Examples: en, de, fr, pt-BR, pt_BR, zh-TW, zh_TW
LOCALE_PATTERN = re.compile(r"^[a-z]{2}([_-][A-Z]{2})?$")

# Default limits (overridable via config)
DEFAULT_MAX_LOCALES = 50
DEFAULT_MAX_TEXT_LENGTH = 10000
DEFAULT_MAX_FIELD_LENGTH = 50
DEFAULT_MAX_JSON_SIZE = 1048576  # 1MB


def _get_limit(config_key: str, default: int) -> int:
    """
    Get limit value from Flask config with fallback to default.

    Args:
        config_key: Config key name (e.g., "CONTENT_LOCALIZATION_MAX_LOCALES").
        default: Default value if config key not set.

    Returns:
        Configured or default limit value.
    """
    return current_app.config.get(config_key, default)


def validate_locale_code(code: str) -> None:
    """
    Validate single locale code format.

    Accepts BCP 47 (pt-BR) and POSIX (pt_BR) formats:
    - Two lowercase letters (language): en, de, fr
    - Optional region with hyphen or underscore: pt-BR, pt_BR, zh-TW, zh_TW

    Args:
        code: Locale code to validate.

    Raises:
        ValidationError: If code is not string or doesn't match expected format.

    Examples:
        >>> validate_locale_code("en")  # passes
        >>> validate_locale_code("pt-BR")  # passes
        >>> validate_locale_code("pt_BR")  # passes
        >>> validate_locale_code("INVALID")  # raises ValidationError
    """
    if not isinstance(code, str):
        raise ValidationError(
            f"Locale code must be string, got {type(code).__name__}"
        )

    if not LOCALE_PATTERN.match(code):
        raise ValidationError(
            f"Invalid locale code '{code}'. "
            "Expected format: 'en', 'de', 'pt-BR', or 'pt_BR'"
        )


def validate_translations(
    translations: dict[str, dict[str, str]] | None,
) -> None:
    """
    Validate translations dict structure and content.

    Checks:
    1. Type: must be dict or None
    2. JSON size: must not exceed configured maximum
    3. Field names: non-empty strings within length limit
    4. Locale structure: dict mapping locale codes to values
    5. Locale codes: valid BCP 47 or POSIX format
    6. Values: strings within length limit
    7. Total unique locales: must not exceed configured maximum

    Args:
        translations: Dict with structure {field: {locale: value}}, or None.

    Raises:
        ValidationError: If structure or content is invalid.

    Examples:
        >>> validate_translations(None)  # passes (clears translations)
        >>> validate_translations({})  # passes (no translations)
        >>> validate_translations({"title": {"de": "Titel"}})  # passes
        >>> validate_translations("invalid")  # raises ValidationError
    """
    if translations is None:
        return

    if not isinstance(translations, dict):
        raise ValidationError(
            f"translations must be dict or null, got {type(translations).__name__}"
        )

    # Check JSON size first (fail fast for huge payloads)
    max_json_size = _get_limit(
        "CONTENT_LOCALIZATION_MAX_JSON_SIZE", DEFAULT_MAX_JSON_SIZE
    )
    if (json_size := len(json.dumps(translations).encode("utf-8"))) > max_json_size:
        raise ValidationError(
            f"translations JSON size ({json_size} bytes) "
            f"exceeds maximum ({max_json_size} bytes)"
        )

    # Get other limits
    max_field_length = _get_limit(
        "CONTENT_LOCALIZATION_MAX_FIELD_LENGTH", DEFAULT_MAX_FIELD_LENGTH
    )
    max_text_length = _get_limit(
        "CONTENT_LOCALIZATION_MAX_TEXT_LENGTH", DEFAULT_MAX_TEXT_LENGTH
    )
    max_locales = _get_limit("CONTENT_LOCALIZATION_MAX_LOCALES", DEFAULT_MAX_LOCALES)

    # Collect unique locales across all fields
    all_locales: set[str] = set()

    for field_name, locales in translations.items():
        _validate_field_name(field_name, max_field_length)
        _validate_locales_dict(field_name, locales, max_text_length, all_locales)

    # Check total unique locales
    if len(all_locales) > max_locales:
        raise ValidationError(
            f"Total unique locales ({len(all_locales)}) "
            f"exceeds maximum ({max_locales})"
        )


def _validate_field_name(field_name: str, max_length: int) -> None:
    """
    Validate translation field name.

    Args:
        field_name: Field name to validate.
        max_length: Maximum allowed length.

    Raises:
        ValidationError: If field name is invalid.
    """
    if not isinstance(field_name, str):
        raise ValidationError(
            f"Field name must be string, got {type(field_name).__name__}"
        )

    if not field_name:
        raise ValidationError("Field name cannot be empty")

    if len(field_name) > max_length:
        raise ValidationError(
            f"Field name '{field_name}' exceeds maximum length ({max_length})"
        )


def _validate_locales_dict(
    field_name: str,
    locales: dict[str, str],
    max_text_length: int,
    all_locales: set[str],
) -> None:
    """
    Validate locales dict for a single field.

    Args:
        field_name: Parent field name (for error messages).
        locales: Dict mapping locale codes to translation values.
        max_text_length: Maximum allowed translation value length.
        all_locales: Set to collect unique locale codes (mutated).

    Raises:
        ValidationError: If locales structure or content is invalid.
    """
    if not isinstance(locales, dict):
        raise ValidationError(
            f"translations['{field_name}'] must be dict, "
            f"got {type(locales).__name__}"
        )

    for locale_code, value in locales.items():
        validate_locale_code(locale_code)
        all_locales.add(locale_code)

        if not isinstance(value, str):
            raise ValidationError(
                f"translations['{field_name}']['{locale_code}'] must be string, "
                f"got {type(value).__name__}"
            )

        if len(value) > max_text_length:
            raise ValidationError(
                f"translations['{field_name}']['{locale_code}'] "
                f"exceeds maximum length ({max_text_length})"
            )
