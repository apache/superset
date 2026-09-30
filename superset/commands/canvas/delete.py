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
"""Delete canvases."""

from __future__ import annotations

from functools import partial

from superset import security_manager
from superset.commands.base import BaseCommand
from superset.commands.canvas.exceptions import (
    CanvasDeleteFailedError,
    CanvasForbiddenError,
    CanvasNotFoundError,
)
from superset.daos.canvas import CanvasDAO
from superset.exceptions import SupersetSecurityException
from superset.models.canvas import Canvas
from superset.utils.decorators import on_error, transaction


class DeleteCanvasCommand(BaseCommand):
    """Delete canvases and their operation logs. Their widgets are not deleted."""

    def __init__(self, model_ids: list[int]) -> None:
        self._model_ids = model_ids
        self._models: list[Canvas] = []

    @transaction(on_error=partial(on_error, reraise=CanvasDeleteFailedError))
    def run(self) -> None:
        self.validate()
        CanvasDAO.delete(self._models)

    def validate(self) -> None:
        self._models = CanvasDAO.find_by_ids(self._model_ids)
        if len(self._models) != len(set(self._model_ids)):
            raise CanvasNotFoundError()
        for canvas in self._models:
            try:
                security_manager.raise_for_editorship(canvas)
            except SupersetSecurityException as ex:
                raise CanvasForbiddenError() from ex
