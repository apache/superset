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
from typing import Optional
from flask_appbuilder.models.sqla import Model
from flask_appbuilder.security.sqla.models import User
from superset.commands.base import BaseCommand
from superset.dashboards.commands.exceptions import DashboardNotFoundError
from superset.dashboards.dao import DashboardDAO
from superset.dashboards.filter_sets.commands.exceptions import FilterSetNotFoundError, FilterSetForbiddenError
from superset.models.dashboard import Dashboard
from superset.models.filter_set import FilterSet
from superset.dashboards.filter_sets.consts import USER_OWNER_TYPE
logger = logging.getLogger(__name__)


class BaseFilterSetCommand(BaseCommand):
    _dashboard: Dashboard
    _filter_set_id: Optional[int]
    _filter_set: Optional[FilterSet]

    def __init__(self, user: User, dashboard_id: int):
        self._actor = user
        self._dashboard_id = dashboard_id

    def run(self) -> Model:
        pass

    def validate(self) -> None:
        self._dashboard = DashboardDAO.get_by_id_or_slug(str(self._dashboard_id))
        if not self._dashboard:
            raise DashboardNotFoundError()

    def is_user_dashboard_owner(self) -> bool:
        return self._dashboard.am_i_owner()

    def validate_exist_filter_use_cases_set(self):
        if self._filter_set_id:
            self._filter_set = self._dashboard.filter_sets.get(self._filter_set_id, None)
            if not self._filter_set:
                raise FilterSetNotFoundError(str(self._filter_set_id))
            self.check_ownership()

    def check_ownership(self):
        if self._filter_set.owner_type == USER_OWNER_TYPE:
            if self._actor.id != self._filter_set.owner_id:
                raise FilterSetForbiddenError(str(self._filter_set_id), "The user is not the owner of the filter_set")
        elif not self.is_user_dashboard_owner():
            raise FilterSetForbiddenError(str(self._filter_set_id), "The user is not an owner of the filter_set's dashboard")
