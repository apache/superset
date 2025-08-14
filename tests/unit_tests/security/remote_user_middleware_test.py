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
"""Tests for the RemoteUserMiddleware."""

from __future__ import annotations

from flask import request
import pytest
from flask_appbuilder.security.manager import AUTH_REMOTE_USER

from superset.app import SupersetApp


@pytest.mark.parametrize(
    "app",
    [
        {
            "AUTH_TYPE": AUTH_REMOTE_USER,
            "AUTH_REMOTE_USER_HEADER": "X-Forwarded-User",
        }
    ],
    indirect=True,
)
def test_remote_user_header_copied(app: SupersetApp) -> None:
    @app.route("/who")
    def who() -> str:  # pragma: no cover
        return request.environ.get("REMOTE_USER", "")

    client = app.test_client()
    resp = client.get("/who", headers={"X-Forwarded-User": "alice"})
    assert resp.data == b"alice"
