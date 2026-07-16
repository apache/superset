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
from datetime import datetime, timezone
from typing import Any

from flask import current_app, g, has_request_context
from flask_caching import Cache
from pandas import DataFrame

from superset.common.chart_data_timing import (
    CacheWriteOutcome,
    deserialize_source_trace,
    serialize_source_trace,
    SourceTiming,
)
from superset.common.db_query_status import QueryStatus
from superset.constants import CacheRegion
from superset.exceptions import CacheLoadError
from superset.extensions import cache_manager
from superset.models.helpers import QueryResult
from superset.stats_logger import BaseStatsLogger
from superset.superset_typing import Column
from superset.utils.cache import set_and_log_cache, set_and_log_cache_with_outcome
from superset.utils.core import error_msg_from_exception, get_stacktrace

logger = logging.getLogger(__name__)

_cache: dict[CacheRegion, Cache] = {
    CacheRegion.DEFAULT: cache_manager.cache,
    CacheRegion.DATA: cache_manager.data_cache,
}


class QueryCacheManager:
    """
    Class for manage query-cache getting and setting
    """

    @property
    def stats_logger(self) -> BaseStatsLogger:
        return current_app.config["STATS_LOGGER"]

    # pylint: disable=too-many-instance-attributes,too-many-arguments
    def __init__(
        self,
        df: DataFrame | None = None,
        query: str = "",
        annotation_data: dict[str, Any] | None = None,
        applied_template_filters: list[str] | None = None,
        applied_filter_columns: list[Column] | None = None,
        rejected_filter_columns: list[Column] | None = None,
        status: str | None = None,
        error_message: str | None = None,
        is_loaded: bool = False,
        stacktrace: str | None = None,
        is_cached: bool | None = None,
        cache_dttm: str | None = None,
        cache_value: dict[str, Any] | None = None,
        sql_rowcount: int | None = None,
        queried_dttm: str | None = None,
        source_trace: tuple[SourceTiming, ...] | None = None,
    ) -> None:
        self.df: DataFrame = DataFrame() if df is None else df
        self.query = query
        self.annotation_data = {} if annotation_data is None else annotation_data
        self.applied_template_filters = applied_template_filters or []
        self.applied_filter_columns = applied_filter_columns or []
        self.has_applied_filter_columns: bool = applied_filter_columns is not None
        self.rejected_filter_columns = rejected_filter_columns or []
        self.status = status
        self.error_message = error_message

        self.is_loaded = is_loaded
        self.stacktrace = stacktrace
        self.is_cached = is_cached
        self.cache_dttm = cache_dttm
        self.cache_value = cache_value
        self.sql_rowcount = sql_rowcount
        self.queried_dttm = queried_dttm
        self.source_trace: tuple[SourceTiming, ...] | None = source_trace
        self.cache_write_outcome: CacheWriteOutcome = CacheWriteOutcome.NOT_ATTEMPTED
        self.bq_memory_limited: bool = False
        self.bq_memory_limited_row_count: int = 0

    def discard_loaded_value(self) -> None:
        """Clear every field derived from a loaded cache or source result."""

        self.df = DataFrame()
        self.query = ""
        self.annotation_data = {}
        self.applied_template_filters = []
        self.applied_filter_columns = []
        self.has_applied_filter_columns = False
        self.rejected_filter_columns = []
        self.status = None
        self.error_message = None
        self.is_loaded = False
        self.stacktrace = None
        self.is_cached = None
        self.cache_dttm = None
        self.cache_value = None
        self.sql_rowcount = None
        self.queried_dttm = None
        self.source_trace = None
        self.cache_write_outcome = CacheWriteOutcome.NOT_ATTEMPTED
        self.bq_memory_limited = False
        self.bq_memory_limited_row_count = 0

    # pylint: disable=too-many-arguments
    def set_query_result(
        self,
        key: str,
        query_result: QueryResult,
        annotation_data: dict[str, Any] | None = None,
        force_query: bool | None = False,
        timeout: int | None = None,
        datasource_uid: str | None = None,
        region: CacheRegion = CacheRegion.DEFAULT,
    ) -> bool:
        """
        Set dataframe of query-result to specific cache region
        """
        self.load_query_result(query_result, annotation_data, force_query)
        return self.write_query_result(
            key=key,
            timeout=timeout,
            datasource_uid=datasource_uid,
            region=region,
        )

    def load_query_result(
        self,
        query_result: QueryResult,
        annotation_data: dict[str, Any] | None = None,
        force_query: bool | None = False,
    ) -> None:
        """Load a source result into this manager without writing the cache."""
        try:
            self.status = query_result.status
            self.query = query_result.query
            self.applied_template_filters = query_result.applied_template_filters
            self.applied_filter_columns = query_result.applied_filter_columns
            self.has_applied_filter_columns = True
            self.rejected_filter_columns = query_result.rejected_filter_columns
            self.error_message = query_result.error_message
            self.df = query_result.df
            self.sql_rowcount = query_result.sql_rowcount
            self.annotation_data = {} if annotation_data is None else annotation_data
            self.queried_dttm = (
                datetime.now(tz=timezone.utc).replace(microsecond=0).isoformat()
            )
            self.source_trace = query_result.source_trace

            if self.status != QueryStatus.FAILED:
                try:
                    current_app.config["STATS_LOGGER"].incr("loaded_from_source")
                    if not force_query:
                        current_app.config["STATS_LOGGER"].incr(
                            "loaded_from_source_without_force"
                        )
                except Exception:  # pylint: disable=broad-except
                    logger.exception("Unable to emit source load metric")
                self.is_loaded = True

            # Capture BigQuery memory-limit flag so it survives cache hits
            if has_request_context():
                self.bq_memory_limited = getattr(g, "bq_memory_limited", False)
                self.bq_memory_limited_row_count = getattr(
                    g, "bq_memory_limited_row_count", 0
                )
                g.bq_memory_limited = False
                g.bq_memory_limited_row_count = 0
        except Exception as ex:  # pylint: disable=broad-except
            logger.exception(ex)
            if not self.error_message:
                self.error_message = str(ex)
            self.status = QueryStatus.FAILED
            self.stacktrace = get_stacktrace()

    def write_query_result(
        self,
        key: str,
        timeout: int | None = None,
        datasource_uid: str | None = None,
        region: CacheRegion = CacheRegion.DEFAULT,
    ) -> bool:
        """Compatibility wrapper returning whether the cache write succeeded."""

        return (
            self.write_query_result_with_outcome(
                key=key,
                timeout=timeout,
                datasource_uid=datasource_uid,
                region=region,
            )
            == CacheWriteOutcome.SUCCEEDED
        )

    def write_query_result_with_outcome(
        self,
        key: str,
        timeout: int | None = None,
        datasource_uid: str | None = None,
        region: CacheRegion = CacheRegion.DEFAULT,
    ) -> CacheWriteOutcome:
        """Write an already loaded result and expose the typed outcome."""

        if not self.is_loaded or not key or self.status == QueryStatus.FAILED:
            self.cache_write_outcome = CacheWriteOutcome.NOT_ATTEMPTED
            return self.cache_write_outcome
        value: dict[str, Any] = {
            "df": self.df,
            "query": self.query,
            "applied_template_filters": self.applied_template_filters,
            "applied_filter_columns": self.applied_filter_columns,
            "rejected_filter_columns": self.rejected_filter_columns,
            "annotation_data": self.annotation_data,
            "sql_rowcount": self.sql_rowcount,
            "queried_dttm": self.queried_dttm,
            "dttm": self.queried_dttm,  # Backwards compatibility
            "bq_memory_limited": self.bq_memory_limited,
            "bq_memory_limited_row_count": self.bq_memory_limited_row_count,
        }
        if self.source_trace is not None:
            value["source_trace"] = serialize_source_trace(self.source_trace)
        self.cache_write_outcome = self.set_with_outcome(
            key=key,
            value=value,
            timeout=timeout,
            datasource_uid=datasource_uid,
            region=region,
        )
        return self.cache_write_outcome

    @classmethod
    def get(
        cls,
        key: str | None,
        region: CacheRegion = CacheRegion.DEFAULT,
        force_query: bool | None = False,
        force_cached: bool | None = False,
    ) -> QueryCacheManager:
        """
        Initialize QueryCacheManager by query-cache key
        """
        query_cache = cls()
        if not key or not _cache[region] or force_query:
            if force_cached:
                logger.warning(
                    "force_cached (QueryContext): value not found for key %s", key
                )
                raise CacheLoadError("Error loading data from cache")
            return query_cache

        cache_value: dict[str, Any] | None = _cache[region].get(key)
        if cache_value:
            logger.debug("Cache key: %s", key)
            # Log cache hit for debugging
            logger.debug("CACHE GET - Key: %s, Region: %s", key, region)
            try:
                current_app.config["STATS_LOGGER"].incr("loading_from_cache")
            except Exception:  # pylint: disable=broad-except
                logger.exception("Unable to emit cache load metric")
            try:
                query_cache.df = cache_value["df"]
                query_cache.query = cache_value["query"]
                query_cache.annotation_data = cache_value.get("annotation_data", {})
                query_cache.applied_template_filters = cache_value.get(
                    "applied_template_filters", []
                )
                query_cache.applied_filter_columns = cache_value.get(
                    "applied_filter_columns", []
                )
                query_cache.has_applied_filter_columns = (
                    "applied_filter_columns" in cache_value
                )
                query_cache.rejected_filter_columns = cache_value.get(
                    "rejected_filter_columns", []
                )
                query_cache.status = QueryStatus.SUCCESS
                query_cache.is_loaded = True
                query_cache.is_cached = cache_value is not None
                query_cache.sql_rowcount = cache_value.get("sql_rowcount", None)
                query_cache.cache_dttm = (
                    cache_value["dttm"] if cache_value is not None else None
                )
                query_cache.queried_dttm = cache_value.get(
                    "queried_dttm", cache_value.get("dttm")
                )
                query_cache.cache_value = cache_value
                query_cache.bq_memory_limited = cache_value.get(
                    "bq_memory_limited", False
                )
                query_cache.bq_memory_limited_row_count = cache_value.get(
                    "bq_memory_limited_row_count", 0
                )
                query_cache.source_trace = deserialize_source_trace(
                    cache_value.get("source_trace")
                )
                try:
                    current_app.config["STATS_LOGGER"].incr("loaded_from_cache")
                except Exception:  # pylint: disable=broad-except
                    logger.exception("Unable to emit cache hit metric")
            except KeyError as ex:
                logger.exception(ex)
                logger.error(
                    "Error reading cache: %s",
                    error_msg_from_exception(ex),
                    exc_info=True,
                )
            logger.debug("Serving from cache")

        if force_cached and not query_cache.is_loaded:
            logger.warning(
                "force_cached (QueryContext): value not found for key %s", key
            )
            raise CacheLoadError("Error loading data from cache")
        return query_cache

    @staticmethod
    def set(
        key: str | None,
        value: dict[str, Any],
        timeout: int | None = None,
        datasource_uid: str | None = None,
        region: CacheRegion = CacheRegion.DEFAULT,
    ) -> bool:
        """
        set value to specify cache region, proxy for `set_and_log_cache`
        """
        if key:
            return set_and_log_cache(
                _cache[region], key, value, timeout, datasource_uid
            )
        return False

    @staticmethod
    def set_with_outcome(
        key: str | None,
        value: dict[str, Any],
        timeout: int | None = None,
        datasource_uid: str | None = None,
        region: CacheRegion = CacheRegion.DEFAULT,
    ) -> CacheWriteOutcome:
        """Set a cache value and retain skipped versus failed semantics."""

        if not key:
            return CacheWriteOutcome.NOT_ATTEMPTED
        return set_and_log_cache_with_outcome(
            _cache[region], key, value, timeout, datasource_uid
        )

    @staticmethod
    def delete(
        key: str | None,
        region: CacheRegion = CacheRegion.DEFAULT,
    ) -> None:
        if key:
            _cache[region].delete(key)

    @staticmethod
    def has(
        key: str | None,
        region: CacheRegion = CacheRegion.DEFAULT,
    ) -> bool:
        return bool(_cache[region].get(key)) if key else False
