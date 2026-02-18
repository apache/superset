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
Tests for ?include_translations query parameter.

API responses support two modes for content localization:

Default mode (include_translations=false):
    Returns localized field values (dashboard_title, slice_name, description)
    based on user's locale. Excludes raw translations dict.

Editor mode (include_translations=true):
    Returns original field values (not localized) plus full translations dict.
    Used by TranslationEditor UI to display and edit all translations.

Both modes include available_locales when ENABLE_CONTENT_LOCALIZATION=True.
"""

from datetime import datetime
from types import SimpleNamespace
from typing import Any
from unittest.mock import patch

from flask import current_app

from superset.charts.schemas import ChartGetResponseSchema
from superset.dashboards.schemas import DashboardGetResponseSchema


class MockDashboard:
    """Mock Dashboard model for schema testing."""

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
        self.changed_on_delta_humanized = "now"
        self.created_on_delta_humanized = "now"
        self.is_managed_externally = False
        self.uuid = None
        self._translations = translations

    def get_localized(self, field: str, locale: str) -> str:
        """Get localized value with fallback to original."""
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
        """Get list of all locales with translations."""
        if not self._translations:
            return []
        locales: set[str] = set()
        for field_translations in self._translations.values():
            locales.update(field_translations.keys())
        return sorted(locales)


class MockChart:
    """Mock Chart/Slice model for schema testing."""

    def __init__(
        self,
        slice_name: str = "Revenue Chart",
        description: str | None = None,
        translations: dict[str, dict[str, str]] | None = None,
    ) -> None:
        self.id = 1
        self.url = "/explore/?slice_id=1"
        self.cache_timeout = None
        self.certified_by = None
        self.certification_details = None
        self.changed_on_delta_humanized = "now"
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
        self.translations = translations
        self._translations = translations
        self.table = SimpleNamespace(uuid=None)

    def datasource_name_text(self) -> str:
        return "test_table"

    def datasource_url(self) -> str:
        return "/explore/?datasource_id=1&datasource_type=table"

    def get_localized(self, field: str, locale: str) -> str:
        """Get localized value with fallback to original."""
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
        """Get list of all locales with translations."""
        if not self._translations:
            return []
        locales: set[str] = set()
        for field_translations in self._translations.values():
            locales.update(field_translations.keys())
        return sorted(locales)


# =============================================================================
# Dashboard Schema Tests
# =============================================================================


def test_dashboard_returns_localized_title_without_param(app_context: None) -> None:
    """
    Verify schema returns localized dashboard_title by default.

    Given Dashboard with German translation and user locale=de,
    when schema.dump() called without ?include_translations,
    then dashboard_title equals German translation.
    """
    dashboard = MockDashboard(
        dashboard_title="Sales Dashboard",
        translations={"dashboard_title": {"de": "Verkaufs-Dashboard"}},
    )
    schema = DashboardGetResponseSchema()

    with (
        current_app.test_request_context("/?foo=bar"),
        patch("superset.dashboards.schemas.is_feature_enabled", return_value=True),
        patch("superset.dashboards.schemas.get_user_locale", return_value="de"),
    ):
        result = schema.dump(dashboard)

    assert result["dashboard_title"] == "Verkaufs-Dashboard"


def test_dashboard_excludes_translations_without_param(app_context: None) -> None:
    """
    Verify schema excludes translations dict by default.

    Given Dashboard with translations,
    when schema.dump() called without ?include_translations,
    then translations key not in response.
    """
    dashboard = MockDashboard(
        dashboard_title="Sales Dashboard",
        translations={"dashboard_title": {"de": "Verkaufs-Dashboard"}},
    )
    schema = DashboardGetResponseSchema()

    with (
        current_app.test_request_context("/?foo=bar"),
        patch("superset.dashboards.schemas.is_feature_enabled", return_value=True),
        patch("superset.dashboards.schemas.get_user_locale", return_value="de"),
    ):
        result = schema.dump(dashboard)

    assert "translations" not in result


def test_dashboard_returns_original_title_with_include_translations(
    app_context: None,
) -> None:
    """
    Verify schema returns original dashboard_title with ?include_translations=true.

    Given Dashboard with German translation and user locale=de,
    when schema.dump() called with ?include_translations=true,
    then dashboard_title equals original "Sales Dashboard" (not localized).
    """
    dashboard = MockDashboard(
        dashboard_title="Sales Dashboard",
        translations={"dashboard_title": {"de": "Verkaufs-Dashboard"}},
    )
    schema = DashboardGetResponseSchema()

    with (
        current_app.test_request_context("/?include_translations=true"),
        patch("superset.dashboards.schemas.is_feature_enabled", return_value=True),
        patch("superset.dashboards.schemas.get_user_locale", return_value="de"),
    ):
        result = schema.dump(dashboard)

    assert result["dashboard_title"] == "Sales Dashboard"


def test_dashboard_includes_translations_dict_with_include_translations(
    app_context: None,
) -> None:
    """
    Verify schema includes translations dict with ?include_translations=true.

    Given Dashboard with translations for de and fr,
    when schema.dump() called with ?include_translations=true,
    then translations dict contains all translations.
    """
    translations = {
        "dashboard_title": {"de": "Verkaufs-Dashboard", "fr": "Tableau de bord"},
        "description": {"de": "Monatlicher Bericht"},
    }
    dashboard = MockDashboard(
        dashboard_title="Sales Dashboard",
        description="Monthly report",
        translations=translations,
    )
    schema = DashboardGetResponseSchema()

    with (
        current_app.test_request_context("/?include_translations=true"),
        patch("superset.dashboards.schemas.is_feature_enabled", return_value=True),
        patch("superset.dashboards.schemas.get_user_locale", return_value="de"),
    ):
        result = schema.dump(dashboard)

    assert "translations" in result
    assert result["translations"] == translations


def test_dashboard_includes_available_locales_both_modes(app_context: None) -> None:
    """
    Verify available_locales included in both default and editor modes.

    Given Dashboard with de and fr translations,
    when schema.dump() called with or without ?include_translations,
    then available_locales contains ["de", "fr"].
    """
    dashboard = MockDashboard(
        dashboard_title="Sales Dashboard",
        translations={"dashboard_title": {"de": "...", "fr": "..."}},
    )
    schema = DashboardGetResponseSchema()

    # Default mode (no include_translations param)
    with (
        current_app.test_request_context("/"),
        patch("superset.dashboards.schemas.is_feature_enabled", return_value=True),
        patch("superset.dashboards.schemas.get_user_locale", return_value="en"),
    ):
        result_default = schema.dump(dashboard)

    # Editor mode (include_translations=true)
    with (
        current_app.test_request_context("/?include_translations=true"),
        patch("superset.dashboards.schemas.is_feature_enabled", return_value=True),
        patch("superset.dashboards.schemas.get_user_locale", return_value="en"),
    ):
        result_editor = schema.dump(dashboard)

    assert sorted(result_default["available_locales"]) == ["de", "fr"]
    assert sorted(result_editor["available_locales"]) == ["de", "fr"]


def test_dashboard_empty_translations_with_include_translations(
    app_context: None,
) -> None:
    """
    Verify schema returns empty dict when no translations exist.

    Uses ?include_translations=true.

    Given Dashboard without translations (translations=None),
    when schema.dump() called with ?include_translations=true,
    then translations equals empty dict {}.
    """
    dashboard = MockDashboard(
        dashboard_title="Sales Dashboard",
        translations=None,
    )
    schema = DashboardGetResponseSchema()

    with (
        current_app.test_request_context("/?include_translations=true"),
        patch("superset.dashboards.schemas.is_feature_enabled", return_value=True),
        patch("superset.dashboards.schemas.get_user_locale", return_value="en"),
    ):
        result = schema.dump(dashboard)

    assert result["translations"] == {}


def test_dashboard_include_translations_false_explicit(app_context: None) -> None:
    """
    Verify ?include_translations=false behaves same as absent parameter.

    Given Dashboard with translations,
    when schema.dump() called with ?include_translations=false,
    then response has localized values and no translations dict.
    """
    dashboard = MockDashboard(
        dashboard_title="Sales Dashboard",
        translations={"dashboard_title": {"de": "Verkaufs-Dashboard"}},
    )
    schema = DashboardGetResponseSchema()

    with (
        current_app.test_request_context("/?include_translations=false"),
        patch("superset.dashboards.schemas.is_feature_enabled", return_value=True),
        patch("superset.dashboards.schemas.get_user_locale", return_value="de"),
    ):
        result = schema.dump(dashboard)

    assert result["dashboard_title"] == "Verkaufs-Dashboard"
    assert "translations" not in result


# =============================================================================
# Chart Schema Tests
# =============================================================================


def test_chart_returns_localized_name_without_param(app_context: None) -> None:
    """
    Verify schema returns localized slice_name by default.

    Given Chart with German translation and user locale=de,
    when schema.dump() called without ?include_translations,
    then slice_name equals German translation.
    """
    chart = MockChart(
        slice_name="Revenue Chart",
        translations={"slice_name": {"de": "Umsatzdiagramm"}},
    )
    schema = ChartGetResponseSchema()

    with (
        current_app.test_request_context("/"),
        patch("superset.charts.schemas.is_feature_enabled", return_value=True),
        patch("superset.charts.schemas.get_user_locale", return_value="de"),
    ):
        result = schema.dump(chart)

    assert result["slice_name"] == "Umsatzdiagramm"


def test_chart_excludes_translations_without_param(app_context: None) -> None:
    """
    Verify schema excludes translations dict by default.

    Given Chart with translations,
    when schema.dump() called without ?include_translations,
    then translations key not in response.
    """
    chart = MockChart(
        slice_name="Revenue Chart",
        translations={"slice_name": {"de": "Umsatzdiagramm"}},
    )
    schema = ChartGetResponseSchema()

    with (
        current_app.test_request_context("/"),
        patch("superset.charts.schemas.is_feature_enabled", return_value=True),
        patch("superset.charts.schemas.get_user_locale", return_value="de"),
    ):
        result = schema.dump(chart)

    assert "translations" not in result


def test_chart_returns_original_name_with_include_translations(
    app_context: None,
) -> None:
    """
    Verify schema returns original slice_name with ?include_translations=true.

    Given Chart with German translation and user locale=de,
    when schema.dump() called with ?include_translations=true,
    then slice_name equals original "Revenue Chart" (not localized).
    """
    chart = MockChart(
        slice_name="Revenue Chart",
        translations={"slice_name": {"de": "Umsatzdiagramm"}},
    )
    schema = ChartGetResponseSchema()

    with (
        current_app.test_request_context("/?include_translations=true"),
        patch("superset.charts.schemas.is_feature_enabled", return_value=True),
        patch("superset.charts.schemas.get_user_locale", return_value="de"),
    ):
        result = schema.dump(chart)

    assert result["slice_name"] == "Revenue Chart"


def test_chart_includes_translations_dict_with_include_translations(
    app_context: None,
) -> None:
    """
    Verify schema includes translations dict with ?include_translations=true.

    Given Chart with translations for de and fr,
    when schema.dump() called with ?include_translations=true,
    then translations dict contains all translations.
    """
    translations = {
        "slice_name": {"de": "Umsatzdiagramm", "fr": "Graphique des revenus"},
        "description": {"de": "Monatliche Einnahmen"},
    }
    chart = MockChart(
        slice_name="Revenue Chart",
        description="Monthly revenue",
        translations=translations,
    )
    schema = ChartGetResponseSchema()

    with (
        current_app.test_request_context("/?include_translations=true"),
        patch("superset.charts.schemas.is_feature_enabled", return_value=True),
        patch("superset.charts.schemas.get_user_locale", return_value="de"),
    ):
        result = schema.dump(chart)

    assert "translations" in result
    assert result["translations"] == translations


def test_chart_includes_available_locales_both_modes(app_context: None) -> None:
    """
    Verify available_locales included in both default and editor modes.

    Given Chart with de and fr translations,
    when schema.dump() called with or without ?include_translations,
    then available_locales contains ["de", "fr"].
    """
    chart = MockChart(
        slice_name="Revenue Chart",
        translations={"slice_name": {"de": "...", "fr": "..."}},
    )
    schema = ChartGetResponseSchema()

    # Default mode
    with (
        current_app.test_request_context("/"),
        patch("superset.charts.schemas.is_feature_enabled", return_value=True),
        patch("superset.charts.schemas.get_user_locale", return_value="en"),
    ):
        result_default = schema.dump(chart)

    # Editor mode
    with (
        current_app.test_request_context("/?include_translations=true"),
        patch("superset.charts.schemas.is_feature_enabled", return_value=True),
        patch("superset.charts.schemas.get_user_locale", return_value="en"),
    ):
        result_editor = schema.dump(chart)

    assert sorted(result_default["available_locales"]) == ["de", "fr"]
    assert sorted(result_editor["available_locales"]) == ["de", "fr"]


# =============================================================================
# Edge Cases
# =============================================================================


def test_dashboard_no_request_context_returns_localized(app_context: None) -> None:
    """
    Verify schema localizes when no request context (e.g., background tasks).

    Given no Flask request context,
    when schema.dump() called,
    then default localization behavior applies (localized values, no translations).
    """
    dashboard = MockDashboard(
        dashboard_title="Sales Dashboard",
        translations={"dashboard_title": {"de": "Verkaufs-Dashboard"}},
    )
    schema = DashboardGetResponseSchema()

    # Note: no test_request_context() - testing outside request context
    with patch("superset.dashboards.schemas.is_feature_enabled", return_value=True):
        with patch("superset.dashboards.schemas.get_user_locale", return_value="de"):
            result = schema.dump(dashboard)

    assert result["dashboard_title"] == "Verkaufs-Dashboard"
    assert "translations" not in result


def test_dashboard_feature_flag_off_no_localization(app_context: None) -> None:
    """
    Verify no localization when feature flag disabled.

    Given ENABLE_CONTENT_LOCALIZATION=False,
    when schema.dump() called,
    then original values returned, no translations or available_locales.
    """
    dashboard = MockDashboard(
        dashboard_title="Sales Dashboard",
        translations={"dashboard_title": {"de": "Verkaufs-Dashboard"}},
    )
    schema = DashboardGetResponseSchema()

    with patch("superset.dashboards.schemas.is_feature_enabled", return_value=False):
        result = schema.dump(dashboard)

    assert result["dashboard_title"] == "Sales Dashboard"
    # When feature disabled, available_locales not populated
    locales = result.get("available_locales")
    assert locales is None or locales == []
