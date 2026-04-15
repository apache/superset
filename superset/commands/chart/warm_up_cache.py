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


from typing import Any, cast, Optional, Union

from flask import g

from superset.commands.base import BaseCommand
from superset.commands.chart.data.get_data_command import ChartDataCommand
from superset.commands.chart.exceptions import (
    ChartInvalidError,
    WarmUpCacheChartNotFoundError,
)
from superset.common.db_query_status import QueryStatus
from superset.extensions import db
from superset.models.slice import Slice
from superset.utils import json
from superset.utils.core import error_msg_from_exception, QueryObjectFilterClause
from superset.views.utils import get_dashboard_extra_filters, get_form_data, get_viz
from superset.viz import viz_types


class ChartWarmUpCacheCommand(BaseCommand):
    def __init__(
        self,
        chart_or_id: Union[int, Slice],
        dashboard_id: Optional[int],
        extra_filters: Optional[str],
    ):
        self._chart_or_id = chart_or_id
        self._dashboard_id = dashboard_id
        self._extra_filters = extra_filters

    def _get_dashboard_filters(self, chart_id: int) -> list[dict[str, Any]]:
        """Retrieve dashboard filters from extra_filters or dashboard metadata."""
        if not self._dashboard_id:
            return []

        if self._extra_filters:
            return json.loads(self._extra_filters)

        return get_dashboard_extra_filters(chart_id, self._dashboard_id)

    def _warm_up_legacy_cache(
        self, chart: Slice, form_data: dict[str, Any]
    ) -> tuple[Any, Any]:
        """Warm up cache for legacy visualizations."""
        if not chart.datasource:
            raise ChartInvalidError("Chart's datasource does not exist")

        if self._dashboard_id:
            form_data["extra_filters"] = self._get_dashboard_filters(chart.id)

        g.form_data = form_data
        payload = get_viz(
            datasource_type=chart.datasource.type,
            datasource_id=chart.datasource.id,
            form_data=form_data,
            force=True,
        ).get_payload()
        delattr(g, "form_data")

        return payload["errors"] or None, payload["status"]

    def _warm_up_non_legacy_cache(self, chart: Slice) -> tuple[Any, Any]:
        """Warm up cache for non-legacy visualizations."""
        query_context = chart.get_query_context()

        if not query_context:
            raise ChartInvalidError("Chart's query context does not exist")

        # Apply dashboard filters if dashboard_id is provided
        if dashboard_filters := self._get_dashboard_filters(chart.id):
            for query in query_context.queries:
                query.filter.extend(
                    cast(list[QueryObjectFilterClause], dashboard_filters)
                )

        query_context.force = True
        command = ChartDataCommand(query_context)
        command.validate()
        payload = command.run()

        # Report the first error.
        for query_result in cast(list[dict[str, Any]], payload["queries"]):
            error = query_result.get("error")
            status = query_result.get("status")
            if error is not None:
                return error, status

        return None, QueryStatus.SUCCESS

    def run(self) -> dict[str, Any]:
        self.validate()
        chart = cast(Slice, self._chart_or_id)

        try:
            form_data = get_form_data(chart.id, use_slice_data=True)[0]

            if form_data.get("viz_type") in viz_types:
                error, status = self._warm_up_legacy_cache(chart, form_data)
            else:
                error, status = self._warm_up_non_legacy_cache(chart)
        except Exception as ex:  # pylint: disable=broad-except
            error = error_msg_from_exception(ex)
            status = None

        return {"chart_id": chart.id, "viz_error": error, "viz_status": status}

    def validate(self) -> None:
        if isinstance(self._chart_or_id, Slice):
            return
        chart = db.session.query(Slice).filter_by(id=self._chart_or_id).scalar()
        if not chart:
            raise WarmUpCacheChartNotFoundError()
        self._chart_or_id = chart
