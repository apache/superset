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
"""The flag on its own must not be mistaken for the promise being kept.

An extension that fails to import is logged and skipped, so
``CHANGE_MANAGEMENT`` could be on with no gate behind it -- and every edit
went live unreviewed, with no change request and no sign to the author
(QA-12). Core now refuses the write instead.
"""

from __future__ import annotations

import pytest
from flask import Flask

from superset import change_management


@pytest.fixture
def guarded_app() -> Flask:
    app = Flask(__name__)

    @app.route("/api/v1/chart/1", methods=["GET", "PUT"])
    def chart() -> str:
        return "the write landed"

    @app.route("/login/", methods=["POST"])
    def login() -> str:
        return "signed in"

    for route in (
        "/api/v1/security/login",
        "/api/v1/security/refresh",
        "/api/v1/security/guest_token/",
        "/api/v1/chart/data",
        "/api/v1/sqllab/execute/",
        "/api/v1/sqllab/estimate/",
        "/api/v1/sqllab/format_sql/",
        "/api/v1/explore/form_data",
        "/api/v1/explore/permalink",
        "/api/v1/dashboard/1/filter_state",
        "/api/v1/dashboard/1/filter_state/abc",
        "/api/v1/dashboard/1/permalink",
        "/api/v1/dashboard/my-slug/permalink",
        "/api/v1/sqllab/permalink",
        "/api/v1/sqllab/export_streaming/",
        "/api/v1/database/1/validate_sql/",
        "/api/v1/datasource/table/1/query",
        "/api/v1/query/stop",
        "/api/v1/log/",
        "/log/",
        "/sqllab/",
        "/explore/",
        "/explore/table/1/",
        "/datasource/samples",
        "/tabstateview/",
        "/tabstateview/1",
        "/tabstateview/1/activate",
        "/tableschemaview/",
        "/tableschemaview/1/expanded",
        "/api/v1/security/roles/",
        "/api/v1/security/login_as_admin",
        "/api/v1/chart/database/1",
        "/datasource/save/",
    ):
        app.add_url_rule(
            route,
            endpoint=route,
            view_func=lambda: "answered",
            methods=["POST", "PUT"],
        )

    @app.route("/api/v1/dashboard/1", methods=["PUT"])
    def dashboard() -> str:
        return "the write landed"

    change_management.install_fail_closed_guard(app)
    return app


@pytest.fixture
def review_promised(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(change_management, "_feature_on", lambda: True)
    monkeypatch.setattr(change_management, "_gate", None)


def test_write_is_refused_when_nothing_enforces_review(
    guarded_app: Flask, review_promised: None
) -> None:
    response = guarded_app.test_client().put("/api/v1/chart/1", json={})
    assert response.status_code == 503
    assert (
        response.get_json()["errors"][0]["error_type"]
        == "CHANGE_MANAGEMENT_UNENFORCED"
    )


def test_reads_still_work_while_the_gate_is_missing(
    guarded_app: Flask, review_promised: None
) -> None:
    """A viewer must keep seeing the live version of what is already there."""
    assert guarded_app.test_client().get("/api/v1/chart/1").status_code == 200


def test_signing_in_still_works_while_the_gate_is_missing(
    guarded_app: Flask, review_promised: None
) -> None:
    """Locking out the operator protects nothing and fixes nothing."""
    assert guarded_app.test_client().post("/login/").status_code == 200


def test_write_passes_once_a_gate_has_registered(
    guarded_app: Flask, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(change_management, "_feature_on", lambda: True)
    monkeypatch.setattr(change_management, "_gate", None)
    change_management.register_write_gate("test.gate")
    assert guarded_app.test_client().put("/api/v1/chart/1", json={}).status_code == 200


def test_write_passes_with_the_feature_off(
    guarded_app: Flask, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Nothing was promised, so nothing is withheld (SOW 6.1)."""
    monkeypatch.setattr(change_management, "_feature_on", lambda: False)
    monkeypatch.setattr(change_management, "_gate", None)
    assert guarded_app.test_client().put("/api/v1/chart/1", json={}).status_code == 200


# ---- reads that are POSTs ---------------------------------------------------
#
# Refusing these took the product down rather than its writes: no chart on
# any dashboard rendered for anybody and SQL Lab answered 503, for viewers
# who have never edited anything. None of them can change an asset.


@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/chart/data",
        "/api/v1/sqllab/execute/",
        "/api/v1/sqllab/estimate/",
        "/api/v1/sqllab/format_sql/",
        "/api/v1/explore/form_data",
        "/api/v1/explore/permalink",
        "/api/v1/dashboard/1/filter_state",
        "/api/v1/dashboard/1/filter_state/abc",
    ],
)
def test_a_read_still_answers_while_the_gate_is_missing(
    guarded_app: Flask, review_promised: None, path: str
) -> None:
    assert guarded_app.test_client().post(path).status_code == 200


def test_the_dashboard_itself_is_still_refused(
    guarded_app: Flask, review_promised: None
) -> None:
    """The prefix that opens `filter_state` must not open the resource it
    hangs off. A dashboard save is the thing this guard is for."""
    response = guarded_app.test_client().put("/api/v1/dashboard/1", json={})

    assert response.status_code == 503
    assert response.json["errors"][0]["error_type"] == "CHANGE_MANAGEMENT_UNENFORCED"


def test_a_path_nobody_listed_is_still_refused(
    guarded_app: Flask, review_promised: None
) -> None:
    """The default stays the safe one: only what is named is let through."""
    assert guarded_app.test_client().put("/api/v1/chart/1", json={}).status_code == 503


# ---- signing in, while the gate is missing ---------------------------------


@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/security/login",
        "/api/v1/security/refresh",
        "/api/v1/security/guest_token/",
    ],
)
def test_authenticating_is_not_a_write(
    guarded_app: Flask, review_promised: None, path: str
) -> None:
    """The browser form at `/login` was exempt and the API was not.

    So on a deployment with the flag on and no gate, a person at a keyboard
    could still sign in while every API client, every embedded dashboard
    and the MCP service were refused at the door -- and a guest token is
    how an embedded dashboard authenticates a viewer, who cannot edit
    anything in the first place.

    Found by standing a stack up in that state rather than by reasoning
    about it: these tests call the guard directly and never have to log in,
    so nothing here could have caught it.
    """
    assert guarded_app.test_client().post(path).status_code == 200


def test_the_rest_of_the_security_api_is_not_opened_by_that(
    guarded_app: Flask, review_promised: None
) -> None:
    """Authenticating is the exemption, not the `security` namespace.

    Roles, permissions and users are written through the same prefix and
    are not authentication.
    """
    assert (
        guarded_app.test_client().post("/api/v1/security/roles/").status_code == 503
    )


# ---- SQL Lab and Explore, while the gate is missing ------------------------
#
# Letting the query run and not the tab exist restored nothing: SQL Lab
# cannot open or switch a tab without `/tabstateview`, so the first probe
# of this fix measured one endpoint and called the product restored.


@pytest.mark.parametrize(
    "path",
    [
        "/sqllab/",
        "/tabstateview/",
        "/tabstateview/1",
        "/tabstateview/1/activate",
        "/tableschemaview/",
        "/tableschemaview/1/expanded",
        "/api/v1/sqllab/export_streaming/",
        "/api/v1/sqllab/permalink",
        "/api/v1/database/1/validate_sql/",
        "/api/v1/query/stop",
        "/explore/",
        "/explore/table/1/",
        "/datasource/samples",
        "/api/v1/datasource/table/1/query",
        "/api/v1/log/",
        "/log/",
    ],
)
def test_sql_lab_and_explore_still_work(
    guarded_app: Flask, review_promised: None, path: str
) -> None:
    assert guarded_app.test_client().post(path).status_code == 200


@pytest.mark.parametrize(
    "path", ["/api/v1/dashboard/1/permalink", "/api/v1/dashboard/my-slug/permalink"]
)
def test_a_dashboard_permalink_is_a_read(
    guarded_app: Flask, review_promised: None, path: str
) -> None:
    """The earlier entry read `/api/v1/dashboard/permalink`, which matches no
    route at all -- the real one carries the dashboard between the segments,
    and it takes a slug as well as an id."""
    assert guarded_app.test_client().post(path).status_code == 200


def test_the_permalink_rule_does_not_open_the_dashboard(
    guarded_app: Flask, review_promised: None
) -> None:
    """The suffix is required; the resource it hangs off is still refused."""
    assert guarded_app.test_client().put("/api/v1/dashboard/1", json={}).status_code == 503


@pytest.mark.parametrize(
    "path",
    [
        # Shares a prefix with an allowed path and is not one. Under the
        # `startswith` matching this replaced, both were let through.
        "/api/v1/security/login_as_admin",
        "/api/v1/chart/database/1",
        # A real governed write that happens to sit under an open folder.
        "/datasource/save/",
        # The `security` namespace is not exempt; authenticating is.
        "/api/v1/security/roles/",
    ],
)
def test_a_path_that_merely_looks_like_a_read_is_refused(
    guarded_app: Flask, review_promised: None, path: str
) -> None:
    assert guarded_app.test_client().post(path).status_code == 503
