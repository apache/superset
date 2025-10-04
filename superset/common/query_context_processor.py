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
import re
from datetime import datetime
from typing import Any, cast, ClassVar, TYPE_CHECKING, TypedDict

import numpy as np
import pandas as pd
from flask import current_app
from flask_babel import gettext as _
from pandas import DateOffset

from superset.common.chart_data import ChartDataResultFormat
from superset.common.db_query_status import QueryStatus
from superset.common.query_actions import get_query_results
from superset.common.utils import dataframe_utils
from superset.common.utils.query_cache_manager import QueryCacheManager
from superset.common.utils.time_range_utils import (
    get_since_until_from_query_object,
    get_since_until_from_time_range,
)
from superset.connectors.sqla.models import BaseDatasource
from superset.constants import CACHE_DISABLED_TIMEOUT, CacheRegion, TimeGrain
from superset.daos.annotation_layer import AnnotationLayerDAO
from superset.daos.chart import ChartDAO
from superset.exceptions import (
    InvalidPostProcessingError,
    QueryObjectValidationError,
    SupersetException,
)
from superset.extensions import cache_manager, feature_flag_manager, security_manager
from superset.models.helpers import QueryResult
from superset.models.sql_lab import Query
from superset.superset_typing import AdhocColumn, AdhocMetric
from superset.utils import csv, excel
from superset.utils.cache import generate_cache_key, set_and_log_cache
from superset.utils.core import (
    DatasourceType,
    DateColumn,
    DTTM_ALIAS,
    error_msg_from_exception,
    FilterOperator,
    GenericDataType,
    get_base_axis_labels,
    get_column_names_from_columns,
    get_column_names_from_metrics,
    get_metric_names,
    get_x_axis_label,
    is_adhoc_column,
    is_adhoc_metric,
    normalize_dttm_col,
    QueryObjectFilterClause,
    TIME_COMPARISON,
)
from superset.utils.date_parser import get_past_or_future, normalize_time_delta
from superset.utils.pandas_postprocessing.utils import unescape_separator
from superset.views.utils import get_viz
from superset.viz import viz_types

if TYPE_CHECKING:
    from superset.common.query_context import QueryContext
    from superset.common.query_object import QueryObject

logger = logging.getLogger(__name__)

# Offset join column suffix used for joining offset results
OFFSET_JOIN_COLUMN_SUFFIX = "__offset_join_column_"

# This only includes time grains that may influence
# the temporal column used for joining offset results.
# Given that we don't allow time shifts smaller than a day,
# we don't need to include smaller time grains aggregations.
AGGREGATED_JOIN_GRAINS = {
    TimeGrain.WEEK,
    TimeGrain.WEEK_STARTING_SUNDAY,
    TimeGrain.WEEK_STARTING_MONDAY,
    TimeGrain.WEEK_ENDING_SATURDAY,
    TimeGrain.WEEK_ENDING_SUNDAY,
    TimeGrain.MONTH,
    TimeGrain.QUARTER,
    TimeGrain.YEAR,
}

# Right suffix used for joining offset results
R_SUFFIX = "__right_suffix"


class CachedTimeOffset(TypedDict):
    df: pd.DataFrame
    queries: list[str]
    cache_keys: list[str | None]


class QueryContextProcessor:
    """
    The query context contains the query object and additional fields necessary
    to retrieve the data payload for a given viz.
    """

    _query_context: QueryContext
    _qc_datasource: BaseDatasource

    def __init__(self, query_context: QueryContext):
        self._query_context = query_context
        self._qc_datasource = query_context.datasource

    cache_type: ClassVar[str] = "df"
    enforce_numerical_metrics: ClassVar[bool] = True

    def get_df_payload(
        self, query_obj: QueryObject, force_cached: bool | None = False
    ) -> dict[str, Any]:
        """Handles caching around the df payload retrieval"""
        if query_obj:
            # Always validate the query object before generating cache key
            # This ensures sanitize_clause() is called and extras are normalized
            query_obj.validate()

        cache_key = self.query_cache_key(query_obj)
        timeout = self.get_cache_timeout()
        force_query = self._query_context.force or timeout == CACHE_DISABLED_TIMEOUT
        cache = QueryCacheManager.get(
            key=cache_key,
            region=CacheRegion.DATA,
            force_query=force_query,
            force_cached=force_cached,
        )

        if query_obj and cache_key and not cache.is_loaded:
            try:
                if invalid_columns := [
                    col
                    for col in get_column_names_from_columns(query_obj.columns)
                    + get_column_names_from_metrics(query_obj.metrics or [])
                    if (
                        col not in self._qc_datasource.column_names
                        and col != DTTM_ALIAS
                    )
                ]:
                    raise QueryObjectValidationError(
                        _(
                            "Columns missing in dataset: %(invalid_columns)s",
                            invalid_columns=invalid_columns,
                        )
                    )

                query_result = self.get_query_result(query_obj)
                annotation_data = self.get_annotation_data(query_obj)
                cache.set_query_result(
                    key=cache_key,
                    query_result=query_result,
                    annotation_data=annotation_data,
                    force_query=force_query,
                    timeout=self.get_cache_timeout(),
                    datasource_uid=self._qc_datasource.uid,
                    region=CacheRegion.DATA,
                )
            except QueryObjectValidationError as ex:
                cache.error_message = str(ex)
                cache.status = QueryStatus.FAILED

        # the N-dimensional DataFrame has converted into flat DataFrame
        # by `flatten operator`, "comma" in the column is escaped by `escape_separator`
        # the result DataFrame columns should be unescaped
        label_map = {
            unescape_separator(col): [
                unescape_separator(col) for col in re.split(r"(?<!\\),\s", col)
            ]
            for col in cache.df.columns.values
        }
        label_map.update(
            {
                column_name: [
                    (
                        str(query_obj.columns[idx])
                        if not is_adhoc_column(query_obj.columns[idx])
                        else cast(AdhocColumn, query_obj.columns[idx])["sqlExpression"]
                    ),
                ]
                for idx, column_name in enumerate(query_obj.column_names)
            }
        )
        label_map.update(
            {
                metric_name: [
                    (
                        str(query_obj.metrics[idx])
                        if not is_adhoc_metric(query_obj.metrics[idx])
                        else (
                            str(
                                cast(AdhocMetric, query_obj.metrics[idx])[
                                    "sqlExpression"
                                ]
                            )
                            if cast(AdhocMetric, query_obj.metrics[idx])[
                                "expressionType"
                            ]
                            == "SQL"
                            else metric_name
                        )
                    ),
                ]
                for idx, metric_name in enumerate(query_obj.metric_names)
                if query_obj and query_obj.metrics
            }
        )
        cache.df.columns = [unescape_separator(col) for col in cache.df.columns.values]

        return {
            "cache_key": cache_key,
            "cached_dttm": cache.cache_dttm,
            "cache_timeout": self.get_cache_timeout(),
            "df": cache.df,
            "applied_template_filters": cache.applied_template_filters,
            "applied_filter_columns": cache.applied_filter_columns,
            "rejected_filter_columns": cache.rejected_filter_columns,
            "annotation_data": cache.annotation_data,
            "error": cache.error_message,
            "is_cached": cache.is_cached,
            "query": cache.query,
            "status": cache.status,
            "stacktrace": cache.stacktrace,
            "rowcount": len(cache.df.index),
            "sql_rowcount": cache.sql_rowcount,
            "from_dttm": query_obj.from_dttm,
            "to_dttm": query_obj.to_dttm,
            "label_map": label_map,
        }

    def query_cache_key(self, query_obj: QueryObject, **kwargs: Any) -> str | None:
        """
        Returns a QueryObject cache key for objects in self.queries
        """
        datasource = self._qc_datasource
        extra_cache_keys = datasource.get_extra_cache_keys(query_obj.to_dict())

        cache_key = (
            query_obj.cache_key(
                datasource=datasource.uid,
                extra_cache_keys=extra_cache_keys,
                rls=security_manager.get_rls_cache_key(datasource),
                changed_on=datasource.changed_on,
                **kwargs,
            )
            if query_obj
            else None
        )
        return cache_key

    def get_query_result(self, query_object: QueryObject) -> QueryResult:
        """Returns a pandas dataframe based on the query object"""
        query_context = self._query_context
        # Here, we assume that all the queries will use the same datasource, which is
        # a valid assumption for current setting. In the long term, we may
        # support multiple queries from different data sources.

        query = ""
        if isinstance(query_context.datasource, Query):
            # todo(hugh): add logic to manage all sip68 models here
            result = query_context.datasource.exc_query(query_object.to_dict())
        else:
            result = query_context.datasource.query(query_object.to_dict())
            query = result.query + ";\n\n"

        df = result.df
        # Transform the timestamp we received from database to pandas supported
        # datetime format. If no python_date_format is specified, the pattern will
        # be considered as the default ISO date format
        # If the datetime format is unix, the parse will use the corresponding
        # parsing logic
        if not df.empty:
            df = self.normalize_df(df, query_object)

            if query_object.time_offsets:
                time_offsets = self.processing_time_offsets(df, query_object)
                df = time_offsets["df"]
                queries = time_offsets["queries"]

                query += ";\n\n".join(queries)
                query += ";\n\n"

            # Re-raising QueryObjectValidationError
            try:
                df = query_object.exec_post_processing(df)
            except InvalidPostProcessingError as ex:
                raise QueryObjectValidationError(ex.message) from ex

        result.df = df
        result.query = query
        result.from_dttm = query_object.from_dttm
        result.to_dttm = query_object.to_dttm
        return result

    def normalize_df(self, df: pd.DataFrame, query_object: QueryObject) -> pd.DataFrame:
        # todo: should support "python_date_format" and "get_column" in each datasource
        def _get_timestamp_format(
            source: BaseDatasource, column: str | None
        ) -> str | None:
            column_obj = source.get_column(column)
            if (
                column_obj
                # only sqla column was supported
                and hasattr(column_obj, "python_date_format")
                and (formatter := column_obj.python_date_format)
            ):
                return str(formatter)

            return None

        datasource = self._qc_datasource
        labels = tuple(
            label
            for label in [
                *get_base_axis_labels(query_object.columns),
                query_object.granularity,
            ]
            if datasource
            # Query datasource didn't support `get_column`
            and hasattr(datasource, "get_column")
            and (col := datasource.get_column(label))
            # todo(hugh) standardize column object in Query datasource
            and (col.get("is_dttm") if isinstance(col, dict) else col.is_dttm)
        )
        dttm_cols = [
            DateColumn(
                timestamp_format=_get_timestamp_format(datasource, label),
                offset=datasource.offset,
                time_shift=query_object.time_shift,
                col_label=label,
            )
            for label in labels
            if label
        ]
        if DTTM_ALIAS in df:
            dttm_cols.append(
                DateColumn.get_legacy_time_column(
                    timestamp_format=_get_timestamp_format(
                        datasource, query_object.granularity
                    ),
                    offset=datasource.offset,
                    time_shift=query_object.time_shift,
                )
            )
        normalize_dttm_col(
            df=df,
            dttm_cols=tuple(dttm_cols),
        )

        if self.enforce_numerical_metrics:
            dataframe_utils.df_metrics_to_num(df, query_object)

        df.replace([np.inf, -np.inf], np.nan, inplace=True)

        return df

    @staticmethod
    def get_time_grain(query_object: QueryObject) -> Any | None:
        if (
            query_object.columns
            and len(query_object.columns) > 0
            and isinstance(query_object.columns[0], dict)
        ):
            # If the time grain is in the columns it will be the first one
            # and it will be of AdhocColumn type
            return query_object.columns[0].get("timeGrain")

        return query_object.extras.get("time_grain_sqla")

    # pylint: disable=too-many-arguments
    def add_offset_join_column(
        self,
        df: pd.DataFrame,
        name: str,
        time_grain: str,
        time_offset: str | None = None,
        join_column_producer: Any = None,
    ) -> None:
        """
        Adds an offset join column to the provided DataFrame.

        The function modifies the DataFrame in-place.

        :param df: pandas DataFrame to which the offset join column will be added.
        :param name: The name of the new column to be added.
        :param time_grain: The time grain used to calculate the new column.
        :param time_offset: The time offset used to calculate the new column.
        :param join_column_producer: A function to generate the join column.
        """
        if join_column_producer:
            df[name] = df.apply(lambda row: join_column_producer(row, 0), axis=1)
        else:
            df[name] = df.apply(
                lambda row: self.generate_join_column(row, 0, time_grain, time_offset),
                axis=1,
            )

    def is_valid_date(self, date_string: str) -> bool:
        try:
            # Attempt to parse the string as a date in the format YYYY-MM-DD
            datetime.strptime(date_string, "%Y-%m-%d")
            return True
        except ValueError:
            # If parsing fails, it's not a valid date in the format YYYY-MM-DD
            return False

    def is_valid_date_range(self, date_range: str) -> bool:
        try:
            # Attempt to parse the string as a date range in the format
            # YYYY-MM-DD:YYYY-MM-DD
            start_date, end_date = date_range.split(":")
            datetime.strptime(start_date.strip(), "%Y-%m-%d")
            datetime.strptime(end_date.strip(), "%Y-%m-%d")
            return True
        except ValueError:
            # If parsing fails, it's not a valid date range in the format
            # YYYY-MM-DD:YYYY-MM-DD
            return False

    def get_offset_custom_or_inherit(
        self,
        offset: str,
        outer_from_dttm: datetime,
        outer_to_dttm: datetime,
    ) -> str:
        """
        Get the time offset for custom or inherit.

        :param offset: The offset string.
        :param outer_from_dttm: The outer from datetime.
        :param outer_to_dttm: The outer to datetime.
        :returns: The time offset.
        """
        if offset == "inherit":
            # return the difference in days between the from and the to dttm formatted as a string with the " days ago" suffix  # noqa: E501
            return f"{(outer_to_dttm - outer_from_dttm).days} days ago"
        if self.is_valid_date(offset):
            # return the offset as the difference in days between the outer from dttm and the offset date (which is a YYYY-MM-DD string) formatted as a string with the " days ago" suffix  # noqa: E501
            offset_date = datetime.strptime(offset, "%Y-%m-%d")
            return f"{(outer_from_dttm - offset_date).days} days ago"
        return ""

    def processing_time_offsets(  # pylint: disable=too-many-locals,too-many-statements # noqa: C901
        self,
        df: pd.DataFrame,
        query_object: QueryObject,
    ) -> CachedTimeOffset:
        """
        Process time offsets for time comparison feature.

        This method handles both relative time offsets (e.g., "1 week ago") and
        absolute date range offsets (e.g., "2015-01-03 : 2015-01-04").
        """
        query_context = self._query_context
        # ensure query_object is immutable
        query_object_clone = copy.copy(query_object)
        queries: list[str] = []
        cache_keys: list[str | None] = []
        offset_dfs: dict[str, pd.DataFrame] = {}

        outer_from_dttm, outer_to_dttm = get_since_until_from_query_object(query_object)
        if not outer_from_dttm or not outer_to_dttm:
            raise QueryObjectValidationError(
                _(
                    "An enclosed time range (both start and end) must be specified "
                    "when using a Time Comparison."
                )
            )

        time_grain = self.get_time_grain(query_object)
        metric_names = get_metric_names(query_object.metrics)
        # use columns that are not metrics as join keys
        join_keys = [col for col in df.columns if col not in metric_names]

        for offset in query_object.time_offsets:
            try:
                original_offset = offset
                is_date_range_offset = self.is_valid_date_range(offset)

                if is_date_range_offset and feature_flag_manager.is_feature_enabled(
                    "DATE_RANGE_TIMESHIFTS_ENABLED"
                ):
                    # DATE RANGE OFFSET LOGIC (like "2015-01-03 : 2015-01-04")
                    try:
                        # Parse the specified range
                        offset_from_dttm, offset_to_dttm = (
                            get_since_until_from_time_range(time_range=offset)
                        )
                    except ValueError as ex:
                        raise QueryObjectValidationError(str(ex)) from ex

                    # Use the specified range directly
                    query_object_clone.from_dttm = offset_from_dttm
                    query_object_clone.to_dttm = offset_to_dttm

                    # For date range offsets, we must NOT set inner bounds
                    # These create additional WHERE clauses that conflict with our
                    # date range
                    query_object_clone.inner_from_dttm = None
                    query_object_clone.inner_to_dttm = None

                elif is_date_range_offset:
                    # Date range timeshift feature is disabled
                    raise QueryObjectValidationError(
                        "Date range timeshifts are not enabled. "
                        "Please contact your administrator to enable the "
                        "DATE_RANGE_TIMESHIFTS_ENABLED feature flag."
                    )

                else:
                    # RELATIVE OFFSET LOGIC (like "1 day ago")
                    if self.is_valid_date(offset) or offset == "inherit":
                        offset = self.get_offset_custom_or_inherit(
                            offset,
                            outer_from_dttm,
                            outer_to_dttm,
                        )
                    query_object_clone.from_dttm = get_past_or_future(
                        offset,
                        outer_from_dttm,
                    )
                    query_object_clone.to_dttm = get_past_or_future(
                        offset, outer_to_dttm
                    )

                    query_object_clone.inner_from_dttm = query_object_clone.from_dttm
                    query_object_clone.inner_to_dttm = query_object_clone.to_dttm

                x_axis_label = get_x_axis_label(query_object.columns)
                query_object_clone.granularity = (
                    query_object_clone.granularity or x_axis_label
                )

            except ValueError as ex:
                raise QueryObjectValidationError(str(ex)) from ex

            query_object_clone.time_offsets = []
            query_object_clone.post_processing = []

            # Get time offset index
            index = (get_base_axis_labels(query_object.columns) or [DTTM_ALIAS])[0]

            if is_date_range_offset and feature_flag_manager.is_feature_enabled(
                "DATE_RANGE_TIMESHIFTS_ENABLED"
            ):
                # Create a completely new filter list to preserve original filters
                query_object_clone.filter = copy.deepcopy(query_object_clone.filter)

                # Remove any existing temporal filters that might conflict
                query_object_clone.filter = [
                    flt
                    for flt in query_object_clone.filter
                    if not (flt.get("op") == FilterOperator.TEMPORAL_RANGE)
                ]

                # Determine the temporal column with multiple fallback strategies
                temporal_col = self._get_temporal_column_for_filter(
                    query_object_clone, x_axis_label
                )

                # Always add a temporal filter for date range offsets
                if temporal_col:
                    new_temporal_filter: QueryObjectFilterClause = {
                        "col": temporal_col,
                        "op": FilterOperator.TEMPORAL_RANGE,
                        "val": (
                            f"{query_object_clone.from_dttm} : "
                            f"{query_object_clone.to_dttm}"
                        ),
                    }
                    query_object_clone.filter.append(new_temporal_filter)

                else:
                    # This should rarely happen with proper fallbacks
                    raise QueryObjectValidationError(
                        _(
                            "Unable to identify temporal column for date range time comparison."  # noqa: E501
                            "Please ensure your dataset has a properly configured time column."  # noqa: E501
                        )
                    )

            else:
                # RELATIVE OFFSET: Original logic for non-date-range offsets
                # The comparison is not using a temporal column so we need to modify
                # the temporal filter so we run the query with the correct time range
                if not dataframe_utils.is_datetime_series(df.get(index)):
                    query_object_clone.filter = copy.deepcopy(query_object_clone.filter)

                    # Find and update temporal filters
                    for flt in query_object_clone.filter:
                        if flt.get(
                            "op"
                        ) == FilterOperator.TEMPORAL_RANGE and isinstance(
                            flt.get("val"), str
                        ):
                            time_range = cast(str, flt.get("val"))
                            (
                                new_outer_from_dttm,
                                new_outer_to_dttm,
                            ) = get_since_until_from_time_range(
                                time_range=time_range,
                                time_shift=offset,
                            )
                            flt["val"] = f"{new_outer_from_dttm} : {new_outer_to_dttm}"
                else:
                    # If it IS a datetime series, we still need to clear conflicts
                    query_object_clone.filter = copy.deepcopy(query_object_clone.filter)

                    # For relative offsets with datetime series, ensure the temporal
                    # filter matches our range
                    temporal_col = query_object_clone.granularity or x_axis_label

                    # Update any existing temporal filters to match our shifted range
                    for flt in query_object_clone.filter:
                        if (
                            flt.get("op") == FilterOperator.TEMPORAL_RANGE
                            and flt.get("col") == temporal_col
                        ):
                            flt["val"] = (
                                f"{query_object_clone.from_dttm} : "
                                f"{query_object_clone.to_dttm}"
                            )

            # Remove non-temporal x-axis filters (but keep temporal ones)
            query_object_clone.filter = [
                flt
                for flt in query_object_clone.filter
                if not (
                    flt.get("col") == x_axis_label
                    and flt.get("op") != FilterOperator.TEMPORAL_RANGE
                )
            ]

            # Continue with the rest of the method (caching, execution, etc.)
            cached_time_offset_key = (
                offset if offset == original_offset else f"{offset}_{original_offset}"
            )

            cache_key = self.query_cache_key(
                query_object_clone,
                time_offset=cached_time_offset_key,
                time_grain=time_grain,
            )
            cache = QueryCacheManager.get(
                cache_key, CacheRegion.DATA, query_context.force
            )

            if cache.is_loaded:
                offset_dfs[offset] = cache.df
                queries.append(cache.query)
                cache_keys.append(cache_key)
                continue

            query_object_clone_dct = query_object_clone.to_dict()

            # rename metrics: SUM(value) => SUM(value) 1 year ago
            metrics_mapping = {
                metric: TIME_COMPARISON.join([metric, original_offset])
                for metric in metric_names
            }

            # When the original query has limit or offset we wont apply those
            # to the subquery so we prevent data inconsistency due to missing records
            # in the dataframes when performing the join
            if query_object.row_limit or query_object.row_offset:
                query_object_clone_dct["row_limit"] = current_app.config["ROW_LIMIT"]
                query_object_clone_dct["row_offset"] = 0

            if isinstance(self._qc_datasource, Query):
                result = self._qc_datasource.exc_query(query_object_clone_dct)
            else:
                result = self._qc_datasource.query(query_object_clone_dct)

            queries.append(result.query)
            cache_keys.append(None)

            offset_metrics_df = result.df
            if offset_metrics_df.empty:
                offset_metrics_df = pd.DataFrame(
                    {
                        col: [np.NaN]
                        for col in join_keys + list(metrics_mapping.values())
                    }
                )
            else:
                # 1. normalize df, set dttm column
                offset_metrics_df = self.normalize_df(
                    offset_metrics_df, query_object_clone
                )

                # 2. rename extra query columns
                offset_metrics_df = offset_metrics_df.rename(columns=metrics_mapping)

            # cache df and query
            value = {
                "df": offset_metrics_df,
                "query": result.query,
            }
            cache.set(
                key=cache_key,
                value=value,
                timeout=self.get_cache_timeout(),
                datasource_uid=query_context.datasource.uid,
                region=CacheRegion.DATA,
            )
            offset_dfs[offset] = offset_metrics_df

        if offset_dfs:
            df = self.join_offset_dfs(
                df,
                offset_dfs,
                time_grain,
                join_keys,
            )

        return CachedTimeOffset(df=df, queries=queries, cache_keys=cache_keys)

    def _get_temporal_column_for_filter(  # noqa: C901
        self, query_object: QueryObject, x_axis_label: str | None
    ) -> str | None:
        """
        Helper method to reliably determine the temporal column for filtering.

        This method tries multiple strategies to find the correct temporal column:
        1. Use explicitly set granularity
        2. Use x_axis_label if it's a temporal column
        3. Find any datetime column in the datasource

        :param query_object: The query object
        :param x_axis_label: The x-axis label from the query
        :return: The name of the temporal column, or None if not found
        """
        # Strategy 1: Use explicitly set granularity
        if query_object.granularity:
            return query_object.granularity

        # Strategy 2: Use x_axis_label if it exists
        if x_axis_label:
            return x_axis_label

        # Strategy 3: Find any datetime column in the datasource
        if hasattr(self._qc_datasource, "columns"):
            for col in self._qc_datasource.columns:
                if hasattr(col, "is_dttm") and col.is_dttm:
                    if hasattr(col, "column_name"):
                        return col.column_name
                    elif hasattr(col, "name"):
                        return col.name

        return None

    def _process_date_range_offset(
        self, offset_df: pd.DataFrame, join_keys: list[str]
    ) -> tuple[pd.DataFrame, list[str]]:
        """Process date range offset data and return modified DataFrame and keys."""
        temporal_cols = ["ds", "__timestamp", "dttm"]
        non_temporal_join_keys = [key for key in join_keys if key not in temporal_cols]

        if non_temporal_join_keys:
            return offset_df, non_temporal_join_keys

        metric_columns = [col for col in offset_df.columns if col not in temporal_cols]

        if metric_columns:
            aggregated_values = {}
            for col in metric_columns:
                if pd.api.types.is_numeric_dtype(offset_df[col]):
                    aggregated_values[col] = offset_df[col].sum()
                else:
                    aggregated_values[col] = (
                        offset_df[col].iloc[0] if not offset_df.empty else None
                    )

            offset_df = pd.DataFrame([aggregated_values])

        return offset_df, []

    def _apply_cleanup_logic(
        self,
        df: pd.DataFrame,
        offset: str,
        time_grain: str | None,
        join_keys: list[str],
        is_date_range_offset: bool,
    ) -> pd.DataFrame:
        """Apply appropriate cleanup logic based on offset type."""
        if time_grain and not is_date_range_offset:
            if join_keys:
                col = df.pop(join_keys[0])
                df.insert(0, col.name, col)

            df.drop(
                list(df.filter(regex=f"{OFFSET_JOIN_COLUMN_SUFFIX}|{R_SUFFIX}")),
                axis=1,
                inplace=True,
            )
        elif is_date_range_offset:
            df.drop(
                list(df.filter(regex=f"{R_SUFFIX}")),
                axis=1,
                inplace=True,
            )
        else:
            df.drop(
                list(df.filter(regex=f"{R_SUFFIX}")),
                axis=1,
                inplace=True,
            )

        return df

    def _determine_join_keys(
        self,
        df: pd.DataFrame,
        offset_df: pd.DataFrame,
        offset: str,
        time_grain: str | None,
        join_keys: list[str],
        is_date_range_offset: bool,
        join_column_producer: Any,
    ) -> tuple[pd.DataFrame, list[str]]:
        """Determine appropriate join keys and modify DataFrames if needed."""
        if time_grain and not is_date_range_offset:
            column_name = OFFSET_JOIN_COLUMN_SUFFIX + offset

            # Add offset join columns for relative time offsets
            self.add_offset_join_column(
                df, column_name, time_grain, offset, join_column_producer
            )
            self.add_offset_join_column(
                offset_df, column_name, time_grain, None, join_column_producer
            )
            return offset_df, [column_name, *join_keys[1:]]

        elif is_date_range_offset:
            return self._process_date_range_offset(offset_df, join_keys)

        else:
            return offset_df, join_keys

    def _perform_join(
        self, df: pd.DataFrame, offset_df: pd.DataFrame, actual_join_keys: list[str]
    ) -> pd.DataFrame:
        """Perform the appropriate join operation."""
        if actual_join_keys:
            return dataframe_utils.left_join_df(
                left_df=df,
                right_df=offset_df,
                join_keys=actual_join_keys,
                rsuffix=R_SUFFIX,
            )
        else:
            temp_key = "__temp_join_key__"
            df[temp_key] = 1
            offset_df[temp_key] = 1

            result_df = dataframe_utils.left_join_df(
                left_df=df,
                right_df=offset_df,
                join_keys=[temp_key],
                rsuffix=R_SUFFIX,
            )

            # Remove temporary join keys
            result_df.drop(columns=[temp_key], inplace=True, errors="ignore")
            result_df.drop(
                columns=[f"{temp_key}{R_SUFFIX}"], inplace=True, errors="ignore"
            )
            return result_df

    def join_offset_dfs(
        self,
        df: pd.DataFrame,
        offset_dfs: dict[str, pd.DataFrame],
        time_grain: str | None,
        join_keys: list[str],
    ) -> pd.DataFrame:
        """
        Join offset DataFrames with the main DataFrame.

        :param df: The main DataFrame.
        :param offset_dfs: A list of offset DataFrames.
        :param time_grain: The time grain used to calculate the temporal join key.
        :param join_keys: The keys to join on.
        """
        join_column_producer = current_app.config[
            "TIME_GRAIN_JOIN_COLUMN_PRODUCERS"
        ].get(time_grain)

        if join_column_producer and not time_grain:
            raise QueryObjectValidationError(
                _("Time Grain must be specified when using Time Shift.")
            )

        for offset, offset_df in offset_dfs.items():
            is_date_range_offset = self.is_valid_date_range(
                offset
            ) and feature_flag_manager.is_feature_enabled(
                "DATE_RANGE_TIMESHIFTS_ENABLED"
            )

            offset_df, actual_join_keys = self._determine_join_keys(
                df,
                offset_df,
                offset,
                time_grain,
                join_keys,
                is_date_range_offset,
                join_column_producer,
            )

            df = self._perform_join(df, offset_df, actual_join_keys)
            df = self._apply_cleanup_logic(
                df, offset, time_grain, join_keys, is_date_range_offset
            )

        return df

    @staticmethod
    def generate_join_column(
        row: pd.Series,
        column_index: int,
        time_grain: str,
        time_offset: str | None = None,
    ) -> str:
        value = row[column_index]

        if hasattr(value, "strftime"):
            if time_offset and not QueryContextProcessor.is_valid_date_range_static(
                time_offset
            ):
                value = value + DateOffset(**normalize_time_delta(time_offset))

            if time_grain in (
                TimeGrain.WEEK_STARTING_SUNDAY,
                TimeGrain.WEEK_ENDING_SATURDAY,
            ):
                return value.strftime("%Y-W%U")

            if time_grain in (
                TimeGrain.WEEK,
                TimeGrain.WEEK_STARTING_MONDAY,
                TimeGrain.WEEK_ENDING_SUNDAY,
            ):
                return value.strftime("%Y-W%W")

            if time_grain == TimeGrain.MONTH:
                return value.strftime("%Y-%m")

            if time_grain == TimeGrain.QUARTER:
                return value.strftime("%Y-Q") + str(value.quarter)

            if time_grain == TimeGrain.YEAR:
                return value.strftime("%Y")

        return str(value)

    @staticmethod
    def is_valid_date_range_static(date_range: str) -> bool:
        """Static version of is_valid_date_range for use in static methods"""
        try:
            # Attempt to parse the string as a date range in the format
            # YYYY-MM-DD:YYYY-MM-DD
            start_date, end_date = date_range.split(":")
            datetime.strptime(start_date.strip(), "%Y-%m-%d")
            datetime.strptime(end_date.strip(), "%Y-%m-%d")
            return True
        except ValueError:
            # If parsing fails, it's not a valid date range in the format
            # YYYY-MM-DD:YYYY-MM-DD
            return False

    def get_data(
        self, df: pd.DataFrame, coltypes: list[GenericDataType]
    ) -> str | list[dict[str, Any]]:
        if self._query_context.result_format in ChartDataResultFormat.table_like():
            include_index = not isinstance(df.index, pd.RangeIndex)
            columns = list(df.columns)
            verbose_map = self._qc_datasource.data.get("verbose_map", {})
            if verbose_map:
                df.columns = [verbose_map.get(column, column) for column in columns]

            result = None
            if self._query_context.result_format == ChartDataResultFormat.CSV:
                result = csv.df_to_escaped_csv(
                    df, index=include_index, **current_app.config["CSV_EXPORT"]
                )
            elif self._query_context.result_format == ChartDataResultFormat.XLSX:
                excel.apply_column_types(df, coltypes)
                result = excel.df_to_excel(df, **current_app.config["EXCEL_EXPORT"])
            return result or ""

        return df.to_dict(orient="records")

    def ensure_totals_available(self) -> None:
        queries_needing_totals = []
        totals_queries = []

        for i, query in enumerate(self._query_context.queries):
            needs_totals = any(
                pp.get("operation") == "contribution"
                for pp in getattr(query, "post_processing", []) or []
            )

            if needs_totals:
                queries_needing_totals.append(i)

            is_totals_query = (
                not query.columns and query.metrics and not query.post_processing
            )
            if is_totals_query:
                totals_queries.append(i)

        if not queries_needing_totals or not totals_queries:
            return

        totals_idx = totals_queries[0]
        totals_query = self._query_context.queries[totals_idx]

        totals_query.row_limit = None

        result = self._query_context.get_query_result(totals_query)
        df = result.df

        totals = {
            col: df[col].sum() for col in df.columns if df[col].dtype.kind in "biufc"
        }

        for idx in queries_needing_totals:
            query = self._query_context.queries[idx]
            if hasattr(query, "post_processing") and query.post_processing:
                for pp in query.post_processing:
                    if pp.get("operation") == "contribution":
                        pp["options"]["contribution_totals"] = totals

    def get_payload(
        self,
        cache_query_context: bool | None = False,
        force_cached: bool = False,
    ) -> dict[str, Any]:
        """Returns the query results with both metadata and data"""

        self.ensure_totals_available()

        query_results = [
            get_query_results(
                query_obj.result_type or self._query_context.result_type,
                self._query_context,
                query_obj,
                force_cached,
            )
            for query_obj in self._query_context.queries
        ]

        return_value = {"queries": query_results}

        if cache_query_context:
            cache_key = self.cache_key()
            set_and_log_cache(
                cache_manager.cache,
                cache_key,
                {
                    "data": {
                        # setting form_data into query context cache value as well
                        # so that it can be used to reconstruct form_data field
                        # for query context object when reading from cache
                        "form_data": self._query_context.form_data,
                        **self._query_context.cache_values,
                    },
                },
                self.get_cache_timeout(),
            )
            return_value["cache_key"] = cache_key  # type: ignore

        return return_value

    def get_cache_timeout(self) -> int:
        if cache_timeout_rv := self._query_context.get_cache_timeout():
            return cache_timeout_rv
        if (
            data_cache_timeout := current_app.config["DATA_CACHE_CONFIG"].get(
                "CACHE_DEFAULT_TIMEOUT"
            )
        ) is not None:
            return data_cache_timeout
        return current_app.config["CACHE_DEFAULT_TIMEOUT"]

    def cache_key(self, **extra: Any) -> str:
        """
        The QueryContext cache key is made out of the key/values from
        self.cached_values, plus any other key/values in `extra`. It includes only data
        required to rehydrate a QueryContext object.
        """
        key_prefix = "qc-"
        cache_dict = self._query_context.cache_values.copy()
        cache_dict.update(extra)

        return generate_cache_key(cache_dict, key_prefix)

    def get_annotation_data(self, query_obj: QueryObject) -> dict[str, Any]:
        annotation_data: dict[str, Any] = self.get_native_annotation_data(query_obj)
        for annotation_layer in [
            layer
            for layer in query_obj.annotation_layers
            if layer["sourceType"] in ("line", "table")
        ]:
            name = annotation_layer["name"]
            annotation_data[name] = self.get_viz_annotation_data(
                annotation_layer, self._query_context.force
            )
        return annotation_data

    @staticmethod
    def get_native_annotation_data(query_obj: QueryObject) -> dict[str, Any]:
        annotation_data = {}
        annotation_layers = [
            layer
            for layer in query_obj.annotation_layers
            if layer["sourceType"] == "NATIVE"
        ]
        layer_ids = [layer["value"] for layer in annotation_layers]
        layer_objects = {
            layer_object.id: layer_object
            for layer_object in AnnotationLayerDAO.find_by_ids(layer_ids)
        }

        # annotations
        for layer in annotation_layers:
            layer_id = layer["value"]
            layer_name = layer["name"]
            columns = [
                "start_dttm",
                "end_dttm",
                "short_descr",
                "long_descr",
                "json_metadata",
            ]
            layer_object = layer_objects[layer_id]
            records = [
                {column: getattr(annotation, column) for column in columns}
                for annotation in layer_object.annotation
            ]
            result = {"columns": columns, "records": records}
            annotation_data[layer_name] = result
        return annotation_data

    @staticmethod
    def get_viz_annotation_data(  # noqa: C901
        annotation_layer: dict[str, Any], force: bool
    ) -> dict[str, Any]:
        # pylint: disable=import-outside-toplevel
        from superset.commands.chart.data.get_data_command import ChartDataCommand

        if not (chart := ChartDAO.find_by_id(annotation_layer["value"])):
            raise QueryObjectValidationError(
                _(
                    f"""Chart with ID {annotation_layer["value"]} (referenced by
                    annotation layer '{annotation_layer["name"]}') was not found.
                    Please verify that the chart exists and is accessible."""
                )
            )

        try:
            if chart.viz_type in viz_types:
                if not chart.datasource:
                    raise QueryObjectValidationError(
                        _(
                            f"""The dataset for chart ID {chart.id} (referenced by
                            annotation layer '{annotation_layer["name"]}') was
                            not found. Please check that the dataset exists and
                            is accessible."""
                        )
                    )

                form_data = chart.form_data.copy()
                form_data.update(annotation_layer.get("overrides", {}))

                payload = get_viz(
                    datasource_type=chart.datasource.type,
                    datasource_id=chart.datasource.id,
                    form_data=form_data,
                    force=force,
                ).get_payload()

                return payload["data"]

            if not (query_context := chart.get_query_context()):
                raise QueryObjectValidationError(
                    _(
                        f"""The query context for chart ID {chart.id} (referenced
                        by annotation layer '{annotation_layer["name"]}') was not found.
                        Please ensure the chart is properly configured and has a valid
                        query context."""
                    )
                )

            if overrides := annotation_layer.get("overrides"):
                if time_grain_sqla := overrides.get("time_grain_sqla"):
                    for query_object in query_context.queries:
                        query_object.extras["time_grain_sqla"] = time_grain_sqla

                if time_range := overrides.get("time_range"):
                    from_dttm, to_dttm = get_since_until_from_time_range(time_range)

                    for query_object in query_context.queries:
                        query_object.from_dttm = from_dttm
                        query_object.to_dttm = to_dttm

            query_context.force = force
            command = ChartDataCommand(query_context)
            command.validate()
            payload = command.run()
            return {"records": payload["queries"][0]["data"]}
        except SupersetException as ex:
            raise QueryObjectValidationError(error_msg_from_exception(ex)) from ex

    def raise_for_access(self) -> None:
        """
        Raise an exception if the user cannot access the resource.

        :raises SupersetSecurityException: If the user cannot access the resource
        """
        for query in self._query_context.queries:
            query.validate()

        if self._qc_datasource.type == DatasourceType.QUERY:
            security_manager.raise_for_access(query=self._qc_datasource)
        else:
            security_manager.raise_for_access(query_context=self._query_context)
