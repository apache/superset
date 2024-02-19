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
from datetime import datetime
from typing import Any, Optional

from flask_appbuilder.models.sqla import Model
from marshmallow import ValidationError

from superset.commands.annotation_layer.annotation.exceptions import (
    AnnotationDatesValidationError,
    AnnotationInvalidError,
    AnnotationNotFoundError,
    AnnotationUniquenessValidationError,
    AnnotationUpdateFailedError,
)
from superset.commands.annotation_layer.exceptions import AnnotationLayerNotFoundError
from superset.commands.base import BaseCommand
from superset.daos.annotation_layer import AnnotationDAO, AnnotationLayerDAO
from superset.daos.exceptions import DAOUpdateFailedError
from superset.models.annotations import Annotation

logger = logging.getLogger(__name__)


class UpdateAnnotationCommand(BaseCommand):
    def __init__(self, model_id: int, data: dict[str, Any]):
        self._model_id = model_id
        self._properties = data.copy()
        self._model: Optional[Annotation] = None

    def run(self) -> Model:
        self.validate()
        assert self._model

        try:
            annotation = AnnotationDAO.update(self._model, self._properties)
        except DAOUpdateFailedError as ex:
            logger.exception(ex.exception)
            raise AnnotationUpdateFailedError() from ex
        return annotation

    def validate(self) -> None:
        exceptions: list[ValidationError] = []
        layer_id: Optional[int] = self._properties.get("layer")
        short_descr: str = self._properties.get("short_descr", "")

        # Validate/populate model exists
        self._model = AnnotationDAO.find_by_id(self._model_id)
        if not self._model:
            raise AnnotationNotFoundError()
        # Validate/populate layer exists
        if layer_id:
            annotation_layer = AnnotationLayerDAO.find_by_id(layer_id)
            if not annotation_layer:
                raise AnnotationLayerNotFoundError()
            self._properties["layer"] = annotation_layer

            # Validate short descr uniqueness on this layer
            if not AnnotationDAO.validate_update_uniqueness(
                layer_id,
                short_descr,
                annotation_id=self._model_id,
            ):
                exceptions.append(AnnotationUniquenessValidationError())
        else:
            self._properties["layer"] = self._model.layer

        # validate date time sanity
        start_dttm: Optional[datetime] = self._properties.get("start_dttm")
        end_dttm: Optional[datetime] = self._properties.get("end_dttm")

        if start_dttm and end_dttm and end_dttm < start_dttm:
            exceptions.append(AnnotationDatesValidationError())

        if exceptions:
            raise AnnotationInvalidError(exceptions=exceptions)
