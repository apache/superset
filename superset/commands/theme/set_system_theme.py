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

from sqlalchemy import update

from superset.commands.base import BaseCommand
from superset.commands.theme.exceptions import ThemeNotFoundError
from superset.daos.theme import ThemeDAO
from superset.extensions import db
from superset.models.core import Theme
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class SetSystemDefaultThemeCommand(BaseCommand):
    def __init__(self, theme_id: int):
        self._theme_id = theme_id
        self._theme: Optional[Theme] = None

    @transaction(on_error=partial(on_error, reraise=Exception))
    def run(self) -> Theme:
        self.validate()
        assert self._theme

        # Clear all existing system defaults in a single query
        db.session.execute(
            update(Theme)
            .where(Theme.is_system_default.is_(True))
            .values(is_system_default=False)
        )

        # Set the new system default
        self._theme.is_system_default = True
        db.session.add(self._theme)

        logger.info(f"Set theme {self._theme_id} as system default")

        return self._theme

    def validate(self) -> None:
        self._theme = ThemeDAO.find_by_id(self._theme_id)
        if not self._theme:
            raise ThemeNotFoundError()


class SetSystemDarkThemeCommand(BaseCommand):
    def __init__(self, theme_id: int):
        self._theme_id = theme_id
        self._theme: Optional[Theme] = None

    @transaction(on_error=partial(on_error, reraise=Exception))
    def run(self) -> Theme:
        self.validate()
        assert self._theme

        # Clear all existing system dark themes in a single query
        db.session.execute(
            update(Theme)
            .where(Theme.is_system_dark.is_(True))
            .values(is_system_dark=False)
        )

        # Set the new system dark theme
        self._theme.is_system_dark = True
        db.session.add(self._theme)

        logger.info(f"Set theme {self._theme_id} as system dark")

        return self._theme

    def validate(self) -> None:
        self._theme = ThemeDAO.find_by_id(self._theme_id)
        if not self._theme:
            raise ThemeNotFoundError()


class ClearSystemDefaultThemeCommand(BaseCommand):
    @transaction(on_error=partial(on_error, reraise=Exception))
    def run(self) -> None:
        # Clear all system default themes
        db.session.execute(
            update(Theme)
            .where(Theme.is_system_default.is_(True))
            .values(is_system_default=False)
        )

        logger.info("Cleared system default theme")

    def validate(self) -> None:
        # No validation needed for clearing
        pass


class ClearSystemDarkThemeCommand(BaseCommand):
    @transaction(on_error=partial(on_error, reraise=Exception))
    def run(self) -> None:
        # Clear all system dark themes
        db.session.execute(
            update(Theme)
            .where(Theme.is_system_dark.is_(True))
            .values(is_system_dark=False)
        )

        logger.info("Cleared system dark theme")

    def validate(self) -> None:
        # No validation needed for clearing
        pass
