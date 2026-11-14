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
"""can_access remembers its answers within a dashboard load, per user."""

from typing import Any, Callable
from unittest.mock import MagicMock, patch

from flask import Flask, request
from flask_login import current_user, login_user
from pytest_mock import MockerFixture

from superset.security.manager import remember_view_access, SupersetSecurityManager

MANAGER = "superset.security.manager"


def _user() -> MagicMock:
    user = MagicMock()
    user.is_anonymous = False
    return user


def _manager() -> SupersetSecurityManager:
    return SupersetSecurityManager.__new__(SupersetSecurityManager)


def _dashboard_load(app: Flask, body: Callable[[], object]) -> None:
    with app.test_request_context():
        remember_view_access(body)()


def test_a_repeated_question_is_asked_once_per_dashboard_load(app: Flask) -> None:
    sm = _manager()

    def body() -> None:
        for _ in range(3):
            assert sm.can_access("all_datasource_access", "all_datasource_access")
        assert sm.can_access("schema_access", "[db].[mart]")

    with (
        patch(f"{MANAGER}.g") as g_mock,
        patch.object(
            SupersetSecurityManager, "_has_view_access", return_value=True
        ) as has_view_access,
    ):
        g_mock.user = _user()
        _dashboard_load(app, body)

    assert has_view_access.call_count == 2


def test_other_requests_ask_every_time(app: Flask) -> None:
    sm = _manager()
    with (
        app.test_request_context(),
        patch(f"{MANAGER}.g") as g_mock,
        patch.object(
            SupersetSecurityManager, "_has_view_access", return_value=True
        ) as has_view_access,
    ):
        g_mock.user = _user()
        for _ in range(3):
            sm.can_access("all_datasource_access", "all_datasource_access")

    assert has_view_access.call_count == 3


def test_an_answer_never_reaches_another_user(app: Flask) -> None:
    """
    Under session auth ``g.user`` is flask-login's ``current_user``, a single
    proxy shared by every user, so the memo has to key on the user behind it.
    """
    sm = _manager()
    admin, gamma = _user(), _user()

    def body() -> None:
        g_mock.user = current_user
        login_user(admin)
        assert sm.can_access("all_datasource_access", "all_datasource_access")
        login_user(gamma)
        assert not sm.can_access("all_datasource_access", "all_datasource_access")

    with (
        patch(f"{MANAGER}.g") as g_mock,
        patch.object(
            SupersetSecurityManager,
            "_has_view_access",
            side_effect=lambda user, *_: user == admin,
        ),
    ):
        _dashboard_load(app, body)


def test_each_dashboard_load_asks_again(app: Flask) -> None:
    sm = _manager()
    with (
        patch(f"{MANAGER}.g") as g_mock,
        patch.object(
            SupersetSecurityManager, "_has_view_access", return_value=False
        ) as has_view_access,
    ):
        g_mock.user = _user()
        for _ in range(2):
            _dashboard_load(
                app,
                lambda: sm.can_access("all_datasource_access", "all_datasource_access"),
            )

    assert has_view_access.call_count == 2


def test_outside_a_request_nothing_is_remembered(app_context: None) -> None:
    sm = _manager()
    with (
        # A request context another test left pushed would otherwise make
        # this run inside one.
        patch(f"{MANAGER}.has_request_context", return_value=False),
        patch(f"{MANAGER}.g") as g_mock,
        patch.object(
            SupersetSecurityManager, "_has_view_access", return_value=True
        ) as has_view_access,
    ):
        g_mock.user = _user()
        for _ in range(2):
            sm.can_access("all_datasource_access", "all_datasource_access")

    assert has_view_access.call_count == 2


def test_only_the_marked_dashboard_requests_remember(
    client: Any, full_api_access: None, mocker: MockerFixture
) -> None:
    """
    The dashboard's own access check runs inside the lookup, so the memo has
    to be on before the lookup runs, not only in the handler body.
    """
    from superset.commands.dashboard.exceptions import DashboardNotFoundError
    from superset.daos.dashboard import DashboardDAO

    remembering: dict[str, bool] = {}

    def lookup(*_: Any, **__: Any) -> None:
        remembering[request.path] = "_view_access_answers" in request.__dict__
        raise DashboardNotFoundError()

    for name in (
        "get_by_id_or_slug",
        "get_charts_for_dashboard",
        "get_datasets_for_dashboard",
    ):
        mocker.patch.object(DashboardDAO, name, side_effect=lookup)

    for path in ("", "/charts", "/datasets", "/tabs", "/embedded"):
        assert client.get(f"/api/v1/dashboard/999{path}").status_code == 404

    assert remembering == {
        "/api/v1/dashboard/999": True,
        "/api/v1/dashboard/999/charts": True,
        "/api/v1/dashboard/999/datasets": True,
        "/api/v1/dashboard/999/tabs": True,
        "/api/v1/dashboard/999/embedded": False,
    }
