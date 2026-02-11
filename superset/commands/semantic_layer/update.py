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
from typing import Any

from flask_appbuilder.models.sqla import Model
from sqlalchemy.exc import SQLAlchemyError

from superset import security_manager
from superset.commands.base import BaseCommand
from superset.commands.semantic_layer.exceptions import (
    SemanticLayerInvalidError,
    SemanticLayerNotFoundError,
    SemanticLayerUpdateFailedError,
    SemanticViewForbiddenError,
    SemanticViewNotFoundError,
    SemanticViewUpdateFailedError,
)
from superset.daos.semantic_layer import SemanticLayerDAO, SemanticViewDAO
from superset.exceptions import SupersetSecurityException
from superset.semantic_layers.models import SemanticLayer, SemanticView
from superset.semantic_layers.registry import registry
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class UpdateSemanticViewCommand(BaseCommand):
    def __init__(self, model_id: int, data: dict[str, Any]):
        self._model_id = model_id
        self._properties = data.copy()
        self._model: SemanticView | None = None

    @transaction(
        on_error=partial(
            on_error,
            catches=(SQLAlchemyError, ValueError),
            reraise=SemanticViewUpdateFailedError,
        )
    )
    def run(self) -> Model:
        self.validate()
        assert self._model
        return SemanticViewDAO.update(self._model, attributes=self._properties)

    def validate(self) -> None:
        self._model = SemanticViewDAO.find_by_id(self._model_id)
        if not self._model:
            raise SemanticViewNotFoundError()

        try:
            security_manager.raise_for_ownership(self._model)
        except SupersetSecurityException as ex:
            raise SemanticViewForbiddenError() from ex


class UpdateSemanticLayerCommand(BaseCommand):
    def __init__(self, uuid: str, data: dict[str, Any]):
        self._uuid = uuid
        self._properties = data.copy()
        self._model: SemanticLayer | None = None

    @transaction(
        on_error=partial(
            on_error,
            catches=(SQLAlchemyError, ValueError),
            reraise=SemanticLayerUpdateFailedError,
        )
    )
    def run(self) -> Model:
        self.validate()
        assert self._model
        return SemanticLayerDAO.update(self._model, attributes=self._properties)

    def validate(self) -> None:
        self._model = SemanticLayerDAO.find_by_uuid(self._uuid)
        if not self._model:
            raise SemanticLayerNotFoundError()

        name = self._properties.get("name")
        if name and not SemanticLayerDAO.validate_update_uniqueness(self._uuid, name):
            raise SemanticLayerInvalidError(f"Name already exists: {name}")

        if configuration := self._properties.get("configuration"):
            sl_type = self._model.type
            cls = registry[sl_type]
            cls.from_configuration(configuration)
