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
"""Rate limiting of the password recovery endpoints.

Kept apart from ``test_password_recovery.py`` because Flask-Limiter reads
``RATELIMIT_ENABLED`` when the app is built, so it needs its own app.
"""

from __future__ import annotations

from typing import Any

import pytest
from flask_appbuilder.security.manager import AUTH_DB

from superset.daos.key_value import KeyValueDAO
from superset.key_value.types import KeyValueResource

APP_CONFIG = {
    "AUTH_TYPE": AUTH_DB,
    "RATELIMIT_ENABLED": True,
    "AUTH_PASSWORD_RECOVERY": {
        "enabled": True,
        "base_url": "https://superset.example.org/",
        "rate_limit": "2 per minute",
    },
}


@pytest.mark.parametrize("app", [APP_CONFIG], indirect=True)
def test_request_endpoint_is_rate_limited_per_client(app: Any) -> None:
    client = app.test_client()
    statuses = [
        client.post(
            "/api/v1/security/password_recovery/",
            json={"email": f"nobody{i}@example.org"},
        ).status_code
        for i in range(3)
    ]
    assert statuses == [200, 200, 429]

    KeyValueDAO.delete_expired_entries(KeyValueResource.PASSWORD_RECOVERY_THROTTLE)


@pytest.mark.parametrize("app", [APP_CONFIG], indirect=True)
def test_reset_endpoint_is_rate_limited_per_client(app: Any) -> None:
    client = app.test_client()
    statuses = [
        client.post(
            "/api/v1/security/password_recovery/reset/",
            json={"token": f"guess-{i}", "password": "Some-Guess-Passw0rd!"},
        ).status_code
        for i in range(3)
    ]
    # Each route has its own budget: the request endpoint's three calls above
    # must not count here, so an invalid token is still answered twice.
    assert statuses == [400, 400, 429]
