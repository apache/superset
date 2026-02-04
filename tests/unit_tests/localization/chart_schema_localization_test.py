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
Tests for Chart (Slice) schema localization.

Chart API responses should return localized content (slice_name, description)
based on the user's locale. The schema's @post_dump hook applies translations
from the Slice model's translations JSON field.

When ENABLE_CONTENT_LOCALIZATION feature flag is enabled, the schema
replaces original field values with their translations for the current locale.
"""

from types import SimpleNamespace
from typing import Any
from unittest.mock import patch

from superset.charts.schemas import ChartGetResponseSchema


class MockChart:
    """Mock Chart (Slice) object for schema testing."""

    def __init__(
        self,
        slice_name: str = "Revenue by Region",
        description: str | None = None,
        translations: dict[str, dict[str, str]] | None = None,
    ) -> None:
        self.id = 1
        self.url = "/superset/explore/?slice_id=1"
        self.cache_timeout = None
        self.certified_by = None
        self.certification_details = None
        self.changed_on_delta_humanized = "a few seconds ago"
        self.description = description
        self.params = "{}"
        self.slice_name = slice_name
        self.thumbnail_url = None
        self.viz_type = "table"
        self.query_context = None
        self.is_managed_externally = False
        self.tags: list[Any] = []
        self.owners: list[Any] = []
        self.dashboards: list[Any] = []
        self.uuid = None
        self.datasource_id = 1
        self.datasource_type = "table"
        self.table = SimpleNamespace(uuid=None)
        self.translations = translations
        self._translations = translations

    def datasource_name_text(self) -> str:
        return "test_table"

    def datasource_url(self) -> str:
        return "/superset/explore/table/1/"

    def get_localized(self, field: str, locale: str) -> str:
        """Get localized value with fallback chain."""
        if not self._translations:
            return getattr(self, field)
        field_translations = self._translations.get(field, {})
        if locale in field_translations:
            return field_translations[locale]
        base_locale = locale.split("-")[0] if "-" in locale else None
        if base_locale and base_locale in field_translations:
            return field_translations[base_locale]
        return getattr(self, field)

    def get_available_locales(self) -> list[str]:
        """Get list of all unique locales with translations."""
        if not self._translations:
            return []
        locales: set[str] = set()
        for field_translations in self._translations.values():
            locales.update(field_translations.keys())
        return list(locales)


def test_chart_schema_returns_localized_name_when_feature_enabled(
    app_context: None,
) -> None:
    """
    Verify schema returns translated slice_name when localization enabled.

    Given a Chart with translations {"slice_name": {"de": "Umsatz nach Region"}},
    and ENABLE_CONTENT_LOCALIZATION=True and user locale="de",
    when ChartGetResponseSchema.dump() is called,
    then result["slice_name"] equals "Umsatz nach Region".
    """
    chart = MockChart(
        slice_name="Revenue by Region",
        translations={"slice_name": {"de": "Umsatz nach Region"}},
    )

    schema = ChartGetResponseSchema()

    with patch("superset.charts.schemas.is_feature_enabled", return_value=True):
        with patch("superset.charts.schemas.get_user_locale", return_value="de"):
            result = schema.dump(chart)

    assert result["slice_name"] == "Umsatz nach Region"


def test_chart_schema_returns_original_name_when_feature_disabled(
    app_context: None,
) -> None:
    """
    Verify schema returns original slice_name when localization disabled.

    Given a Chart with translations {"slice_name": {"de": "Umsatz nach Region"}},
    and ENABLE_CONTENT_LOCALIZATION=False,
    when ChartGetResponseSchema.dump() is called,
    then result["slice_name"] equals original "Revenue by Region".
    """
    chart = MockChart(
        slice_name="Revenue by Region",
        translations={"slice_name": {"de": "Umsatz nach Region"}},
    )

    schema = ChartGetResponseSchema()

    with patch("superset.charts.schemas.is_feature_enabled", return_value=False):
        result = schema.dump(chart)

    assert result["slice_name"] == "Revenue by Region"


def test_chart_schema_returns_original_when_no_translation_exists(
    app_context: None,
) -> None:
    """
    Verify schema returns original name when translation for locale missing.

    Given a Chart with translations {"slice_name": {"fr": "Chiffre d'affaires"}},
    and user locale="de" (no German translation),
    when ChartGetResponseSchema.dump() is called,
    then result["slice_name"] equals original "Revenue by Region".
    """
    chart = MockChart(
        slice_name="Revenue by Region",
        translations={"slice_name": {"fr": "Chiffre d'affaires par region"}},
    )

    schema = ChartGetResponseSchema()

    with patch("superset.charts.schemas.is_feature_enabled", return_value=True):
        with patch("superset.charts.schemas.get_user_locale", return_value="de"):
            result = schema.dump(chart)

    assert result["slice_name"] == "Revenue by Region"


def test_chart_schema_localizes_description(app_context: None) -> None:
    """
    Verify schema returns translated description when translation exists.

    Given a Chart with translations {"description": {"de": "Zeigt den Umsatz"}},
    and ENABLE_CONTENT_LOCALIZATION=True and user locale="de",
    when ChartGetResponseSchema.dump() is called,
    then result["description"] equals "Zeigt den Umsatz".
    """
    chart = MockChart(
        slice_name="Revenue by Region",
        description="Shows revenue breakdown",
        translations={"description": {"de": "Zeigt den Umsatz nach Region"}},
    )

    schema = ChartGetResponseSchema()

    with patch("superset.charts.schemas.is_feature_enabled", return_value=True):
        with patch("superset.charts.schemas.get_user_locale", return_value="de"):
            result = schema.dump(chart)

    assert result.get("description") == "Zeigt den Umsatz nach Region"


def test_chart_schema_handles_null_translations(app_context: None) -> None:
    """
    Verify schema handles Chart with translations=None gracefully.

    Given a Chart with translations=None,
    and ENABLE_CONTENT_LOCALIZATION=True,
    when ChartGetResponseSchema.dump() is called,
    then result["slice_name"] equals original value without error.
    """
    chart = MockChart(
        slice_name="Revenue by Region",
        translations=None,
    )

    schema = ChartGetResponseSchema()

    with patch("superset.charts.schemas.is_feature_enabled", return_value=True):
        with patch("superset.charts.schemas.get_user_locale", return_value="de"):
            result = schema.dump(chart)

    assert result["slice_name"] == "Revenue by Region"


def test_chart_schema_uses_base_language_fallback(app_context: None) -> None:
    """
    Verify schema falls back to base language when exact locale not found.

    Given a Chart with translations {"slice_name": {"de": "Umsatz nach Region"}},
    and user locale="de-AT" (German-Austria),
    when ChartGetResponseSchema.dump() is called,
    then result["slice_name"] equals "Umsatz nach Region" (base "de" fallback).
    """
    chart = MockChart(
        slice_name="Revenue by Region",
        translations={"slice_name": {"de": "Umsatz nach Region"}},
    )

    schema = ChartGetResponseSchema()

    with patch("superset.charts.schemas.is_feature_enabled", return_value=True):
        with patch("superset.charts.schemas.get_user_locale", return_value="de-AT"):
            result = schema.dump(chart)

    assert result["slice_name"] == "Umsatz nach Region"


def test_chart_schema_includes_available_locales(app_context: None) -> None:
    """
    Verify schema includes available_locales field when localization enabled.

    Given a Chart with translations for "de" and "fr",
    and ENABLE_CONTENT_LOCALIZATION=True,
    when ChartGetResponseSchema.dump() is called,
    then result["available_locales"] contains ["de", "fr"].
    """
    chart = MockChart(
        slice_name="Revenue by Region",
        translations={
            "slice_name": {"de": "Umsatz nach Region", "fr": "Chiffre d'affaires"},
        },
    )

    schema = ChartGetResponseSchema()

    with patch("superset.charts.schemas.is_feature_enabled", return_value=True):
        with patch("superset.charts.schemas.get_user_locale", return_value="de"):
            result = schema.dump(chart)

    assert sorted(result.get("available_locales", [])) == ["de", "fr"]


def test_chart_schema_localizes_multiple_fields(app_context: None) -> None:
    """
    Verify schema localizes both slice_name and description simultaneously.

    Given a Chart with translations for both slice_name and description,
    and ENABLE_CONTENT_LOCALIZATION=True and user locale="fr",
    when ChartGetResponseSchema.dump() is called,
    then both fields are localized to French.
    """
    chart = MockChart(
        slice_name="Revenue by Region",
        description="Shows revenue breakdown",
        translations={
            "slice_name": {"fr": "Chiffre d'affaires par region"},
            "description": {"fr": "Affiche la repartition du chiffre d'affaires"},
        },
    )

    schema = ChartGetResponseSchema()

    with patch("superset.charts.schemas.is_feature_enabled", return_value=True):
        with patch("superset.charts.schemas.get_user_locale", return_value="fr"):
            result = schema.dump(chart)

    assert result["slice_name"] == "Chiffre d'affaires par region"
    assert result.get("description") == "Affiche la repartition du chiffre d'affaires"


def test_chart_schema_handles_empty_translations_dict(app_context: None) -> None:
    """
    Verify schema handles Chart with translations={} gracefully.

    Given a Chart with translations={} (empty dict),
    and ENABLE_CONTENT_LOCALIZATION=True,
    when ChartGetResponseSchema.dump() is called,
    then result["slice_name"] equals original value without error.
    """
    chart = MockChart(
        slice_name="Revenue by Region",
        translations={},
    )

    schema = ChartGetResponseSchema()

    with patch("superset.charts.schemas.is_feature_enabled", return_value=True):
        with patch("superset.charts.schemas.get_user_locale", return_value="de"):
            result = schema.dump(chart)

    assert result["slice_name"] == "Revenue by Region"
