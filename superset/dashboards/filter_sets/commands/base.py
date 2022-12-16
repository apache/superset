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
from typing import cast, Optional

from flask_appbuilder.models.sqla import Model

from superset import security_manager
from superset.common.not_authrized_object import NotAuthorizedException
from superset.dashboards.commands.exceptions import DashboardNotFoundError
from superset.dashboards.dao import DashboardDAO
from superset.dashboards.filter_sets.commands.exceptions import (
    FilterSetForbiddenError,
    FilterSetNotFoundError,
)
from superset.dashboards.filter_sets.consts import USER_OWNER_TYPE
from superset.models.dashboard import Dashboard
from superset.models.filter_set import FilterSet
from superset.utils.core import get_user_id

logger = logging.getLogger(__name__)


class BaseFilterSetCommand:
    # pylint: disable=C0103
    _dashboard: Dashboard
    _filter_set_id: Optional[int]
    _filter_set: Optional[FilterSet]

    def __init__(self, dashboard_id: int):
        self._dashboard_id = dashboard_id

    def run(self) -> Model:
        pass

    def _validate_filterset_dashboard_exists(self) -> None:
        self._dashboard = DashboardDAO.get_by_id_or_slug(str(self._dashboard_id))
        if not self._dashboard:
            raise DashboardNotFoundError()

    def validate_exist_filter_use_cases_set(self) -> None:  # pylint: disable=C0103
        self._validate_filter_set_exists_and_set_when_exists()
        self.check_ownership()

    def _validate_filter_set_exists_and_set_when_exists(self) -> None:
        self._filter_set = self._dashboard.filter_sets.get(
            cast(int, self._filter_set_id), None
        )
        if not self._filter_set:
            raise FilterSetNotFoundError(str(self._filter_set_id))

    def check_ownership(self) -> None:
        try:
            if not security_manager.is_admin():
                filter_set: FilterSet = cast(FilterSet, self._filter_set)
                if filter_set.owner_type == USER_OWNER_TYPE:
                    if get_user_id() != filter_set.owner_id:
                        raise FilterSetForbiddenError(
                            str(self._filter_set_id),
                            "The user is not the owner of the filter_set",
                        )
                elif not security_manager.is_owner(self._dashboard):
                    raise FilterSetForbiddenError(
                        str(self._filter_set_id),
                        "The user is not an owner of the filter_set's dashboard",
                    )
        except NotAuthorizedException as err:
            raise FilterSetForbiddenError(
                str(self._filter_set_id),
                "user not authorized to access the filterset",
            ) from err
        except FilterSetForbiddenError as err:
            raise err
