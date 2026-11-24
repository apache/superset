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
from superset.canvas.query_errors import canvas_query_error, CanvasQueryFailedError
from superset.commands.canvas.exceptions import WidgetTypeUnavailableError
from superset.commands.widget.data import GetWidgetDataCommand
from superset.commands.widget.exceptions import WidgetNotFoundError, WidgetUnboundError
from superset.daos.exceptions import DatasourceNotFound
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.utils import json
from superset.utils.core import override_user
from superset.utils.log import collect_request_payload
from tests.unit_tests.widgets.fixtures import MakeUser, MakeWidget

BINDING = {"datasetId": 13, "metrics": ["count"], "dimensions": ["country"]}
NAMED = {"datasetId": 14, "metrics": ["sum__revenue"], "dimensions": ["region"]}
DATA = PlacementData([{"country": "FR", "count": 3}], "SELECT country ...", "sql")
BY_REGION = PlacementData([{"region": "EMEA", "sum__revenue": 12}], None, None)
NO_ACCESS = SupersetSecurityException(
    SupersetError(
        message="no access to the dataset",
        error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
        level=ErrorLevel.ERROR,
    )
)


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

    assert data == {"main": DATA}
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


def test_a_widget_types_bindings_come_from_its_builder(
    tables: Session,
    make_user: MakeUser,
    make_widget: MakeWidget,
    run_binding: MagicMock,
    mocker: MockerFixture,
) -> None:
    """The same builder as a placement's, told there is no canvas."""
    from superset_core.widgets import BindingRequest, WidgetBinding

    from superset.widgets.registry import registry

    build = MagicMock(
        return_value=[WidgetBinding("by_region", NAMED), WidgetBinding("all", BINDING)]
    )
    mocker.patch.object(registry["markdown"], "build_bindings", build)
    mocker.patch(
        "superset.commands.canvas.placement_data.unreadable_datasets",
        return_value=set(),
    )
    run_binding.side_effect = [BY_REGION, DATA]
    alice_user, alice = make_user("alice", "Gamma")
    widget = make_widget("Notes", editors=[alice], props={"content": "x"})

    with override_user(alice_user):
        data = GetWidgetDataCommand(widget.uuid, []).run()

    assert data == {"by_region": BY_REGION, "all": DATA}
    assert [call.args[0] for call in run_binding.call_args_list] == [NAMED, BINDING]
    build.assert_called_once_with(
        BindingRequest(
            canvas_id=None,
            placement_id=None,
            props={"content": "x"},
            widget_id=str(widget.uuid),
        )
    )


def test_a_failing_query_fails_classified_as_a_placements_does(
    tables: Session,
    make_user: MakeUser,
    make_widget: MakeWidget,
    run_binding: MagicMock,
) -> None:
    alice_user, alice = make_user("alice", "Gamma")
    widget = make_widget("Sales", viewers=[alice], props={"dataBinding": BINDING})
    run_binding.side_effect = NO_ACCESS

    with override_user(alice_user), pytest.raises(CanvasQueryFailedError) as caught:
        GetWidgetDataCommand(widget.uuid, []).run()

    assert caught.value.__cause__ is NO_ACCESS
    assert caught.value.error == canvas_query_error(NO_ACCESS)


@pytest.mark.parametrize(
    "props",
    [
        {},
        {"dataBinding": None},
        {"dataBinding": {"metrics": ["count"]}},
        {"dataBinding": {"datasetId": "13", "metrics": ["count"]}},
    ],
    ids=["no binding", "null", "no dataset", "dataset id as text"],
)
def test_a_widget_without_a_bound_dataset_is_unbound(
    tables: Session,
    make_user: MakeUser,
    make_widget: MakeWidget,
    run_binding: MagicMock,
    props: dict[str, Any],
) -> None:
    alice_user, alice = make_user("alice", "Gamma")
    widget = make_widget("Notes", editors=[alice], props=props)

    with override_user(alice_user), pytest.raises(WidgetUnboundError):
        GetWidgetDataCommand(widget.uuid, []).run()
    run_binding.assert_not_called()


@pytest.mark.parametrize(
    ("widget_type", "turned_off"),
    [
        ("extensions.acme.kpis.board", frozenset()),
        ("markdown", frozenset({"markdown"})),
    ],
)
def test_a_widget_of_a_type_unavailable_here_has_no_data(
    tables: Session,
    make_user: MakeUser,
    make_widget: MakeWidget,
    run_binding: MagicMock,
    mocker: MockerFixture,
    widget_type: str,
    turned_off: frozenset[str],
) -> None:
    alice_user, alice = make_user("alice", "Gamma")
    widget = make_widget(
        "Sales",
        viewers=[alice],
        widget_type=widget_type,
        props={"dataBinding": BINDING},
    )
    mocker.patch.dict(
        "superset.canvas.definition.registry.current_app.config",
        {"CANVAS_DISABLED_WIDGET_TYPES": turned_off},
    )

    with override_user(alice_user), pytest.raises(WidgetTypeUnavailableError):
        GetWidgetDataCommand(widget.uuid, []).run()
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
    command.return_value.run.return_value = {"main": DATA}
    mocker.patch("superset.extensions.security_manager.can_access", return_value=True)

    response = client.post(
        URL.format(WIDGET),
        data=json.dumps(
            {
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
                    "name": "main",
                    "row_count": 1,
                    "inline_data": [{"country": "FR", "count": 3}],
                    "coltypes": {},
                    "query": "SELECT country ...",
                    "language": "sql",
                },
            ]
        }
    }
    assert command.call_args.args == (
        UUID(WIDGET),
        [RuntimeFilter(datasetId=13, column="country", values=["FR"])],
    )


@api_flags
def test_the_route_shows_the_query_only_to_who_may_view_queries(
    client: Any, full_api_access: None, mocker: MockerFixture
) -> None:
    command = mocker.patch("superset.widgets.api.GetWidgetDataCommand")
    command.return_value.run.return_value = {"main": DATA}
    mocker.patch("superset.extensions.security_manager.can_access", return_value=False)

    response = client.post(URL.format(WIDGET), json={})

    assert response.status_code == 200
    (dataset,) = response.json["result"]["datasets"]
    assert "query" not in dataset
    assert "language" not in dataset


@api_flags
@pytest.mark.parametrize(
    ("error", "status"),
    [
        (WidgetNotFoundError(WIDGET), 404),
        (WidgetTypeUnavailableError(), 404),
        (WidgetUnboundError(), 422),
        (CanvasQueryFailedError(canvas_query_error(NO_ACCESS)), 403),
        (CanvasQueryFailedError(canvas_query_error(DatasourceNotFound())), 404),
        (CanvasQueryFailedError(canvas_query_error(RuntimeError("boom"))), 500),
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
    assert "boom" not in response.get_data(as_text=True)


@api_flags
def test_the_route_refuses_a_malformed_request(
    client: Any, full_api_access: None, mocker: MockerFixture
) -> None:
    command = mocker.patch("superset.widgets.api.GetWidgetDataCommand")

    malformed = client.post(URL.format(WIDGET), json={"extra": 1})
    assert malformed.status_code == 400
    # As the placement endpoint answers it: where in the body, and why.
    assert malformed.json == {
        "message": [{"path": "/extra", "message": "Extra inputs are not permitted"}]
    }
    # The widget's query is its own: a caller can't name another.
    picked = client.post(URL.format(WIDGET), json={"binding": {"datasetId": 2}})
    assert picked.status_code == 400
    assert client.post(URL.format("not-a-uuid"), json={}).status_code == 404
    command.assert_not_called()


@api_flags
def test_the_route_keeps_the_filter_values_out_of_the_logs(
    client: Any, full_api_access: None, mocker: MockerFixture
) -> None:
    command = mocker.patch("superset.widgets.api.GetWidgetDataCommand")
    command.return_value.run.return_value = {"main": DATA}
    collect = mocker.patch(
        "superset.utils.log.collect_request_payload", wraps=collect_request_payload
    )

    response = client.post(
        URL.format(WIDGET),
        json={"runtime_filters": [{"datasetId": 13, "column": "ssn", "values": ["1"]}]},
    )

    assert response.status_code == 200
    collect.assert_called_once_with(False)
