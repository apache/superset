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

from dataclasses import dataclass
from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from superset.common.query_context import QueryContext

NANOSECONDS_PER_MILLISECOND: int = 1_000_000
CHART_DATA_TIMING_VERSION: int = 1


def to_ms(value_ns: int | None) -> float | None:
    """Convert nanoseconds to rounded milliseconds for public output."""
    if value_ns is None:
        return None
    return round(value_ns / NANOSECONDS_PER_MILLISECOND, 2)


@dataclass(frozen=True)
class QueryAcquisitionTiming:
    """Timing captured by the dataframe payload owner."""

    query_planning_ns: int
    cache_resolution_ns: int
    data_acquisition_ns: int | None
    payload_assembly_ns: int


@dataclass(frozen=True)
class QueryTiming:
    """Completed timing for one query in a chart-data execution."""

    query_planning_ns: int | None
    cache_resolution_ns: int | None
    data_acquisition_ns: int | None
    payload_assembly_ns: int | None
    total_ns: int

    def as_public_dict(self) -> dict[str, Any]:
        """Return the versioned chart-data API representation."""
        return {
            "version": CHART_DATA_TIMING_VERSION,
            "query": {
                "query_planning_ms": to_ms(self.query_planning_ns),
                "cache_resolution_ms": to_ms(self.cache_resolution_ns),
                "data_acquisition_ms": to_ms(self.data_acquisition_ns),
                "payload_assembly_ms": to_ms(self.payload_assembly_ns),
                "total_ms": to_ms(self.total_ns),
            },
        }


@dataclass(frozen=True)
class QueryAcquisitionResult:
    """A dataframe payload paired with acquisition timing."""

    payload: dict[str, Any]
    timing: QueryAcquisitionTiming


@dataclass(frozen=True)
class QueryDataResult:
    """A query payload paired with completed timing."""

    payload: dict[str, Any]
    timing: QueryTiming


@dataclass(frozen=True)
class QueryContextExecutionResult:
    """Typed query-context result with timing outside query payloads."""

    queries: tuple[QueryDataResult, ...]
    cache_key: str | None = None


@dataclass(frozen=True)
class ChartDataExecutionResult:
    """Typed result of executing a chart-data command."""

    query_context: QueryContext
    queries: tuple[QueryDataResult, ...]
    cache_key: str | None = None

    def materialize(self) -> dict[str, Any]:
        """Return the historical command payload shape."""
        queries: list[dict[str, Any]] = []
        for query_result in self.queries:
            queries.append(dict(query_result.payload))

        result: dict[str, Any] = {
            "query_context": self.query_context,
            "queries": queries,
        }
        if self.cache_key is not None:
            result["cache_key"] = self.cache_key
        return result
