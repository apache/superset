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
from typing import Any, ClassVar, TYPE_CHECKING

import pandas as pd

from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.common.chart_data_timing import (
    QueryAcquisitionResult,
    QueryContextExecutionResult,
)
from superset.common.query_context_processor import (
    normalize_contribution_totals,
    QueryContextProcessor,
)
from superset.common.query_object import QueryObject
from superset.explorables.base import Explorable
from superset.models.slice import Slice
from superset.utils.core import GenericDataType

if TYPE_CHECKING:
    from superset.models.helpers import QueryResult


logger = logging.getLogger(__name__)


class QueryContext:
    """
    The query context contains the query object and additional fields necessary
    to retrieve the data payload for a given viz.
    """

    cache_type: ClassVar[str] = "df"
    enforce_numerical_metrics: ClassVar[bool] = True

    datasource: Explorable
    slice_: Slice | None = None
    queries: list[QueryObject]
    form_data: dict[str, Any] | None
    result_type: ChartDataResultType
    result_format: ChartDataResultFormat
    force: bool
    # Optional idempotency token for a forced refresh. Set once per user-initiated
    # force refresh (Explore/Dashboard) and carried on every request of that
    # refresh — the async submit and the follow-up read-back. The first execution
    # to see it recomputes and records a per-(nonce, cache_key) marker; later
    # requests carrying the same nonce read the freshly-cached result instead of
    # recomputing it (see QueryContextProcessor.get_df_payload_result). Kept
    # separate from the result cache key, so non-forced loads stay warm.
    force_nonce: str | None
    custom_cache_timeout: int | None

    # Set by the async chart-data execution path (see
    # superset.tasks.async_queries.execute_chart_query). The async flow caches a
    # result and a follow-up request reads it back, so the result cache TTL is
    # floored to GLOBAL_ASYNC_QUERIES_MIN_CACHE_TTL (see
    # QueryContextProcessor.get_cache_timeout). Never set on the synchronous path.
    is_async_execution: bool = False

    cache_values: dict[str, Any]

    _processor: QueryContextProcessor

    # TODO: Type datasource and query_object dictionary with TypedDict when it becomes
    #  a vanilla python type https://github.com/python/mypy/issues/5288
    def __init__(  # pylint: disable=too-many-arguments
        self,
        *,
        datasource: Explorable,
        queries: list[QueryObject],
        slice_: Slice | None,
        form_data: dict[str, Any] | None,
        result_type: ChartDataResultType,
        result_format: ChartDataResultFormat,
        force: bool = False,
        force_nonce: str | None = None,
        custom_cache_timeout: int | None = None,
        cache_values: dict[str, Any],
    ) -> None:
        self.datasource = datasource
        self.slice_ = slice_
        self.result_type = result_type
        self.result_format = result_format
        self.queries = queries
        self.form_data = form_data
        self.force = force
        self.force_nonce = force_nonce
        self.custom_cache_timeout = custom_cache_timeout
        self.cache_values = cache_values
        # Normalize the contribution totals query before any cache key is
        # computed. The return value is unused here; we only need the side
        # effect on the totals query's row_limit.
        self.prepare_contribution_totals()
        self._processor = QueryContextProcessor(self)

    def get_data(
        self,
        df: pd.DataFrame,
        coltypes: list[GenericDataType],
    ) -> str | bytes | list[dict[str, Any]]:
        return self._processor.get_data(df, coltypes)

    def get_payload(
        self,
        cache_query_context: bool | None = False,
        force_cached: bool = False,
    ) -> dict[str, Any]:
        """Returns the query results with both metadata and data"""
        return self._processor.get_payload(cache_query_context, force_cached)

    def get_payload_result(
        self,
        cache_query_context: bool | None = False,
        force_cached: bool = False,
    ) -> QueryContextExecutionResult:
        """Return query results with timing kept outside query payloads."""
        return self._processor.get_payload_result(cache_query_context, force_cached)

    def get_cache_timeout(self) -> int | None:
        """
        Get the cache timeout for this query context.

        Priority order:
        1. Custom timeout set for this specific query
        2. Chart-level timeout (if querying from a saved chart)
        3. Datasource-level timeout (explorable handles its own fallback logic)
        4. System default (None)

        Note: Each explorable is responsible for its own internal fallback chain.
        For example, BaseDatasource falls back to database.cache_timeout,
        while semantic layers might fall back to their layer's default.
        """
        if self.custom_cache_timeout is not None:
            return self.custom_cache_timeout
        if self.slice_ and self.slice_.cache_timeout is not None:
            return self.slice_.cache_timeout
        return self.datasource.cache_timeout

    def query_cache_key(self, query_obj: QueryObject, **kwargs: Any) -> str | None:
        return self._processor.query_cache_key(query_obj, **kwargs)

    def prepare_contribution_totals(self) -> tuple[list[int], int | None]:
        """Identify contribution queries and normalize the totals query.

        Returns the indices of queries whose contribution post-processing needs a
        shared totals row, and the index of the totals query itself (or ``None``).
        The normalization is idempotent and runs at construction time as well.
        """
        return normalize_contribution_totals(self.queries, self.cache_values)

    def get_df_payload(
        self,
        query_obj: QueryObject,
        force_cached: bool | None = False,
    ) -> dict[str, Any]:
        return self._processor.get_df_payload(
            query_obj=query_obj,
            force_cached=force_cached,
        )

    def get_df_payload_result(
        self,
        query_obj: QueryObject,
        force_cached: bool | None = False,
    ) -> QueryAcquisitionResult:
        """Return dataframe payload with timing kept outside the payload."""
        return self._processor.get_df_payload_result(
            query_obj=query_obj,
            force_cached=force_cached,
        )

    def get_query_result(self, query_object: QueryObject) -> QueryResult:
        return self._processor.get_query_result(query_object)

    def raise_for_access(self) -> None:
        self._processor.raise_for_access()
