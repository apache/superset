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
"""A held write whose body is empty still shows what approving does.

``UpdateDatasetCommand(id, {}, delete_metric_ids=[...])`` has nothing in its
body to differ from the live dataset. Once the gate captured every keyword
the write was *held* (a keyword is no longer "empty"), and nothing rendered
the keyword: the reviewer opened it, saw no changed field at all and had
Approve enabled. Approving then deleted metrics. Holding it correctly made
that strictly worse than the defect it fixed, because it is now a request a
person is asked to read and cannot.

These go through ``describe_changes`` and ``serialize`` -- what every read
path returns -- with a body that contributes nothing, so the only thing that
can make the answer non-empty is the keyword.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import api
from asset_approval.gate import KWARGS_KEY
from pytest_mock import MockerFixture


def _dataset() -> Any:
    return SimpleNamespace(
        id=42,
        table_name="sales",
        metrics=[
            SimpleNamespace(id=9, metric_name="total_revenue"),
            SimpleNamespace(id=10, metric_name="order_count"),
        ],
        columns=[],
    )


def _request(body: dict[str, Any], **keywords: Any) -> Any:
    return SimpleNamespace(
        id=4,
        asset_type="dataset",
        asset_id=42,
        author=SimpleNamespace(id=7, username="alex", first_name="A", last_name="D"),
        author_fk=7,
        requested_approver=None,
        reviewer=None,
        status="pending",
        is_open=True,
        note=None,
        review_note=None,
        created_on=None,
        changed_on=None,
        submitted_at=None,
        decided_at=None,
        operation="update",
        payload_dict=body,
        base_dict={},
        command_args={KWARGS_KEY: keywords} if keywords else {},
    )


@pytest.fixture(autouse=True)
def quiet_neighbours(mocker: MockerFixture) -> None:
    mocker.patch.object(api, "find_open_request", return_value=None)
    mocker.patch.object(api, "load_asset", return_value=_dataset())
    mocker.patch.object(
        api, "dataset_impact", return_value={"charts": 0, "dashboards": 0}
    )
    mocker.patch.object(api, "_names_of", return_value={})


def test_an_empty_body_with_a_metric_delete_is_not_an_empty_review() -> None:
    """The defect: this list was ``[]`` and Approve was enabled over it."""
    entries = api.describe_changes(
        _request({}, delete_metric_ids=[9]), _dataset()
    )

    assert entries, "a held write rendered as nothing"
    assert "total_revenue" in entries[0]["summary"]


def test_the_payload_a_reviewer_is_sent_carries_the_keyword() -> None:
    """Through ``serialize``, which is what the panel reads."""
    payload = api.serialize(_request({}, delete_metric_ids=[9]), _dataset())

    assert [entry["field"] for entry in payload["changes"]] == ["delete_metric_ids"]
    assert payload["review_blocked"] is None


def test_the_body_and_the_keyword_are_both_listed() -> None:
    asset = SimpleNamespace(cache_timeout=None, metrics=[], columns=[])

    entries = api.describe_changes(
        _request({"cache_timeout": 5}, preserve_existing_metrics=True), asset
    )

    assert {entry["field"] for entry in entries} == {
        "preserve_existing_metrics",
        "cache_timeout",
    }


def test_a_keyword_comes_before_the_fields() -> None:
    """The part of a write most easily missed is the first thing read."""
    asset = SimpleNamespace(cache_timeout=None, metrics=[], columns=[])

    entries = api.describe_changes(
        _request({"cache_timeout": 5}, override_columns=True), asset
    )

    assert [entry["field"] for entry in entries] == [
        "override_columns",
        "cache_timeout",
    ]


def test_a_write_with_no_keyword_lists_only_its_fields() -> None:
    asset = SimpleNamespace(cache_timeout=None, metrics=[], columns=[])

    entries = api.describe_changes(_request({"cache_timeout": 5}), asset)

    assert [entry["field"] for entry in entries] == ["cache_timeout"]
    assert not any(entry.get("keyword") for entry in entries)


def test_a_delete_with_a_keyword_still_lists_it() -> None:
    """A delete has no fields; whatever it was called with is still shown."""
    request = _request({}, brand_new_flag=True)
    request.operation = "delete"

    [entry] = api.describe_changes(request, _dataset())

    assert entry["field"] == "brand_new_flag"
