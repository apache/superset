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

from superset.commands.base import BaseCommand
from superset.commands.css.exceptions import (
    CssTemplateInvalidError,
    CssTemplateNotFoundError,
    CssTemplateUpdateFailedError,
)
from superset.daos.css import CssTemplateDAO
from superset.models.core import CssTemplate
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class UpdateCssTemplateCommand(BaseCommand):
    def __init__(self, model_id: int, properties: dict[str, Any]):
        self._model_id = model_id
        self._properties = properties
        self._model: CssTemplate | None = None

    @transaction(on_error=partial(on_error, reraise=CssTemplateUpdateFailedError))
    def run(self) -> CssTemplate:
        self.validate()
        assert self._model
        return CssTemplateDAO.update(self._model, attributes=self._properties)

    def validate(self) -> None:
        self._model = CssTemplateDAO.find_by_id(self._model_id)
        if not self._model:
            raise CssTemplateNotFoundError()
        template_name = self._properties.get("template_name")
        if template_name is not None and not template_name.strip():
            raise CssTemplateInvalidError()
