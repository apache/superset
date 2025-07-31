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

from flask import current_app as app

from superset.commands.base import BaseCommand
from superset.daos.theme import ThemeDAO
from superset.extensions import db
from superset.models.core import Theme
from superset.utils import json
from superset.utils.decorators import transaction

logger = logging.getLogger(__name__)


class SeedSystemThemesCommand(BaseCommand):
    """Command to seed system themes from configuration."""

    def run(self) -> None:
        """Seed system themes defined in application configuration."""

        themes_to_seed = []
        if theme_default := app.config.get("THEME_DEFAULT"):
            themes_to_seed.append(("THEME_DEFAULT", theme_default))
        if theme_dark := app.config.get("THEME_DARK"):
            themes_to_seed.append(("THEME_DARK", theme_dark))

        for theme_name, theme_config in themes_to_seed:
            self._upsert_system_theme(theme_name, theme_config)

    @transaction()
    def _upsert_system_theme(
        self, theme_name: str, theme_config: dict[str, Any]
    ) -> None:
        """Upsert a system theme."""
        # Handle UUID-only references by copying the referenced theme's definition
        if "uuid" in theme_config and len(theme_config) == 1:
            # UUID-only reference: fetch and copy the theme definition
            original_uuid = theme_config["uuid"]
            referenced_theme = ThemeDAO.find_by_uuid(original_uuid)
            if referenced_theme and referenced_theme.json_data:
                try:
                    theme_config = json.loads(referenced_theme.json_data)
                    # Add a note about the theme being copied from UUID reference
                    theme_config["NOTE"] = (
                        f"Copied at startup from theme UUID {original_uuid} "
                        f"based on config reference"
                    )
                    logger.debug(
                        "Copied theme definition from UUID %s for system theme %s",
                        original_uuid,
                        theme_name,
                    )
                except (ValueError, TypeError) as ex:
                    logger.error(
                        "Failed to parse theme JSON for UUID %s: %s",
                        original_uuid,
                        ex,
                    )
                    return
            else:
                logger.error(
                    "Referenced theme with UUID %s not found for system theme %s",
                    original_uuid,
                    theme_name,
                )
                return
        # else: Either no UUID or UUID + definition provided, use theme_config as-is

        existing_theme = (
            db.session.query(Theme)
            .filter(Theme.theme_name == theme_name, Theme.is_system)
            .first()
        )

        json_data = json.dumps(theme_config)

        if existing_theme:
            existing_theme.json_data = json_data
            logger.debug(f"Updated system theme: {theme_name}")
        else:
            new_theme = Theme(
                theme_name=theme_name,
                json_data=json_data,
                is_system=True,
            )
            db.session.add(new_theme)
            logger.debug(f"Created system theme: {theme_name}")

    def validate(self) -> None:
        """Validate that the command can be executed."""
        pass
