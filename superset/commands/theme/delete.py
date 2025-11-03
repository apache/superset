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
from typing import Optional

from superset.commands.base import BaseCommand
from superset.commands.theme.exceptions import (
    SystemThemeInUseError,
    SystemThemeProtectedError,
    ThemeDeleteFailedError,
    ThemeNotFoundError,
)
from superset.daos.theme import ThemeDAO
from superset.extensions import db
from superset.models.core import Theme
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class DeleteThemeCommand(BaseCommand):
    def __init__(self, model_ids: list[int]):
        self._model_ids = model_ids
        self._models: Optional[list[Theme]] = None
        self._dashboard_usage: Optional[dict[int, list[str]]] = None

    @transaction(on_error=partial(on_error, reraise=ThemeDeleteFailedError))
    def run(self) -> None:
        self.validate()
        assert self._models

        # Dissociate dashboards from themes before deleting
        self._dissociate_dashboards()

        ThemeDAO.delete(self._models)

    def validate(self) -> None:
        # Validate/populate model exists
        self._models = ThemeDAO.find_by_ids(self._model_ids)
        if not self._models or len(self._models) != len(self._model_ids):
            raise ThemeNotFoundError()

        # Check if any of the themes are system themes
        for theme in self._models:
            if theme.is_system:
                raise SystemThemeProtectedError()
            # Check if theme is in use as system default or dark
            if theme.is_system_default or theme.is_system_dark:
                raise SystemThemeInUseError()

        # Check for dashboard usage
        self._dashboard_usage = self._get_dashboard_usage()

    def _dissociate_dashboards(self) -> None:
        """Dissociate dashboards from themes before deletion."""
        from superset.models.dashboard import Dashboard

        theme_ids = [theme.id for theme in self._models or []]
        if not theme_ids:
            return

        # Get count of affected dashboards for logging
        affected_count = (
            db.session.query(Dashboard)
            .filter(Dashboard.theme_id.in_(theme_ids))
            .count()
        )

        if affected_count > 0:
            logger.info(
                "Dissociating %d dashboards from %d themes before deletion",
                affected_count,
                len(theme_ids),
            )

            # Set theme_id to NULL for all dashboards using these themes
            db.session.query(Dashboard).filter(
                Dashboard.theme_id.in_(theme_ids)
            ).update({Dashboard.theme_id: None}, synchronize_session=False)

    def _get_dashboard_usage(self) -> dict[int, list[str]]:
        """Get dashboard names that use these themes."""
        from superset.models.dashboard import Dashboard

        theme_ids = [theme.id for theme in self._models or []]
        if not theme_ids:
            return {}

        dashboards_using_themes = (
            db.session.query(Dashboard.theme_id, Dashboard.dashboard_title)
            .filter(Dashboard.theme_id.in_(theme_ids))
            .all()
        )

        usage: dict[int, list[str]] = {}
        for theme_id, dashboard_title in dashboards_using_themes:
            if theme_id not in usage:
                usage[theme_id] = []
            usage[theme_id].append(dashboard_title)

        return usage

    def get_dashboard_usage(self) -> dict[int, list[str]]:
        """Public method to get dashboard usage info."""
        return self._dashboard_usage or {}
