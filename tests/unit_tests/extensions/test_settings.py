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

"""Unit tests for extension settings persistence and the settings API endpoints."""

from __future__ import annotations

from typing import Any

# ---------------------------------------------------------------------------
# Settings persistence (settings.py) — sqlite-backed round-trip tests
# ---------------------------------------------------------------------------


class TestGetExtensionSettings:
    def test_returns_defaults_when_no_rows(self, app_context: Any) -> None:
        from superset.extensions.settings import get_extension_settings

        result = get_extension_settings()
        assert result["active_chatbot_id"] is None
        assert result["enabled"] == {}

    def test_round_trips_active_chatbot_id(self, app_context: Any) -> None:
        from superset.extensions.settings import (
            get_extension_settings,
            update_extension_settings,
        )

        update_extension_settings({"active_chatbot_id": "acme.chatbot"})
        result = get_extension_settings()
        assert result["active_chatbot_id"] == "acme.chatbot"

    def test_round_trips_enabled_flags(self, app_context: Any) -> None:
        from superset.extensions.settings import (
            get_extension_settings,
            update_extension_settings,
        )

        update_extension_settings(
            {"enabled": {"acme.chatbot": True, "acme.widget": False}}
        )
        result = get_extension_settings()
        assert result["enabled"]["acme.chatbot"] is True
        assert result["enabled"]["acme.widget"] is False


class TestUpdateExtensionSettings:
    def test_empty_string_active_chatbot_id_stored_as_none(
        self, app_context: Any
    ) -> None:
        from superset.extensions.settings import (
            get_extension_settings,
            update_extension_settings,
        )

        # First set a value, then clear it via empty string.
        update_extension_settings({"active_chatbot_id": "acme.chatbot"})
        update_extension_settings({"active_chatbot_id": ""})
        assert get_extension_settings()["active_chatbot_id"] is None

    def test_non_bool_enabled_value_is_skipped(self, app_context: Any) -> None:
        from superset.extensions.settings import (
            get_extension_settings,
            update_extension_settings,
        )

        update_extension_settings({"enabled": {"acme.chatbot": "yes"}})
        # "yes" is not a bool — the row should not have been written.
        result = get_extension_settings()
        assert "acme.chatbot" not in result["enabled"]

    def test_upsert_overwrites_existing_chatbot(self, app_context: Any) -> None:
        from superset.extensions.settings import (
            get_extension_settings,
            update_extension_settings,
        )

        update_extension_settings({"active_chatbot_id": "acme.chatbot"})
        update_extension_settings({"active_chatbot_id": "vendor.bot"})
        assert get_extension_settings()["active_chatbot_id"] == "vendor.bot"

    def test_upsert_overwrites_existing_enabled_flag(self, app_context: Any) -> None:
        from superset.extensions.settings import (
            get_extension_settings,
            update_extension_settings,
        )

        update_extension_settings({"enabled": {"acme.chatbot": True}})
        update_extension_settings({"enabled": {"acme.chatbot": False}})
        assert get_extension_settings()["enabled"]["acme.chatbot"] is False

    def test_partial_update_leaves_other_keys_intact(self, app_context: Any) -> None:
        from superset.extensions.settings import (
            get_extension_settings,
            update_extension_settings,
        )

        update_extension_settings(
            {"active_chatbot_id": "acme.chatbot", "enabled": {"acme.widget": True}}
        )
        # Update only enabled — active_chatbot_id must survive.
        update_extension_settings({"enabled": {"acme.widget": False}})
        result = get_extension_settings()
        assert result["active_chatbot_id"] == "acme.chatbot"
        assert result["enabled"]["acme.widget"] is False

    def test_returns_current_state(self, app_context: Any) -> None:
        from superset.extensions.settings import update_extension_settings

        result = update_extension_settings({"active_chatbot_id": "acme.chatbot"})
        assert result["active_chatbot_id"] == "acme.chatbot"


# ---------------------------------------------------------------------------
# GET /api/v1/extensions/settings
# ---------------------------------------------------------------------------


class TestGetSettingsEndpoint:
    def test_authenticated_user_can_read(
        self, client: Any, full_api_access: None, mocker: Any
    ) -> None:
        mocker.patch(
            "superset.extensions.api.get_extension_settings",
            return_value={"active_chatbot_id": None, "enabled": {}},
        )
        resp = client.get("/api/v1/extensions/settings")
        assert resp.status_code == 200
        assert resp.json["result"]["active_chatbot_id"] is None

    def test_returns_active_chatbot_and_enabled_map(
        self, client: Any, full_api_access: None, mocker: Any
    ) -> None:
        mocker.patch(
            "superset.extensions.api.get_extension_settings",
            return_value={
                "active_chatbot_id": "acme.chatbot",
                "enabled": {"acme.chatbot": True},
            },
        )
        resp = client.get("/api/v1/extensions/settings")
        assert resp.status_code == 200
        assert resp.json["result"]["active_chatbot_id"] == "acme.chatbot"
        assert resp.json["result"]["enabled"]["acme.chatbot"] is True


# ---------------------------------------------------------------------------
# PUT /api/v1/extensions/settings
# ---------------------------------------------------------------------------


class TestPutSettingsEndpoint:
    def test_non_admin_rejected(
        self, client: Any, full_api_access: None, mocker: Any
    ) -> None:
        mocker.patch(
            "superset.extensions.api.security_manager.is_admin", return_value=False
        )
        resp = client.put(
            "/api/v1/extensions/settings",
            json={"active_chatbot_id": "acme.chatbot"},
        )
        assert resp.status_code == 403

    def test_admin_can_update_active_chatbot(
        self, client: Any, full_api_access: None, mocker: Any
    ) -> None:
        mocker.patch(
            "superset.extensions.api.security_manager.is_admin", return_value=True
        )
        mocker.patch(
            "superset.extensions.api.update_extension_settings",
            return_value={"active_chatbot_id": "acme.chatbot", "enabled": {}},
        )
        resp = client.put(
            "/api/v1/extensions/settings",
            json={"active_chatbot_id": "acme.chatbot"},
        )
        assert resp.status_code == 200
        assert resp.json["result"]["active_chatbot_id"] == "acme.chatbot"

    def test_empty_body_is_accepted(
        self, client: Any, full_api_access: None, mocker: Any
    ) -> None:
        mocker.patch(
            "superset.extensions.api.security_manager.is_admin", return_value=True
        )
        mocker.patch(
            "superset.extensions.api.update_extension_settings",
            return_value={"active_chatbot_id": None, "enabled": {}},
        )
        resp = client.put("/api/v1/extensions/settings", json={})
        assert resp.status_code == 200
