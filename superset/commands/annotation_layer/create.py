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
from functools import partial
from typing import Any

from flask_appbuilder.models.sqla import Model
from marshmallow import ValidationError

from superset.commands.annotation_layer.exceptions import (
    AnnotationLayerCreateFailedError,
    AnnotationLayerInvalidError,
    AnnotationLayerNameUniquenessValidationError,
)
from superset.commands.base import BaseCommand
from superset.daos.annotation_layer import AnnotationLayerDAO
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class CreateAnnotationLayerCommand(BaseCommand):
    def __init__(self, data: dict[str, Any]):
        self._properties = data.copy()

    @transaction(on_error=partial(on_error, reraise=AnnotationLayerCreateFailedError))
    def run(self) -> Model:
        self.validate()
        return AnnotationLayerDAO.create(attributes=self._properties)

    def validate(self) -> None:
        exceptions: list[ValidationError] = []

        name = self._properties.get("name", "")

        if not AnnotationLayerDAO.validate_update_uniqueness(name):
            exceptions.append(AnnotationLayerNameUniquenessValidationError())

        if exceptions:
            raise AnnotationLayerInvalidError(exceptions=exceptions)
