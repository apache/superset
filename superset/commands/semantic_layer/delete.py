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
"""Delete semantic layer command."""

from __future__ import annotations

from functools import partial

from superset.commands.base import BaseCommand
from superset.commands.semantic_layer.exceptions import (
    SemanticLayerDeleteFailedError,
    SemanticLayerNotFoundError,
)
from superset.daos.semantic_layer import SemanticLayerDAO
from superset.semantic_layers.models import SemanticLayer
from superset.utils.decorators import on_error, transaction


class DeleteSemanticLayerCommand(BaseCommand):
    """Command to delete a semantic layer."""

    def __init__(self, model_id: str):
        self._model_id = model_id
        self._model: SemanticLayer | None = None

    @transaction(on_error=partial(on_error, reraise=SemanticLayerDeleteFailedError))
    def run(self) -> None:
        """
        Delete a semantic layer.

        Semantic views will be cascade deleted.
        """
        self.validate()
        assert self._model
        SemanticLayerDAO.delete([self._model])

    def validate(self) -> None:
        """
        Validate the semantic layer deletion.

        :raises SemanticLayerNotFoundError: If semantic layer not found
        """
        self._model = SemanticLayerDAO.find_by_id(self._model_id)
        if not self._model:
            raise SemanticLayerNotFoundError()
