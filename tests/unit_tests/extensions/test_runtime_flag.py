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

"""Extensions availability combines the startup load with a per-request flag.

Each test module builds its app once, so the startup decision is fixed per
``app`` parameter while the per-request decision is patched per test.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from flask import current_app

from superset.extensions import appbuilder
from superset.extensions.availability import (
    are_extensions_loaded,
    EXTENSIONS_LOADED_KEY,
    ExtensionsStatus,
    get_extensions_status,
    NOT_LOADED_MESSAGE,
)

BOOT_ON = {"FEATURE_FLAGS": {"ENABLE_EXTENSIONS": True}}
BOOT_OFF = {"FEATURE_FLAGS": {"ENABLE_EXTENSIONS": False}}

INFO = "/api/v1/extensions/_info"
LIST = "/api/v1/extensions/"
DETAIL = "/api/v1/extensions/acme/demo"
CHUNK = "/api/v1/extensions/acme/demo/remoteEntry.js"
STORAGE = "/api/v1/extensions/acme/demo/storage/persistent/key"
EXTENSION_ROUTES = [INFO, LIST, DETAIL, CHUNK, STORAGE]


@contextmanager
def request_flag(enabled: bool) -> Iterator[None]:
    """Make the per-request feature decision for ``ENABLE_EXTENSIONS``."""
    with patch(
        "superset.feature_flag_manager.is_feature_enabled",
        side_effect=lambda feature: enabled and feature == "ENABLE_EXTENSIONS",
    ):
        yield


@pytest.fixture
def bundles() -> Iterator[MagicMock]:
    """Bundles present on disk, whether or not this server loaded them."""
    extension: MagicMock = MagicMock()
    extension.frontend = {"remoteEntry.js": b"export default 1;"}
    with (
        patch(
            "superset.extensions.api.get_extensions",
            return_value={"acme.demo": extension},
        ) as get_extensions,
        patch(
            "superset.extensions.api.build_extension_data",
            return_value={"id": "acme.demo", "remoteEntry": "remoteEntry.js"},
        ),
        patch(
            "superset.extensions.storage.utils.get_extensions",
            new=get_extensions,
        ),
    ):
        yield get_extensions


def _extensions_menu_visible() -> bool:
    """Evaluate the Extensions menu entry's condition as a request would."""
    for category in appbuilder.menu.get_list():
        for child in category.childs or []:
            if child.name == "Extensions":
                return bool(child.cond is None or child.cond())
    return False


def _registered_view(name: str) -> Any:
    return next(view for view in appbuilder.baseviews if type(view).__name__ == name)


# ── Boot on ──────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("app", [BOOT_ON], indirect=True)
def test_boot_on_request_on_serves_bundles(
    client: Any, full_api_access: None, bundles: MagicMock
) -> None:
    """The normal path: loaded at startup and enabled for this request."""
    assert are_extensions_loaded()
    with request_flag(True):
        assert _extensions_menu_visible()
        assert get_extensions_status() is ExtensionsStatus.LOADED
        info = client.get(INFO)
        listing = client.get(LIST)
        detail = client.get(DETAIL)
        chunk = client.get(CHUNK)

    assert info.status_code == 200
    assert info.json == {"permissions": ["can_read"], "status": "loaded"}
    assert listing.status_code == 200
    assert listing.json["count"] == 1
    assert listing.json["status"] == "loaded"
    assert detail.status_code == 200
    assert chunk.status_code == 200
    assert chunk.data == b"export default 1;"


@pytest.mark.parametrize("app", [BOOT_ON], indirect=True)
@pytest.mark.parametrize("route", EXTENSION_ROUTES)
def test_boot_on_request_off_hides_every_route(
    client: Any, full_api_access: None, bundles: MagicMock, route: str
) -> None:
    """A workspace without the flag never sees the deployment's extensions."""
    with request_flag(False):
        assert not _extensions_menu_visible()
        response = client.get(route)
    assert response.status_code == 404
    assert response.json == {"message": "Not found"}
    bundles.assert_not_called()


@pytest.mark.parametrize("app", [BOOT_ON], indirect=True)
def test_boot_on_runtime_flips_follow_each_request(
    client: Any, full_api_access: None, bundles: MagicMock
) -> None:
    """Flipping the flag needs no restart when extensions loaded at startup."""
    for enabled, expected in [(True, 200), (False, 404), (True, 200)]:
        with request_flag(enabled):
            assert _extensions_menu_visible() is enabled
            assert client.get(LIST).status_code == expected


# ── Boot off ─────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("app", [BOOT_OFF], indirect=True)
def test_boot_off_request_on_reports_not_loaded(
    client: Any, full_api_access: None, bundles: MagicMock
) -> None:
    """The menu and API agree, and no bundle reaches the browser."""
    assert not are_extensions_loaded()
    with request_flag(True):
        assert _extensions_menu_visible()
        assert get_extensions_status() is ExtensionsStatus.NOT_LOADED
        info = client.get(INFO)
        listing = client.get(LIST)
        detail = client.get(DETAIL)
        chunk = client.get(CHUNK)
        storage = client.get(STORAGE)

    assert info.status_code == 200
    assert info.json == {
        "permissions": ["can_read"],
        "status": "not_loaded",
        "message": NOT_LOADED_MESSAGE,
    }
    assert listing.status_code == 200
    assert listing.json == {
        "result": [],
        "count": 0,
        "status": "not_loaded",
        "message": NOT_LOADED_MESSAGE,
    }
    assert detail.status_code == 404
    assert detail.json == {"message": NOT_LOADED_MESSAGE}
    assert chunk.status_code == 404
    assert storage.status_code == 404
    bundles.assert_not_called()


@pytest.mark.parametrize("app", [BOOT_OFF], indirect=True)
@pytest.mark.parametrize("route", EXTENSION_ROUTES)
def test_boot_off_request_off_hides_every_route(
    client: Any, full_api_access: None, bundles: MagicMock, route: str
) -> None:
    """Off at startup and per request: nothing is exposed."""
    with request_flag(False):
        assert not _extensions_menu_visible()
        response = client.get(route)
    assert response.status_code == 404
    bundles.assert_not_called()


@pytest.mark.parametrize("app", [BOOT_OFF], indirect=True)
def test_boot_off_runtime_flips_never_load(
    client: Any, full_api_access: None, bundles: MagicMock
) -> None:
    """Turning the flag on later reports the restart instead of loading code."""
    for enabled, expected in [(True, 200), (False, 404), (True, 200)]:
        with request_flag(enabled):
            assert _extensions_menu_visible() is enabled
            response = client.get(LIST)
        assert response.status_code == expected
        if enabled:
            assert response.json["result"] == []
    assert not current_app.extensions.get(EXTENSIONS_LOADED_KEY)
    bundles.assert_not_called()


@pytest.mark.parametrize("app", [BOOT_OFF], indirect=True)
def test_semantic_layer_types_surface_not_loaded(
    client: Any, full_api_access: None
) -> None:
    """Missing extension-contributed types are explained on the types endpoint."""
    with patch(
        "superset.feature_flag_manager.is_feature_enabled",
        side_effect=lambda feature: feature in {"ENABLE_EXTENSIONS", "SEMANTIC_LAYERS"},
    ):
        response = client.get("/api/v1/semantic_layer/types")
    assert response.status_code == 200
    assert response.json["extensions_status"] == "not_loaded"


# ── Permissions ──────────────────────────────────────────────────────────────


@pytest.mark.parametrize("app", [BOOT_OFF], indirect=True)
@pytest.mark.parametrize("route", EXTENSION_ROUTES)
def test_enabled_routes_still_require_authentication(client: Any, route: str) -> None:
    """The runtime guard sits in front of, not instead of, route protection."""
    with request_flag(True):
        response = client.get(route)
    assert response.status_code == 401


@pytest.mark.parametrize("app", [BOOT_OFF], indirect=True)
def test_permission_names_are_unchanged() -> None:
    """Always registering the APIs keeps their existing permission identity."""
    api: Any = _registered_view("ExtensionsRestApi")
    storage: Any = _registered_view("ExtensionStorageRestApi")
    assert (api.class_permission_name, api.resource_name) == (
        "ExtensionsRestApi",
        "extensions",
    )
    assert storage.class_permission_name == "ExtensionStorageRestApi"
    assert storage.route_base == "/api/v1/extensions"
