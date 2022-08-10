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

from flask_appbuilder.models.sqla import Model

from superset.dao.exceptions import DAODeleteFailedError
from superset.dashboards.filter_sets.commands.base import BaseFilterSetCommand
from superset.dashboards.filter_sets.commands.exceptions import (
    FilterSetDeleteFailedError,
    FilterSetForbiddenError,
    FilterSetNotFoundError,
)
from superset.dashboards.filter_sets.dao import FilterSetDAO

logger = logging.getLogger(__name__)


class DeleteFilterSetCommand(BaseFilterSetCommand):
    def __init__(self, dashboard_id: int, filter_set_id: int):
        super().__init__(dashboard_id)
        self._filter_set_id = filter_set_id

    def run(self) -> Model:
        try:
            self.validate()
            return FilterSetDAO.delete(self._filter_set, commit=True)
        except DAODeleteFailedError as err:
            raise FilterSetDeleteFailedError(str(self._filter_set_id), "") from err

    def validate(self) -> None:
        self._validate_filterset_dashboard_exists()
        try:
            self.validate_exist_filter_use_cases_set()
        except FilterSetNotFoundError as err:
            if FilterSetDAO.find_by_id(self._filter_set_id):  # type: ignore
                raise FilterSetForbiddenError(
                    'the filter-set does not related to dashboard "%s"'
                    % str(self._dashboard_id)
                ) from err
            raise err
