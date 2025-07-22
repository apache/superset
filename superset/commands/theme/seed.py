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

from flask import current_app

from superset.commands.base import BaseCommand
from superset.extensions import db
from superset.models.core import Theme
from superset.utils import json

logger = logging.getLogger(__name__)


class SeedSystemThemesCommand(BaseCommand):
    """Command to seed system themes from configuration."""

    def run(self) -> None:
        """Seed system themes defined in application configuration."""

        themes_to_seed = []
        if theme_default := current_app.config.get("THEME_DEFAULT"):
            themes_to_seed.append(("THEME_DEFAULT", theme_default))
        if theme_dark := current_app.config.get("THEME_DARK"):
            themes_to_seed.append(("THEME_DARK", theme_dark))

        for theme_name, theme_config in themes_to_seed:
            self._upsert_system_theme(theme_name, theme_config)

    def _upsert_system_theme(
        self, theme_name: str, theme_config: dict[str, Any]
    ) -> None:
        """Upsert a system theme."""
        try:
            existing_theme = (
                db.session.query(Theme)
                .filter(Theme.theme_name == theme_name, Theme.is_system)
                .first()
            )

            json_data = json.dumps(theme_config)

            if existing_theme:
                existing_theme.json_data = json_data
                logger.info(f"Updated system theme: {theme_name}")
            else:
                new_theme = Theme(
                    theme_name=theme_name,
                    json_data=json_data,
                    is_system=True,
                )
                db.session.add(new_theme)
                logger.info(f"Created system theme: {theme_name}")

            db.session.commit()
        except Exception as ex:
            logger.error(f"Failed to seed system theme {theme_name}: {ex}")
            db.session.rollback()

    def validate(self) -> None:
        """Validate that the command can be executed."""
        pass
