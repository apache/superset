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
# pylint: disable=C,R,W
from datetime import datetime, timedelta
import logging
import pickle as pkl
from typing import Dict, List

import numpy as np
import pandas as pd

from superset import app, cache
from superset import db
from superset.connectors.connector_registry import ConnectorRegistry
from superset.utils import core as utils
from superset.utils.core import DTTM_ALIAS
from .query_object import QueryObject

config = app.config
stats_logger = config.get("STATS_LOGGER")


class QueryContext:
    """
    The query context contains the query object and additional fields necessary
    to retrieve the data payload for a given viz.
    """

    cache_type = "df"
    enforce_numerical_metrics = True

    # TODO: Type datasource and query_object dictionary with TypedDict when it becomes
    # a vanilla python type https://github.com/python/mypy/issues/5288
    def __init__(
        self,
        datasource: Dict,
        queries: List[Dict],
        force: bool = False,
        custom_cache_timeout: int = None,
    ):
        self.datasource = ConnectorRegistry.get_datasource(
            datasource.get("type"), int(datasource.get("id")), db.session  # noqa: T400
        )
        self.queries = list(map(lambda query_obj: QueryObject(**query_obj), queries))

        self.force = force

        self.custom_cache_timeout = custom_cache_timeout

        self.enforce_numerical_metrics = True

    def get_query_result(self, query_object):
        """Returns a pandas dataframe based on the query object"""

        # Here, we assume that all the queries will use the same datasource, which is
        # is a valid assumption for current setting. In a long term, we may or maynot
        # support multiple queries from different data source.

        timestamp_format = None
        if self.datasource.type == "table":
            dttm_col = self.datasource.get_col(query_object.granularity)
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
        if df is not None and not df.empty:
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
        return {
            "query": result.query,
            "status": result.status,
            "error_message": result.error_message,
            "df": df,
        }

    def df_metrics_to_num(self, df, query_object):
        """Converting metrics to numeric when pandas.read_sql cannot"""
        metrics = [metric for metric in query_object.metrics]
        for col, dtype in df.dtypes.items():
            if dtype.type == np.object_ and col in metrics:
                df[col] = pd.to_numeric(df[col], errors="coerce")

    def get_data(self, df):
        return df.to_dict(orient="records")

    def get_single_payload(self, query_obj: QueryObject):
        """Returns a payload of metadata and data"""
        payload = self.get_df_payload(query_obj)
        df = payload.get("df")
        status = payload.get("status")
        if status != utils.QueryStatus.FAILED:
            if df is not None and df.empty:
                payload["error"] = "No data"
            else:
                payload["data"] = self.get_data(df)
        if "df" in payload:
            del payload["df"]
        return payload

    def get_payload(self):
        """Get all the payloads from the arrays"""
        return [self.get_single_payload(query_object) for query_object in self.queries]

    @property
    def cache_timeout(self):
        if self.custom_cache_timeout is not None:
            return self.custom_cache_timeout
        if self.datasource.cache_timeout is not None:
            return self.datasource.cache_timeout
        if (
            hasattr(self.datasource, "database")
            and self.datasource.database.cache_timeout
        ) is not None:
            return self.datasource.database.cache_timeout
        return config.get("CACHE_DEFAULT_TIMEOUT")

    def get_df_payload(self, query_obj: QueryObject, **kwargs):
        """Handles caching around the df paylod retrieval"""
        extra_cache_keys = self.datasource.get_extra_cache_keys(query_obj.to_dict())
        cache_key = (
            query_obj.cache_key(
                datasource=self.datasource.uid,
                extra_cache_keys=extra_cache_keys,
                **kwargs
            )
            if query_obj
            else None
        )
        logging.info("Cache key: {}".format(cache_key))
        is_loaded = False
        stacktrace = None
        df = None
        cached_dttm = datetime.utcnow().isoformat().split(".")[0]
        cache_value = None
        status = None
        query = ""
        error_message = None
        if cache_key and cache and not self.force:
            cache_value = cache.get(cache_key)
            if cache_value:
                stats_logger.incr("loaded_from_cache")
                try:
                    cache_value = pkl.loads(cache_value)
                    df = cache_value["df"]
                    query = cache_value["query"]
                    status = utils.QueryStatus.SUCCESS
                    is_loaded = True
                except Exception as e:
                    logging.exception(e)
                    logging.error(
                        "Error reading cache: " + utils.error_msg_from_exception(e)
                    )
                logging.info("Serving from cache")

        if query_obj and not is_loaded:
            try:
                query_result = self.get_query_result(query_obj)
                status = query_result["status"]
                query = query_result["query"]
                error_message = query_result["error_message"]
                df = query_result["df"]
                if status != utils.QueryStatus.FAILED:
                    stats_logger.incr("loaded_from_source")
                    is_loaded = True
            except Exception as e:
                logging.exception(e)
                if not error_message:
                    error_message = "{}".format(e)
                status = utils.QueryStatus.FAILED
                stacktrace = utils.get_stacktrace()

            if is_loaded and cache_key and cache and status != utils.QueryStatus.FAILED:
                try:
                    cache_value = dict(
                        dttm=cached_dttm, df=df if df is not None else None, query=query
                    )
                    cache_binary = pkl.dumps(cache_value, protocol=pkl.HIGHEST_PROTOCOL)

                    logging.info(
                        "Caching {} chars at key {}".format(
                            len(cache_binary), cache_key
                        )
                    )

                    stats_logger.incr("set_cache_key")
                    cache.set(cache_key, cache_binary, timeout=self.cache_timeout)
                except Exception as e:
                    # cache.set call can fail if the backend is down or if
                    # the key is too large or whatever other reasons
                    logging.warning("Could not cache key {}".format(cache_key))
                    logging.exception(e)
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
            "rowcount": len(df.index) if df is not None else 0,
        }
