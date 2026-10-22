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
"""How the extensions APIs are registered and protected."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest
from flask import g
from flask_appbuilder.security.sqla.models import User
from flask_jwt_extended import create_access_token
from pytest_mock import MockerFixture
from werkzeug.test import TestResponse

from superset import security_manager

BOOT_ON: dict[str, Any] = {"FEATURE_FLAGS": {"ENABLE_EXTENSIONS": True}}
BOOT_OFF: dict[str, Any] = {"FEATURE_FLAGS": {"ENABLE_EXTENSIONS": False}}

INFO: str = "/api/v1/extensions/_info"
STORAGE: str = "/api/v1/extensions/acme/demo/storage/persistent/key"


def _writer(app: Any, mocker: MockerFixture, auth: str) -> tuple[Any, dict[str, str]]:
    """A test client authenticated as user 1 through ``auth``: a login
    session cookie, a JWT bearer token or an API key."""
    user: User = User(
        id=1, username="writer", first_name="W", last_name="R", active=True
    )
    mocker.patch.object(security_manager, "is_item_public", return_value=False)
    mocker.patch.object(
        security_manager,
        "has_access",
        side_effect=lambda *_: getattr(g.get("user"), "id", None) == 1,
    )
    mocker.patch.object(security_manager, "get_user_by_id", return_value=user)
    client: Any = app.test_client()
    if auth == "session":
        mocker.patch.object(app.login_manager, "_user_callback", return_value=user)
        with client.session_transaction() as session:
            session["_user_id"] = str(user.id)
        return client, {}
    if auth == "jwt":
        with app.app_context():
            return client, {"Authorization": f"Bearer {create_access_token('1')}"}

    def validate(_key: str) -> User:
        g.user = user
        return user

    mocker.patch.object(security_manager, "validate_api_key", side_effect=validate)
    return client, {"Authorization": "Bearer sst_test_key"}


@pytest.mark.parametrize(
    "app",
    [{**BOOT_ON, "WTF_CSRF_ENABLED": True, "FAB_API_KEY_ENABLED": True}],
    indirect=True,
)
@pytest.mark.parametrize("auth", ["session", "jwt", "api_key"])
@pytest.mark.parametrize(
    ("method", "dao_method"),
    [("put", "set"), ("delete", "delete_by_key")],
)
def test_storage_writes_require_csrf_token_for_every_credential(
    app: Any, mocker: MockerFixture, auth: str, method: str, dao_method: str
) -> None:
    """FAB's BaseApi exempts its blueprint from CSRF; the extensions APIs opt
    back in, so they behave like every other Superset REST API: a write
    without a CSRF token is rejected before it reaches storage, whatever the
    credential, and a token fetched from ``/api/v1/security/csrf_token/`` and
    sent with that call's session cookie is accepted."""
    from superset.extensions import csrf

    exempt: set[str] = {blueprint.name for blueprint in csrf._exempt_blueprints}
    assert {"ExtensionsRestApi", "ExtensionStorageRestApi"}.isdisjoint(exempt)

    mocker.patch(
        "superset.extensions.storage.api.get_extension_or_404",
        return_value=object(),
    )
    dao: MagicMock = mocker.patch(
        f"superset.extensions.storage.api.ExtensionStorageDAO.{dao_method}"
    )
    client, headers = _writer(app, mocker, auth)
    write = getattr(client, method)
    # A JSON request gets the 400 CSRF_ERROR body; a non-JSON one is
    # redirected to the login page instead.
    body: dict[str, Any] = (
        {"json": {"value": 1}}
        if method == "put"
        else {"content_type": "application/json"}
    )

    rejected: TestResponse = write(STORAGE, headers=headers, **body)
    assert rejected.status_code == 400
    assert "CSRF" in rejected.get_data(as_text=True)
    dao.assert_not_called()

    token: TestResponse = client.get("/api/v1/security/csrf_token/", headers=headers)
    assert token.status_code == 200
    accepted: TestResponse = write(
        STORAGE,
        headers={**headers, "X-CSRFToken": token.json["result"]},
        **body,
    )
    assert accepted.status_code == 200, accepted.get_data(as_text=True)
    dao.assert_called_once()


@pytest.mark.parametrize(
    "app",
    [{**BOOT_ON, "FAB_API_SWAGGER_UI": True}],
    indirect=True,
)
def test_openapi_spec_includes_extension_apis(
    client: Any, full_api_access: None
) -> None:
    """The spec round-trips with both extensions APIs registered, and the list
    endpoint publishes its response schema."""
    response: TestResponse = client.get("/api/v1/_openapi")
    assert response.status_code == 200
    paths: dict[str, Any] = response.json["paths"]
    list_schema: dict[str, Any] = paths["/api/v1/extensions/"]["get"]["responses"][
        "200"
    ]["content"]["application/json"]["schema"]
    assert list_schema["properties"]["result"]["type"] == "array"
    detail_schema: dict[str, Any] = paths["/api/v1/extensions/{publisher}/{name}"][
        "get"
    ]["responses"]["200"]["content"]["application/json"]["schema"]
    assert detail_schema["properties"]["result"]["type"] == "object"
    chunk_content: dict[str, Any] = paths[
        "/api/v1/extensions/{publisher}/{name}/{file}"
    ]["get"]["responses"]["200"]["content"]
    assert "application/json" not in chunk_content
    assert chunk_content["application/octet-stream"]["schema"]["format"] == "binary"
    assert any(path.endswith("/storage/persistent/{key}") for path in paths)


@pytest.mark.parametrize("app", [BOOT_OFF], indirect=True)
def test_apis_absent_when_flag_off_at_startup(
    client: Any, full_api_access: None
) -> None:
    """With the flag off at startup the APIs are not registered, so a browser
    that has the flag on gets a 404 here; the Extensions page explains it."""
    response: TestResponse = client.get(INFO)
    assert response.status_code == 404
