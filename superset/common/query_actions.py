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
import copy
from typing import Any, Callable, cast, Dict, List, Optional, TYPE_CHECKING

from flask_babel import _

from superset import app
from superset.common.chart_data import ChartDataResultType
from superset.common.db_query_status import QueryStatus
from superset.connectors.base.models import BaseDatasource
from superset.exceptions import QueryObjectValidationError
from superset.utils.core import (
    extract_column_dtype,
    extract_dataframe_dtypes,
    ExtraFiltersReasonType,
    get_column_name,
    get_time_filter_status,
    is_adhoc_column,
)

if TYPE_CHECKING:
    from superset.common.query_context import QueryContext
    from superset.common.query_object import QueryObject

config = app.config


def _get_datasource(
    query_context: "QueryContext", query_obj: "QueryObject"
) -> BaseDatasource:
    return query_obj.datasource or query_context.datasource


def _get_columns(
    query_context: "QueryContext", query_obj: "QueryObject", _: bool
) -> Dict[str, Any]:
    datasource = _get_datasource(query_context, query_obj)
    return {
        "data": [
            {
                "column_name": col.column_name,
                "verbose_name": col.verbose_name,
                "dtype": extract_column_dtype(col),
            }
            for col in datasource.columns
        ]
    }


def _get_timegrains(
    query_context: "QueryContext", query_obj: "QueryObject", _: bool
) -> Dict[str, Any]:
    datasource = _get_datasource(query_context, query_obj)
    return {
        "data": [
            {
                "name": grain.name,
                "function": grain.function,
                "duration": grain.duration,
            }
            for grain in datasource.database.grains()
        ]
    }


def _get_query(
    query_context: "QueryContext", query_obj: "QueryObject", _: bool,
) -> Dict[str, Any]:
    datasource = _get_datasource(query_context, query_obj)
    result = {"language": datasource.query_language}
    try:
        result["query"] = datasource.get_query_str(query_obj.to_dict())
    except QueryObjectValidationError as err:
        result["error"] = err.message
    return result


def _get_full(
    query_context: "QueryContext",
    query_obj: "QueryObject",
    force_cached: Optional[bool] = False,
) -> Dict[str, Any]:
    datasource = _get_datasource(query_context, query_obj)
    result_type = query_obj.result_type or query_context.result_type
    payload = query_context.get_df_payload(query_obj, force_cached=force_cached)
    applied_template_filters = payload.get("applied_template_filters", [])
    df = payload["df"]
    status = payload["status"]
    if status != QueryStatus.FAILED:
        payload["colnames"] = list(df.columns)
        payload["indexnames"] = list(df.index)
        payload["coltypes"] = extract_dataframe_dtypes(df, datasource)
        payload["data"] = query_context.get_data(df)
        payload["result_format"] = query_context.result_format
    del payload["df"]

    filters = query_obj.filter
    filter_columns = cast(List[str], [flt.get("col") for flt in filters])
    columns = set(datasource.column_names)
    applied_time_columns, rejected_time_columns = get_time_filter_status(
        datasource, query_obj.applied_time_extras
    )
    payload["applied_filters"] = [
        {"column": get_column_name(col)}
        for col in filter_columns
        if is_adhoc_column(col) or col in columns or col in applied_template_filters
    ] + applied_time_columns
    payload["rejected_filters"] = [
        {"reason": ExtraFiltersReasonType.COL_NOT_IN_DATASOURCE, "column": col}
        for col in filter_columns
        if not is_adhoc_column(col)
        and col not in columns
        and col not in applied_template_filters
    ] + rejected_time_columns

    if result_type == ChartDataResultType.RESULTS and status != QueryStatus.FAILED:
        return {"data": payload.get("data")}
    return payload


def _get_samples(
    query_context: "QueryContext", query_obj: "QueryObject", force_cached: bool = False
) -> Dict[str, Any]:
    datasource = _get_datasource(query_context, query_obj)
    query_obj = copy.copy(query_obj)
    query_obj.is_timeseries = False
    query_obj.orderby = []
    query_obj.metrics = []
    query_obj.post_processing = []
    query_obj.columns = [o.column_name for o in datasource.columns]
    return _get_full(query_context, query_obj, force_cached)


def _get_results(
    query_context: "QueryContext", query_obj: "QueryObject", force_cached: bool = False
) -> Dict[str, Any]:
    payload = _get_full(query_context, query_obj, force_cached)
    return {"data": payload.get("data"), "error": payload.get("error")}


_result_type_functions: Dict[
    ChartDataResultType, Callable[["QueryContext", "QueryObject", bool], Dict[str, Any]]
] = {
    ChartDataResultType.COLUMNS: _get_columns,
    ChartDataResultType.TIMEGRAINS: _get_timegrains,
    ChartDataResultType.QUERY: _get_query,
    ChartDataResultType.SAMPLES: _get_samples,
    ChartDataResultType.FULL: _get_full,
    ChartDataResultType.RESULTS: _get_results,
    # for requests for post-processed data we return the full results,
    # and post-process it later where we have the chart context, since
    # post-processing is unique to each visualization type
    ChartDataResultType.POST_PROCESSED: _get_full,
}


def get_query_results(
    result_type: ChartDataResultType,
    query_context: "QueryContext",
    query_obj: "QueryObject",
    force_cached: bool,
) -> Dict[str, Any]:
    """
    Return result payload for a chart data request.

    :param result_type: the type of result to return
    :param query_context: query context to which the query object belongs
    :param query_obj: query object for which to retrieve the results
    :param force_cached: should results be forcefully retrieved from cache
    :raises QueryObjectValidationError: if an unsupported result type is requested
    :return: JSON serializable result payload
    """
    result_func = _result_type_functions.get(result_type)
    if result_func:
        return result_func(query_context, query_obj, force_cached)
    raise QueryObjectValidationError(
        _("Invalid result type: %(result_type)s", result_type=result_type)
    )
