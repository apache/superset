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
from typing import Any, Dict, List, Optional

from flask_appbuilder.models.sqla import Model
from flask_appbuilder.security.sqla.models import User
from marshmallow import ValidationError

from superset.annotation_layers.annotations.commands.exceptions import (
    AnnotationCreateFailedError,
    AnnotationDatesValidationError,
    AnnotationInvalidError,
    AnnotationUniquenessValidationError,
)
from superset.annotation_layers.annotations.dao import AnnotationDAO
from superset.annotation_layers.commands.exceptions import AnnotationLayerNotFoundError
from superset.annotation_layers.dao import AnnotationLayerDAO
from superset.commands.base import BaseCommand
from superset.dao.exceptions import DAOCreateFailedError

logger = logging.getLogger(__name__)


class CreateAnnotationCommand(BaseCommand):
    def __init__(self, user: User, data: Dict[str, Any]):
        self._actor = user
        self._properties = data.copy()

    def run(self) -> Model:
        self.validate()
        try:
            annotation = AnnotationDAO.create(self._properties)
        except DAOCreateFailedError as ex:
            logger.exception(ex.exception)
            raise AnnotationCreateFailedError() from ex
        return annotation

    def validate(self) -> None:
        exceptions: List[ValidationError] = []
        layer_id: Optional[int] = self._properties.get("layer")
        start_dttm: Optional[datetime] = self._properties.get("start_dttm")
        end_dttm: Optional[datetime] = self._properties.get("end_dttm")
        short_descr = self._properties.get("short_descr", "")

        # Validate/populate model exists
        if not layer_id and not isinstance(layer_id, int):
            raise AnnotationLayerNotFoundError()
        annotation_layer = AnnotationLayerDAO.find_by_id(layer_id)
        if not annotation_layer:
            raise AnnotationLayerNotFoundError()
        self._properties["layer"] = annotation_layer

        # Validate short descr uniqueness on this layer
        if not AnnotationDAO.validate_update_uniqueness(layer_id, short_descr):
            exceptions.append(AnnotationUniquenessValidationError())

        # validate date time sanity
        if start_dttm and end_dttm and end_dttm < start_dttm:
            exceptions.append(AnnotationDatesValidationError)

        if exceptions:
            exception = AnnotationInvalidError()
            exception.add_list(exceptions)
            raise exception
