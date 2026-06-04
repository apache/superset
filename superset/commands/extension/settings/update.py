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

from marshmallow import ValidationError

from superset.commands.base import BaseCommand
from superset.commands.extension.settings.exceptions import (
    ActiveChatbotIdValidationError,
    EnabledKeyValidationError,
    ExtensionSettingsInvalidError,
    ExtensionSettingsUpdateFailedError,
)
from superset.daos.extension import (
    ExtensionEnabledDAO,
    ExtensionSettingsDAO,
    get_extension_settings,
)
from superset.extensions.models import EXTENSION_ID_MAX_LENGTH
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class UpdateExtensionSettingsCommand(BaseCommand):
    """Apply a partial update to global extension admin settings.

    The payload is a dict that may contain:
    * active_chatbot_id: str | None — empty string is normalised to None.
    * enabled: dict[str, bool] — per-extension toggle map. Non-bool values
      are silently skipped.

    Keys not present in the payload are left untouched. Invalid values raise
    ``ExtensionSettingsInvalidError`` before any write happens.
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
            active_chatbot_id = str(value) if value else None
            ExtensionSettingsDAO.upsert_active_chatbot_id(active_chatbot_id)

        enabled = self._body.get("enabled")
        if isinstance(enabled, dict):
            for extension_id, value in enabled.items():
                if not isinstance(value, bool):
                    continue
                ExtensionEnabledDAO.upsert_enabled_flag(extension_id, value)

        return get_extension_settings()

    def validate(self) -> None:
        exceptions: list[ValidationError] = []

        if "active_chatbot_id" in self._body:
            value = self._body["active_chatbot_id"]
            if not self._is_valid_chatbot_id(value):
                exceptions.append(
                    ActiveChatbotIdValidationError(EXTENSION_ID_MAX_LENGTH)
                )

        enabled = self._body.get("enabled")
        if enabled is not None and not self._are_valid_enabled_keys(enabled):
            exceptions.append(EnabledKeyValidationError(EXTENSION_ID_MAX_LENGTH))

        if exceptions:
            raise ExtensionSettingsInvalidError(exceptions=exceptions)

    @staticmethod
    def _is_valid_chatbot_id(value: Any) -> bool:
        # Null or any string up to the column length. An empty string is a
        # valid "clear" signal — run() normalises it to None.
        if value is None:
            return True
        return isinstance(value, str) and len(value) <= EXTENSION_ID_MAX_LENGTH

    @staticmethod
    def _are_valid_enabled_keys(enabled: Any) -> bool:
        if not isinstance(enabled, dict):
            return False
        return all(
            isinstance(key, str) and 0 < len(key) <= EXTENSION_ID_MAX_LENGTH
            for key in enabled
        )
