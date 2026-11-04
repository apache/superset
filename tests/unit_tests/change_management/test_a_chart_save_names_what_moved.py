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
"""A reviewer is shown what the author moved, not what Explore wrote down.

QA-15 was "a dashboard save captures 10 fields while What changed shows 2",
and it was fixed on the dashboard path. The chart path was never walked, and
there it is worse. Explore posts every control's current value, so ticking
one checkbox arrives carrying 76 keys the stored ``params`` never held,
nearly all of them that control's own default.

Measured on the demo: 13 keys stored, 85 posted, **one** value actually
moved. The panel read "2 CHANGES / adhoc_filters, axisTicks,
color_by_primary_axis and 75 more". A checker shown noise instead of the
change cannot check anything, which makes this a weakness in the control
rather than a cosmetic one.

The split is a ranking and not a filter. Everything is still reported, so a
setting that is genuinely new is never hidden.
"""

from __future__ import annotations

import json
from typing import Any

from asset_approval.api import _opaque_entry
from asset_approval.changes import changed_keys_by_kind


def _params(**values: Any) -> str:
    return json.dumps(values)


def test_a_key_the_stored_blob_never_held_is_an_addition() -> None:
    kinds = changed_keys_by_kind(
        _params(viz_type="bar"),
        _params(viz_type="bar", color_scheme="supersetColors"),
    )

    assert kinds == {"moved": [], "added": ["color_scheme"], "removed": []}


def test_a_value_that_moved_is_not_an_addition() -> None:
    kinds = changed_keys_by_kind(
        _params(viz_type="bar"), _params(viz_type="line")
    )

    assert kinds == {"moved": ["viz_type"], "added": [], "removed": []}


def test_a_key_that_went_away_is_a_removal() -> None:
    kinds = changed_keys_by_kind(
        _params(viz_type="bar", compare_lag=1), _params(viz_type="bar")
    )

    assert kinds == {"moved": [], "added": [], "removed": ["compare_lag"]}


def test_shapes_that_are_not_objects_say_nothing() -> None:
    """What ``changed_keys`` does, for the same reason: the caller falls
    back to saying the field changed, which is what it used to say."""
    assert changed_keys_by_kind("[]", "[]") == {
        "moved": [],
        "added": [],
        "removed": [],
    }


def test_the_reviewer_is_shown_the_edit_first_and_then_every_other_setting() -> None:
    """The real shape of an Explore save: one edit, dozens of defaults.

    The edit leads. The defaults follow, each named with its value: they used
    to be counted ("76 further settings written for the first time"), and a
    count is not something a reviewer can approve (sc-129075).
    """
    stored = _params(viz_type="bar", adhoc_filters=["a"])
    posted = _params(
        viz_type="bar",
        adhoc_filters=["b"],
        **{f"default_{n}": n for n in range(76)},
    )

    entry = _opaque_entry("params", stored, posted)

    assert entry["keys"] == ["adhoc_filters"]
    assert "added_keys" not in entry
    assert entry["entries"][0]["key"] == "adhoc_filters"
    assert entry["entries"][0]["kind"] == "changed"
    named = [e["key"] for e in entry["entries"][1:]]
    assert sorted(named) == sorted(f"default_{n}" for n in range(76))
    assert {e["kind"] for e in entry["entries"][1:]} == {"added"}


def test_a_save_that_only_adds_settings_still_names_them() -> None:
    entry = _opaque_entry(
        "params", _params(viz_type="bar"), _params(viz_type="bar", legend=True)
    )

    assert entry["keys"] == ["legend"]
    assert [e["key"] for e in entry["entries"]] == ["legend"]
    assert "added_keys" not in entry


def test_the_layout_summary_is_left_alone() -> None:
    """``position_json`` has its own summary and does not go through this."""
    entry = _opaque_entry("position_json", "{}", "{}")

    assert entry == {"field": "position_json", "opaque": True}
