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
"""A saved widget's data, queried on its own: the command and its route."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock
from uuid import UUID

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset.canvas.data import PlacementData, RuntimeFilter
from superset.commands.widget.data import GetWidgetDataCommand
from superset.commands.widget.exceptions import WidgetNotFoundError, WidgetUnboundError
from superset.exceptions import SupersetSecurityException
from superset.utils import json
from superset.utils.core import override_user
from tests.unit_tests.widgets.fixtures import MakeUser, MakeWidget

BINDING = {"datasetId": 13, "metrics": ["count"], "dimensions": ["country"]}
NAMED = {"datasetId": 14, "metrics": ["sum__revenue"], "dimensions": ["region"]}
DATA = PlacementData([{"country": "FR", "count": 3}], "SELECT country ...", "sql")


@pytest.fixture
def run_binding(mocker: MockerFixture) -> MagicMock:
    return mocker.patch("superset.commands.widget.data.run_binding", return_value=DATA)


def test_a_reader_runs_the_widgets_own_binding(
    tables: Session,
    make_user: MakeUser,
    make_widget: MakeWidget,
    run_binding: MagicMock,
) -> None:
    alice_user, alice = make_user("alice", "Gamma")
    widget = make_widget("Sales", viewers=[alice], props={"dataBinding": BINDING})
    filters = [RuntimeFilter(datasetId=13, column="country", values=["FR"])]

    with override_user(alice_user):
        data = GetWidgetDataCommand(widget.uuid, filters).run()

    assert data == DATA
    run_binding.assert_called_once_with(BINDING, filters)


def test_a_widget_the_caller_cant_read_looks_missing(
    tables: Session,
    make_user: MakeUser,
    make_widget: MakeWidget,
    run_binding: MagicMock,
) -> None:
    alice_user, _ = make_user("alice", "Gamma")
    _, bob = make_user("bob", "Gamma")
    widget = make_widget("Sales", editors=[bob], props={"dataBinding": BINDING})

    with override_user(alice_user), pytest.raises(WidgetNotFoundError):
        GetWidgetDataCommand(widget.uuid, []).run()
    with override_user(alice_user), pytest.raises(WidgetNotFoundError):
        GetWidgetDataCommand(UUID(int=7), []).run()
    run_binding.assert_not_called()


def test_a_named_binding_comes_from_the_widget_types_resolver(
    tables: Session,
    make_user: MakeUser,
    make_widget: MakeWidget,
    run_binding: MagicMock,
    mocker: MockerFixture,
) -> None:
    """The same resolver as a placement's, told there is no canvas."""
    from superset_core.widgets import BindingRequest

    from superset.widgets.registry import registry

    asked: list[BindingRequest] = []

    def resolve(request: BindingRequest) -> dict[str, Any] | None:
        asked.append(request)
        return NAMED if request.name == "by_region" else None

    mocker.patch.object(registry["markdown"], "binding_resolver", resolve)
    alice_user, alice = make_user("alice", "Gamma")
    widget = make_widget("Notes", editors=[alice], props={"content": "x"})

    with override_user(alice_user):
        GetWidgetDataCommand(widget.uuid, [], "by_region").run()
        with pytest.raises(WidgetUnboundError):
            GetWidgetDataCommand(widget.uuid, [], "unknown").run()

    assert run_binding.call_args.args[0] == NAMED
    assert asked[0] == BindingRequest(
        canvas_id=None,
        placement_id=None,
        props={"content": "x"},
        name="by_region",
        widget_id=str(widget.uuid),
    )


def test_a_widget_without_its_binding_is_unbound(
    tables: Session,
    make_user: MakeUser,
    make_widget: MakeWidget,
    run_binding: MagicMock,
) -> None:
    alice_user, alice = make_user("alice", "Gamma")
    widget = make_widget("Notes", editors=[alice])

    with override_user(alice_user):
        with pytest.raises(WidgetUnboundError):
            GetWidgetDataCommand(widget.uuid, []).run()
        with pytest.raises(WidgetUnboundError):
            GetWidgetDataCommand(widget.uuid, [], "missing").run()
    run_binding.assert_not_called()


URL = "/api/v1/widget/{}/data"
WIDGET = "00000000-0000-4000-8000-000000000001"

# The widget API is registered with the canvas, behind its feature flag.
api_flags = pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"CANVAS": True}}], indirect=True
)


@api_flags
def test_the_route_answers_the_datasets_envelope(
    client: Any, full_api_access: None, mocker: MockerFixture
) -> None:
    command = mocker.patch("superset.widgets.api.GetWidgetDataCommand")
    command.return_value.run.return_value = DATA
    mocker.patch("superset.widgets.api.security_manager.can_access", return_value=False)

    response = client.post(
        URL.format(WIDGET),
        data=json.dumps(
            {
                "binding": "by_region",
                "runtime_filters": [
                    {"datasetId": 13, "column": "country", "values": ["FR"]}
                ],
            }
        ),
        content_type="application/json",
    )

    assert response.status_code == 200
    assert response.json == {
        "result": {
            "datasets": [
                {
                    "name": "by_region",
                    "row_count": 1,
                    "inline_data": [{"country": "FR", "count": 3}],
                }
            ]
        }
    }
    widget_uuid, filters, binding = command.call_args.args
    assert widget_uuid == UUID(WIDGET)
    assert filters == [RuntimeFilter(datasetId=13, column="country", values=["FR"])]
    assert binding == "by_region"


@api_flags
@pytest.mark.parametrize(
    ("error", "status"),
    [
        (WidgetNotFoundError(WIDGET), 404),
        (WidgetUnboundError(), 422),
        (SupersetSecurityException(MagicMock()), 403),
    ],
)
def test_the_route_answers_each_failure(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
    error: Exception,
    status: int,
) -> None:
    command = mocker.patch("superset.widgets.api.GetWidgetDataCommand")
    command.return_value.run.side_effect = error

    response = client.post(URL.format(WIDGET), json={})

    assert response.status_code == status


@api_flags
def test_the_route_refuses_a_malformed_request(
    client: Any, full_api_access: None, mocker: MockerFixture
) -> None:
    command = mocker.patch("superset.widgets.api.GetWidgetDataCommand")

    assert client.post(URL.format(WIDGET), json={"extra": 1}).status_code == 400
    assert client.post(URL.format("not-a-uuid"), json={}).status_code == 404
    command.assert_not_called()
