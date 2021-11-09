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

from typing import Any, Dict, List, Optional, TYPE_CHECKING

from superset.common.query_object import QueryObject
from superset.typing import Metric, OrderBy
from superset.utils.core import (
    apply_max_row_limit,
    ChartDataResultType,
    DatasourceDict,
    QueryObjectFilterClause,
)
from superset.utils.date_parser import get_since_until, parse_human_timedelta
from superset.views.utils import get_time_range_endpoints

if TYPE_CHECKING:
    from superset import ConnectorRegistry


class QueryObjectFactory:  # pylint: disable=too-few-public-methods
    def create(  # pylint: disable=too-many-arguments,too-many-locals
        self,
        annotation_layers: Optional[List[Dict[str, Any]]] = None,
        applied_time_extras: Optional[Dict[str, str]] = None,
        apply_fetch_values_predicate: bool = False,
        columns: Optional[List[str]] = None,
        datasource_dict: Optional[DatasourceDict] = None,
        extras: Optional[Dict[str, Any]] = None,
        filters: Optional[List[QueryObjectFilterClause]] = None,
        granularity: Optional[str] = None,
        is_rowcount: bool = False,
        is_timeseries: Optional[bool] = None,
        metrics: Optional[List[Metric]] = None,
        order_desc: bool = True,
        orderby: Optional[List[OrderBy]] = None,
        post_processing: Optional[List[Optional[Dict[str, Any]]]] = None,
        result_type: Optional[ChartDataResultType] = None,
        row_limit: Optional[int] = None,
        row_offset: Optional[int] = None,
        series_columns: Optional[List[str]] = None,
        series_limit: int = 0,
        series_limit_metric: Optional[Metric] = None,
        time_range: Optional[str] = None,
        time_shift: Optional[str] = None,
        **kwargs: Any,
    ) -> QueryObject:
        pass


class QueryObjectFactoryImpl(
    QueryObjectFactory
):  # pylint: disable=too-few-public-methods

    config: Dict[str, Any]
    session_factory: Any
    connector_registry: ConnectorRegistry

    def __init__(
        self,
        config: Dict[str, Any],
        connector_registry: ConnectorRegistry,
        session_factory: Any,
    ):
        self.config = config
        self.connector_registry = connector_registry
        self.session_factory = session_factory

    def create(  # pylint: disable=too-many-arguments, too-many-locals
        self,
        annotation_layers: Optional[List[Dict[str, Any]]] = None,
        applied_time_extras: Optional[Dict[str, str]] = None,
        apply_fetch_values_predicate: bool = False,
        columns: Optional[List[str]] = None,
        datasource_dict: Optional[DatasourceDict] = None,
        extras: Optional[Dict[str, Any]] = None,
        filters: Optional[List[QueryObjectFilterClause]] = None,
        granularity: Optional[str] = None,
        is_rowcount: bool = False,
        is_timeseries: Optional[bool] = None,
        metrics: Optional[List[Metric]] = None,
        order_desc: bool = True,
        orderby: Optional[List[OrderBy]] = None,
        post_processing: Optional[List[Optional[Dict[str, Any]]]] = None,
        result_type: Optional[ChartDataResultType] = None,
        row_limit: Optional[int] = None,
        row_offset: Optional[int] = None,
        series_columns: Optional[List[str]] = None,
        series_limit: int = 0,
        series_limit_metric: Optional[Metric] = None,
        time_range: Optional[str] = None,
        time_shift: Optional[str] = None,
        **kwargs: Any,
    ) -> QueryObject:
        datasource = None
        if datasource_dict:
            datasource = ConnectorRegistry.get_datasource(
                str(datasource_dict["type"]),
                int(datasource_dict["id"]),
                self.session_factory(),
            )
        extras = extras or {}
        from_dttm, to_dttm = get_since_until(
            relative_start=extras.get(
                "relative_start", self.config["DEFAULT_RELATIVE_START_TIME"]
            ),
            relative_end=extras.get(
                "relative_end", self.config["DEFAULT_RELATIVE_END_TIME"]
            ),
            time_range=time_range,
            time_shift=time_shift,
        )
        if row_limit is None:
            row_limit = (
                self.config["SAMPLES_ROW_LIMIT"]
                if result_type == ChartDataResultType.SAMPLES
                else self.config["ROW_LIMIT"]
            )

        actual_row_limit = apply_max_row_limit(row_limit)
        if self.config["SIP_15_ENABLED"]:
            extras["time_range_endpoints"] = get_time_range_endpoints(form_data=extras)

        return QueryObject(
            annotation_layers,
            applied_time_extras,
            apply_fetch_values_predicate,
            columns,
            datasource,
            extras,
            filters,
            granularity,
            is_rowcount,
            is_timeseries,
            metrics,
            order_desc,
            orderby,
            post_processing,
            result_type,
            actual_row_limit,
            row_offset,
            series_columns,
            series_limit,
            series_limit_metric,
            from_dttm,
            to_dttm,
            parse_human_timedelta(time_shift),
            time_range,
            **kwargs,
        )
