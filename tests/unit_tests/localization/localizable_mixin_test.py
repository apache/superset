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
Tests for LocalizableMixin.

LocalizableMixin provides content localization for SQLAlchemy models.
It enables storing and retrieving translations for user-generated content
with locale fallback support.
"""

from superset.localization.localizable_mixin import LocalizableMixin


class MockLocalizableModel(LocalizableMixin):
    """Mock model for testing LocalizableMixin."""

    def __init__(
        self,
        title: str = "Original Title",
        translations: dict[str, dict[str, str]] | None = None,
    ) -> None:
        self.title = title
        self.translations = translations


def test_get_localized_returns_exact_locale_match() -> None:
    """
    Verify get_localized returns translation when exact locale match exists.

    Given a model with translations {"title": {"de-DE": "Titel"}},
    when get_localized("title", "de-DE") is called,
    then it returns "Titel".
    """
    model = MockLocalizableModel(
        title="Original Title",
        translations={"title": {"de-DE": "Deutscher Titel"}},
    )

    result = model.get_localized("title", "de-DE")

    assert result == "Deutscher Titel"


def test_get_localized_falls_back_to_base_language() -> None:
    """
    Verify get_localized falls back to base language when exact locale not found.

    Given a model with translations {"title": {"de": "Titel"}},
    when get_localized("title", "de-DE") is called,
    then it returns "Titel" (base language fallback).
    """
    model = MockLocalizableModel(
        title="Original Title",
        translations={"title": {"de": "Deutscher Titel"}},
    )

    result = model.get_localized("title", "de-DE")

    assert result == "Deutscher Titel"


def test_get_localized_falls_back_to_base_language_underscore() -> None:
    """
    Verify get_localized falls back to base language for POSIX underscore locales.

    Given a model with translations {"title": {"pt": "Titulo"}},
    when get_localized("title", "pt_BR") is called,
    then it returns "Titulo" (base language fallback for underscore separator).
    """
    model = MockLocalizableModel(
        title="Original Title",
        translations={"title": {"pt": "Titulo"}},
    )

    result = model.get_localized("title", "pt_BR")

    assert result == "Titulo"


def test_get_localized_returns_original_when_no_translation() -> None:
    """
    Verify get_localized returns original value when no translation exists.

    Given a model with translations {"title": {"fr": "Titre"}},
    when get_localized("title", "de-DE") is called,
    then it returns the original title value.
    """
    model = MockLocalizableModel(
        title="Original Title",
        translations={"title": {"fr": "Titre Francais"}},
    )

    result = model.get_localized("title", "de-DE")

    assert result == "Original Title"


def test_get_localized_returns_original_for_empty_translations() -> None:
    """
    Verify get_localized returns original value when translations is None or empty.

    Given a model with translations=None,
    when get_localized("title", "de-DE") is called,
    then it returns the original title value.
    """
    model_none = MockLocalizableModel(title="Original Title", translations=None)
    model_empty = MockLocalizableModel(title="Original Title", translations={})

    result_none = model_none.get_localized("title", "de-DE")
    result_empty = model_empty.get_localized("title", "de-DE")

    assert result_none == "Original Title"
    assert result_empty == "Original Title"


def test_set_translation_creates_new_entry() -> None:
    """
    Verify set_translation creates a new translation entry.

    Given a model with no translations,
    when set_translation("title", "de-DE", "Titel") is called,
    then translations contains {"title": {"de-DE": "Titel"}}.
    """
    model = MockLocalizableModel(title="Original Title", translations=None)

    model.set_translation("title", "de-DE", "Deutscher Titel")

    assert model.translations == {"title": {"de-DE": "Deutscher Titel"}}


def test_set_translation_updates_existing() -> None:
    """
    Verify set_translation updates an existing translation.

    Given a model with translations {"title": {"de-DE": "Alter Titel"}},
    when set_translation("title", "de-DE", "Neuer Titel") is called,
    then the translation is updated to "Neuer Titel".
    """
    model = MockLocalizableModel(
        title="Original Title",
        translations={"title": {"de-DE": "Alter Titel"}},
    )

    model.set_translation("title", "de-DE", "Neuer Titel")

    assert model.translations is not None
    assert model.translations["title"]["de-DE"] == "Neuer Titel"


def test_set_translation_creates_field_dict_if_missing() -> None:
    """
    Verify set_translation creates field dict when field not in translations.

    Given a model with translations {"description": {"fr": "Description"}},
    when set_translation("title", "de-DE", "Titel") is called,
    then translations contains both fields.
    """
    model = MockLocalizableModel(
        title="Original Title",
        translations={"description": {"fr": "Description Francaise"}},
    )

    model.set_translation("title", "de-DE", "Deutscher Titel")

    assert model.translations == {
        "description": {"fr": "Description Francaise"},
        "title": {"de-DE": "Deutscher Titel"},
    }


def test_get_available_locales_returns_all_locales() -> None:
    """
    Verify get_available_locales returns all unique locales across all fields.

    Given a model with translations for multiple fields and locales,
    when get_available_locales() is called,
    then it returns a list of all unique locales.
    """
    model = MockLocalizableModel(
        title="Original Title",
        translations={
            "title": {"de-DE": "Titel", "fr": "Titre"},
            "description": {"de-DE": "Beschreibung", "fr-CA": "Description"},
        },
    )

    result = model.get_available_locales()

    assert sorted(result) == sorted(["de-DE", "fr", "fr-CA"])


def test_get_available_locales_returns_empty_for_no_translations() -> None:
    """
    Verify get_available_locales returns empty list when no translations exist.

    Given a model with translations=None or {},
    when get_available_locales() is called,
    then it returns an empty list.
    """
    model_none = MockLocalizableModel(title="Original Title", translations=None)
    model_empty = MockLocalizableModel(title="Original Title", translations={})

    result_none = model_none.get_available_locales()
    result_empty = model_empty.get_available_locales()

    assert result_none == []
    assert result_empty == []
