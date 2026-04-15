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
from __future__ import annotations

from typing import Any, cast, TYPE_CHECKING

from superset.common.chart_data import ChartDataResultType
from superset.common.query_object import QueryObject
from superset.common.utils.time_range_utils import get_since_until_from_time_range
from superset.constants import NO_TIME_RANGE
from superset.superset_typing import Column
from superset.utils.core import (
    apply_max_row_limit,
    DatasourceDict,
    DatasourceType,
    FilterOperator,
    get_x_axis_label,
    QueryObjectFilterClause,
)

if TYPE_CHECKING:
    from superset.connectors.sqla.models import BaseDatasource
    from superset.daos.datasource import DatasourceDAO


def _temporal_filter_col_name(col: Any) -> str | None:
    """Normalize filter ``col`` (str or adhoc dict) for comparison with ``get_x_axis_label``."""
    if col is None:
        return None
    if isinstance(col, dict):
        return col.get("sqlExpression") or col.get("label")
    return str(col)


class QueryObjectFactory:  # pylint: disable=too-few-public-methods
    _config: dict[str, Any]
    _datasource_dao: DatasourceDAO

    def __init__(
        self,
        app_configurations: dict[str, Any],
        _datasource_dao: DatasourceDAO,
    ):
        self._config = app_configurations
        self._datasource_dao = _datasource_dao

    def create(  # pylint: disable=too-many-arguments
        self,
        parent_result_type: ChartDataResultType,
        datasource: DatasourceDict | None = None,
        extras: dict[str, Any] | None = None,
        row_limit: int | None = None,
        time_range: str | None = None,
        time_shift: str | None = None,
        server_pagination: bool | None = None,
        **kwargs: Any,
    ) -> QueryObject:
        datasource_model_instance = None
        if datasource:
            datasource_model_instance = self._convert_to_model(datasource)
        processed_extras = self._process_extras(extras)
        result_type = kwargs.setdefault("result_type", parent_result_type)

        # Process row limit taking server pagination into account
        row_limit = self._process_row_limit(
            row_limit, result_type, server_pagination=server_pagination
        )

        processed_time_range = self._process_time_range(
            time_range, kwargs.get("filters"), kwargs.get("columns")
        )
        from_dttm, to_dttm = get_since_until_from_time_range(
            processed_time_range, time_shift, processed_extras
        )
        kwargs["from_dttm"] = from_dttm
        kwargs["to_dttm"] = to_dttm
        return QueryObject(
            datasource=datasource_model_instance,
            extras=extras,
            row_limit=row_limit,
            time_range=time_range,
            time_shift=time_shift,
            **kwargs,
        )

    def _convert_to_model(self, datasource: DatasourceDict) -> BaseDatasource:
        return self._datasource_dao.get_datasource(
            datasource_type=DatasourceType(datasource["type"]),
            database_id_or_uuid=datasource["id"],
        )

    def _process_extras(
        self,
        extras: dict[str, Any] | None,
    ) -> dict[str, Any]:
        extras = extras or {}
        return extras

    def _process_row_limit(
        self,
        row_limit: int | None,
        result_type: ChartDataResultType,
        server_pagination: bool | None = None,
    ) -> int:
        """Process row limit taking into account server pagination.

        :param row_limit: The requested row limit
        :param result_type: The type of result being processed
        :param server_pagination: Whether server-side pagination is enabled
        :return: The processed row limit
        """
        default_row_limit = (
            self._config["SAMPLES_ROW_LIMIT"]
            if result_type == ChartDataResultType.SAMPLES
            else self._config["ROW_LIMIT"]
        )
        return apply_max_row_limit(
            row_limit or default_row_limit,
            server_pagination=server_pagination,
        )

    @staticmethod
    def _process_time_range(
        time_range: str | None,
        filters: list[QueryObjectFilterClause] | None = None,
        columns: list[Column] | None = None,
    ) -> str:
        if time_range is None:
            time_range = NO_TIME_RANGE
            temporal_flt = [
                flt
                for flt in filters or []
                if flt.get("op") == FilterOperator.TEMPORAL_RANGE
            ]
            if temporal_flt:
                # Prefer TEMPORAL_RANGE on the chart x-axis (BASE_AXIS). Do not blindly use
                # temporal_flt[0]: it may be another datetime (e.g. dashboard filter on event_b
                # while the chart axis is event_a), which would drive wrong from_dttm/to_dttm.
                x_axis_label = get_x_axis_label(columns or [])
                match_flt = [
                    flt
                    for flt in temporal_flt
                    if _temporal_filter_col_name(flt.get("col")) == x_axis_label
                ]
                if match_flt:
                    time_range = cast(str, match_flt[0].get("val"))
                elif x_axis_label is None:
                    # No BASE_AXIS on the query: preserve legacy behavior.
                    time_range = cast(str, temporal_flt[0].get("val"))
                # If x_axis_label is set but match_flt is empty, keep NO_TIME_RANGE (set above).
        return time_range

    # light version of the view.utils.core
    # import view.utils require application context
    # Todo: move it and the view.utils.core to utils package
