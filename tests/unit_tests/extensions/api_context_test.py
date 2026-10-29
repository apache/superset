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

from secrets import token_hex
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from flask import Flask, g
from flask_appbuilder.api import BaseApi, expose, protect
from flask_appbuilder.security.sqla.manager import SecurityManager
from flask_jwt_extended import create_access_token, JWTManager
from pytest_mock import MockerFixture

from superset.core.api.core_api_injection import _contextualize_extension_api
from superset.extensions.context import get_context, get_current_extension_context
from tests.unit_tests.extensions.storage.conftest import create_manifest


def test_extension_api_methods_run_in_extension_context() -> None:
    manifest = MagicMock()

    class TestApi:
        @expose("/callback", methods=("GET",))
        def callback(self) -> str:
            return "ok"

        def helper(self) -> str:
            return "helper"

    original_helper = TestApi.helper
    with (
        patch(
            "superset.core.api.core_api_injection.extension_context"
        ) as extension_context,
        patch(
            "superset.core.api.core_api_injection.get_user_id",
            return_value=42,
        ) as user_id_resolver,
    ):
        _contextualize_extension_api(TestApi, manifest)

        assert TestApi().callback() == "ok"
        user_id_resolver.assert_not_called()

    extension_context.assert_called_once_with(manifest, user_id=user_id_resolver)
    assert TestApi.helper is original_helper
    assert TestApi.callback._urls == [("/callback", ("GET",))]


@pytest.mark.parametrize("authentication", ["jwt", "api_key", "unauthenticated"])
def test_extension_api_resolves_principal_after_protect(
    mocker: MockerFixture, authentication: str
) -> None:
    """FAB authentication must finish before context and secrets resolve the user."""
    app = Flask(__name__)
    app.config["JWT_SECRET_KEY"] = token_hex(32)
    app.config["FAB_API_KEY_ENABLED"] = authentication == "api_key"
    jwt = JWTManager(app)
    user = SimpleNamespace(id=42, is_active=True)
    manager = MagicMock()
    manager.is_item_public.return_value = False
    manager.has_access.return_value = True
    manager.load_user.return_value = user
    jwt.user_lookup_loader(
        lambda headers, data: SecurityManager.load_user_jwt(manager, headers, data)
    )

    def authenticate_api_key(key: str) -> SimpleNamespace:
        assert key == "personal-api-key"
        assert get_context().user_id is None
        g.user = user
        return user

    manager.extract_api_key_from_request.return_value = "personal-api-key"
    manager.validate_api_key.side_effect = authenticate_api_key
    mocker.patch.object(app, "appbuilder", MagicMock(sm=manager), create=True)
    manifest = create_manifest("acme", "semantic")
    get_secret = mocker.patch(
        "superset.extensions.storage.secrets.ExtensionStorageDAO.get_decoded_value",
        return_value="personal-token",
    )

    class TestApi(BaseApi):
        class_permission_name = "ExtensionCallback"
        base_permissions = ["can_callback"]
        allow_browser_login = False

        @expose("/callback", methods=("GET",))
        @protect()
        def callback(self) -> dict[str, int | None]:
            assert get_context().storage.secrets.get("token") == "personal-token"
            return {"user_id": get_context().user_id}

    _contextualize_extension_api(TestApi, manifest)
    app.add_url_rule("/callback", view_func=TestApi().callback)
    headers = {}
    if authentication == "jwt":
        with app.app_context():
            headers["Authorization"] = f"Bearer {create_access_token(identity='42')}"
    response = app.test_client().get("/callback", headers=headers)
    if authentication == "unauthenticated":
        assert response.status_code == 401
        get_secret.assert_not_called()
    else:
        from superset_core.extensions.storage.models import StorageAccess

        assert response.status_code == 200
        assert response.json == {"user_id": 42}
        get_secret.assert_called_once_with(
            "acme.semantic", "token", user_fk=42, access=StorageAccess.BACKEND
        )
    assert get_current_extension_context() is None
