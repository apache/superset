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

"""Result and metadata types returned by the export API."""

from dataclasses import dataclass
from enum import Enum, IntEnum
from typing import Any


class GenericDataType(IntEnum):
    """Column type; values match `superset.utils.core.GenericDataType`."""

    NUMERIC = 0
    STRING = 1
    TEMPORAL = 2
    BOOLEAN = 3
    MULTI_VALUE = 4  # array-typed columns (e.g. ClickHouse Array, Postgres ARRAY)


class SkipReason(str, Enum):
    """Why a chart yielded no data; values match the Excel export error keys."""

    NO_QUERY_CONTEXT = "no-query-context"
    # Set only by Superset's own Excel export planning, never by
    # ``iter_dashboard_chart_results``.
    UNBOUNDED = "unbounded-query"
    GENERAL = "general-exception"


@dataclass(frozen=True)
class ChartQueryResult:
    """Result of one query in a chart."""

    colnames: list[str]
    coltypes: list[GenericDataType]
    data: list[dict[str, Any]]


@dataclass(frozen=True)
class ChartResult:
    """Query results for one dashboard chart, or the reason it was skipped."""

    chart_id: int
    chart_name: str
    queries: list[ChartQueryResult]
    skipped_reason: SkipReason | None


@dataclass(frozen=True)
class AppliedFilter:
    """Dashboard filter in effect, labeled for display."""

    name: str
    display_value: str


@dataclass(frozen=True)
class DashboardExportInfo:
    """Dashboard metadata that accompanies an export."""

    title: str
    permalink_url: str
    applied_filters: list[AppliedFilter]
    chart_urls: dict[int, str]
