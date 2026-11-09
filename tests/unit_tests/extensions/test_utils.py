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
    return Flask(__name__)


def test_build_extension_data_reports_whether_each_page_may_be_opened(
    pages_app: Flask,
) -> None:
    """`permitted` decides the navigation entry and the refusal a page shows.

    There is no longer a `registered` half to pair it with: the host forms a
    page's address, so every declared page has one and the only question left
    is whether this user may open it.
    """
    extension = _loaded(
        Page(id="acme.tools.open", name="Open"),
        Page(id="acme.tools.gated", name="Gated", permission="can_review"),
    )

    with pages_app.app_context():
        pages = build_extension_data(extension)["contributions"]["pages"]

    assert {page["id"]: page["permitted"] for page in pages} == {
        # No permission required, so open to any signed-in user.
        "acme.tools.open": True,
        # This user does not hold `can_review`, so nothing advertises it.
        "acme.tools.gated": False,
    }


def test_build_extension_data_carries_a_pages_feature_flag(
    pages_app: Flask,
) -> None:
    """The flag has to reach the client, not just the route.

    `permitted` goes false both for a permission the user lacks and for a
    flag that is off, and the two want opposite screens -- a refusal and a
    404. The client tells them apart by reading the page's own `featureFlag`
    out of this payload, so dropping the field here costs nothing on the
    server and silently puts the refusal back in front of an Admin. Every
    other test builds its page declaration by hand and would not notice.
    """
    extension = _loaded(
        Page(id="acme.tools.flagged", name="Flagged", featureFlag="SOME_FLAG"),
        Page(id="acme.tools.plain", name="Plain"),
    )

    with pages_app.app_context():
        pages = build_extension_data(extension)["contributions"]["pages"]

    declared = {page["id"]: page for page in pages}
    assert declared["acme.tools.flagged"]["featureFlag"] == "SOME_FLAG"
    # `exclude_none=True`, so a page without one carries no key at all rather
    # than a null the client would have to test for.
    assert "featureFlag" not in declared["acme.tools.plain"]


def test_build_extension_data_keeps_every_declared_page(pages_app: Flask) -> None:
    """Including one this user may not open -- the count is the manifest's."""
    extension = _loaded(
        Page(id="acme.tools.open", name="Open"),
        Page(id="acme.tools.gated", name="Gated", permission="can_review"),
    )

    with pages_app.app_context():
        data = build_extension_data(extension)

    assert [page["id"] for page in data["contributions"]["pages"]] == [
        "acme.tools.open",
        "acme.tools.gated",
    ]
    assert data["id"] == "acme.tools"
    assert data["moduleFederationName"] == "acme_tools"
