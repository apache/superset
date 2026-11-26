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
from superset.commands.base import BaseCommand
from superset.commands.css.exceptions import CssTemplateNotFoundError
from superset.daos.css import CssTemplateDAO
from superset.models.core import CssTemplate


class ExportCssTemplatesCommand(BaseCommand):
    """Resolve the CSS templates to export.

    File naming and serialization are left to the caller, since the naming rule
    differs between a single-file download and a ZIP bundle.
    """

    def __init__(self, model_ids: list[int]) -> None:
        self.model_ids = model_ids
        self._models: list[CssTemplate] = []

    def run(self) -> list[CssTemplate]:
        self.validate()
        return self._models

    def validate(self) -> None:
        self._models = CssTemplateDAO.find_by_ids(self.model_ids)
        if len(self._models) != len(self.model_ids):
            raise CssTemplateNotFoundError()
