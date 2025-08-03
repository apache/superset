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
from __future__ import annotations

import logging
from functools import partial

from marshmallow import ValidationError

from superset.commands.base import BaseCommand
from superset.commands.extension.exceptions import ExtensionDeleteFailedError
from superset.daos.extension import ExtensionDAO
from superset.extensions.models import Extension
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class DeleteExtensionCommand(BaseCommand):
    def __init__(self, model_ids: list[int]):
        self._model_ids = model_ids
        self._model: Extension

    @transaction(on_error=partial(on_error, reraise=ExtensionDeleteFailedError))
    def run(self) -> None:
        self.validate()
        ExtensionDAO.delete(self._models)

    def validate(self) -> None:
        exceptions: list[ValidationError] = []

        extensions = ExtensionDAO.find_by_ids(self._model_ids)

        self._models = extensions

        if exceptions:
            raise ExtensionDeleteFailedError(exceptions=exceptions)
