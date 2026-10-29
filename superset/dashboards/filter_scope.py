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
"""Derive filter-scope caches in ``json_metadata`` from the dashboard layout.

``chartsInScope`` / ``tabsInScope`` on a native filter, and the ``chartsInScope``
lists inside ``chart_configuration`` / ``global_chart_configuration``, are
denormalized caches of the authoritative ``scope`` plus ``position_json``. They
are written when a dashboard is saved and are never revisited afterwards, so a
dashboard that has charts added or removed - or that was seeded, exported or
imported - carries scope arrays naming charts it does not contain.

The dashboard client already ignores the stored values and recomputes them from
the live layout on every load, which is why the JSON Metadata panel and
``GET /api/v1/dashboard/{id}`` disagreed on a dashboard nobody had ever saved.
Deriving them on read makes the API agree with the client and keeps integrations
that read ``native_filter_configuration`` from receiving dangling chart ids.

The rules mirror the client (``superset-frontend/src/dashboard/util``):
``calculateScopes``, ``getChartIdsInFilterScope``, ``findTabsWithChartsInScope``
and ``getCrossFiltersConfiguration``.
"""

from __future__ import annotations

import re
from typing import Any, TYPE_CHECKING

from superset.utils import json

if TYPE_CHECKING:
    from superset.models.dashboard import Dashboard

CHART_TYPE = "CHART"
TAB_TYPE = "TAB"
NATIVE_FILTER_DIVIDER_PREFIX = "NATIVE_FILTER_DIVIDER-"
DIVIDER_TYPES = frozenset({"DIVIDER", "CHART_CUSTOMIZATION_DIVIDER"})

# ``chart-<chartId>-layer-<layerIndex>``, the per-layer scope keys a deck.gl
# multi-layer chart contributes to ``scope.selectedLayers``.
LAYER_SELECTION_RE = re.compile(r"^chart-(\d+)-layer-(\d+)$")

ChartLayoutItems = dict[int, list[dict[str, Any]]]


def build_chart_layout_items(position_data: dict[str, Any]) -> ChartLayoutItems:
    """Map each chart id in the layout to the layout items that render it."""
    chart_layout_items: ChartLayoutItems = {}
    for item in position_data.values():
        if not isinstance(item, dict) or item.get("type") != CHART_TYPE:
            continue
        chart_id = item.get("meta", {}).get("chartId")
        if isinstance(chart_id, int):
            chart_layout_items.setdefault(chart_id, []).append(item)
    return chart_layout_items


def get_chart_ids_in_scope(
    scope: dict[str, Any],
    chart_ids: list[int],
    chart_layout_items: ChartLayoutItems,
) -> list[int]:
    """Charts covered by ``scope``, in ``chart_ids`` order."""
    excluded = set(scope.get("excluded") or [])
    root_path = set(scope.get("rootPath") or [])

    def in_scope(chart_id: int) -> bool:
        if chart_id in excluded:
            return False
        return any(
            parent in root_path
            for layout_item in chart_layout_items.get(chart_id, [])
            for parent in layout_item.get("parents") or []
        )

    selected_layers = scope.get("selectedLayers") or []
    if not selected_layers:
        return [chart_id for chart_id in chart_ids if in_scope(chart_id)]

    # A layer selection targets its chart directly, and suppresses the
    # rootPath/excluded test for that chart.
    charts_with_layer_selections = set()
    targeted: list[int] = []
    chart_id_set = set(chart_ids)
    for selection_key in selected_layers:
        if match := LAYER_SELECTION_RE.match(str(selection_key)):
            chart_id = int(match.group(1))
            charts_with_layer_selections.add(chart_id)
            if chart_id in chart_id_set and chart_id not in targeted:
                targeted.append(chart_id)

    return targeted + [
        chart_id
        for chart_id in chart_ids
        if chart_id not in charts_with_layer_selections
        and chart_id not in targeted
        and in_scope(chart_id)
    ]


def get_tabs_in_scope(
    charts_in_scope: list[int],
    chart_layout_items: ChartLayoutItems,
) -> list[str]:
    """Tabs holding at least one of ``charts_in_scope``."""
    tabs_in_scope: list[str] = []
    seen: set[str] = set()
    for chart_id in charts_in_scope:
        for layout_item in chart_layout_items.get(chart_id, []):
            for parent in layout_item.get("parents") or []:
                if parent.startswith(f"{TAB_TYPE}-") and parent not in seen:
                    seen.add(parent)
                    tabs_in_scope.append(parent)
    return tabs_in_scope


def _is_divider(item: dict[str, Any]) -> bool:
    return (
        str(item.get("id", "")).startswith(NATIVE_FILTER_DIVIDER_PREFIX)
        or item.get("type") in DIVIDER_TYPES
    )


def _derive_item_scopes(
    items: list[Any],
    chart_ids: list[int],
    chart_layout_items: ChartLayoutItems,
) -> list[Any]:
    """Restamp ``chartsInScope`` / ``tabsInScope`` on scoped config items.

    Items without a usable ``scope`` are returned untouched: legacy chart
    customizations target a chart directly and only gain a ``scope`` once the
    client migrates them, so overwriting their cache here would drop targeting
    the client still needs.
    """
    derived = []
    for item in items:
        if not isinstance(item, dict):
            derived.append(item)
            continue
        if _is_divider(item):
            derived.append({**item, "chartsInScope": [], "tabsInScope": []})
            continue
        scope = item.get("scope")
        if not isinstance(scope, dict) or not isinstance(scope.get("excluded"), list):
            derived.append(item)
            continue
        charts_in_scope = get_chart_ids_in_scope(scope, chart_ids, chart_layout_items)
        derived.append(
            {
                **item,
                "chartsInScope": charts_in_scope,
                "tabsInScope": get_tabs_in_scope(charts_in_scope, chart_layout_items),
            }
        )
    return derived


def _derive_cross_filter_scopes(
    metadata: dict[str, Any],
    chart_ids: list[int],
    chart_layout_items: ChartLayoutItems,
) -> None:
    global_config = metadata.get("global_chart_configuration")
    global_charts_in_scope = chart_ids
    if isinstance(global_config, dict) and isinstance(global_config.get("scope"), dict):
        global_charts_in_scope = get_chart_ids_in_scope(
            global_config["scope"], chart_ids, chart_layout_items
        )
        metadata["global_chart_configuration"] = {
            **global_config,
            "chartsInScope": global_charts_in_scope,
        }

    chart_configuration = metadata.get("chart_configuration")
    if not isinstance(chart_configuration, dict):
        return

    derived_configuration = {}
    for key, config in chart_configuration.items():
        try:
            chart_id = int(key)
        except (TypeError, ValueError):
            derived_configuration[key] = config
            continue
        # Config for a chart no longer on the dashboard is dead weight; the
        # client drops it on load for the same reason.
        if chart_id not in chart_layout_items:
            continue
        if not isinstance(config, dict):
            derived_configuration[key] = config
            continue
        cross_filters = config.get("crossFilters")
        if not isinstance(cross_filters, dict):
            derived_configuration[key] = config
            continue
        scope = cross_filters.get("scope")
        if isinstance(scope, dict):
            charts_in_scope = get_chart_ids_in_scope(
                scope, chart_ids, chart_layout_items
            )
        else:
            # Anything that is not an explicit scope object points at the
            # dashboard-wide scope, which never includes the emitting chart.
            charts_in_scope = [cid for cid in global_charts_in_scope if cid != chart_id]
        derived_configuration[key] = {
            **config,
            "crossFilters": {**cross_filters, "chartsInScope": charts_in_scope},
        }

    metadata["chart_configuration"] = derived_configuration


def derive_scopes(
    metadata: dict[str, Any],
    position_data: dict[str, Any],
    chart_ids: list[int],
) -> dict[str, Any]:
    """Return ``metadata`` with every derived scope cache recomputed.

    ``chart_ids`` orders the resulting ``chartsInScope`` arrays and should be the
    dashboard's chart ids as the client sees them, so that the API and the JSON
    Metadata panel produce byte-identical documents.
    """
    derived = dict(metadata)
    chart_layout_items = build_chart_layout_items(position_data)

    for key in ("native_filter_configuration", "chart_customization_config"):
        config = derived.get(key)
        if isinstance(config, list):
            derived[key] = _derive_item_scopes(config, chart_ids, chart_layout_items)

    _derive_cross_filter_scopes(derived, chart_ids, chart_layout_items)
    return derived


def derive_metadata_scopes(
    dashboard: Dashboard,
    metadata: dict[str, Any],
) -> dict[str, Any]:
    """``derive_scopes`` for a dashboard model's parsed ``json_metadata``."""
    return derive_scopes(
        metadata,
        dashboard.position,
        [slc.id for slc in dashboard.slices],
    )


def derive_json_metadata(dashboard: Dashboard, json_metadata: str) -> str:
    """``derive_metadata_scopes`` over a raw ``json_metadata`` string.

    Metadata that does not parse as a JSON object is handed back untouched -
    reading a dashboard is not the place to start rejecting documents that have
    always been served as-is.
    """
    try:
        metadata = json.loads(json_metadata)
    except (TypeError, ValueError):
        return json_metadata
    if not isinstance(metadata, dict):
        return json_metadata
    return json.dumps(derive_metadata_scopes(dashboard, metadata))
