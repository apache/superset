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

from types import SimpleNamespace
from typing import Any

from superset.dashboards.filter_scope import (
    derive_json_metadata,
    derive_metadata_scopes,
    derive_scopes,
)
from superset.utils import json

# Two charts in a tab, one chart outside it.
POSITION_DATA: dict[str, Any] = {
    "ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["GRID_ID"]},
    "CHART-outside": {
        "id": "CHART-outside",
        "type": "CHART",
        "meta": {"chartId": 1},
        "parents": ["ROOT_ID", "GRID_ID"],
    },
    "CHART-in-tab": {
        "id": "CHART-in-tab",
        "type": "CHART",
        "meta": {"chartId": 2},
        "parents": ["ROOT_ID", "GRID_ID", "TABS-1", "TAB-1"],
    },
    "CHART-also-in-tab": {
        "id": "CHART-also-in-tab",
        "type": "CHART",
        "meta": {"chartId": 3},
        "parents": ["ROOT_ID", "GRID_ID", "TABS-1", "TAB-1"],
    },
    "MARKDOWN-1": {"id": "MARKDOWN-1", "type": "MARKDOWN", "parents": ["ROOT_ID"]},
}
CHART_IDS = [1, 2, 3]


def test_stale_charts_in_scope_is_replaced() -> None:
    """The reported symptom: a scope cache naming charts that are not present."""
    metadata = {
        "native_filter_configuration": [
            {
                "id": "NATIVE_FILTER-1",
                "scope": {"rootPath": ["ROOT_ID"], "excluded": []},
                "chartsInScope": [7, 17, 23],
                "tabsInScope": ["TAB-gone"],
            }
        ]
    }

    derived = derive_scopes(metadata, POSITION_DATA, CHART_IDS)

    assert derived["native_filter_configuration"][0]["chartsInScope"] == [1, 2, 3]
    assert derived["native_filter_configuration"][0]["tabsInScope"] == ["TAB-1"]


def test_scope_narrowed_to_a_tab() -> None:
    metadata = {
        "native_filter_configuration": [
            {
                "id": "NATIVE_FILTER-1",
                "scope": {"rootPath": ["TAB-1"], "excluded": [3]},
            }
        ]
    }

    derived = derive_scopes(metadata, POSITION_DATA, CHART_IDS)

    assert derived["native_filter_configuration"][0]["chartsInScope"] == [2]
    assert derived["native_filter_configuration"][0]["tabsInScope"] == ["TAB-1"]


def test_dividers_and_unscoped_items() -> None:
    metadata = {
        "native_filter_configuration": [
            {"id": "NATIVE_FILTER_DIVIDER-1", "chartsInScope": [7], "tabsInScope": []},
            {"id": "DIVIDER-1", "type": "DIVIDER", "chartsInScope": [7]},
            # A legacy chart customization targets a chart directly and only
            # gains a scope once the client migrates it.
            {"id": "CHART_CUSTOMIZATION-1", "chartId": 7, "chartsInScope": [7]},
        ]
    }

    config = derive_scopes(metadata, POSITION_DATA, CHART_IDS)[
        "native_filter_configuration"
    ]

    assert config[0]["chartsInScope"] == []
    assert config[1]["chartsInScope"] == []
    assert config[2]["chartsInScope"] == [7]


def test_chart_configuration_drops_charts_not_on_the_dashboard() -> None:
    metadata = {
        "global_chart_configuration": {
            "scope": {"rootPath": ["ROOT_ID"], "excluded": []},
            "chartsInScope": [7, 17],
        },
        "chart_configuration": {
            "1": {"id": 1, "crossFilters": {"scope": "global", "chartsInScope": [17]}},
            "2": {
                "id": 2,
                "crossFilters": {
                    "scope": {"rootPath": ["TAB-1"], "excluded": []},
                    "chartsInScope": [23],
                },
            },
            "84": {"id": 84, "crossFilters": {"scope": "global", "chartsInScope": [7]}},
        },
    }

    derived = derive_scopes(metadata, POSITION_DATA, CHART_IDS)

    assert derived["global_chart_configuration"]["chartsInScope"] == [1, 2, 3]
    assert list(derived["chart_configuration"]) == ["1", "2"]
    # A globally scoped chart emits to every other chart, never to itself.
    assert derived["chart_configuration"]["1"]["crossFilters"]["chartsInScope"] == [
        2,
        3,
    ]
    assert derived["chart_configuration"]["2"]["crossFilters"]["chartsInScope"] == [
        2,
        3,
    ]


def test_selected_layers_target_their_chart_directly() -> None:
    metadata = {
        "native_filter_configuration": [
            {
                "id": "NATIVE_FILTER-1",
                "scope": {
                    "rootPath": ["TAB-1"],
                    "excluded": [1],
                    "selectedLayers": ["chart-1-layer-0"],
                },
            }
        ]
    }

    derived = derive_scopes(metadata, POSITION_DATA, CHART_IDS)

    # Chart 1 is excluded and outside the rootPath, but a layer selection wins.
    assert derived["native_filter_configuration"][0]["chartsInScope"] == [1, 2, 3]


def test_key_order_and_untouched_keys_are_kept() -> None:
    metadata = {
        "color_scheme": "supersetColors",
        "native_filter_configuration": [
            {
                "id": "NATIVE_FILTER-1",
                "chartsInScope": [7],
                "name": "Region",
                "scope": {"rootPath": ["ROOT_ID"], "excluded": []},
            }
        ],
        "refresh_frequency": 0,
    }

    derived = derive_scopes(metadata, POSITION_DATA, CHART_IDS)

    assert list(derived) == list(metadata)
    assert list(derived["native_filter_configuration"][0]) == [
        "id",
        "chartsInScope",
        "name",
        "scope",
        "tabsInScope",
    ]
    assert derived["color_scheme"] == "supersetColors"
    assert derived["refresh_frequency"] == 0


def test_derive_metadata_scopes_orders_by_dashboard_charts() -> None:
    dashboard = SimpleNamespace(
        position=POSITION_DATA,
        slices=[SimpleNamespace(id=3), SimpleNamespace(id=1), SimpleNamespace(id=2)],
    )
    metadata = {
        "native_filter_configuration": [
            {
                "id": "NATIVE_FILTER-1",
                "scope": {"rootPath": ["ROOT_ID"], "excluded": []},
            }
        ]
    }

    derived = derive_metadata_scopes(dashboard, metadata)  # type: ignore[arg-type]

    assert derived["native_filter_configuration"][0]["chartsInScope"] == [3, 1, 2]


def test_derive_json_metadata_round_trip() -> None:
    dashboard = SimpleNamespace(position=POSITION_DATA, slices=[SimpleNamespace(id=1)])
    stored = json.dumps(
        {
            "native_filter_configuration": [
                {
                    "id": "NATIVE_FILTER-1",
                    "scope": {"rootPath": ["ROOT_ID"], "excluded": []},
                    "chartsInScope": [61, 62],
                }
            ]
        }
    )

    derived = json.loads(derive_json_metadata(dashboard, stored))  # type: ignore[arg-type]

    assert derived["native_filter_configuration"][0]["chartsInScope"] == [1]


def test_derive_json_metadata_passes_through_unparsable_metadata() -> None:
    dashboard = SimpleNamespace(position={}, slices=[])

    assert derive_json_metadata(dashboard, "not json") == "not json"  # type: ignore[arg-type]
    assert derive_json_metadata(dashboard, "[]") == "[]"  # type: ignore[arg-type]
