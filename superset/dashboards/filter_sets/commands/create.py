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
from typing import Dict, Any
import logging
from flask_appbuilder.models.sqla import Model
from flask_appbuilder.security.sqla.models import User
from superset.dashboards.filter_sets.commands.base import BaseFilterSetCommand
from superset.dashboards.filter_sets.commands.exceptions import UserIsNotDashboardOwnerError
from superset.dashboards.filter_sets.dao import FilterSetDAO
from superset.dashboards.filter_sets.consts import DASHBOARD_ID_FIELD, DASHBOARD_OWNER_TYPE, OWNER_TYPE_FIELD, OWNER_ID_FIELD

logger = logging.getLogger(__name__)


class CreateFilterSetCommand(BaseFilterSetCommand):
    def __init__(self, user: User, dashboard_id: int, data: Dict[str, Any]):
        super().__init__(user, dashboard_id)
        self._properties = data.copy()

    def run(self) -> Model:
        self.validate()
        self._properties[DASHBOARD_ID_FIELD] = self._dashboard.id
        filter_set = FilterSetDAO.create(self._properties, commit=True)
        return filter_set

    def validate(self):
        super().validate()
        if self._properties[OWNER_TYPE_FIELD] == DASHBOARD_OWNER_TYPE:
            if self._properties.get(OWNER_ID_FIELD, self._dashboard_id) != self._dashboard_id:
                raise
            if not self.is_user_dashboard_owner():
                raise UserIsNotDashboardOwnerError(str(self._dashboard_id))

