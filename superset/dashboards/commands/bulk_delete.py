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
from superset.commands.exceptions import DeleteFailedError
from superset.dashboards.commands.exceptions import (
    DashboardBulkDeleteFailedError,
    DashboardForbiddenError,
    DashboardNotFoundError,
)
from superset.dashboards.dao import DashboardDAO
from superset.exceptions import SupersetSecurityException
from superset.models.dashboard import Dashboard
from superset.views.base import check_ownership

logger = logging.getLogger(__name__)


class BulkDeleteDashboardCommand(BaseCommand):
    def __init__(self, user: User, model_ids: List[int]):
        self._actor = user
        self._model_ids = model_ids
        self._models: Optional[List[Dashboard]] = None

    def run(self) -> None:
        self.validate()
        try:
            DashboardDAO.bulk_delete(self._models)
            return None
        except DeleteFailedError as ex:
            logger.exception(ex.exception)
            raise DashboardBulkDeleteFailedError()

    def validate(self) -> None:
        # Validate/populate model exists
        self._models = DashboardDAO.find_by_ids(self._model_ids)
        if not self._models or len(self._models) != len(self._model_ids):
            raise DashboardNotFoundError()
        # Check ownership
        for model in self._models:
            try:
                check_ownership(model)
            except SupersetSecurityException:
                raise DashboardForbiddenError()
