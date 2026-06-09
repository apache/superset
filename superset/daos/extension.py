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
from superset.extensions.models import ExtensionSettings

# The global extension settings live in a single row; id is fixed so the row
# can be fetched without a secondary lookup.
SETTINGS_ROW_ID = 1


class ExtensionSettingsDAO(BaseDAO[ExtensionSettings]):
    """Persistence for the singleton global extension settings row.

    The row (id=1) holds global admin state such as the active chatbot id.
    """

    @staticmethod
    def get_settings_row() -> ExtensionSettings | None:
        return db.session.get(ExtensionSettings, SETTINGS_ROW_ID)


def get_extension_settings() -> dict[str, Any]:
    """Read-only view of the extension settings."""
    row = ExtensionSettingsDAO.get_settings_row()
    return {
        "active_chatbot_id": row.active_chatbot_id if row else None,
    }
