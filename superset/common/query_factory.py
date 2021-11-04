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

import logging
from typing import Any, Dict, List, Optional

from superset import app, ConnectorRegistry, db
from superset.common.query_context import QueryContext
from superset.common.query_object import QueryObject
from superset.typing import Metric, OrderBy
from superset.utils.core import (
    apply_max_row_limit,
    ChartDataResultFormat,
    ChartDataResultType,
    DatasourceDict,
    QueryObjectFilterClause,
)
from superset.utils.date_parser import get_since_until, parse_human_timedelta
from superset.views.utils import get_time_range_endpoints

config = app.config
logger = logging.getLogger(__name__)


class QueryContextFactory:
    @classmethod
    def create(  # pylint: disable=too-many-arguments
        cls,
        datasource_dict: DatasourceDict,
        queries_dicts: List[Dict[str, Any]],
        force: bool = False,
        custom_cache_timeout: Optional[int] = None,
        result_type: ChartDataResultType = ChartDataResultType.FULL,
        result_format: Optional[ChartDataResultFormat] = None,
    ) -> QueryContext:
        datasource = ConnectorRegistry.get_datasource(
            str(datasource_dict["type"]), int(datasource_dict["id"]), db.session
        )
        queries = cls.create_queries_object(queries_dicts, result_type)
        return QueryContext(
            datasource,
            queries,
            force,
            custom_cache_timeout,
            result_type,
            result_format,
            raw_datasource=datasource_dict,  # type: ignore
            raw_queries=queries_dicts,
        )

    @staticmethod
    def create_queries_object(
        queries_dicts: List[Dict[str, Any]], result_type: ChartDataResultType
    ) -> List[QueryObject]:
        for qd in queries_dicts:
            qd.setdefault("result_type", result_type)
        queries = [
            QueryObjectFactory.create(**query_obj) for query_obj in queries_dicts
        ]
        return queries


class QueryObjectFactory:  # pylint: disable=too-few-public-methods
    @classmethod
    def create(  # pylint: disable=too-many-arguments, too-many-locals
        cls,
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
                str(datasource_dict["type"]), int(datasource_dict["id"]), db.session
            )
        extras = extras or {}
        from_dttm, to_dttm = get_since_until(
            relative_start=extras.get(
                "relative_start", config["DEFAULT_RELATIVE_START_TIME"]
            ),
            relative_end=extras.get(
                "relative_end", config["DEFAULT_RELATIVE_END_TIME"]
            ),
            time_range=time_range,
            time_shift=time_shift,
        )
        if row_limit is None:
            row_limit = (
                config["SAMPLES_ROW_LIMIT"]
                if result_type == ChartDataResultType.SAMPLES
                else config["ROW_LIMIT"]
            )

        actual_row_limit = apply_max_row_limit(row_limit)
        if config["SIP_15_ENABLED"]:
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
