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

"""Unit tests for extension settings persistence and the settings API endpoint.

Persistence is exercised through the public Command + DAO layer:
``GetExtensionSettingsCommand`` and ``ExtensionSettingsDAO``.
"""

from __future__ import annotations

from typing import Any

import pytest

# ---------------------------------------------------------------------------
# Settings persistence (Command + DAO) — sqlite-backed round-trip tests
# ---------------------------------------------------------------------------


class TestGetExtensionSettings:
    def test_returns_defaults_when_no_rows(self, app_context: Any) -> None:
        from superset.commands.extension.settings.get import (
            GetExtensionSettingsCommand,
        )

        result = GetExtensionSettingsCommand().run()
        assert result["active_chatbot_id"] is None


# ---------------------------------------------------------------------------
# GET /api/v1/extensions/settings
# ---------------------------------------------------------------------------

# The settings routes are only registered when ENABLE_EXTENSIONS is on at
# app-init time, so the endpoint tests parametrize the app fixture to enable it
# (otherwise the route is absent and requests 404).
_ENABLE_EXTENSIONS = [{"FEATURE_FLAGS": {"ENABLE_EXTENSIONS": True}}]


@pytest.mark.parametrize("app", _ENABLE_EXTENSIONS, indirect=True)
class TestGetSettingsEndpoint:
    def test_authenticated_user_can_read(
        self, client: Any, full_api_access: None, mocker: Any
    ) -> None:
        mocker.patch(
            "superset.extensions.api.GetExtensionSettingsCommand.run",
            return_value={"active_chatbot_id": None},
        )
        resp = client.get("/api/v1/extensions/settings")
        assert resp.status_code == 200
        assert resp.json["result"]["active_chatbot_id"] is None

    def test_returns_active_chatbot_id(
        self, client: Any, full_api_access: None, mocker: Any
    ) -> None:
        mocker.patch(
            "superset.extensions.api.GetExtensionSettingsCommand.run",
            return_value={"active_chatbot_id": "acme.chatbot"},
        )
        resp = client.get("/api/v1/extensions/settings")
        assert resp.status_code == 200
        assert resp.json["result"]["active_chatbot_id"] == "acme.chatbot"
