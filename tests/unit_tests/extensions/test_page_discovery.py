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
"""A real extension on disk, loaded through real discovery.

The tests beside this one build their extensions out of mocks, which proves the
host does the right thing with a manifest it is handed. This one writes an
extension to a temporary directory, points `LOCAL_EXTENSIONS` at it and lets
discovery find it, so the declaration travels the whole way: a page written in
a manifest file ends up as a URL that renders.
"""

import importlib
import os
from pathlib import Path

import pytest

from superset.utils import json

MANIFEST = {
    "publisher": "acme",
    "name": "worked-example",
    "displayName": "Worked example",
    "version": "0.1.0",
    "backend": {"entrypoint": "acme_worked_example.entrypoint"},
    "contributions": {
        "pages": [
            {
                "id": "acme.worked-example.queue",
                "name": "Queue",
                "path": "/acme-example/queue/",
                # An existing resource, so the page is reachable without a role
                # sync -- which is the whole reason the permission is declared
                # rather than invented per page.
                "permission": {"resource": "Dashboard", "action": "read"},
            },
            {
                "id": "acme.worked-example.settings",
                "name": "Settings",
                "path": "/acme-example/settings/",
                "permission": {"resource": "Dashboard", "action": "read"},
            },
        ]
    },
}


@pytest.fixture(scope="module")
def extension_dir(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """An extension laid out the way the build tool emits one."""
    root = tmp_path_factory.mktemp("acme-worked-example")
    dist = root / "dist"
    (dist / "backend" / "src" / "acme_worked_example").mkdir(parents=True)
    (dist / "manifest.json").write_text(json.dumps(MANIFEST))
    # The entrypoint has to import cleanly: a page is registered whether or not
    # the backend does anything, and this keeps the test honest about which of
    # the two is being exercised.
    (dist / "backend" / "src" / "acme_worked_example" / "__init__.py").write_text("")
    (dist / "backend" / "src" / "acme_worked_example" / "entrypoint.py").write_text(
        "LOADED = True\n"
    )
    return root


@pytest.fixture(scope="module")
def app_with_discovered_extension(extension_dir: Path):
    from superset.app import SupersetApp
    from superset.extensions import appbuilder
    from superset.initialization import SupersetAppInitializer

    app = SupersetApp("superset")
    app.config.from_object("superset.config")
    app.config["SQLALCHEMY_DATABASE_URI"] = (
        os.environ.get("SUPERSET__SQLALCHEMY_DATABASE_URI") or "sqlite://"
    )
    app.config["WTF_CSRF_ENABLED"] = False
    app.config["TESTING"] = True
    app.config["RATELIMIT_ENABLED"] = False
    app.config["CACHE_CONFIG"] = {}
    app.config["DATA_CACHE_CONFIG"] = {}
    app.config["SERVER_NAME"] = "example.com"
    app.config["APPLICATION_ROOT"] = "/"
    app.config["STATIC_ASSETS_PREFIX"] = ""
    app.config["FEATURE_FLAGS"] = {
        **app.config.get("FEATURE_FLAGS", {}),
        "ENABLE_EXTENSIONS": True,
    }
    # Nothing is mocked past this line: discovery reads the directory above.
    app.config["LOCAL_EXTENSIONS"] = [str(extension_dir)]

    appbuilder.baseviews = []
    SupersetAppInitializer(app).init_app()

    with app.app_context():
        import superset.views.base

        importlib.reload(superset.views.base)

    yield app

    appbuilder.baseviews = []


def test_discovery_reads_the_declared_pages(app_with_discovered_extension) -> None:
    from superset.extensions.utils import get_extensions

    with app_with_discovered_extension.app_context():
        extensions = get_extensions()

    manifest = extensions["acme.worked-example"].manifest
    assert [(page.id, page.path) for page in manifest.contributions.pages] == [
        ("acme.worked-example.queue", "/acme-example/queue/"),
        ("acme.worked-example.settings", "/acme-example/settings/"),
    ]


def test_each_declared_page_becomes_a_route(app_with_discovered_extension) -> None:
    rules = {str(rule) for rule in app_with_discovered_extension.url_map.iter_rules()}

    for path in ("/acme-example/queue/", "/acme-example/settings/"):
        assert path in rules, f"{path} would 404 on a cold load"
        assert f"{path}<path:subpath>" in rules, f"a deep link under {path} would 404"


@pytest.mark.parametrize(
    "path",
    [
        "/acme-example/queue/",
        "/acme-example/settings/",
        # A deep link, because the frontend matches a page's path as a prefix.
        "/acme-example/queue/42/",
    ],
)
def test_a_declared_page_renders(
    app_with_discovered_extension, full_api_access, path: str
) -> None:
    """The end of the chain: a manifest entry is a URL that serves the app."""
    response = app_with_discovered_extension.test_client().get(path)
    body = response.get_data(as_text=True)

    assert response.status_code == 200, body[:400]
    assert 'id="app"' in body
    assert "data-bootstrap" in body


def test_a_declared_page_is_still_guarded(app_with_discovered_extension) -> None:
    response = app_with_discovered_extension.test_client().get("/acme-example/queue/")

    assert response.status_code != 200
    assert response.status_code != 404
    assert response.status_code != 500
