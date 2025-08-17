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
from typing import Optional

from superset.daos.base import BaseDAO
from superset.extensions import db
from superset.models.core import Theme

logger = logging.getLogger(__name__)


class ThemeDAO(BaseDAO[Theme]):
    @classmethod
    def find_by_uuid(cls, uuid: str) -> Optional[Theme]:
        """Find theme by UUID."""
        return db.session.query(Theme).filter(Theme.uuid == uuid).first()

    @classmethod
    def find_system_default(cls) -> Optional[Theme]:
        """Find the current system default theme.

        First looks for a theme with is_system_default=True.
        If not found or multiple found, falls back to is_system=True theme
        with name 'THEME_DEFAULT'.
        """
        system_defaults = (
            db.session.query(Theme).filter(Theme.is_system_default.is_(True)).all()
        )

        if len(system_defaults) == 1:
            return system_defaults[0]

        if len(system_defaults) > 1:
            logger.warning(
                f"Multiple system default themes found ({len(system_defaults)}), "
                "falling back to config theme"
            )

        # Fallback to is_system=True theme with name 'THEME_DEFAULT'
        return (
            db.session.query(Theme)
            .filter(Theme.is_system.is_(True), Theme.theme_name == "THEME_DEFAULT")
            .first()
        )

    @classmethod
    def find_system_dark(cls) -> Optional[Theme]:
        """Find the current system dark theme.

        First looks for a theme with is_system_dark=True.
        If not found or multiple found, falls back to is_system=True theme
        with name 'THEME_DARK'.
        """
        system_darks = (
            db.session.query(Theme).filter(Theme.is_system_dark.is_(True)).all()
        )

        if len(system_darks) == 1:
            return system_darks[0]

        if len(system_darks) > 1:
            logger.warning(
                f"Multiple system dark themes found ({len(system_darks)}), "
                "falling back to config theme"
            )

        # Fallback to is_system=True theme with name 'THEME_DARK'
        return (
            db.session.query(Theme)
            .filter(Theme.is_system.is_(True), Theme.theme_name == "THEME_DARK")
            .first()
        )
