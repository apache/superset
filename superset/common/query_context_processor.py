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
import time
from contextvars import ContextVar
from dataclasses import dataclass
from decimal import Decimal
from typing import Any, cast, ClassVar, TYPE_CHECKING

import pandas as pd
from flask import current_app
from flask_babel import gettext as _

from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.common.chart_data_timing import (
    active_source_collector,
    CacheWriteOutcome,
    QueryAcquisitionResult,
    QueryAcquisitionTiming,
    QueryContextExecutionResult,
    QueryDataResult,
    source_phase,
    source_timing,
    SourceKind,
    SourceProvider,
    SourceTimingCollector,
)
from superset.common.db_query_status import QueryStatus
from superset.common.query_actions import (
    acquire_query_data,
    AcquiredQuery,
    cache_acquired_query,
    get_effective_result_type,
    get_query_results_cache_only,
    get_query_results_with_timing,
    is_data_result_type,
    materialize_acquired_query,
)
from superset.common.utils.query_cache_manager import QueryCacheManager
from superset.common.utils.time_range_utils import get_since_until_from_time_range
from superset.constants import CACHE_DISABLED_TIMEOUT, CacheRegion
from superset.daos.annotation_layer import AnnotationLayerDAO
from superset.daos.chart import ChartDAO
from superset.exceptions import (
    QueryObjectValidationError,
    SupersetException,
)
from superset.explorables.base import Explorable
from superset.extensions import cache_manager, security_manager
from superset.models.helpers import QueryResult
from superset.superset_typing import AdhocColumn, AdhocMetric
from superset.utils import csv, excel
from superset.utils.cache import (
    generate_cache_key,
    set_and_log_cache_with_outcome,
)
from superset.utils.core import (
    DatasourceType,
    DTTM_ALIAS,
    error_msg_from_exception,
    GenericDataType,
    get_column_names_from_columns,
    get_column_names_from_metrics,
    is_adhoc_column,
    is_adhoc_metric,
)
from superset.utils.pandas_postprocessing.utils import unescape_separator
from superset.views.utils import get_viz
from superset.viz import viz_types

if TYPE_CHECKING:
    from superset.common.query_context import QueryContext
    from superset.common.query_object import QueryObject

logger = logging.getLogger(__name__)

_annotation_chart_stack: ContextVar[tuple[int, ...]] = ContextVar(
    "chart_data_annotation_stack", default=()
)

_REUSABLE_CONTRIBUTION_RESULT_TYPES = frozenset(
    {
        ChartDataResultType.FULL,
        ChartDataResultType.POST_PROCESSED,
        ChartDataResultType.RESULTS,
    }
)


@dataclass(frozen=True)
class _ContributionDependencies:
    """Acquired totals and outputs shared with the public query plan."""

    consumer_to_producer: dict[int, int]
    reusable_outputs: dict[int, AcquiredQuery]
    totals_by_producer: dict[int, dict[str, Any]]


class QueryContextProcessor:
    """
    The query context contains the query object and additional fields necessary
    to retrieve the data payload for a given viz.
    """

    _query_context: QueryContext
    _qc_datasource: Explorable

    def __init__(self, query_context: QueryContext):
        self._query_context = query_context
        self._qc_datasource = query_context.datasource

    cache_type: ClassVar[str] = "df"
    enforce_numerical_metrics: ClassVar[bool] = True

    def get_df_payload(
        self, query_obj: QueryObject, force_cached: bool | None = False
    ) -> dict[str, Any]:
        """Return the historical dataframe payload without timing metadata."""
        return self.get_df_payload_result(query_obj, force_cached).payload

    def get_df_payload_result(
        self,
        query_obj: QueryObject,
        force_cached: bool | None = False,
        source_kind: SourceKind = SourceKind.PRIMARY,
    ) -> QueryAcquisitionResult:
        """Acquire a dataframe and return timing as a typed sidecar."""

        acquisition_start_ns = time.perf_counter_ns()
        cache_key_start_ns = time.perf_counter_ns()
        if query_obj:
            # Always validate the query object before generating cache key
            # This ensures sanitize_clause() is called and extras are normalized
            query_obj.validate()
        cache_key = self.query_cache_key(query_obj)
        timeout = self.get_cache_timeout()
        force_query = self._query_context.force or timeout == CACHE_DISABLED_TIMEOUT
        cache_key_ns = max(0, time.perf_counter_ns() - cache_key_start_ns)

        cache_read_start_ns = time.perf_counter_ns()
        cache = QueryCacheManager.get(
            key=cache_key,
            region=CacheRegion.DATA,
            force_query=force_query,
            force_cached=force_cached,
        )
        cache_read_ns = max(0, time.perf_counter_ns() - cache_read_start_ns)

        # If cache is loaded but missing applied_filter_columns and query has filters,
        # treat as cache miss to ensure fresh query with proper applied_filter_columns
        if (
            query_obj
            and cache_key
            and cache.is_loaded
            and not getattr(cache, "has_applied_filter_columns", False)
            and query_obj.filter
            and len(query_obj.filter) > 0
        ):
            cache.discard_loaded_value()

        source_ns = 0
        cache_write_ns: int | None = None
        cache_write_outcome = CacheWriteOutcome.NOT_ATTEMPTED
        sources = cache.source_trace if cache.is_loaded else None
        cache_hit: bool | None = True if cache.is_loaded else None

        if query_obj and cache_key and not cache.is_loaded:
            source_start_ns = time.perf_counter_ns()
            parent_collector = active_source_collector()
            collector = SourceTimingCollector()
            try:
                with (
                    collector.activated(),
                    collector.source(source_kind, self._source_provider()),
                ):
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
                    if query_obj.annotation_layers:
                        with source_timing(SourceKind.ANNOTATION, SourceProvider.OTHER):
                            annotation_data = self.get_annotation_data(query_obj)
                    else:
                        annotation_data = {}
            except QueryObjectValidationError as ex:
                cache.error_message = str(ex)
                cache.status = QueryStatus.FAILED
            finally:
                source_ns = max(0, time.perf_counter_ns() - source_start_ns)

            sources = collector.snapshot()
            if parent_collector is not None:
                parent_collector.attach(sources)
            cache_hit = False
            if cache.status != QueryStatus.FAILED:
                query_result.source_trace = sources
                cache.load_query_result(query_result, annotation_data, force_query)
                cache_write_ns, cache_write_outcome = self._write_loaded_query_result(
                    cache, cache_key
                )

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

        warning: str | None = None
        if cache.bq_memory_limited:
            row_count = cache.bq_memory_limited_row_count
            chart_id = (self._query_context.form_data or {}).get("slice_id", "")
            prefix = f"Chart {chart_id}: " if chart_id else ""
            warning = _(
                "%(prefix)sResults truncated to %(row_count)s rows"
                " due to memory constraints.",
                prefix=prefix,
                row_count=f"{row_count:,}",
            )

        payload = {
            "cache_key": cache_key,
            "cached_dttm": cache.cache_dttm,
            "queried_dttm": cache.queried_dttm,
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
            "warning": warning,
        }
        return QueryAcquisitionResult(
            payload=payload,
            timing=QueryAcquisitionTiming(
                cache_key_ns=cache_key_ns,
                cache_read_ns=cache_read_ns,
                source_ns=source_ns,
                cache_write_ns=cache_write_ns,
                cache_write_outcome=cache_write_outcome,
                cache_hit=cache_hit,
                sources=sources,
                elapsed_ns=max(0, time.perf_counter_ns() - acquisition_start_ns),
            ),
        )

    def _write_loaded_query_result(
        self,
        cache: QueryCacheManager,
        cache_key: str,
    ) -> tuple[int | None, CacheWriteOutcome]:
        """Write eligible loaded data and measure only the backend write call."""

        if cache.status == QueryStatus.FAILED or not cache.is_loaded:
            return None, CacheWriteOutcome.NOT_ATTEMPTED
        cache_write_start_ns = time.perf_counter_ns()
        outcome = cache.write_query_result_with_outcome(
            key=cache_key,
            timeout=self.get_cache_timeout(),
            datasource_uid=self._qc_datasource.uid,
            region=CacheRegion.DATA,
        )
        return max(0, time.perf_counter_ns() - cache_write_start_ns), outcome

    def _source_provider(self) -> SourceProvider:
        if self._qc_datasource.type == DatasourceType.SEMANTIC_VIEW:
            return SourceProvider.SEMANTIC
        if self._qc_datasource.type in {DatasourceType.TABLE, DatasourceType.QUERY}:
            return SourceProvider.SQL
        return SourceProvider.OTHER

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
        """
        Returns a pandas dataframe based on the query object.

        This method delegates to the datasource's get_query_result method,
        which handles query execution, normalization, time offsets, and
        post-processing.
        """
        return self._qc_datasource.get_query_result(query_object)

    def get_data(
        self, df: pd.DataFrame, coltypes: list[GenericDataType]
    ) -> str | bytes | list[dict[str, Any]]:
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
                # Encode using the configured CSV_EXPORT encoding (default utf-8)
                # so dashboard chart exports honor the same encoding as SQL Lab.
                result = result.encode(
                    current_app.config["CSV_EXPORT"].get("encoding", "utf-8")
                )
            elif self._query_context.result_format == ChartDataResultFormat.XLSX:
                excel.apply_column_types(df, coltypes)
                result = excel.df_to_excel(
                    df, index=include_index, **current_app.config["EXCEL_EXPORT"]
                )
            return result or ""

        return df.to_dict(orient="records")

    def get_payload(
        self,
        cache_query_context: bool | None = False,
        force_cached: bool = False,
    ) -> dict[str, Any]:
        """Return the historical payload without timing metadata."""
        result = self.get_payload_result(cache_query_context, force_cached)
        return_value: dict[str, Any] = {
            "queries": [query.payload for query in result.queries]
        }
        if result.cache_key is not None:
            return_value["cache_key"] = result.cache_key
        return return_value

    def get_payload_result(
        self,
        cache_query_context: bool | None = False,
        force_cached: bool = False,
        materialize: bool = True,
    ) -> QueryContextExecutionResult:
        """Execute all queries and keep completed timing in a sidecar."""
        query_results = self._execute_query_plan(force_cached, materialize)
        cache_key: str | None = None
        context_cache_write_outcome = CacheWriteOutcome.NOT_ATTEMPTED
        if cache_query_context:
            cache_key = self.cache_key()
            context_cache_write_outcome = set_and_log_cache_with_outcome(
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
        return QueryContextExecutionResult(
            queries=query_results,
            cache_key=cache_key,
            context_cache_write_outcome=context_cache_write_outcome,
        )

    def _execute_query_plan(
        self,
        force_cached: bool,
        materialize: bool,
    ) -> tuple[QueryDataResult, ...]:
        """Execute one dependency-aware plan for every response mode."""

        contribution_plan = self._contribution_plan()
        requested_result_types = {
            query_idx: get_effective_result_type(self._query_context, query)
            for query_idx, query in enumerate(self._query_context.queries)
        }
        contribution_dependencies = self._acquire_contribution_dependencies(
            contribution_plan,
            requested_result_types,
            force_cached,
            materialize,
        )
        output_acquisitions = dict(contribution_dependencies.reusable_outputs)
        query_results: dict[int, QueryDataResult] = {}

        for query_idx, query_obj in enumerate(self._query_context.queries):
            if query_idx in output_acquisitions:
                continue
            result_type = requested_result_types[query_idx]
            if not is_data_result_type(result_type):
                query_results[query_idx] = (
                    get_query_results_with_timing(
                        result_type,
                        self._query_context,
                        query_obj,
                        force_cached,
                    )
                    if materialize
                    else get_query_results_cache_only(
                        result_type,
                        self._query_context,
                        query_obj,
                    )
                )
                continue

            totals_idx = contribution_dependencies.consumer_to_producer.get(query_idx)
            if totals_idx is not None and (
                totals_idx not in contribution_dependencies.totals_by_producer
                or not self._totals_support_consumer(
                    query_obj,
                    contribution_dependencies.totals_by_producer.get(totals_idx, {}),
                )
            ):
                query_results[query_idx] = self._dependency_failed_result(
                    _("Contribution totals query failed")
                )
                continue
            execution_query = (
                self._with_contribution_totals(
                    query_obj,
                    contribution_dependencies.totals_by_producer[totals_idx],
                )
                if totals_idx is not None
                else query_obj
            )
            acquired = acquire_query_data(
                result_type,
                self._query_context,
                execution_query,
                force_cached if materialize else False,
                detect_currency_value=materialize,
            )
            if acquired is not None:
                output_acquisitions[query_idx] = acquired
                continue
            raise QueryObjectValidationError(
                _("Data-backed result type did not produce a dataframe")
            )

        for query_idx, acquired in output_acquisitions.items():
            query_results[query_idx] = (
                materialize_acquired_query(self._query_context, acquired)
                if materialize
                else cache_acquired_query(acquired)
            )
        return tuple(
            query_results[query_idx]
            for query_idx in range(len(self._query_context.queries))
        )

    def _acquire_contribution_dependencies(
        self,
        contribution_plan: dict[int, int],
        requested_result_types: dict[int, ChartDataResultType],
        force_cached: bool,
        materialize: bool,
    ) -> _ContributionDependencies:
        """Acquire dataframe producers needed by data-backed consumers."""

        data_plan: dict[int, int] = {
            consumer_idx: producer_idx
            for consumer_idx, producer_idx in contribution_plan.items()
            if is_data_result_type(requested_result_types[consumer_idx])
        }
        reusable_outputs: dict[int, AcquiredQuery] = {}
        totals: dict[int, dict[str, Any]] = {}
        for producer_idx in sorted(set(data_plan.values())):
            producer = self._query_context.queries[producer_idx]
            requested_result_type = requested_result_types[producer_idx]
            dependency_query = self._totals_query(producer_idx)
            reuse_for_output = (
                requested_result_type in _REUSABLE_CONTRIBUTION_RESULT_TYPES
                and self._same_acquisition_identity(producer, dependency_query)
            )
            if reuse_for_output:
                dependency_query = producer
                dependency_result_type = requested_result_type
            else:
                dependency_query.result_type = ChartDataResultType.FULL
                dependency_result_type = ChartDataResultType.FULL
            acquired = acquire_query_data(
                dependency_result_type,
                self._query_context,
                dependency_query,
                force_cached if materialize else False,
                detect_currency_value=materialize and reuse_for_output,
            )
            if acquired is None:
                raise QueryObjectValidationError(
                    _("Contribution totals require a dataframe result type")
                )
            if reuse_for_output:
                reusable_outputs[producer_idx] = acquired
            if acquired.acquisition.payload["status"] != QueryStatus.FAILED:
                totals[producer_idx] = self._totals_from_df(
                    acquired.acquisition.payload["df"]
                )
        return _ContributionDependencies(
            consumer_to_producer=data_plan,
            reusable_outputs=reusable_outputs,
            totals_by_producer=totals,
        )

    def _contribution_plan(self) -> dict[int, int]:
        """Resolve explicit contribution producers with a strict legacy fallback."""

        totals_candidates = [
            (idx, query)
            for idx, query in enumerate(self._query_context.queries)
            if self._is_contribution_totals_query(query)
        ]
        plan: dict[int, int] = {}
        for idx, query in enumerate(self._query_context.queries):
            if not any(
                operation.get("operation") == "contribution"
                for operation in query.post_processing
            ):
                continue
            explicit_idx = query.contribution_totals_query_index
            if explicit_idx is not None:
                self._validate_contribution_producer(idx, explicit_idx, query)
                plan[idx] = explicit_idx
                continue
            matching = [
                candidate_idx
                for candidate_idx, candidate in totals_candidates
                if self._contribution_shape(candidate)
                == self._contribution_shape(query)
                and self._producer_metrics_match(candidate, query)
            ]
            if len(matching) > 1:
                logger.warning(
                    "Multiple totals queries match contribution query %d; "
                    "using producer %d",
                    idx,
                    matching[0],
                )
            if matching:
                plan[idx] = matching[0]
        return plan

    @staticmethod
    def _is_contribution_totals_query(query: QueryObject) -> bool:
        return bool(not query.columns and query.metrics and not query.post_processing)

    def _validate_contribution_producer(
        self,
        consumer_idx: int,
        producer_idx: int,
        consumer: QueryObject,
    ) -> None:
        if producer_idx == consumer_idx or not (
            0 <= producer_idx < len(self._query_context.queries)
        ):
            raise QueryObjectValidationError(
                _("Invalid contribution totals query index")
            )
        producer = self._query_context.queries[producer_idx]
        if (
            not self._is_contribution_totals_query(producer)
            or self._contribution_shape(producer) != self._contribution_shape(consumer)
            or not self._producer_metrics_match(producer, consumer)
        ):
            raise QueryObjectValidationError(
                _("Contribution totals query does not match its consumer")
            )

    @staticmethod
    def _contribution_shape(query: QueryObject) -> dict[str, Any]:
        shape: dict[str, Any] = dict(query.to_dict())
        for key in (
            "columns",
            "is_timeseries",
            "metrics",
            "orderby",
            "post_processing",
            "row_limit",
            "row_offset",
            "series_columns",
            "series_limit",
            "series_limit_metric",
            "group_others_when_limit_reached",
            "order_desc",
        ):
            shape.pop(key, None)
        shape["annotation_layers"] = query.annotation_layers
        shape["datasource"] = getattr(query.datasource, "uid", None)
        shape["time_offsets"] = query.time_offsets
        return shape

    @staticmethod
    def _producer_metrics_match(
        producer: QueryObject,
        consumer: QueryObject,
    ) -> bool:
        producer_metrics = producer.metrics or []
        consumer_metrics = consumer.metrics or []
        if not producer_metrics or not all(
            any(metric == consumer_metric for consumer_metric in consumer_metrics)
            for metric in producer_metrics
        ):
            return False
        has_implicit_columns = any(
            operation.get("operation") == "contribution"
            and not operation.get("options", {}).get("columns")
            for operation in consumer.post_processing
        )
        return not has_implicit_columns or (
            len(producer_metrics) == len(consumer_metrics)
            and all(
                any(metric == producer_metric for producer_metric in producer_metrics)
                for metric in consumer_metrics
            )
        )

    @staticmethod
    def _totals_support_consumer(
        consumer: QueryObject,
        totals: dict[str, Any],
    ) -> bool:
        return all(
            not columns or all(column in totals for column in columns)
            for operation in consumer.post_processing
            if operation.get("operation") == "contribution"
            for columns in [operation.get("options", {}).get("columns")]
        )

    def _totals_query(self, totals_idx: int) -> QueryObject:
        """Build a canonical all-record dependency from a public producer."""

        totals_query = copy.copy(self._query_context.queries[totals_idx])
        totals_query.row_limit = None
        totals_query.row_offset = 0
        totals_query.is_rowcount = False
        totals_query.is_timeseries = False
        totals_query.orderby = []
        totals_query.series_columns = []
        totals_query.series_limit = 0
        totals_query.series_limit_metric = None
        totals_query.group_others_when_limit_reached = False
        totals_query.annotation_layers = []
        return totals_query

    @staticmethod
    def _same_acquisition_identity(
        left: QueryObject,
        right: QueryObject,
    ) -> bool:
        """Return whether two queries share execution and dataframe cache identity."""

        return (
            left.to_dict() == right.to_dict()
            and left.annotation_layers == right.annotation_layers
            and left.time_offsets == right.time_offsets
            and left.result_type == right.result_type
            and getattr(left.datasource, "uid", None)
            == getattr(right.datasource, "uid", None)
        )

    @staticmethod
    def _totals_from_df(dataframe: pd.DataFrame) -> dict[str, Any]:
        totals: dict[str, Any] = {}
        for column in dataframe.columns:
            values = dataframe[column]
            non_null = values.dropna()
            if pd.api.types.is_numeric_dtype(values) or any(
                isinstance(value, Decimal) for value in non_null
            ):
                totals[column] = values.sum()
            elif non_null.empty:
                totals[column] = 0
        return totals

    @staticmethod
    def _with_contribution_totals(
        query: QueryObject,
        totals: dict[str, Any],
    ) -> QueryObject:
        execution_query = copy.copy(query)
        execution_query.post_processing = copy.deepcopy(query.post_processing)
        for operation in execution_query.post_processing:
            if operation.get("operation") == "contribution":
                operation.setdefault("options", {})["contribution_totals"] = totals
        return execution_query

    @staticmethod
    def _dependency_failed_result(message: str) -> QueryDataResult:
        timing = QueryAcquisitionTiming(
            cache_key_ns=0,
            cache_read_ns=0,
            source_ns=0,
            cache_write_ns=None,
            cache_write_outcome=CacheWriteOutcome.NOT_ATTEMPTED,
            cache_hit=None,
            sources=(),
        ).materialized(0)
        return QueryDataResult(
            payload={"error": message, "status": QueryStatus.FAILED},
            timing=timing,
        )

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
        with source_phase("planning"):
            annotation_layers = [
                layer
                for layer in query_obj.annotation_layers
                if layer["sourceType"] == "NATIVE"
            ]
            layer_ids = [layer["value"] for layer in annotation_layers]

        with source_phase("execution"):
            layer_objects = {
                layer_object.id: list(layer_object.annotation)
                for layer_object in AnnotationLayerDAO.find_by_ids(layer_ids)
            }

        with source_phase("processing"):
            annotation_data: dict[str, Any] = {}
            columns = [
                "start_dttm",
                "end_dttm",
                "short_descr",
                "long_descr",
                "json_metadata",
            ]
            for layer in annotation_layers:
                layer_id = layer["value"]
                layer_name = layer["name"]
                if (annotations := layer_objects.get(layer_id)) is None:
                    raise QueryObjectValidationError(
                        _(
                            "Annotation layer with ID %(layer_id)s "
                            "(referenced by '%(layer_name)s') was not found.",
                            layer_id=layer_id,
                            layer_name=layer_name,
                        )
                    )
                records = [
                    {column: getattr(annotation, column) for column in columns}
                    for annotation in annotations
                ]
                annotation_data[layer_name] = {
                    "columns": columns,
                    "records": records,
                }
            return annotation_data

    @staticmethod
    def get_viz_annotation_data(  # noqa: C901
        annotation_layer: dict[str, Any], force: bool
    ) -> dict[str, Any]:
        # pylint: disable=import-outside-toplevel
        from superset.commands.chart.data.get_data_command import ChartDataCommand

        with source_phase("execution"):
            chart = ChartDAO.find_by_id(annotation_layer["value"])
        if not chart:
            raise QueryObjectValidationError(
                _(
                    f"""Chart with ID {annotation_layer["value"]} (referenced by
                    annotation layer '{annotation_layer["name"]}') was not found.
                    Please verify that the chart exists and is accessible."""
                )
            )

        with source_phase("planning"):
            annotation_stack = _annotation_chart_stack.get()
            if chart.id in annotation_stack:
                raise QueryObjectValidationError(
                    _("Circular chart annotation dependency detected")
                )
            stack_token = _annotation_chart_stack.set((*annotation_stack, chart.id))
        try:
            if chart.viz_type in viz_types:
                with source_phase("planning"):
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

                with source_phase("execution"):
                    payload = get_viz(
                        datasource_type=chart.datasource.type,
                        datasource_id=chart.datasource.id,
                        form_data=form_data,
                        force=force,
                    ).get_payload()

                with source_phase("processing"):
                    return payload["data"]

            with source_phase("planning"):
                if not (query_context := chart.get_query_context()):
                    raise QueryObjectValidationError(
                        _(
                            f"""The query context for chart ID {chart.id} (referenced
                            by annotation layer '{annotation_layer["name"]}') was not
                            found. Please ensure the chart is properly configured and
                            has a valid query context."""
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
            with source_phase("execution"):
                command.validate()
                payload = command.run()
            with source_phase("processing"):
                return {"records": payload["queries"][0]["data"]}
        except SupersetException as ex:
            raise QueryObjectValidationError(error_msg_from_exception(ex)) from ex
        finally:
            _annotation_chart_stack.reset(stack_token)

    def raise_for_access(self) -> None:
        """
        Raise an exception if the user cannot access the resource.

        :raises SupersetSecurityException: If the user cannot access the resource
        """
        # Evaluate access before validating the queries: query validation
        # renders the request's filter expressions, so the access decision must
        # come first to avoid rendering caller-supplied input for a resource the
        # caller is not allowed to access.
        if self._qc_datasource.type == DatasourceType.QUERY:
            security_manager.raise_for_access(query=self._qc_datasource)
        else:
            security_manager.raise_for_access(query_context=self._query_context)

        for query in self._query_context.queries:
            query.validate()
