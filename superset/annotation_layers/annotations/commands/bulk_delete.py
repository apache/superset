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
from typing import List, Optional

from flask_appbuilder.security.sqla.models import User

from superset.annotation_layers.annotations.commands.exceptions import (
    AnnotationBulkDeleteFailedError,
    AnnotationNotFoundError,
)
from superset.annotation_layers.annotations.dao import AnnotationDAO
from superset.commands.base import BaseCommand
from superset.dao.exceptions import DAODeleteFailedError
from superset.models.annotations import Annotation

logger = logging.getLogger(__name__)


class BulkDeleteAnnotationCommand(BaseCommand):
    def __init__(self, user: User, model_ids: List[int]):
        self._actor = user
        self._model_ids = model_ids
        self._models: Optional[List[Annotation]] = None

    def run(self) -> None:
        self.validate()
        try:
            AnnotationDAO.bulk_delete(self._models)
            return None
        except DAODeleteFailedError as ex:
            logger.exception(ex.exception)
            raise AnnotationBulkDeleteFailedError() from ex

    def validate(self) -> None:
        # Validate/populate model exists
        self._models = AnnotationDAO.find_by_ids(self._model_ids)
        if not self._models or len(self._models) != len(self._model_ids):
            raise AnnotationNotFoundError()
