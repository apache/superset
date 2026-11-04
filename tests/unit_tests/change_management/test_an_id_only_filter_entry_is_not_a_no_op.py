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
"""A modified entry that carries only its id is not a no-op (B5).

c3e4ace695 taught the gate that a filter save which changes nothing is not
a change (R4-08). It did so by comparing the keys each proposed entry
carried, so an entry carrying nothing but its ``id`` compared nothing and
read as already holding. The DAO does not merge a modified entry: it
replaces the stored one with what was proposed, so a reviewed filter was
reduced to ``{"id": ...}`` and the API answered 200.

What the gate captures has to cover everything the apply will write.
"""

from types import SimpleNamespace
from typing import Any

import pytest
from pytest_mock import MockerFixture

from asset_approval.changes import config_diff_changes_nothing
from superset.daos.dashboard import DashboardDAO
from superset.utils import json

FILTERS = "native_filter_configuration"
CUSTOMIZATIONS = "chart_customization_config"


def _stored(key: str, *entries: dict[str, Any]) -> str:
    return json.dumps({key: list(entries), "color_scheme": "supersetColors"})


def _diff(**parts: Any) -> dict[str, Any]:
    return {"modified": [], "deleted": [], "reordered": [], **parts}


REGION = {
    "id": "NATIVE_FILTER-1",
    "name": "Region",
    "filterType": "filter_select",
    "scope": {"rootPath": ["ROOT_ID"], "excluded": []},
    "targets": [{"datasetId": 3, "column": {"name": "region"}}],
}
CUSTOMIZATION = {"id": "CHART_CUSTOMIZATION-1", "name": "Group by", "x": 1}


@pytest.mark.parametrize(
    ("key", "entry"), [(FILTERS, REGION), (CUSTOMIZATIONS, CUSTOMIZATION)]
)
def test_an_entry_carrying_only_its_id_is_held(key: str, entry: dict[str, Any]) -> None:
    stored = _stored(key, entry)
    posted = _diff(modified=[{"id": entry["id"]}])

    assert config_diff_changes_nothing(stored, posted, metadata_key=key) is False


def test_an_entry_that_dropped_a_key_is_held() -> None:
    """Not only the id-only case: any key the proposal leaves out is lost."""
    posted = _diff(modified=[{k: v for k, v in REGION.items() if k != "scope"}])

    assert (
        config_diff_changes_nothing(_stored(FILTERS, REGION), posted, metadata_key=FILTERS)
        is False
    )


def test_one_id_only_entry_among_untouched_ones_holds_the_save() -> None:
    other = {**REGION, "id": "NATIVE_FILTER-2", "name": "Country"}
    stored = _stored(FILTERS, REGION, other)
    posted = _diff(modified=[REGION, {"id": other["id"]}])

    assert config_diff_changes_nothing(stored, posted, metadata_key=FILTERS) is False


def test_an_entry_that_gained_a_key_is_still_held() -> None:
    posted = _diff(modified=[{**REGION, "description": "New"}])

    assert (
        config_diff_changes_nothing(_stored(FILTERS, REGION), posted, metadata_key=FILTERS)
        is False
    )


# ----------------------------------------------- what c3e4ace695 bought stays


@pytest.mark.parametrize(
    ("key", "entry"), [(FILTERS, REGION), (CUSTOMIZATIONS, CUSTOMIZATION)]
)
def test_an_entry_posted_back_whole_is_still_a_no_op(
    key: str, entry: dict[str, Any]
) -> None:
    posted = _diff(modified=[dict(entry)])

    assert config_diff_changes_nothing(_stored(key, entry), posted, metadata_key=key) is True


def test_an_entry_posted_back_with_its_keys_reordered_is_still_a_no_op() -> None:
    posted = _diff(modified=[dict(reversed(list(REGION.items())))])

    assert (
        config_diff_changes_nothing(_stored(FILTERS, REGION), posted, metadata_key=FILTERS)
        is True
    )


def test_an_entry_with_a_blank_field_the_store_lacks_is_still_a_no_op() -> None:
    """A modal that writes an empty field the stored filter never had."""
    posted = _diff(modified=[{**REGION, "description": ""}])

    assert (
        config_diff_changes_nothing(_stored(FILTERS, REGION), posted, metadata_key=FILTERS)
        is True
    )


def test_an_entry_whose_nested_json_is_a_string_is_still_a_no_op() -> None:
    stored = _stored(FILTERS, REGION)
    posted = _diff(modified=[{**REGION, "scope": json.dumps(REGION["scope"])}])

    assert config_diff_changes_nothing(stored, posted, metadata_key=FILTERS) is True


def test_the_scope_caches_listed_in_another_order_are_still_a_no_op() -> None:
    cached = {**REGION, "chartsInScope": [3, 1, 2]}
    posted = _diff(modified=[{**cached, "chartsInScope": [1, 2, 3]}])

    assert (
        config_diff_changes_nothing(_stored(FILTERS, cached), posted, metadata_key=FILTERS)
        is True
    )


# ------------------------------------- the invariant, against the real DAO


@pytest.fixture
def apply(mocker: MockerFixture) -> Any:
    """Run the DAO's own merge over a stored configuration.

    Only the scope derivation is stood in for: it rewrites the response the
    client reads, not what is stored, and needs a database.
    """
    mocker.patch(
        "superset.daos.dashboard.derive_metadata_scopes",
        side_effect=lambda dashboard, metadata: metadata,
    )

    def run(key: str, stored: str, diff: dict[str, Any]) -> list[Any]:
        dashboard = SimpleNamespace(json_metadata=stored)
        if key == FILTERS:
            DashboardDAO.update_native_filters_config(dashboard, diff)
        else:
            DashboardDAO.update_chart_customizations_config(dashboard, diff)
        return json.loads(dashboard.json_metadata)[key]

    return run


def _cases() -> list[tuple[str, dict[str, Any], dict[str, Any]]]:
    first = {**REGION, "id": "F1"}
    second = {**REGION, "id": "F2", "name": "Country"}
    c1 = {**CUSTOMIZATION, "id": "C1"}
    c2 = {**CUSTOMIZATION, "id": "C2", "name": "Other"}
    diffs: list[tuple[str, dict[str, Any], dict[str, Any]]] = []
    for key, entries in (
        (FILTERS, {"F1": first, "F2": second}),
        (CUSTOMIZATIONS, {"C1": c1, "C2": c2}),
    ):
        ids = list(entries)
        one, two = entries[ids[0]], entries[ids[1]]
        for diff in (
            _diff(),
            _diff(modified=[one]),
            _diff(modified=[one, two]),
            _diff(modified=[{"id": ids[0]}]),
            _diff(modified=[{"id": ids[0]}, two]),
            _diff(modified=[{"id": ids[0], "name": one["name"]}]),
            _diff(modified=[{**one, "name": "Renamed"}]),
            _diff(modified=[{k: v for k, v in one.items() if k != "name"}]),
            _diff(modified=[{"id": "NEW", "name": "Fresh"}]),
            _diff(deleted=[ids[0]]),
            _diff(deleted=["GONE"]),
            _diff(reordered=ids),
            _diff(reordered=ids[::-1]),
            _diff(reordered=ids[:1]),
            _diff(modified=[one], reordered=ids),
        ):
            diffs.append((key, entries, diff))
    return diffs


@pytest.mark.parametrize(("key", "entries", "diff"), _cases())
def test_a_diff_the_dao_would_write_something_for_is_held(
    apply: Any, key: str, entries: dict[str, Any], diff: dict[str, Any]
) -> None:
    """Whenever the gate says nothing changes, the DAO leaves it unchanged."""
    stored_config = list(entries.values())
    stored = _stored(key, *stored_config)

    written = apply(key, stored, json.loads(json.dumps(diff)))

    if config_diff_changes_nothing(stored, diff, metadata_key=key):
        assert written == stored_config
