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
from werkzeug.test import TestResponse

from superset.extensions import appbuilder
from superset.extensions.availability import (
    are_extensions_loaded,
    EXTENSIONS_LOADED_KEY,
    ExtensionsStatus,
    get_extensions_status,
    NOT_LOADED_MESSAGE,
)

BOOT_ON: dict[str, Any] = {"FEATURE_FLAGS": {"ENABLE_EXTENSIONS": True}}
BOOT_OFF: dict[str, Any] = {"FEATURE_FLAGS": {"ENABLE_EXTENSIONS": False}}

INFO: str = "/api/v1/extensions/_info"
LIST: str = "/api/v1/extensions/"
DETAIL: str = "/api/v1/extensions/acme/demo"
CHUNK: str = "/api/v1/extensions/acme/demo/remoteEntry.js"
STORAGE: str = "/api/v1/extensions/acme/demo/storage/persistent/key"
EXTENSION_ROUTES: list[str] = [INFO, LIST, DETAIL, CHUNK, STORAGE]


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
            "superset.extensions.availability.get_extensions",
            return_value={"acme.demo": extension},
        ) as get_extensions,
        patch(
            "superset.extensions.api.build_extension_data",
            return_value={"id": "acme.demo", "remoteEntry": "remoteEntry.js"},
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
        info: TestResponse = client.get(INFO)
        listing: TestResponse = client.get(LIST)
        detail: TestResponse = client.get(DETAIL)
        chunk: TestResponse = client.get(CHUNK)

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
        response: TestResponse = client.get(route)
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


@contextmanager
def semantic_request(extensions: bool) -> Iterator[None]:
    """Semantic layers on, with the given per-request extensions decision."""
    enabled: set[str] = {"SEMANTIC_LAYERS"} | (
        {"ENABLE_EXTENSIONS"} if extensions else set()
    )
    with patch(
        "superset.feature_flag_manager.is_feature_enabled",
        side_effect=lambda feature: feature in enabled,
    ):
        yield


@pytest.fixture
def semantic_types() -> Iterator[None]:
    """One host semantic-layer type and one contributed by an extension."""
    host: MagicMock = MagicMock()
    host.name, host.description = "Host", "Built in."
    contributed: MagicMock = MagicMock()
    contributed.name, contributed.description = "Contributed", "From an extension."
    with patch.dict(
        "superset.semantic_layers.api.registry",
        {"host": host, "extensions.acme.demo.layer": contributed},
        clear=True,
    ):
        yield


@pytest.mark.parametrize("app", [BOOT_ON], indirect=True)
@pytest.mark.parametrize(
    "extensions,expected_ids,expected_status",
    [
        (True, ["host", "extensions.acme.demo.layer"], "loaded"),
        (False, ["host"], "disabled"),
    ],
)
def test_boot_on_semantic_types_follow_request_flag(
    client: Any,
    full_api_access: None,
    semantic_types: None,
    extensions: bool,
    expected_ids: list[str],
    expected_status: str,
) -> None:
    """Extension-contributed types are listed only where extensions are on."""
    with semantic_request(extensions):
        response: TestResponse = client.get("/api/v1/semantic_layer/types")
    assert response.status_code == 200
    assert [item["id"] for item in response.json["result"]] == expected_ids
    assert response.json["extensions_status"] == expected_status


@pytest.mark.parametrize("app", [BOOT_ON], indirect=True)
def test_boot_on_request_off_refuses_contributed_type_schema(
    client: Any, full_api_access: None, semantic_types: None
) -> None:
    """A hidden extension type cannot be configured by naming it directly."""
    with semantic_request(False):
        response: TestResponse = client.post(
            "/api/v1/semantic_layer/schema/configuration",
            json={"type": "extensions.acme.demo.layer"},
        )
    assert response.status_code == 400
    assert response.json["message"] == "Unknown type: extensions.acme.demo.layer"


@pytest.mark.parametrize("app", [BOOT_ON], indirect=True)
def test_boot_on_request_off_refuses_contributed_type_create(
    semantic_types: None,
) -> None:
    """A hidden extension type cannot be created by naming it directly."""
    from superset.commands.semantic_layer.create import CreateSemanticLayerCommand
    from superset.commands.semantic_layer.exceptions import (
        SemanticLayerInvalidError,
    )

    with (
        patch.dict(
            "superset.commands.semantic_layer.create.registry",
            {"extensions.acme.demo.layer": MagicMock()},
            clear=True,
        ),
        semantic_request(False),
        pytest.raises(SemanticLayerInvalidError, match="Unknown type"),
    ):
        CreateSemanticLayerCommand(
            {"type": "extensions.acme.demo.layer", "name": "x", "configuration": {}}
        ).validate()


@pytest.mark.parametrize("app", [BOOT_ON], indirect=True)
def test_boot_on_request_off_refuses_contributed_type_reconfiguration(
    semantic_types: None,
) -> None:
    """An existing layer of a hidden extension type cannot be reconfigured."""
    from superset.commands.semantic_layer.exceptions import (
        SemanticLayerInvalidError,
    )
    from superset.commands.semantic_layer.update import UpdateSemanticLayerCommand

    layer: MagicMock = MagicMock(type="extensions.acme.demo.layer", configuration="{}")
    with (
        patch.dict(
            "superset.commands.semantic_layer.update.registry",
            {"extensions.acme.demo.layer": MagicMock()},
            clear=True,
        ),
        patch(
            "superset.commands.semantic_layer.update._load_modifiable_layer",
            return_value=layer,
        ),
        semantic_request(False),
        pytest.raises(SemanticLayerInvalidError, match="Unknown type"),
    ):
        UpdateSemanticLayerCommand("uuid", {"configuration": {}}).validate()


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
        info: TestResponse = client.get(INFO)
        listing: TestResponse = client.get(LIST)
        detail: TestResponse = client.get(DETAIL)
        chunk: TestResponse = client.get(CHUNK)
        storage: TestResponse = client.get(STORAGE)

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
        response: TestResponse = client.get(route)
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
            response: TestResponse = client.get(LIST)
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
        response: TestResponse = client.get("/api/v1/semantic_layer/types")
    assert response.status_code == 200
    assert response.json["extensions_status"] == "not_loaded"


# ── Permissions ──────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "app",
    [{**BOOT_ON, "WTF_CSRF_ENABLED": True}],
    indirect=True,
)
def test_storage_writes_require_csrf_token(client: Any, full_api_access: None) -> None:
    """The extensions APIs keep CSRF protection; FAB's BaseApi exempts by default."""
    from superset.extensions import csrf

    exempt: set[str] = {blueprint.name for blueprint in csrf._exempt_blueprints}
    assert {"ExtensionsRestApi", "ExtensionStorageRestApi"}.isdisjoint(exempt)
    with request_flag(True):
        response: TestResponse = client.put(STORAGE, json={"value": 1})
    assert response.status_code == 400


@pytest.mark.parametrize("app", [BOOT_OFF], indirect=True)
@pytest.mark.parametrize("route", EXTENSION_ROUTES)
def test_enabled_routes_still_require_authentication(client: Any, route: str) -> None:
    """The runtime guard sits in front of, not instead of, route protection."""
    with request_flag(True):
        response: TestResponse = client.get(route)
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
    assert set(api.base_permissions) == {
        "can_content",
        "can_get",
        "can_get_list",
        "can_info",
    }
    assert set(storage.base_permissions) == {
        "can_delete_ephemeral",
        "can_delete_persistent",
        "can_get_ephemeral",
        "can_get_persistent",
        "can_list_persistent",
        "can_set_ephemeral",
        "can_set_persistent",
    }
