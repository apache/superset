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
"""The one route that serves every extension-contributed page."""

import importlib
import os

import pytest


def _build_app(enable_extensions: bool = True):
    from superset.app import SupersetApp
    from superset.extensions import appbuilder
    from superset.initialization import SupersetAppInitializer

    # "superset", not __name__: Flask resolves its template folder from the
    # import name, so a test module's name makes `superset/spa.html`
    # unfindable and the shell renders as a 500.
    app = SupersetApp("superset")
    app.config.from_object("superset.config")
    app.config["SQLALCHEMY_DATABASE_URI"] = (
        os.environ.get("SUPERSET__SQLALCHEMY_DATABASE_URI") or "sqlite://"
    )
    app.config["WTF_CSRF_ENABLED"] = False
    app.config["TESTING"] = True
    app.config["RATELIMIT_ENABLED"] = False
    app.config["CACHE_CONFIG"] = {"CACHE_TYPE": "NullCache"}
    app.config["DATA_CACHE_CONFIG"] = {"CACHE_TYPE": "NullCache"}
    # These default to `SupersetMetastoreCache`, which this test does not
    # exercise and which needs a metadata database to construct.
    app.config["FILTER_STATE_CACHE_CONFIG"] = {"CACHE_TYPE": "NullCache"}
    app.config["EXPLORE_FORM_DATA_CACHE_CONFIG"] = {"CACHE_TYPE": "NullCache"}
    app.config["SERVER_NAME"] = "example.com"
    app.config["APPLICATION_ROOT"] = "/"
    app.config["STATIC_ASSETS_PREFIX"] = ""
    app.config["FEATURE_FLAGS"] = {
        **app.config.get("FEATURE_FLAGS", {}),
        "ENABLE_EXTENSIONS": enable_extensions,
    }
    appbuilder.baseviews = []
    SupersetAppInitializer(app).init_app()
    with app.app_context():
        import superset.views.base

        importlib.reload(superset.views.base)
    return app


@pytest.fixture(scope="module")
def app_with_pages():
    app = _build_app()
    yield app
    from superset.extensions import appbuilder

    appbuilder.baseviews = []


def test_the_route_exists_without_any_extension_installed(app_with_pages) -> None:
    """The whole point of one rule: it does not depend on what is on disk.

    A per-page route would tie the URL map to the filesystem, so two workers
    with different state would answer the same URL differently.
    """
    rules = {str(rule) for rule in app_with_pages.url_map.iter_rules()}
    assert any("extension_id" in rule and "rest" in rule for rule in rules), rules


def test_it_renders_the_shell_for_any_path_under_an_extension_id(
    app_with_pages, full_api_access
) -> None:
    client = app_with_pages.test_client()
    for path in (
        "/extensions/acme.asset-approval/",
        "/extensions/acme.asset-approval/queue/",
        "/extensions/acme.asset-approval/queue/42/edit/",
    ):
        response = client.get(path)
        body = response.get_data(as_text=True)
        assert response.status_code == 200, (path, body[:300])
        assert 'id="app"' in body, path
        assert "data-bootstrap" in body, path


@pytest.mark.parametrize(
    "path",
    [
        # Not a dotted composite id, so the rule must not match at all.
        "/extensions/acme/",
        "/extensions/acme/queue/",
        # The host's own extensions screen keeps its route.
        "/extensions/list/",
        # Uppercase and spaces are outside the identifier patterns.
        "/extensions/Acme.Tools/queue/",
    ],
)
def test_it_does_not_match_anything_that_is_not_an_extension_id(
    app_with_pages, full_api_access, path: str
) -> None:
    """The dotted id is what keeps this rule out of the extension API namespace.

    `/extensions/<publisher>/<name>/...` already belongs to extension-contributed
    REST APIs, where the publisher is a literal segment that cannot contain a dot.
    """
    response = app_with_pages.test_client().get(path)
    assert response.status_code != 200 or 'id="app"' not in response.get_data(
        as_text=True
    ), f"{path} was served the shell"


def test_an_unauthenticated_load_is_sent_to_login_not_404(app_with_pages) -> None:
    response = app_with_pages.test_client().get(
        "/extensions/acme.asset-approval/queue/", follow_redirects=False
    )
    assert response.status_code in (301, 302, 308), response.status_code
    assert "/login" in response.headers.get("Location", "")


def test_it_is_404_when_extensions_are_switched_off(full_api_access) -> None:
    """The route is always registered; the flag decides what it answers."""
    app = _build_app(enable_extensions=False)
    try:
        response = app.test_client().get("/extensions/acme.asset-approval/queue/")
        assert response.status_code == 404
    finally:
        from superset.extensions import appbuilder

        appbuilder.baseviews = []
