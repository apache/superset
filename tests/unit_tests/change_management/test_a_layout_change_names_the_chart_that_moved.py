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
"""A layout change says which chart, and says so when the layout was empty.

``layout_summary`` counted -- "1 added, 0 removed, 1 moved" -- because the
keys of ``position_json`` are generated element ids and a list of them means
nothing. But every chart element carries its own ``meta`` with the chart's
name, which is what a reviewer recognises, and the summary never read it.

And when the stored layout was empty the summary returned nothing at all, so
the first layout a dashboard ever had read as the bare word "Changed", not
even the counts.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

from asset_approval import api
from superset.utils import json


def _chart(chart_id: int, name: str, parents: list[str] | None = None, **meta: Any):
    return {
        "type": "CHART",
        "id": f"CHART-{chart_id}",
        "meta": {"chartId": chart_id, "sliceName": name, **meta},
        "parents": parents or ["ROOT_ID", "GRID_ID", "ROW-1"],
        "children": [],
    }


def _row(*children: str) -> dict[str, Any]:
    return {"type": "ROW", "id": "ROW-1", "children": list(children), "parents": []}


def _layout(*components: dict[str, Any], row: tuple[str, ...] = ()) -> str:
    body = {c["id"]: c for c in components}
    body["ROW-1"] = _row(*row)
    return json.dumps(body)


def _request(payload: dict[str, Any]) -> Any:
    return SimpleNamespace(operation="update", command_args={}, payload_dict=payload)


def test_the_chart_that_arrived_is_named() -> None:
    asset = SimpleNamespace(position_json=_layout(_chart(1, "Revenue")))
    proposed = _layout(
        _chart(1, "Revenue"), _chart(2, "Churn by region"), row=("CHART-1", "CHART-2")
    )

    [entry] = api.describe_changes(_request({"position_json": proposed}), asset)

    components = entry["layout"]["components"]
    assert {"kind": "added", "type": "CHART", "name": "Churn by region"} in components
    # The row that gained a child is counted and not listed a second time.
    assert not any(c["type"] == "ROW" for c in components)
    assert entry["layout"]["added"] == 1


def test_the_chart_that_left_is_named() -> None:
    asset = SimpleNamespace(
        position_json=_layout(_chart(1, "Revenue"), _chart(2, "Churn"))
    )
    proposed = _layout(_chart(1, "Revenue"))

    [entry] = api.describe_changes(_request({"position_json": proposed}), asset)

    assert {"kind": "removed", "type": "CHART", "name": "Churn"} in entry["layout"][
        "components"
    ]


def test_a_chart_moved_to_another_row_says_it_moved() -> None:
    asset = SimpleNamespace(position_json=_layout(_chart(1, "Revenue")))
    proposed = _layout(
        _chart(1, "Revenue", parents=["ROOT_ID", "GRID_ID", "ROW-9"])
    )

    [entry] = api.describe_changes(_request({"position_json": proposed}), asset)

    [moved] = [c for c in entry["layout"]["components"] if c["type"] == "CHART"]
    assert moved["kind"] == "changed"
    assert moved["name"] == "Revenue"
    assert moved["moved"] is True


def test_a_resized_chart_says_what_changed_about_it() -> None:
    asset = SimpleNamespace(position_json=_layout(_chart(1, "Revenue", width=4)))
    proposed = _layout(_chart(1, "Revenue", width=12))

    [entry] = api.describe_changes(_request({"position_json": proposed}), asset)

    [resized] = [c for c in entry["layout"]["components"] if c["type"] == "CHART"]
    assert resized["details"] == ["width 4 → 12"]


def test_a_layout_written_over_an_empty_one_names_what_it_holds() -> None:
    """C18. The stored layout was empty, so the old code compared nothing
    with a dict, found no difference it could name, and said "Changed"."""
    for stored in (None, "", "{}", "  "):
        asset = SimpleNamespace(position_json=stored)
        proposed = _layout(_chart(1, "Revenue"), row=("CHART-1",))

        [entry] = api.describe_changes(_request({"position_json": proposed}), asset)

        assert entry["layout"]["added"] == 2, stored
        assert {"kind": "added", "type": "CHART", "name": "Revenue"} in entry[
            "layout"
        ]["components"]


def test_a_component_type_nobody_has_met_is_named_not_skipped() -> None:
    """Containers are left out because naming the row too would be a second
    line for one move. Everything else is listed, so a new component type
    appears rather than vanishing."""
    asset = SimpleNamespace(position_json="{}")
    proposed = json.dumps(
        {"WIDGET-1": {"type": "WIDGET", "id": "WIDGET-1", "meta": {"text": "hello"}}}
    )

    [entry] = api.describe_changes(_request({"position_json": proposed}), asset)

    assert {"kind": "added", "type": "WIDGET", "name": "hello"} in entry["layout"][
        "components"
    ]


def test_the_layout_inside_json_metadata_is_named_too() -> None:
    """A dashboard save carries the layout inside ``json_metadata`` as
    ``positions``; the asset keeps it in ``position_json``."""
    asset = SimpleNamespace(
        json_metadata="{}", position_json=_layout(_chart(1, "Revenue"))
    )
    metadata = json.dumps(
        {
            "positions": json.loads(
                _layout(_chart(1, "Revenue"), _chart(2, "Churn"), row=("CHART-1", "CHART-2"))
            )
        }
    )

    [entry] = api.describe_changes(_request({"json_metadata": metadata}), asset)

    assert {"kind": "added", "type": "CHART", "name": "Churn"} in entry["layout"][
        "components"
    ]
    assert "positions" not in entry.get("keys", [])
