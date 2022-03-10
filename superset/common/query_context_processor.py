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
from typing import Any, ClassVar, Dict, List, Optional, TYPE_CHECKING, Union

import numpy as np
import pandas as pd
from flask_babel import _
from pandas import DateOffset
from typing_extensions import TypedDict

from superset import app
from superset.annotation_layers.dao import AnnotationLayerDAO
from superset.charts.dao import ChartDAO
from superset.common.chart_data import ChartDataResultFormat
from superset.common.db_query_status import QueryStatus
from superset.common.query_actions import get_query_results
from superset.common.utils import dataframe_utils as df_utils
from superset.common.utils.query_cache_manager import QueryCacheManager
from superset.connectors.base.models import BaseDatasource
from superset.constants import CacheRegion
from superset.exceptions import QueryObjectValidationError, SupersetException
from superset.extensions import cache_manager, security_manager
from superset.models.helpers import QueryResult
from superset.utils import csv
from superset.utils.cache import generate_cache_key, set_and_log_cache
from superset.utils.core import (
    DTTM_ALIAS,
    error_msg_from_exception,
    get_column_names_from_columns,
    get_column_names_from_metrics,
    get_metric_names,
    normalize_dttm_col,
    TIME_COMPARISION,
)
from superset.utils.date_parser import get_past_or_future, normalize_time_delta
from superset.views.utils import get_viz

if TYPE_CHECKING:
    from superset.common.query_context import QueryContext
    from superset.common.query_object import QueryObject
    from superset.stats_logger import BaseStatsLogger

config = app.config
stats_logger: BaseStatsLogger = config["STATS_LOGGER"]
logger = logging.getLogger(__name__)


class CachedTimeOffset(TypedDict):
    df: pd.DataFrame
    queries: List[str]
    cache_keys: List[Optional[str]]


class QueryContextProcessor:
    """
    The query context contains the query object and additional fields necessary
    to retrieve the data payload for a given viz.
    """

    _query_context: QueryContext
    _qc_datasource: BaseDatasource
    """
    The query context contains the query object and additional fields necessary
    to retrieve the data payload for a given viz.
    """

    def __init__(self, query_context: QueryContext):
        self._query_context = query_context
        self._qc_datasource = query_context.datasource

    cache_type: ClassVar[str] = "df"
    enforce_numerical_metrics: ClassVar[bool] = True

    def get_df_payload(
        self, query_obj: QueryObject, force_cached: Optional[bool] = False
    ) -> Dict[str, Any]:
        """Handles caching around the df payload retrieval"""
        cache_key = self.query_cache_key(query_obj)
        cache = QueryCacheManager.get(
            cache_key, CacheRegion.DATA, self._query_context.force, force_cached,
        )

        if query_obj and cache_key and not cache.is_loaded:
            try:
                invalid_columns = [
                    col
                    for col in get_column_names_from_columns(query_obj.columns)
                    + get_column_names_from_metrics(query_obj.metrics or [])
                    if (
                        col not in self._qc_datasource.column_names
                        and col != DTTM_ALIAS
                    )
                ]
                if invalid_columns:
                    raise QueryObjectValidationError(
                        _(
                            "Columns missing in datasource: %(invalid_columns)s",
                            invalid_columns=invalid_columns,
                        )
                    )
                query_result = self.get_query_result(query_obj)
                annotation_data = self.get_annotation_data(query_obj)
                cache.set_query_result(
                    key=cache_key,
                    query_result=query_result,
                    annotation_data=annotation_data,
                    force_query=self._query_context.force,
                    timeout=self.get_cache_timeout(),
                    datasource_uid=self._qc_datasource.uid,
                    region=CacheRegion.DATA,
                )
            except QueryObjectValidationError as ex:
                cache.error_message = str(ex)
                cache.status = QueryStatus.FAILED

        return {
            "cache_key": cache_key,
            "cached_dttm": cache.cache_dttm,
            "cache_timeout": self.get_cache_timeout(),
            "df": cache.df,
            "applied_template_filters": cache.applied_template_filters,
            "annotation_data": cache.annotation_data,
            "error": cache.error_message,
            "is_cached": cache.is_cached,
            "query": cache.query,
            "status": cache.status,
            "stacktrace": cache.stacktrace,
            "rowcount": len(cache.df.index),
            "from_dttm": query_obj.from_dttm,
            "to_dttm": query_obj.to_dttm,
        }

    def query_cache_key(self, query_obj: QueryObject, **kwargs: Any) -> Optional[str]:
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

        # The datasource here can be different backend but the interface is common
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

            df = query_object.exec_post_processing(df)

        result.df = df
        result.query = query
        result.from_dttm = query_object.from_dttm
        result.to_dttm = query_object.to_dttm
        return result

    def normalize_df(self, df: pd.DataFrame, query_object: QueryObject) -> pd.DataFrame:
        datasource = self._qc_datasource
        timestamp_format = None
        if datasource.type == "table":
            dttm_col = datasource.get_column(query_object.granularity)
            if dttm_col:
                timestamp_format = dttm_col.python_date_format

        normalize_dttm_col(
            df=df,
            timestamp_format=timestamp_format,
            offset=datasource.offset,
            time_shift=query_object.time_shift,
        )

        if self.enforce_numerical_metrics:
            df_utils.df_metrics_to_num(df, query_object)

        df.replace([np.inf, -np.inf], np.nan, inplace=True)

        return df

    def processing_time_offsets(  # pylint: disable=too-many-locals
        self, df: pd.DataFrame, query_object: QueryObject,
    ) -> CachedTimeOffset:
        query_context = self._query_context
        # ensure query_object is immutable
        query_object_clone = copy.copy(query_object)
        queries: List[str] = []
        cache_keys: List[Optional[str]] = []
        rv_dfs: List[pd.DataFrame] = [df]

        time_offsets = query_object.time_offsets
        outer_from_dttm = query_object.from_dttm
        outer_to_dttm = query_object.to_dttm
        for offset in time_offsets:
            try:
                query_object_clone.from_dttm = get_past_or_future(
                    offset, outer_from_dttm,
                )
                query_object_clone.to_dttm = get_past_or_future(offset, outer_to_dttm)
            except ValueError as ex:
                raise QueryObjectValidationError(str(ex)) from ex
            # make sure subquery use main query where clause
            query_object_clone.inner_from_dttm = outer_from_dttm
            query_object_clone.inner_to_dttm = outer_to_dttm
            query_object_clone.time_offsets = []
            query_object_clone.post_processing = []

            if not query_object.from_dttm or not query_object.to_dttm:
                raise QueryObjectValidationError(
                    _(
                        "An enclosed time range (both start and end) must be specified "
                        "when using a Time Comparison."
                    )
                )
            # `offset` is added to the hash function
            cache_key = self.query_cache_key(query_object_clone, time_offset=offset)
            cache = QueryCacheManager.get(
                cache_key, CacheRegion.DATA, query_context.force
            )
            # whether hit on the cache
            if cache.is_loaded:
                rv_dfs.append(cache.df)
                queries.append(cache.query)
                cache_keys.append(cache_key)
                continue

            query_object_clone_dct = query_object_clone.to_dict()
            # rename metrics: SUM(value) => SUM(value) 1 year ago
            metrics_mapping = {
                metric: TIME_COMPARISION.join([metric, offset])
                for metric in get_metric_names(
                    query_object_clone_dct.get("metrics", [])
                )
            }
            join_keys = [col for col in df.columns if col not in metrics_mapping.keys()]

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

                # 3. set time offset for index
                # TODO: add x-axis to QueryObject, potentially as an array for
                #  multi-dimensional charts
                granularity = query_object.granularity
                index = granularity if granularity in df.columns else DTTM_ALIAS
                offset_metrics_df[index] = offset_metrics_df[index] - DateOffset(
                    **normalize_time_delta(offset)
                )

            # df left join `offset_metrics_df`
            offset_df = df_utils.left_join_df(
                left_df=df, right_df=offset_metrics_df, join_keys=join_keys,
            )
            offset_slice = offset_df[metrics_mapping.values()]

            # set offset_slice to cache and stack.
            value = {
                "df": offset_slice,
                "query": result.query,
            }
            cache.set(
                key=cache_key,
                value=value,
                timeout=self.get_cache_timeout(),
                datasource_uid=query_context.datasource.uid,
                region=CacheRegion.DATA,
            )
            rv_dfs.append(offset_slice)

        rv_df = pd.concat(rv_dfs, axis=1, copy=False) if time_offsets else df
        return CachedTimeOffset(df=rv_df, queries=queries, cache_keys=cache_keys)

    def get_data(self, df: pd.DataFrame) -> Union[str, List[Dict[str, Any]]]:
        if self._query_context.result_format == ChartDataResultFormat.CSV:
            include_index = not isinstance(df.index, pd.RangeIndex)
            columns = list(df.columns)
            verbose_map = self._qc_datasource.data.get("verbose_map", {})
            if verbose_map:
                df.columns = [verbose_map.get(column, column) for column in columns]
            result = csv.df_to_escaped_csv(
                df, index=include_index, **config["CSV_EXPORT"]
            )
            return result or ""

        return df.to_dict(orient="records")

    def get_payload(
        self, cache_query_context: Optional[bool] = False, force_cached: bool = False,
    ) -> Dict[str, Any]:
        """Returns the query results with both metadata and data"""

        # Get all the payloads from the QueryObjects
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
                {"data": self._query_context.cache_values},
                self.get_cache_timeout(),
            )
            return_value["cache_key"] = cache_key  # type: ignore

        return return_value

    def get_cache_timeout(self) -> int:
        cache_timeout_rv = self._query_context.get_cache_timeout()
        if cache_timeout_rv:
            return cache_timeout_rv
        return config["CACHE_DEFAULT_TIMEOUT"]

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

    def get_annotation_data(self, query_obj: QueryObject) -> Dict[str, Any]:
        """
        :param query_context:
        :param query_obj:
        :return:
        """
        annotation_data: Dict[str, Any] = self.get_native_annotation_data(query_obj)
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
    def get_native_annotation_data(query_obj: QueryObject) -> Dict[str, Any]:
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
    def get_viz_annotation_data(
        annotation_layer: Dict[str, Any], force: bool
    ) -> Dict[str, Any]:
        chart = ChartDAO.find_by_id(annotation_layer["value"])
        form_data = chart.form_data.copy()
        if not chart:
            raise QueryObjectValidationError(_("The chart does not exist"))
        try:
            viz_obj = get_viz(
                datasource_type=chart.datasource.type,
                datasource_id=chart.datasource.id,
                form_data=form_data,
                force=force,
            )
            payload = viz_obj.get_payload()
            return payload["data"]
        except SupersetException as ex:
            raise QueryObjectValidationError(error_msg_from_exception(ex)) from ex

    def raise_for_access(self) -> None:
        """
        Raise an exception if the user cannot access the resource.

        :raises SupersetSecurityException: If the user cannot access the resource
        """
        for query in self._query_context.queries:
            query.validate()
        security_manager.raise_for_access(query_context=self._query_context)
