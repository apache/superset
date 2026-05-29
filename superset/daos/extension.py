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

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from superset import db
from superset.extensions.models import ExtensionEnabled, ExtensionSettings

SETTINGS_ROW_ID = 1


class ExtensionSettingsDAO:
    """Persistence for admin-level extension settings.

    Two tables back this DAO:
    * extension_settings — singleton row (id=1) holding global state
      (currently active_chatbot_id).
    * extension_enabled  — one row per extension id with a boolean
      enabled flag.
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
        """Upsert the singleton settings row."""
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
            db.session.execute(stmt)
        elif dialect == "sqlite":
            stmt = (
                sqlite_insert(ExtensionSettings)
                .values(id=SETTINGS_ROW_ID, active_chatbot_id=active_chatbot_id)
                .on_conflict_do_update(
                    index_elements=["id"],
                    set_={"active_chatbot_id": active_chatbot_id},
                )
            )
            db.session.execute(stmt)
        else:
            # MySQL/MariaDB: read-then-update path. The enclosing @transaction
            # gives session/commit management but not concurrency serialisation;
            # native ON DUPLICATE KEY UPDATE is added in a follow-up.
            obj = db.session.get(ExtensionSettings, SETTINGS_ROW_ID)
            if obj is None:
                obj = ExtensionSettings(
                    id=SETTINGS_ROW_ID, active_chatbot_id=active_chatbot_id
                )
                db.session.add(obj)
            else:
                obj.active_chatbot_id = active_chatbot_id

    @staticmethod
    def upsert_enabled_flag(extension_id: str, enabled: bool) -> None:
        """Upsert a per-extension enabled flag."""
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
            db.session.execute(stmt)
        elif dialect == "sqlite":
            stmt = (
                sqlite_insert(ExtensionEnabled)
                .values(extension_id=extension_id, enabled=enabled)
                .on_conflict_do_update(
                    index_elements=["extension_id"],
                    set_={"enabled": enabled},
                )
            )
            db.session.execute(stmt)
        else:
            # MySQL/MariaDB: read-then-update path (see note above).
            obj = (
                db.session.query(ExtensionEnabled)
                .filter_by(extension_id=extension_id)
                .first()
            )
            if obj is None:
                db.session.add(
                    ExtensionEnabled(extension_id=extension_id, enabled=enabled)
                )
            else:
                obj.enabled = enabled
