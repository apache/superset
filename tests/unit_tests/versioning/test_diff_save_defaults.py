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
"""Save-path defaults are not user changes.

A dashboard's first full save fills in metadata keys it never had
(``refresh_frequency: 0``, ``label_colors: {}`` and so on). Recording those as
"Set '<key>'" buries the user's real edits, so a key going from absent to the
value the save path itself writes produces no change record. Moving a key to
any other value, or away from its default later, is still recorded.

Chart params keep recording absent-to-empty transitions; the chart half of the
fix stops Explore's Conditional Formatting control writing ``[]`` on mount.
"""

from __future__ import annotations

from typing import Any

from superset.utils import json
from superset.versioning.diff import (
    ChangeRecord,
    diff_dashboard,
    diff_slice,
    diff_slice_params,
)

_FIELDS: list[str] = ["dashboard_title", "slug", "description"]

_CHART_LAYOUT: dict[str, dict[str, Any]] = {
    "ROOT_ID": {"type": "ROOT", "id": "ROOT_ID", "children": ["GRID_ID"]},
    "GRID_ID": {
        "type": "GRID",
        "id": "GRID_ID",
        "children": ["CHART-1"],
        "parents": ["ROOT_ID"],
    },
    "CHART-1": {
        "type": "CHART",
        "id": "CHART-1",
        "children": [],
        "parents": ["ROOT_ID", "GRID_ID"],
        "meta": {"chartId": 1, "uuid": "chart-uuid", "sliceName": "Flights"},
    },
}

# json_metadata as written by a dashboard's first full save with no metadata
# edits: saveDashboardRequest's cleanedData.metadata, its derived chart and
# filter configuration, and the keys set_dash_metadata normalizes.
_FIRST_SAVE_METADATA: dict[str, Any] = {
    "chart_configuration": {},
    "chart_customization_config": [],
    "color_scheme": "",
    "color_scheme_domain": [],
    "cross_filters_enabled": True,
    "default_filters": "{}",
    "expand_all_slices": False,
    "expanded_slices": {},
    "global_chart_configuration": {
        "scope": {"rootPath": ["ROOT_ID"], "excluded": []},
        "chartsInScope": [1],
    },
    "label_colors": {},
    "map_label_colors": {},
    "native_filter_configuration": [],
    "refresh_frequency": 0,
    "shared_label_colors": [],
    "timed_refresh_immune_slices": [],
}


def _dashboard(metadata: dict[str, Any] | None, **fields: Any) -> dict[str, Any]:
    return {
        "dashboard_title": "Untitled",
        "slug": None,
        "description": None,
        "json_metadata": json.dumps(metadata) if metadata is not None else None,
        "position_json": None,
        **fields,
    }


def _paths(records: list[ChangeRecord]) -> list[list[Any]]:
    return [r.path for r in records]


def test_first_full_save_records_only_the_user_changes() -> None:
    """Rebeca's repro: a dashboard created from Explore's Save modal, then
    saved once with a new title, slug and description."""
    pre: dict[str, Any] = _dashboard(None)
    post: dict[str, Any] = _dashboard(
        _FIRST_SAVE_METADATA,
        dashboard_title="Flights overview",
        slug="flights",
        description="Delays by airline",
        position_json=json.dumps(_CHART_LAYOUT),
    )

    records: list[ChangeRecord] = diff_dashboard(pre, post, fields=_FIELDS)

    assert sorted(r.path[0] for r in records if r.kind == "field") == [
        "dashboard_title",
        "description",
        "slug",
    ]
    assert [(r.kind, r.operation) for r in records if r.kind != "field"] == [
        ("chart", "add")
    ]


def test_first_full_save_from_empty_metadata_records_nothing() -> None:
    """The same defaults filled into an existing ``{}`` blob."""
    records: list[ChangeRecord] = diff_dashboard(
        _dashboard({}), _dashboard(_FIRST_SAVE_METADATA), fields=_FIELDS
    )

    assert records == []


def test_absent_key_set_to_a_non_default_value_is_recorded() -> None:
    pre: dict[str, Any] = _dashboard({})
    post: dict[str, Any] = _dashboard(
        {"refresh_frequency": 300, "cross_filters_enabled": False}
    )

    records: list[ChangeRecord] = diff_dashboard(pre, post, fields=_FIELDS)

    assert [(r.path, r.operation, r.from_value, r.to_value) for r in records] == [
        (["json_metadata", "cross_filters_enabled"], "add", None, False),
        (["json_metadata", "refresh_frequency"], "add", None, 300),
    ]


def test_default_changed_later_is_recorded() -> None:
    pre: dict[str, Any] = _dashboard({"refresh_frequency": 0, "label_colors": {}})
    post: dict[str, Any] = _dashboard(
        {"refresh_frequency": 60, "label_colors": {"a": "#fff"}}
    )

    records: list[ChangeRecord] = diff_dashboard(pre, post, fields=_FIELDS)

    assert _paths(records) == [
        ["json_metadata", "label_colors", "a"],
        ["json_metadata", "refresh_frequency"],
    ]


def test_value_changed_back_to_default_is_recorded() -> None:
    pre: dict[str, Any] = _dashboard({"refresh_frequency": 60})
    post: dict[str, Any] = _dashboard({"refresh_frequency": 0})

    records: list[ChangeRecord] = diff_dashboard(pre, post, fields=_FIELDS)

    assert [(r.path, r.from_value, r.to_value) for r in records] == [
        (["json_metadata", "refresh_frequency"], 60, 0)
    ]


def test_null_cross_filters_turned_on_is_recorded() -> None:
    """A stored null is not a missing key: the frontend reads a null
    ``cross_filters_enabled`` as disabled, so saving ``True`` enables
    cross-filters."""
    pre: dict[str, Any] = _dashboard({"cross_filters_enabled": None})
    post: dict[str, Any] = _dashboard({"cross_filters_enabled": True})

    records: list[ChangeRecord] = diff_dashboard(pre, post, fields=_FIELDS)

    assert [(r.path, r.from_value, r.to_value) for r in records] == [
        (["json_metadata", "cross_filters_enabled"], None, True)
    ]


def test_null_key_set_to_its_default_is_recorded() -> None:
    """Only a missing key is exempt. A stored null (reachable through
    import) is kept as a change, erring towards recording too much."""
    pre: dict[str, Any] = _dashboard({"refresh_frequency": None})
    post: dict[str, Any] = _dashboard({"refresh_frequency": 0})

    records: list[ChangeRecord] = diff_dashboard(pre, post, fields=_FIELDS)

    assert [(r.path, r.from_value, r.to_value) for r in records] == [
        (["json_metadata", "refresh_frequency"], None, 0)
    ]


def test_default_match_is_type_strict() -> None:
    """``1 == True`` and ``False == 0`` in Python; neither is the default
    for its key, so both are recorded."""
    pre: dict[str, Any] = _dashboard({})
    post: dict[str, Any] = _dashboard(
        {"cross_filters_enabled": 1, "refresh_frequency": False}
    )

    records: list[ChangeRecord] = diff_dashboard(pre, post, fields=_FIELDS)

    assert [(r.path, r.to_value) for r in records] == [
        (["json_metadata", "cross_filters_enabled"], 1),
        (["json_metadata", "refresh_frequency"], False),
    ]


def test_keys_outside_the_defaults_are_unchanged() -> None:
    """Only the save path's own defaults are exempt; another key going from
    absent to empty is still recorded."""
    pre: dict[str, Any] = _dashboard({})
    post: dict[str, Any] = _dashboard({"stagger_refresh": False, "filter_scopes": {}})

    records: list[ChangeRecord] = diff_dashboard(pre, post, fields=_FIELDS)

    assert sorted(r.path[1] for r in records) == ["filter_scopes", "stagger_refresh"]


def test_chart_save_without_conditional_formatting_lists_only_user_edits() -> None:
    """Rebeca's chart repro, as saved once the Conditional Formatting control
    no longer writes ``[]`` on mount: name, subtitle and show-metric-name."""
    pre: dict[str, str] = {
        "slice_name": "Flights",
        "params": json.dumps({"viz_type": "big_number_total"}),
    }
    post: dict[str, str] = {
        "slice_name": "Flights total",
        "params": json.dumps(
            {
                "viz_type": "big_number_total",
                "subtitle": "All carriers",
                "show_metric_name": True,
            }
        ),
    }

    records: list[ChangeRecord] = diff_slice(pre, post, fields=["slice_name"])

    assert sorted(tuple(r.path) for r in records) == [
        ("params", "show_metric_name"),
        ("params", "subtitle"),
        ("slice_name",),
    ]


def test_chart_params_keep_recording_absent_to_empty() -> None:
    """Chart params have no save-default table: version history deliberately
    records an empty or default value unless Explore's hydration evidence
    covers it, so the fix for charts is in the control, not here."""
    records: list[ChangeRecord] = diff_slice_params(
        json.dumps({"viz_type": "big_number_total"}),
        json.dumps({"viz_type": "big_number_total", "conditional_formatting": []}),
    )

    assert [(r.operation, r.path) for r in records] == [
        ("add", ["params", "conditional_formatting"])
    ]
