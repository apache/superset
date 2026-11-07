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
"""R5-01: the dashboard editor writes its whole metadata shape on every save.

A dashboard stored before a key existed comes back carrying that key at its
own default, and the gate used to read it as a change the author never made.
Two mechanisms already handle most of it: ``UNORDERED_ID_LISTS`` stops a
re-derived id list counting as moved, and ``_says_what_absence_already_says``
knows the ten seeded defaults plus the whole-dashboard cross-filter scope.

Two keys were outside both, and they are the two a QA round kept seeing:
``chart_configuration`` (the per-chart cross-filter configs, whose global
sibling had a bespoke rule while it had none) and ``show_chart_timestamps``
(absent from the seeded defaults).

The cost was not only a noisy diff. Because the gate captured a change
nobody made, a save carrying ONLY exempt fields was held for review instead
of applying -- so adding an editor through the properties dialog answered
202 and did nothing, and no reviewer could be given the asset in the first
place. That is the last test here, and it is the one that matters.
"""

from __future__ import annotations

from typing import Any

import pytest
from asset_approval.changes import changed_fields, keys_the_editor_filled_in
from superset.versioning.diff import DASHBOARD_JSON_METADATA_SAVE_DEFAULTS
from superset.utils import json

#: What `getCrossFiltersConfiguration` synthesises for an unscoped chart:
#: a pointer at the dashboard-wide scope, and a list derived from the layout.
def _default_entry(chart_id: int, in_scope: list[int]) -> dict[str, Any]:
    return {
        "id": chart_id,
        "crossFilters": {"scope": "global", "chartsInScope": in_scope},
    }


def _stored(**metadata: Any) -> Any:
    class Dashboard:
        dashboard_title = "Quarterly"
        json_metadata = json.dumps(metadata)
        css = None
        slug = None
        position_json = None

    return Dashboard()


def _posted(**metadata: Any) -> dict[str, Any]:
    return {"json_metadata": json.dumps(metadata)}


# ---- the two keys that were outside the mechanism ---------------------------


def test_the_per_chart_cross_filter_configs_say_what_absence_says() -> None:
    """Every entry a pointer at the global scope, which is the default."""
    filled = keys_the_editor_filled_in(
        json.dumps({}),
        json.dumps(
            {
                "chart_configuration": {
                    "1": _default_entry(1, [2, 3]),
                    "2": _default_entry(2, [1, 3]),
                }
            }
        ),
    )

    assert "chart_configuration" in filled


def test_but_a_scope_somebody_set_is_still_a_change() -> None:
    """A cross-filter scope is reviewable (Visa Q3). A chart entering or
    leaving one has to read as a change, or this rule would buy quiet by
    making a real edit invisible."""
    filled = keys_the_editor_filled_in(
        json.dumps({}),
        json.dumps(
            {
                "chart_configuration": {
                    "1": {
                        "id": 1,
                        "crossFilters": {
                            "scope": {"rootPath": ["TAB-abc"], "excluded": [2]},
                            "chartsInScope": [3],
                        },
                    }
                }
            }
        ),
    )

    assert "chart_configuration" not in filled


def test_nor_is_an_entry_carrying_anything_else() -> None:
    """A key nobody here has met is not one this rule may wave through."""
    filled = keys_the_editor_filled_in(
        json.dumps({}),
        json.dumps(
            {"chart_configuration": {"1": {"id": 1, "somethingNew": {"a": 1}}}}
        ),
    )

    assert "chart_configuration" not in filled


def test_show_chart_timestamps_is_a_declared_default() -> None:
    """It is written on every save, reading absence as false."""
    assert DASHBOARD_JSON_METADATA_SAVE_DEFAULTS["show_chart_timestamps"] is False

    filled = keys_the_editor_filled_in(
        json.dumps({}), json.dumps({"show_chart_timestamps": False})
    )

    assert "show_chart_timestamps" in filled


def test_but_turning_the_timestamps_on_is_a_change() -> None:
    filled = keys_the_editor_filled_in(
        json.dumps({}), json.dumps({"show_chart_timestamps": True})
    )

    assert "show_chart_timestamps" not in filled


# ---- the consequence, which is the defect ----------------------------------


def test_an_exempt_only_save_is_not_held_by_the_shape_the_editor_filled_in() -> None:
    """The properties dialog could not make an editors-only change.

    It re-serialises the whole of `json_metadata` from live page state, so a
    save that touches nothing but `editors` still arrives carrying
    `chart_configuration`, `global_chart_configuration` and
    `show_chart_timestamps`. Read as changes, those made the write governed:
    it answered 202, filed a change request, and the editors were not added
    -- so there was no second editor, and therefore nobody who could ever
    approve anything on that dashboard.
    """
    asset = _stored()
    posted = {
        "editors": [7, 8],
        **_posted(
            chart_configuration={"1": _default_entry(1, [2])},
            global_chart_configuration={
                "scope": {"rootPath": ["ROOT_ID"], "excluded": []},
                "chartsInScope": [1, 2],
            },
            show_chart_timestamps=False,
            refresh_frequency=0,
        ),
    }

    moved = set(changed_fields(asset, posted))

    assert moved == {"editors"}, (
        "the shape the editor filled in was read as a change, so an "
        "exempt-only save was held for review"
    )


def test_a_real_edit_in_the_same_save_is_still_governed() -> None:
    """The counterweight. Filling in the shape must not hide what moved."""
    asset = _stored()
    posted = {
        "dashboard_title": "Quarterly — renamed",
        **_posted(
            chart_configuration={"1": _default_entry(1, [2])},
            show_chart_timestamps=False,
        ),
    }

    assert "dashboard_title" in set(changed_fields(asset, posted))
