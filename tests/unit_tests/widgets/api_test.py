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
"""Tests for the saved widget REST API, using real database rows."""

from typing import Any

import pytest
from flask_appbuilder.security.sqla.models import User
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from tests.unit_tests.widgets.fixtures import Login, MakeUser, MakeWidget

CANVAS_ENABLED = pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"CANVAS": True}}], indirect=True
)
CANVAS_DISABLED = pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"CANVAS": False}}], indirect=True
)


@pytest.fixture(autouse=True)
def api_session(mocker: MockerFixture, session: Session) -> None:
    """
    Point the API's FAB data model at the test database. FAB's built-in list
    endpoint queries through ``appbuilder.session`` rather than ``db.session``.
    """
    from superset.widgets.api import WidgetRestApi

    mocker.patch.object(WidgetRestApi.datamodel, "_session", session)


@pytest.fixture
def login(mocker: MockerFixture) -> Login:
    """Authenticate subsequent client requests as the given user."""

    def _login(user: User) -> None:
        mocker.patch("flask_login.utils._get_user", return_value=user)

    return _login


@CANVAS_DISABLED
def test_api_is_hidden_when_canvas_is_off(client: Any, full_api_access: None) -> None:
    response = client.get("/api/v1/widget/")
    assert response.status_code == 404


@CANVAS_ENABLED
def test_create_read_update_delete(
    client: Any,
    full_api_access: None,
    tables: Session,
    make_user: MakeUser,
    login: Login,
) -> None:
    alice_user, alice = make_user("alice", "Gamma")
    tables.commit()
    login(alice_user)

    created = client.post(
        "/api/v1/widget/",
        json={"widget_type": "markdown", "name": "Notes", "props": {"content": "Hi"}},
    )
    assert created.status_code == 201
    assert created.headers["ETag"] == '"1"'
    result = created.json["result"]
    assert result["widget_type"] == "markdown"
    assert result["props"] == {"content": "Hi"}
    assert result["revision"] == 1
    assert [editor["id"] for editor in result["editors"]] == [alice.id]
    widget_uuid = result["uuid"]

    fetched = client.get(f"/api/v1/widget/{widget_uuid}")
    assert fetched.status_code == 200
    assert fetched.json["result"]["name"] == "Notes"
    assert fetched.headers["ETag"] == '"1"'

    updated = client.put(
        f"/api/v1/widget/{widget_uuid}",
        json={"name": "Renamed"},
        headers={"If-Match": '"1"'},
    )
    assert updated.status_code == 200
    assert updated.headers["ETag"] == '"2"'
    assert updated.json["result"]["name"] == "Renamed"

    deleted = client.delete(f"/api/v1/widget/{widget_uuid}")
    assert deleted.status_code == 200
    assert client.get(f"/api/v1/widget/{widget_uuid}").status_code == 404


@CANVAS_ENABLED
def test_stale_if_match_returns_the_current_revision(
    client: Any,
    full_api_access: None,
    tables: Session,
    make_user: MakeUser,
    make_widget: MakeWidget,
    login: Login,
) -> None:
    alice_user, alice = make_user("alice", "Gamma")
    widget = make_widget("Notes", editors=[alice], revision=3)
    tables.commit()
    login(alice_user)

    response = client.put(
        f"/api/v1/widget/{widget.uuid}",
        json={"name": "Renamed"},
        headers={"If-Match": '"2"'},
    )

    assert response.status_code == 409
    assert response.json["revision"] == 3


@CANVAS_ENABLED
def test_malformed_requests_are_rejected(
    client: Any,
    full_api_access: None,
    tables: Session,
    make_user: MakeUser,
    make_widget: MakeWidget,
    login: Login,
) -> None:
    alice_user, alice = make_user("alice", "Gamma")
    widget = make_widget("Notes", editors=[alice])
    tables.commit()
    login(alice_user)

    not_an_object = client.post(
        "/api/v1/widget/",
        json={"widget_type": "markdown", "name": "Notes", "props": ["a", "b"]},
    )
    assert not_an_object.status_code == 400
    assert "props" in not_an_object.json["message"]

    bad_revision = client.put(
        f"/api/v1/widget/{widget.uuid}",
        json={"name": "Renamed"},
        headers={"If-Match": "latest"},
    )
    assert bad_revision.status_code == 400


@CANVAS_ENABLED
def test_list_returns_only_readable_widgets(
    client: Any,
    full_api_access: None,
    tables: Session,
    make_user: MakeUser,
    make_widget: MakeWidget,
    login: Login,
) -> None:
    _, alice = make_user("alice", "Gamma")
    bob_user, bob = make_user("bob", "Gamma")
    make_widget("Shared with bob", editors=[alice], viewers=[bob])
    make_widget("Private to alice", editors=[alice])
    tables.commit()
    login(bob_user)

    response = client.get("/api/v1/widget/")

    assert response.status_code == 200
    assert [row["name"] for row in response.json["result"]] == ["Shared with bob"]
