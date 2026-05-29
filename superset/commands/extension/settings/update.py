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
import logging
from functools import partial
from typing import Any

from superset.commands.base import BaseCommand
from superset.commands.extension.settings.exceptions import (
    ExtensionSettingsUpdateFailedError,
)
from superset.daos.extension import ExtensionSettingsDAO
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class UpdateExtensionSettingsCommand(BaseCommand):
    """Apply a partial update to global extension admin settings.

    The payload is a dict that may contain:
    * active_chatbot_id: str | None — empty string is normalised to None.
    * enabled: dict[str, bool] — per-extension toggle map. Non-bool values
      are silently skipped.

    Keys not present in the payload are left untouched.
    """

    def __init__(self, body: dict[str, Any]):
        self._body = body or {}

    @transaction(
        on_error=partial(on_error, reraise=ExtensionSettingsUpdateFailedError),
    )
    def run(self) -> dict[str, Any]:
        self.validate()

        if "active_chatbot_id" in self._body:
            value = self._body["active_chatbot_id"]
            active_chatbot_id = str(value) if isinstance(value, str) and value else None
            ExtensionSettingsDAO.upsert_active_chatbot_id(active_chatbot_id)

        enabled = self._body.get("enabled")
        if isinstance(enabled, dict):
            for extension_id, value in enabled.items():
                if not isinstance(value, bool):
                    continue
                ExtensionSettingsDAO.upsert_enabled_flag(extension_id, value)

        return ExtensionSettingsDAO.get_settings()

    def validate(self) -> None:
        return None
