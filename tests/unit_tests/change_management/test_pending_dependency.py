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
"""Telling the approver the chart's dataset has a change waiting (QA-09).

Approving replays the author's body over whatever is live. A chart change
written against a dataset change that has not been approved yet therefore
publishes a chart referencing columns or metrics that do not exist, and
viewers see it break. Nothing said so.

A warning, not a refusal: two editors can hold the chart and the dataset
separately under the one-open-change-per-asset rule, so enforcing an order
would deadlock them.
"""

from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import api
from pytest_mock import MockerFixture


def _chart_request() -> SimpleNamespace:
    return SimpleNamespace(id=1, asset_type="chart", asset_id=42)


def _chart(datasource_id: int | None = 5, datasource_type: str = "table") -> Any:
    return SimpleNamespace(
        id=42,
        datasource_id=datasource_id,
        datasource_type=datasource_type,
        datasource=SimpleNamespace(id=5),
    )


@pytest.fixture
def open_dataset_change(mocker: MockerFixture) -> Any:
    found = SimpleNamespace(
        id=99,
        status="pending",
        author=SimpleNamespace(
            id=7, username="alex", first_name="Alex", last_name="Diaz"
        ),
    )
    return mocker.patch.object(api, "find_open_request", return_value=found)


def test_a_chart_whose_dataset_has_a_change_waiting_is_flagged(
    open_dataset_change: Any,
) -> None:
    found = api.pending_dependency(_chart_request(), _chart())

    assert found is not None
    assert found["asset_type"] == "dataset"
    assert found["asset_id"] == 5
    assert found["change_request_id"] == 99


def test_the_warning_names_who_is_holding_the_dataset(
    open_dataset_change: Any,
) -> None:
    # The approver's next move is to go and talk to them, so the name is
    # the useful part.
    found = api.pending_dependency(_chart_request(), _chart())

    assert found["author"] is not None


def test_a_chart_whose_dataset_is_clear_says_nothing(mocker: MockerFixture) -> None:
    mocker.patch.object(api, "find_open_request", return_value=None)

    assert api.pending_dependency(_chart_request(), _chart()) is None


def test_the_lookup_is_for_the_dataset_not_the_chart(
    open_dataset_change: Any,
) -> None:
    api.pending_dependency(_chart_request(), _chart())

    asset_type, asset_id = open_dataset_change.call_args.args
    assert asset_type.value == "dataset"
    assert asset_id == 5


def test_a_dataset_change_is_not_asked_about_itself(
    open_dataset_change: Any,
) -> None:
    request = SimpleNamespace(id=1, asset_type="dataset", asset_id=5)

    assert api.pending_dependency(request, _chart()) is None
    open_dataset_change.assert_not_called()


def test_a_dashboard_change_is_not_asked_about_a_dataset(
    open_dataset_change: Any,
) -> None:
    request = SimpleNamespace(id=1, asset_type="dashboard", asset_id=3)

    assert api.pending_dependency(request, _chart()) is None
    open_dataset_change.assert_not_called()


def test_a_chart_on_a_semantic_view_is_skipped(open_dataset_change: Any) -> None:
    # Only a physical dataset has change requests of its own; asking about
    # a semantic view would match a dataset id that is not its dataset.
    chart = _chart(datasource_type="semantic_view")

    assert api.pending_dependency(_chart_request(), chart) is None
    open_dataset_change.assert_not_called()


def test_a_chart_with_no_datasource_is_skipped(open_dataset_change: Any) -> None:
    assert api.pending_dependency(_chart_request(), _chart(datasource_id=None)) is None
    open_dataset_change.assert_not_called()


def test_no_asset_means_no_answer(open_dataset_change: Any) -> None:
    # ``serialize`` passes the asset only where it has one.
    assert api.pending_dependency(_chart_request(), None) is None
    open_dataset_change.assert_not_called()


def test_one_lookup_at_most(open_dataset_change: Any) -> None:
    # This runs per change request in the Approvals list, so it must stay
    # at one indexed read and not grow into a walk of the chart's dashboards.
    api.pending_dependency(_chart_request(), _chart())

    assert open_dataset_change.call_count == 1
