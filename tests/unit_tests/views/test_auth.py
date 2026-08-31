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

from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse

import pytest
from flask import Flask, g, make_response

from superset.views.auth import (
    LOGIN_REDIRECT_MARKER_PARAM,
    LOGIN_REDIRECT_MARKER_VALUE,
    SupersetAuthView,
)
from superset.views.base import BaseSupersetView


@pytest.fixture
def app(monkeypatch: pytest.MonkeyPatch) -> Flask:
    app = Flask(__name__)
    appbuilder = SimpleNamespace(get_url_for_index="/")
    app.appbuilder = appbuilder

    auth_view = SupersetAuthView()
    auth_view.appbuilder = appbuilder
    app.extensions["test_auth_view"] = auth_view
    app.add_url_rule(
        "/login/",
        endpoint="SupersetAuthView.login",
        view_func=lambda: "",
    )
    monkeypatch.setattr(
        BaseSupersetView,
        "render_app_template",
        lambda *args, **kwargs: make_response("", 200),
    )
    return app


def _set_user(authenticated: bool) -> None:
    g.user = SimpleNamespace(is_authenticated=authenticated)


def _auth_view(app: Flask) -> SupersetAuthView:
    return app.extensions["test_auth_view"]


def _marked_login_location(app: Flask, next_url: str) -> str:
    with app.test_request_context("/login/", query_string={"next": next_url}):
        _set_user(False)
        response = _auth_view(app).login()
    assert response.status_code == 302
    return response.location


def test_anonymous_login_marks_next_url(app: Flask) -> None:
    location = _marked_login_location(app, "/superset/dashboard/1/")

    query = parse_qs(urlparse(location).query)
    assert query["next"] == ["/superset/dashboard/1/"]
    assert query[LOGIN_REDIRECT_MARKER_PARAM] == [LOGIN_REDIRECT_MARKER_VALUE]


def test_authenticated_marked_login_preserves_next_url(app: Flask) -> None:
    location = _marked_login_location(app, "/superset/dashboard/1/")
    with app.test_request_context(location):
        _set_user(True)
        response = _auth_view(app).login()

    assert response.status_code == 302
    assert response.location == "/superset/dashboard/1/"


def test_authenticated_unmarked_login_ignores_next_url(app: Flask) -> None:
    with app.test_request_context(
        "/login/",
        query_string={"next": "/superset/dashboard/1/"},
    ):
        _set_user(True)
        response = _auth_view(app).login()

    assert response.status_code == 302
    assert response.location == app.appbuilder.get_url_for_index


@pytest.mark.parametrize(
    "next_url",
    [
        "https://example.com/dashboard/1/",
        "//example.com/dashboard/1/",
        "javascript:alert(1)",
        "///example.com/dashboard/1/",
        r"\\example.com\dashboard\1",
        r"https://example.com\.localhost/dashboard/1/",
        "\x00/dashboard/1/",
    ],
)
def test_anonymous_login_does_not_mark_unsafe_next_url(
    app: Flask,
    next_url: str,
) -> None:
    with app.test_request_context("/login/", query_string={"next": next_url}):
        _set_user(False)
        response = _auth_view(app).login()

    assert response.status_code == 200


def test_authenticated_login_ignores_invalid_marker(app: Flask) -> None:
    with app.test_request_context(
        "/login/",
        query_string={
            "next": "/superset/dashboard/1/",
            LOGIN_REDIRECT_MARKER_PARAM: "invalid",
        },
    ):
        _set_user(True)
        response = _auth_view(app).login()

    assert response.location == app.appbuilder.get_url_for_index


def test_marked_login_url_preserves_repeated_query_parameters(app: Flask) -> None:
    with app.test_request_context(
        "/login/?next=/superset/dashboard/1/&prompt=one&prompt=two"
    ):
        _set_user(False)
        response = _auth_view(app).login()

    query = parse_qs(urlparse(response.location).query)
    assert query["prompt"] == ["one", "two"]


def test_marked_login_url_preserves_application_root(app: Flask) -> None:
    with app.test_request_context(
        "/login/",
        query_string={"next": "/superset/dashboard/1/"},
        environ_overrides={"SCRIPT_NAME": "/superset"},
    ):
        _set_user(False)
        response = _auth_view(app).login()

    assert urlparse(response.location).path == "/superset/login/"
