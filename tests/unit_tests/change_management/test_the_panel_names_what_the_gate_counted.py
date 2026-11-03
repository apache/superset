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
"""A reviewer is not shown keys the gate ignores.

Superset recomputes some ``json_metadata`` entries on every read, so they
move without anybody setting them. The gate has always excluded those
(``DERIVED_METADATA_KEYS``), but the panel's key list did not, so saving a
dashboard from edit mode reported "map_label_colors, shared_label_colors"
as what changed: two keys the author never touched, with nothing said about
what actually moved.

Found by retesting 129075 by hand against the running build.
"""

from __future__ import annotations

import json
from typing import Any

from asset_approval.api import _opaque_entry
from asset_approval.changes import DERIVED_METADATA_KEYS


def _metadata(**values: Any) -> str:
    return json.dumps(values)


def test_a_derived_key_moving_on_its_own_names_nothing() -> None:
    """The bug. Superset moved these, not the author."""
    entry = _opaque_entry(
        "json_metadata",
        _metadata(shared_label_colors={"a": "#111"}, color_scheme="x"),
        _metadata(shared_label_colors={"a": "#222"}, color_scheme="x"),
    )

    assert "keys" not in entry
    assert entry == {"field": "json_metadata", "opaque": True}


def test_every_derived_key_is_excluded() -> None:
    """Read from the gate's own set, so the two cannot drift apart again."""
    before = _metadata(**{key: 1 for key in DERIVED_METADATA_KEYS})
    after = _metadata(**{key: 2 for key in DERIVED_METADATA_KEYS})

    assert "keys" not in _opaque_entry("json_metadata", before, after)


def test_a_real_edit_beside_a_derived_one_still_names_the_real_edit() -> None:
    """The reviewer must still be told what the author did."""
    entry = _opaque_entry(
        "json_metadata",
        _metadata(shared_label_colors={"a": "#111"}, color_scheme="old"),
        _metadata(shared_label_colors={"a": "#222"}, color_scheme="new"),
    )

    assert entry["keys"] == ["color_scheme"]


def test_a_chart_s_settings_are_untouched_by_this() -> None:
    """The exclusion is for ``json_metadata`` only: these names are
    Explore controls, and a chart has no derived metadata."""
    entry = _opaque_entry(
        "params",
        json.dumps({"shared_label_colors": 1, "viz_type": "table"}),
        json.dumps({"shared_label_colors": 2, "viz_type": "table"}),
    )

    assert entry["keys"] == ["shared_label_colors"]
