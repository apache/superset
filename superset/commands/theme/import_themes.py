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


def _set_importer_as_theme_editor(theme: "Theme", user: Any | None) -> None:
    """Assign a newly imported theme to its importing user."""
    if not user:
        return

    from superset.subjects.utils import get_user_subject

    theme.changed_by = user
    theme.created_by = user
    subject = get_user_subject(user.id)
    if subject and subject not in theme.editors:
        theme.editors.append(subject)


def _authorize_theme_overwrite(existing: "Theme", user: Any | None) -> None:
    """Raise unless the current user may overwrite an existing theme."""
    from superset import security_manager

    if existing.is_system:
        raise ThemeImportError("Cannot overwrite a system theme via import")
    # The active system-default/dark theme slot may be overwritten by
    # admins only; a non-admin overwriting it would change the theme
    # rendered for every user, including the login page and other admins.
    if (
        existing.is_system_default or existing.is_system_dark
    ) and not security_manager.is_admin():
        raise ThemeImportError(
            "Cannot overwrite the active system-default/dark theme via import"
        )
    # Overwriting an existing theme requires editorship (admins bypass).
    # There is deliberately no `created_by_fk` fallback here: the migration
    # that introduced per-theme editors backfilled every non-system theme's
    # creator (and the subjects migration before it seeded a Subject for
    # every user, so that backfill missed nobody), and every code path that
    # creates a theme since then seeds its creator/importer as an editor.
    # An empty `editors` list on a non-system theme therefore means an admin
    # explicitly revoked edit access (admin-only), not an unbackfilled gap,
    # and the creator must not be able to overwrite their way back in.
    if (
        user
        and not security_manager.is_editor(existing)
        and not security_manager.is_admin()
    ):
        raise ThemeImportError(
            "A theme already exists and user doesn't have permissions to overwrite it"
        )


def import_theme(config: dict[str, Any], overwrite: bool = False) -> "Theme | None":
    """Import a single theme from config dictionary"""
    from superset import db, security_manager
    from superset.models.core import Theme
    from superset.utils.core import get_user

    can_write = security_manager.can_access("can_write", "Theme")
    user = get_user()
    existing = db.session.query(Theme).filter_by(uuid=config["uuid"]).first()

    if existing:
        if not overwrite or not can_write:
            return existing
        _authorize_theme_overwrite(existing, user)
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

    # Add current user as owner + editor when creating a new theme, mirroring
    # CreateThemeCommand and the dashboard/chart/dataset importers, so the
    # importer can maintain (edit/delete) the theme they just created.
    if not existing:
        _set_importer_as_theme_editor(theme, user)

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
