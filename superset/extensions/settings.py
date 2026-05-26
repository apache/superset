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

from superset import db
from superset.models.core import ExtensionEnabled, ExtensionSettings
from superset.utils.decorators import transaction

_SETTINGS_ROW_ID = 1


def get_extension_settings() -> dict[str, Any]:
    row = db.session.get(ExtensionSettings, _SETTINGS_ROW_ID)
    enabled_rows = db.session.query(ExtensionEnabled).all()
    return {
        "active_chatbot_id": row.active_chatbot_id if row else None,
        "enabled": {r.extension_id: r.enabled for r in enabled_rows},
    }


@transaction()
def update_extension_settings(body: dict[str, Any]) -> dict[str, Any]:
    row = db.session.get(ExtensionSettings, _SETTINGS_ROW_ID)
    if row is None:
        row = ExtensionSettings(id=_SETTINGS_ROW_ID)
        db.session.add(row)

    if "active_chatbot_id" in body:
        row.active_chatbot_id = body["active_chatbot_id"] or None

    if "enabled" in body:
        for extension_id, enabled in body["enabled"].items():
            flag = db.session.get(ExtensionEnabled, extension_id)
            if flag is None:
                flag = ExtensionEnabled(extension_id=extension_id)
                db.session.add(flag)
            flag.enabled = bool(enabled)

    return get_extension_settings()
