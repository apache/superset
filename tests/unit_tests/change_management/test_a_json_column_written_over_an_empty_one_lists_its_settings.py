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
"""A stored value that is empty does not turn a change into "Changed".

``params``, ``json_metadata`` and ``position_json`` were compared by parsing
both sides and diffing their keys, and an empty stored value parses to
nothing -- not to an empty object -- so there was nothing to diff against and
the field came out as the bare word. A chart whose ``params`` were empty
reached the reviewer as its whole definition in one word; a dashboard whose
``json_metadata`` was empty read "Dashboard settings / Changed".

Empty against an object is an object being written for the first time, and
every key in it is new.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import api
from superset.utils import json

EMPTY = [None, "", "  ", "{}", "null"]


def _request(payload: dict[str, Any]) -> Any:
    return SimpleNamespace(operation="update", command_args={}, payload_dict=payload)


@pytest.mark.parametrize("stored", EMPTY)
def test_chart_params_over_an_empty_value_list_their_settings(stored: Any) -> None:
    asset = SimpleNamespace(params=stored)
    proposed = json.dumps({"viz_type": "table", "groupby": ["state"]})

    [entry] = api.describe_changes(_request({"params": proposed}), asset)

    assert entry["keys"] == ["groupby", "viz_type"]
    assert {e["key"] for e in entry["entries"]} == {"groupby", "viz_type"}
    assert all(e["kind"] == "added" for e in entry["entries"])


@pytest.mark.parametrize("stored", EMPTY)
def test_dashboard_metadata_over_an_empty_value_lists_its_settings(
    stored: Any,
) -> None:
    asset = SimpleNamespace(json_metadata=stored, position_json="{}")
    proposed = json.dumps({"color_scheme": "supersetColors", "refresh_frequency": 30})

    [entry] = api.describe_changes(_request({"json_metadata": proposed}), asset)

    assert entry["keys"] == ["color_scheme", "refresh_frequency"]
    assert {e["key"]: e["after"] for e in entry["entries"]} == {
        "color_scheme": "supersetColors",
        "refresh_frequency": "30",
    }


def test_the_edit_still_leads_when_the_stored_value_is_not_empty() -> None:
    """The ranking QA-15 asked for is unchanged: what moved first, what was
    merely written down for the first time counted behind it."""
    asset = SimpleNamespace(params=json.dumps({"viz_type": "bar", "legend": True}))
    proposed = json.dumps({"viz_type": "bar", "legend": False, **{f"d{n}": n for n in range(30)}})

    [entry] = api.describe_changes(_request({"params": proposed}), asset)

    assert [e["key"] for e in entry["entries"]] == ["legend"]
    assert entry["added_keys"] == 30


def test_a_long_list_of_settings_is_capped_and_the_rest_counted() -> None:
    asset = SimpleNamespace(params=None)
    proposed = json.dumps({f"k{n:03}": n for n in range(api.MAX_ENTRIES + 7)})

    [entry] = api.describe_changes(_request({"params": proposed}), asset)

    assert len(entry["entries"]) == api.MAX_ENTRIES
    assert entry["more"] == 7


def test_a_long_value_inside_a_setting_is_cut_and_said_to_be() -> None:
    asset = SimpleNamespace(params=json.dumps({"adhoc_filters": "x"}))
    proposed = json.dumps({"adhoc_filters": "y" * (api.ENTRY_VALUE_LIMIT + 50)})

    [entry] = api.describe_changes(_request({"params": proposed}), asset)

    [only] = entry["entries"]
    assert only["truncated"] is True
    assert len(only["after"]) == api.ENTRY_VALUE_LIMIT
