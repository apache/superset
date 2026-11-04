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
"""A field the panel has never heard of still shows what it was and what it becomes.

Every row of the "held, but the reviewer is shown nothing usable" class had
one cause. The panel decided how to draw a field from a list of names, a
whitelist of scalar types and a whitelist of command names, and a field that
none of them covered came out as the bare word "Changed", a blank, or
silence. The reviewer approved it unseen.

The gate never worked that way: ``changed_fields`` walks every key in the
body and counts one it does not recognise as changed. So the panel now draws
each field the gate counted from its two values alone, and these tests use
field names that appear nowhere in the code to prove it. A test that named a
field the code knew would pass whether or not the class was closed.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import api
from asset_approval.changes import changed_fields
from superset.utils import json


def _request(payload: dict[str, Any], command: str | None = None) -> Any:
    return SimpleNamespace(
        operation="update",
        command_args={"command": command} if command else {},
        payload_dict=payload,
    )


def _bare(entry: dict[str, Any]) -> bool:
    """Whether an entry tells the reviewer nothing about what moved."""
    if entry.get("layout") or entry.get("entries") or entry.get("keys"):
        return False
    return entry.get("before") is None and entry.get("after") is None


@pytest.fixture(autouse=True)
def no_database(mocker: Any) -> None:
    """Names are looked up in the database; none is needed to show a value."""
    mocker.patch.object(api, "_names_of", return_value={}, create=True)


def test_an_unrecognised_scalar_shows_both_values() -> None:
    asset = SimpleNamespace(zorblax_mode="strict")

    [entry] = api.describe_changes(_request({"zorblax_mode": "lenient"}), asset)

    assert entry == {"field": "zorblax_mode", "before": "strict", "after": "lenient"}


def test_an_unrecognised_object_lists_the_setting_that_moved() -> None:
    """Not "Changed": the setting, with its value on each side."""
    asset = SimpleNamespace(
        quux_config=json.dumps({"retries": 3, "mode": "fast"}),
    )
    proposed = json.dumps({"retries": 5, "mode": "fast"})

    [entry] = api.describe_changes(_request({"quux_config": proposed}), asset)

    assert entry["entries"] == [
        {"kind": "changed", "key": "retries", "before": "3", "after": "5"}
    ]
    assert not _bare(entry)


def test_an_unrecognised_object_walks_into_nested_objects() -> None:
    asset = SimpleNamespace(
        quux_config=json.dumps({"outer": {"inner": {"leaf": "a"}}}),
    )
    proposed = json.dumps({"outer": {"inner": {"leaf": "b"}}})

    [entry] = api.describe_changes(_request({"quux_config": proposed}), asset)

    assert [e["key"] for e in entry["entries"]] == ["outer.inner.leaf"]


def test_an_unrecognised_list_names_what_joined_and_what_left() -> None:
    asset = SimpleNamespace(
        wibble_members=[SimpleNamespace(id=1, name="ann"), SimpleNamespace(id=2, name="bo")]
    )

    [entry] = api.describe_changes(_request({"wibble_members": [2, 3]}), asset)

    assert {(e["kind"], e["key"]) for e in entry["entries"]} == {
        ("added", "3"),
        ("removed", "ann"),
    }
    assert entry["count"] == {"before": 2, "after": 2}


def test_an_unknown_command_shows_every_key_in_its_body() -> None:
    """The old whitelist returned nothing for a command it did not list, and
    the generic path then dropped any key whose value was not a scalar."""
    asset = SimpleNamespace()

    fields = api.describe_changes(
        _request({"alpha": ["x", "y"], "beta": {"k": 1}, "gamma": 7}, "brand_new"),
        asset,
    )

    assert [entry["field"] for entry in fields] == ["alpha", "beta", "gamma"]
    assert not any(_bare(entry) for entry in fields)


def test_a_text_field_cleared_to_nothing_still_has_an_after() -> None:
    """C21's server half: the after is the empty string, not a missing key.

    The panel turns it into a dash; it can only do that if the key is there.
    """
    asset = SimpleNamespace(dashboard_title="Revenue")

    [entry] = api.describe_changes(_request({"dashboard_title": ""}), asset)

    assert entry == {"field": "dashboard_title", "before": "Revenue", "after": ""}


@pytest.mark.parametrize(
    ("current", "proposed"),
    [
        ("a", "b"),
        (None, "b"),
        ("a", None),
        (1, 2),
        (True, False),
        ({"k": 1}, {"k": 2}),
        (json.dumps({"k": 1}), json.dumps({"k": 2})),
        (json.dumps({}), json.dumps({"k": 2})),
        (None, json.dumps({"k": 2})),
        ("", json.dumps({"k": 2})),
        ([1, 2], [2, 3]),
        ([], [1]),
        ([SimpleNamespace(id=1, label="x")], []),
        (None, [1, 2]),
        ("plain text", json.dumps({"k": 2})),
    ],
)
def test_no_pair_of_values_comes_out_as_the_bare_word(
    current: Any, proposed: Any
) -> None:
    """The property that retires the class, over shapes of value rather than
    over fields: if the gate counts it, the panel can say what moved."""
    asset = SimpleNamespace(never_heard_of_it=current)

    [entry] = api.describe_changes(_request({"never_heard_of_it": proposed}), asset)

    assert not _bare(entry), entry


def test_the_panel_lists_exactly_the_fields_the_gate_counted() -> None:
    """Whatever mix of fields a body carries, one entry for each the gate
    counts and none of them empty-handed."""
    asset = SimpleNamespace(
        dashboard_title="Old",
        css="",
        json_metadata="{}",
        position_json="",
        a_new_thing=None,
        another=[SimpleNamespace(id=4)],
    )
    payload = {
        "dashboard_title": "New",
        "css": "body { display: none }",
        "json_metadata": json.dumps({"color_scheme": "x"}),
        "position_json": json.dumps({"CHART-1": {"type": "CHART", "meta": {}}}),
        "a_new_thing": {"deep": {"er": 1}},
        "another": [4, 5],
    }

    entries = api.describe_changes(_request(payload), asset)

    assert [entry["field"] for entry in entries] == changed_fields(asset, payload)
    assert not any(_bare(entry) for entry in entries)
