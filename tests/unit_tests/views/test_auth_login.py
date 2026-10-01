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

import jinja2
import pytest


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
