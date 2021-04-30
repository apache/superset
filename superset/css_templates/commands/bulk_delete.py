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

from superset.commands.base import BaseCommand
from superset.css_templates.commands.exceptions import (
    CssTemplateBulkDeleteFailedError,
    CssTemplateNotFoundError,
)
from superset.css_templates.dao import CssTemplateDAO
from superset.dao.exceptions import DAODeleteFailedError
from superset.models.core import CssTemplate

logger = logging.getLogger(__name__)


class BulkDeleteCssTemplateCommand(BaseCommand):
    def __init__(self, user: User, model_ids: List[int]):
        self._actor = user
        self._model_ids = model_ids
        self._models: Optional[List[CssTemplate]] = None

    def run(self) -> None:
        self.validate()
        try:
            CssTemplateDAO.bulk_delete(self._models)
            return None
        except DAODeleteFailedError as ex:
            logger.exception(ex.exception)
            raise CssTemplateBulkDeleteFailedError()

    def validate(self) -> None:
        # Validate/populate model exists
        self._models = CssTemplateDAO.find_by_ids(self._model_ids)
        if not self._models or len(self._models) != len(self._model_ids):
            raise CssTemplateNotFoundError()
