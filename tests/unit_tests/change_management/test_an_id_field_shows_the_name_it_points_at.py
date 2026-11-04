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
"""``theme_id`` and ``datasource_id`` show the theme and the dataset.

A theme change read ``1 → 2`` and a dataset swap two bare integers. What the
author changed is a named theme, or a named dataset, and the reviewer cannot
be expected to know what id 2 is. The name is an enrichment: where it cannot
be found the id is still shown.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

from asset_approval import api
from pytest_mock import MockerFixture


def _request(payload: dict[str, Any]) -> Any:
    return SimpleNamespace(operation="update", command_args={}, payload_dict=payload)


def test_a_theme_change_names_both_themes(mocker: MockerFixture) -> None:
    mocker.patch.object(api, "_names_of", return_value={1: "Default", 2: "High contrast"})
    asset = SimpleNamespace(theme_id=1)

    [entry] = api.describe_changes(_request({"theme_id": 2}), asset)

    assert entry == {
        "field": "theme_id",
        "before": "Default (1)",
        "after": "High contrast (2)",
    }


def test_a_theme_set_for_the_first_time_has_no_before(mocker: MockerFixture) -> None:
    mocker.patch.object(api, "_names_of", return_value={2: "High contrast"})
    asset = SimpleNamespace(theme_id=None)

    [entry] = api.describe_changes(_request({"theme_id": 2}), asset)

    assert entry["before"] is None
    assert entry["after"] == "High contrast (2)"


def test_a_dataset_swap_names_both_datasets(mocker: MockerFixture) -> None:
    mocker.patch.object(api, "_names_of", return_value={4: "sales", 9: "sales_v2"})
    asset = SimpleNamespace(datasource_id=4, datasource_type="table")

    [entry] = api.describe_changes(
        _request({"datasource_id": 9, "datasource_type": "table"}), asset
    )
    ids = [e for e in [entry] if e["field"] == "datasource_id"]

    assert ids[0]["before"] == "sales (4)"
    assert ids[0]["after"] == "sales_v2 (9)"


def test_a_name_that_cannot_be_found_leaves_the_id(mocker: MockerFixture) -> None:
    mocker.patch.object(api, "_names_of", return_value={})
    asset = SimpleNamespace(theme_id=1)

    [entry] = api.describe_changes(_request({"theme_id": 2}), asset)

    assert (entry["before"], entry["after"]) == (1, 2)


def test_a_failure_inside_the_enrichment_falls_back_to_the_default(
    mocker: MockerFixture,
) -> None:
    mocker.patch.object(api, "_names_of", side_effect=RuntimeError("boom"))
    asset = SimpleNamespace(theme_id=1)

    [entry] = api.describe_changes(_request({"theme_id": 2}), asset)

    assert (entry["before"], entry["after"]) == (1, 2)
