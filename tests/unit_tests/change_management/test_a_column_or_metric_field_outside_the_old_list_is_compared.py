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
"""A dataset column or metric is compared on every field the proposal carries.

``COLUMN_FIELDS`` (seven names) and ``METRIC_FIELDS`` (five) were the whole of
what the dialog compared. A proposal that moved a column's
``warning_markdown`` -- a banner bound for every viewer of the dataset -- or
any of the other nine column fields, or six metric fields, produced no
difference at all, and the dialog opened on "No column changed." beside an
enabled Approve. It was seen on screen approving a "DO NOT USE" banner.

The lists are now only the order fields are listed in. Which fields are
*compared* is the proposal's: every key it carries, judged by the gate's own
test for whether two values are the same.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import api
from pytest_mock import MockerFixture


@pytest.fixture
def dataset_request(mocker: MockerFixture) -> Any:
    mocker.patch.object(
        api, "dataset_impact", return_value={"charts": 0, "dashboards": 0}
    )
    return lambda body: SimpleNamespace(
        id=1, asset_type="dataset", operation="update", payload_dict=body
    )


def _live(**over: Any) -> SimpleNamespace:
    base: dict[str, Any] = {"columns": [], "metrics": [], "sql": None}
    base.update(over)
    return SimpleNamespace(**base)


def _column(name: str, **fields: Any) -> SimpleNamespace:
    return SimpleNamespace(column_name=name, verbose_name=None, **fields)


def _metric(name: str, **fields: Any) -> SimpleNamespace:
    return SimpleNamespace(metric_name=name, verbose_name=None, **fields)


@pytest.mark.parametrize(
    "field",
    [
        "warning_markdown",
        "python_date_format",
        "advanced_data_type",
        "is_active",
        "type_generic",
        # Not a column field anywhere in Superset: the point is that no name
        # has to be known.
        "a_flag_added_next_year",
    ],
)
def test_a_column_field_outside_the_old_list_is_reported(
    dataset_request: Any, field: str
) -> None:
    live = _live(columns=[_column("revenue", **{field: None})])
    body = {"columns": [{"column_name": "revenue", field: "DO NOT USE"}]}

    detail = api.dataset_detail(dataset_request(body), live)

    [changed] = detail["columns"]["changed"]
    assert changed["name"] == "revenue"
    assert changed["fields"] == [{"field": field, "before": None, "after": "DO NOT USE"}]


@pytest.mark.parametrize(
    "field",
    ["warning_text", "extra", "currency", "certified_by", "a_flag_added_next_year"],
)
def test_a_metric_field_outside_the_old_list_is_reported(
    dataset_request: Any, field: str
) -> None:
    live = _live(metrics=[_metric("count", **{field: "old"})])
    body = {"metrics": [{"metric_name": "count", field: "new"}]}

    detail = api.dataset_detail(dataset_request(body), live)

    [changed] = detail["metrics"]["changed"]
    assert changed["fields"] == [{"field": field, "before": "old", "after": "new"}]


def test_the_listed_fields_still_come_first(dataset_request: Any) -> None:
    """The lists are an order now, not a filter: what a reviewer reads first
    still leads."""
    live = _live(columns=[_column("revenue", description="a", zzz_flag="a")])
    body = {
        "columns": [
            {"column_name": "revenue", "zzz_flag": "b", "description": "b"}
        ]
    }

    detail = api.dataset_detail(dataset_request(body), live)

    [changed] = detail["columns"]["changed"]
    assert [f["field"] for f in changed["fields"]] == ["description", "zzz_flag"]


def test_two_spellings_of_nothing_are_still_not_an_edit(
    dataset_request: Any,
) -> None:
    """Comparing every field must not bring back the noise R4-06 removed: the
    editor posts ``extra`` as "{}" for a column that holds NULL."""
    live = _live(columns=[_column("revenue", extra=None, uuid="abc", id=3)])
    body = {
        "columns": [
            {"column_name": "revenue", "extra": "{}", "uuid": "abc", "id": 3}
        ]
    }

    detail = api.dataset_detail(dataset_request(body), live)

    assert detail["columns"]["changed"] == []


def test_an_added_column_states_every_field_it_sets(dataset_request: Any) -> None:
    body = {
        "columns": [
            {
                "column_name": "banner",
                "expression": "1",
                "warning_markdown": "DO NOT USE",
                "extra": "{}",
            }
        ]
    }

    detail = api.dataset_detail(dataset_request(body), _live())

    [added] = detail["columns"]["added"]
    assert [f["field"] for f in added["fields"]] == ["expression", "warning_markdown"]


def test_a_nested_value_in_a_column_is_shown_as_text(dataset_request: Any) -> None:
    """Not ``[object Object]``: the dialog stringifies what it is given."""
    live = _live(columns=[_column("revenue", extra=None)])
    body = {
        "columns": [{"column_name": "revenue", "extra": {"warning": "DO NOT USE"}}]
    }

    detail = api.dataset_detail(dataset_request(body), live)

    [changed] = detail["columns"]["changed"]
    assert changed["fields"][0]["after"] == '{"warning": "DO NOT USE"}'
