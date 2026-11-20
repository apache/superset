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


import os
from typing import Any
from unittest.mock import MagicMock
from urllib.parse import parse_qs, urlsplit

import jinja2
import pytest
from flask.testing import FlaskClient
from flask_appbuilder.const import AUTH_OAUTH
from pytest_mock import MockerFixture

from superset.app import SupersetApp


@pytest.fixture(autouse=True)
def _register_real_templates(app) -> None:
    """Point the unit-test app at the real template directory.

    The unit-test ``app`` fixture builds ``SupersetApp(__name__)`` from the
    conftest module, so Flask resolves ``templates/`` relative to the tests
    directory instead of the installed ``superset`` package.
    """
    import superset

    templates = os.path.join(os.path.dirname(superset.__file__), "templates")
    app.jinja_loader = jinja2.ChoiceLoader(
        [app.jinja_loader, jinja2.FileSystemLoader(templates)]
    )


def test_login_page_drains_flash_messages(client) -> None:
    """Pending flash messages render on the login page and leave the session."""
    with client.session_transaction() as session:
        session["_flashes"] = [("warning", "Invalid login. Please try again.")]

    response = client.get("/login/")

    assert response.status_code == 200
    assert b"Invalid login. Please try again." in response.data
    with client.session_transaction() as session:
        assert "_flashes" not in session


def test_login_page_does_not_accumulate_flash_messages(client) -> None:
    """Messages from repeated failed logins are delivered once, not hoarded."""
    with client.session_transaction() as session:
        session["_flashes"] = [
            ("warning", "Invalid login. Please try again."),
            ("warning", "Invalid login. Please try again."),
        ]

    first = client.get("/login/")
    assert first.data.count(b"Invalid login. Please try again.") == 2

    second = client.get("/login/")
    assert b"Invalid login. Please try again." not in second.data


def test_login_page_without_flash_messages(client) -> None:
    """A clean session renders the login page with an empty message list."""
    from html import unescape

    response = client.get("/login/")

    assert response.status_code == 200
    data = unescape(response.data.decode())
    assert '"auth_messages":[]' in data.replace(" ", "")


def test_log_beacon_from_login_page_returns_401(client) -> None:
    """An anonymous ``/log/`` beacon gets a 401, not a redirect to ``/login/``."""
    assert client.get("/login/").status_code == 200

    response = client.post(
        "/log/?explode=events",
        data={"events": '[{"source": "spa", "path": "/login/"}]'},
    )

    assert response.status_code == 401
    assert "Location" not in response.headers


def test_log_beacon_from_login_page_does_not_flash(client) -> None:
    """An anonymous ``/log/`` beacon doesn't flash "access denied" into the session.

    The flash sent the beacon on to ``/login/``, whose response rewrote the
    session cookie and could drop the stored OAuth state.
    """
    assert client.get("/login/").status_code == 200

    response = client.post("/log/?explode=events", data={"events": "[]"})

    assert response.status_code == 401
    with client.session_transaction() as session:
        assert "_flashes" not in session


def test_log_beacon_without_permission_returns_403(client, mocker) -> None:
    """A logged-in user or guest without ``can_log`` gets a 403, not a 500."""
    mocker.patch(
        "flask_appbuilder.security.decorators.current_user",
        is_authenticated=True,
    )

    response = client.post("/log/?explode=events", data={"events": "[]"})

    assert response.status_code == 403
    assert "Location" not in response.headers


def _oauth_provider(name: str) -> dict[str, Any]:
    """Build a minimal ``OAUTH_PROVIDERS`` entry for an IdP that is never called."""
    return {
        "name": name,
        "icon": f"fa-{name}",
        "token_key": "access_token",
        "remote_app": {
            "client_id": "client-id",
            "client_secret": "client-secret",
            "api_base_url": f"https://{name}.example.com/",
            "access_token_url": f"https://{name}.example.com/token",
            "authorize_url": f"https://{name}.example.com/authorize",
        },
    }


SINGLE_OAUTH_PROVIDER = {
    "AUTH_TYPE": AUTH_OAUTH,
    "OAUTH_PROVIDERS": [_oauth_provider("google")],
}
MULTIPLE_OAUTH_PROVIDERS = {
    "AUTH_TYPE": AUTH_OAUTH,
    "OAUTH_PROVIDERS": [_oauth_provider("google"), _oauth_provider("github")],
}


@pytest.mark.parametrize("app", [SINGLE_OAUTH_PROVIDER], indirect=True)
def test_login_page_redirects_to_single_oauth_provider(client: FlaskClient) -> None:
    """With one OAuth provider there is nothing to pick: go straight to it."""
    response = client.get("/login/?next=/superset/welcome/")

    assert response.status_code == 302
    location = urlsplit(response.headers["Location"])
    assert location.path == "/login/google"
    assert parse_qs(location.query) == {"next": ["/superset/welcome/"]}


@pytest.mark.parametrize("app", [SINGLE_OAUTH_PROVIDER], indirect=True)
def test_login_page_redirect_forwards_only_next(client: FlaskClient) -> None:
    """Other query arguments are not forwarded to the provider login."""
    response = client.get("/login/?_scheme=https&provider=github")

    assert response.status_code == 302
    location = urlsplit(response.headers["Location"])
    assert location.path == "/login/google"
    assert location.query == ""


@pytest.mark.parametrize("app", [SINGLE_OAUTH_PROVIDER], indirect=True)
def test_login_page_redirect_honors_script_root(client: FlaskClient) -> None:
    """The provider login URL is built with ``url_for``, so it keeps the prefix."""
    response = client.get("/login/", base_url="http://example.com/superset")

    assert response.status_code == 302
    assert urlsplit(response.headers["Location"]).path == "/superset/login/google"


@pytest.mark.parametrize("app", [MULTIPLE_OAUTH_PROVIDERS], indirect=True)
def test_login_page_renders_for_multiple_oauth_providers(
    client: FlaskClient,
) -> None:
    """With several OAuth providers the login page lets the user choose."""
    response = client.get("/login/?next=/superset/welcome/")

    assert response.status_code == 200
    assert "Location" not in response.headers


@pytest.mark.parametrize("app", [SINGLE_OAUTH_PROVIDER], indirect=True)
def test_login_page_renders_pending_flash_for_single_oauth_provider(
    client: FlaskClient,
) -> None:
    """A failed OAuth sign-in returns to the login page instead of the IdP.

    Flask-AppBuilder's OAuth failure paths flash a message and redirect to
    ``/login/``; redirecting again would loop back to the provider and hide
    the message.
    """
    with client.session_transaction() as session:
        session["_flashes"] = [("error", "The request to sign in was denied.")]

    response = client.get("/login/")

    assert response.status_code == 200
    assert b"The request to sign in was denied." in response.data
    with client.session_transaction() as session:
        assert "_flashes" not in session


@pytest.mark.parametrize("app", [SINGLE_OAUTH_PROVIDER], indirect=True)
def test_login_page_redirects_authenticated_user_to_index(
    app: SupersetApp, client: FlaskClient, mocker: MockerFixture
) -> None:
    """An authenticated user goes to the index, not to the OAuth provider."""
    mocker.patch("superset.views.auth.g", user=MagicMock(is_authenticated=True))

    response = client.get("/login/")

    assert response.status_code == 302
    with app.test_request_context():
        index_url = app.appbuilder.get_url_for_index
    assert urlsplit(response.headers["Location"]).path == index_url
