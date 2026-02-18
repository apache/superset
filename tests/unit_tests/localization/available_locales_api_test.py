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
Tests for available locales API endpoint.

GET /api/v1/localization/available-locales returns configured locales
from LANGUAGES config for the TranslationEditor UI to populate
language selection dropdowns.
"""

from unittest.mock import patch

from superset.localization.api import get_available_locales_data, LocalizationRestApi
from superset.localization.schemas import (
    AvailableLocalesResponseSchema,
    LocaleSchema,
)

LANGUAGES_CONFIG = {
    "en": {"flag": "us", "name": "English"},
    "de": {"flag": "de", "name": "German"},
    "fr": {"flag": "fr", "name": "French"},
}


def test_api_resource_name() -> None:
    """
    Verify LocalizationRestApi resource_name is 'localization'.

    Maps to /api/v1/localization endpoint path.
    """
    assert LocalizationRestApi.resource_name == "localization"


def test_api_class_permission_name() -> None:
    """
    Verify LocalizationRestApi permission class is 'Localization'.

    Used for RBAC permission checks.
    """
    assert LocalizationRestApi.class_permission_name == "Localization"


def test_api_openapi_spec_tag() -> None:
    """
    Verify OpenAPI spec tag for Swagger documentation grouping.
    """
    assert LocalizationRestApi.openapi_spec_tag == "Localization"


def test_api_allows_browser_login() -> None:
    """
    Verify endpoint allows browser-based authentication.
    """
    assert LocalizationRestApi.allow_browser_login is True


def test_api_registers_schema() -> None:
    """
    Verify AvailableLocalesResponseSchema is registered for OpenAPI docs.
    """
    assert (
        AvailableLocalesResponseSchema
        in LocalizationRestApi.openapi_spec_component_schemas
    )


def test_schema_serializes_locales() -> None:
    """
    Verify AvailableLocalesResponseSchema correctly serializes locale data.

    Given locales list and default_locale,
    when schema.dump() is called,
    then output matches expected structure.
    """
    schema = AvailableLocalesResponseSchema()
    data = {
        "locales": [
            {"code": "de", "name": "German", "flag": "de"},
            {"code": "en", "name": "English", "flag": "us"},
        ],
        "default_locale": "en",
    }

    result = schema.dump(data)

    assert result["locales"] == data["locales"]
    assert result["default_locale"] == "en"


def test_locale_schema_has_required_fields() -> None:
    """
    Verify LocaleSchema defines required fields: code, name, flag.
    """
    schema = LocaleSchema()

    assert "code" in schema.fields
    assert "name" in schema.fields
    assert "flag" in schema.fields


def test_get_available_locales_data_returns_sorted_locales(app_context: None) -> None:
    """
    Verify get_available_locales_data returns locales sorted by code.

    Given LANGUAGES config with en, de, fr,
    when get_available_locales_data is called,
    then locales are sorted alphabetically: de, en, fr.
    """
    with patch("superset.localization.api.current_app") as mock_app:
        mock_app.config.get = lambda key, default=None: (
            LANGUAGES_CONFIG if key == "LANGUAGES" else "en"
        )

        result = get_available_locales_data()

    codes = [loc["code"] for loc in result["locales"]]
    assert codes == ["de", "en", "fr"]


def test_get_available_locales_data_returns_default_locale(app_context: None) -> None:
    """
    Verify get_available_locales_data includes default_locale from config.

    Given BABEL_DEFAULT_LOCALE = "de",
    when get_available_locales_data is called,
    then result contains default_locale = "de".
    """
    with patch("superset.localization.api.current_app") as mock_app:
        mock_app.config.get = lambda key, default=None: (
            LANGUAGES_CONFIG if key == "LANGUAGES" else "de"
        )

        result = get_available_locales_data()

    assert result["default_locale"] == "de"


def test_get_available_locales_data_empty_languages(app_context: None) -> None:
    """
    Verify get_available_locales_data returns empty list when LANGUAGES is empty.

    Given LANGUAGES = {} (i18n disabled),
    when get_available_locales_data is called,
    then result contains empty locales array.
    """
    with patch("superset.localization.api.current_app") as mock_app:
        mock_app.config.get = lambda key, default=None: (
            {} if key == "LANGUAGES" else "en"
        )

        result = get_available_locales_data()

    assert result["locales"] == []
    assert result["default_locale"] == "en"


def test_get_available_locales_data_extracts_locale_metadata(
    app_context: None,
) -> None:
    """
    Verify get_available_locales_data extracts code, name, flag from config.

    Given LANGUAGES = {"pt_BR": {"flag": "br", "name": "Brazilian Portuguese"}},
    when get_available_locales_data is called,
    then locale contains code="pt_BR", name="Brazilian Portuguese", flag="br".
    """
    languages = {"pt_BR": {"flag": "br", "name": "Brazilian Portuguese"}}

    with patch("superset.localization.api.current_app") as mock_app:
        mock_app.config.get = lambda key, default=None: (
            languages if key == "LANGUAGES" else "en"
        )

        result = get_available_locales_data()

    assert len(result["locales"]) == 1
    locale = result["locales"][0]
    assert locale["code"] == "pt_BR"
    assert locale["name"] == "Brazilian Portuguese"
    assert locale["flag"] == "br"


def test_get_available_locales_data_uses_default_when_config_missing(
    app_context: None,
) -> None:
    """
    Verify get_available_locales_data falls back to 'en' when config missing.

    Given no BABEL_DEFAULT_LOCALE in config,
    when get_available_locales_data is called,
    then default_locale = "en".
    """
    with patch("superset.localization.api.current_app") as mock_app:
        mock_app.config.get = lambda key, default=None: default

        result = get_available_locales_data()

    assert result["default_locale"] == "en"
    assert result["locales"] == []
