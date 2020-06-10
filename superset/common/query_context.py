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
import logging
import math
import pickle as pkl
from datetime import datetime, timedelta
from typing import Any, ClassVar, Dict, List, Optional, Union

import numpy as np
import pandas as pd

from superset import app, cache, db, security_manager
from superset.common.query_object import QueryObject
from superset.connectors.base.models import BaseDatasource
from superset.connectors.connector_registry import ConnectorRegistry
from superset.stats_logger import BaseStatsLogger
from superset.utils import core as utils
from superset.utils.core import DTTM_ALIAS

config = app.config
stats_logger: BaseStatsLogger = config["STATS_LOGGER"]
logger = logging.getLogger(__name__)


class QueryContext:
    """
    The query context contains the query object and additional fields necessary
    to retrieve the data payload for a given viz.
    """

    cache_type: ClassVar[str] = "df"
    enforce_numerical_metrics: ClassVar[bool] = True

    datasource: BaseDatasource
    queries: List[QueryObject]
    force: bool
    custom_cache_timeout: Optional[int]
    result_type: utils.ChartDataResultType
    result_format: utils.ChartDataResultFormat

    # TODO: Type datasource and query_object dictionary with TypedDict when it becomes
    #  a vanilla python type https://github.com/python/mypy/issues/5288
    def __init__(  # pylint: disable=too-many-arguments
        self,
        datasource: Dict[str, Any],
        queries: List[Dict[str, Any]],
        force: bool = False,
        custom_cache_timeout: Optional[int] = None,
        result_type: Optional[utils.ChartDataResultType] = None,
        result_format: Optional[utils.ChartDataResultFormat] = None,
    ) -> None:
        self.datasource = ConnectorRegistry.get_datasource(
            str(datasource["type"]), int(datasource["id"]), db.session
        )
        self.queries = [QueryObject(**query_obj) for query_obj in queries]
        self.force = force
        self.custom_cache_timeout = custom_cache_timeout
        self.result_type = result_type or utils.ChartDataResultType.FULL
        self.result_format = result_format or utils.ChartDataResultFormat.JSON

    def get_query_result(self, query_object: QueryObject) -> Dict[str, Any]:
        """Returns a pandas dataframe based on the query object"""

        # Here, we assume that all the queries will use the same datasource, which is
        # a valid assumption for current setting. In the long term, we may
        # support multiple queries from different data sources.

        timestamp_format = None
        if self.datasource.type == "table":
            dttm_col = self.datasource.get_column(query_object.granularity)
            if dttm_col:
                timestamp_format = dttm_col.python_date_format

        # The datasource here can be different backend but the interface is common
        result = self.datasource.query(query_object.to_dict())

        df = result.df
        # Transform the timestamp we received from database to pandas supported
        # datetime format. If no python_date_format is specified, the pattern will
        # be considered as the default ISO date format
        # If the datetime format is unix, the parse will use the corresponding
        # parsing logic
        if not df.empty:
            if DTTM_ALIAS in df.columns:
                if timestamp_format in ("epoch_s", "epoch_ms"):
                    # Column has already been formatted as a timestamp.
                    df[DTTM_ALIAS] = df[DTTM_ALIAS].apply(pd.Timestamp)
                else:
                    df[DTTM_ALIAS] = pd.to_datetime(
                        df[DTTM_ALIAS], utc=False, format=timestamp_format
                    )
                if self.datasource.offset:
                    df[DTTM_ALIAS] += timedelta(hours=self.datasource.offset)
                df[DTTM_ALIAS] += query_object.time_shift

            if self.enforce_numerical_metrics:
                self.df_metrics_to_num(df, query_object)

            df.replace([np.inf, -np.inf], np.nan)

        df = query_object.exec_post_processing(df)

        return {
            "query": result.query,
            "status": result.status,
            "error_message": result.error_message,
            "df": df,
        }

    @staticmethod
    def df_metrics_to_num(  # pylint: disable=no-self-use
        df: pd.DataFrame, query_object: QueryObject
    ) -> None:
        """Converting metrics to numeric when pandas.read_sql cannot"""
        for col, dtype in df.dtypes.items():
            if dtype.type == np.object_ and col in query_object.metrics:
                df[col] = pd.to_numeric(df[col], errors="coerce")

    def get_data(
        self, df: pd.DataFrame,
    ) -> Union[str, List[Dict[str, Any]]]:  # pylint: disable=no-self-use
        if self.result_format == utils.ChartDataResultFormat.CSV:
            include_index = not isinstance(df.index, pd.RangeIndex)
            result = df.to_csv(index=include_index, **config["CSV_EXPORT"])
            return result or ""

        return df.to_dict(orient="records")

    def get_single_payload(self, query_obj: QueryObject) -> Dict[str, Any]:
        """Returns a payload of metadata and data"""
        if self.result_type == utils.ChartDataResultType.QUERY:
            return {
                "query": self.datasource.get_query_str(query_obj.to_dict()),
                "language": self.datasource.query_language,
            }
        if self.result_type == utils.ChartDataResultType.SAMPLES:
            row_limit = query_obj.row_limit or math.inf
            query_obj = copy.copy(query_obj)
            query_obj.groupby = []
            query_obj.metrics = []
            query_obj.post_processing = []
            query_obj.row_limit = min(row_limit, config["SAMPLES_ROW_LIMIT"])
            query_obj.row_offset = 0
            query_obj.columns = [o.column_name for o in self.datasource.columns]
        payload = self.get_df_payload(query_obj)
        df = payload["df"]
        status = payload["status"]
        if status != utils.QueryStatus.FAILED:
            if df.empty:
                payload["error"] = "No data"
            else:
                payload["data"] = self.get_data(df)
        del payload["df"]
        if self.result_type == utils.ChartDataResultType.RESULTS:
            return {"data": payload["data"]}
        return payload

    def get_payload(self) -> List[Dict[str, Any]]:
        """Get all the payloads from the QueryObjects"""
        return [self.get_single_payload(query_object) for query_object in self.queries]

    @property
    def cache_timeout(self) -> int:
        if self.custom_cache_timeout is not None:
            return self.custom_cache_timeout
        if self.datasource.cache_timeout is not None:
            return self.datasource.cache_timeout
        if (
            hasattr(self.datasource, "database")
            and self.datasource.database.cache_timeout
        ) is not None:
            return self.datasource.database.cache_timeout
        return config["CACHE_DEFAULT_TIMEOUT"]

    def cache_key(self, query_obj: QueryObject, **kwargs: Any) -> Optional[str]:
        extra_cache_keys = self.datasource.get_extra_cache_keys(query_obj.to_dict())

        cache_key = (
            query_obj.cache_key(
                datasource=self.datasource.uid,
                extra_cache_keys=extra_cache_keys,
                rls=security_manager.get_rls_ids(self.datasource)
                if config["ENABLE_ROW_LEVEL_SECURITY"]
                else [],
                changed_on=self.datasource.changed_on,
                **kwargs
            )
            if query_obj
            else None
        )
        return cache_key

    def get_df_payload(  # pylint: disable=too-many-locals,too-many-statements
        self, query_obj: QueryObject, **kwargs: Any
    ) -> Dict[str, Any]:
        """Handles caching around the df payload retrieval"""
        cache_key = self.cache_key(query_obj, **kwargs)
        logger.info("Cache key: %s", cache_key)
        is_loaded = False
        stacktrace = None
        df = pd.DataFrame()
        cached_dttm = datetime.utcnow().isoformat().split(".")[0]
        cache_value = None
        status = None
        query = ""
        error_message = None
        if cache_key and cache and not self.force:
            cache_value = cache.get(cache_key)
            if cache_value:
                stats_logger.incr("loading_from_cache")
                try:
                    cache_value = pkl.loads(cache_value)
                    df = cache_value["df"]
                    query = cache_value["query"]
                    status = utils.QueryStatus.SUCCESS
                    is_loaded = True
                    stats_logger.incr("loaded_from_cache")
                except Exception as ex:  # pylint: disable=broad-except
                    logger.exception(ex)
                    logger.error(
                        "Error reading cache: %s", utils.error_msg_from_exception(ex)
                    )
                logger.info("Serving from cache")

        if query_obj and not is_loaded:
            try:
                query_result = self.get_query_result(query_obj)
                status = query_result["status"]
                query = query_result["query"]
                error_message = query_result["error_message"]
                df = query_result["df"]
                if status != utils.QueryStatus.FAILED:
                    stats_logger.incr("loaded_from_source")
                    if not self.force:
                        stats_logger.incr("loaded_from_source_without_force")
                    is_loaded = True
            except Exception as ex:  # pylint: disable=broad-except
                logger.exception(ex)
                if not error_message:
                    error_message = "{}".format(ex)
                status = utils.QueryStatus.FAILED
                stacktrace = utils.get_stacktrace()

            if is_loaded and cache_key and cache and status != utils.QueryStatus.FAILED:
                try:
                    cache_value = dict(dttm=cached_dttm, df=df, query=query)
                    cache_binary = pkl.dumps(cache_value, protocol=pkl.HIGHEST_PROTOCOL)

                    logger.info(
                        "Caching %d chars at key %s", len(cache_binary), cache_key
                    )

                    stats_logger.incr("set_cache_key")
                    cache.set(cache_key, cache_binary, timeout=self.cache_timeout)
                except Exception as ex:  # pylint: disable=broad-except
                    # cache.set call can fail if the backend is down or if
                    # the key is too large or whatever other reasons
                    logger.warning("Could not cache key %s", cache_key)
                    logger.exception(ex)
                    cache.delete(cache_key)
        return {
            "cache_key": cache_key,
            "cached_dttm": cache_value["dttm"] if cache_value is not None else None,
            "cache_timeout": self.cache_timeout,
            "df": df,
            "error": error_message,
            "is_cached": cache_key is not None,
            "query": query,
            "status": status,
            "stacktrace": stacktrace,
            "rowcount": len(df.index),
        }
