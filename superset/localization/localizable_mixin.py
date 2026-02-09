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
LocalizableMixin for SQLAlchemy models.

Provides content localization support for user-generated content fields.
Models that inherit this mixin can store and retrieve translations for
fields like titles and descriptions based on the viewer's locale.

Translations are stored in a JSON column with the following structure:
{
    "field_name": {
        "locale": "translated_value"
    }
}

Example:
{
    "dashboard_title": {"de": "Verkaufs-Dashboard", "fr": "Tableau de bord"},
    "description": {"de": "Monatlicher Verkaufsbericht"}
}
"""

from typing import Any

from superset.localization.locale_utils import get_translation


class LocalizableMixin:
    """
    Mixin providing content localization for SQLAlchemy models.

    Requires the model to have a `translations` attribute (JSON column).
    Provides methods for getting localized values with fallback support,
    setting translations, and listing available locales.
    """

    translations: dict[str, dict[str, str]] | None

    def get_localized(self, field: str, locale: str) -> Any:
        """
        Get localized value for a field with fallback support.

        Fallback chain:
        1. Exact locale match (e.g., "de-DE")
        2. Base language fallback (e.g., "de" from "de-DE")
        3. Original field value

        Args:
            field: The field name to get localized value for
            locale: The locale code (e.g., "de", "de-DE", "fr")

        Returns:
            The localized value if translation exists, otherwise the original
            field value.
        """
        if not self.translations:
            return getattr(self, field)

        field_translations = self.translations.get(field, {})

        translated = get_translation(field_translations, locale)
        if translated is not None:
            return translated

        return getattr(self, field)

    def set_translation(self, field: str, locale: str, value: str) -> None:
        """
        Set translation for a field and locale.

        Creates the translations dict and field dict if they don't exist.

        Args:
            field: The field name to set translation for
            locale: The locale code (e.g., "de", "fr")
            value: The translated value
        """
        if self.translations is None:
            self.translations = {}

        if field not in self.translations:
            self.translations[field] = {}

        self.translations[field][locale] = value

    def get_available_locales(self) -> list[str]:
        """
        Get list of all unique locales with translations.

        Collects all locale codes from all translated fields.

        Returns:
            List of unique locale codes (e.g., ["de", "fr", "de-DE"])
        """
        if not self.translations:
            return []

        locales: set[str] = set()
        for field_translations in self.translations.values():
            locales.update(field_translations.keys())

        return list(locales)
