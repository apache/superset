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

from superset.commands.base import BaseCommand, CreateMixin
from superset.commands.theme.exceptions import (
    ThemeCreateFailedError,
    ThemeInvalidError,
)
from superset.commands.utils import populate_subjects
from superset.daos.theme import ThemeDAO
from superset.models.core import Theme
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class CreateThemeCommand(CreateMixin, BaseCommand):
    def __init__(self, data: dict[str, Any]):
        self._properties = data.copy()

    @transaction(on_error=partial(on_error, reraise=ThemeCreateFailedError))
    def run(self) -> Theme:
        self.validate()
        # User-created themes are never system themes.
        self._properties["is_system"] = False
        return ThemeDAO.create(attributes=self._properties)

    def _populate_subjects(self, exceptions: list[ValidationError]) -> None:
        populate_subjects(
            self._properties,
            exceptions,
            include_viewers=False,
        )

    def validate(self) -> None:
        exceptions: list[ValidationError] = []

        # Resolve the ``editors`` payload into Subjects, defaulting to the
        # requesting user and preventing self-lockout.
        self._populate_subjects(exceptions)

        if exceptions:
            raise ThemeInvalidError(exceptions=exceptions)
