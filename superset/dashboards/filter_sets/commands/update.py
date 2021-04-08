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
from typing import Any, Dict

from flask_appbuilder.models.sqla import Model
from flask_appbuilder.security.sqla.models import User

from superset.dao.exceptions import DAOUpdateFailedError
from superset.dashboards.filter_sets.commands.base import BaseFilterSetCommand
from superset.dashboards.filter_sets.commands.exceptions import (
    FilterSetUpdateFailedError,
)
from superset.dashboards.filter_sets.consts import DASHBOARD_ID_FIELD
from superset.dashboards.filter_sets.dao import FilterSetDAO

logger = logging.getLogger(__name__)


class UpdateFilterSetCommand(BaseFilterSetCommand):
    def __init__(
        self, user: User, dashboard_id: int, filter_set_id: int, data: Dict[str, Any]
    ):
        super().__init__(user, dashboard_id)
        self._filter_set_id = filter_set_id
        self._properties = data.copy()

    def run(self) -> Model:
        try:
            self.validate()
            self._properties[DASHBOARD_ID_FIELD] = self._dashboard_id
            return FilterSetDAO.update(self._filter_set, self._properties, commit=True)
        except DAOUpdateFailedError as e:
            raise FilterSetUpdateFailedError(str(self._filter_set_id), "", e)

    def validate(self) -> None:
        super().validate()
        self.validate_exist_filter_use_cases_set()
