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
        """
        Find the current system default theme.
        Returns the theme with is_system_default=True if exactly one exists.
        Returns None if no theme or multiple themes have
        is_system_default=True.
        """
        system_defaults = (
            db.session.query(Theme).filter(Theme.is_system_default.is_(True)).all()
        )

        if len(system_defaults) == 1:
            return system_defaults[0]

        if len(system_defaults) > 1:
            logger.warning(
                "Multiple system default themes found (%s), none will be used",
                len(system_defaults),
            )
            return None

        # If no theme is explicitly set as system default, return None
        return None

    @classmethod
    def find_system_dark(cls) -> Optional[Theme]:
        """Find the current system dark theme.

        Returns the theme with is_system_dark=True if exactly one exists.
        Returns None if no theme or multiple themes have is_system_dark=True.
        """
        system_darks = (
            db.session.query(Theme).filter(Theme.is_system_dark.is_(True)).all()
        )

        if len(system_darks) == 1:
            return system_darks[0]

        if len(system_darks) > 1:
            logger.warning(
                "Multiple system dark themes found (%s), none will be used",
                len(system_darks),
            )
            return None

        # If no theme is explicitly set as system dark, return None
        return None
