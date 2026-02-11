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
    SemanticLayerCreateFailedError,
    SemanticLayerInvalidError,
)
from superset.daos.semantic_layer import SemanticLayerDAO
from superset.semantic_layers.registry import registry
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
        return SemanticLayerDAO.create(attributes=self._properties)

    def validate(self) -> None:
        sl_type = self._properties.get("type")
        if sl_type not in registry:
            raise SemanticLayerInvalidError(f"Unknown type: {sl_type}")

        name = self._properties.get("name")
        if not SemanticLayerDAO.validate_uniqueness(name):
            raise SemanticLayerInvalidError(f"Name already exists: {name}")

        # Validate configuration against the plugin
        cls = registry[sl_type]
        cls.from_configuration(self._properties["configuration"])
