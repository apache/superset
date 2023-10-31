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

from datetime import datetime
from typing import Any, TYPE_CHECKING

from superset.common.chart_data import ChartDataResultType
from superset.common.query_object import QueryObject
from superset.common.utils.time_range_utils import get_since_until_from_time_range
from superset.utils.core import (
    apply_max_row_limit,
    DatasourceDict,
    DatasourceType,
    FilterOperator,
    QueryObjectFilterClause,
)

if TYPE_CHECKING:
    from sqlalchemy.orm import sessionmaker

    from superset.connectors.base.models import BaseColumn, BaseDatasource
    from superset.daos.datasource import DatasourceDAO


class QueryObjectFactory:  # pylint: disable=too-few-public-methods
    _config: dict[str, Any]
    _datasource_dao: DatasourceDAO
    _session_maker: sessionmaker

    def __init__(
        self,
        app_configurations: dict[str, Any],
        _datasource_dao: DatasourceDAO,
        session_maker: sessionmaker,
    ):
        self._config = app_configurations
        self._datasource_dao = _datasource_dao
        self._session_maker = session_maker

    def create(  # pylint: disable=too-many-arguments
        self,
        parent_result_type: ChartDataResultType,
        datasource: DatasourceDict | None = None,
        extras: dict[str, Any] | None = None,
        row_limit: int | None = None,
        time_range: str | None = None,
        time_shift: str | None = None,
        **kwargs: Any,
    ) -> QueryObject:
        datasource_model_instance = None
        if datasource:
            datasource_model_instance = self._convert_to_model(datasource)
        processed_extras = self._process_extras(extras)
        result_type = kwargs.setdefault("result_type", parent_result_type)
        row_limit = self._process_row_limit(row_limit, result_type)
        from_dttm, to_dttm = get_since_until_from_time_range(
            time_range, time_shift, processed_extras
        )
        kwargs["from_dttm"] = from_dttm
        kwargs["to_dttm"] = to_dttm
        if datasource_model_instance and kwargs.get("filters", []):
            kwargs["filters"] = self._process_filters(
                datasource_model_instance, kwargs["filters"]
            )
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
            datasource_id=int(datasource["id"]),
            session=self._session_maker(),
        )

    def _process_extras(
        self,
        extras: dict[str, Any] | None,
    ) -> dict[str, Any]:
        extras = extras or {}
        return extras

    def _process_row_limit(
        self, row_limit: int | None, result_type: ChartDataResultType
    ) -> int:
        default_row_limit = (
            self._config["SAMPLES_ROW_LIMIT"]
            if result_type == ChartDataResultType.SAMPLES
            else self._config["ROW_LIMIT"]
        )
        return apply_max_row_limit(row_limit or default_row_limit)

    # light version of the view.utils.core
    # import view.utils require application context
    # Todo: move it and the view.utils.core to utils package

    def _process_filters(
        self, datasource: BaseDatasource, query_filters: list[QueryObjectFilterClause]
    ) -> list[QueryObjectFilterClause]:
        def get_dttm_filter_value(
            value: Any, col: BaseColumn, date_format: str
        ) -> int | str:
            if not isinstance(value, int):
                return value
            if date_format in {"epoch_ms", "epoch_s"}:
                if date_format == "epoch_s":
                    value = str(value)
                else:
                    value = str(value * 1000)
            else:
                dttm = datetime.utcfromtimestamp(value / 1000)
                value = dttm.strftime(date_format)

            if col.type in col.num_types:
                value = int(value)
            return value

        for query_filter in query_filters:
            if query_filter.get("op") == FilterOperator.TEMPORAL_RANGE:
                continue
            filter_col = query_filter.get("col")
            if not isinstance(filter_col, str):
                continue
            column = datasource.get_column(filter_col)
            if not column:
                continue
            filter_value = query_filter.get("val")

            date_format = column.python_date_format
            if not date_format and datasource.db_extra:
                date_format = datasource.db_extra.get(
                    "python_date_format_by_column_name", {}
                ).get(column.column_name)

            if column.is_dttm and date_format:
                if isinstance(filter_value, list):
                    query_filter["val"] = [
                        get_dttm_filter_value(value, column, date_format)
                        for value in filter_value
                    ]
                else:
                    query_filter["val"] = get_dttm_filter_value(
                        filter_value, column, date_format
                    )

        return query_filters
