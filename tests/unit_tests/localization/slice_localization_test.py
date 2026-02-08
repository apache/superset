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
Tests for Slice (Chart) model localization.

These tests verify that the Slice model supports content localization
for user-facing fields like slice_name and description through the
LocalizableMixin interface.
"""

from superset.models.slice import Slice


def test_slice_get_localized_name_returns_translation() -> None:
    """
    Verify Slice returns localized name when translation exists.

    Given a Slice with translations {"slice_name": {"de": "Umsatz nach Region"}},
    when get_localized("slice_name", "de") is called,
    then it returns "Umsatz nach Region".
    """
    chart = Slice(
        slice_name="Revenue by Region",
        translations={"slice_name": {"de": "Umsatz nach Region"}},
    )

    result = chart.get_localized("slice_name", "de")

    assert result == "Umsatz nach Region"


def test_slice_get_localized_name_falls_back_to_original() -> None:
    """
    Verify Slice returns original name when no translation exists.

    Given a Slice with no translation for German,
    when get_localized("slice_name", "de") is called,
    then it returns the original slice_name value.
    """
    chart = Slice(
        slice_name="Revenue by Region",
        translations={"slice_name": {"fr": "Chiffre d'affaires par region"}},
    )

    result = chart.get_localized("slice_name", "de")

    assert result == "Revenue by Region"


def test_slice_get_localized_description_returns_translation() -> None:
    """
    Verify Slice returns localized description when translation exists.

    Given a Slice with translations {"description": {"de": "Zeigt den Umsatz..."}},
    when get_localized("description", "de") is called,
    then it returns the German description.
    """
    chart = Slice(
        slice_name="Revenue by Region",
        description="Shows revenue breakdown by geographic region",
        translations={
            "description": {"de": "Zeigt den Umsatz nach geografischer Region"}
        },
    )

    result = chart.get_localized("description", "de")

    assert result == "Zeigt den Umsatz nach geografischer Region"


def test_slice_set_translation_for_name() -> None:
    """
    Verify set_translation stores a German translation for slice_name.

    Given a Slice with no translations,
    when set_translation("slice_name", "de", "Umsatz nach Region") is called,
    then the translation is stored in the translations dictionary.
    """
    chart = Slice(
        slice_name="Revenue by Region",
        translations=None,
    )

    chart.set_translation("slice_name", "de", "Umsatz nach Region")

    assert chart.translations == {"slice_name": {"de": "Umsatz nach Region"}}


def test_slice_set_translation_for_description() -> None:
    """
    Verify set_translation stores a French translation for description.

    Given a Slice with existing translations,
    when set_translation("description", "fr", "...") is called,
    then the French description translation is added to the translations.
    """
    chart = Slice(
        slice_name="Revenue by Region",
        description="Shows revenue breakdown by geographic region",
        translations={"slice_name": {"de": "Umsatz nach Region"}},
    )

    chart.set_translation("description", "fr", "Chiffre d'affaires par region")

    assert chart.translations["description"]["fr"] == "Chiffre d'affaires par region"
    assert chart.translations["slice_name"]["de"] == "Umsatz nach Region"


def test_slice_get_available_locales_multiple_fields() -> None:
    """
    Verify get_available_locales returns all unique locales across fields.

    Given a Slice with slice_name translated to de/fr and description to de,
    when get_available_locales() is called,
    then it returns ["de", "fr"] (unique locales).
    """
    chart = Slice(
        slice_name="Revenue by Region",
        description="Shows revenue breakdown",
        translations={
            "slice_name": {
                "de": "Umsatz nach Region",
                "fr": "Chiffre d'affaires par region",
            },
            "description": {"de": "Zeigt den Umsatz nach Region"},
        },
    )

    result = chart.get_available_locales()

    assert sorted(result) == ["de", "fr"]


def test_slice_translations_persisted_after_set() -> None:
    """
    Verify translations dictionary is modified after set_translation calls.

    Given a Slice with empty translations,
    when multiple set_translation calls are made,
    then all translations are persisted in the translations dictionary.
    """
    chart = Slice(
        slice_name="Revenue by Region",
        description="Shows revenue breakdown",
        translations={},
    )

    chart.set_translation("slice_name", "de", "Umsatz nach Region")
    chart.set_translation("slice_name", "fr", "Chiffre d'affaires par region")
    chart.set_translation("description", "de", "Zeigt den Umsatz")

    assert chart.translations == {
        "slice_name": {
            "de": "Umsatz nach Region",
            "fr": "Chiffre d'affaires par region",
        },
        "description": {"de": "Zeigt den Umsatz"},
    }


def test_slice_localization_with_empty_translations() -> None:
    """
    Verify Slice handles None and empty translations gracefully.

    Given a Slice with translations=None or translations={},
    when get_localized is called,
    then it returns the original field value without errors.
    """
    chart_none = Slice(
        slice_name="Revenue by Region",
        description="Shows revenue",
        translations=None,
    )
    chart_empty = Slice(
        slice_name="Revenue by Region",
        description="Shows revenue",
        translations={},
    )

    result_none_name = chart_none.get_localized("slice_name", "de")
    result_none_desc = chart_none.get_localized("description", "de")
    result_empty_name = chart_empty.get_localized("slice_name", "de")
    result_empty_desc = chart_empty.get_localized("description", "de")

    assert result_none_name == "Revenue by Region"
    assert result_none_desc == "Shows revenue"
    assert result_empty_name == "Revenue by Region"
    assert result_empty_desc == "Shows revenue"
