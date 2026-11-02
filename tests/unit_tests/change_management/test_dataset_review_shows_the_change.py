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
"""A dataset review that shows the whole proposal (R4-05).

Two halves of one complaint. A column's label lives in ``verbose_name``,
which was not among the compared fields, so a proposal that relabelled a
column reported "Columns 0" and the reviewer approved a renaming they were
never shown. And an added metric carried only its name, so the expression --
the single thing worth deciding about -- was the one thing missing.
"""

from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import api
from pytest_mock import MockerFixture


def _column(name: str, **fields: Any) -> SimpleNamespace:
    base = {
        "column_name": name,
        "verbose_name": None,
        "type": "VARCHAR",
        "expression": None,
        "description": None,
        "is_dttm": False,
        "filterable": True,
        "groupby": True,
    }
    base.update(fields)
    return SimpleNamespace(**base)


def _metric(name: str, **fields: Any) -> SimpleNamespace:
    base = {
        "metric_name": name,
        "verbose_name": None,
        "expression": "COUNT(*)",
        "metric_type": None,
        "description": None,
        "d3format": None,
    }
    base.update(fields)
    return SimpleNamespace(**base)


@pytest.fixture
def dataset_request(mocker: MockerFixture) -> Any:
    """A dataset update, with the impact query stubbed out."""
    mocker.patch.object(api, "dataset_impact", return_value={"charts": 0, "dashboards": 0})
    return lambda body: SimpleNamespace(
        id=1, asset_type="dataset", operation="update", payload_dict=body
    )


def test_a_relabelled_column_is_reported(dataset_request: Any) -> None:
    live = SimpleNamespace(columns=[_column("name")], metrics=[], sql=None)
    body = {"columns": [{"column_name": "name", "verbose_name": "Customer name"}]}

    detail = api.dataset_detail(dataset_request(body), live)

    changed = detail["columns"]["changed"]
    assert [entry["name"] for entry in changed] == ["name"]
    assert changed[0]["fields"] == [
        {"field": "verbose_name", "before": None, "after": "Customer name"}
    ]


def test_an_added_metric_carries_its_expression(dataset_request: Any) -> None:
    live = SimpleNamespace(columns=[], metrics=[], sql=None)
    body = {
        "metrics": [
            {
                "metric_name": "r4_j3_metric",
                "expression": "SUM(amount)",
                "verbose_name": "Revenue",
            }
        ]
    }

    detail = api.dataset_detail(dataset_request(body), live)

    added = detail["metrics"]["added"]
    assert [entry["name"] for entry in added] == ["r4_j3_metric"]
    assert added[0]["fields"] == [
        {"field": "verbose_name", "before": None, "after": "Revenue"},
        {"field": "expression", "before": None, "after": "SUM(amount)"},
    ]


def test_a_removed_column_says_what_it_was(dataset_request: Any) -> None:
    live = SimpleNamespace(
        columns=[_column("legacy", verbose_name="Legacy")], metrics=[], sql=None
    )
    body = {"columns": []}

    detail = api.dataset_detail(dataset_request(body), live)

    removed = detail["columns"]["removed"]
    assert [entry["name"] for entry in removed] == ["legacy"]
    assert {"field": "verbose_name", "before": "Legacy", "after": None} in removed[
        0
    ]["fields"]


def test_fields_a_new_entry_does_not_set_are_left_out(dataset_request: Any) -> None:
    """A wall of "—" would bury the one or two values that were set."""
    live = SimpleNamespace(columns=[], metrics=[], sql=None)
    body = {"metrics": [{"metric_name": "bare", "expression": "COUNT(*)"}]}

    detail = api.dataset_detail(dataset_request(body), live)

    stated = {entry["field"] for entry in detail["metrics"]["added"][0]["fields"]}
    assert stated == {"expression"}


def test_an_untouched_dataset_still_reports_nothing(dataset_request: Any) -> None:
    live = SimpleNamespace(
        columns=[_column("name", verbose_name="Name")], metrics=[_metric("count")], sql=None
    )
    body = {
        "columns": [{"column_name": "name", "verbose_name": "Name"}],
        "metrics": [{"metric_name": "count", "expression": "COUNT(*)"}],
    }

    detail = api.dataset_detail(dataset_request(body), live)

    for part in ("columns", "metrics"):
        assert detail[part] == {"added": [], "changed": [], "removed": []}
