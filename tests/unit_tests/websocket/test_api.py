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
from typing import Any

import jwt
import pytest
from pytest_mock import MockerFixture

from superset.websocket.permissions import (
    REALTIME_NOTIFICATION_JWT_AUDIENCE,
    REALTIME_NOTIFICATION_JWT_ISSUER,
)

SECRET = "x" * 40

WEBSOCKET_APP_CONFIG = {
    "WEBSOCKET_ENABLE": True,
    "WEBSOCKET_JWT_SECRET": SECRET,
    "WEBSOCKET_JWT_EXPIRATION_SECONDS": 120,
}


@pytest.mark.parametrize("app", [WEBSOCKET_APP_CONFIG], indirect=True)
def test_token_endpoint_requires_a_session(client: Any) -> None:
    assert client.get("/api/v1/realtime/token/").status_code == 401


@pytest.mark.parametrize("app", [WEBSOCKET_APP_CONFIG], indirect=True)
def test_token_endpoint_returns_a_ticket_for_the_principal(
    client: Any, full_api_access: None, mocker: MockerFixture
) -> None:
    mocker.patch(
        "superset.websocket.api.get_realtime_principal",
        return_value={"channel": "user:7", "principal_type": "user", "sub": "7"},
    )

    response = client.get("/api/v1/realtime/token/")

    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store, private"
    body = response.json
    assert body["expires_in"] == 120
    claims = jwt.decode(
        body["token"],
        SECRET,
        algorithms=["HS256"],
        audience=REALTIME_NOTIFICATION_JWT_AUDIENCE,
        issuer=REALTIME_NOTIFICATION_JWT_ISSUER,
    )
    assert claims["channel"] == "user:7"
    assert claims["exp"] - claims["iat"] == 120


@pytest.mark.parametrize("app", [WEBSOCKET_APP_CONFIG], indirect=True)
def test_token_endpoint_rejects_a_principal_without_a_channel(
    client: Any, full_api_access: None, mocker: MockerFixture
) -> None:
    mocker.patch("superset.websocket.api.get_realtime_principal", return_value=None)

    assert client.get("/api/v1/realtime/token/").status_code == 401


@pytest.mark.parametrize("app", [WEBSOCKET_APP_CONFIG], indirect=True)
def test_token_endpoint_requires_the_realtime_permission(
    client: Any, mocker: MockerFixture
) -> None:
    from superset import security_manager

    mocker.patch(
        "flask_appbuilder.security.decorators.verify_jwt_in_request",
        return_value=True,
    )
    mocker.patch.object(security_manager, "is_item_public", return_value=False)
    mocker.patch.object(security_manager, "has_access", return_value=False)

    assert client.get("/api/v1/realtime/token/").status_code == 403
