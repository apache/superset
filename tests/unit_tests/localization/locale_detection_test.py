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
Tests for locale detection utilities.

Locale detection determines the user's preferred language for content
localization. The detection follows a priority chain:
1. Explicit locale parameter (if provided)
2. Flask session locale (user preference)
3. Accept-Language HTTP header
4. Default locale from configuration

These utilities support the content localization feature which allows
dashboards and charts to display translated titles and descriptions.
"""

from unittest.mock import patch

from flask import current_app

from superset.localization.locale_utils import (
    get_user_locale,
    parse_accept_language,
)


def test_parse_accept_language_single_locale() -> None:
    """
    Verify parse_accept_language extracts locale from simple header.

    Given Accept-Language header "de",
    when parse_accept_language is called,
    then it returns ["de"].
    """
    result = parse_accept_language("de")

    assert result == ["de"]


def test_parse_accept_language_with_quality_values() -> None:
    """
    Verify parse_accept_language sorts locales by quality value.

    Given Accept-Language header "fr;q=0.7, de;q=0.9, en;q=0.8",
    when parse_accept_language is called,
    then it returns locales sorted by quality descending: ["de", "en", "fr"].
    """
    result = parse_accept_language("fr;q=0.7, de;q=0.9, en;q=0.8")

    assert result == ["de", "en", "fr"]


def test_parse_accept_language_default_quality_is_one() -> None:
    """
    Verify locales without explicit quality have q=1.0 (highest priority).

    Given Accept-Language header "de, fr;q=0.9",
    when parse_accept_language is called,
    then "de" (implicit q=1.0) comes before "fr" (q=0.9).
    """
    result = parse_accept_language("de, fr;q=0.9")

    assert result == ["de", "fr"]


def test_parse_accept_language_with_region_codes() -> None:
    """
    Verify parse_accept_language handles locale-region codes.

    Given Accept-Language header "de-DE, de;q=0.9, en-US;q=0.8",
    when parse_accept_language is called,
    then it preserves region codes and sorts by quality.
    """
    result = parse_accept_language("de-DE, de;q=0.9, en-US;q=0.8")

    assert result == ["de-DE", "de", "en-US"]


def test_parse_accept_language_empty_returns_empty_list() -> None:
    """
    Verify parse_accept_language returns empty list for empty input.

    Given empty Accept-Language header "",
    when parse_accept_language is called,
    then it returns [].
    """
    result = parse_accept_language("")

    assert result == []


def test_parse_accept_language_wildcard_ignored() -> None:
    """
    Verify parse_accept_language ignores wildcard "*" locale.

    Given Accept-Language header "de, *;q=0.5",
    when parse_accept_language is called,
    then wildcard is excluded from result.
    """
    result = parse_accept_language("de, *;q=0.5")

    assert result == ["de"]
    assert "*" not in result


def test_parse_accept_language_invalid_quality_treated_as_zero() -> None:
    """
    Verify invalid quality values are treated as 0.

    Given Accept-Language header "de;q=invalid, fr;q=0.5",
    when parse_accept_language is called,
    then "de" with invalid q is sorted last (q=0).
    """
    result = parse_accept_language("de;q=invalid, fr;q=0.5")

    assert result == ["fr", "de"]


def test_get_user_locale_returns_session_locale(app_context: None) -> None:
    """
    Verify get_user_locale returns locale from Flask session.

    Given session["locale"] = "de" inside a request context,
    when get_user_locale is called,
    then it returns "de".
    """
    with current_app.test_request_context():
        with patch("superset.localization.locale_utils.session", {"locale": "de"}):
            result = get_user_locale()

    assert result == "de"


def test_get_user_locale_falls_back_to_accept_language(app_context: None) -> None:
    """
    Verify get_user_locale uses Accept-Language when no session locale.

    Given no session locale and Accept-Language header "fr-FR, fr;q=0.9",
    when get_user_locale is called,
    then it returns "fr-FR" (highest priority from header).
    """
    from flask import current_app

    with current_app.test_request_context(
        headers={"Accept-Language": "fr-FR, fr;q=0.9"}
    ):
        with patch("superset.localization.locale_utils.session", {}):
            result = get_user_locale()

    assert result == "fr-FR"


def test_get_user_locale_falls_back_to_default(app_context: None) -> None:
    """
    Verify get_user_locale returns default when no locale sources available.

    Given no session locale and no Accept-Language header,
    when get_user_locale is called,
    then it returns the default locale "en".
    """
    with current_app.test_request_context():
        with patch("superset.localization.locale_utils.session", {}):
            result = get_user_locale()

    assert result == "en"


def test_get_user_locale_explicit_parameter_takes_priority(
    app_context: None,
) -> None:
    """
    Verify explicit locale parameter overrides all other sources.

    Given session["locale"] = "de" and explicit parameter locale="fr",
    when get_user_locale(locale="fr") is called,
    then it returns "fr" (explicit parameter wins).
    """
    with current_app.test_request_context():
        with patch("superset.localization.locale_utils.session", {"locale": "de"}):
            result = get_user_locale(locale="fr")

    assert result == "fr"


def test_get_user_locale_validates_against_available_languages(
    app_context: None,
) -> None:
    """
    Verify get_user_locale validates locale against LANGUAGES config.

    Given session["locale"] = "xx" (not in LANGUAGES),
    when get_user_locale is called with validate=True,
    then it falls back to default locale.
    """
    with current_app.test_request_context():
        with patch("superset.localization.locale_utils.session", {"locale": "xx"}):
            with patch("superset.localization.locale_utils.current_app") as mock_app:
                mock_app.config = {
                    "LANGUAGES": {"en": {}, "de": {}, "fr": {}},
                    "BABEL_DEFAULT_LOCALE": "en",
                }
                result = get_user_locale(validate=True)

    assert result == "en"


def test_get_user_locale_without_validation_returns_any_locale(
    app_context: None,
) -> None:
    """
    Verify get_user_locale returns locale without validation by default.

    Given session["locale"] = "xx" (not in LANGUAGES),
    when get_user_locale is called without validate parameter,
    then it returns "xx" (no validation performed).
    """
    with current_app.test_request_context():
        with patch("superset.localization.locale_utils.session", {"locale": "xx"}):
            result = get_user_locale()

    assert result == "xx"


def test_get_user_locale_without_request_context(app_context: None) -> None:
    """
    Verify get_user_locale works outside request context (CLI, background jobs).

    Given no request context (only app context),
    when get_user_locale is called,
    then it returns default locale without raising RuntimeError.
    """
    result = get_user_locale()

    assert result == "en"
