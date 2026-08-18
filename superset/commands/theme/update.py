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
from typing import Any, Optional

from superset.commands.base import UpdateMixin
from superset.commands.theme.exceptions import (
    SystemThemeProtectedError,
    ThemeNotFoundError,
)
from superset.daos.theme import ThemeDAO
from superset.models.core import Theme
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class UpdateThemeCommand(UpdateMixin):
    def __init__(self, model_id: int, data: dict[str, Any]):
        self._model_id = model_id
        self._properties = data.copy()
        self._model: Optional[Theme] = None

    @transaction(on_error=partial(on_error, reraise=Exception))
    def run(self) -> Theme:
        self.validate()
        assert self._model
        theme = ThemeDAO.update(self._model, self._properties)
        return theme

    def validate(self) -> None:
        # Validate theme exists
        self._model = ThemeDAO.find_by_id(self._model_id)
        if not self._model:
            raise ThemeNotFoundError()

        # Check if it's a system theme
        if self._model.is_system:
            raise SystemThemeProtectedError()
