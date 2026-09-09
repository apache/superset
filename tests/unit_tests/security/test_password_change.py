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
from typing import Optional
from unittest.mock import MagicMock, patch

import pytest
from flask import Flask

from superset.security.password_change import (
    _get_user_attribute,
    _is_exempt_endpoint,
    password_change_required,
)


@pytest.mark.parametrize(
    "endpoint,expected",
    [
        (None, True),  # static file serving etc.
        ("ResetMyPasswordView.this_form_get", True),
        ("AuthDBView.login", True),
        ("AuthDBView.logout", True),
        ("appbuilder.static", True),
        ("UserInfoEditView.this_form_post", True),
        ("AuthOAuthView.login", True),
        ("SomeBlueprint.static", True),
        ("health", True),
        ("SupersetIndexView.index", False),
        ("Superset.dashboard", False),
        # Substring over-matching must NOT exempt these (they merely share a
        # substring with an exempt token).
        ("AuthorView.list", False),
        ("HealthDashboardView.show", False),
        ("StaticAssetReportView.list", False),
        ("UserInfoFancyView.show", False),
    ],
)
def test_is_exempt_endpoint(endpoint: Optional[str], expected: bool) -> None:
    """Exempt-endpoint matching is exact per view class, never substring."""
    # The password-reset / auth / static endpoints must stay reachable to avoid
    # a redirect loop while a change is pending.
    assert _is_exempt_endpoint(endpoint) is expected


def test_password_change_required() -> None:
    """The flag on the user's attribute row drives the required-change check."""
    user = MagicMock()
    user.id = 5

    with patch(
        "superset.security.password_change._get_user_attribute"
    ) as mock_get_attr:
        mock_get_attr.return_value = MagicMock(password_must_change=True)
        assert password_change_required(user) is True

        mock_get_attr.return_value = MagicMock(password_must_change=False)
        assert password_change_required(user) is False

        mock_get_attr.return_value = None
        assert password_change_required(user) is False


def test_password_change_required_no_user_id() -> None:
    """A user without an id (e.g. anonymous) never requires a change."""
    user = MagicMock()
    user.id = None
    assert password_change_required(user) is False


def test_get_user_attribute_deterministic_with_duplicates() -> None:
    """Duplicate attribute rows must yield a deterministic row, not a 500."""
    # Databases migrated from before the ``user_attribute.user_id`` unique
    # constraint could contain duplicate rows. The query must not raise (which
    # ``.one_or_none()`` would have done via ``MultipleResultsFound``); it must
    # fetch a single row deterministically via ``order_by(id).first()``.
    query = MagicMock()
    db = MagicMock()
    db.session.query.return_value = query
    query.filter.return_value = query
    query.order_by.return_value = query
    sentinel = MagicMock(name="first_row")
    query.first.return_value = sentinel

    with (
        patch("superset.extensions.db", db),
        patch("superset.models.user_attributes.UserAttribute") as user_attribute,
    ):
        result = _get_user_attribute(5)

    # Deterministic ordering on the primary key, then ``.first()`` — never
    # ``.one_or_none()``, which could 500 on duplicate rows.
    query.order_by.assert_called_once_with(user_attribute.id)
    query.first.assert_called_once_with()
    assert not query.one_or_none.called
    assert result is sentinel


@pytest.fixture
def enforcement_app() -> Flask:
    """A minimal Flask app with the enforcement hook registered and a flagged
    user, used to exercise the before-request redirect behavior end to end."""
    from flask import g

    from superset.security.password_change import (
        register_password_change_enforcement,
    )

    app = Flask(__name__)
    app.config["ENABLE_FORCE_PASSWORD_CHANGE"] = True
    app.secret_key = "test"  # noqa: S105

    user = MagicMock()
    user.id = 5
    user.is_anonymous = False

    @app.before_request
    def _set_user() -> None:  # pylint: disable=unused-variable
        g.user = user

    # A non-exempt route that, if redirected to, would re-trigger enforcement.
    @app.route("/")
    def index() -> str:  # pylint: disable=unused-variable
        return "index"

    register_password_change_enforcement(app)
    return app


@pytest.fixture(autouse=True)
def _no_babel_flash() -> Iterator[None]:
    """The minimal test app has no babel/flash messaging set up; stub them so
    the enforcement hook's translation + flash calls don't blow up. These are
    incidental to the redirect-target logic under test."""
    with (
        patch("superset.security.password_change.flash"),
        patch("superset.security.password_change.__", side_effect=lambda s: s),
    ):
        yield


def test_enforcement_redirects_to_reset_view(enforcement_app: Flask) -> None:
    # Happy path: the reset endpoint resolves, so flagged users are redirected
    # there (an exempt route) — no loop.
    with (
        patch(
            "superset.security.password_change.password_change_required",
            return_value=True,
        ),
        patch(
            "superset.security.password_change.url_for",
            return_value="/resetmypassword/form",
        ),
    ):
        resp = enforcement_app.test_client().get("/")
    assert resp.status_code == 302
    assert resp.headers["Location"].endswith("/resetmypassword/form")


def test_enforcement_falls_back_to_exempt_logout_not_index(
    enforcement_app: Flask,
) -> None:
    # If the reset endpoint can't be resolved, the fallback must be an exempt
    # route (logout) — never "/" / the index, which would loop. We make the
    # reset endpoint fail and the logout endpoint resolve.
    def fake_url_for(endpoint: str, *args, **kwargs) -> str:
        if endpoint == "ResetMyPasswordView.this_form_get":
            raise RuntimeError("no such endpoint")
        if endpoint == "AuthDBView.logout":
            return "/logout"
        raise AssertionError(f"unexpected endpoint {endpoint}")

    with (
        patch(
            "superset.security.password_change.password_change_required",
            return_value=True,
        ),
        patch(
            "superset.security.password_change.url_for",
            side_effect=fake_url_for,
        ),
    ):
        resp = enforcement_app.test_client().get("/")
    assert resp.status_code == 302
    location = resp.headers["Location"]
    assert location.endswith("/logout")
    # Crucially, the fallback is NOT a redirect back to the non-exempt index.
    assert not location.endswith("/")


def test_enforcement_no_resolvable_target_returns_error_not_loop(
    enforcement_app: Flask,
) -> None:
    # If NO exempt target can be resolved, we must return an error response
    # rather than redirect, so the flagged user can never get stuck in a loop.
    with (
        patch(
            "superset.security.password_change.password_change_required",
            return_value=True,
        ),
        patch(
            "superset.security.password_change.url_for",
            side_effect=RuntimeError("no endpoints"),
        ),
    ):
        resp = enforcement_app.test_client().get("/")
    assert resp.status_code == 503
    assert "Location" not in resp.headers
