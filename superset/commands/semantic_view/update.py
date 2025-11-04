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
"""Update semantic view command."""

from __future__ import annotations

from functools import partial
from typing import Any

from flask_appbuilder.models.sqla import Model
from marshmallow.validate import ValidationError

from superset.commands.base import BaseCommand
from superset.commands.semantic_view.exceptions import (
    SemanticViewExistsValidationError,
    SemanticViewInvalidError,
    SemanticViewNotFoundError,
    SemanticViewUpdateFailedError,
)
from superset.daos.semantic_layer import SemanticViewDAO
from superset.semantic_layers.models import SemanticView
from superset.utils.decorators import on_error, transaction


class UpdateSemanticViewCommand(BaseCommand):
    """Command to update a semantic view."""

    def __init__(self, model_id: str, data: dict[str, Any]):
        self._properties = data.copy()
        self._model_id = model_id
        self._model: SemanticView | None = None

    @transaction(on_error=partial(on_error, reraise=SemanticViewUpdateFailedError))
    def run(self) -> Model:
        """
        Update a semantic view.

        :return: The updated semantic view
        """
        self.validate()
        assert self._model

        return SemanticViewDAO.update(self._model, self._properties)

    def validate(self) -> None:
        """
        Validate the semantic view update.

        :raises SemanticViewNotFoundError: If semantic view not found
        :raises SemanticViewInvalidError: If validation fails
        """
        exceptions: list[ValidationError] = []

        # Find the model
        self._model = SemanticViewDAO.find_by_id(self._model_id)
        if not self._model:
            raise SemanticViewNotFoundError()

        # Validate uniqueness if name is being changed
        if name := self._properties.get("name"):
            if not SemanticViewDAO.validate_update_uniqueness(
                self._model_id, name, self._model.semantic_layer_uuid
            ):
                exceptions.append(SemanticViewExistsValidationError())

        if exceptions:
            exception = SemanticViewInvalidError()
            exception.extend(exceptions)
            raise exception
