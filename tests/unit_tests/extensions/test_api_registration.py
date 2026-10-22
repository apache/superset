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

import pytest
from werkzeug.test import TestResponse

BOOT_ON: dict[str, Any] = {"FEATURE_FLAGS": {"ENABLE_EXTENSIONS": True}}
BOOT_OFF: dict[str, Any] = {"FEATURE_FLAGS": {"ENABLE_EXTENSIONS": False}}

INFO: str = "/api/v1/extensions/_info"
STORAGE: str = "/api/v1/extensions/acme/demo/storage/persistent/key"


@pytest.mark.parametrize(
    "app",
    [{**BOOT_ON, "WTF_CSRF_ENABLED": True}],
    indirect=True,
)
def test_extension_apis_keep_csrf_protection(
    client: Any, full_api_access: None
) -> None:
    """FAB's BaseApi exempts its blueprint from CSRF; the extensions APIs opt
    back in, so a cookie-authenticated storage write without a token is
    rejected like any other Superset API write."""
    from superset.extensions import csrf

    exempt: set[str] = {blueprint.name for blueprint in csrf._exempt_blueprints}
    assert {"ExtensionsRestApi", "ExtensionStorageRestApi"}.isdisjoint(exempt)
    response: TestResponse = client.put(STORAGE, json={"value": 1})
    assert response.status_code == 400


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
    assert "result" in list_schema["properties"]
    assert any(path.endswith("/storage/persistent/{key}") for path in paths)


@pytest.mark.parametrize("app", [BOOT_OFF], indirect=True)
def test_apis_absent_when_flag_off_at_startup(
    client: Any, full_api_access: None
) -> None:
    """With the flag off at startup the APIs are not registered, so a browser
    that has the flag on gets a 404 here; the Extensions page explains it."""
    response: TestResponse = client.get(INFO)
    assert response.status_code == 404
