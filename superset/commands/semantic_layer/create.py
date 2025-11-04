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
"""Create semantic layer command."""

from __future__ import annotations

from functools import partial
from typing import Any

from flask_appbuilder.models.sqla import Model
from marshmallow.validate import ValidationError

from superset.commands.base import BaseCommand
from superset.commands.semantic_layer.exceptions import (
    SemanticLayerCreateFailedError,
    SemanticLayerExistsValidationError,
    SemanticLayerInvalidError,
    SemanticLayerRequiredFieldValidationError,
)
from superset.daos.semantic_layer import SemanticLayerDAO
from superset.utils.decorators import on_error, transaction


class CreateSemanticLayerCommand(BaseCommand):
    """Command to create a semantic layer."""

    def __init__(self, data: dict[str, Any]):
        self._properties = data.copy()

    @transaction(on_error=partial(on_error, reraise=SemanticLayerCreateFailedError))
    def run(self) -> Model:
        """
        Create a semantic layer.

        :return: The created semantic layer
        """
        self.validate()
        return SemanticLayerDAO.create(attributes=self._properties)

    def validate(self) -> None:
        """
        Validate the semantic layer data.

        :raises SemanticLayerInvalidError: If validation fails
        """
        exceptions: list[ValidationError] = []

        # Validate required fields
        if not self._properties.get("name"):
            exceptions.append(SemanticLayerRequiredFieldValidationError("name"))

        if not self._properties.get("type"):
            exceptions.append(SemanticLayerRequiredFieldValidationError("type"))

        # Validate uniqueness
        name = self._properties.get("name")
        if name and not SemanticLayerDAO.validate_uniqueness(name):
            exceptions.append(SemanticLayerExistsValidationError())

        if exceptions:
            exception = SemanticLayerInvalidError()
            exception.extend(exceptions)
            raise exception
