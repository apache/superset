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
"""Path-rewriting behavior of ``AppRootMiddleware``.

The middleware mounts the app under a prefix, so it decides three things for
every inbound request: strip the prefix, pass an unprefixed ``/static/`` path
through untouched (webpack bakes ``/static/assets/`` into the bundle at build
time), or 404. A synthetic inner WSGI app records the environ it is handed.
"""

from __future__ import annotations

import pytest
from werkzeug.test import EnvironBuilder

from superset.app import AppRootMiddleware


def _call(path: str, app_root: str = "/analytics"):
    """Run ``path`` through the middleware, returning (environ, status).

    ``environ`` is ``None`` when the inner app was never reached.
    """
    seen: dict[str, object] = {}
    status: list[str] = []

    def inner_app(environ, start_response):
        seen.update(environ)
        start_response("200 OK", [("Content-Type", "text/plain")])
        return [b"INNER_APP_REACHED"]

    def start_response(response_status, _headers, *args):
        status.append(response_status)
        return lambda _chunk: None

    middleware = AppRootMiddleware(inner_app, app_root)
    list(middleware(EnvironBuilder(path).get_environ(), start_response))
    return (seen or None), status[0]


@pytest.mark.parametrize(
    "path,expected_path_info",
    [
        ("/analytics", ""),
        ("/analytics/", "/"),
        ("/analytics/dashboard/list/", "/dashboard/list/"),
    ],
)
def test_prefixed_path_is_stripped(path, expected_path_info):
    environ, status = _call(path)
    assert status == "200 OK"
    assert environ["PATH_INFO"] == expected_path_info
    assert environ["SCRIPT_NAME"] == "/analytics"


@pytest.mark.parametrize(
    "path",
    [
        "/static",
        "/static/assets/images/superset-logo-horiz.png",
        "/static/assets/chunk.1a2b3c.entry.js",
    ],
)
def test_unprefixed_static_path_passes_through(path):
    """Webpack requests ``/static/assets/...`` without the app root."""
    environ, status = _call(path)
    assert status == "200 OK"
    # Neither stripped nor remounted: the static route lives at /static/... on
    # the unprefixed app.
    assert environ["PATH_INFO"] == path
    assert environ.get("SCRIPT_NAME") == ""


def test_prefixed_static_path_is_still_stripped():
    """STATIC_ASSETS_PREFIX defaults to the app root, so both forms work."""
    environ, status = _call("/analytics/static/assets/main.js")
    assert status == "200 OK"
    assert environ["PATH_INFO"] == "/static/assets/main.js"
    assert environ["SCRIPT_NAME"] == "/analytics"


@pytest.mark.parametrize(
    "path",
    [
        "/dashboard/list/",
        # Shares a string prefix with the app root but not a segment boundary.
        "/analyticsfoo/dashboard/list/",
        # A path that merely contains "/static/" further along is not a
        # static asset request.
        "/other/static/assets/main.js",
    ],
)
def test_unmatched_path_returns_404(path):
    environ, status = _call(path)
    assert environ is None
    assert "404" in status


def test_trailing_slash_in_app_root_is_normalized():
    environ, status = _call("/analytics/dashboard/list/", app_root="/analytics/")
    assert status == "200 OK"
    assert environ["PATH_INFO"] == "/dashboard/list/"
    assert environ["SCRIPT_NAME"] == "/analytics"
