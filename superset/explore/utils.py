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
from typing import Optional

from superset import security_manager
from superset.commands.chart.exceptions import (
    ChartAccessDeniedError,
    ChartNotFoundError,
)
from superset.commands.dataset.exceptions import (
    DatasetAccessDeniedError,
    DatasetNotFoundError,
)
from superset.commands.exceptions import (
    DatasourceNotFoundValidationError,
    DatasourceTypeInvalidError,
    QueryNotFoundValidationError,
)
from superset.daos.chart import ChartDAO
from superset.daos.dataset import DatasetDAO
from superset.daos.query import QueryDAO
from superset.utils.core import DatasourceType


def check_dataset_access(dataset_id: int) -> Optional[bool]:
    if dataset_id:
        # Access checks below, no need to validate them twice as they can be expensive.
        dataset = DatasetDAO.find_by_id(dataset_id, skip_base_filter=True)
        if dataset:
            can_access_datasource = security_manager.can_access_datasource(dataset)
            if can_access_datasource:
                return True
            raise DatasetAccessDeniedError()
    raise DatasetNotFoundError()


def check_query_access(query_id: int) -> Optional[bool]:
    if query_id:
        # Access checks below, no need to validate them twice as they can be expensive.
        query = QueryDAO.find_by_id(query_id, skip_base_filter=True)
        if query:
            security_manager.raise_for_access(query=query)
            return True
    raise QueryNotFoundValidationError()


ACCESS_FUNCTION_MAP = {
    DatasourceType.TABLE: check_dataset_access,
    DatasourceType.QUERY: check_query_access,
}


def check_datasource_access(
    datasource_id: int, datasource_type: DatasourceType
) -> Optional[bool]:
    if datasource_id:
        try:
            return ACCESS_FUNCTION_MAP[datasource_type](datasource_id)
        except KeyError as ex:
            raise DatasourceTypeInvalidError() from ex
    raise DatasourceNotFoundValidationError()


def check_access(
    datasource_id: int,
    chart_id: Optional[int],
    datasource_type: DatasourceType,
) -> Optional[bool]:
    check_datasource_access(datasource_id, datasource_type)
    if not chart_id:
        return True
    # Access checks below, no need to validate them twice as they can be expensive.
    chart = ChartDAO.find_by_id(chart_id, skip_base_filter=True)
    if chart:
        can_access_chart = security_manager.is_owner(
            chart
        ) or security_manager.can_access("can_read", "Chart")
        if can_access_chart:
            return True
        raise ChartAccessDeniedError()
    raise ChartNotFoundError()
