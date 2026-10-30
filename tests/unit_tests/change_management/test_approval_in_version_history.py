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
"""The approval has to be visible where people look for it.

An approved change replays as its author, so the version-history entry
is credited to the author -- which is right, they wrote it. What the
entry could not say is that somebody else let it through, because
nothing on the versioning side knows a change request exists and there
is no column joining the two (QA-16).

The host already has a place for a fact a field diff cannot express: the
``__meta__`` headline record, which is how a restore says which version
it restored. The approval rides the same record under its own key.

Two things these tests pin that are easy to get wrong. The headline is a
single slot, so an approved *restore* has to keep both facts rather than
one overwriting the other. And annotating must never be able to fail an
approval: the durable record is the change request, and this is a
convenience surface over it.
"""

from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import lifecycle
from pytest_mock import MockerFixture

from superset.versioning.changes import ACTION_META_KEY, build_action_headline

REVIEWER = SimpleNamespace(id=3, first_name="Priya", last_name="Shah")


@pytest.fixture
def info(mocker: MockerFixture) -> dict[str, Any]:
    """``db.session.info``, which is where the headline is handed over."""
    store: dict[str, Any] = {}
    mocker.patch.object(
        lifecycle, "db", SimpleNamespace(session=SimpleNamespace(info=store))
    )
    mocker.patch.object(lifecycle, "get_user", return_value=REVIEWER)
    return store


def _request(asset_type: str = "dashboard") -> SimpleNamespace:
    return SimpleNamespace(id=17, asset_type=asset_type, asset_id=11)


def test_the_approval_is_announced(info: dict[str, Any]) -> None:
    lifecycle._announce_approval(_request(), "looks right to me")

    approval = info[ACTION_META_KEY]["record"].to_value["approval"]
    assert approval["change_request_id"] == 17
    assert approval["by"] == {"id": 3, "first_name": "Priya", "last_name": "Shah"}
    assert approval["note"] == "looks right to me"


def test_it_is_announced_against_the_right_asset(info: dict[str, Any]) -> None:
    lifecycle._announce_approval(_request(asset_type="chart"), None)

    headline = info[ACTION_META_KEY]
    assert headline["entity_kind"] == "chart"
    assert headline["entity_id"] == 11


def test_an_approval_without_a_note_still_announces(info: dict[str, Any]) -> None:
    # The note is optional on approve, and its absence is not a reason to
    # leave the approval itself unrecorded.
    lifecycle._announce_approval(_request(), None)

    assert info[ACTION_META_KEY]["record"].to_value["approval"]["note"] is None


def test_an_approved_restore_keeps_both_facts(info: dict[str, Any]) -> None:
    # The slot is single. A restore fills it during the replay, so the
    # approval has to merge rather than replace -- otherwise approving a
    # restore loses "Restored to version N" from the panel.
    info[ACTION_META_KEY] = build_action_headline(
        "dashboard", 11, {"version_uuid": "abc", "version_number": 4}
    )

    lifecycle._announce_approval(_request(), "fine")

    to_value = info[ACTION_META_KEY]["record"].to_value
    assert to_value["version_number"] == 4
    assert to_value["version_uuid"] == "abc"
    assert to_value["approval"]["change_request_id"] == 17


def test_the_record_stays_the_shape_the_panel_parses(info: dict[str, Any]) -> None:
    # The frontend dispatches on these, and the API only lets a record
    # through if its kind and operation are in core's allowlists.
    lifecycle._announce_approval(_request(), None)

    record = info[ACTION_META_KEY]["record"]
    assert record.kind == "__meta__"
    assert record.operation == "announce"
    assert record.path == ["__meta__"]


def test_a_failure_to_annotate_does_not_fail_the_approval(
    mocker: MockerFixture,
) -> None:
    """The ordering rule, stated as a test.

    ``change_requests`` is the audit record and the caller has already
    written it. Version history prunes on a retention window and this one
    does not, so losing the annotation is a cosmetic loss and raising
    here would discard a decision a person actually made.
    """
    mocker.patch.object(
        lifecycle, "db", SimpleNamespace(session=SimpleNamespace(info={}))
    )
    mocker.patch.object(lifecycle, "get_user", side_effect=RuntimeError("no user"))

    lifecycle._announce_approval(_request(), "fine")
