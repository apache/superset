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
Tests for Dashboard schema localization.

Dashboard API responses should return localized content (title, description)
based on the user's locale. The schema's @post_dump hook applies translations
from the Dashboard model's translations JSON field.

When ENABLE_CONTENT_LOCALIZATION feature flag is enabled, the schema
replaces original field values with their translations for the current locale.
"""

from datetime import datetime
from types import SimpleNamespace
from typing import Any
from unittest.mock import patch

from superset.dashboards.schemas import DashboardGetResponseSchema


class MockDashboard:
    """Mock Dashboard object for schema testing."""

    def __init__(
        self,
        dashboard_title: str = "Sales Dashboard",
        description: str | None = None,
        translations: dict[str, dict[str, str]] | None = None,
    ) -> None:
        self.id = 1
        self.slug = "sales-dashboard"
        self.url = "/superset/dashboard/1/"
        self.dashboard_title = dashboard_title
        self.description = description
        self.translations = translations
        self.thumbnail_url = None
        self.published = True
        self.css = ""
        self.theme = None
        self.json_metadata = "{}"
        self.position_json = "{}"
        self.certified_by = None
        self.certification_details = None
        self.changed_by_name = "admin"
        self.changed_by = SimpleNamespace(id=1, first_name="Admin", last_name="User")
        self.changed_on = datetime.now()
        self.created_by = SimpleNamespace(id=1, first_name="Admin", last_name="User")
        self.charts: list[Any] = []
        self.owners: list[Any] = []
        self.roles: list[Any] = []
        self.tags: list[Any] = []
        self.custom_tags: list[Any] = []
        self.changed_on_delta_humanized = "a few seconds ago"
        self.created_on_delta_humanized = "a few seconds ago"
        self.is_managed_externally = False
        self.uuid = None
        self._translations = translations

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


def test_dashboard_schema_returns_localized_title_when_feature_enabled(
    app_context: None,
) -> None:
    """
    Verify schema returns translated dashboard_title when localization enabled.

    Given a Dashboard with German translation for dashboard_title,
    and ENABLE_CONTENT_LOCALIZATION=True and user locale="de",
    when DashboardGetResponseSchema.dump() is called,
    then result["dashboard_title"] equals "Verkaufs-Dashboard".
    """
    dashboard = MockDashboard(
        dashboard_title="Sales Dashboard",
        translations={"dashboard_title": {"de": "Verkaufs-Dashboard"}},
    )

    schema = DashboardGetResponseSchema()

    with patch("superset.dashboards.schemas.is_feature_enabled", return_value=True):
        with patch("superset.dashboards.schemas.get_user_locale", return_value="de"):
            result = schema.dump(dashboard)

    assert result["dashboard_title"] == "Verkaufs-Dashboard"


def test_dashboard_schema_returns_original_title_when_feature_disabled(
    app_context: None,
) -> None:
    """
    Verify schema returns original dashboard_title when localization disabled.

    Given a Dashboard with German translation for dashboard_title,
    and ENABLE_CONTENT_LOCALIZATION=False,
    when DashboardGetResponseSchema.dump() is called,
    then result["dashboard_title"] equals original "Sales Dashboard".
    """
    dashboard = MockDashboard(
        dashboard_title="Sales Dashboard",
        translations={"dashboard_title": {"de": "Verkaufs-Dashboard"}},
    )

    schema = DashboardGetResponseSchema()

    with patch("superset.dashboards.schemas.is_feature_enabled", return_value=False):
        result = schema.dump(dashboard)

    assert result["dashboard_title"] == "Sales Dashboard"


def test_dashboard_schema_returns_original_when_no_translation_exists(
    app_context: None,
) -> None:
    """
    Verify schema returns original title when translation for locale missing.

    Given a Dashboard with translations {"dashboard_title": {"fr": "Tableau de bord"}},
    and user locale="de" (no German translation),
    when DashboardGetResponseSchema.dump() is called,
    then result["dashboard_title"] equals original "Sales Dashboard".
    """
    dashboard = MockDashboard(
        dashboard_title="Sales Dashboard",
        translations={"dashboard_title": {"fr": "Tableau de bord des ventes"}},
    )

    schema = DashboardGetResponseSchema()

    with patch("superset.dashboards.schemas.is_feature_enabled", return_value=True):
        with patch("superset.dashboards.schemas.get_user_locale", return_value="de"):
            result = schema.dump(dashboard)

    assert result["dashboard_title"] == "Sales Dashboard"


def test_dashboard_schema_localizes_description(app_context: None) -> None:
    """
    Verify schema returns translated description when translation exists.

    Given a Dashboard with translations {"description": {"de": "Monatlicher Bericht"}},
    and ENABLE_CONTENT_LOCALIZATION=True and user locale="de",
    when DashboardGetResponseSchema.dump() is called,
    then result["description"] equals "Monatlicher Bericht".
    """
    dashboard = MockDashboard(
        dashboard_title="Sales Dashboard",
        description="Monthly sales report",
        translations={"description": {"de": "Monatlicher Bericht"}},
    )

    schema = DashboardGetResponseSchema()

    with patch("superset.dashboards.schemas.is_feature_enabled", return_value=True):
        with patch("superset.dashboards.schemas.get_user_locale", return_value="de"):
            result = schema.dump(dashboard)

    assert result.get("description") == "Monatlicher Bericht"


def test_dashboard_schema_handles_null_translations(app_context: None) -> None:
    """
    Verify schema handles Dashboard with translations=None gracefully.

    Given a Dashboard with translations=None,
    and ENABLE_CONTENT_LOCALIZATION=True,
    when DashboardGetResponseSchema.dump() is called,
    then result["dashboard_title"] equals original value without error.
    """
    dashboard = MockDashboard(
        dashboard_title="Sales Dashboard",
        translations=None,
    )

    schema = DashboardGetResponseSchema()

    with patch("superset.dashboards.schemas.is_feature_enabled", return_value=True):
        with patch("superset.dashboards.schemas.get_user_locale", return_value="de"):
            result = schema.dump(dashboard)

    assert result["dashboard_title"] == "Sales Dashboard"


def test_dashboard_schema_uses_base_language_fallback(app_context: None) -> None:
    """
    Verify schema falls back to base language when exact locale not found.

    Given a Dashboard with German translation for dashboard_title,
    and user locale="de-DE" (German-Germany),
    when DashboardGetResponseSchema.dump() is called,
    then result["dashboard_title"] uses base "de" fallback.
    """
    dashboard = MockDashboard(
        dashboard_title="Sales Dashboard",
        translations={"dashboard_title": {"de": "Verkaufs-Dashboard"}},
    )

    schema = DashboardGetResponseSchema()

    with patch("superset.dashboards.schemas.is_feature_enabled", return_value=True):
        with patch("superset.dashboards.schemas.get_user_locale", return_value="de-DE"):
            result = schema.dump(dashboard)

    assert result["dashboard_title"] == "Verkaufs-Dashboard"


def test_dashboard_schema_includes_available_locales(app_context: None) -> None:
    """
    Verify schema includes available_locales field when localization enabled.

    Given a Dashboard with translations for "de" and "fr",
    and ENABLE_CONTENT_LOCALIZATION=True,
    when DashboardGetResponseSchema.dump() is called,
    then result["available_locales"] contains ["de", "fr"].
    """
    dashboard = MockDashboard(
        dashboard_title="Sales Dashboard",
        translations={
            "dashboard_title": {"de": "Verkaufs-Dashboard", "fr": "Tableau de bord"},
        },
    )

    schema = DashboardGetResponseSchema()

    with patch("superset.dashboards.schemas.is_feature_enabled", return_value=True):
        with patch("superset.dashboards.schemas.get_user_locale", return_value="de"):
            result = schema.dump(dashboard)

    assert sorted(result.get("available_locales", [])) == ["de", "fr"]


def test_dashboard_schema_localizes_multiple_fields(app_context: None) -> None:
    """
    Verify schema localizes both title and description simultaneously.

    Given a Dashboard with translations for both dashboard_title and description,
    and ENABLE_CONTENT_LOCALIZATION=True and user locale="fr",
    when DashboardGetResponseSchema.dump() is called,
    then both fields are localized to French.
    """
    dashboard = MockDashboard(
        dashboard_title="Sales Dashboard",
        description="Monthly report",
        translations={
            "dashboard_title": {"fr": "Tableau de bord des ventes"},
            "description": {"fr": "Rapport mensuel"},
        },
    )

    schema = DashboardGetResponseSchema()

    with patch("superset.dashboards.schemas.is_feature_enabled", return_value=True):
        with patch("superset.dashboards.schemas.get_user_locale", return_value="fr"):
            result = schema.dump(dashboard)

    assert result["dashboard_title"] == "Tableau de bord des ventes"
    assert result.get("description") == "Rapport mensuel"
