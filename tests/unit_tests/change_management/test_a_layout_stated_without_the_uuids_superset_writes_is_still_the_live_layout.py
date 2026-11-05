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
"""A client that does not echo back what the write stamps on a chart node.

Every layout-bearing dashboard save ends in ``set_dash_metadata`` with

    for obj in positions.values():
        if (chart_id := _layout_chart_id(obj)) is not None:
            obj["meta"]["uuid"] = uuid_map.get(chart_id)

so ``meta.uuid`` on a stored ``CHART`` node is the uuid of whichever chart
its ``chartId`` resolves to, whatever the body said -- and the same loop
canonicalises ``meta.chartId`` to the integer it read out of the node.

The author's browser hydrates the layout from ``position_json`` and posts the
uuids back, so the UI path matched live and looked right. A REST client, an
MCP tool or a script building the same layout by hand has no uuid to send,
and the stored result is byte-identical either way -- but the comparison read
the body literally, so *every* chart in such a body looked unlike live. The
put-back tripwire therefore did not count those charts as put back: the
revert still happened, and the sentence dropped their names, reporting four
restored components as two and in one run naming none of them.

These pin both halves. A layout stated without the server's own entries is
the live layout. A layout stated with a different value is not.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

from asset_approval.changes import changed_fields, layout_put_back

from superset.utils import json


def _chart(
    component_id: str, chart_id: Any, name: str, uuid: str | None
) -> dict[str, Any]:
    meta: dict[str, Any] = {
        "chartId": chart_id,
        "sliceName": name,
        "width": 4,
        "height": 50,
    }
    if uuid is not None:
        meta["uuid"] = uuid
    return {
        "type": "CHART",
        "id": component_id,
        "children": [],
        "parents": ["ROOT_ID", "GRID_ID", "ROW-1"],
        "meta": meta,
    }


def _live_layout() -> dict[str, Any]:
    """A real dashboard's layout: the write has stamped a uuid on each chart."""
    return {
        "ROOT_ID": {"type": "ROOT", "id": "ROOT_ID", "children": ["GRID_ID"]},
        "GRID_ID": {
            "type": "GRID",
            "id": "GRID_ID",
            "children": ["ROW-1"],
            "parents": ["ROOT_ID"],
        },
        "ROW-1": {
            "type": "ROW",
            "id": "ROW-1",
            "children": ["CHART-rev", "CHART-units"],
            "parents": ["ROOT_ID", "GRID_ID"],
            "meta": {"background": "BACKGROUND_TRANSPARENT"},
        },
        "CHART-rev": _chart(
            "CHART-rev", 1, "Quarterly Revenue", "7feb1d00-d2b6-410f-bdbd-33de78bd5d8a"
        ),
        "CHART-units": _chart(
            "CHART-units", 2, "Units Sold", "edb2ba68-6c9d-4fac-ab84-243f315a68c6"
        ),
    }


def _without_the_uuids(layout: dict[str, Any]) -> dict[str, Any]:
    """The same layout as a client with no uuid to send would state it."""
    stated = {}
    for key, node in layout.items():
        meta = node.get("meta")
        if isinstance(meta, dict) and "uuid" in meta:
            node = {**node, "meta": {k: v for k, v in meta.items() if k != "uuid"}}
        stated[key] = node
    return stated


def _draft_without_the_revenue_chart() -> dict[str, Any]:
    layout = _live_layout()
    del layout["CHART-rev"]
    layout["ROW-1"] = {**layout["ROW-1"], "children": ["CHART-units"]}
    return layout


def _dashboard() -> SimpleNamespace:
    return SimpleNamespace(
        id=6,
        dashboard_title="Sales Dashboard",
        position_json=json.dumps(_live_layout()),
        json_metadata=json.dumps({"refresh_frequency": 0}),
    )


# ---------------------------------------------- what the sentence must name


def test_a_restored_chart_stated_without_its_uuid_is_still_named() -> None:
    """The defect: the revenue chart came back and its name was dropped."""
    draft = {"position_json": json.dumps(_draft_without_the_revenue_chart())}
    body = {"position_json": json.dumps(_without_the_uuids(_live_layout()))}

    assert layout_put_back(_dashboard(), draft, body) == [
        "layout: removed chart: Quarterly Revenue"
    ]


def test_every_restored_component_is_counted_not_only_the_ones_with_a_uuid() -> None:
    """The measured symptom: four restored components reported as two."""
    draft = _live_layout()
    for gone in ("CHART-rev", "CHART-units"):
        del draft[gone]
    draft["ROW-1"] = {**draft["ROW-1"], "children": []}
    draft["GRID_ID"] = {**draft["GRID_ID"], "children": []}
    del draft["ROW-1"]

    put_back = layout_put_back(
        _dashboard(),
        {"position_json": json.dumps(draft)},
        {"position_json": json.dumps(_without_the_uuids(_live_layout()))},
    )

    assert put_back == [
        "layout: removed chart: Quarterly Revenue",
        "layout: removed chart: Units Sold",
        "layout: removed row",
    ]


def test_a_chart_id_stated_as_a_digit_string_is_the_same_chart() -> None:
    """``_layout_chart_id`` reads ``"1"`` as 1 and the write stores 1, so a
    layout round-tripped through a client that stringifies ids is live's."""
    stated = _without_the_uuids(_live_layout())
    stated["CHART-rev"] = {
        **stated["CHART-rev"],
        "meta": {**stated["CHART-rev"]["meta"], "chartId": "1"},
    }

    assert layout_put_back(
        _dashboard(),
        {"position_json": json.dumps(_draft_without_the_revenue_chart())},
        {"position_json": json.dumps(stated)},
    ) == ["layout: removed chart: Quarterly Revenue"]


def test_a_uuidless_echo_of_the_live_layout_is_not_a_change_either() -> None:
    """The same comparison the gate makes: an edit-mode echo that states the
    layout without the uuids has not moved the dashboard."""
    payload = {
        "dashboard_title": "Sales Dashboard",
        "json_metadata": json.dumps(
            {"refresh_frequency": 0, "positions": _without_the_uuids(_live_layout())}
        ),
    }

    assert changed_fields(_dashboard(), payload) == []


# ------------------------------------------------- what is still a change


def test_a_component_edited_to_a_third_value_is_not_restored() -> None:
    """Neither the draft's version nor live's. Resolving the server's own
    entries must not loosen anything else about the node."""
    draft = _live_layout()
    draft["CHART-rev"] = _chart("CHART-rev", 1, "Renamed by the draft", None)
    body = _without_the_uuids(_live_layout())
    body["CHART-rev"] = _chart("CHART-rev", 1, "Renamed again", None)

    assert layout_put_back(
        _dashboard(),
        {"position_json": json.dumps(draft)},
        {"position_json": json.dumps(body)},
    ) == []


def test_a_tile_pointed_at_a_different_chart_is_not_the_live_tile() -> None:
    """``chartId`` is what the uuid is derived *from*, so it is still
    compared: swapping the chart a tile shows is a change, not an echo."""
    swapped = _without_the_uuids(_live_layout())
    swapped["CHART-rev"] = _chart("CHART-rev", 99, "Quarterly Revenue", None)
    payload = {
        "json_metadata": json.dumps(
            {"refresh_frequency": 0, "positions": swapped}
        )
    }

    assert changed_fields(_dashboard(), payload) == ["json_metadata"]


def test_a_resized_chart_stated_without_its_uuid_is_still_an_edit() -> None:
    stated = _without_the_uuids(_live_layout())
    stated["CHART-units"] = {
        **stated["CHART-units"],
        "meta": {**stated["CHART-units"]["meta"], "height": 80},
    }
    payload = {
        "json_metadata": json.dumps({"refresh_frequency": 0, "positions": stated})
    }

    assert changed_fields(_dashboard(), payload) == ["json_metadata"]


def test_the_raw_column_on_its_own_is_still_compared_exactly() -> None:
    """Deliberate, and the reason this is not a blanket "uuids do not count".

    ``set_dash_metadata`` assigns the uuid only on the save that carries
    ``json_metadata.positions``. A body that sends the raw ``position_json``
    and no metadata goes through ``reconcile_position_json`` instead, which
    has no ``uuid_map``, so what it posts is what is stored -- and a layout
    stored without its uuids is a layout that changed.
    """
    payload = {"position_json": json.dumps(_without_the_uuids(_live_layout()))}

    assert changed_fields(_dashboard(), payload) == ["position_json"]


def test_a_row_is_compared_exactly_as_it_always_was() -> None:
    """Only a chart node carries the entries the write assigns; nothing is
    resolved on a container, so a renamed row still reads as changed."""
    stated = _without_the_uuids(_live_layout())
    stated["ROW-1"] = {
        **stated["ROW-1"],
        "meta": {"background": "BACKGROUND_WHITE"},
    }
    payload = {
        "json_metadata": json.dumps({"refresh_frequency": 0, "positions": stated})
    }

    assert changed_fields(_dashboard(), payload) == ["json_metadata"]
