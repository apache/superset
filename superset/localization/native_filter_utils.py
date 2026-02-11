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
Native filter localization utilities.

Provides functions to localize native filter names in dashboard
configurations. Native filters are stored in dashboard.json_metadata
and can have translations for their display names.

Translation structure within a filter:
{
    "id": "NATIVE_FILTER-abc123",
    "name": "Year",
    "translations": {
        "name": {"de": "Jahr", "fr": "Annee"}
    }
}
"""

import copy
from typing import Any

from superset.localization.locale_utils import get_translation


def localize_native_filters(
    filters: list[dict[str, Any]] | None,
    locale: str,
) -> list[dict[str, Any]] | None:
    """
    Localize native filter names for the given locale.

    Creates a copy of filters with names replaced by their translations.
    Does not mutate the original filters list.

    Fallback chain for each filter:
    1. Exact locale match (e.g., "de-DE")
    2. Base language fallback (e.g., "de" from "de-DE")
    3. Original name value

    Args:
        filters: List of native filter configuration dicts, or None.
        locale: Target locale code (e.g., "de", "de-DE").

    Returns:
        New list with localized filter names, or None if input is None.
        Empty list if input is empty list.
    """
    if filters is None:
        return None

    if not filters:
        return []

    # Deep copy to avoid mutating original
    localized_filters = copy.deepcopy(filters)

    for filter_config in localized_filters:
        _localize_filter_name(filter_config, locale)

    return localized_filters


def _localize_filter_name(filter_config: dict[str, Any], locale: str) -> None:
    """
    Localize a single filter's name in place.

    Args:
        filter_config: Filter configuration dict (mutated in place).
        locale: Target locale code.
    """
    translations = filter_config.get("translations")
    if not translations:
        return

    name_translations = translations.get("name")
    if not name_translations:
        return

    translated = get_translation(name_translations, locale)
    if translated is not None:
        filter_config["name"] = translated
