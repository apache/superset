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
import logging
from typing import Any, Optional

from flask_appbuilder.models.sqla import Model
from marshmallow import ValidationError

from superset.commands.annotation_layer.exceptions import (
    AnnotationLayerInvalidError,
    AnnotationLayerNameUniquenessValidationError,
    AnnotationLayerNotFoundError,
    AnnotationLayerUpdateFailedError,
)
from superset.commands.base import BaseCommand
from superset.daos.annotation_layer import AnnotationLayerDAO
from superset.daos.exceptions import DAOUpdateFailedError
from superset.models.annotations import AnnotationLayer

logger = logging.getLogger(__name__)


class UpdateAnnotationLayerCommand(BaseCommand):
    def __init__(self, model_id: int, data: dict[str, Any]):
        self._model_id = model_id
        self._properties = data.copy()
        self._model: Optional[AnnotationLayer] = None

    def run(self) -> Model:
        self.validate()
        assert self._model

        try:
            annotation_layer = AnnotationLayerDAO.update(self._model, self._properties)
        except DAOUpdateFailedError as ex:
            logger.exception(ex.exception)
            raise AnnotationLayerUpdateFailedError() from ex
        return annotation_layer

    def validate(self) -> None:
        exceptions: list[ValidationError] = []
        name = self._properties.get("name", "")
        self._model = AnnotationLayerDAO.find_by_id(self._model_id)

        if not self._model:
            raise AnnotationLayerNotFoundError()

        if not AnnotationLayerDAO.validate_update_uniqueness(
            name, layer_id=self._model_id
        ):
            exceptions.append(AnnotationLayerNameUniquenessValidationError())

        if exceptions:
            raise AnnotationLayerInvalidError(exceptions=exceptions)
