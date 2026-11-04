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
"""The dataset keywords say what they do to the dataset, in its own words.

``delete_metric_ids=[9, 10]`` is the mechanism; a reviewer deciding whether
to let it through needs to know that ``total_revenue`` and ``order_count``
are about to be deleted, not that two integers were passed. The names are read
off the dataset's own metrics -- the DAO deletes only a metric that is on the
dataset -- and an id that is not one of them is said to delete nothing rather
than named as if it would go.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import api
from asset_approval.gate import KWARGS_KEY
from pytest_mock import MockerFixture


def _dataset(*metrics: tuple[int, str]) -> Any:
    return SimpleNamespace(
        metrics=[SimpleNamespace(id=i, metric_name=name) for i, name in metrics],
        columns=[],
    )


def _request(**keywords: Any) -> Any:
    return SimpleNamespace(
        operation="update", command_args={KWARGS_KEY: keywords}, payload_dict={}
    )


@pytest.fixture(autouse=True)
def no_database(mocker: MockerFixture) -> None:
    mocker.patch.object(api, "_names_of", return_value={})


def test_the_metrics_to_delete_are_named_and_not_numbered() -> None:
    dataset = _dataset((9, "total_revenue"), (10, "order_count"), (11, "margin"))

    [entry] = api.describe_changes(_request(delete_metric_ids=[9, 10]), dataset)

    assert "total_revenue" in entry["summary"]
    assert "order_count" in entry["summary"]
    assert "margin" not in entry["summary"]  # not on the list, so not named
    assert "9" not in entry["summary"] and "10" not in entry["summary"]
    assert entry["after"] == "total_revenue, order_count"


def test_each_metric_is_listed_as_removed() -> None:
    dataset = _dataset((9, "total_revenue"), (10, "order_count"))

    [entry] = api.describe_changes(_request(delete_metric_ids=[9, 10]), dataset)

    assert [(e["kind"], e["key"]) for e in entry["entries"]] == [
        ("removed", "total_revenue"),
        ("removed", "order_count"),
    ]


def test_it_says_how_many() -> None:
    dataset = _dataset((9, "total_revenue"))

    [entry] = api.describe_changes(_request(delete_metric_ids=[9]), dataset)

    assert entry["summary"].startswith("Deletes 1 metric from this dataset")


def test_an_id_that_is_not_on_the_dataset_is_not_said_to_be_deleted() -> None:
    dataset = _dataset((9, "total_revenue"))

    [entry] = api.describe_changes(_request(delete_metric_ids=[9, 77]), dataset)

    assert "total_revenue" in entry["summary"]
    assert "metric 77 is not on this dataset" in entry["summary"]
    assert [e["key"] for e in entry["entries"]] == ["total_revenue"]


def test_without_the_dataset_the_ids_are_looked_up(mocker: MockerFixture) -> None:
    lookup = mocker.patch.object(
        api, "_names_of", return_value={9: "total_revenue"}
    )

    [entry] = api.describe_changes(_request(delete_metric_ids=[9]), None)

    lookup.assert_called_once_with("delete_metric_ids", [9])
    assert "total_revenue" in entry["summary"]


def test_a_lookup_that_fails_falls_back_to_the_id() -> None:
    """A name is a courtesy: no name costs the name, never the row."""
    [entry] = api.describe_changes(_request(delete_metric_ids=[9, 4]), None)

    assert "metric 4" in entry["summary"] and "metric 9" in entry["summary"]
    assert entry["entries"]


def test_keeping_the_other_metrics_says_the_list_is_additive() -> None:
    [entry] = api.describe_changes(
        _request(preserve_existing_metrics=True), _dataset()
    )

    assert "other metrics are kept" in entry["summary"]
    assert "not taken as the full list" in entry["summary"]


def test_replacing_columns_says_they_are_refreshed_from_the_source() -> None:
    [entry] = api.describe_changes(_request(override_columns=True), _dataset())

    assert "replaced" in entry["summary"]
    assert "refreshed from the source" in entry["summary"]


def test_an_override_recorded_the_old_way_is_still_shown() -> None:
    """A request captured before keywords were kept as a set carries it under
    a key of its own, and replay still honours it, so it must still be shown."""
    request = SimpleNamespace(
        operation="update", command_args={"override_columns": True}, payload_dict={}
    )

    [entry] = api.describe_changes(request, _dataset())

    assert entry["field"] == "override_columns"
