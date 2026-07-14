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

import copy
import logging
import time
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Callable, TYPE_CHECKING

from flask_babel import _

from superset.common.chart_data import ChartDataResultType
from superset.common.chart_data_timing import (
    active_source_collector,
    CacheWriteOutcome,
    combine_acquisition_timings,
    QueryAcquisitionResult,
    QueryAcquisitionTiming,
    QueryDataResult,
    SourceKind,
    SourceTimingCollector,
)
from superset.common.db_query_status import QueryStatus
from superset.exceptions import QueryObjectValidationError, SupersetParseError
from superset.explorables.base import Explorable
from superset.utils.core import (
    extract_column_dtype,
    extract_dataframe_dtypes,
    ExtraFiltersReasonType,
    get_column_name,
    get_time_filter_status,
)
from superset.utils.currency import (
    detect_currency_from_df,
    has_auto_currency_in_column_config,
)

if TYPE_CHECKING:
    from superset.common.query_context import QueryContext
    from superset.common.query_object import QueryObject

logger = logging.getLogger(__name__)

_DATA_RESULT_TYPES: frozenset[ChartDataResultType] = frozenset(
    {
        ChartDataResultType.FULL,
        ChartDataResultType.RESULTS,
        ChartDataResultType.POST_PROCESSED,
        ChartDataResultType.SAMPLES,
        ChartDataResultType.DRILL_DETAIL,
    }
)


def is_data_result_type(result_type: ChartDataResultType) -> bool:
    """Return whether a result type requires dataframe acquisition."""

    return result_type in _DATA_RESULT_TYPES


def get_effective_result_type(
    query_context: QueryContext,
    query_obj: QueryObject,
) -> ChartDataResultType:
    """Resolve a query-level result override against its context default."""

    return query_obj.result_type or query_context.result_type


@dataclass(frozen=True)
class AcquiredQuery:
    """Prepared query and its cache-aware dataframe acquisition."""

    query_obj: QueryObject
    acquisition: QueryAcquisitionResult
    detected_currency: str | None
    currency_processing_ns: int


def _get_datasource(query_context: QueryContext, query_obj: QueryObject) -> Explorable:
    return query_obj.datasource or query_context.datasource


def _get_columns(
    query_context: QueryContext, query_obj: QueryObject, _: bool
) -> dict[str, Any]:
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
    query_context: QueryContext, query_obj: QueryObject, _: bool
) -> dict[str, Any]:
    datasource = _get_datasource(query_context, query_obj)
    # Use the new get_time_grains() method from Explorable protocol
    grains = datasource.get_time_grains()
    return {"data": grains}


def _get_query(
    query_context: QueryContext,
    query_obj: QueryObject,
    _: bool,
) -> dict[str, Any]:
    datasource = _get_datasource(query_context, query_obj)
    result = {"language": datasource.query_language}
    try:
        result["query"] = datasource.get_query_str(query_obj.to_dict())
    except QueryObjectValidationError as err:
        # Validation errors (missing required fields, invalid config)
        # No SQL was generated
        result["error"] = err.message
    except SupersetParseError as err:
        # Parsing errors (SQL optimization/parsing failed)
        # SQL was generated but couldn't be optimized - show both
        if err.error.extra and (sql := err.error.extra.get("sql")) is not None:
            result["query"] = sql
        result["error"] = err.error.message
    return result


def _acquire_currency_dependency(
    query_context: QueryContext,
    query_obj: QueryObject,
    acquisition: QueryAcquisitionResult,
    force_cached: bool,
    detect_value: bool = True,
) -> tuple[QueryAcquisitionResult, str | None, int]:
    """Acquire AUTO currency metadata through the normal cache-aware path."""
    datasource = _get_datasource(query_context, query_obj)
    form_data = query_context.form_data or {}
    currency_format = form_data.get("currency_format", {})
    auto_enabled = (
        isinstance(currency_format, dict) and currency_format.get("symbol") == "AUTO"
    ) or has_auto_currency_in_column_config(form_data)
    currency_column = getattr(datasource, "currency_code_column", None)
    if not auto_enabled or not currency_column:
        return acquisition, None, 0
    if acquisition.payload["status"] == QueryStatus.FAILED:
        return acquisition, None, 0
    if currency_column in acquisition.payload["df"].columns:
        if not detect_value:
            return acquisition, None, 0
        processing_start_ns = time.perf_counter_ns()
        detected_currency = detect_currency_from_df(
            acquisition.payload["df"], currency_column
        )
        return (
            acquisition,
            detected_currency,
            max(0, time.perf_counter_ns() - processing_start_ns),
        )

    currency_query = copy.copy(query_obj)
    currency_query.columns = [currency_column]
    currency_query.metrics = []
    currency_query.is_timeseries = False
    currency_query.orderby = []
    currency_query.post_processing = []
    currency_query.annotation_layers = []
    currency_query.time_offsets = []
    currency_query.series_limit = 0
    currency_query.row_limit = 2
    currency_query.row_offset = 0
    dependency = query_context.get_df_payload_result(
        currency_query,
        force_cached=force_cached,
        source_kind=SourceKind.CURRENCY_DETECTION,
    )
    combined = QueryAcquisitionResult(
        payload=acquisition.payload,
        timing=combine_acquisition_timings(acquisition.timing, dependency.timing),
    )
    if not detect_value or dependency.payload["status"] == QueryStatus.FAILED:
        return combined, None, 0
    processing_start_ns = time.perf_counter_ns()
    detected_currency = detect_currency_from_df(
        dependency.payload["df"], currency_column
    )
    return (
        combined,
        detected_currency,
        max(0, time.perf_counter_ns() - processing_start_ns),
    )


def _materialize_full(
    query_context: QueryContext,
    query_obj: QueryObject,
    acquisition: QueryAcquisitionResult,
    detected_currency: str | None = None,
    pre_materialization_ns: int = 0,
) -> QueryDataResult:
    """Materialize one acquired dataframe and complete its timing sidecar."""
    materialization_start_ns = time.perf_counter_ns()
    datasource = _get_datasource(query_context, query_obj)
    result_type = get_effective_result_type(query_context, query_obj)
    payload = acquisition.payload
    df = payload["df"]
    status = payload["status"]
    if status != QueryStatus.FAILED:
        payload["colnames"] = list(df.columns)
        payload["indexnames"] = list(df.index)
        payload["coltypes"] = extract_dataframe_dtypes(df, datasource)
        payload["data"] = query_context.get_data(df, payload["coltypes"])
        payload["result_format"] = query_context.result_format
        payload["detected_currency"] = detected_currency
    del payload["df"]

    applied_time_columns, rejected_time_columns = get_time_filter_status(
        datasource, query_obj.applied_time_extras
    )

    applied_filter_columns = payload.get("applied_filter_columns", [])
    rejected_filter_columns = payload.get("rejected_filter_columns", [])
    del payload["applied_filter_columns"]
    del payload["rejected_filter_columns"]
    payload["applied_filters"] = [
        {"column": get_column_name(col)} for col in applied_filter_columns
    ] + applied_time_columns
    payload["rejected_filters"] = [
        {
            "reason": ExtraFiltersReasonType.COL_NOT_IN_DATASOURCE,
            "column": get_column_name(col),
        }
        for col in rejected_filter_columns
    ] + rejected_time_columns

    if result_type == ChartDataResultType.RESULTS and status != QueryStatus.FAILED:
        result = {
            "data": payload.get("data"),
            "colnames": payload.get("colnames"),
            "coltypes": payload.get("coltypes"),
            "rowcount": payload.get("rowcount"),
            "sql_rowcount": payload.get("sql_rowcount"),
            "detected_currency": payload.get("detected_currency"),
        }
        payload = result
    materialization_ns = pre_materialization_ns + max(
        0, time.perf_counter_ns() - materialization_start_ns
    )
    return QueryDataResult(
        payload=payload,
        timing=acquisition.timing.materialized(materialization_ns),
    )


def _metadata_result(render: Callable[[], dict[str, Any]]) -> QueryDataResult:
    """Render metadata while retaining datasource work in the timing sidecar."""

    start_ns = time.perf_counter_ns()
    collector = SourceTimingCollector()
    with collector.activated():
        payload = render()
    elapsed_ns = max(0, time.perf_counter_ns() - start_ns)
    sources = collector.snapshot()
    if (parent_collector := active_source_collector()) is not None:
        parent_collector.attach(sources)
    source_ns = min(elapsed_ns, sum(source.total_ns for source in sources))
    return QueryDataResult(
        payload=payload,
        timing=QueryAcquisitionTiming(
            cache_key_ns=0,
            cache_read_ns=0,
            source_ns=source_ns,
            cache_write_ns=None,
            cache_write_outcome=CacheWriteOutcome.NOT_ATTEMPTED,
            cache_hit=None,
            sources=sources,
        ).materialized(elapsed_ns - source_ns),
    )


def acquire_query_data(
    result_type: ChartDataResultType,
    query_context: QueryContext,
    query_obj: QueryObject,
    force_cached: bool,
    *,
    detect_currency_value: bool = True,
    cache_key_extra: Mapping[str, Any] | None = None,
) -> AcquiredQuery | None:
    """Prepare and acquire dataframe-backed query data without materializing it."""

    prepared = query_obj
    if result_type == ChartDataResultType.SAMPLES:
        prepared = _prepare_samples_query(query_context, query_obj)
    elif result_type == ChartDataResultType.DRILL_DETAIL:
        prepared = _prepare_drill_detail_query(query_context, query_obj)
    elif not is_data_result_type(result_type):
        return None

    acquisition = query_context.get_df_payload_result(
        prepared,
        force_cached=force_cached,
        cache_key_extra=cache_key_extra,
    )
    acquisition, detected_currency, currency_processing_ns = (
        _acquire_currency_dependency(
            query_context,
            prepared,
            acquisition,
            force_cached,
            detect_value=detect_currency_value,
        )
    )
    return AcquiredQuery(
        query_obj=prepared,
        acquisition=acquisition,
        detected_currency=detected_currency,
        currency_processing_ns=currency_processing_ns,
    )


def materialize_acquired_query(
    query_context: QueryContext,
    acquired: AcquiredQuery,
) -> QueryDataResult:
    """Materialize an acquired dataframe into the requested response format."""

    return _materialize_full(
        query_context,
        acquired.query_obj,
        acquired.acquisition,
        acquired.detected_currency,
        acquired.currency_processing_ns,
    )


def cache_acquired_query(acquired: AcquiredQuery) -> QueryDataResult:
    """Return cache-only metadata without serializing the acquired dataframe."""

    cache_payload = {
        key: value for key, value in acquired.acquisition.payload.items() if key != "df"
    }
    return QueryDataResult(
        payload=cache_payload,
        timing=acquired.acquisition.timing.materialized(0),
    )


def _prepare_samples_query(
    query_context: QueryContext, query_obj: QueryObject
) -> QueryObject:
    datasource = _get_datasource(query_context, query_obj)
    query_obj = copy.copy(query_obj)
    query_obj.is_timeseries = False
    query_obj.orderby = []
    query_obj.metrics = None
    query_obj.post_processing = []
    qry_obj_cols = []
    for o in datasource.columns:
        if isinstance(o, dict):
            if column_name := o.get("column_name"):
                qry_obj_cols.append(column_name)
        else:
            qry_obj_cols.append(o.column_name)
    query_obj.columns = qry_obj_cols
    query_obj.from_dttm = None
    query_obj.to_dttm = None
    return query_obj


def _prepare_drill_detail_query(
    query_context: QueryContext, query_obj: QueryObject
) -> QueryObject:
    # todo(yongjie): Remove this function,
    #  when determining whether samples should be applied to the time filter.
    datasource = _get_datasource(query_context, query_obj)
    query_obj = copy.copy(query_obj)
    query_obj.is_timeseries = False
    query_obj.metrics = None
    query_obj.post_processing = []
    qry_obj_cols = []
    for o in datasource.columns:
        if isinstance(o, dict):
            if column_name := o.get("column_name"):
                qry_obj_cols.append(column_name)
        else:
            qry_obj_cols.append(o.column_name)
    query_obj.columns = qry_obj_cols
    query_obj.orderby = [(query_obj.columns[0], True)]
    return query_obj


_result_type_functions: dict[
    ChartDataResultType, Callable[[QueryContext, QueryObject, bool], dict[str, Any]]
] = {
    ChartDataResultType.COLUMNS: _get_columns,
    ChartDataResultType.TIMEGRAINS: _get_timegrains,
    ChartDataResultType.QUERY: _get_query,
}


def get_query_results(
    result_type: ChartDataResultType,
    query_context: QueryContext,
    query_obj: QueryObject,
    force_cached: bool,
) -> dict[str, Any]:
    """
    Return result payload for a chart data request.

    :param result_type: the type of result to return
    :param query_context: query context to which the query object belongs
    :param query_obj: query object for which to retrieve the results
    :param force_cached: should results be forcefully retrieved from cache
    :raises QueryObjectValidationError: if an unsupported result type is requested
    :return: JSON serializable result payload
    """
    return get_query_results_with_timing(
        result_type, query_context, query_obj, force_cached
    ).payload


def get_query_results_with_timing(
    result_type: ChartDataResultType,
    query_context: QueryContext,
    query_obj: QueryObject,
    force_cached: bool,
) -> QueryDataResult:
    """Return a query payload with a completed timing sidecar."""
    if acquired := acquire_query_data(
        result_type, query_context, query_obj, force_cached
    ):
        return materialize_acquired_query(query_context, acquired)
    if result_func := _result_type_functions.get(result_type):
        return _metadata_result(
            lambda: result_func(query_context, query_obj, force_cached)
        )
    raise QueryObjectValidationError(
        _("Invalid result type: %(result_type)s", result_type=result_type)
    )


def get_query_results_cache_only(
    result_type: ChartDataResultType,
    query_context: QueryContext,
    query_obj: QueryObject,
) -> QueryDataResult:
    """Acquire and cache source data without response materialization."""
    if acquired := acquire_query_data(
        result_type,
        query_context,
        query_obj,
        False,
        detect_currency_value=False,
    ):
        return cache_acquired_query(acquired)

    if result_func := _result_type_functions.get(result_type):
        return _metadata_result(lambda: result_func(query_context, query_obj, False))
    raise QueryObjectValidationError(
        _("Invalid result type: %(result_type)s", result_type=result_type)
    )
