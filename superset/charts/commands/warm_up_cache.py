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


from typing import Any, Dict, List, Optional

import simplejson as json
from flask import g

from superset.charts.commands.exceptions import (
    WarmUpCacheChartNotFoundError,
    WarmUpCacheParametersExpectedError,
    WarmUpCacheTableNotFoundError,
)
from superset.commands.base import BaseCommand
from superset.connectors.sqla.models import SqlaTable
from superset.extensions import db
from superset.models.core import Database
from superset.models.slice import Slice
from superset.utils.core import error_msg_from_exception
from superset.views.utils import get_dashboard_extra_filters, get_form_data, get_viz


class WarmUpCacheCommand(BaseCommand):
    # pylint: disable=too-many-arguments
    def __init__(
        self,
        chart_id: Optional[int],
        dashboard_id: Optional[int],
        table_name: Optional[str],
        db_name: Optional[str],
        extra_filters: Optional[str],
    ):
        self._chart_id = chart_id
        self._dashboard_id = dashboard_id
        self._table_name = table_name
        self._db_name = db_name
        self._extra_filters = extra_filters
        self._charts: List[Slice] = []

    def run(self) -> List[Dict[str, Any]]:
        self.validate()
        result: List[Dict[str, Any]] = []
        for chart in self._charts:
            try:
                form_data = get_form_data(chart.id, use_slice_data=True)[0]
                if self._dashboard_id:
                    form_data["extra_filters"] = (
                        json.loads(self._extra_filters)
                        if self._extra_filters
                        else get_dashboard_extra_filters(chart.id, self._dashboard_id)
                    )

                if not chart.datasource:
                    raise Exception("Slice's datasource does not exist")

                obj = get_viz(
                    datasource_type=chart.datasource.type,
                    datasource_id=chart.datasource.id,
                    form_data=form_data,
                    force=True,
                )

                # pylint: disable=assigning-non-slot
                g.form_data = form_data
                payload = obj.get_payload()
                delattr(g, "form_data")
                error = payload["errors"] or None
                status = payload["status"]
            except Exception as ex:  # pylint: disable=broad-except
                error = error_msg_from_exception(ex)
                status = None

            result.append(
                {"chart_id": chart.id, "viz_error": error, "viz_status": status}
            )

        return result

    def validate(self) -> None:
        if not self._chart_id and not (self._table_name and self._db_name):
            raise WarmUpCacheParametersExpectedError()
        if self._chart_id:
            self._charts = db.session.query(Slice).filter_by(id=self._chart_id).all()
            if not self._charts:
                raise WarmUpCacheChartNotFoundError()
        elif self._table_name and self._db_name:
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
