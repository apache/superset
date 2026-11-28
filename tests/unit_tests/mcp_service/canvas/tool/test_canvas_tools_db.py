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
"""The canvas MCP tools against real canvas rows and the real access filter."""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset.app import SupersetApp
from superset.utils import json

BASE_URL = "https://workspace.example/prefix"


@pytest.fixture(autouse=True)
def workspace_url(app: SupersetApp) -> None:
    app.config["WEBDRIVER_BASEURL_USER_FRIENDLY"] = f"{BASE_URL}/"


@pytest.fixture
def canvases(session: Session) -> Iterator[dict[str, Any]]:
    """Sales the caller views, Payroll they cannot see."""
    from superset.canvas.definition.schemas import empty_definition
    from superset.models.canvas import Canvas
    from superset.subjects.models import Subject

    Canvas.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    me = Subject(id=1, label="me", type=1)
    other = Subject(id=2, label="other", type=1)
    definition = empty_definition()
    definition["root"]["children"] = ["notes"]
    definition["nodes"] = {
        "notes": {
            "widgetType": "markdown",
            "schemaVersion": 1,
            "props": {"content": "Hi"},
            "layout": {},
        }
    }

    def new(title: str, slug: str, viewers: list[Any]) -> Any:
        return Canvas(
            title=title,
            slug=slug,
            definition=json.dumps(definition),
            definition_version=1,
            revision=1,
            editors=[other],
            viewers=viewers,
        )

    rows = {"sales": new("Sales", "sales", [me]), "payroll": new("Payroll", "pay", [])}
    session.add_all([me, other, *rows.values()])
    session.commit()
    yield rows
    session.rollback()


def as_user(mocker: MockerFixture, admin: bool = False, guest: bool = False) -> None:
    """A caller whose only subject is ``me``."""
    mocker.patch(
        "superset.canvas.filters.security_manager.is_admin", return_value=admin
    )
    mocker.patch(
        "superset.canvas.filters.security_manager.is_guest_user", return_value=guest
    )
    mocker.patch("superset.subjects.filters.get_user_id", return_value=7)
    mocker.patch(
        "superset.subjects.utils.get_user_subject_ids_subquery", return_value=[1]
    )


def test_list_canvases_lists_only_what_the_caller_reads(
    canvases: dict[str, Any], mocker: MockerFixture
) -> None:
    from superset.mcp_service.canvas.tool.list_canvases import _list_canvases_impl

    as_user(mocker)
    # Both titles contain an "a"; search must not reach past the access filter.
    result = _list_canvases_impl("a", page=1, page_size=10)

    assert result["count"] == 1
    assert [row["title"] for row in result["canvases"]] == ["Sales"]
    assert result["canvases"][0]["url"] == f"{BASE_URL}/canvas/sales/"


def test_list_canvases_shows_a_guest_nothing(
    canvases: dict[str, Any], mocker: MockerFixture
) -> None:
    from superset.mcp_service.canvas.tool.list_canvases import _list_canvases_impl

    as_user(mocker, guest=True)

    assert _list_canvases_impl(None, page=1, page_size=10)["count"] == 0


def test_get_canvas_reads_a_viewed_canvas_and_hides_the_rest(
    canvases: dict[str, Any], mocker: MockerFixture
) -> None:
    from superset.mcp_service.canvas.tool.get_canvas import _get_canvas_impl

    as_user(mocker)
    sales, payroll = canvases["sales"], canvases["payroll"]

    result = _get_canvas_impl(sales.id, include_resolved=False)
    assert (result["title"], result["revision"]) == ("Sales", 1)
    assert list(result["definition"]["nodes"]) == ["notes"]
    # By id or by UUID, a canvas the caller can't see reads as missing.
    for ref in (payroll.id, str(payroll.uuid)):
        assert _get_canvas_impl(ref, include_resolved=False) == {
            "error": f"Canvas {ref} not found, or no access to it",
            "error_type": "CanvasNotFoundError",
        }


def test_admins_get_every_canvas(
    canvases: dict[str, Any], mocker: MockerFixture
) -> None:
    from superset.mcp_service.canvas.tool.get_canvas import _get_canvas_impl
    from superset.mcp_service.canvas.tool.list_canvases import _list_canvases_impl

    as_user(mocker, admin=True)

    assert _list_canvases_impl(None, page=1, page_size=10)["count"] == 2
    assert _get_canvas_impl(canvases["payroll"].id, False)["title"] == "Payroll"


def test_get_canvas_data_hides_a_canvas_the_caller_cannot_see(
    canvases: dict[str, Any], mocker: MockerFixture
) -> None:
    from superset.mcp_service.canvas.tool.get_canvas_data import (
        _get_canvas_data_impl,
    )

    as_user(mocker)
    run = mocker.patch(
        "superset.mcp_service.canvas.tool.get_canvas_data.run_binding",
        return_value=MagicMock(rows=[]),
    )
    payroll = canvases["payroll"]

    result = _get_canvas_data_impl(payroll.id, None, None, 10, 10, None)

    assert result == {"error": f"Canvas {payroll.id} not found, or no access to it"}
    run.assert_not_called()
