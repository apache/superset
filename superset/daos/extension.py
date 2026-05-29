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

from sqlalchemy.dialects.mysql import insert as mysql_insert
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from superset import db
from superset.extensions.models import ExtensionEnabled, ExtensionSettings

SETTINGS_ROW_ID = 1


def _upsert_extension_settings_row(active_chatbot_id: str | None) -> None:
    """Dialect-aware single-statement upsert for the singleton settings row."""
    dialect = db.session.get_bind().dialect.name
    if dialect == "postgresql":
        stmt = (
            pg_insert(ExtensionSettings)
            .values(id=SETTINGS_ROW_ID, active_chatbot_id=active_chatbot_id)
            .on_conflict_do_update(
                index_elements=["id"],
                set_={"active_chatbot_id": active_chatbot_id},
            )
        )
    elif dialect == "sqlite":
        stmt = (
            sqlite_insert(ExtensionSettings)
            .values(id=SETTINGS_ROW_ID, active_chatbot_id=active_chatbot_id)
            .on_conflict_do_update(
                index_elements=["id"],
                set_={"active_chatbot_id": active_chatbot_id},
            )
        )
    elif dialect in ("mysql", "mariadb"):
        stmt = mysql_insert(ExtensionSettings).values(
            id=SETTINGS_ROW_ID, active_chatbot_id=active_chatbot_id
        )
        stmt = stmt.on_duplicate_key_update(active_chatbot_id=active_chatbot_id)
    else:
        raise NotImplementedError(
            f"ExtensionSettings upsert not implemented for dialect '{dialect}'."
        )
    db.session.execute(stmt)


def _upsert_extension_enabled_row(extension_id: str, enabled: bool) -> None:
    """Dialect-aware single-statement upsert for a per-extension enabled flag."""
    dialect = db.session.get_bind().dialect.name
    if dialect == "postgresql":
        stmt = (
            pg_insert(ExtensionEnabled)
            .values(extension_id=extension_id, enabled=enabled)
            .on_conflict_do_update(
                index_elements=["extension_id"],
                set_={"enabled": enabled},
            )
        )
    elif dialect == "sqlite":
        stmt = (
            sqlite_insert(ExtensionEnabled)
            .values(extension_id=extension_id, enabled=enabled)
            .on_conflict_do_update(
                index_elements=["extension_id"],
                set_={"enabled": enabled},
            )
        )
    elif dialect in ("mysql", "mariadb"):
        stmt = mysql_insert(ExtensionEnabled).values(
            extension_id=extension_id, enabled=enabled
        )
        stmt = stmt.on_duplicate_key_update(enabled=enabled)
    else:
        raise NotImplementedError(
            f"ExtensionEnabled upsert not implemented for dialect '{dialect}'."
        )
    db.session.execute(stmt)


class ExtensionSettingsDAO:
    """Persistence for admin-level extension settings.

    Two tables back this DAO:
    * extension_settings — singleton row (id=1) holding global state
      (currently active_chatbot_id).
    * extension_enabled  — one row per extension id with a boolean
      enabled flag.

    All writes use a single dialect-native upsert statement so concurrent
    callers cannot race a read-then-insert window into a duplicate-key
    error or a lost update.
    """

    @staticmethod
    def get_settings() -> dict[str, Any]:
        row = db.session.get(ExtensionSettings, SETTINGS_ROW_ID)
        enabled_rows = db.session.query(ExtensionEnabled).all()
        return {
            "active_chatbot_id": row.active_chatbot_id if row else None,
            "enabled": {r.extension_id: r.enabled for r in enabled_rows},
        }

    @staticmethod
    def upsert_active_chatbot_id(active_chatbot_id: str | None) -> None:
        _upsert_extension_settings_row(active_chatbot_id)

    @staticmethod
    def upsert_enabled_flag(extension_id: str, enabled: bool) -> None:
        _upsert_extension_enabled_row(extension_id, enabled)
