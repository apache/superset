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
from typing import Any, TYPE_CHECKING

from marshmallow import Schema

if TYPE_CHECKING:
    from superset.models.core import Theme

from superset.commands.importers.v1 import ImportModelsCommand
from superset.commands.theme.exceptions import ThemeImportError
from superset.daos.theme import ThemeDAO
from superset.themes.schemas import ImportV1ThemeSchema
from superset.utils import json

logger = logging.getLogger(__name__)


def import_theme(config: dict[str, Any], overwrite: bool = False) -> "Theme | None":
    """Import a single theme from config dictionary"""
    from superset import db, security_manager
    from superset.models.core import Theme
    from superset.utils.core import get_user

    can_write = security_manager.can_access("can_write", "Theme")
    existing = db.session.query(Theme).filter_by(uuid=config["uuid"]).first()

    if existing:
        if not overwrite or not can_write:
            return existing
        config["id"] = existing.id
    elif not can_write:
        raise ThemeImportError(
            "Theme doesn't exist and user doesn't have permission to create themes"
        )

    # Convert json_data from dict to string if needed
    if isinstance(config.get("json_data"), dict):
        config["json_data"] = json.dumps(config["json_data"])

    # Create or update theme
    theme = Theme.import_from_dict(config, recursive=False)
    if theme.id is None:
        db.session.flush()

    # Add current user as owner if creating new theme
    if not existing and (user := get_user()):
        theme.changed_by = user
        theme.created_by = user

    return theme


class ImportThemesCommand(ImportModelsCommand):
    """Import themes"""

    dao = ThemeDAO
    model_name = "theme"
    prefix = "themes/"
    schemas: dict[str, Schema] = {
        "themes/": ImportV1ThemeSchema(),
    }
    import_error = ThemeImportError

    @staticmethod
    def _import(
        configs: dict[str, Any],
        overwrite: bool = False,
        contents: dict[str, Any] | None = None,
    ) -> None:
        # Import each theme configuration
        for file_name, config in configs.items():
            if file_name.startswith("themes/"):
                import_theme(config, overwrite=overwrite)
