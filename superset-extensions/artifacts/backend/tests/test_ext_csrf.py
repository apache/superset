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
"""
The extension's REST APIs and CSRF checks, registered as Flask-AppBuilder
registers an API: the ones a browser session reaches need the token, and the
one a link authenticates doesn't.
"""

from __future__ import annotations

import importlib
import sys
from types import SimpleNamespace
from typing import Any

import flask
import pytest
from flask_wtf.csrf import CSRFProtect, generate_csrf

ARTIFACT_ID = "00000000-0000-4000-8000-000000000004"
SIGNING_KEY = "a secret key"
SESSION_APIS = [
    ("superset_oss.artifacts.frames.api", "ArtifactFramesRestApi", "/"),
    (
        "superset_oss.artifacts.authoring.confirm_api",
        "ArtifactPublishRestApi",
        f"/{ARTIFACT_ID}/confirm",
    ),
]


@pytest.fixture(autouse=True)
def api_decorator(monkeypatch: pytest.MonkeyPatch) -> None:
    """The API decorator the host puts in place, which registers nothing here."""
    from superset_core.rest_api import decorators

    monkeypatch.setattr(decorators, "api", lambda **_: lambda cls: cls)


def api_of(monkeypatch: pytest.MonkeyPatch, module: str, name: str) -> Any:
    monkeypatch.delitem(sys.modules, module, raising=False)
    return getattr(importlib.import_module(module), name)()


def serving(api: Any) -> flask.Flask:
    """
    An app with CSRF checks on, as Superset's has, serving ``api`` under
    ``/api``. Its permission check lets every request through, so that a
    request the CSRF check lets in reaches the route.
    """
    app = flask.Flask(__name__)
    app.config.update(SECRET_KEY=SIGNING_KEY, WTF_CSRF_ENABLED=True)
    CSRFProtect(app)
    app.appbuilder = SimpleNamespace(sm=SimpleNamespace(is_item_public=lambda *_: True))
    app.add_url_rule("/token", "token", generate_csrf)
    api.route_base = "/api"
    with app.app_context():
        app.register_blueprint(api.create_blueprint(SimpleNamespace()))
    return app


@pytest.mark.parametrize(("module", "name", "path"), SESSION_APIS)
def test_a_session_api_refuses_a_write_without_the_csrf_token(
    monkeypatch: pytest.MonkeyPatch, module: str, name: str, path: str
) -> None:
    client = serving(api_of(monkeypatch, module, name)).test_client()

    refused = client.post(f"/api{path}", json={"request_id": "r1"})
    token = client.get("/token").get_data(as_text=True)
    let_in = client.post(
        f"/api{path}", json={"request_id": "r1"}, headers={"X-CSRFToken": token}
    )

    assert refused.status_code == 400
    assert "The CSRF token is missing." in refused.get_data(as_text=True)
    # With the token, the request gets past the check to the route itself.
    assert "CSRF" not in let_in.get_data(as_text=True)


def test_the_transfer_api_takes_requests_without_a_token(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    api = api_of(
        monkeypatch,
        "superset_oss.artifacts.authoring.transfer_api",
        "ArtifactTransferRestApi",
    )
    client = serving(api).test_client()

    response = client.put("/api/blobs/not-a-token", data=b"x")

    assert "CSRF" not in response.get_data(as_text=True)
