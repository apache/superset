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
from superset.common.query_context_processor import QueryContextProcessor
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
    custom_cache_timeout: int | None

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
        self.custom_cache_timeout = custom_cache_timeout
        self.cache_values = cache_values
        self._processor = QueryContextProcessor(self)

    def get_data(
        self,
        df: pd.DataFrame,
        coltypes: list[GenericDataType],
    ) -> str | list[dict[str, Any]]:
        return self._processor.get_data(df, coltypes)

    def get_payload(
        self,
        cache_query_context: bool | None = False,
        force_cached: bool = False,
    ) -> dict[str, Any]:
        """Returns the query results with both metadata and data"""
        return self._processor.get_payload(cache_query_context, force_cached)

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

    def get_df_payload(
        self,
        query_obj: QueryObject,
        force_cached: bool | None = False,
    ) -> dict[str, Any]:
        return self._processor.get_df_payload(
            query_obj=query_obj,
            force_cached=force_cached,
        )

    def get_query_result(self, query_object: QueryObject) -> QueryResult:
        return self._processor.get_query_result(query_object)

    def raise_for_access(self) -> None:
        self._processor.raise_for_access()
