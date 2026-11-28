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
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from pytest_mock import MockerFixture

from superset.commands.canvas.exceptions import (
    CanvasForbiddenError,
    CanvasInvalidError,
    CanvasNotFoundError,
)
from superset.exceptions import SupersetSecurityException
from superset.utils import json
from tests.unit_tests.canvas.fixtures import canvas, FakeResolver, inline, node


@pytest.fixture
def create_deps(mocker: MockerFixture, widget_types: FakeResolver) -> None:
    mocker.patch("superset.commands.canvas.create.populate_subjects")


def create_command(data: dict[str, Any]) -> Any:
    from superset.commands.canvas.create import CreateCanvasCommand

    return CreateCanvasCommand(data)


def test_create_defaults_to_an_empty_definition(create_deps: None) -> None:
    command = create_command({"title": "Exec overview"})

    command.validate()

    stored = json.loads(command._properties["definition"])
    assert stored["nodes"] == {}
    assert command._properties["definition_version"] == 1
    assert command._properties["revision"] == 1


def test_create_normalizes_a_given_definition(create_deps: None) -> None:
    command = create_command({"title": "x", "definition": canvas({"g": node("group")})})

    command.validate()

    assert json.loads(command._properties["definition"])["nodes"]["g"]["children"] == []


@pytest.mark.parametrize("widget", ["missing-1", "chart-secret"])
def test_create_rejects_widgets_the_author_cannot_place(
    create_deps: None, widget: str
) -> None:
    command = create_command({"title": "x", "definition": canvas({"a": node(widget)})})

    with pytest.raises(CanvasInvalidError) as excinfo:
        command.validate()

    assert excinfo.value.normalized_messages() == {
        "definition": {"/nodes/a/widgetId": ["unknown widget, or no access to it"]}
    }


@pytest.mark.parametrize("widget", ["missing-1", "chart-secret"])
def test_create_reveals_nothing_about_a_widget_placed_where_it_cannot_go(
    create_deps: None, widget: str
) -> None:
    """A widget the author can't read must not have its type named."""
    definition = canvas(
        {"bar": {**node("filterbar"), "children": ["a"]}, "a": node(widget)},
        children=["bar"],
    )
    command = create_command({"title": "x", "definition": definition})

    with pytest.raises(CanvasInvalidError) as excinfo:
        command.validate()

    assert excinfo.value.normalized_messages() == {
        "definition": {"/nodes/a/widgetId": ["unknown widget, or no access to it"]}
    }


def test_create_refuses_a_binding_to_a_dataset_the_author_cannot_read(
    create_deps: None, mocker: MockerFixture
) -> None:
    from superset.widgets.registry import registry as widget_registry
    from tests.unit_tests.canvas.ops_test import _bound_widget_types

    mocker.patch(
        "superset.canvas.definition.ops.unreadable_datasets",
        side_effect=lambda ids: set(ids),
    )
    definition = canvas({"n": inline("note", {"dataBinding": {"datasetId": 9}})})
    command = create_command({"title": "x", "definition": definition})

    # A context manager, so the swap is undone before the fixture's own one.
    with patch.dict(widget_registry, _bound_widget_types()):
        with pytest.raises(CanvasInvalidError) as excinfo:
            command.validate()

    assert excinfo.value.normalized_messages() == {
        "definition": {
            "/nodes/n/props/dataBinding/datasetId": [
                "unknown dataset 9, or no access to it"
            ]
        }
    }


@pytest.mark.parametrize("dataset_id", [17.0, "17", True])
def test_create_refuses_a_dataset_id_that_is_not_an_integer(
    create_deps: None, mocker: MockerFixture, dataset_id: Any
) -> None:
    from superset.widgets.registry import registry as widget_registry
    from tests.unit_tests.canvas.ops_test import _bound_widget_types

    mocker.patch(
        "superset.canvas.definition.ops.unreadable_datasets", return_value=set()
    )
    definition = canvas(
        {"n": inline("note", {"dataBinding": {"datasetId": dataset_id}})}
    )
    command = create_command({"title": "x", "definition": definition})

    with patch.dict(widget_registry, _bound_widget_types()):
        with pytest.raises(CanvasInvalidError) as excinfo:
            command.validate()

    assert list(excinfo.value.normalized_messages()["definition"]) == ["/nodes/n/props"]


def test_widget_uuids_are_kept_in_one_spelling() -> None:
    from superset.canvas.definition.schemas import AddOp, Node

    upper = "1B4E28BA-2FA1-11D2-883F-0016D3CCA427"

    assert Node.model_validate({"widgetId": upper}).widget_id == upper.lower()
    assert AddOp.model_validate({"op": "add", "widgetId": upper}).widget_id == (
        upper.lower()
    )


def test_create_reports_definition_issues(create_deps: None) -> None:
    command = create_command({"title": "x", "definition": {"version": 2}})

    with pytest.raises(CanvasInvalidError) as excinfo:
        command.validate()

    assert "/version" in excinfo.value.normalized_messages()["definition"]


def test_update_needs_editorship(mocker: MockerFixture) -> None:
    from superset.commands.canvas.update import UpdateCanvasCommand

    mocker.patch(
        "superset.commands.canvas.update.CanvasDAO.find_by_id",
        return_value=MagicMock(),
    )
    mocker.patch(
        "superset.commands.canvas.update.security_manager.raise_for_editorship",
        side_effect=SupersetSecurityException(MagicMock()),
    )

    with pytest.raises(CanvasForbiddenError):
        UpdateCanvasCommand(1, {"title": "x"}).validate()


def test_update_hidden_canvas_is_not_found(mocker: MockerFixture) -> None:
    from superset.commands.canvas.update import UpdateCanvasCommand

    mocker.patch(
        "superset.commands.canvas.update.CanvasDAO.find_by_id", return_value=None
    )

    with pytest.raises(CanvasNotFoundError):
        UpdateCanvasCommand(1, {"title": "x"}).validate()


def test_delete_needs_every_canvas(mocker: MockerFixture) -> None:
    from superset.commands.canvas.delete import DeleteCanvasCommand

    mocker.patch(
        "superset.commands.canvas.delete.CanvasDAO.find_by_ids",
        return_value=[MagicMock()],
    )

    with pytest.raises(CanvasNotFoundError):
        DeleteCanvasCommand([1, 2]).validate()
