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
"""The shell route for a contributed page.

The route is login-gated and nothing more, and it answers with the shell for
every page id there will ever be. Pages are registered in the browser, so the
server cannot know which ids exist: it serves the shell and the client decides
whether to render the page, "not found" or "not authorized".

That is the whole of what the server does for a page, so it is the whole of
what there is to test here. SIP-235 puts the gate on the client, checked
against the permissions the shell's bootstrap payload already ships, because
the shell carries no data and the extension's own ``@protect()``ed endpoints
are the security boundary.

Several cases below assert what the route does *not* do -- it does not 403 and
it does not 404 -- because those are the behaviours a later change would most
plausibly add back, and a test that only asserted the happy path would not
notice.
"""

from types import SimpleNamespace

import pytest
from flask import Flask

from superset.extensions import view


@pytest.fixture
def served(monkeypatch: pytest.MonkeyPatch) -> Flask:
    """An app serving the page route, with the shell stubbed.

    ``ExtensionsView.page`` is bound onto a bare app rather than registered
    through FAB, because the only thing the view needs of itself is
    ``self.appbuilder``, and only on the anonymous branch of ``@signed_in``,
    which a signed-in stub never takes.
    """
    monkeypatch.setattr(view, "_render_shell", lambda: "<shell/>")
    monkeypatch.setattr(view, "current_user", SimpleNamespace(is_authenticated=True))

    app = Flask(__name__)
    app.add_url_rule(
        "/extensions/pages/<page_id>/",
        "page",
        lambda page_id: view.ExtensionsView.page(SimpleNamespace(), page_id),
    )
    app.add_url_rule(
        "/extensions/pages/<page_id>/<path:sub_path>",
        "page_sub_path",
        lambda page_id, sub_path: view.ExtensionsView.page(
            SimpleNamespace(), page_id, sub_path
        ),
    )
    return app


def test_a_page_is_served_the_shell(served: Flask) -> None:
    response = served.test_client().get("/extensions/pages/acme.tools.queue/")

    assert response.status_code == 200
    assert response.get_data(as_text=True) == "<shell/>"


def test_a_page_the_user_may_not_open_is_served_the_shell_too(
    served: Flask,
) -> None:
    """No 403. This is the one most likely to be undone by accident.

    The route cannot know which permission guards a page, because a page
    names its permission on its own ``registerView`` call and the server
    never reads it. SIP-235 section 6: "The shell route stays login-only and
    serves the shell regardless... The gate is on reachability and
    advertisement, not on data." The client renders its own "Not authorized"
    state from the permissions the shell's bootstrap payload already carries.

    Nothing here sets up a permission, because there is nothing to set up --
    which is the assertion. A 403 appearing here would mean the server had
    started reading a page's permission, which only the client does.
    """
    response = served.test_client().get("/extensions/pages/acme.tools.queue/")

    assert response.status_code == 200


def test_an_id_nothing_registered_is_served_the_shell(served: Flask) -> None:
    """Not a 404, and not a leak.

    The server cannot tell a real page from a typo: pages are registered in
    the browser. So it serves the shell and the client says "not found" once
    extensions have settled. Every id answers alike, which is also what keeps
    the route from telling an unauthenticated prober which page ids exist.
    """
    response = served.test_client().get("/extensions/pages/nobody.registered.this/")

    assert response.status_code == 200
    assert response.get_data(as_text=True) == "<shell/>"


def test_a_sub_path_resolves_to_the_same_shell(served: Flask) -> None:
    """A deep address survives a refresh, a bookmark and a shared link.

    Everything below a page's own address belongs to the page. The server
    accepts the remainder and ignores it -- the shell is the same shell and
    the client router reads the rest off ``window.location`` -- but the rule
    has to exist or a reload of a deep address hard-404s before any of this
    reaches the browser.
    """
    response = served.test_client().get("/extensions/pages/acme.tools.queue/42/edit")

    assert response.status_code == 200
    assert response.get_data(as_text=True) == "<shell/>"


def test_an_anonymous_visitor_is_sent_to_log_in(
    served: Flask, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Login still comes first, and it redirects rather than refusing.

    ``@signed_in`` is deliberately not ``flask_login``'s ``login_required``:
    FAB sets ``login_view`` to ``"login"`` while the endpoint it registers is
    ``AuthDBView.login``, so an anonymous request there raises ``BuildError``
    instead of redirecting.
    """
    monkeypatch.setattr(view, "current_user", SimpleNamespace(is_authenticated=False))

    class AuthDBView:
        pass

    # ``signed_in`` builds the endpoint from the auth view's class name, which
    # is the whole point of it: FAB registers ``AuthDBView.login`` while its
    # own ``login_view`` says ``"login"``.
    this = SimpleNamespace(
        appbuilder=SimpleNamespace(sm=SimpleNamespace(auth_view=AuthDBView()))
    )

    app = Flask(__name__)
    app.add_url_rule("/login/", "AuthDBView.login", lambda: "<login/>")
    app.add_url_rule(
        "/extensions/pages/<page_id>/",
        "page",
        lambda page_id: view.ExtensionsView.page(this, page_id),
    )

    response = app.test_client().get("/extensions/pages/acme.tools.queue/")

    assert response.status_code in (301, 302)
    assert "/login/" in response.headers["Location"]
