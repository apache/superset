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
from typing import Any, cast, ClassVar, Sequence, TYPE_CHECKING

import pandas as pd
import pyarrow as pa
from flask import current_app
from flask_babel import gettext as _

from superset.common.chart_data import ChartDataResultFormat
from superset.common.chart_data_timing import (
    QueryAcquisitionResult,
    QueryAcquisitionTiming,
    QueryContextExecutionResult,
)
from superset.common.db_query_status import QueryStatus
from superset.common.grouping_sets import grouping_marker_label
from superset.common.query_actions import get_query_results_with_timing
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
from superset.superset_typing import AdhocColumn, AdhocMetric, Column
from superset.utils import csv, excel
from superset.utils.cache import generate_cache_key, set_and_log_cache
from superset.utils.core import (
    DatasourceType,
    DTTM_ALIAS,
    error_msg_from_exception,
    GenericDataType,
    get_column_name,
    get_column_names_from_columns,
    get_column_names_from_metrics,
    get_user_id,
    is_adhoc_column,
    is_adhoc_metric,
)
from superset.utils.pandas_postprocessing.utils import unescape_separator

if TYPE_CHECKING:
    from superset.common.query_context import QueryContext
    from superset.common.query_object import QueryObject
    from superset.db_engine_specs.base import BaseEngineSpec

logger = logging.getLogger(__name__)


def normalize_contribution_totals(
    queries: list[QueryObject],
    cache_values: dict[str, Any],
) -> tuple[list[int], int | None]:
    """Identify contribution queries and normalize the totals query in place.

    Returns the indices of queries whose contribution post-processing needs a
    shared totals row, and the index of the totals query itself (or ``None``).
    The totals query's ``row_limit`` is cleared on both the ``QueryObject`` and
    the matching ``cache_values`` entry so cache keys align with cached results.
    Shared by ``QueryContext`` and ``QueryContextProcessor`` so the two stay in
    lockstep.
    """
    queries_needing_totals: list[int] = []
    totals_idx: int | None = None

    for index, query in enumerate(queries):
        if any(
            pp.get("operation") == "contribution"
            for pp in getattr(query, "post_processing", None) or []
        ):
            queries_needing_totals.append(index)

        if (
            totals_idx is None
            and not query.columns
            and query.metrics
            and not query.post_processing
        ):
            totals_idx = index

    if queries_needing_totals and totals_idx is not None:
        queries[totals_idx].row_limit = None
        raw_queries = cache_values.get("queries", [])
        if totals_idx < len(raw_queries) and isinstance(raw_queries[totals_idx], dict):
            raw_queries[totals_idx]["row_limit"] = None

    return queries_needing_totals, totals_idx


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

    @staticmethod
    def _force_marker_key(nonce: str, cache_key: str) -> str:
        """Cache key for the per-(nonce, cache_key) forced-refresh marker.

        Deliberately distinct from the result cache key so the fresh result still
        lands under the normal ``cache_key`` and non-forced loads stay warm.
        """
        return f"gtf-force-nonce:{nonce}:{cache_key}"

    def _force_nonce(self, query_obj: QueryObject) -> str | None:
        """The forced-refresh nonce for a query: its per-query token (the async
        task's UUID, set on the read-back) if present, else the context-level token
        (legacy/single-query fallback)."""
        return (
            getattr(query_obj, "force_nonce", None) or self._query_context.force_nonce
        )

    def _resolve_forced_query(
        self, query_obj: QueryObject, cache_key: str | None
    ) -> bool:
        """Resolve ``QueryContext.force`` through an optional idempotency nonce.

        A forced chart-data request in the async (GTF) flow is issued twice: the
        async submit schedules the recompute, then a follow-up request reads the
        warmed result. Re-running the force on that second request would recompute
        the identical query (double execution). When a nonce is present (the async
        task's UUID, carried per-query on the read-back — see :meth:`_force_nonce`),
        the first execution records a marker (keyed by nonce + cache_key) once its
        result is cached; any later request carrying the same nonce sees the marker
        and reads the cache instead of recomputing. A brand new force refresh uses a
        new task (new nonce), so it genuinely recomputes.

        Without a nonce (synchronous forced refresh, legacy callers) force is
        honored verbatim.

        :returns: whether the source query should be forced (cache bypassed)
        """
        if not self._query_context.force:
            return False
        nonce = self._force_nonce(query_obj)
        if not nonce or not cache_key:
            return True
        # Marker present => this forced refresh already computed and cached its
        # result; read it rather than recomputing. Best-effort like the query
        # cache itself: a marker read failure degrades to "absent" (force), never
        # an error.
        try:
            marker = cache_manager.data_cache.get(
                self._force_marker_key(nonce, cache_key)
            )
        except Exception:  # noqa: BLE001  pylint: disable=broad-except
            logger.warning("Force-nonce marker read failed; forcing recompute")
            return True
        return marker is None

    def _mark_force_executed(
        self, query_obj: QueryObject, cache_key: str | None, persisted: bool
    ) -> None:
        """Record that this ``force_nonce``'s recompute has been cached.

        No-op unless this is a nonce-bearing forced refresh whose fresh result was
        actually persisted (``persisted``). Gating on persistence is essential: if
        the result was silently skipped (oversized value) or the backend write
        failed, an old value may still sit under the normal cache key — writing the
        marker anyway would let a follow-up read stop forcing and serve that stale
        value. Best-effort: a marker write failure is logged and swallowed, costing
        at worst one extra recompute. The marker shares the result's TTL, so the
        two expire together.
        """
        nonce = self._force_nonce(query_obj)
        if not (persisted and self._query_context.force and nonce and cache_key):
            return
        try:
            # A False return (backend reported a failed write) or an exception are
            # both benign here — the result is cached, so a missing marker only
            # costs one extra recompute on the follow-up read, never stale data.
            if (
                cache_manager.data_cache.set(
                    self._force_marker_key(nonce, cache_key),
                    1,
                    timeout=self.get_cache_timeout(),
                )
                is False
            ):
                logger.warning(
                    "Force-nonce marker write reported failure; may recompute once more"
                )
        except Exception:  # noqa: BLE001  pylint: disable=broad-except
            logger.warning("Force-nonce marker write failed; may recompute once more")

    def get_df_payload_result(
        self, query_obj: QueryObject, force_cached: bool | None = False
    ) -> QueryAcquisitionResult:
        """Acquire a dataframe and return timing as a typed sidecar."""
        query_planning_start_ns = time.perf_counter_ns()
        if query_obj:
            # Always validate the query object before generating cache key
            # This ensures sanitize_clause() is called and extras are normalized
            query_obj.validate()

        cache_key = self.query_cache_key(query_obj)
        timeout = self.get_cache_timeout()
        force_query = (
            self._resolve_forced_query(query_obj, cache_key)
            or timeout == CACHE_DISABLED_TIMEOUT
        )
        query_planning_ns = max(0, time.perf_counter_ns() - query_planning_start_ns)

        cache_resolution_start_ns = time.perf_counter_ns()
        cache = QueryCacheManager.get(
            key=cache_key,
            region=CacheRegion.DATA,
            force_query=force_query,
            force_cached=force_cached,
        )

        # If cache is loaded but missing applied_filter_columns and query has filters,
        # treat as cache miss to ensure fresh query with proper applied_filter_columns
        if (
            query_obj
            and cache_key
            and cache.is_loaded
            and not cache.applied_filter_columns
            and query_obj.filter
            and len(query_obj.filter) > 0
        ):
            cache.is_loaded = False

        cache_resolution_ns = max(0, time.perf_counter_ns() - cache_resolution_start_ns)

        data_acquisition_ns: int | None = None
        if query_obj and cache_key and not cache.is_loaded:
            data_acquisition_start_ns = time.perf_counter_ns()
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
            except QueryObjectValidationError as ex:
                cache.error_message = str(ex)
                cache.status = QueryStatus.FAILED
            finally:
                data_acquisition_ns = max(
                    0, time.perf_counter_ns() - data_acquisition_start_ns
                )

            if cache.status != QueryStatus.FAILED:
                cache.set_query_result(
                    key=cache_key,
                    query_result=query_result,
                    annotation_data=annotation_data,
                    force_query=force_query,
                    timeout=self.get_cache_timeout(),
                    datasource_uid=self._qc_datasource.uid,
                    region=CacheRegion.DATA,
                )
                # Record — only if the fresh result was actually persisted — that
                # this forced refresh ran, so a follow-up request carrying the same
                # nonce reads the freshly-cached result instead of recomputing it.
                self._mark_force_executed(query_obj, cache_key, cache.result_persisted)

        payload_assembly_start_ns = time.perf_counter_ns()
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
        timing = QueryAcquisitionTiming(
            query_planning_ns=query_planning_ns,
            cache_resolution_ns=cache_resolution_ns,
            data_acquisition_ns=data_acquisition_ns,
            payload_assembly_ns=max(
                0, time.perf_counter_ns() - payload_assembly_start_ns
            ),
        )
        return QueryAcquisitionResult(payload=payload, timing=timing)

    def query_cache_key(self, query_obj: QueryObject, **kwargs: Any) -> str | None:
        """
        Returns a QueryObject cache key for objects in self.queries
        """
        datasource = self._qc_datasource
        extra_cache_keys = datasource.get_extra_cache_keys(query_obj.to_dict())

        # Annotation data is cached on the same entry as the dataframe, so the
        # key must also bind the annotation sources' security context.
        if query_obj and query_obj.annotation_layers:
            kwargs["annotation_context"] = self._annotation_cache_context(query_obj)

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

    def _annotation_cache_context(self, query_obj: QueryObject) -> dict[str, Any]:
        """
        Cache-key material binding cached annotation data to its security
        context.

        Annotation payloads are fetched per requesting user and stored on the
        same cache entry as the dataframe, so the key also binds the requesting
        user and, for chart-backed layers, the RLS clauses of the referenced
        chart's datasource.
        """
        source_rls: dict[str, list[str] | None] = {}
        for layer in query_obj.annotation_layers:
            if layer.get("sourceType") not in ("line", "table"):
                continue
            layer_value = layer.get("value")
            chart = (
                ChartDAO.find_by_id(layer_value) if layer_value is not None else None
            )
            annotation_datasource = chart.datasource if chart else None
            source_rls[str(layer.get("value"))] = (
                security_manager.get_rls_cache_key(annotation_datasource)
                if annotation_datasource
                else None
            )
        return {"user_id": get_user_id(), "source_rls": source_rls}

    def get_query_result(self, query_object: QueryObject) -> QueryResult:
        """
        Returns a pandas dataframe based on the query object.

        This method delegates to the datasource's get_query_result method,
        which handles query execution, normalization, time offsets, and
        post-processing.

        When the query requests rollup ``grouping_sets`` but the engine does not
        support native ``GROUPING SETS``, fall back to one query per level and
        concatenate the results with ``GROUPING()``-equivalent markers, so the
        combined result matches the shape the native path produces (SIP.md,
        phase 3b). Engines that support it run the single native query.
        """
        if query_object.grouping_sets and not self._supports_grouping_sets():
            return self._grouping_sets_fallback(query_object)
        return self._qc_datasource.get_query_result(query_object)

    def _supports_grouping_sets(self) -> bool:
        engine_spec: BaseEngineSpec | None = getattr(
            self._qc_datasource, "db_engine_spec", None
        )
        return bool(engine_spec and engine_spec.supports_grouping_sets)

    def _grouping_sets_fallback(self, query_object: QueryObject) -> QueryResult:
        """
        Emulate a GROUPING SETS query on engines without native support: run one
        query per rollup level and concatenate, tagging each level's rows with
        the same per-column markers the native path emits.

        This issues one sequential query per rollup level, with no cap on the
        number of levels. The level count is bounded by the pivot's row/column
        dimensionality (powerset of grouped dimensions in the worst case), so a
        chart with many dimensions on an engine lacking native GROUPING SETS
        support could fan out to a non-trivial number of queries per render.
        """
        levels: list[list[str]] = query_object.grouping_sets
        # Use the same label derivation as the native path (physical column name
        # or adhoc column label) so both column kinds are represented and each
        # label maps back to its own column, in the same order as the source
        # list.
        all_labels: list[str] = [get_column_name(col) for col in query_object.columns]
        label_to_column: dict[str, Column] = dict(
            zip(all_labels, query_object.columns, strict=True)
        )

        frames: list[pd.DataFrame] = []
        result: QueryResult | None = None
        for level in levels:
            level_labels: set[str] = set(level)
            sub_query = copy.copy(query_object)
            sub_query.grouping_sets = []
            sub_query.columns = [
                label_to_column[label] for label in all_labels if label in level_labels
            ]
            # A GROUPING SETS query computes a bounded set of rollup levels, so
            # the native path never applies row_limit to it (see the
            # `use_grouping_sets` check in models/helpers.py). Match that here:
            # limiting each level's fallback sub-query independently would
            # truncate subtotal/grand-total rows and diverge from the native
            # result shape. The native path applies `row_offset` exactly once,
            # to the combined multi-level result (see the unconditional
            # `qry.offset()` call in models/helpers.py). Applying the same
            # offset to each per-level sub-query independently would apply it
            # once per level instead of once overall, and can silently drop
            # low-row-count levels (e.g. the single grand-total row) entirely.
            # Zero it here and apply it once after concatenation instead.
            sub_query.row_limit = None
            sub_query.row_offset = 0
            result = self._qc_datasource.get_query_result(sub_query)
            level_df = result.df.copy()
            for label in all_labels:
                level_df[grouping_marker_label(label)] = (
                    0 if label in level_labels else 1
                )
            frames.append(level_df)

        if result is None:  # no levels requested; nothing to do
            return self._qc_datasource.get_query_result(query_object)

        result.df = pd.concat(frames, ignore_index=True) if frames else result.df
        if query_object.row_offset:
            result.df = result.df.iloc[query_object.row_offset :].reset_index(drop=True)
        return result

    def get_data(
        self, df: pd.DataFrame, coltypes: list[GenericDataType]
    ) -> str | bytes | list[dict[str, Any]]:
        if self._query_context.result_format == ChartDataResultFormat.ARROW:
            return self._to_arrow_ipc(df)

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

    @staticmethod
    def _to_arrow_ipc(df: pd.DataFrame) -> bytes:
        """Serialize to an Arrow IPC stream for throughput-sensitive callers.

        Serialization happens at response time rather than in the cache, so
        Arrow and JSON requests for the same query share cache entries and no
        cache-key versioning is needed.
        """
        table = pa.Table.from_pandas(df, preserve_index=False)
        sink = pa.BufferOutputStream()
        with pa.ipc.new_stream(sink, table.schema) as writer:
            writer.write_table(table)
        return sink.getvalue().to_pybytes()

    def ensure_totals_available(
        self,
        queries_needing_totals: Sequence[int] | None = None,
        totals_idx: int | None = None,
    ) -> None:
        if queries_needing_totals is None or totals_idx is None:
            queries_needing_totals, totals_idx = (
                self._query_context.prepare_contribution_totals()
            )

        if not queries_needing_totals or totals_idx is None:
            return

        totals_query = self._query_context.queries[totals_idx]

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
        result = self.get_payload_result(cache_query_context, force_cached)
        return_value: dict[str, Any] = {
            "queries": [query.payload for query in result.queries],
        }
        if result.cache_key is not None:
            return_value["cache_key"] = result.cache_key
        return return_value

    def get_payload_result(
        self,
        cache_query_context: bool | None = False,
        force_cached: bool = False,
    ) -> QueryContextExecutionResult:
        """Return query results with timing kept outside query payloads."""

        queries_needing_totals, totals_idx = (
            self._query_context.prepare_contribution_totals()
        )

        # Skip ensure_totals_available when force_cached=True
        # This prevents recalculating contribution_totals from cached results
        if not force_cached:
            self.ensure_totals_available(queries_needing_totals, totals_idx)

            # Update cache_values to reflect modifications made by
            # ensure_totals_available()
            # This ensures cache keys are generated from the actual query state
            # We merge the original query dict with the updated query dict to preserve
            # any fields that might not be in to_dict() but were in the original request
            self._query_context.cache_values["queries"] = [
                {**cached_query, **query.to_dict()}
                for cached_query, query in zip(
                    self._query_context.cache_values["queries"],
                    self._query_context.queries,
                    strict=True,
                )
            ]

        query_results = tuple(
            get_query_results_with_timing(
                query_obj.result_type or self._query_context.result_type,
                self._query_context,
                query_obj,
                force_cached,
            )
            for query_obj in self._query_context.queries
        )

        cache_key = None
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

        return QueryContextExecutionResult(queries=query_results, cache_key=cache_key)

    def get_cache_timeout(self) -> int:
        """
        Determine the cache timeout (in seconds) for this query context.

        Priority chain (highest to lowest):
          1. ``custom_cache_timeout`` — explicit per-request override.
          2. ``NATIVE_FILTER_OPTIONS_CACHE_TIMEOUT`` — when the request is a
             native filter option query and the operator has configured an
             independent TTL for filter options.
          3. Slice-level or datasource-level timeout, via
             :meth:`QueryContext.get_cache_timeout`.
          4. ``DATA_CACHE_CONFIG["CACHE_DEFAULT_TIMEOUT"]``.
          5. ``CACHE_DEFAULT_TIMEOUT`` — global fallback.

        For an async execution the result is cached then read back by a follow-up
        request, so the resolved timeout is finally floored to
        ``GLOBAL_ASYNC_QUERIES_MIN_CACHE_TTL`` to prevent a short TTL from evicting
        the result before it is fetched (see :meth:`_apply_async_min_cache_ttl`).
        """
        return self._apply_async_min_cache_ttl(self._resolve_cache_timeout())

    def _resolve_cache_timeout(self) -> int:
        # Step 1: Request-level custom timeout (e.g., Force refresh bypass)
        if self._query_context.custom_cache_timeout is not None:
            return self._query_context.custom_cache_timeout

        # Step 2: Native filter option query override.
        native_filter_timeout: int | None = current_app.config.get(
            "NATIVE_FILTER_OPTIONS_CACHE_TIMEOUT"
        )
        if native_filter_timeout is not None and self._is_native_filter_options_query(
            self._query_context.form_data or {}
        ):
            return native_filter_timeout

        # Step 3: Slice, Dataset, or Database timeouts
        if (cache_timeout := self._query_context.get_cache_timeout()) is not None:
            return cache_timeout

        # Step 4: DATA_CACHE_CONFIG fallback.
        if (
            data_cache_timeout := current_app.config["DATA_CACHE_CONFIG"].get(
                "CACHE_DEFAULT_TIMEOUT"
            )
        ) is not None:
            return data_cache_timeout

        # Step 5: Global fallback.
        return current_app.config["CACHE_DEFAULT_TIMEOUT"]

    def _apply_async_min_cache_ttl(self, timeout: int) -> int:
        """Floor an async execution's result-cache TTL (no-op otherwise).

        Only applies when this query context runs on the async path; a longer
        timeout is kept as-is, and ``0`` (flask-caching "cache forever") is already
        above any floor so it is left untouched. Synchronous requests are never
        floored, even when GLOBAL_ASYNC_QUERIES is enabled.
        """
        if not self._query_context.is_async_execution:
            return timeout
        min_ttl: int = current_app.config.get("GLOBAL_ASYNC_QUERIES_MIN_CACHE_TTL", 0)
        if 0 < timeout < min_ttl:
            return min_ttl
        return timeout

    @staticmethod
    def _is_native_filter_options_query(form_data: dict[str, Any]) -> bool:
        """
        Return ``True`` if this request is a native filter option query.

        Native filter option queries are generated by the dashboard native
        filter system when "Dynamically search all filter values" is enabled.
        They share the ``/api/v1/chart/data`` endpoint with regular chart
        queries but have different freshness requirements, especially for
        datasets whose visible values may change frequently, including
        RLS-constrained datasets.

        Detection is based on two stable fields that are exclusively set by
        the native filter system:

        * ``native_filter_id`` — set in
          ``nativeFilters/utils.ts::getFormData()`` (line 105); only ever
          present for native filter requests.
        * ``viz_type`` starting with ``"filter_"`` — the canonical prefix for
          all native filter plugins (``filter_select``, ``filter_range``,
          ``filter_time``, ``filter_timegrain``, ``filter_timecolumn``).

        .. important::
           We intentionally do **not** check ``form_data["metrics"]``.
           ``getFormData()`` in ``nativeFilters/utils.ts`` line 95
           unconditionally sets ``metrics: ["count"]`` in ``form_data``
           for every native filter request, regardless of ``sortMetric``
           configuration.  A condition on ``not form_data.get("metrics")``
           would therefore always evaluate to ``False`` in production and
           silently prevent the override from ever applying.
        """
        return bool(form_data.get("native_filter_id")) and str(
            form_data.get("viz_type", "")
        ).startswith("filter_")

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
        # Enforce the annotation read permission before returning layer records.
        if layer_ids and not security_manager.can_access("can_read", "Annotation"):
            raise QueryObjectValidationError(
                _("You don't have access to annotation layers")
            )
        layer_objects = {
            layer_object.id: layer_object
            for layer_object in AnnotationLayerDAO.find_by_ids(layer_ids)
        }

        # annotations
        for layer in annotation_layers:
            layer_id = layer["value"]
            layer_name = layer["name"]
            # A request may reference a layer id that does not exist; treat it
            # as a validation error rather than failing on the missing key.
            if (layer_object := layer_objects.get(layer_id)) is None:
                raise QueryObjectValidationError(
                    _(
                        "Annotation layer with ID %(layer_id)s was not found",
                        layer_id=layer_id,
                    )
                )
            columns = [
                "start_dttm",
                "end_dttm",
                "short_descr",
                "long_descr",
                "json_metadata",
            ]
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
