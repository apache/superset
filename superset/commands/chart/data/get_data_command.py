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
import logging
from dataclasses import dataclass
from enum import Enum
from typing import Any

from flask_babel import gettext as _

from superset.commands.base import BaseCommand
from superset.commands.chart.exceptions import (
    ChartDataCacheLoadError,
    ChartDataQueryFailedError,
)
from superset.common.chart_data import ChartDataResultType
from superset.common.chart_data_timing import (
    CacheWriteOutcome,
    chart_data_execution_scope,
    ChartDataExecutionResult,
    emit_query_timing,
)
from superset.common.query_actions import get_effective_result_type
from superset.common.query_context import QueryContext
from superset.exceptions import CacheLoadError, QueryObjectValidationError

logger = logging.getLogger(__name__)


class ChartDataExecutionMode(str, Enum):
    """Controls whether query data is returned or only persisted to cache."""

    MATERIALIZE = "materialize"
    CACHE_ONLY = "cache_only"


@dataclass(frozen=True)
class ChartDataExecutionOptions:
    """Immutable options for one chart-data execution."""

    mode: ChartDataExecutionMode = ChartDataExecutionMode.MATERIALIZE
    force_cached: bool = False
    cache_query_context: bool = False
    require_cache_writes: bool = False


class ChartDataCommand(BaseCommand):
    _query_context: QueryContext

    def __init__(self, query_context: QueryContext):
        self._query_context = query_context

    def run(self, **kwargs: Any) -> dict[str, Any]:
        """Execute and return the historical payload shape."""
        options = ChartDataExecutionOptions(
            force_cached=kwargs.get("force_cached", False),
            cache_query_context=kwargs.get("cache", False),
        )
        return self.execute(options).materialize()

    def execute(
        self, options: ChartDataExecutionOptions | None = None
    ) -> ChartDataExecutionResult:
        """Execute using a typed result with timing outside query payloads."""
        options = options or ChartDataExecutionOptions()
        with chart_data_execution_scope() as owns_telemetry:
            try:
                result = self._query_context.get_payload_result(
                    cache_query_context=options.cache_query_context,
                    force_cached=options.force_cached,
                    materialize=options.mode == ChartDataExecutionMode.MATERIALIZE,
                )
            except CacheLoadError as ex:
                raise ChartDataCacheLoadError(ex.message) from ex
            except QueryObjectValidationError as ex:
                raise ChartDataQueryFailedError(ex.message) from ex

            execution = ChartDataExecutionResult(
                query_context=self._query_context,
                queries=result.queries,
                cache_key=result.cache_key,
            )

            if owns_telemetry:
                for query in result.queries:
                    emit_query_timing(query.timing)

            # Query-only errors remain in the payload for the View Query modal.
            for query_obj, query in zip(
                self._query_context.queries, result.queries, strict=True
            ):
                result_type = get_effective_result_type(self._query_context, query_obj)
                if (
                    query.payload.get("error")
                    and result_type != ChartDataResultType.QUERY
                ):
                    raise ChartDataQueryFailedError(
                        _("Error: %(error)s", error=query.payload["error"])
                    )

            if options.mode == ChartDataExecutionMode.CACHE_ONLY:
                query_cache_failed = any(
                    query.timing.cache_write_outcome == CacheWriteOutcome.FAILED
                    or (
                        options.require_cache_writes
                        and query.timing.cache_hit is not True
                        and query.timing.cache_write_outcome
                        != CacheWriteOutcome.SUCCEEDED
                    )
                    for query in result.queries
                )
                context_cache_failed = (
                    result.context_cache_write_outcome == CacheWriteOutcome.FAILED
                    or (
                        options.require_cache_writes
                        and result.context_cache_write_outcome
                        != CacheWriteOutcome.SUCCEEDED
                    )
                )
                if query_cache_failed or context_cache_failed:
                    raise ChartDataQueryFailedError(
                        _("Chart data cache write did not complete")
                    )

            return execution

    def validate(self) -> None:
        self._query_context.raise_for_access()
