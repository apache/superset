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
Adhoc metric/column label localization utilities.

AdhocMetric and AdhocColumn objects are stored inline in Slice.params
(surfaced as form_data dict). Each can carry per-label translations:

    {
        "label": "Total Revenue",
        "hasCustomLabel": true,
        "translations": {"label": {"de": "Gesamtumsatz"}}
    }

localize_metric_labels() replaces label values for the user's locale.
Only objects with hasCustomLabel=true and translations.label are processed.
"""

import copy
from typing import Any

from superset.localization.locale_utils import get_translation

TRANSLATABLE_ARRAY_KEYS = ("metrics", "columns")


def localize_metric_labels(
    form_data: dict[str, Any],
    locale: str,
) -> dict[str, Any]:
    """
    Localize adhoc metric/column labels in form_data for the given locale.

    Creates a shallow copy of form_data with deep-copied metrics/columns
    arrays. Does not mutate the original.

    Processes form_data["metrics"] and form_data["columns"]. Each element
    that is a dict with hasCustomLabel=true and translations.label
    gets its label replaced with the locale translation.

    String elements (SavedMetric names, PhysicalColumn names) pass through.

    Args:
        form_data: Chart form_data dict (parsed from Slice.params).
        locale: Target locale code (e.g., "de", "de-DE").

    Returns:
        New form_data dict with localized labels.
    """
    result = dict(form_data)

    for key in TRANSLATABLE_ARRAY_KEYS:
        items = form_data.get(key)
        if not items or not isinstance(items, list):
            continue

        localized_items = []
        for item in items:
            if isinstance(item, dict):
                localized_item = _localize_item_label(item, locale)
                localized_items.append(localized_item)
            else:
                localized_items.append(item)

        result[key] = localized_items

    return result


def _localize_item_label(
    item: dict[str, Any],
    locale: str,
) -> dict[str, Any]:
    """
    Localize a single metric/column label if eligible.

    Eligibility: hasCustomLabel is true AND translations.label has
    a matching locale entry. Otherwise returns a copy unchanged.

    Args:
        item: Metric or column dict.
        locale: Target locale code.

    Returns:
        Copy of item with label replaced if translation found.
    """
    if not item.get("hasCustomLabel"):
        return copy.copy(item)

    translations = item.get("translations")
    if not translations:
        return copy.copy(item)

    label_translations = translations.get("label")
    if not label_translations:
        return copy.copy(item)

    translated = get_translation(label_translations, locale)
    if translated is None:
        return copy.copy(item)

    localized = copy.copy(item)
    localized["label"] = translated
    return localized
