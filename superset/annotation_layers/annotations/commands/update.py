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
    AnnotationDatesValidationError,
    AnnotationInvalidError,
    AnnotationNotFoundError,
    AnnotationUpdateFailedError,
)
from superset.annotation_layers.annotations.dao import AnnotationDAO
from superset.commands.base import BaseCommand
from superset.dao.exceptions import DAOUpdateFailedError
from superset.models.annotations import Annotation

logger = logging.getLogger(__name__)


class UpdateAnnotationCommand(BaseCommand):
    def __init__(self, user: User, model_id: int, data: Dict[str, Any]):
        self._actor = user
        self._model_id = model_id
        self._properties = data.copy()
        self._model: Optional[Annotation] = None

    def run(self) -> Model:
        self.validate()
        try:
            annotation = AnnotationDAO.update(
                self._model, self._properties, commit=False
            )
        except DAOUpdateFailedError as ex:
            logger.exception(ex.exception)
            raise AnnotationUpdateFailedError()
        return annotation

    def validate(self) -> None:
        exceptions: List[ValidationError] = list()
        # Validate/populate model exists
        self._model = AnnotationDAO.find_by_id(self._model_id)
        if not self._model:
            raise AnnotationNotFoundError()

        start_dttm: Optional[datetime] = self._properties.get("start_dttm")
        end_dttm: Optional[datetime] = self._properties.get("end_dttm")

        if start_dttm and end_dttm and end_dttm < start_dttm:
            exceptions.append(AnnotationDatesValidationError())

        if exceptions:
            exception = AnnotationInvalidError()
            exception.add_list(exceptions)
            raise exception
