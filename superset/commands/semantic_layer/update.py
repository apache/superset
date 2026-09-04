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

from superset.commands.base import BaseCommand
from superset.commands.semantic_layer.exceptions import (
    SemanticLayerForbiddenError,
    SemanticLayerInvalidError,
    SemanticLayerNotFoundError,
    SemanticLayerUpdateFailedError,
    SemanticViewForbiddenError,
    SemanticViewNotFoundError,
    SemanticViewUpdateFailedError,
)
from superset.commands.utils import current_user_can_modify_object
from superset.constants import PASSWORD_MASK
from superset.daos.semantic_layer import SemanticLayerDAO, SemanticViewDAO
from superset.semantic_layers.models import SemanticLayer, SemanticView
from superset.semantic_layers.registry import registry
from superset.utils import json
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


def _unmask_configuration(
    existing_raw_configuration: str | None,
    new_configuration: dict[str, Any],
) -> dict[str, Any]:
    """
    Replace ``PASSWORD_MASK`` sentinels in an incoming update payload with
    the value already stored.

    The GET/list endpoints mask write-only configuration values (see
    ``superset.semantic_layers.api._mask_configuration``), and fail closed by
    masking every truthy value when the connector's schema can't be
    determined. A client that round-trips that response back on an update
    (e.g. a name-only edit) would otherwise overwrite the real stored
    values -- secret or not -- with the literal mask string. Restore any key
    whose incoming value is exactly the mask sentinel from the stored
    configuration regardless of whether the schema currently marks it
    write-only, since a client only ever sends the sentinel back for a value
    it previously received masked (including a value masked by the
    fail-closed fallback).
    """
    try:
        existing_configuration = (
            json.loads(existing_raw_configuration) if existing_raw_configuration else {}
        )
    except (TypeError, ValueError):
        existing_configuration = {}

    return {
        key: (
            existing_configuration[key]
            if value == PASSWORD_MASK and key in existing_configuration
            else value
        )
        for key, value in new_configuration.items()
    }


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

        if not current_user_can_modify_object(self._model):
            raise SemanticViewForbiddenError()

        name = self._properties.get("name", self._model.name)
        layer_uuid = str(self._model.semantic_layer_uuid)
        configuration = self._properties.get(
            "configuration",
            json.loads(self._model.configuration),
        )
        if not SemanticViewDAO.validate_update_uniqueness(
            view_uuid=str(self._model.uuid),
            name=name,
            layer_uuid=layer_uuid,
            configuration=configuration,
        ):
            raise ValueError(
                f"A semantic view with name '{name}' and the same "
                "configuration already exists in this semantic layer."
            )


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
        if isinstance(self._properties.get("configuration"), dict):
            self._properties["configuration"] = json.dumps(
                self._properties["configuration"]
            )
        return SemanticLayerDAO.update(self._model, attributes=self._properties)

    def validate(self) -> None:
        self._model = SemanticLayerDAO.find_by_uuid(self._uuid)
        if not self._model:
            raise SemanticLayerNotFoundError()

        if not current_user_can_modify_object(self._model):
            raise SemanticLayerForbiddenError()

        name = self._properties.get("name")
        if name and not SemanticLayerDAO.validate_update_uniqueness(self._uuid, name):
            raise SemanticLayerInvalidError(f"Name already exists: {name}")

        if isinstance(self._properties.get("configuration"), dict):
            self._properties["configuration"] = _unmask_configuration(
                self._model.configuration,
                self._properties["configuration"],
            )

        if configuration := self._properties.get("configuration"):
            sl_type = self._model.type
            cls = registry[sl_type]
            cls.from_configuration(configuration)
