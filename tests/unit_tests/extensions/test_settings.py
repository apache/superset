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

"""Unit tests for extension settings persistence and the settings API endpoints.

Persistence is exercised through the public Command + DAO layer:
``UpdateExtensionSettingsCommand`` / ``GetExtensionSettingsCommand`` and the
``ExtensionSettingsDAO`` / ``ExtensionEnabledDAO`` they delegate to.
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
        assert result["enabled"] == {}

    def test_round_trips_active_chatbot_id(self, app_context: Any) -> None:
        from superset.commands.extension.settings.get import (
            GetExtensionSettingsCommand,
        )
        from superset.commands.extension.settings.update import (
            UpdateExtensionSettingsCommand,
        )

        UpdateExtensionSettingsCommand({"active_chatbot_id": "acme.chatbot"}).run()
        result = GetExtensionSettingsCommand().run()
        assert result["active_chatbot_id"] == "acme.chatbot"

    def test_round_trips_enabled_flags(self, app_context: Any) -> None:
        from superset.commands.extension.settings.get import (
            GetExtensionSettingsCommand,
        )
        from superset.commands.extension.settings.update import (
            UpdateExtensionSettingsCommand,
        )

        UpdateExtensionSettingsCommand(
            {"enabled": {"acme.chatbot": True, "acme.widget": False}}
        ).run()
        result = GetExtensionSettingsCommand().run()
        assert result["enabled"]["acme.chatbot"] is True
        assert result["enabled"]["acme.widget"] is False


class TestUpdateExtensionSettings:
    def test_empty_string_active_chatbot_id_stored_as_none(
        self, app_context: Any
    ) -> None:
        from superset.commands.extension.settings.get import (
            GetExtensionSettingsCommand,
        )
        from superset.commands.extension.settings.update import (
            UpdateExtensionSettingsCommand,
        )

        # First set a value, then clear it via empty string.
        UpdateExtensionSettingsCommand({"active_chatbot_id": "acme.chatbot"}).run()
        UpdateExtensionSettingsCommand({"active_chatbot_id": ""}).run()
        assert GetExtensionSettingsCommand().run()["active_chatbot_id"] is None

    def test_non_bool_enabled_value_is_skipped(self, app_context: Any) -> None:
        from superset.commands.extension.settings.get import (
            GetExtensionSettingsCommand,
        )
        from superset.commands.extension.settings.update import (
            UpdateExtensionSettingsCommand,
        )

        # Unique id so the absence assertion can't collide with rows written by
        # other tests sharing the module-scoped database.
        UpdateExtensionSettingsCommand({"enabled": {"acme.nonbool_skip": "yes"}}).run()
        # "yes" is not a bool — the row should not have been written.
        result = GetExtensionSettingsCommand().run()
        assert "acme.nonbool_skip" not in result["enabled"]

    def test_upsert_overwrites_existing_chatbot(self, app_context: Any) -> None:
        from superset.commands.extension.settings.get import (
            GetExtensionSettingsCommand,
        )
        from superset.commands.extension.settings.update import (
            UpdateExtensionSettingsCommand,
        )

        UpdateExtensionSettingsCommand({"active_chatbot_id": "acme.chatbot"}).run()
        UpdateExtensionSettingsCommand({"active_chatbot_id": "vendor.bot"}).run()
        assert GetExtensionSettingsCommand().run()["active_chatbot_id"] == "vendor.bot"

    def test_upsert_overwrites_existing_enabled_flag(self, app_context: Any) -> None:
        from superset.commands.extension.settings.get import (
            GetExtensionSettingsCommand,
        )
        from superset.commands.extension.settings.update import (
            UpdateExtensionSettingsCommand,
        )

        UpdateExtensionSettingsCommand({"enabled": {"acme.chatbot": True}}).run()
        UpdateExtensionSettingsCommand({"enabled": {"acme.chatbot": False}}).run()
        assert GetExtensionSettingsCommand().run()["enabled"]["acme.chatbot"] is False

    def test_partial_update_leaves_other_keys_intact(self, app_context: Any) -> None:
        from superset.commands.extension.settings.get import (
            GetExtensionSettingsCommand,
        )
        from superset.commands.extension.settings.update import (
            UpdateExtensionSettingsCommand,
        )

        UpdateExtensionSettingsCommand(
            {"active_chatbot_id": "acme.chatbot", "enabled": {"acme.widget": True}}
        ).run()
        # Update only enabled — active_chatbot_id must survive.
        UpdateExtensionSettingsCommand({"enabled": {"acme.widget": False}}).run()
        result = GetExtensionSettingsCommand().run()
        assert result["active_chatbot_id"] == "acme.chatbot"
        assert result["enabled"]["acme.widget"] is False

    def test_returns_current_state(self, app_context: Any) -> None:
        from superset.commands.extension.settings.update import (
            UpdateExtensionSettingsCommand,
        )

        result = UpdateExtensionSettingsCommand(
            {"active_chatbot_id": "acme.chatbot"}
        ).run()
        assert result["active_chatbot_id"] == "acme.chatbot"


class TestUpdateExtensionSettingsValidation:
    def test_non_string_active_chatbot_id_raises(self, app_context: Any) -> None:
        from superset.commands.extension.settings.exceptions import (
            ExtensionSettingsInvalidError,
        )
        from superset.commands.extension.settings.update import (
            UpdateExtensionSettingsCommand,
        )

        with pytest.raises(ExtensionSettingsInvalidError):
            UpdateExtensionSettingsCommand({"active_chatbot_id": 123}).run()

    def test_oversized_active_chatbot_id_raises(self, app_context: Any) -> None:
        from superset.commands.extension.settings.exceptions import (
            ExtensionSettingsInvalidError,
        )
        from superset.commands.extension.settings.update import (
            UpdateExtensionSettingsCommand,
        )
        from superset.extensions.models import EXTENSION_ID_MAX_LENGTH

        with pytest.raises(ExtensionSettingsInvalidError):
            UpdateExtensionSettingsCommand(
                {"active_chatbot_id": "x" * (EXTENSION_ID_MAX_LENGTH + 1)}
            ).run()

    def test_oversized_enabled_key_raises(self, app_context: Any) -> None:
        from superset.commands.extension.settings.exceptions import (
            ExtensionSettingsInvalidError,
        )
        from superset.commands.extension.settings.update import (
            UpdateExtensionSettingsCommand,
        )
        from superset.extensions.models import EXTENSION_ID_MAX_LENGTH

        with pytest.raises(ExtensionSettingsInvalidError):
            UpdateExtensionSettingsCommand(
                {"enabled": {"x" * (EXTENSION_ID_MAX_LENGTH + 1): True}}
            ).run()

    def test_null_active_chatbot_id_is_valid(self, app_context: Any) -> None:
        from superset.commands.extension.settings.update import (
            UpdateExtensionSettingsCommand,
        )

        # Should not raise.
        UpdateExtensionSettingsCommand({"active_chatbot_id": None}).validate()


# ---------------------------------------------------------------------------
# GET /api/v1/extensions/settings
# ---------------------------------------------------------------------------


class TestGetSettingsEndpoint:
    def test_authenticated_user_can_read(
        self, client: Any, full_api_access: None, mocker: Any
    ) -> None:
        mocker.patch(
            "superset.extensions.api.GetExtensionSettingsCommand.run",
            return_value={"active_chatbot_id": None, "enabled": {}},
        )
        resp = client.get("/api/v1/extensions/settings")
        assert resp.status_code == 200
        assert resp.json["result"]["active_chatbot_id"] is None

    def test_returns_active_chatbot_and_enabled_map(
        self, client: Any, full_api_access: None, mocker: Any
    ) -> None:
        mocker.patch(
            "superset.extensions.api.GetExtensionSettingsCommand.run",
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
            "superset.extensions.api.UpdateExtensionSettingsCommand.run",
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
            "superset.extensions.api.UpdateExtensionSettingsCommand.run",
            return_value={"active_chatbot_id": None, "enabled": {}},
        )
        resp = client.put("/api/v1/extensions/settings", json={})
        assert resp.status_code == 200

    def test_non_object_body_rejected(
        self, client: Any, full_api_access: None, mocker: Any
    ) -> None:
        mocker.patch(
            "superset.extensions.api.security_manager.is_admin", return_value=True
        )
        run = mocker.patch(
            "superset.extensions.api.UpdateExtensionSettingsCommand.run",
        )
        resp = client.put("/api/v1/extensions/settings", json=["not", "an", "object"])
        assert resp.status_code == 400
        run.assert_not_called()

    def test_non_string_active_chatbot_id_rejected(
        self, client: Any, full_api_access: None, mocker: Any
    ) -> None:
        mocker.patch(
            "superset.extensions.api.security_manager.is_admin", return_value=True
        )
        run = mocker.patch(
            "superset.extensions.api.UpdateExtensionSettingsCommand.run",
        )
        # An int must be rejected with a 400, not silently coerced to null.
        resp = client.put(
            "/api/v1/extensions/settings", json={"active_chatbot_id": 123}
        )
        assert resp.status_code == 400
        run.assert_not_called()

    def test_null_active_chatbot_id_is_accepted(
        self, client: Any, full_api_access: None, mocker: Any
    ) -> None:
        mocker.patch(
            "superset.extensions.api.security_manager.is_admin", return_value=True
        )
        mocker.patch(
            "superset.extensions.api.UpdateExtensionSettingsCommand.run",
            return_value={"active_chatbot_id": None, "enabled": {}},
        )
        resp = client.put(
            "/api/v1/extensions/settings", json={"active_chatbot_id": None}
        )
        assert resp.status_code == 200

    def test_oversized_active_chatbot_id_rejected(
        self, client: Any, full_api_access: None, mocker: Any
    ) -> None:
        from superset.extensions.models import EXTENSION_ID_MAX_LENGTH

        mocker.patch(
            "superset.extensions.api.security_manager.is_admin", return_value=True
        )
        run = mocker.patch(
            "superset.extensions.api.UpdateExtensionSettingsCommand.run",
        )
        resp = client.put(
            "/api/v1/extensions/settings",
            json={"active_chatbot_id": "x" * (EXTENSION_ID_MAX_LENGTH + 1)},
        )
        assert resp.status_code == 400
        run.assert_not_called()

    def test_oversized_enabled_key_rejected(
        self, client: Any, full_api_access: None, mocker: Any
    ) -> None:
        from superset.extensions.models import EXTENSION_ID_MAX_LENGTH

        mocker.patch(
            "superset.extensions.api.security_manager.is_admin", return_value=True
        )
        run = mocker.patch(
            "superset.extensions.api.UpdateExtensionSettingsCommand.run",
        )
        resp = client.put(
            "/api/v1/extensions/settings",
            json={"enabled": {"x" * (EXTENSION_ID_MAX_LENGTH + 1): True}},
        )
        assert resp.status_code == 400
        run.assert_not_called()
