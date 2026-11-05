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
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from superset.commands.canvas.exceptions import (
    CanvasForbiddenError,
    CanvasInvalidError,
    CanvasNotFoundError,
)
from superset.exceptions import SupersetSecurityException
from superset.utils import json
from tests.unit_tests.canvas.fixtures import canvas, FakeResolver, node


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
