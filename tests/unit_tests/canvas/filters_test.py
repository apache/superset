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
from collections.abc import Iterator
from typing import Any
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset.utils import json


@pytest.fixture
def shared(session: Session) -> Iterator[dict[str, Any]]:
    """Three canvases: one the user edits, one they view, one they can't see."""
    from superset.canvas.definition.schemas import empty_definition
    from superset.models.canvas import Canvas
    from superset.subjects.models import Subject

    Canvas.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    me = Subject(id=1, label="me", type=1)
    other = Subject(id=2, label="other", type=1)

    def new(title: str, editors: list[Any], viewers: list[Any]) -> Any:
        return Canvas(
            title=title,
            definition=json.dumps(empty_definition()),
            definition_version=1,
            editors=editors,
            viewers=viewers,
        )

    canvases = {
        "edited": new("edited", [me], []),
        "viewed": new("viewed", [other], [me]),
        "hidden": new("hidden", [other], []),
    }
    session.add_all([me, other, *canvases.values()])
    session.flush()
    yield canvases
    session.rollback()


def visible(session: Session) -> list[str]:
    from superset.canvas.filters import CanvasAccessFilter
    from superset.models.canvas import Canvas

    query = CanvasAccessFilter("id", MagicMock()).apply(session.query(Canvas), None)
    return sorted(canvas.title for canvas in query)


def as_user(mocker: MockerFixture, admin: bool = False, guest: bool = False) -> None:
    mocker.patch(
        "superset.canvas.filters.security_manager.is_admin", return_value=admin
    )
    mocker.patch(
        "superset.canvas.filters.security_manager.is_guest_user", return_value=guest
    )
    mocker.patch("superset.subjects.filters.get_user_id", return_value=7)
    mocker.patch(
        "superset.subjects.utils.get_user_subject_ids_subquery",
        return_value=[1],
    )


def test_users_see_canvases_they_edit_or_view(
    session: Session, shared: dict[str, Any], mocker: MockerFixture
) -> None:
    as_user(mocker)

    assert visible(session) == ["edited", "viewed"]


def test_admins_see_every_canvas(
    session: Session, shared: dict[str, Any], mocker: MockerFixture
) -> None:
    as_user(mocker, admin=True)

    assert visible(session) == ["edited", "hidden", "viewed"]


def test_embedded_guests_see_none(
    session: Session, shared: dict[str, Any], mocker: MockerFixture
) -> None:
    as_user(mocker, guest=True)

    assert visible(session) == []


def test_extra_access_query_filter_can_grant_a_canvas(
    session: Session, shared: dict[str, Any], mocker: MockerFixture
) -> None:
    """
    ``EXTRA_ACCESS_QUERY_FILTERS["canvases"]`` grants visibility the editor and
    viewer lists don't, the way it already does for charts and dashboards.
    """
    as_user(mocker)
    mocker.patch("superset.canvas.filters.get_user_id", return_value=7)
    granted = mocker.MagicMock(return_value=[shared["hidden"].id])
    mocker.patch.dict(
        "superset.canvas.filters.current_app.config",
        {"EXTRA_ACCESS_QUERY_FILTERS": {"canvases": granted}},
    )

    assert visible(session) == ["edited", "hidden", "viewed"]
    granted.assert_called_once_with(7)


def test_extra_access_query_filter_is_skipped_without_a_user(
    session: Session, shared: dict[str, Any], mocker: MockerFixture
) -> None:
    as_user(mocker)
    mocker.patch("superset.canvas.filters.get_user_id", return_value=None)
    granted = mocker.MagicMock(return_value=[shared["hidden"].id])
    mocker.patch.dict(
        "superset.canvas.filters.current_app.config",
        {"EXTRA_ACCESS_QUERY_FILTERS": {"canvases": granted}},
    )

    assert visible(session) == ["edited", "viewed"]
    granted.assert_not_called()


CANVAS_ENABLED = pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"CANVAS": True}}], indirect=True
)


@pytest.fixture
def api_session(mocker: MockerFixture, session: Session) -> None:
    """FAB's list endpoint queries through the data model's own session."""
    from superset.canvas.api import CanvasRestApi

    mocker.patch.object(CanvasRestApi.datamodel, "_session", session)


@CANVAS_ENABLED
@pytest.mark.parametrize(
    "guest, expected",
    [(False, ["edited", "viewed"]), (True, [])],
    ids=["restricted-user", "embedded-guest"],
)
def test_list_and_get_show_only_the_canvases_the_caller_reads(
    client: Any,
    full_api_access: None,
    api_session: None,
    session: Session,
    shared: dict[str, Any],
    mocker: MockerFixture,
    guest: bool,
    expected: list[str],
) -> None:
    session.commit()
    as_user(mocker, guest=guest)

    listed = client.get("/api/v1/canvas/").json
    assert sorted(row["title"] for row in listed["result"]) == expected
    assert listed["count"] == len(expected)
    for title, canvas in shared.items():
        status = client.get(f"/api/v1/canvas/{canvas.id}").status_code
        assert status == (200 if title in expected else 404)


@CANVAS_ENABLED
def test_text_search_does_not_widen_what_a_restricted_user_sees(
    client: Any,
    full_api_access: None,
    api_session: None,
    session: Session,
    shared: dict[str, Any],
    mocker: MockerFixture,
) -> None:
    import prison

    session.commit()
    as_user(mocker)
    # Every title matches, including the one the user cannot see.
    query = prison.dumps(
        {"filters": [{"col": "title", "opr": "canvas_all_text", "value": "e"}]}
    )

    listed = client.get(f"/api/v1/canvas/?q={query}").json

    assert sorted(row["title"] for row in listed["result"]) == ["edited", "viewed"]
    assert listed["count"] == 2


@pytest.mark.parametrize(
    "app",
    [{"FEATURE_FLAGS": {"CANVAS": True}, "EXCLUDE_USERS_FROM_LISTS": ["robot"]}],
    indirect=True,
)
@pytest.mark.parametrize("field", ["created_by", "changed_by"])
def test_related_users_leave_out_excluded_users(
    app: Any,
    client: Any,
    full_api_access: None,
    session: Session,
    mocker: MockerFixture,
    field: str,
) -> None:
    from flask_appbuilder.security.sqla.models import User

    from superset.models.canvas import Canvas

    # Related models are queried through the app builder's session.
    mocker.patch.object(app.appbuilder, "_session", session)

    Canvas.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    session.add_all(
        User(
            username=username,
            first_name=username,
            last_name="User",
            email=f"{username}@example.com",
            active=True,
        )
        for username in ("alice", "robot")
    )
    session.commit()

    response = client.get(f"/api/v1/canvas/related/{field}")

    assert response.status_code == 200
    assert [row["text"] for row in response.json["result"]] == ["alice User"]


def test_extra_access_query_exclusion_withholds_a_canvas_from_admins_too(
    session: Session, shared: dict[str, Any], mocker: MockerFixture
) -> None:
    from sqlalchemy import select

    from superset.models.canvas import Canvas

    as_user(mocker, admin=True)
    edited = shared["edited"].id
    mocker.patch.dict(
        "superset.canvas.filters.current_app.config",
        {
            "EXTRA_ACCESS_QUERY_EXCLUSIONS": {
                "canvases": lambda _user_id: select(Canvas.id).where(
                    Canvas.id == edited
                )
            }
        },
    )

    assert visible(session) == ["hidden", "viewed"]
