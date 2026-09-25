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

"""
Who may read an extension's frontend bundle.

A host page embedding a widget an extension contributes loads that extension's
chunks with plain ``<script>`` tags, which carry no guest token, so serving
them unauthenticated is what makes extension widgets embeddable at all — and
it only happens when the operator turns ``EMBEDDED_EXTENSION_ASSETS_PUBLIC``
on.
"""

from typing import Any

import pytest
from pytest_mock import MockerFixture
from superset_core.extensions.types import Manifest, ManifestFrontend

from superset.extensions.types import LoadedExtension

EXTENSIONS_APP = {"FEATURE_FLAGS": {"ENABLE_EXTENSIONS": True}}

PROTECTED_APP = pytest.mark.parametrize("app", [EXTENSIONS_APP], indirect=True)
PUBLIC_ASSETS_APP = pytest.mark.parametrize(
    "app",
    [{**EXTENSIONS_APP, "EMBEDDED_EXTENSION_ASSETS_PUBLIC": True}],
    indirect=True,
)


@pytest.fixture
def extension(mocker: MockerFixture) -> LoadedExtension:
    loaded = LoadedExtension(
        id="acme.widgets",
        name="widgets",
        manifest=Manifest(
            publisher="acme",
            name="widgets",
            displayName="Acme Widgets",
            version="1.0.0",
            frontend=ManifestFrontend(
                remoteEntry="remoteEntry.abc123.js",
                moduleFederationName="acme_widgets",
            ),
        ),
        frontend={"remoteEntry.abc123.js": b"window.acme_widgets = {};"},
        backend={},
        version="1.0.0",
        source_base_path="extensions/acme",
    )
    mocker.patch(
        "superset.extensions.api.get_extensions",
        return_value={loaded.id: loaded},
    )
    return loaded


@PROTECTED_APP
def test_frontend_chunk_needs_auth_by_default(
    client: Any,
    extension: LoadedExtension,
) -> None:
    response = client.get("/api/v1/extensions/acme/widgets/remoteEntry.abc123.js")

    assert response.status_code == 401


@PUBLIC_ASSETS_APP
def test_frontend_chunk_is_served_when_assets_are_public(
    client: Any,
    extension: LoadedExtension,
) -> None:
    response = client.get("/api/v1/extensions/acme/widgets/remoteEntry.abc123.js")

    assert response.status_code == 200
    assert response.data == b"window.acme_widgets = {};"


@PUBLIC_ASSETS_APP
def test_extension_metadata_is_served_when_assets_are_public(
    client: Any,
    extension: LoadedExtension,
) -> None:
    response = client.get("/api/v1/extensions/acme/widgets")

    assert response.status_code == 200
    result = response.get_json()["result"]
    assert result["moduleFederationName"] == "acme_widgets"
    assert (
        result["remoteEntry"] == "/api/v1/extensions/acme/widgets/remoteEntry.abc123.js"
    )


@PUBLIC_ASSETS_APP
def test_unknown_chunk_is_404_when_assets_are_public(
    client: Any,
    extension: LoadedExtension,
) -> None:
    response = client.get("/api/v1/extensions/acme/widgets/missing.js")

    assert response.status_code == 404


@PUBLIC_ASSETS_APP
def test_listing_every_extension_still_needs_auth(
    client: Any,
    extension: LoadedExtension,
) -> None:
    # Publishing the bundles does not publish the inventory of what a
    # deployment has installed.
    response = client.get("/api/v1/extensions/")

    assert response.status_code == 401
