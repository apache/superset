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
"""A reviewer is shown the settings that moved, not how many there were.

sc-129075, QA on the previous build: "What changed: partly (readable names,
but no values/preview, 'and 3 more' hides changes)." The panel had three ways
to answer a changed field with something less than its content:

* a limit of 25 entries per field, the rest reported as "and N more";
* a count of the settings an Explore save "wrote for the first time", with no
  indication of which;
* a list of the field's top-level key names with no values, cut to three.

The server half of closing them: every entry is sent, the settings written for
the first time are entries like any other (after the edit that leads), and a
structure that moved somewhere with no entry to show for it carries a before
and an after beside its key names.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import api
from superset.utils import json


def _request(payload: dict[str, Any]) -> Any:
    return SimpleNamespace(operation="update", command_args={}, payload_dict=payload)


@pytest.fixture(autouse=True)
def no_database(mocker: Any) -> None:
    mocker.patch.object(api, "_names_of", return_value={}, create=True)


def test_no_number_of_entries_is_dropped() -> None:
    asset = SimpleNamespace(params=None)
    wide = json.dumps({f"setting_{n:04}": n for n in range(1000)})

    [entry] = api.describe_changes(_request({"params": wide}), asset)

    assert len(entry["entries"]) == 1000
    assert "more" not in entry


def test_no_number_of_layout_components_is_dropped() -> None:
    asset = SimpleNamespace(position_json="{}")
    layout = json.dumps(
        {
            f"CHART-{n}": {"type": "CHART", "id": f"CHART-{n}", "meta": {"chartId": n}}
            for n in range(80)
        }
    )

    [entry] = api.describe_changes(_request({"position_json": layout}), asset)

    assert len(entry["layout"]["components"]) == 80
    assert "more" not in entry["layout"]


def test_settings_written_for_the_first_time_are_named_not_counted() -> None:
    asset = SimpleNamespace(params=json.dumps({"viz_type": "bar", "legend": True}))
    posted = json.dumps(
        {"viz_type": "bar", "legend": False, "color_scheme": "x", "row_limit": 50}
    )

    [entry] = api.describe_changes(_request({"params": posted}), asset)

    assert [(e["kind"], e["key"]) for e in entry["entries"]] == [
        ("changed", "legend"),
        ("added", "color_scheme"),
        ("added", "row_limit"),
    ]
    assert "added_keys" not in entry
    assert all("after" in e for e in entry["entries"])


def test_names_without_values_always_come_with_the_two_values(mocker: Any) -> None:
    """If the walk finds keys that moved and nothing to say about them, the
    entry still carries a before and after: names are not a change."""
    mocker.patch.object(api, "_blob_entries", return_value=([], []))
    asset = SimpleNamespace(quux_config=json.dumps({"a": 1}))

    [entry] = api.describe_changes(
        _request({"quux_config": json.dumps({"a": 2})}), asset
    )

    assert "entries" not in entry
    assert entry["before"] and entry["after"]
