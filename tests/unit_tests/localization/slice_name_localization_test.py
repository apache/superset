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
Tests for chart name localization in dashboard context.

Charts displayed on dashboards can have localized names via priority chain:
1. Override translation (json_metadata.slice_name_overrides[uuid].translations)
2. Override name (position_json.meta.sliceNameOverride)
3. Chart translation (chart.translations["slice_name"])
4. Chart original name (chart.slice_name)

Translation storage:
- Original override name: position_json.meta.sliceNameOverride
- Override translations: json_metadata.slice_name_overrides[uuid].translations
"""

from typing import Any
from unittest.mock import MagicMock

from superset.localization.slice_name_utils import (
    get_localized_chart_name,
    localize_chart_names,
)

# =============================================================================
# Fixtures
# =============================================================================


def make_slice(
    uuid: str,
    slice_name: str,
    translations: dict[str, dict[str, str]] | None = None,
) -> MagicMock:
    """Create mock Slice object with specified attributes."""
    slc = MagicMock()
    slc.uuid = uuid
    slc.slice_name = slice_name
    slc.translations = translations
    return slc


def make_position_json(
    components: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Create position_json structure with CHART components.

    Args:
        components: List of dicts with keys: uuid, chartId, sliceName, sliceNameOverride
    """
    position: dict[str, Any] = {
        "ROOT_ID": {"type": "ROOT", "id": "ROOT_ID", "children": []},
        "GRID_ID": {"type": "GRID", "id": "GRID_ID", "children": []},
    }
    for i, comp in enumerate(components):
        layout_id = f"CHART-{i}"
        position[layout_id] = {
            "type": "CHART",
            "id": layout_id,
            "meta": {
                "chartId": comp.get("chartId", i + 1),
                "uuid": comp["uuid"],
                "sliceName": comp.get("sliceName", ""),
                "sliceNameOverride": comp.get("sliceNameOverride"),
                "width": 4,
                "height": 50,
            },
            "children": [],
        }
    return position


# =============================================================================
# Tests: get_localized_chart_name() - Priority Chain
# =============================================================================


def test_override_translation_highest_priority() -> None:
    """
    Override translation takes priority over all other sources.

    Priority 1: override_translations[locale] wins when present.
    """
    result = get_localized_chart_name(
        override_name="Custom Override",
        override_translations={"de": "Lokalisierter Override"},
        chart_slice_name="Original Chart",
        chart_translations={"slice_name": {"de": "Lokalisiertes Chart"}},
        locale="de",
    )

    assert result == "Lokalisierter Override"


def test_override_name_when_no_override_translation() -> None:
    """
    Override name is used when no translation for override exists.

    Priority 2: override_name when override_translations[locale] missing.
    """
    result = get_localized_chart_name(
        override_name="Custom Override",
        override_translations={"fr": "French Override"},  # no German
        chart_slice_name="Original Chart",
        chart_translations={"slice_name": {"de": "Lokalisiertes Chart"}},
        locale="de",
    )

    assert result == "Custom Override"


def test_override_name_when_no_override_translations_dict() -> None:
    """
    Override name is used when override_translations is None.

    Priority 2: override_name when override_translations is None.
    """
    result = get_localized_chart_name(
        override_name="Custom Override",
        override_translations=None,
        chart_slice_name="Original Chart",
        chart_translations={"slice_name": {"de": "Lokalisiertes Chart"}},
        locale="de",
    )

    assert result == "Custom Override"


def test_chart_translation_when_no_override() -> None:
    """
    Chart translation is used when no override exists.

    Priority 3: chart_translations["slice_name"][locale] when no override.
    """
    result = get_localized_chart_name(
        override_name=None,
        override_translations=None,
        chart_slice_name="Original Chart",
        chart_translations={"slice_name": {"de": "Lokalisiertes Chart"}},
        locale="de",
    )

    assert result == "Lokalisiertes Chart"


def test_chart_slice_name_when_no_translations() -> None:
    """
    Original chart name is used when no translations exist.

    Priority 4: chart_slice_name as final fallback.
    """
    result = get_localized_chart_name(
        override_name=None,
        override_translations=None,
        chart_slice_name="Original Chart",
        chart_translations=None,
        locale="de",
    )

    assert result == "Original Chart"


def test_chart_slice_name_when_no_locale_match() -> None:
    """
    Original chart name when requested locale has no translation.

    Priority 4: chart_slice_name when locale not in translations.
    """
    result = get_localized_chart_name(
        override_name=None,
        override_translations=None,
        chart_slice_name="Original Chart",
        chart_translations={"slice_name": {"fr": "French Chart"}},
        locale="de",
    )

    assert result == "Original Chart"


# =============================================================================
# Tests: get_localized_chart_name() - Base Locale Fallback
# =============================================================================


def test_override_translation_base_locale_fallback() -> None:
    """
    Override translation falls back to base language (de from de-DE).

    Locale "de-DE" → tries "de-DE", then "de".
    """
    result = get_localized_chart_name(
        override_name="Custom Override",
        override_translations={"de": "Deutscher Override"},
        chart_slice_name="Original Chart",
        chart_translations=None,
        locale="de-DE",
    )

    assert result == "Deutscher Override"


def test_chart_translation_base_locale_fallback() -> None:
    """
    Chart translation falls back to base language (de from de-DE).

    Locale "de-DE" → tries "de-DE", then "de" for chart translations.
    """
    result = get_localized_chart_name(
        override_name=None,
        override_translations=None,
        chart_slice_name="Original Chart",
        chart_translations={"slice_name": {"de": "Deutsches Chart"}},
        locale="de-DE",
    )

    assert result == "Deutsches Chart"


def test_exact_locale_preferred_over_base() -> None:
    """
    Exact locale match preferred over base language.

    "de-AT" translation preferred over "de" when both exist.
    """
    result = get_localized_chart_name(
        override_name=None,
        override_translations=None,
        chart_slice_name="Original Chart",
        chart_translations={
            "slice_name": {
                "de": "Deutsches Chart",
                "de-AT": "Osterreichisches Chart",
            }
        },
        locale="de-AT",
    )

    assert result == "Osterreichisches Chart"


# =============================================================================
# Tests: get_localized_chart_name() - Edge Cases
# =============================================================================


def test_empty_override_name_treated_as_no_override() -> None:
    """
    Empty string override name is treated as no override.

    Falls through to chart translation.
    """
    result = get_localized_chart_name(
        override_name="",
        override_translations=None,
        chart_slice_name="Original Chart",
        chart_translations={"slice_name": {"de": "Lokalisiertes Chart"}},
        locale="de",
    )

    assert result == "Lokalisiertes Chart"


def test_empty_chart_translations_dict() -> None:
    """
    Empty chart translations dict falls back to slice_name.
    """
    result = get_localized_chart_name(
        override_name=None,
        override_translations=None,
        chart_slice_name="Original Chart",
        chart_translations={},
        locale="de",
    )

    assert result == "Original Chart"


def test_missing_slice_name_key_in_chart_translations() -> None:
    """
    Missing "slice_name" key in chart translations falls back to slice_name.
    """
    result = get_localized_chart_name(
        override_name=None,
        override_translations=None,
        chart_slice_name="Original Chart",
        chart_translations={"description": {"de": "Beschreibung"}},
        locale="de",
    )

    assert result == "Original Chart"


# =============================================================================
# Tests: localize_chart_names() - Full Position Processing
# =============================================================================


def test_localize_chart_names_applies_priority_chain() -> None:
    """
    localize_chart_names applies priority chain to all CHART components.
    """
    slices = [
        make_slice("uuid-1", "Chart One", {"slice_name": {"de": "Chart Eins"}}),
        make_slice("uuid-2", "Chart Two", None),
    ]
    slices_by_uuid = {str(s.uuid): s for s in slices}

    position = make_position_json([
        {"uuid": "uuid-1", "sliceName": "Chart One"},
        {
            "uuid": "uuid-2",
            "sliceName": "Chart Two",
            "sliceNameOverride": "Override Two",
        },
    ])

    metadata: dict[str, Any] = {
        "slice_name_overrides": {
            "uuid-2": {"translations": {"de": "Override Zwei"}},
        }
    }

    result = localize_chart_names(position, metadata, slices_by_uuid, "de")

    # Chart 1: no override → uses chart translation
    assert result["CHART-0"]["meta"]["sliceName"] == "Chart Eins"

    # Chart 2: has override with translation → uses override translation
    assert result["CHART-1"]["meta"]["sliceName"] == "Override Zwei"


def test_localize_chart_names_does_not_mutate_original() -> None:
    """
    localize_chart_names returns new dict, does not mutate original.
    """
    slices = [make_slice("uuid-1", "Chart One", {"slice_name": {"de": "Chart Eins"}})]
    slices_by_uuid = {str(s.uuid): s for s in slices}

    position = make_position_json([{"uuid": "uuid-1", "sliceName": "Chart One"}])
    original_name = position["CHART-0"]["meta"]["sliceName"]

    localize_chart_names(position, {}, slices_by_uuid, "de")

    assert position["CHART-0"]["meta"]["sliceName"] == original_name


def test_localize_chart_names_handles_no_chart_components() -> None:
    """
    localize_chart_names handles position_json without CHART components.
    """
    position: dict[str, Any] = {
        "ROOT_ID": {"type": "ROOT", "id": "ROOT_ID", "children": []},
        "MARKDOWN-1": {"type": "MARKDOWN", "id": "MARKDOWN-1", "meta": {}},
    }

    result = localize_chart_names(position, {}, {}, "de")

    assert result == position


def test_localize_chart_names_handles_missing_slice_name_overrides_key() -> None:
    """
    localize_chart_names works when slice_name_overrides key absent from metadata.
    """
    slices = [make_slice("uuid-1", "Chart One", {"slice_name": {"de": "Chart Eins"}})]
    slices_by_uuid = {str(s.uuid): s for s in slices}

    position = make_position_json([{"uuid": "uuid-1", "sliceName": "Chart One"}])
    metadata: dict[str, Any] = {}  # no slice_name_overrides

    result = localize_chart_names(position, metadata, slices_by_uuid, "de")

    assert result["CHART-0"]["meta"]["sliceName"] == "Chart Eins"


def test_localize_chart_names_handles_chart_without_matching_slice() -> None:
    """
    Chart in position_json without matching Slice uses position data only.

    Orphaned chart (uuid not in slices_by_uuid) falls back to
    override_name or original sliceName.
    """
    position = make_position_json([
        {
            "uuid": "orphan-uuid",
            "sliceName": "Orphan Chart",
            "sliceNameOverride": "Custom",
        },
    ])
    metadata: dict[str, Any] = {}
    slices_by_uuid: dict[str, Any] = {}  # empty - no matching slice

    result = localize_chart_names(position, metadata, slices_by_uuid, "de")

    # Falls back to override_name since no slice found
    assert result["CHART-0"]["meta"]["sliceName"] == "Custom"


def test_localize_chart_names_handles_chart_without_uuid_in_meta() -> None:
    """
    Chart component without uuid in meta is skipped gracefully.
    """
    position: dict[str, Any] = {
        "ROOT_ID": {"type": "ROOT", "id": "ROOT_ID", "children": []},
        "CHART-0": {
            "type": "CHART",
            "id": "CHART-0",
            "meta": {
                "chartId": 1,
                # uuid missing!
                "sliceName": "No UUID Chart",
                "width": 4,
                "height": 50,
            },
            "children": [],
        },
    }

    result = localize_chart_names(position, {}, {}, "de")

    # Preserved as-is when uuid missing
    assert result["CHART-0"]["meta"]["sliceName"] == "No UUID Chart"


def test_localize_chart_names_preserves_other_meta_fields() -> None:
    """
    localize_chart_names preserves all meta fields except sliceName.
    """
    slices = [make_slice("uuid-1", "Chart", {"slice_name": {"de": "Diagramm"}})]
    slices_by_uuid = {str(s.uuid): s for s in slices}

    position = make_position_json([{"uuid": "uuid-1", "sliceName": "Chart"}])
    position["CHART-0"]["meta"]["customField"] = "preserved"
    position["CHART-0"]["meta"]["width"] = 8

    result = localize_chart_names(position, {}, slices_by_uuid, "de")

    # sliceName updated to localized value
    assert result["CHART-0"]["meta"]["sliceName"] == "Diagramm"
    # Other fields preserved
    assert result["CHART-0"]["meta"]["customField"] == "preserved"
    assert result["CHART-0"]["meta"]["width"] == 8
    assert result["CHART-0"]["meta"]["uuid"] == "uuid-1"


def test_localize_chart_names_preserves_non_chart_components() -> None:
    """
    Non-CHART components (TABS, MARKDOWN, etc.) are preserved unchanged.
    """
    position: dict[str, Any] = {
        "ROOT_ID": {"type": "ROOT", "id": "ROOT_ID", "children": ["TABS-1"]},
        "TABS-1": {"type": "TABS", "id": "TABS-1", "meta": {"text": "Tab Group"}},
        "TAB-1": {"type": "TAB", "id": "TAB-1", "meta": {"text": "First Tab"}},
        "MARKDOWN-1": {
            "type": "MARKDOWN",
            "id": "MARKDOWN-1",
            "meta": {"code": "# Hello"},
        },
    }

    result = localize_chart_names(position, {}, {}, "de")

    assert result["TABS-1"]["meta"]["text"] == "Tab Group"
    assert result["TAB-1"]["meta"]["text"] == "First Tab"
    assert result["MARKDOWN-1"]["meta"]["code"] == "# Hello"


def test_localize_chart_names_multiple_charts_mixed_scenarios() -> None:
    """
    Multiple charts with different translation scenarios.
    """
    slices = [
        make_slice("uuid-1", "Sales", {"slice_name": {"de": "Verkauf"}}),
        make_slice("uuid-2", "Revenue", {"slice_name": {"de": "Umsatz"}}),
        make_slice("uuid-3", "Profit", None),
    ]
    slices_by_uuid = {str(s.uuid): s for s in slices}

    position = make_position_json([
        # Chart 1: has chart translation, no override
        {"uuid": "uuid-1", "sliceName": "Sales"},
        # Chart 2: has override with translation
        {
            "uuid": "uuid-2",
            "sliceName": "Revenue",
            "sliceNameOverride": "Revenue Override",
        },
        # Chart 3: has override without translation, no chart translation
        {
            "uuid": "uuid-3",
            "sliceName": "Profit",
            "sliceNameOverride": "Profit Override",
        },
    ])

    metadata: dict[str, Any] = {
        "slice_name_overrides": {
            "uuid-2": {"translations": {"de": "Umsatz-Override"}},
        }
    }

    result = localize_chart_names(position, metadata, slices_by_uuid, "de")

    # Chart 1: chart translation (no override)
    assert result["CHART-0"]["meta"]["sliceName"] == "Verkauf"
    # Chart 2: override translation
    assert result["CHART-1"]["meta"]["sliceName"] == "Umsatz-Override"
    # Chart 3: override name (no translation for override, no chart translation)
    assert result["CHART-2"]["meta"]["sliceName"] == "Profit Override"
