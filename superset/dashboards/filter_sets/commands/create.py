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

from flask import g
from flask_appbuilder.models.sqla import Model
from flask_appbuilder.security.sqla.models import User

from superset import security_manager
from superset.dashboards.filter_sets.commands.base import BaseFilterSetCommand
from superset.dashboards.filter_sets.commands.exceptions import (
    DashboardIdInconsistencyError,
    FilterSetCreateFailedError,
    UserIsNotDashboardOwnerError,
)
from superset.dashboards.filter_sets.consts import (
    DASHBOARD_ID_FIELD,
    DASHBOARD_OWNER_TYPE,
    OWNER_ID_FIELD,
    OWNER_TYPE_FIELD,
)
from superset.dashboards.filter_sets.dao import FilterSetDAO

logger = logging.getLogger(__name__)


class CreateFilterSetCommand(BaseFilterSetCommand):
    # pylint: disable=C0103
    def __init__(self, user: User, dashboard_id: int, data: Dict[str, Any]):
        super().__init__(user, dashboard_id)
        self._properties = data.copy()

    def run(self) -> Model:
        self.validate()
        self._properties[DASHBOARD_ID_FIELD] = self._dashboard.id
        filter_set = FilterSetDAO.create(self._properties, commit=True)
        return filter_set

    def validate(self) -> None:
        self._validate_filterset_dashboard_exists()
        if self._properties[OWNER_TYPE_FIELD] == DASHBOARD_OWNER_TYPE:
            self._validate_owner_id_is_dashboard_id()
            self._validate_user_is_the_dashboard_owner()
        else:
            self._validate_owner_id_exists()

    def _validate_owner_id_exists(self) -> None:
        owner_id = self._properties[OWNER_ID_FIELD]
        if not (g.user.id == owner_id or security_manager.get_user_by_id(owner_id)):
            raise FilterSetCreateFailedError(
                str(self._dashboard_id), "owner_id does not exists"
            )

    def _validate_user_is_the_dashboard_owner(self) -> None:
        if not self.is_user_dashboard_owner():
            raise UserIsNotDashboardOwnerError(str(self._dashboard_id))

    def _validate_owner_id_is_dashboard_id(self) -> None:
        if (
            self._properties.get(OWNER_ID_FIELD, self._dashboard_id)
            != self._dashboard_id
        ):
            raise DashboardIdInconsistencyError(str(self._dashboard_id))
