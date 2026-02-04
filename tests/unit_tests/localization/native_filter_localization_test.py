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
Tests for native filter localization in Dashboard API responses.

Native filters are stored in dashboard.json_metadata.native_filter_configuration.
Each filter can have translations for its "name" field. The localization
is applied during dashboard serialization when the content localization
feature flag is enabled.

Translation structure within a filter:
{
    "id": "NATIVE_FILTER-abc123",
    "name": "Year",
    "translations": {
        "name": {"de": "Jahr", "fr": "Annee"}
    }
}
"""

from superset.localization.native_filter_utils import localize_native_filters


def test_localize_native_filters_translates_filter_name() -> None:
    """
    Verify localize_native_filters translates filter name for given locale.

    Given native_filter_configuration with filter having translations,
    when localize_native_filters is called with locale="de",
    then filter["name"] is replaced with German translation.
    """
    filters = [
        {
            "id": "NATIVE_FILTER-abc123",
            "name": "Year",
            "translations": {"name": {"de": "Jahr", "fr": "Annee"}},
            "filterType": "filter_select",
        }
    ]

    result = localize_native_filters(filters, locale="de")

    assert result is not None
    assert result[0]["name"] == "Jahr"


def test_localize_native_filters_preserves_original_when_no_translation() -> None:
    """
    Verify localize_native_filters preserves original name when no translation.

    Given native_filter_configuration with filter having no German translation,
    when localize_native_filters is called with locale="de",
    then filter["name"] remains original "Year".
    """
    filters = [
        {
            "id": "NATIVE_FILTER-abc123",
            "name": "Year",
            "translations": {"name": {"fr": "Annee"}},
            "filterType": "filter_select",
        }
    ]

    result = localize_native_filters(filters, locale="de")

    assert result is not None
    assert result[0]["name"] == "Year"


def test_localize_native_filters_handles_no_translations_key() -> None:
    """
    Verify localize_native_filters handles filter without translations key.

    Given native_filter_configuration with filter having no translations key,
    when localize_native_filters is called,
    then filter["name"] remains unchanged without error.
    """
    filters = [
        {
            "id": "NATIVE_FILTER-abc123",
            "name": "Year",
            "filterType": "filter_select",
        }
    ]

    result = localize_native_filters(filters, locale="de")

    assert result is not None
    assert result[0]["name"] == "Year"


def test_localize_native_filters_uses_base_language_fallback() -> None:
    """
    Verify localize_native_filters falls back to base language.

    Given filter with translations {"name": {"de": "Jahr"}},
    when localize_native_filters is called with locale="de-DE",
    then filter["name"] uses base "de" translation.
    """
    filters = [
        {
            "id": "NATIVE_FILTER-abc123",
            "name": "Year",
            "translations": {"name": {"de": "Jahr"}},
            "filterType": "filter_select",
        }
    ]

    result = localize_native_filters(filters, locale="de-DE")

    assert result is not None
    assert result[0]["name"] == "Jahr"


def test_localize_native_filters_handles_multiple_filters() -> None:
    """
    Verify localize_native_filters translates all filters in configuration.

    Given native_filter_configuration with multiple filters,
    when localize_native_filters is called,
    then all filters are translated appropriately.
    """
    filters = [
        {
            "id": "NATIVE_FILTER-1",
            "name": "Year",
            "translations": {"name": {"de": "Jahr"}},
            "filterType": "filter_select",
        },
        {
            "id": "NATIVE_FILTER-2",
            "name": "Region",
            "translations": {"name": {"de": "Region"}},
            "filterType": "filter_select",
        },
        {
            "id": "NATIVE_FILTER-3",
            "name": "Category",
            # No translation for German
            "translations": {"name": {"fr": "Categorie"}},
            "filterType": "filter_select",
        },
    ]

    result = localize_native_filters(filters, locale="de")

    assert result is not None
    assert result[0]["name"] == "Jahr"
    assert result[1]["name"] == "Region"
    assert result[2]["name"] == "Category"  # No German, keeps original


def test_localize_native_filters_returns_empty_for_empty_input() -> None:
    """
    Verify localize_native_filters returns empty list for empty input.

    Given empty native_filter_configuration [],
    when localize_native_filters is called,
    then it returns [].
    """
    result = localize_native_filters([], locale="de")

    assert result == []


def test_localize_native_filters_returns_none_for_none_input() -> None:
    """
    Verify localize_native_filters returns None for None input.

    Given native_filter_configuration=None,
    when localize_native_filters is called,
    then it returns None.
    """
    result = localize_native_filters(None, locale="de")

    assert result is None


def test_localize_native_filters_preserves_other_filter_properties() -> None:
    """
    Verify localize_native_filters preserves all non-translated properties.

    Given filter with various properties (targets, scope, controlValues),
    when localize_native_filters is called,
    then all properties except name are preserved unchanged.
    """
    filters = [
        {
            "id": "NATIVE_FILTER-abc123",
            "name": "Year",
            "filterType": "filter_select",
            "translations": {"name": {"de": "Jahr"}},
            "targets": [{"column": {"name": "year"}, "datasetId": 1}],
            "scope": {"rootPath": ["ROOT_ID"], "excluded": []},
            "controlValues": {"multiSelect": True},
            "isInstant": True,
        }
    ]

    result = localize_native_filters(filters, locale="de")

    assert result is not None
    assert result[0]["name"] == "Jahr"
    assert result[0]["id"] == "NATIVE_FILTER-abc123"
    assert result[0]["filterType"] == "filter_select"
    assert result[0]["targets"] == [{"column": {"name": "year"}, "datasetId": 1}]
    assert result[0]["scope"] == {"rootPath": ["ROOT_ID"], "excluded": []}
    assert result[0]["controlValues"] == {"multiSelect": True}
    assert result[0]["isInstant"] is True


def test_localize_native_filters_does_not_mutate_original() -> None:
    """
    Verify localize_native_filters does not mutate the original filters.

    Given native_filter_configuration with translations,
    when localize_native_filters is called,
    then original filters list is not modified.
    """
    original_filters = [
        {
            "id": "NATIVE_FILTER-abc123",
            "name": "Year",
            "translations": {"name": {"de": "Jahr"}},
            "filterType": "filter_select",
        }
    ]
    original_name = original_filters[0]["name"]

    localize_native_filters(original_filters, locale="de")

    assert original_filters[0]["name"] == original_name


def test_localize_native_filters_handles_empty_translations_dict() -> None:
    """
    Verify localize_native_filters handles filter with empty translations.

    Given filter with translations={} (empty dict),
    when localize_native_filters is called,
    then filter["name"] remains original without error.
    """
    filters = [
        {
            "id": "NATIVE_FILTER-abc123",
            "name": "Year",
            "translations": {},
            "filterType": "filter_select",
        }
    ]

    result = localize_native_filters(filters, locale="de")

    assert result is not None
    assert result[0]["name"] == "Year"


def test_localize_native_filters_handles_empty_name_translations() -> None:
    """
    Verify localize_native_filters handles filter with translations but no name.

    Given filter with translations={"description": {"de": "..."}},
    when localize_native_filters is called,
    then filter["name"] remains original (no name translations exist).
    """
    filters = [
        {
            "id": "NATIVE_FILTER-abc123",
            "name": "Year",
            "translations": {"description": {"de": "Filter nach Jahr"}},
            "filterType": "filter_select",
        }
    ]

    result = localize_native_filters(filters, locale="de")

    assert result is not None
    assert result[0]["name"] == "Year"
