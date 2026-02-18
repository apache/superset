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
Chart name localization for dashboard context.

Charts on dashboards can have per-dashboard name overrides with translations.
This module implements the priority chain for resolving the displayed name:

1. Override translation: json_metadata.slice_name_overrides[uuid].translations[locale]
2. Override name: position_json.meta.sliceNameOverride
3. Chart translation: chart.translations["slice_name"][locale]
4. Chart original: chart.slice_name

Storage structure:
- position_json stores layout with meta.sliceNameOverride (original override)
- json_metadata stores slice_name_overrides with translations
"""

import copy
from typing import Any, TYPE_CHECKING

from superset.localization.locale_utils import get_translation

if TYPE_CHECKING:
    from superset.models.slice import Slice

# Component type constant matching frontend
CHART_TYPE = "CHART"


def get_localized_chart_name(
    override_name: str | None,
    override_translations: dict[str, str] | None,
    chart_slice_name: str,
    chart_translations: dict[str, dict[str, str]] | None,
    locale: str,
) -> str:
    """
    Resolve chart display name using priority chain.

    Priority (highest to lowest):
    1. override_translations[locale] - translated override name
    2. override_name - original override name
    3. chart_translations["slice_name"][locale] - translated chart name
    4. chart_slice_name - original chart name

    Each translation lookup tries exact locale first, then base language.
    Example: "de-DE" tries "de-DE", then "de".

    Args:
        override_name: Dashboard-specific name override, or None/empty.
        override_translations: Translations for override {locale: value}, or None.
        chart_slice_name: Original chart name from Slice.slice_name.
        chart_translations: Chart translations {field: {locale: value}}, or None.
        locale: Target locale code (e.g., "de", "de-DE").

    Returns:
        Localized chart name based on priority chain.
    """
    # Priority 1: Override translation
    if override_name and override_translations:
        if translated := get_translation(override_translations, locale):
            return translated

    # Priority 2: Override name (original)
    if override_name:
        return override_name

    # Priority 3: Chart translation
    if chart_translations:
        slice_name_translations = chart_translations.get("slice_name")
        if slice_name_translations:
            if translated := get_translation(slice_name_translations, locale):
                return translated

    # Priority 4: Original chart name
    return chart_slice_name


def localize_chart_names(
    position: dict[str, Any],
    metadata: dict[str, Any],
    slices_by_uuid: dict[str, "Slice"],
    locale: str,
) -> dict[str, Any]:
    """
    Localize all chart names in dashboard position_json.

    Creates a copy of position_json with meta.sliceName updated to
    localized values for each CHART component.

    Args:
        position: Dashboard position_json parsed as dict.
        metadata: Dashboard json_metadata parsed as dict.
        slices_by_uuid: Mapping of chart UUID to Slice objects.
        locale: Target locale code.

    Returns:
        New position dict with localized chart names.
        Original position is not mutated.
    """
    # Deep copy to avoid mutating original
    localized_position = copy.deepcopy(position)

    # Get override translations from metadata
    slice_name_overrides = metadata.get("slice_name_overrides") or {}

    for component in localized_position.values():
        if not isinstance(component, dict):
            continue

        if component.get("type") != CHART_TYPE:
            continue

        meta = component.get("meta")
        if not meta or not isinstance(meta, dict):
            continue

        chart_uuid = meta.get("uuid")
        if not chart_uuid:
            continue

        # Get override data
        override_name = meta.get("sliceNameOverride") or None
        override_config = slice_name_overrides.get(chart_uuid) or {}
        override_translations = override_config.get("translations")

        # Get chart data
        slc = slices_by_uuid.get(chart_uuid)
        chart_slice_name = slc.slice_name if slc else meta.get("sliceName", "")
        chart_translations = slc.translations if slc else None

        # Apply priority chain
        meta["sliceName"] = get_localized_chart_name(
            override_name=override_name,
            override_translations=override_translations,
            chart_slice_name=chart_slice_name,
            chart_translations=chart_translations,
            locale=locale,
        )

    return localized_position
