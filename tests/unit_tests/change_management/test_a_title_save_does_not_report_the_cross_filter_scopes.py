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
"""Renaming a dashboard does not report its cross-filter scopes as changed.

Superset recomputes a dashboard's cross-filter scopes from its layout on
every read, and the recomputation answers with the same chart ids in a
different order. The properties dialog posts back what it was given, so a
save that moved only the title arrived with ``chart_configuration`` and
``global_chart_configuration`` differing from the stored blob by ordering
alone.

Measured on the demo: stored ``chartsInScope`` was [69, 70, 72 ... 79] and
the API answered [70, 72 ... 79, 69]. The gate therefore captured a change
the author had not made, and the reviewer's panel named two keys they had
never touched (R5-01).

The fix sorts those collections rather than exempting them. A cross-filter
scope is reviewable (Visa Q3), so a chart genuinely entering or leaving one
still has to read as a change; exempting the keys would have bought the
same quiet by making that edit invisible, which is the opposite of the
point.
"""

from __future__ import annotations

import json
from types import SimpleNamespace
from typing import Any

from asset_approval.changes import _metadata_differs, changed_keys

SCOPE = [69, 70, 72, 73, 74, 75, 76, 77, 78, 79]
REORDERED = [70, 72, 73, 74, 75, 76, 77, 78, 79, 69]


def _metadata(scope: list[int], **extra: Any) -> str:
    return json.dumps(
        {
            "color_scheme": "",
            "global_chart_configuration": {
                "scope": {"rootPath": ["ROOT_ID"], "excluded": []},
                "chartsInScope": scope,
            },
            "chart_configuration": {
                "69": {
                    "id": 69,
                    "crossFilters": {"scope": "global", "chartsInScope": scope},
                }
            },
            **extra,
        }
    )


def _dashboard() -> Any:
    return SimpleNamespace(position_json="{}")


def test_the_same_scopes_in_another_order_are_not_a_change() -> None:
    """The bug, stated as the gate sees it."""
    assert (
        _metadata_differs(
            _dashboard(), _metadata(SCOPE), _metadata(REORDERED)
        )
        is False
    )


def test_the_reviewer_is_not_shown_the_scope_keys_either() -> None:
    """The gate going quiet is half of it.

    The panel names the keys that differ, so without the same comparison it
    would still list two keys the author never touched.
    """
    assert changed_keys(_metadata(SCOPE), _metadata(REORDERED)) == []


def test_a_chart_leaving_a_scope_is_still_a_change() -> None:
    """What exempting the keys would have cost. Visa Q3 asks for this."""
    narrowed = [chart for chart in SCOPE if chart != 74]

    assert (
        _metadata_differs(_dashboard(), _metadata(SCOPE), _metadata(narrowed))
        is True
    )
    assert "global_chart_configuration" in changed_keys(
        _metadata(SCOPE), _metadata(narrowed)
    )


def test_a_chart_joining_a_scope_is_still_a_change() -> None:
    widened = SCOPE + [99]

    assert (
        _metadata_differs(_dashboard(), _metadata(SCOPE), _metadata(widened))
        is True
    )


def test_the_real_edit_still_reads_as_one() -> None:
    """The title moved; that is what the author did."""
    assert (
        _metadata_differs(
            _dashboard(),
            _metadata(SCOPE),
            _metadata(REORDERED, color_scheme="supersetColors"),
        )
        is True
    )


def test_an_excluded_list_reordered_is_not_a_change() -> None:
    """``excluded`` is a set of ids too, and travels beside the scope."""
    before = json.dumps({"global_chart_configuration": {"scope": {"excluded": [1, 2]}}})
    after = json.dumps({"global_chart_configuration": {"scope": {"excluded": [2, 1]}}})

    assert _metadata_differs(_dashboard(), before, after) is False


def test_a_root_path_is_left_ordered() -> None:
    """``rootPath`` is a path, not a set, so its order is meaning."""
    before = json.dumps({"global_chart_configuration": {"scope": {"rootPath": ["A", "B"]}}})
    after = json.dumps({"global_chart_configuration": {"scope": {"rootPath": ["B", "A"]}}})

    assert _metadata_differs(_dashboard(), before, after) is True


def test_a_mixed_collection_does_not_raise() -> None:
    """Sorting must not blow up on a blob somebody hand-edited."""
    before = json.dumps({"x": {"chartsInScope": [3, None, "a"]}})
    after = json.dumps({"x": {"chartsInScope": ["a", 3, None]}})

    assert _metadata_differs(_dashboard(), before, after) is False


def _request(payload: dict[str, Any]) -> Any:
    """Enough of a change request for ``describe_changes``."""
    return SimpleNamespace(
        operation="update", command_args={}, payload_dict=payload
    )


def test_the_panel_reports_exactly_what_the_gate_counted() -> None:
    """The two used to ask different questions.

    ``changed_fields`` compared ``json_metadata`` entry by entry, against
    the column the asset really keeps each one in. The panel compared it as
    one blob, and the payload carries the layout inside the blob while the
    asset keeps it in ``position_json``, so the two never matched and a
    title-only save still drew a bare "json_metadata Changed" row.
    """
    from asset_approval.api import describe_changes
    from asset_approval.changes import changed_fields

    asset = SimpleNamespace(
        dashboard_title="Old",
        json_metadata=_metadata(SCOPE),
        position_json="{}",
    )
    payload = {
        "dashboard_title": "New",
        # As the properties dialog sends it: round-tripped, so reordered.
        "json_metadata": _metadata(REORDERED),
    }

    counted = changed_fields(asset, payload)
    reported = [entry["field"] for entry in describe_changes(_request(payload), asset)]

    assert counted == ["dashboard_title"]
    assert reported == counted


def test_a_real_metadata_edit_still_reaches_the_panel() -> None:
    """The guard must not have made the panel blind instead of quiet."""
    from asset_approval.api import describe_changes

    asset = SimpleNamespace(
        dashboard_title="Same",
        json_metadata=_metadata(SCOPE),
        position_json="{}",
    )
    narrowed = [chart for chart in SCOPE if chart != 74]
    payload = {"dashboard_title": "Same", "json_metadata": _metadata(narrowed)}

    reported = [entry["field"] for entry in describe_changes(_request(payload), asset)]

    assert reported == ["json_metadata"]
