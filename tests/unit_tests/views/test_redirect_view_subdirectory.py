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

"""Subdirectory-aware coverage for `/redirect/` (alert/report email links).

The
existing `tests/integration_tests/views/test_redirect_view.py` only exercises
the root deployment (`APPLICATION_ROOT="/"`). Under
`APPLICATION_ROOT=/superset` the route is mounted at `/superset/redirect/`
and recipients of alert/report emails click links that already embed the
`/superset` prefix in their absolute URLs. The shim must:

  1. Honour the SCRIPT_NAME-mounted route at `/superset/redirect/`.
  2. Pass an internal absolute URL (`http://host/superset/dashboard/1`)
     through unchanged in the 302 `Location` header — no second prefix, no
     stripping.
  3. Continue to reject dangerous schemes and missing URLs under subdir
     mounting (regression net for the existing checks).

These cases are unit-scoped via a minimal Flask app that mounts
`RedirectView.redirect_warning` directly. The integration-suite docker-light
`/login/` POST baseline blocks `SupersetTestCase`
locally; the minimal-app pattern matches the PWA-manifest test
module that established the workaround.
"""

from __future__ import annotations

from unittest.mock import patch
from urllib.parse import quote

import pytest
from flask import Flask

from superset.views.redirect import RedirectView

INTERNAL_HOST = "http://localhost:8088"
EXTERNAL_HOST = "https://external.example.com"


def _make_app(application_root: str = "/") -> Flask:
    """Build a minimal Flask app that mounts only `RedirectView`.

    Mirrors `tests/unit_tests/views/test_pwa_manifest.py::_make_minimal_app`.
    Bypasses the full SupersetAppInitializer so the test runs without the
    docker integration stack.

    NOTE: `RedirectView.redirect_warning` calls
    `superset.is_feature_enabled("ALERT_REPORTS")` which reads from the
    module-level `feature_flag_manager` (configured at full-app init).
    These tests stub that import to "always enabled" — the FF-disabled
    branch is exercised by the existing root-mode integration test.
    """
    app = Flask(__name__)
    app.config["APPLICATION_ROOT"] = application_root
    app.config["WEBDRIVER_BASEURL"] = INTERNAL_HOST
    app.config["WEBDRIVER_BASEURL_USER_FRIENDLY"] = INTERNAL_HOST
    # `BaseSupersetView.render_app_template` is the external-URL branch and
    # touches Jinja. The subdir contract is the internal-URL 302 branch, so
    # we only need to mount the handler — the template branch isn't exercised
    # by these tests.
    view = RedirectView()
    app.add_url_rule(
        "/redirect/",
        endpoint="RedirectView.redirect_warning",
        view_func=view.redirect_warning,
        methods=["GET"],
    )
    return app


def _get(app: Flask, path: str, script_name: str | None = None):
    client = app.test_client()
    # Stub `is_feature_enabled` at the import site inside `superset.views.redirect`
    # — the minimal app skips full `SupersetAppInitializer`, so the module-level
    # `feature_flag_manager` is never wired to a config.
    with patch("superset.views.redirect.is_feature_enabled", return_value=True):
        if script_name is None:
            return client.get(path, follow_redirects=False)
        return client.get(
            path,
            follow_redirects=False,
            environ_overrides={"SCRIPT_NAME": script_name},
        )


# ---------------------------------------------------------------------------
# Subdir-mode happy path: SCRIPT_NAME-mounted route + prefix-preserving 302
# ---------------------------------------------------------------------------


def test_internal_url_redirects_carry_script_name_under_subdir() -> None:
    """Email alert links contain prefixed absolute URLs; the shim passes them
    through unchanged in the Location header.

    Repro: alerts/reports render `<a href="http://host/superset/dashboard/1">`
    and the link-redirect HTML processor rewrites the href to
    `http://host/superset/redirect/?url=<encoded original>`. When the
    recipient clicks the wrapped link, the shim must redirect to the
    original `http://host/superset/dashboard/1` — preserving the prefix
    exactly once. A bug here would either strip the prefix (404 at
    `/dashboard/1`) or double it (`/superset/superset/dashboard/1`)."""
    app = _make_app(application_root="/superset")
    target = f"{INTERNAL_HOST}/superset/dashboard/1"
    response = _get(
        app,
        f"/redirect/?url={quote(target, safe='')}",
        script_name="/superset",
    )
    assert response.status_code == 302
    assert response.headers["Location"] == target
    assert "/superset/superset/" not in response.headers["Location"]


def test_internal_url_redirect_preserves_query_string_under_subdir() -> None:
    """The shim treats `?url=` as opaque; query strings on the target URL
    survive end-to-end."""
    app = _make_app(application_root="/superset")
    target = (
        f"{INTERNAL_HOST}/superset/dashboard/1/?native_filters_key=abc&standalone=1"
    )
    response = _get(
        app,
        f"/redirect/?url={quote(target, safe='')}",
        script_name="/superset",
    )
    assert response.status_code == 302
    assert response.headers["Location"] == target


def test_root_deployment_unchanged_after_subdir_fix() -> None:
    """Regression net: root deployment still works as the original integration
    test pins (no SCRIPT_NAME, no application_root prefix on the target)."""
    app = _make_app(application_root="/")
    target = f"{INTERNAL_HOST}/dashboard/1"
    response = _get(app, f"/redirect/?url={quote(target, safe='')}")
    assert response.status_code == 302
    assert response.headers["Location"] == target


# ---------------------------------------------------------------------------
# Subdir-mode failure modes: same guards must still fire under subdir mount
# ---------------------------------------------------------------------------


def test_missing_url_returns_400_under_subdir() -> None:
    """Absent `?url=` is rejected even when SCRIPT_NAME is present."""
    app = _make_app(application_root="/superset")
    response = _get(app, "/redirect/", script_name="/superset")
    assert response.status_code == 400


@pytest.mark.parametrize(
    "dangerous_url",
    [
        "javascript:alert(1)",
        "data:text/html,<script>1</script>",
        "vbscript:msgbox(1)",
        "file:///etc/passwd",
    ],
)
def test_dangerous_schemes_blocked_under_subdir(dangerous_url: str) -> None:
    """The DANGEROUS_SCHEMES frozenset is checked before the SCRIPT_NAME-aware
    redirect path, so it fires under any deployment shape."""
    app = _make_app(application_root="/superset")
    response = _get(
        app,
        f"/redirect/?url={quote(dangerous_url, safe='')}",
        script_name="/superset",
    )
    assert response.status_code == 400


def test_feature_flag_disabled_returns_404_under_subdir() -> None:
    """`ALERT_REPORTS=False` returns 404 regardless of deployment shape.

    Exercised via direct patching of `is_feature_enabled` rather than
    `_get`'s always-on stub.
    """
    app = _make_app(application_root="/superset")
    client = app.test_client()
    with patch("superset.views.redirect.is_feature_enabled", return_value=False):
        response = client.get(
            f"/redirect/?url={INTERNAL_HOST}/superset/dashboard/1",
            follow_redirects=False,
            environ_overrides={"SCRIPT_NAME": "/superset"},
        )
    assert response.status_code == 404


def test_protocol_relative_url_falls_through_to_warning_page_under_subdir() -> None:
    """Protocol-relative URLs (`//evil.com`) are not "safe" — the shim must
    not 302 them. With SCRIPT_NAME mounting the request still reaches the
    handler; the response falls through to the external-warning branch
    (which would render the React shell in a full app, but in this minimal
    setup raises a TemplateNotFound on the bare Flask app — we only assert
    the 302 path is NOT taken)."""
    app = _make_app(application_root="/superset")
    # `//evil.example.com/path` — `is_safe_redirect_url` rejects this branch.
    response = _get(
        app,
        "/redirect/?url=" + quote("//evil.example.com/path", safe=""),
        script_name="/superset",
    )
    # Either the warning page rendered (200) or the template lookup failed
    # (500) — either way, no 302 to the unsafe target.
    assert response.status_code != 302
