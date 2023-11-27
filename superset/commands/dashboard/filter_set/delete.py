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

from superset.commands.dashboard.filter_set.base import BaseFilterSetCommand
from superset.commands.dashboard.filter_set.exceptions import (
    FilterSetDeleteFailedError,
    FilterSetForbiddenError,
    FilterSetNotFoundError,
)
from superset.daos.dashboard import FilterSetDAO
from superset.daos.exceptions import DAODeleteFailedError

logger = logging.getLogger(__name__)


class DeleteFilterSetCommand(BaseFilterSetCommand):
    def __init__(self, dashboard_id: int, filter_set_id: int):
        super().__init__(dashboard_id)
        self._filter_set_id = filter_set_id

    def run(self) -> None:
        self.validate()
        assert self._filter_set

        try:
            FilterSetDAO.delete([self._filter_set])
        except DAODeleteFailedError as err:
            raise FilterSetDeleteFailedError(str(self._filter_set_id), "") from err

    def validate(self) -> None:
        self._validate_filterset_dashboard_exists()
        try:
            self.validate_exist_filter_use_cases_set()
        except FilterSetNotFoundError as err:
            if FilterSetDAO.find_by_id(self._filter_set_id):  # type: ignore
                raise FilterSetForbiddenError(
                    f"the filter-set does not related to dashboard {self._dashboard_id}"
                ) from err
            raise err
