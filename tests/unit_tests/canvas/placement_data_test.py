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
from __future__ import annotations

from collections.abc import Iterator
from typing import Any
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset.canvas.data import PlacementData, query_context_payload, RuntimeFilter
from superset.exceptions import SupersetSecurityException
from superset.utils import json
from tests.unit_tests.canvas.fixtures import FakeResolver

pytestmark = pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"CANVAS": True}}], indirect=True
)

URL = "/api/v1/canvas/100/placement/{}/data"
BINDING = {"datasetId": 13, "metrics": ["count"], "dimensions": ["country"]}
DATA = PlacementData([{"country": "FR", "count": 3}], "SELECT country ...", "sql")


@pytest.fixture
def canvas(
    session: Session, mocker: MockerFixture, widget_types: FakeResolver
) -> Iterator[Any]:
    from superset.canvas.definition.schemas import empty_definition
    from superset.models.canvas import Canvas

    definition = empty_definition()
    definition["root"]["children"] = ["chart", "text"]
    definition["nodes"] = {
        "chart": {"widgetType": "chart", "props": {"dataBinding": BINDING}},
        "text": {"widgetType": "chart", "props": {}},
    }
    Canvas.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    canvas = Canvas(
        id=100,
        title="Exec overview",
        definition=json.dumps(definition),
        definition_version=1,
        revision=1,
    )
    session.add(canvas)
    session.commit()
    mocker.patch("superset.canvas.filters.security_manager.is_admin", return_value=True)
    yield canvas
    session.rollback()


@pytest.fixture
def run_binding(mocker: MockerFixture) -> MagicMock:
    return mocker.patch(
        "superset.commands.canvas.placement_data.run_binding", return_value=DATA
    )


@pytest.fixture
def can_view_query(mocker: MockerFixture) -> MagicMock:
    return mocker.patch(
        "superset.canvas.api.security_manager.can_access", return_value=True
    )


def test_returns_rows_and_the_query_that_ran(
    client: Any,
    full_api_access: None,
    canvas: Any,
    run_binding: MagicMock,
    can_view_query: MagicMock,
) -> None:
    response = client.post(
        URL.format("chart"),
        json={
            "runtime_filters": [
                {"datasetId": 13, "column": "country", "values": ["FR"]}
            ]
        },
    )

    assert response.status_code == 200
    assert response.json["result"]["datasets"] == [
        {
            "name": "main",
            "row_count": 1,
            "inline_data": [{"country": "FR", "count": 3}],
            "query": "SELECT country ...",
            "language": "sql",
        }
    ]
    binding, filters = run_binding.call_args.args
    assert binding == BINDING
    assert filters == [RuntimeFilter(datasetId=13, column="country", values=["FR"])]
    can_view_query.assert_any_call("can_view_query", "Dashboard")


def test_the_query_needs_view_query(
    client: Any,
    full_api_access: None,
    canvas: Any,
    run_binding: MagicMock,
    can_view_query: MagicMock,
) -> None:
    can_view_query.return_value = False

    response = client.post(URL.format("chart"), json={})

    dataset = response.json["result"]["datasets"][0]
    assert dataset["inline_data"] == [{"country": "FR", "count": 3}]
    assert "query" not in dataset


def test_unknown_and_unbound_placements(
    client: Any, full_api_access: None, canvas: Any, run_binding: MagicMock
) -> None:
    assert client.post(URL.format("missing"), json={}).status_code == 404
    assert client.post(URL.format("text"), json={}).status_code == 422
    run_binding.assert_not_called()


def test_without_dataset_access(
    client: Any, full_api_access: None, canvas: Any, run_binding: MagicMock
) -> None:
    run_binding.side_effect = SupersetSecurityException(MagicMock())

    assert client.post(URL.format("chart"), json={}).status_code == 403


def test_rejects_malformed_filters(
    client: Any, full_api_access: None, canvas: Any, run_binding: MagicMock
) -> None:
    response = client.post(
        URL.format("chart"),
        json={"runtime_filters": [{"datasetId": 13, "column": "", "values": "FR"}]},
    )

    assert response.status_code == 400
    run_binding.assert_not_called()


def test_a_draft_of_another_canvas_is_not_found(
    client: Any,
    full_api_access: None,
    canvas: Any,
    run_binding: MagicMock,
    mocker: MockerFixture,
) -> None:
    mocker.patch(
        "superset.commands.canvas.placement_data.load_draft",
        return_value=MagicMock(canvas_id=101),
    )

    response = client.post(
        URL.format("chart"), json={}, headers={"X-Canvas-Draft": "token"}
    )

    assert response.status_code == 404
    run_binding.assert_not_called()


def test_runtime_filters_narrow_only_the_bindings_dataset() -> None:
    payload = query_context_payload(
        BINDING,
        [
            RuntimeFilter(datasetId=13, column="country", values=["FR"]),
            RuntimeFilter(datasetId=14, column="country", values=["DE"]),
            RuntimeFilter(datasetId=13, column="deal_size", values=[]),
        ],
    )

    assert payload["queries"][0]["filters"] == [
        {"col": "country", "op": "IN", "val": ["FR"]}
    ]
