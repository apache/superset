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
from typing import Any, Callable, TYPE_CHECKING

from flask_babel import _

from superset.common.chart_data import ChartDataResultType
from superset.common.db_query_status import QueryStatus
from superset.exceptions import QueryObjectValidationError, SupersetParseError
from superset.explorables.base import Explorable
from superset.utils.core import (
    extract_display_labels,
    extract_column_dtype,
    extract_dataframe_dtypes,
    ExtraFiltersReasonType,
    get_column_name,
    get_column_names_from_columns,
    get_time_filter_status,
)
from superset.utils.currency import (
    detect_currency,
    detect_currency_from_df,
    has_auto_currency_in_column_config,
)

if TYPE_CHECKING:
    from superset.common.query_context import QueryContext
    from superset.common.query_object import QueryObject

logger = logging.getLogger(__name__)


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


def _detect_currency(
    query_context: QueryContext,
    query_obj: QueryObject,
    datasource: Explorable,
    df: Any = None,
) -> str | None:
    """
    Detect currency from filtered data for AUTO mode currency formatting.

    First attempts to detect from the provided dataframe if the currency
    column is present. Falls back to a separate query only when needed.

    Checks both top-level currency_format (used by Pie, Timeseries, etc.)
    and column_config (used by Table charts) for AUTO currency settings.

    :param query_context: The query context with form_data containing currency_format
    :param query_obj: The original query object with filters
    :param datasource: The datasource being queried
    :param df: Optional dataframe to detect currency from (avoids extra query)
    :return: ISO 4217 currency code (e.g., "USD") or None
    """
    form_data = query_context.form_data or {}

    # Check top-level currency_format (for Pie, Timeseries, etc.)
    currency_format = form_data.get("currency_format", {})
    top_level_auto = (
        isinstance(currency_format, dict) and currency_format.get("symbol") == "AUTO"
    )

    # Check column_config (for Table charts)
    column_config_auto = has_auto_currency_in_column_config(form_data)

    # Only detect if AUTO is configured somewhere
    if not top_level_auto and not column_config_auto:
        return None

    currency_column = getattr(datasource, "currency_code_column", None)
    if not currency_column:
        return None

    if df is not None and currency_column in df.columns:
        return detect_currency_from_df(df, currency_column)

    return detect_currency(
        datasource=datasource,
        filters=query_obj.filter,
        granularity=query_obj.granularity,
        from_dttm=query_obj.from_dttm,
        to_dttm=query_obj.to_dttm,
        extras=query_obj.extras,
    )


def _get_full(
    query_context: QueryContext,
    query_obj: QueryObject,
    force_cached: bool | None = False,
) -> dict[str, Any]:
    datasource = _get_datasource(query_context, query_obj)
    result_type = query_obj.result_type or query_context.result_type
    payload = query_context.get_df_payload(query_obj, force_cached=force_cached)
    df = payload["df"]
    status = payload["status"]
    if status != QueryStatus.FAILED:
        payload["colnames"] = list(df.columns)
        payload["indexnames"] = list(df.index)
        payload["coltypes"] = extract_dataframe_dtypes(df, datasource)
        payload["collabels"] = extract_display_labels(
            payload["label_map"], payload["colnames"], datasource
        )
        payload["data"] = query_context.get_data(df, payload["coltypes"])
        payload["result_format"] = query_context.result_format
        payload["detected_currency"] = _detect_currency(
            query_context, query_obj, datasource, df
        )
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
        return {
            "data": payload.get("data"),
            "colnames": payload.get("colnames"),
            "collabels": payload.get("collabels"),
            "coltypes": payload.get("coltypes"),
            "rowcount": payload.get("rowcount"),
            "sql_rowcount": payload.get("sql_rowcount"),
            "detected_currency": payload.get("detected_currency"),
        }
    return payload


def _get_samples(
    query_context: QueryContext, query_obj: QueryObject, force_cached: bool = False
) -> dict[str, Any]:
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
    return _get_full(query_context, query_obj, force_cached)


def _get_drill_detail(
    query_context: QueryContext, query_obj: QueryObject, force_cached: bool = False
) -> dict[str, Any]:
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
    return _get_full(query_context, query_obj, force_cached)


def _get_results(
    query_context: QueryContext, query_obj: QueryObject, force_cached: bool = False
) -> dict[str, Any]:
    payload = _get_full(query_context, query_obj, force_cached)
    return payload


_result_type_functions: dict[
    ChartDataResultType, Callable[[QueryContext, QueryObject, bool], dict[str, Any]]
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
    ChartDataResultType.DRILL_DETAIL: _get_drill_detail,
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
    if result_func := _result_type_functions.get(result_type):
        return result_func(query_context, query_obj, force_cached)
    raise QueryObjectValidationError(
        _("Invalid result type: %(result_type)s", result_type=result_type)
    )
