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
"""Update a canvas' properties and sharing."""

from __future__ import annotations

from functools import partial
from typing import Any

from marshmallow import ValidationError

from superset import security_manager
from superset.commands.base import BaseCommand, UpdateMixin
from superset.commands.canvas.exceptions import (
    CanvasForbiddenError,
    CanvasInvalidError,
    CanvasNotFoundError,
    CanvasUpdateFailedError,
)
from superset.commands.utils import compute_subjects
from superset.daos.canvas import CanvasDAO
from superset.exceptions import SupersetSecurityException
from superset.models.canvas import Canvas
from superset.utils.decorators import on_error, transaction


class UpdateCanvasCommand(UpdateMixin, BaseCommand):
    """
    Update title, description, editors and viewers. The definition changes
    only through operations (``ApplyCanvasOperationsCommand``).
    """

    def __init__(self, model_id: int, data: dict[str, Any]) -> None:
        self._model_id = model_id
        self._properties = data.copy()
        self._model: Canvas | None = None

    @transaction(on_error=partial(on_error, reraise=CanvasUpdateFailedError))
    def run(self) -> Canvas:
        self.validate()
        assert self._model is not None  # noqa: S101
        return CanvasDAO.update(self._model, self._properties)

    def validate(self) -> None:
        self._model = CanvasDAO.find_by_id(self._model_id)
        if self._model is None:
            raise CanvasNotFoundError()
        # Editorship is checked on the stored canvas first, so a non-editor
        # cannot add themselves to the editors.
        try:
            security_manager.raise_for_editorship(self._model)
        except SupersetSecurityException as ex:
            raise CanvasForbiddenError() from ex
        exceptions: list[ValidationError] = []
        compute_subjects(self._model, self._properties, exceptions)
        if exceptions:
            raise CanvasInvalidError(exceptions=exceptions)
