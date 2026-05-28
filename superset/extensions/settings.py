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

"""Admin settings persistence for extensions (active chatbot, enable/disable)."""

from typing import Any

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from superset import db
from superset.extensions.models import ExtensionEnabled, ExtensionSettings
from superset.utils.decorators import transaction

_SETTINGS_ROW_ID = 1


def get_extension_settings() -> dict[str, Any]:
    row = db.session.get(ExtensionSettings, _SETTINGS_ROW_ID)
    enabled_rows = db.session.query(ExtensionEnabled).all()
    return {
        "active_chatbot_id": row.active_chatbot_id if row else None,
        "enabled": {r.extension_id: r.enabled for r in enabled_rows},
    }


def _upsert_settings_row(
    active_chatbot_id: str | None,
) -> None:
    """Upsert the singleton settings row without a read-then-insert race."""
    dialect = db.session.get_bind().dialect.name
    if dialect == "postgresql":
        stmt = (
            pg_insert(ExtensionSettings)
            .values(id=_SETTINGS_ROW_ID, active_chatbot_id=active_chatbot_id)
            .on_conflict_do_update(
                index_elements=["id"],
                set_={"active_chatbot_id": active_chatbot_id},
            )
        )
        db.session.execute(stmt)
    elif dialect == "sqlite":
        stmt = (
            sqlite_insert(ExtensionSettings)
            .values(id=_SETTINGS_ROW_ID, active_chatbot_id=active_chatbot_id)
            .on_conflict_do_update(
                index_elements=["id"],
                set_={"active_chatbot_id": active_chatbot_id},
            )
        )
        db.session.execute(stmt)
    else:
        # MySQL/MariaDB: read-then-update (no native INSERT-OR-REPLACE in SQLAlchemy
        # core that is safe under concurrent writes, so we rely on the @transaction
        # decorator for serialisation).
        obj = db.session.get(ExtensionSettings, _SETTINGS_ROW_ID)
        if obj is None:
            obj = ExtensionSettings(
                id=_SETTINGS_ROW_ID, active_chatbot_id=active_chatbot_id
            )
            db.session.add(obj)
        else:
            obj.active_chatbot_id = active_chatbot_id


def _upsert_enabled_flag(extension_id: str, enabled: bool) -> None:
    """Upsert a per-extension enabled flag without a read-then-insert race."""
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
        # MySQL/MariaDB: read-then-update, serialised by the @transaction decorator.
        obj = (
            db.session.query(ExtensionEnabled)
            .filter_by(extension_id=extension_id)
            .first()
        )
        if obj is None:
            db.session.add(ExtensionEnabled(extension_id=extension_id, enabled=enabled))
        else:
            obj.enabled = enabled


@transaction()
def update_extension_settings(body: dict[str, Any]) -> dict[str, Any]:
    if "active_chatbot_id" in body:
        value = body["active_chatbot_id"]
        active_chatbot_id = str(value) if isinstance(value, str) and value else None
        _upsert_settings_row(active_chatbot_id)

    if "enabled" in body and isinstance(body["enabled"], dict):
        for extension_id, enabled in body["enabled"].items():
            if not isinstance(enabled, bool):
                continue
            _upsert_enabled_flag(extension_id, enabled)

    return get_extension_settings()
