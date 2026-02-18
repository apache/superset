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
Tests for current_user_locale() Jinja function.

The current_user_locale() function returns user's locale for SQL templates,
enabling locale-aware queries like:
    SELECT * FROM table WHERE language = '{{ current_user_locale() }}'

Key behaviors:
- Returns locale string (always, never None)
- Adds locale to cache key by default (cache varies by locale)
- add_to_cache_keys=False disables cache key addition
"""

from __future__ import annotations

from pytest_mock import MockerFixture

from superset.jinja_context import ExtraCache


def test_current_user_locale_returns_locale(mocker: MockerFixture) -> None:
    """
    current_user_locale() returns user's locale string.

    Locale resolution uses priority chain from get_user_locale():
    1. Session locale
    2. Accept-Language header
    3. Config default
    """
    mocker.patch(
        "superset.jinja_context.get_user_locale",
        return_value="de",
    )

    cache = ExtraCache()
    result = cache.current_user_locale()

    assert result == "de"


def test_current_user_locale_adds_to_cache_key_by_default(
    mocker: MockerFixture,
) -> None:
    """
    current_user_locale() adds locale to cache key by default.

    Cache keys must include locale to prevent cross-locale cache poisoning.
    """
    mocker.patch(
        "superset.jinja_context.get_user_locale",
        return_value="fr",
    )
    mock_cache_key_wrapper = mocker.patch.object(ExtraCache, "cache_key_wrapper")

    cache = ExtraCache()
    cache.current_user_locale()

    mock_cache_key_wrapper.assert_called_once_with("fr")


def test_current_user_locale_skips_cache_key_when_disabled(
    mocker: MockerFixture,
) -> None:
    """
    current_user_locale(add_to_cache_keys=False) does not modify cache key.

    Use case: locale used for display only, not affecting query results.
    """
    mocker.patch(
        "superset.jinja_context.get_user_locale",
        return_value="es",
    )
    mock_cache_key_wrapper = mocker.patch.object(ExtraCache, "cache_key_wrapper")

    cache = ExtraCache()
    result = cache.current_user_locale(add_to_cache_keys=False)

    assert result == "es"
    mock_cache_key_wrapper.assert_not_called()


def test_current_user_locale_returns_default_when_no_preference(
    mocker: MockerFixture,
) -> None:
    """
    current_user_locale() returns default locale when no user preference set.

    get_user_locale() handles fallback to BABEL_DEFAULT_LOCALE config.
    """
    mocker.patch(
        "superset.jinja_context.get_user_locale",
        return_value="en",  # default from config
    )

    cache = ExtraCache()
    result = cache.current_user_locale()

    assert result == "en"


def test_current_user_locale_in_regex_pattern() -> None:
    """
    ExtraCache.regex detects current_user_locale() usage in templates.

    Required for cache key computation to identify templates that vary by locale.
    """
    # Pattern with current_user_locale()
    template_with_locale = "{{ current_user_locale() }}"
    assert ExtraCache.regex.search(template_with_locale) is not None

    # Pattern with add_to_cache_keys parameter
    template_with_param = "{{ current_user_locale(add_to_cache_keys=False) }}"
    assert ExtraCache.regex.search(template_with_param) is not None

    # Jinja block syntax
    template_block = "{% if current_user_locale() == 'de' %}German{% endif %}"
    assert ExtraCache.regex.search(template_block) is not None


def test_current_user_locale_type_is_str(mocker: MockerFixture) -> None:
    """
    current_user_locale() always returns str, never None.

    Unlike current_user_id() which returns None when no user is logged in,
    locale always has a value (falls back to config default).
    """
    mocker.patch(
        "superset.jinja_context.get_user_locale",
        return_value="en",
    )

    cache = ExtraCache()
    result = cache.current_user_locale()

    assert isinstance(result, str)
    assert result  # not empty string
