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
from typing import Any

from superset.commands.base import BaseCommand
from superset.daos.theme import ThemeDAO
from superset.extensions import db
from superset.models.core import Theme
from superset.utils import json
from superset.utils.decorators import transaction

logger = logging.getLogger(__name__)


class ResolveAndUpsertThemeCommand(BaseCommand):
    """Command to resolve theme configuration and upsert to system theme."""

    def __init__(self, theme_config: dict[str, Any], theme_name: str):
        self._theme_config = theme_config
        self._theme_name = theme_name
        self._fallback_config = self._get_fallback_config()

    def run(self) -> dict[str, Any]:
        """Resolve theme configuration and upsert to system theme."""
        try:
            self.validate()

            # First resolve the theme configuration
            resolved_config = self._resolve_theme_config()

            # Then upsert to system theme
            self._upsert_system_theme(resolved_config)

            return resolved_config
        except Exception as ex:
            logger.error(
                "Failed to resolve and upsert theme %s: %s. Using fallback.",
                self._theme_name,
                ex,
            )
            return self._fallback_config

    def _get_fallback_config(self) -> dict[str, Any]:
        """Get fallback configuration based on theme name."""
        if self._theme_name == "THEME_DARK":
            return {"algorithm": "dark"}
        return {}

    def _resolve_theme_config(self) -> dict[str, Any]:
        """Resolve theme configuration, looking up UUID references if present."""
        # Check if config contains a UUID reference
        if isinstance(self._theme_config, dict) and "uuid" in self._theme_config:
            uuid = self._theme_config["uuid"]
            referenced_theme = ThemeDAO.find_by_uuid(uuid)

            if referenced_theme and referenced_theme.json_data:
                try:
                    resolved_config = json.loads(referenced_theme.json_data)
                    logger.debug(
                        "Resolved UUID reference %s for %s to theme definition",
                        uuid,
                        self._theme_name,
                    )
                    return resolved_config
                except (ValueError, TypeError) as ex:
                    logger.error(
                        "Failed to parse theme JSON for UUID %s: %s",
                        uuid,
                        ex,
                    )
                    return self._fallback_config
            else:
                logger.error(
                    "Referenced theme with UUID %s not found for %s",
                    uuid,
                    self._theme_name,
                )
                return self._fallback_config

        # Not a UUID reference, return as-is
        return self._theme_config

    @transaction()
    def _upsert_system_theme(self, theme_config: dict[str, Any]) -> None:
        """Upsert the resolved theme configuration as a system theme."""
        existing_theme = (
            db.session.query(Theme)
            .filter(Theme.theme_name == self._theme_name, Theme.is_system)
            .first()
        )

        json_data = json.dumps(theme_config)

        if existing_theme:
            existing_theme.json_data = json_data
            logger.info(f"Updated system theme: {self._theme_name}")
        else:
            new_theme = Theme(
                theme_name=self._theme_name,
                json_data=json_data,
                is_system=True,
            )
            db.session.add(new_theme)
            logger.info(f"Created system theme: {self._theme_name}")

    def validate(self) -> None:
        """Validate that the theme config is a dictionary."""
        if not isinstance(self._theme_config, dict):
            self._theme_config = {}
        if not self._theme_name:
            raise ValueError("Theme name is required")
