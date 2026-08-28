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

from unittest.mock import patch, PropertyMock

from flask import current_app

from superset.models.dashboard import Dashboard


def test_dashboard_link_escapes_slug(app_context: None) -> None:
    """dashboard_link must HTML-escape the user-controlled slug in the href.

    The slug can carry markup via the import path (which does not run the REST
    API's slug sanitization), so the rendered FAB list-view link must escape it.
    `url_for` percent-encodes path params and `escape()` HTML-encodes the
    result before Markup-marking; the rendered link must contain neither the
    raw injected script tag nor an unescaped attribute breakout.
    """
    dash = Dashboard()
    dash.id = 1
    dash.dashboard_title = "My Dashboard"
    dash.slug = '"><script>alert(1)</script>'

    with current_app.test_request_context("/"):
        link = str(dash.dashboard_link())

    # The injected script tag / attribute breakout must be escaped away.
    assert "<script>" not in link
    assert '"><script' not in link
    # The legitimate anchor markup is still present.
    assert link.startswith("<a href=")
    assert "My Dashboard" in link


def test_dashboard_link_renders_plain_slug(app_context: None) -> None:
    """A normal slug renders a working link under a subdirectory deployment.

    `dashboard_link` uses `url_for`, which prepends the request's script root
    so the rendered href is correct under both root and `/superset`
    deployments. The test pins the `/superset` shape by passing `base_url`
    with the prefix path — werkzeug derives `SCRIPT_NAME` from the base URL's
    path and the URL adapter then prepends it on `url_for`. Passing
    `environ_base={"SCRIPT_NAME": "/superset"}` alone is not enough: the URL
    adapter is built from the parsed base URL, not raw environ values.
    """
    dash = Dashboard()
    dash.id = 7
    dash.dashboard_title = "Sales"
    dash.slug = "sales"

    with current_app.test_request_context("/", base_url="http://localhost/superset/"):
        link = str(dash.dashboard_link())

    assert "/superset/dashboard/sales/" in link
    assert "Sales" in link


def test_thumbnail_url_is_router_relative_at_root(app_context: None) -> None:
    """thumbnail_url uses url_for, so at root it keeps the legacy shape."""
    dash = Dashboard()
    dash.id = 7

    with patch.object(
        Dashboard, "digest", new_callable=PropertyMock, return_value="abc123"
    ):
        with current_app.test_request_context("/"):
            url = dash.thumbnail_url

    assert url == "/api/v1/dashboard/7/thumbnail/abc123/"


def test_thumbnail_url_carries_app_root_prefix(app_context: None) -> None:
    """Under a subdirectory deployment the serialized thumbnail URL must carry
    the application root, because the frontend treats thumbnail_url as an
    already-prefixed raw fetch target (it is excluded from
    normalizeBackendUrls and never passed through ensureAppRoot)."""
    dash = Dashboard()
    dash.id = 7

    with patch.object(
        Dashboard, "digest", new_callable=PropertyMock, return_value="abc123"
    ):
        with current_app.test_request_context(
            "/", base_url="http://example.com/superset/"
        ):
            url = dash.thumbnail_url

    assert url == "/superset/api/v1/dashboard/7/thumbnail/abc123/"


def test_thumbnail_url_is_none_without_digest(app_context: None) -> None:
    dash = Dashboard()
    dash.id = 7

    with patch.object(
        Dashboard, "digest", new_callable=PropertyMock, return_value=None
    ):
        with current_app.test_request_context("/"):
            assert dash.thumbnail_url is None


def test_thumbnail_url_works_outside_request_context(app_context: None) -> None:
    """The property must stay callable from out-of-request callers (CLI,
    celery tasks): with no request there is no SCRIPT_NAME to honor, so it
    falls back to the router-relative shape instead of raising."""
    dash = Dashboard()
    dash.id = 7

    with patch.object(
        Dashboard, "digest", new_callable=PropertyMock, return_value="abc123"
    ):
        url = dash.thumbnail_url

    assert url == "/api/v1/dashboard/7/thumbnail/abc123/"
