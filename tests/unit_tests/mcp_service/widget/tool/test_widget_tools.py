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
"""Tests for the saved widget MCP tools, using real database rows."""

from pathlib import Path

import pytest
from fastmcp import Client
from flask_appbuilder.security.sqla.models import User
from pytest_mock import MockerFixture
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm.session import Session

from superset.mcp_service.app import mcp
from superset.utils import json
from tests.unit_tests.widgets.fixtures import Login, MakeUser, MakeWidget


@pytest.fixture
def session_engine(tmp_path: Path) -> Engine:
    """
    Back this module's ``session`` with a file database: MCP tools run on another
    thread, and each thread would otherwise get its own empty in-memory database.
    """
    return create_engine(
        f"sqlite:///{tmp_path / 'widgets.db'}",
        connect_args={"check_same_thread": False},
    )


@pytest.fixture
def act_as(mocker: MockerFixture) -> Login:
    """Authenticate subsequent MCP tool calls as the given user."""

    def _act_as(user: User) -> None:
        mocker.patch(
            "superset.mcp_service.auth.get_user_from_request", return_value=user
        )

    return _act_as


@pytest.mark.asyncio
async def test_get_widget_info_returns_description_and_props(
    tables: Session,
    make_user: MakeUser,
    make_widget: MakeWidget,
    act_as: Login,
) -> None:
    alice_user, alice = make_user("alice", "Gamma")
    widget = make_widget(
        "Revenue notes",
        editors=[alice],
        description="Explains the revenue dip in March.",
        props={"content": "Revenue dipped in March because of a holiday."},
    )
    tables.commit()
    act_as(alice_user)

    async with Client(mcp) as client:
        result = await client.call_tool(
            "get_widget_info", {"request": {"identifier": str(widget.uuid)}}
        )
    data = json.loads(result.content[0].text)

    assert data["widget_type"] == "markdown"
    assert data["description"] == "Explains the revenue dip in March."
    assert data["props"] == {"content": "Revenue dipped in March because of a holiday."}
    assert data["revision"] == 1


@pytest.mark.asyncio
async def test_get_widget_info_hides_unreadable_widgets(
    tables: Session,
    make_user: MakeUser,
    make_widget: MakeWidget,
    act_as: Login,
) -> None:
    _, alice = make_user("alice", "Gamma")
    carol_user, _ = make_user("carol", "Gamma")
    widget = make_widget("Private notes", editors=[alice])
    tables.commit()
    act_as(carol_user)

    async with Client(mcp) as client:
        result = await client.call_tool(
            "get_widget_info", {"request": {"identifier": str(widget.uuid)}}
        )
    data = json.loads(result.content[0].text)

    assert data["error_type"] == "not_found"


@pytest.mark.asyncio
async def test_list_widgets_returns_only_readable_widgets(
    tables: Session,
    make_user: MakeUser,
    make_widget: MakeWidget,
    act_as: Login,
) -> None:
    _, alice = make_user("alice", "Gamma")
    bob_user, bob = make_user("bob", "Gamma")
    make_widget("Shared with bob", editors=[alice], viewers=[bob])
    make_widget("Private to alice", editors=[alice])
    tables.commit()
    act_as(bob_user)

    async with Client(mcp) as client:
        result = await client.call_tool("list_widgets", {"request": {}})
    data = json.loads(result.content[0].text)

    assert [widget["name"] for widget in data["widgets"]] == ["Shared with bob"]
