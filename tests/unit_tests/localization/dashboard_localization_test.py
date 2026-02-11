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
Tests for Dashboard model localization.

Dashboard supports localization for user-facing content fields
including dashboard_title and description.
"""

from superset.models.dashboard import Dashboard


def test_dashboard_get_localized_title_returns_translation() -> None:
    """
    Verify Dashboard returns localized title when translation exists.

    Given a Dashboard with German translation for dashboard_title,
    when get_localized("dashboard_title", "de") is called,
    then it returns the German translation.
    """
    dashboard = Dashboard(
        dashboard_title="Sales Dashboard",
        translations={"dashboard_title": {"de": "Verkaufs-Dashboard"}},
    )

    result = dashboard.get_localized("dashboard_title", "de")

    assert result == "Verkaufs-Dashboard"


def test_dashboard_get_localized_title_falls_back_to_original() -> None:
    """
    Verify Dashboard returns original title when no translation exists.

    Given a Dashboard with no German translation for the title,
    when get_localized("dashboard_title", "de") is called,
    then it returns the original "Sales Dashboard".
    """
    dashboard = Dashboard(
        dashboard_title="Sales Dashboard",
        translations={"dashboard_title": {"fr": "Tableau de bord des ventes"}},
    )

    result = dashboard.get_localized("dashboard_title", "de")

    assert result == "Sales Dashboard"


def test_dashboard_get_localized_description_returns_translation() -> None:
    """
    Verify Dashboard returns localized description when translation exists.

    Given a Dashboard with a German description translation,
    when get_localized("description", "de") is called,
    then it returns the German description.
    """
    dashboard = Dashboard(
        dashboard_title="Sales Dashboard",
        description="Overview of sales metrics",
        translations={"description": {"de": "Uebersicht der Verkaufskennzahlen"}},
    )

    result = dashboard.get_localized("description", "de")

    assert result == "Uebersicht der Verkaufskennzahlen"


def test_dashboard_set_translation_for_title() -> None:
    """
    Verify set_translation stores German translation for dashboard title.

    Given a Dashboard with no translations,
    when set_translation("dashboard_title", "de", "Verkaufs-Dashboard") is called,
    then the translation is stored in the translations dictionary.
    """
    dashboard = Dashboard(
        dashboard_title="Sales Dashboard",
        translations=None,
    )

    dashboard.set_translation("dashboard_title", "de", "Verkaufs-Dashboard")

    assert dashboard.translations == {"dashboard_title": {"de": "Verkaufs-Dashboard"}}


def test_dashboard_set_translation_for_description() -> None:
    """
    Verify set_translation stores French translation for dashboard description.

    Given a Dashboard with no translations,
    when set_translation("description", "fr", "Apercu des ventes") is called,
    then the French description translation is stored.
    """
    dashboard = Dashboard(
        dashboard_title="Sales Dashboard",
        description="Sales overview",
        translations=None,
    )

    dashboard.set_translation("description", "fr", "Apercu des ventes")

    assert dashboard.translations == {"description": {"fr": "Apercu des ventes"}}


def test_dashboard_get_available_locales_multiple_fields() -> None:
    """
    Verify get_available_locales returns all unique locales from all fields.

    Given a Dashboard with title translations in German and French,
    and description translation in German only,
    when get_available_locales() is called,
    then it returns ["de", "fr"] (unique locales across all fields).
    """
    dashboard = Dashboard(
        dashboard_title="Sales Dashboard",
        description="Sales overview",
        translations={
            "dashboard_title": {
                "de": "Verkaufs-Dashboard",
                "fr": "Tableau de bord des ventes",
            },
            "description": {"de": "Uebersicht der Verkaufskennzahlen"},
        },
    )

    result = dashboard.get_available_locales()

    assert sorted(result) == sorted(["de", "fr"])


def test_dashboard_translations_persisted_after_set() -> None:
    """
    Verify translations dictionary is modified after set_translation calls.

    Given a Dashboard with an existing German title translation,
    when set_translation is called to add a French title translation,
    then both translations exist in the translations dictionary.
    """
    dashboard = Dashboard(
        dashboard_title="Sales Dashboard",
        translations={"dashboard_title": {"de": "Verkaufs-Dashboard"}},
    )

    dashboard.set_translation("dashboard_title", "fr", "Tableau de bord des ventes")

    assert dashboard.translations["dashboard_title"]["de"] == "Verkaufs-Dashboard"
    assert (
        dashboard.translations["dashboard_title"]["fr"] == "Tableau de bord des ventes"
    )


def test_dashboard_localization_with_empty_translations() -> None:
    """
    Verify Dashboard handles None or empty translations gracefully.

    Given a Dashboard with translations=None or translations={},
    when get_localized is called,
    then it returns the original field value without error.
    """
    dashboard_none = Dashboard(
        dashboard_title="Sales Dashboard",
        description="Sales overview",
        translations=None,
    )
    dashboard_empty = Dashboard(
        dashboard_title="Sales Dashboard",
        description="Sales overview",
        translations={},
    )

    title_none = dashboard_none.get_localized("dashboard_title", "de")
    title_empty = dashboard_empty.get_localized("dashboard_title", "de")
    desc_none = dashboard_none.get_localized("description", "de")
    desc_empty = dashboard_empty.get_localized("description", "de")

    assert title_none == "Sales Dashboard"
    assert title_empty == "Sales Dashboard"
    assert desc_none == "Sales overview"
    assert desc_empty == "Sales overview"
