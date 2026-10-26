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
