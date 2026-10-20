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

"""Page-path registration and the collision check that guards it.

Exercised against a bare Flask app rather than the Superset one: the thing
under test is how a declared path interacts with the URL map, and a bare app
lets each case state exactly which routes exist before the extension loads --
which is the whole question.
"""

import logging

import pytest
from flask import Flask, g
from pydantic import ValidationError
from superset_core.extensions.types import Contributions, Manifest, Page
from werkzeug.exceptions import NotFound

from superset.extensions import view
from superset.extensions.view import (
    _first_claimant,
    register_extension_pages,
    registered_page_paths,
)


def manifest(*paths: str, extension_id: str = "acme.tools") -> Manifest:
    publisher, name = extension_id.split(".", 1)
    return Manifest(
        publisher=publisher,
        name=name,
        displayName="Tools",
        contributions=Contributions(
            pages=[Page(path=path, name=path) for path in paths]
        ),
    )


def paths_in(app: Flask) -> set[str]:
    return {rule.rule for rule in app.url_map.iter_rules()}


@pytest.fixture
def app() -> Flask:
    return Flask(__name__)


def test_a_free_path_is_registered(app: Flask) -> None:
    register_extension_pages(app, manifest("/approvals"))

    assert "/approvals" in paths_in(app)
    # The page owns everything beneath it, so a deep link resolves on a cold
    # load instead of 404ing before the client router ever runs.
    assert "/approvals/<path:rest>" in paths_in(app)


def test_a_path_a_core_route_already_serves_is_refused(
    app: Flask, caplog: pytest.LogCaptureFixture
) -> None:
    app.add_url_rule("/welcome", endpoint="welcome", view_func=lambda: "")

    with caplog.at_level(logging.ERROR):
        register_extension_pages(app, manifest("/welcome"))

    assert "/welcome/<path:rest>" not in paths_in(app)
    assert "already served by welcome" in caplog.text


def test_a_parameterised_rule_is_recognised_as_the_claimant(
    app: Flask, caplog: pytest.LogCaptureFixture
) -> None:
    """The case a literal comparison against known routes gets wrong.

    ``/oauth-authorized/<provider>`` never string-matches the concrete path
    it would answer, so a denylist of route templates waves this through --
    which is how an extension could end up in front of an OAuth callback.
    """
    app.add_url_rule(
        "/oauth-authorized/<provider>", endpoint="oauth", view_func=lambda provider: ""
    )

    with caplog.at_level(logging.ERROR):
        register_extension_pages(app, manifest("/oauth-authorized/google"))

    assert "/oauth-authorized/google" not in paths_in(app)
    assert "already served by oauth" in caplog.text


def test_a_path_whose_descendants_are_taken_is_refused(
    app: Flask, caplog: pytest.LogCaptureFixture
) -> None:
    """A page at ``/x`` would shadow ``/x/list`` through its sub-path rule."""
    app.add_url_rule("/report/list", endpoint="report_list", view_func=lambda: "")

    with caplog.at_level(logging.ERROR):
        register_extension_pages(app, manifest("/report"))

    assert "/report" not in paths_in(app)


def test_a_rule_answering_other_methods_still_owns_the_path(app: Flask) -> None:
    app.add_url_rule(
        "/submit", endpoint="submit", view_func=lambda: "", methods=["POST"]
    )

    register_extension_pages(app, manifest("/submit"))

    assert "/submit/<path:rest>" not in paths_in(app)


def test_the_second_extension_to_claim_a_path_is_refused(
    app: Flask, caplog: pytest.LogCaptureFixture
) -> None:
    register_extension_pages(app, manifest("/approvals"))

    with caplog.at_level(logging.ERROR):
        register_extension_pages(app, manifest("/approvals", extension_id="other.ext"))

    assert "other.ext" in caplog.text
    # The first extension keeps the path; the loser is told, not silently
    # left with a component nothing routes to.
    assert len([r for r in app.url_map.iter_rules() if r.rule == "/approvals"]) == 1


def test_one_refused_page_does_not_stop_the_others(
    app: Flask, caplog: pytest.LogCaptureFixture
) -> None:
    app.add_url_rule("/welcome", endpoint="welcome", view_func=lambda: "")

    with caplog.at_level(logging.ERROR):
        register_extension_pages(app, manifest("/welcome", "/approvals"))

    assert "/approvals" in paths_in(app)


def test_an_extension_declaring_no_pages_registers_nothing(app: Flask) -> None:
    before = paths_in(app)

    register_extension_pages(app, manifest())

    assert paths_in(app) == before


@pytest.mark.parametrize(
    "path",
    [
        "review-queue",
        "/review-queue/",
        "/Review-Queue",
        "",
        "/review-queue/:id",
        "/-queue",
        "/a//b",
    ],
)
def test_a_malformed_path_is_rejected_by_the_manifest(path: str) -> None:
    """Rejected at parse time, so a bad path never reaches the URL map."""
    with pytest.raises(ValidationError, match="should match pattern"):
        Page(path=path, name="X")


def test_first_claimant_reports_a_redirect_as_taken(app: Flask) -> None:
    """``strict_slashes`` means ``/thing/`` already answers for ``/thing``."""
    app.add_url_rule("/thing/", endpoint="thing", view_func=lambda: "")

    assert _first_claimant(app, "/thing") is not None


def test_registered_page_paths_reports_only_what_was_accepted(app: Flask) -> None:
    app.add_url_rule("/welcome", endpoint="welcome", view_func=lambda: "")

    register_extension_pages(app, manifest("/welcome", "/approvals"))

    # The refused page is absent, so nothing downstream -- the menu, the
    # frontend's check on what an extension may register -- can offer a page
    # that has no route behind it.
    assert registered_page_paths(app, "acme.tools") == ["/approvals"]


def test_registered_page_paths_does_not_leak_across_extensions(app: Flask) -> None:
    register_extension_pages(app, manifest("/approvals"))
    register_extension_pages(app, manifest("/change-review", extension_id="other.ext"))

    assert registered_page_paths(app, "acme.tools") == ["/approvals"]
    assert registered_page_paths(app, "other.ext") == ["/change-review"]


def render_with(
    monkeypatch: pytest.MonkeyPatch,
    app: Flask,
    *,
    extensions_enabled: bool = True,
    user_id: int | None = 1,
) -> object:
    """Run ``_render_page``'s guards without rendering a real template.

    The guards are the whole of the view; what it renders on success is
    ``spa.html`` unchanged, which the host's own screens already cover.
    """
    import superset

    monkeypatch.setattr(
        superset, "is_feature_enabled", lambda _flag: extensions_enabled
    )
    monkeypatch.setattr(view, "get_user_id", lambda: user_id)
    monkeypatch.setattr(view, "render_template", lambda *a, **k: "SHELL")
    monkeypatch.setattr(view, "get_spa_template_context", dict)
    monkeypatch.setattr(view, "redirect_to_login", lambda: "LOGIN")

    register_extension_pages(app, manifest("/approvals"))

    with app.test_request_context("/approvals"):
        g.user = object() if user_id else None
        return view._render_page()


def test_the_flag_decides_what_a_registered_page_answers(
    monkeypatch: pytest.MonkeyPatch, app: Flask
) -> None:
    """Read per request, so turning extensions off takes effect immediately.

    The rule stays in the URL map until the process restarts; the flag is
    what stops it serving, rather than leaving pages reachable in the window
    between flipping the flag and a restart.
    """
    with pytest.raises(NotFound):
        render_with(monkeypatch, app, extensions_enabled=False)


def test_an_anonymous_load_is_sent_to_login_not_404(
    monkeypatch: pytest.MonkeyPatch, app: Flask
) -> None:
    # 404 here would tell an anonymous visitor the page does not exist, and
    # send them nowhere useful; every other host screen redirects.
    assert render_with(monkeypatch, app, user_id=None) == "LOGIN"


def test_a_signed_in_load_gets_the_shell(
    monkeypatch: pytest.MonkeyPatch, app: Flask
) -> None:
    assert render_with(monkeypatch, app) == "SHELL"
