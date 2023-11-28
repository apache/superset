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
from typing import Any

from flask_appbuilder.models.sqla import Model

from superset.commands.dashboard.filter_set.base import BaseFilterSetCommand
from superset.commands.dashboard.filter_set.exceptions import FilterSetUpdateFailedError
from superset.daos.dashboard import FilterSetDAO
from superset.daos.exceptions import DAOUpdateFailedError
from superset.dashboards.filter_sets.consts import OWNER_ID_FIELD, OWNER_TYPE_FIELD

logger = logging.getLogger(__name__)


class UpdateFilterSetCommand(BaseFilterSetCommand):
    def __init__(self, dashboard_id: int, filter_set_id: int, data: dict[str, Any]):
        super().__init__(dashboard_id)
        self._filter_set_id = filter_set_id
        self._properties = data.copy()

    def run(self) -> Model:
        try:
            self.validate()
            assert self._filter_set

            if (
                OWNER_TYPE_FIELD in self._properties
                and self._properties[OWNER_TYPE_FIELD] == "Dashboard"
            ):
                self._properties[OWNER_ID_FIELD] = self._dashboard_id
            return FilterSetDAO.update(self._filter_set, self._properties, commit=True)
        except DAOUpdateFailedError as err:
            raise FilterSetUpdateFailedError(str(self._filter_set_id), "") from err

    def validate(self) -> None:
        self._validate_filterset_dashboard_exists()
        self.validate_exist_filter_use_cases_set()
