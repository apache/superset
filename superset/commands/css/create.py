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
from functools import partial
from typing import Any

from superset.commands.base import BaseCommand
from superset.commands.css.exceptions import (
    CssTemplateCreateFailedError,
    CssTemplateInvalidError,
)
from superset.daos.css import CssTemplateDAO
from superset.models.core import CssTemplate
from superset.utils.decorators import on_error, transaction


class CreateCssTemplateCommand(BaseCommand):
    def __init__(self, properties: dict[str, Any]):
        self._properties = properties

    @transaction(on_error=partial(on_error, reraise=CssTemplateCreateFailedError))
    def run(self) -> CssTemplate:
        self.validate()
        return CssTemplateDAO.create(attributes=self._properties)

    def validate(self) -> None:
        if not self._properties.get("template_name", "").strip():
            raise CssTemplateInvalidError()
        if "css" not in self._properties:
            raise CssTemplateInvalidError()
