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


from typing import Any, Optional

from superset.commands.base import BaseCommand
from superset.commands.chart.warm_up_cache import ChartWarmUpCacheCommand
from superset.commands.dataset.exceptions import WarmUpCacheTableNotFoundError
from superset.connectors.sqla.models import SqlaTable
from superset.extensions import db
from superset.models.core import Database
from superset.models.slice import Slice


class DatasetWarmUpCacheCommand(BaseCommand):
    def __init__(
        self,
        db_name: str,
        table_name: str,
        dashboard_id: Optional[int],
        extra_filters: Optional[str],
    ):
        self._db_name = db_name
        self._table_name = table_name
        self._dashboard_id = dashboard_id
        self._extra_filters = extra_filters
        self._charts: list[Slice] = []

    def run(self) -> list[dict[str, Any]]:
        self.validate()
        return [
            ChartWarmUpCacheCommand(
                chart,
                self._dashboard_id,
                self._extra_filters,
            ).run()
            for chart in self._charts
        ]

    def validate(self) -> None:
        table = (
            db.session.query(SqlaTable)
            .join(Database)
            .filter(
                Database.database_name == self._db_name,
                SqlaTable.table_name == self._table_name,
            )
        ).one_or_none()
        if not table:
            raise WarmUpCacheTableNotFoundError()
        self._charts = (
            db.session.query(Slice)
            .filter_by(datasource_id=table.id, datasource_type=table.type)
            .all()
        )
