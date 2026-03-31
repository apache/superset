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

from sqlalchemy.exc import SQLAlchemyError

from superset.commands.base import BaseCommand
from superset.commands.semantic_layer.exceptions import (
    SemanticLayerDeleteFailedError,
    SemanticLayerNotFoundError,
    SemanticViewDeleteFailedError,
    SemanticViewNotFoundError,
)
from superset.daos.semantic_layer import SemanticLayerDAO, SemanticViewDAO
from superset.semantic_layers.models import SemanticLayer, SemanticView
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class DeleteSemanticLayerCommand(BaseCommand):
    def __init__(self, uuid: str):
        self._uuid = uuid
        self._model: SemanticLayer | None = None

    @transaction(
        on_error=partial(
            on_error,
            catches=(SQLAlchemyError,),
            reraise=SemanticLayerDeleteFailedError,
        )
    )
    def run(self) -> None:
        self.validate()
        assert self._model
        SemanticLayerDAO.delete([self._model])

    def validate(self) -> None:
        self._model = SemanticLayerDAO.find_by_uuid(self._uuid)
        if not self._model:
            raise SemanticLayerNotFoundError()


class DeleteSemanticViewCommand(BaseCommand):
    def __init__(self, pk: int):
        self._pk = pk
        self._model: SemanticView | None = None

    @transaction(
        on_error=partial(
            on_error,
            catches=(SQLAlchemyError,),
            reraise=SemanticViewDeleteFailedError,
        )
    )
    def run(self) -> None:
        self.validate()
        assert self._model
        SemanticViewDAO.delete([self._model])

    def validate(self) -> None:
        self._model = SemanticViewDAO.find_by_id(self._pk, id_column="id")
        if not self._model:
            raise SemanticViewNotFoundError()


class BulkDeleteSemanticViewCommand(BaseCommand):
    def __init__(self, model_ids: list[int]):
        self._model_ids = model_ids
        self._models: list[SemanticView] = []

    @transaction(
        on_error=partial(
            on_error,
            catches=(SQLAlchemyError,),
            reraise=SemanticViewDeleteFailedError,
        )
    )
    def run(self) -> None:
        self.validate()
        SemanticViewDAO.delete(self._models)

    def validate(self) -> None:
        self._models = SemanticViewDAO.find_by_ids(self._model_ids, id_column="id")
        if len(self._models) != len(self._model_ids):
            raise SemanticViewNotFoundError()
