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

from unittest.mock import MagicMock

import pytest
from flask import current_app, Flask
from superset_core.extensions.types import (
    Contributions,
    Manifest,
    ManifestFrontend,
    Page,
)

from superset.extensions.types import LoadedExtension
from superset.extensions.utils import (
    build_extension_data,
    get_extension_rejection_reason,
    is_extension_below_min_version,
    is_extension_denied,
)
from superset.extensions.view import register_extension_pages


def _extension(ext_id: str, version: str) -> MagicMock:
    extension = MagicMock()
    extension.id = ext_id
    extension.version = version
    return extension


def test_is_extension_denied() -> None:
    original = current_app.config.get("EXTENSION_DENYLIST")
    try:
        # Empty denylist: nothing is denied.
        current_app.config["EXTENSION_DENYLIST"] = []
        assert is_extension_denied(_extension("acme.widget", "1.0.0")) is False

        # Deny by id: every version of that id is denied.
        current_app.config["EXTENSION_DENYLIST"] = ["acme.widget"]
        assert is_extension_denied(_extension("acme.widget", "1.0.0")) is True
        assert is_extension_denied(_extension("acme.widget", "2.0.0")) is True
        assert is_extension_denied(_extension("acme.other", "1.0.0")) is False

        # Deny by id@version: only that exact version is denied.
        current_app.config["EXTENSION_DENYLIST"] = ["acme.widget@1.0.0"]
        assert is_extension_denied(_extension("acme.widget", "1.0.0")) is True
        assert is_extension_denied(_extension("acme.widget", "2.0.0")) is False
    finally:
        current_app.config["EXTENSION_DENYLIST"] = original


def test_is_extension_below_min_version() -> None:
    too_old = is_extension_below_min_version
    original = current_app.config.get("EXTENSION_VERSION_POLICY")
    try:
        # No policy: nothing is too old.
        current_app.config["EXTENSION_VERSION_POLICY"] = {}
        assert too_old(_extension("acme.widget", "1.0.0")) is False

        current_app.config["EXTENSION_VERSION_POLICY"] = {"acme.widget": "1.2.0"}
        # PEP 440 comparison, not string compare (1.10.0 > 1.2.0).
        assert too_old(_extension("acme.widget", "1.10.0")) is False
        assert too_old(_extension("acme.widget", "1.1.9")) is True
        # At or above the minimum -> allowed.
        assert too_old(_extension("acme.widget", "1.2.0")) is False
        assert too_old(_extension("acme.widget", "2.0.0")) is False
        # A different id is unaffected by this id's policy.
        assert too_old(_extension("acme.other", "0.1.0")) is False
        # Unparseable version fails closed.
        assert too_old(_extension("acme.widget", "not-a-version")) is True
    finally:
        current_app.config["EXTENSION_VERSION_POLICY"] = original or {}


def test_get_extension_rejection_reason() -> None:
    deny = current_app.config.get("EXTENSION_DENYLIST")
    policy = current_app.config.get("EXTENSION_VERSION_POLICY")
    try:
        current_app.config["EXTENSION_DENYLIST"] = ["acme.bad"]
        current_app.config["EXTENSION_VERSION_POLICY"] = {"acme.widget": "1.2.0"}

        assert get_extension_rejection_reason(_extension("acme.ok", "9.9.9")) is None
        assert "EXTENSION_DENYLIST" in (
            get_extension_rejection_reason(_extension("acme.bad", "1.0.0")) or ""
        )
        assert "EXTENSION_VERSION_POLICY" in (
            get_extension_rejection_reason(_extension("acme.widget", "1.0.0")) or ""
        )
    finally:
        current_app.config["EXTENSION_DENYLIST"] = deny or []
        current_app.config["EXTENSION_VERSION_POLICY"] = policy or {}


def _loaded(*pages: Page, extension_id: str = "acme.tools") -> LoadedExtension:
    publisher, name = extension_id.split(".", 1)
    manifest = Manifest(
        publisher=publisher,
        name=name,
        displayName="Tools",
        frontend=ManifestFrontend(
            remoteEntry="remoteEntry.js", moduleFederationName="acme_tools"
        ),
        contributions=Contributions(pages=list(pages)),
    )
    return LoadedExtension(
        id=manifest.id,
        name=name,
        manifest=manifest,
        frontend={},
        backend={},
        version=manifest.version,
        source_base_path="supx://acme.tools",
    )


class _Security:
    """Grants nothing. The gated page is the one the user cannot open."""

    def can_access(self, permission: str, view: str) -> bool:
        return False


@pytest.fixture
def pages_app(monkeypatch: pytest.MonkeyPatch) -> Flask:
    import superset

    monkeypatch.setattr(superset, "security_manager", _Security(), raising=False)
    app = Flask(__name__)
    # A host route the extension will collide with, registered first, the way
    # Superset's own routes are.
    app.add_url_rule("/taken", endpoint="host.taken", view_func=lambda: "")
    return app


def test_build_extension_data_reports_what_became_of_each_page(
    pages_app: Flask,
) -> None:
    """The pair the frontend acts on, for all three outcomes.

    `registered` and `permitted` decide the navigation entry, whether a
    component may be registered, and which refusal the page shows. The two are
    read separately elsewhere, so nothing until now exercised the serializer
    that actually pairs them -- swapping them, or reporting a refused page as
    registered, would have passed every other test.
    """
    extension = _loaded(
        Page(path="/open", name="Open"),
        Page(path="/gated", name="Gated", permission="can_review"),
        Page(path="/taken", name="Taken"),
    )
    register_extension_pages(pages_app, extension.manifest)

    with pages_app.app_context():
        pages = build_extension_data(extension)["contributions"]["pages"]

    outcome = {page["path"]: (page["registered"], page["permitted"]) for page in pages}
    assert outcome == {
        # Declared, has a rule, no permission required.
        "/open": (True, True),
        # Declared and routed, but this user does not hold `can_review`, so
        # nothing should advertise it.
        "/gated": (True, False),
        # Refused at registration: a host route already serves the path. Still
        # reported, so the frontend can say "refused" rather than silently
        # dropping a page the extension's own bundle will try to register.
        "/taken": (False, False),
    }


def test_build_extension_data_keeps_every_declared_page(pages_app: Flask) -> None:
    """Including the refused one -- the count is the manifest's, not the map's."""
    extension = _loaded(
        Page(path="/open", name="Open"),
        Page(path="/taken", name="Taken"),
    )
    register_extension_pages(pages_app, extension.manifest)

    with pages_app.app_context():
        data = build_extension_data(extension)

    assert [page["path"] for page in data["contributions"]["pages"]] == [
        "/open",
        "/taken",
    ]
    assert data["id"] == "acme.tools"
    assert data["moduleFederationName"] == "acme_tools"
