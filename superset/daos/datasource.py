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
from typing import Union

from superset import db
from superset.connectors.sqla.models import SqlaTable
from superset.daos.base import BaseDAO
from superset.daos.exceptions import DatasourceNotFound, DatasourceTypeNotSupportedError
from superset.models.sql_lab import Query, SavedQuery
from superset.utils.core import DatasourceType

logger = logging.getLogger(__name__)

Datasource = Union[SqlaTable, Query, SavedQuery]


class DatasourceDAO(BaseDAO[Datasource]):
    sources: dict[Union[DatasourceType, str], type[Datasource]] = {
        DatasourceType.TABLE: SqlaTable,
        DatasourceType.QUERY: Query,
        DatasourceType.SAVEDQUERY: SavedQuery,
    }

    @classmethod
    def get_datasource(
        cls,
        datasource_type: Union[DatasourceType, str],
        datasource_id: int,
    ) -> Datasource:
        if datasource_type not in cls.sources:
            raise DatasourceTypeNotSupportedError()

        datasource = (
            db.session.query(cls.sources[datasource_type])
            .filter_by(id=datasource_id)
            .one_or_none()
        )

        if not datasource:
            logger.warning(
                "Datasource not found datasource_type: %s, datasource_id: %s",
                datasource_type,
                datasource_id,
            )
            raise DatasourceNotFound()

        return datasource
