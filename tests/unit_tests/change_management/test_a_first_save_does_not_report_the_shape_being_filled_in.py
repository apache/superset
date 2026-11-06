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
"""R5-01, re-filed: the gate was right and the panel was not.

Edit mode posts the whole metadata shape, so the first save of a dashboard
stored before that shape existed carries ten keys it never had, every one
at its own default. Writing down ``refresh_frequency: 0`` on a dashboard
that has no refresh frequency states what its absence already stated.

``_metadata_differs`` knew that. It returned False, the save folded, the
dashboard was not locked, and ``changed_fields`` did not name
``json_metadata``. The reviewer's panel asked a different question and
listed all ten, so a title change was presented as eleven changes with the
real one somewhere in the list. That is this ticket as QA re-filed it, and
the "lists dozens of internal settings instead of the one real edit" half
of 129075.

Both now ask one function, which is the point: the previous fix for this
ticket -- sorting the recomputed scope lists -- was made in the gate and
not in the panel, and the panel went on reporting what the gate ignored.
"""

from __future__ import annotations

import json
from types import SimpleNamespace
from typing import Any

from asset_approval.api import _opaque_entry
from asset_approval.changes import (
    SEEDED_METADATA_DEFAULTS,
    _metadata_differs,
    keys_the_editor_filled_in,
)

#: An older dashboard: what was stored before the current editor existed.
STORED = {"color_scheme": "supersetColors"}


def _first_save(**edits: Any) -> str:
    """What edit mode posts: everything it knows about, defaults included."""
    return json.dumps({**STORED, **dict(SEEDED_METADATA_DEFAULTS), **edits})


def _stored(**edits: Any) -> str:
    return json.dumps({**STORED, **edits})


def _dashboard() -> Any:
    return SimpleNamespace(position_json="{}")


def test_the_gate_was_already_quiet_about_them() -> None:
    """Pinned because it is the half that was right, and the fix must not
    be mistaken for one that changes it."""
    assert _metadata_differs(_dashboard(), _stored(), _first_save()) is False


def test_the_panel_no_longer_names_them_either() -> None:
    """The defect. This listed all ten."""
    entry = _opaque_entry("json_metadata", _stored(), _first_save())

    assert "keys" not in entry


def test_the_one_real_edit_still_leads() -> None:
    """A title save that also fills the shape in reports the title."""
    entry = _opaque_entry(
        "json_metadata",
        _stored(),
        _first_save(color_scheme="blueToGreen"),
    )

    assert entry["keys"] == ["color_scheme"]


def test_turning_a_setting_off_is_still_a_change() -> None:
    """What exempting the keys outright would have cost. A dashboard that
    refreshes every five minutes and is sent 0 has had it turned off."""
    before = _stored(refresh_frequency=300)
    after = json.dumps(
        {**STORED, **dict(SEEDED_METADATA_DEFAULTS), "refresh_frequency": 0}
    )

    assert _metadata_differs(_dashboard(), before, after) is True
    assert _opaque_entry("json_metadata", before, after)["keys"] == [
        "refresh_frequency"
    ]


def test_only_the_exact_default_counts() -> None:
    """Type included, so a truthy stand-in is not the default."""
    assert keys_the_editor_filled_in(
        _stored(), json.dumps({**STORED, "expand_all_slices": False})
    ) == frozenset({"expand_all_slices"})
    assert (
        keys_the_editor_filled_in(
            _stored(), json.dumps({**STORED, "expand_all_slices": 0})
        )
        == frozenset()
    )


def test_a_key_the_dashboard_already_had_is_never_exempt() -> None:
    """Asked only of a key the stored metadata does not have at all."""
    assert (
        keys_the_editor_filled_in(
            _stored(refresh_frequency=300),
            json.dumps({**STORED, "refresh_frequency": 0}),
        )
        == frozenset()
    )


def test_a_chart_is_not_touched_by_this() -> None:
    """These are dashboard metadata defaults. A chart's params go through
    the ranking in `_opaque_entry`, which is a different answer to a
    different question."""
    assert keys_the_editor_filled_in(
        json.dumps({"viz_type": "table"}),
        json.dumps({"viz_type": "table", "refresh_frequency": 0}),
    ) == frozenset({"refresh_frequency"})
    entry = _opaque_entry(
        "params",
        json.dumps({"viz_type": "table"}),
        json.dumps({"viz_type": "table", "refresh_frequency": 0}),
    )
    assert entry["keys"] == ["refresh_frequency"]


def test_the_query_envelope_is_grouped_like_the_controls() -> None:
    """A chart save posts `query_context` in full beside `params`.

    Scoping the grouping to `params` alone fixed the complaint in one
    field and left it standing in the next: the first save of an older
    chart still put `datasource`, `force`, `form_data`, `queries`,
    `result_format` and `result_type` -- two of them long JSON blobs --
    between the real edit and the end of the panel.
    """
    before = json.dumps({"queries": [{"row_limit": 100}]})
    after = json.dumps(
        {
            "queries": [{"row_limit": 50}],
            "datasource": {"id": 1, "type": "table"},
            "force": False,
            "result_format": "json",
            "result_type": "full",
        }
    )

    entry = _opaque_entry("query_context", before, after)
    rows = entry["entries"]

    # `queries` is a list, so it is reported whole rather than drilled
    # into; what matters here is which side of the grouping it lands on.
    assert [r["key"] for r in rows if not r.get("first_time")] == ["queries"]
    assert {r["key"] for r in rows if r.get("first_time")} == {
        "datasource",
        "force",
        "result_format",
        "result_type",
    }


def test_a_column_that_is_not_posted_wholesale_is_untouched() -> None:
    """The flag belongs to the blobs Explore posts in full. A colour map
    gaining a colour is the author choosing it, and grouping that would be
    this defect with a different victim."""
    entry = _opaque_entry(
        "json_metadata",
        json.dumps({"label_colors": {"Sales": "#111111"}}),
        json.dumps({"label_colors": {"Sales": "#111111", "Refunds": "#00ff00"}}),
    )

    assert all(not r.get("first_time") for r in entry["entries"])
