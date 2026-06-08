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

from superset import db
from superset.daos.base import BaseDAO
from superset.extensions.models import ExtensionEnabled, ExtensionSettings

# The global extension settings live in a single row; id is fixed so the row
# can be fetched and upserted without a secondary lookup.
SETTINGS_ROW_ID = 1


class ExtensionSettingsDAO(BaseDAO[ExtensionSettings]):
    """Persistence for the singleton global extension settings row.

    The row (id=1) holds global admin state such as the active chatbot id.
    Writes go through a check-then-write upsert that is dialect-agnostic;
    callers wrap the operation in ``@transaction`` so the read-then-write
    window is serialised and committed atomically.
    """

    @staticmethod
    def get_settings_row() -> ExtensionSettings | None:
        return db.session.get(ExtensionSettings, SETTINGS_ROW_ID)

    @classmethod
    def upsert_active_chatbot_id(cls, active_chatbot_id: str | None) -> None:
        if row := cls.get_settings_row():
            row.active_chatbot_id = active_chatbot_id
        else:
            cls.create(
                attributes={
                    "id": SETTINGS_ROW_ID,
                    "active_chatbot_id": active_chatbot_id,
                }
            )


class ExtensionEnabledDAO(BaseDAO[ExtensionEnabled]):
    """Persistence for per-extension enabled flags."""

    id_column_name = "extension_id"

    @classmethod
    def get_enabled_map(cls) -> dict[str, bool]:
        return {row.extension_id: row.enabled for row in cls.find_all()}

    @classmethod
    def upsert_enabled_flag(cls, extension_id: str, enabled: bool) -> None:
        if row := cls.find_by_id(extension_id):
            row.enabled = enabled
        else:
            cls.create(attributes={"extension_id": extension_id, "enabled": enabled})


def get_extension_settings() -> dict[str, Any]:
    """Read-only view of the combined extension settings."""
    row = ExtensionSettingsDAO.get_settings_row()
    return {
        "active_chatbot_id": row.active_chatbot_id if row else None,
        "enabled": ExtensionEnabledDAO.get_enabled_map(),
    }
