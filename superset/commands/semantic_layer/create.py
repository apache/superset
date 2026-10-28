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
from flask_babel import lazy_gettext as _
from sqlalchemy.exc import SQLAlchemyError
from superset_core.semantic_layers.view import SemanticView as SemanticViewABC

from superset.commands.base import BaseCommand
from superset.commands.semantic_layer.exceptions import (
    SemanticLayerCreateFailedError,
    SemanticLayerInvalidError,
    SemanticLayerNotFoundError,
    SemanticViewCreateFailedError,
    SemanticViewForbiddenError,
    SemanticViewInvalidError,
)
from superset.commands.semantic_layer.utils import validate_configuration
from superset.commands.utils import current_user_can_modify_object
from superset.daos.semantic_layer import SemanticLayerDAO, SemanticViewDAO
from superset.exceptions import SupersetSecurityException
from superset.semantic_layers.registry import registry
from superset.utils import json
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class CreateSemanticLayerCommand(BaseCommand):
    def __init__(self, data: dict[str, Any]):
        self._properties = data.copy()

    @transaction(
        on_error=partial(
            on_error,
            catches=(SQLAlchemyError, ValueError),
            reraise=SemanticLayerCreateFailedError,
        )
    )
    def run(self) -> Model:
        self.validate()
        if isinstance(self._properties.get("configuration"), dict):
            self._properties["configuration"] = json.dumps(
                self._properties["configuration"]
            )
        return SemanticLayerDAO.create(attributes=self._properties)

    def validate(self) -> None:
        sl_type = self._properties.get("type")
        if sl_type not in registry:
            raise SemanticLayerInvalidError(f"Unknown type: {sl_type}")

        name: str = self._properties.get("name", "")
        if not SemanticLayerDAO.validate_uniqueness(name):
            raise SemanticLayerInvalidError(f"Name already exists: {name}")

        # Validate configuration against the plugin
        cls = registry[sl_type]
        validate_configuration(cls, self._properties["configuration"])


class CreateSemanticViewCommand(BaseCommand):
    def __init__(self, data: dict[str, Any]):
        self._properties = data.copy()

    @transaction(
        on_error=partial(
            on_error,
            catches=(SQLAlchemyError, ValueError),
            reraise=SemanticViewCreateFailedError,
        )
    )
    def run(self) -> Model:
        self.validate()
        if isinstance(self._properties.get("configuration"), dict):
            self._properties["configuration"] = json.dumps(
                self._properties["configuration"]
            )
        return SemanticViewDAO.create(attributes=self._properties)

    def validate(self) -> None:
        layer_uuid: str = self._properties.get("semantic_layer_uuid", "")
        layer = SemanticLayerDAO.find_by_uuid(layer_uuid)
        if not layer:
            raise SemanticLayerNotFoundError()
        try:
            layer.raise_for_access()
        except SupersetSecurityException as ex:
            raise SemanticViewForbiddenError() from ex

        if not current_user_can_modify_object(layer):
            raise SemanticViewForbiddenError()

        name: str = self._properties.get("name", "")
        raw_configuration: dict[str, Any] | str = (
            self._properties.get("configuration") or {}
        )
        try:
            configuration: Any = (
                json.loads(raw_configuration)
                if isinstance(raw_configuration, str)
                else raw_configuration
            )
        except ValueError:
            configuration = None
        if not isinstance(configuration, dict):
            raise SemanticViewInvalidError(
                _("The view configuration must be a JSON object.")
            )
        # Refuse known duplicates before spending a provider lookup on them, so a
        # resent batch reaches its remaining views within the bulk time budget.
        self._validate_uniqueness(name, layer_uuid, configuration)
        try:
            view: SemanticViewABC | None = layer.implementation.get_semantic_view(
                name, configuration
            )
        except Exception as ex:  # pylint: disable=broad-except
            logger.warning(
                "Semantic view lookup failed for layer %s, view %s: %s",
                layer_uuid,
                name,
                type(ex).__name__,
            )
            view = None
        if view is None:
            logger.info(
                "Semantic view lookup produced no view for layer %s, view %s",
                layer_uuid,
                name,
            )
            raise SemanticViewInvalidError(
                _(
                    "Couldn't validate this semantic view: it may not exist, "
                    "or the semantic layer is unreachable."
                )
            ) from None

        # Check again after the lookup to keep the check-to-insert window short.
        # Best effort: under REPEATABLE READ this sees the transaction's snapshot.
        self._validate_uniqueness(name, layer_uuid, configuration)

    @staticmethod
    def _validate_uniqueness(
        name: str, layer_uuid: str, configuration: dict[str, Any]
    ) -> None:
        if not SemanticViewDAO.validate_uniqueness(name, layer_uuid, configuration):
            raise ValueError(
                f"Semantic view '{name}' already exists for this layer"
                " and configuration"
            )
