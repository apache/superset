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
"""Create semantic view command."""

from __future__ import annotations

from functools import partial
from typing import Any

from flask_appbuilder.models.sqla import Model
from marshmallow.validate import ValidationError

from superset.commands.base import BaseCommand
from superset.commands.semantic_layer.exceptions import SemanticLayerNotFoundError
from superset.commands.semantic_view.exceptions import (
    SemanticViewCreateFailedError,
    SemanticViewExistsValidationError,
    SemanticViewInvalidError,
    SemanticViewRequiredFieldValidationError,
)
from superset.daos.semantic_layer import SemanticLayerDAO, SemanticViewDAO
from superset.utils.decorators import on_error, transaction


class CreateSemanticViewCommand(BaseCommand):
    """Command to create a semantic view."""

    def __init__(self, data: dict[str, Any]):
        self._properties = data.copy()

    @transaction(on_error=partial(on_error, reraise=SemanticViewCreateFailedError))
    def run(self) -> Model:
        """
        Create a semantic view.

        :return: The created semantic view
        """
        self.validate()
        return SemanticViewDAO.create(attributes=self._properties)

    def validate(self) -> None:
        """
        Validate the semantic view data.

        :raises SemanticViewInvalidError: If validation fails
        :raises SemanticLayerNotFoundError: If semantic layer not found
        """
        exceptions: list[ValidationError] = []

        # Validate required fields
        if not self._properties.get("name"):
            exceptions.append(SemanticViewRequiredFieldValidationError("name"))

        layer_uuid = self._properties.get("semantic_layer_uuid")
        if not layer_uuid:
            exceptions.append(
                SemanticViewRequiredFieldValidationError("semantic_layer_uuid")
            )
        else:
            # Validate semantic layer exists
            semantic_layer = SemanticLayerDAO.find_by_id(layer_uuid)
            if not semantic_layer:
                raise SemanticLayerNotFoundError()

            # Validate uniqueness within semantic layer
            name = self._properties.get("name")
            if name and not SemanticViewDAO.validate_uniqueness(name, layer_uuid):
                exceptions.append(SemanticViewExistsValidationError())

        if exceptions:
            exception = SemanticViewInvalidError()
            exception.extend(exceptions)
            raise exception
